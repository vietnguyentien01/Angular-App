---
title: "Bên trong serialization và lỗ hổng deserialization — bỏ qua constructor, serialization proxy, ObjectInputFilter"
summary: "Xem định dạng nhị phân (AC ED 00 05), tái hiện deserialize tạo object số dư âm vì bỏ qua constructor, chặn bằng readObject, record hoặc serialization proxy; readResolve cho singleton; vì sao deserialize dữ liệu không tin cậy dẫn tới chạy code từ xa và cách khoá bằng ObjectInputFilter."
level: advanced
version: 21
lastReviewed: 2026-11-21
tags: [java, serialization, security, io, internals]
related: [java/consolidate/io/doc-ghi-file-dung-cach-va-bay-serialization, java/deep-dive/oop/sealed-record-pattern-va-mo-hinh-domain]
---

## Tóm tắt nhanh

- Java serialization ghi **tên class + giá trị field** theo một định dạng nhị phân riêng. Khi đọc, JVM cấp phát object **không qua constructor** của class `Serializable` rồi gán field bằng cơ chế nội bộ — mọi kiểm tra trong constructor bị bỏ qua.
- Đã tái hiện: sửa 8 byte trong dữ liệu đã ghi → đọc ra `TaiKhoan` có `soDu = -5` dù constructor cấm số âm.
- Ba cách bảo vệ bất biến: kiểm tra trong `readObject`; dùng **record** (deserialize đi qua constructor chuẩn); hoặc mẫu **serialization proxy** (`writeReplace` + `readResolve`).
- `readObject()` có thể tạo object của **bất kỳ class nào trên classpath** mà dữ liệu chỉ định, và chạy code của chúng (`readObject`, `hashCode`, `equals`…). Ghép nhiều class sẵn có thành chuỗi (*gadget chain*) → **chạy code từ xa**. Đây là nguồn của hàng loạt lỗ hổng nghiêm trọng (Apache Commons Collections 2015, WebLogic, JBoss, Jenkins…).
- Không deserialize dữ liệu không tin cậy. Nếu bắt buộc: `ObjectInputFilter` (Java 9, JEP 290) theo **danh sách cho phép**, hoặc `-Djdk.serialFilter` cho cả JVM.

## Định dạng bên trong

```text
$ od -A x -t x1z tk.ser
000000 ac ed 00 05 73 72 00 0b 53 65 24 54 61 69 4b 68  >....sr..Se$TaiKh<
000010 6f 61 6e 00 00 00 00 00 00 00 01 02 00 02 4a 00  >oan...........J.<
000020 04 73 6f 44 75 4c 00 02 73 6f 74 00 12 4c 6a 61  >.soDuL..sot..Lja<
```

- `ac ed` — magic number của Java serialization, `00 05` — phiên bản định dạng. Thấy `rO0AB` trong cookie, header hay tham số (là `ac ed 00 05` mã hoá Base64) là dấu hiệu ứng dụng đang nhận object Java từ client — cần kiểm tra ngay.
- `73 72` — `TC_OBJECT`, `TC_CLASSDESC`; tiếp theo là tên class `Se$TaiKhoan` và `serialVersionUID` (`00 … 01` = `1L`).
- Sau đó là danh sách field: `J` + `soDu` (long), `L` + `so` (tham chiếu, kiểu `Ljava/lang/String;`)… rồi tới giá trị.

Dữ liệu tự mô tả nên **đọc được mà không cần biết trước class nào** — tiện, và cũng chính là gốc của lỗ hổng.

## Bỏ qua constructor

```java
static class TaiKhoan implements Serializable {
    private static final long serialVersionUID = 1L;
    final String so;
    long soDu;
    TaiKhoan(String so, long soDu) {
        if (soDu < 0) throw new IllegalArgumentException("số dư âm");
        this.so = so; this.soDu = soDu;
        System.out.println("[constructor TaiKhoan chạy]");
    }
}
```

Ghi một `TaiKhoan("001", 1_000_000)`, rồi thay 8 byte của giá trị `1000000` trong mảng byte bằng `-5` (giả lập dữ liệu bị sửa trên đường truyền hoặc trong cache):

```text
ghi TaiKhoan:
  [constructor TaiKhoan chạy]
  79 byte
đọc lại:            so=001 soDu=1000000 matKhau=null   cùng object? false
đọc bản bị sửa:     soDu=-5   ← constructor kiểm tra không chạy
```

Field `final` cũng được gán — cơ chế nội bộ của JVM không bị quy tắc `final` của ngôn ngữ ràng buộc. Bất biến nào chỉ nằm trong constructor đều không còn được bảo đảm.

## Ba cách giữ bất biến

### 1. Kiểm tra trong `readObject`

```java
private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException {
    in.defaultReadObject();
    if (soDu < 0) throw new InvalidObjectException("số dư âm: " + soDu);
}
// dữ liệu bị sửa → InvalidObjectException: số dư âm: -5
```

Nhược điểm: lặp lại logic kiểm tra của constructor; field `final` không gán lại được trong `readObject` khi cần chép phòng thủ (defensive copy).

### 2. Record

```java
record TaiKhoanRec(String so, long soDu) implements Serializable {
    TaiKhoanRec { if (soDu < 0) throw new IllegalArgumentException("số dư âm"); }
}
// dữ liệu bị sửa → InvalidObjectException: số dư âm
```

Record được deserialize **qua constructor chuẩn** (Java 16+): đọc giá trị các thành phần từ stream rồi gọi constructor — compact constructor chạy, bất biến được giữ. Đã chạy: dòng `[constructor record chạy]` xuất hiện khi đọc. Không cần (và không được) viết `readObject` cho record.

### 3. Serialization proxy

```java
static final class TaiKhoan implements Serializable {
    private static final long serialVersionUID = 1L;
    private final String so;
    private final long soDu;
    TaiKhoan(String so, long soDu) { /* kiểm tra như cũ */ }

    private Object writeReplace() { return new Proxy(so, soDu); }          // ghi Proxy thay cho TaiKhoan
    private void readObject(ObjectInputStream in) throws InvalidObjectException {
        throw new InvalidObjectException("phải đi qua Proxy");             // chặn dữ liệu giả dạng TaiKhoan trực tiếp
    }
    private record Proxy(String so, long soDu) implements Serializable {
        private Object readResolve() { return new TaiKhoan(so, soDu); }   // đọc xong Proxy → tạo TaiKhoan qua constructor
    }
}
// đọc bình thường: TaiKhoan 001:1000000
// dữ liệu bị sửa:  IllegalArgumentException: số dư âm
```

Đây là mẫu trong *Effective Java*: class thật không bao giờ được deserialize trực tiếp, mọi object đều đi qua constructor công khai. Dùng khi class không thể là record (có kế thừa, có state ẩn).

## Singleton và `readResolve`

```text
enum CauHinh { INSTANCE }                         → đọc lại == INSTANCE: true
class Singleton (không readResolve)              → đọc lại == INSTANCE: false   ← có hai "singleton"
class SingletonDung { Object readResolve() { return INSTANCE; } }   → true
```

Enum được serialize theo **tên** và luôn trả về hằng số có sẵn — cách đơn giản nhất để có singleton an toàn với serialization (và reflection).

## Vì sao deserialize là lỗ hổng

Khi `readObject()` chạy, JVM:

1. Đọc tên class từ dữ liệu → **nạp class đó** nếu có trên classpath (bất kỳ thư viện nào trong `lib/`).
2. Tạo object, gán field theo dữ liệu.
3. Gọi `readObject`/`readResolve` của class đó nếu có; dựng `HashMap`/`HashSet` thì gọi `hashCode`/`equals` của key.

Kẻ tấn công không cần class của bạn. Họ chọn những class **có sẵn trong các thư viện phổ biến** mà `readObject`/`hashCode` của chúng gọi tiếp tới code khác, rồi xếp thành chuỗi sao cho bước cuối là gọi một method nguy hiểm (chạy lệnh hệ điều hành, nạp class từ xa). Năm 2015, chuỗi như vậy trong Apache Commons Collections cho phép chạy code từ xa trên WebLogic, WebSphere, JBoss, Jenkins chỉ bằng một request. Công cụ kiểm thử bảo mật như ysoserial tạo sẵn các chuỗi này.

Không có bản vá chung cho "deserialize dữ liệu không tin cậy" — mỗi chuỗi mới lại được tìm ra. Biện pháp đúng là **không nhận** object Java từ bên ngoài.

## ObjectInputFilter

```java
try (var in = new ObjectInputStream(input)) {
    in.setObjectInputFilter(ObjectInputFilter.Config.createFilter(
        "vn.hoc.TaiKhoan;java.lang.*;!*"));          // chỉ cho phép đúng class cần, chặn mọi thứ khác
    return in.readObject();
}
// đọc một ArrayList với filter trên → InvalidClassException: filter status: REJECTED
```

Cho cả JVM (gồm thư viện bạn không kiểm soát, vd cache, RMI):

```bash
java -Djdk.serialFilter='vn.hoc.*;java.util.ArrayList;java.lang.*;!*' -jar app.jar
# đã chạy: deserialize ArrayList<Date> → REJECTED vì java.util.Date không có trong danh sách
java -Djdk.serialFilter='maxdepth=10;maxarray=100000;maxbytes=1000000' -jar app.jar
# giới hạn kích thước/độ sâu, chống tấn công làm hết bộ nhớ
```

- Luôn viết theo **danh sách cho phép** và kết thúc bằng `!*`. Danh sách chặn (chặn vài class đã biết là nguy hiểm) luôn đi sau kẻ tấn công một bước.
- Java 17 (JEP 415) thêm *filter factory* (`jdk.serialFilterFactory`) để chọn filter theo từng ngữ cảnh.

## So sánh phương án

| Cần | Chọn | Ghi chú |
|---|---|---|
| Trao đổi dữ liệu giữa service, API | JSON (Jackson), Protobuf, Avro | Chỉ tạo đúng kiểu đã khai báo; có schema, tương thích phiên bản rõ ràng |
| Lưu cache phân tán / session | Serializer JSON của Redis/Spring Session, hoặc Kryo có đăng ký class | Không dùng `JdkSerializationRedisSerializer` mặc định nếu có thể |
| Buộc phải dùng Java serialization | Record hoặc serialization proxy + `ObjectInputFilter` danh sách cho phép | Khai báo `serialVersionUID` mọi class |
| Singleton | `enum` | An toàn với cả serialization lẫn reflection |
| Dữ liệu nhạy cảm trong object | `transient` + không ghi ra ngoài | Heap dump / file `.ser` đều chứa dữ liệu |

Lưu ý với Jackson: bật *default typing* (`activateDefaultTyping`, hoặc `@JsonTypeInfo(use = Id.CLASS)`) cho phép JSON chỉ định tên class — mở lại đúng lỗ hổng như Java serialization. Dùng `@JsonTypeInfo(use = Id.NAME)` với danh sách `@JsonSubTypes` cố định.

## Tính năng mới theo phiên bản

- **Java 1.1**: Java serialization. **Java 9**: `ObjectInputFilter`, `jdk.serialFilter` (JEP 290; backport về 8u121).
- **Java 16**: record serialize/deserialize qua constructor chuẩn.
- **Java 17**: filter factory theo ngữ cảnh (JEP 415).
- **Java 21**: không thay đổi gì ở phần này. Nhóm phát triển JDK đã nói về việc thay thế serialization bằng cơ chế dựa trên constructor ("serialization 2.0") — chưa có trong bản phát hành chính thức nào.

:::senior Góc nhìn senior
Trong review bảo mật, tìm mọi chỗ gọi `ObjectInputStream.readObject` (kể cả gián tiếp qua thư viện: RMI, JMX, JMS `ObjectMessage`, cache, Spring `HttpInvoker` cũ) và hỏi: dữ liệu này có thể đến từ người ngoài không? Nếu có — thay định dạng, không vá bằng filter. Đặt `-Djdk.serialFilter` danh sách cho phép cho mọi ứng dụng như một lớp phòng thủ chung. Với dependency, quét bằng công cụ phân tích thành phần (OWASP Dependency-Check, Snyk) để biết thư viện nào có gadget chain đã công bố.
:::

:::quiz Vì sao deserialize dữ liệu không tin cậy có thể dẫn tới chạy code từ xa, kể cả khi class của bạn không có code nguy hiểm?
- [ ] Vì JVM chạy bytecode được nhúng trong dữ liệu serialize
- [x] Vì dữ liệu chọn được class bất kỳ trên classpath; `readObject`/`hashCode`… của các class thư viện có sẵn có thể nối thành chuỗi dẫn tới method nguy hiểm
- [ ] Vì `serialVersionUID` có thể bị giả mạo
- [ ] Vì `transient` field được bỏ qua kiểm tra

Dữ liệu chỉ chứa tên class và giá trị field, không chứa code — nhưng nó điều khiển được **code nào sẵn có** sẽ chạy. Đó là gadget chain.
:::

:::quiz Cách nào bảo đảm bất biến "số dư không âm" vẫn được kiểm tra khi deserialize? (chọn nhiều)
- [x] Dùng record có compact constructor kiểm tra
- [x] Viết `readObject` gọi `defaultReadObject()` rồi kiểm tra
- [x] Mẫu serialization proxy với `writeReplace`/`readResolve`
- [ ] Đánh dấu field `final`

Đã chạy cả ba trên JDK 21 với dữ liệu bị sửa thành -5: đều ném exception. Field `final` vẫn bị gán bởi cơ chế deserialize, không bảo vệ được gì.
:::

:::exercise Khoá deserialize cho một cache cũ
Một hệ thống cũ lưu `List<SanPham>` vào file cache bằng Java serialization và đọc lại khi khởi động. File nằm trên ổ dùng chung mà nhiều người ghi được. Viết hàm đọc an toàn nhất có thể mà chưa phải đổi định dạng, và nêu kế hoạch thay thế.
???
```java
static List<SanPham> docCache(Path f) throws IOException, ClassNotFoundException {
    var filter = ObjectInputFilter.Config.createFilter(
        "java.util.ArrayList;vn.hoc.SanPham;java.lang.String;java.math.BigDecimal;java.math.BigInteger;java.lang.Number;"
        + "java.lang.Object;"                              // ArrayList đọc nội dung vào một Object[]
        + "maxdepth=5;maxarray=1000000;maxbytes=50000000;!*");
    try (var in = new ObjectInputStream(new BufferedInputStream(Files.newInputStream(f)))) {
        in.setObjectInputFilter(filter);
        Object o = in.readObject();
        if (!(o instanceof List<?> ds)) throw new InvalidObjectException("không phải List");
        List<SanPham> kq = new ArrayList<>();
        for (Object x : ds) kq.add((SanPham) x);          // kiểm tra kiểu từng phần tử
        return kq;
    }
}
```

- Filter danh sách cho phép đúng các class có trong dữ liệu (thêm dần khi gặp `REJECTED` trong test, không thêm `*`), giới hạn độ sâu, độ dài mảng và tổng số byte. Đã chạy thử trên JDK 21: thiếu `java.lang.Object` thì chính `ArrayList.readObject` bị chặn (nó đọc phần tử vào một mảng `Object[]`); thêm vào thì đọc được hai `SanPham`, còn file chứa `java.util.Date` bị `REJECTED`.
- `SanPham` chuyển thành record (hoặc serialization proxy) để bất biến được kiểm tra khi đọc.
- Kế hoạch thay thế: ghi song song định dạng JSON (Jackson) một thời gian, chuyển đọc sang JSON, rồi bỏ file `.ser`. Trong lúc đó, sửa quyền thư mục để chỉ ứng dụng ghi được file cache.
:::
