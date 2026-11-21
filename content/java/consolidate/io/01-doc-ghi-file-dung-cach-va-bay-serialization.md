---
title: "Đọc ghi file đúng cách và bẫy của serialization — buffer, đọc từng byte, charset, serialVersionUID"
summary: "Đo trên JDK 21: đọc từng byte không buffer chậm hơn đọc theo mảng hàng trăm lần, BufferedInputStream.read() từng byte vẫn chậm ~20 lần; chữ Việt hỏng khi sai charset; serialVersionUID tự sinh làm file cũ không đọc được sau khi thêm field; transient và lớp cha không Serializable."
level: intermediate
version: 21
lastReviewed: 2026-11-21
tags: [java, io, performance, serialization, pitfalls]
related: [java/review/io/inputstream-reader-va-serializable-co-ban, java/deep-dive/io/ben-trong-serialization-va-lo-hong-deserialization]
---

## Tóm tắt nhanh

- Mỗi lần `read()` trên `FileInputStream` là **một lời gọi hệ thống**. Đọc từng byte không buffer: ~7 giây cho 20 MB; đọc theo mảng 8 KB: 6–26 ms.
- `BufferedInputStream` giảm số lời gọi hệ thống, nhưng gọi `read()` **từng byte** vẫn tốn một lời gọi method có khoá cho mỗi byte: ~440 ms cho 20 MB. Đọc theo mảng mới là nhanh nhất.
- Sai charset thì chữ có dấu thành rác (`Việt` → `Viá»t`) mà không báo lỗi. Ghi rõ charset ở **cả hai đầu**.
- Không khai báo `serialVersionUID`: thêm một field là file/cache cũ **không đọc được nữa** (`InvalidClassException`). Khai báo `1L` thì đọc được, field mới nhận `null`.
- Deserialize **không chạy constructor** của class `Serializable` — nhưng **có** chạy constructor không tham số của lớp cha đầu tiên không `Serializable`.

## Cơ chế: vì sao buffer quan trọng

Ổ đĩa và hệ điều hành làm việc theo khối (4 KB trở lên). Mỗi lời gọi `read` từ Java xuống hệ điều hành (system call) tốn cỡ micro giây — rẻ với một khối 8 KB, đắt khủng khiếp nếu chỉ lấy 1 byte. Buffer gom nhiều byte vào một lần gọi. Có hai tầng chi phí:

1. Số **system call**: giảm bằng buffer (của `BufferedInputStream` hoặc mảng của bạn).
2. Số **lời gọi method Java**: `read()` từng byte trên `BufferedInputStream` vẫn là 20 triệu lời gọi, mỗi lời gọi lấy và trả một khoá nội bộ.

## Đo thử: 20 MB dữ liệu ngẫu nhiên, JDK 21

```java
// 1. FileInputStream.read() từng byte (đo 2 MB rồi nhân 10)
try (InputStream in = new FileInputStream(f)) { int b; while ((b = in.read()) != -1) s += b; }
// 2. BufferedInputStream.read() từng byte
try (InputStream in = new BufferedInputStream(new FileInputStream(f))) { int b; while ((b = in.read()) != -1) s += b; }
// 3. đọc theo mảng 8 KB
try (InputStream in = Files.newInputStream(f)) {
    byte[] buf = new byte[8192]; int n;
    while ((n = in.read(buf)) != -1) for (int i = 0; i < n; i++) s += buf[i];
}
```

```text
                          lần 1        lần 2
read() không buffer      ≈ 6.965 ms   ≈ 6.299 ms
BufferedInputStream        446 ms       435 ms
mảng 8 KB                   26 ms         6 ms
```

```java bad
try (var in = new FileInputStream(file); var out = new FileOutputStream(dich)) {
    int b;
    while ((b = in.read()) != -1) out.write(b);        // 2 system call cho mỗi byte
}
```

```java good
try (var in = Files.newInputStream(file); var out = Files.newOutputStream(dich)) {
    in.transferTo(out);                                 // chép theo khối, không tự viết vòng lặp
}
// hoặc: Files.copy(file, dich, StandardCopyOption.REPLACE_EXISTING);
```

Code đọc từng byte thường lẫn trong hàm tự viết "đọc header", "đếm dòng", "tính checksum". Với file vài KB không ai thấy; với file import 500 MB của ngân hàng, job chạy hàng giờ.

## Charset hỏng lặng lẽ

```java bad
byte[] utf8 = "Việt".getBytes(StandardCharsets.UTF_8);
new String(utf8, StandardCharsets.ISO_8859_1);   // "Viá»t" — không exception, dữ liệu đã hỏng
new FileReader(file);                             // Java 17/Windows: charset hệ điều hành (vd windows-1252)
```

```java good
Files.newBufferedReader(path, StandardCharsets.UTF_8);
new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8);
new String(bytes, StandardCharsets.UTF_8);
```

Từ Java 18 mặc định là UTF-8 trên mọi hệ điều hành, nhưng **đầu bên kia** (file từ Excel, hệ thống cũ, API đối tác) không chắc là UTF-8. Ghi rõ charset ở mọi chỗ chuyển byte ↔ ký tự, và kiểm tra bằng decoder báo lỗi khi nhận file từ bên ngoài (bài *Thiết kế exception và đọc file lớn*).

## serialVersionUID

Mỗi class `Serializable` có một số phiên bản. Không khai báo thì JVM **tự tính** từ tên class, field, method… — đổi gần như bất cứ thứ gì là số thay đổi.

```java bad
public class KhachHang implements Serializable { String ten = "An"; }
// ghi object ra kh1.ser, rồi sửa class:
public class KhachHang implements Serializable { String ten = "An"; String email; }
// đọc kh1.ser:
// InvalidClassException: KhachHang; local class incompatible:
//   stream classdesc serialVersionUID = -7432288936472171115, local class serialVersionUID = -3367090480114736390
```

```java good
public class KhachHang implements Serializable {
    private static final long serialVersionUID = 1L;
    String ten = "An";
    String email;           // thêm sau: đọc file cũ OK — ten=An, email=null
}
```

Đã chạy cả hai trường hợp trên JDK 21. Với class đã có dữ liệu serialize mà chưa khai báo, lấy đúng số đang dùng bằng công cụ `serialver`:

```text
$ serialver -classpath v1 KhachHang
KhachHang:    private static final long serialVersionUID = -7432288936472171115L;
```

Hay gặp ở đâu: session HTTP lưu vào Redis/đĩa (Spring Session, Tomcat), cache phân tán (Hazelcast, Ehcache), message JMS chứa object. Deploy bản mới mà khác UID → mọi session cũ lỗi, người dùng bị đăng xuất hàng loạt.

## transient và lớp cha

```java
class Cha { int x = 7; Cha() { System.out.println("[constructor Cha chạy]"); } }   // không Serializable
class Con extends Cha implements Serializable { int y = 8; }

// ghi rồi đọc lại một Con:
// [constructor Cha chạy]   ← lúc new Con()
// [constructor Cha chạy]   ← lúc deserialize: JVM gọi constructor không tham số của Cha
// x=7 y=8
```

Quy tắc: khi đọc, JVM tìm lớp cha **gần nhất không `Serializable`**, gọi constructor không tham số của nó (lớp cha phải có constructor đó, nếu không: `InvalidClassException: no valid constructor`), còn mọi field của các lớp `Serializable` được gán thẳng từ dữ liệu. Constructor của chính `Con` **không** chạy.

```java bad
class PhienDangNhap implements Serializable {
    private transient Map<String, Object> cache = new HashMap<>();
    Object lay(String k) { return cache.get(k); }      // sau khi đọc lại từ Redis: NullPointerException
}
```

```java good
class PhienDangNhap implements Serializable {
    private transient Map<String, Object> cache;
    private Map<String, Object> cache() {
        if (cache == null) cache = new HashMap<>();     // khởi tạo lười, đúng cả sau khi deserialize
        return cache;
    }
}
```

## Pitfalls

- Bọc stream mà đóng **stream bên trong** thay vì bên ngoài → buffer của stream ngoài chưa flush, dữ liệu cuối bị mất.
- `PrintWriter` **nuốt exception** (`println` không ném `IOException`); kiểm tra `checkError()` hoặc dùng `BufferedWriter`.
- `available()` không phải "kích thước còn lại" — với mạng nó thường là 0. Đừng cấp phát mảng theo `available()`.
- `ObjectOutputStream` giữ tham chiếu tới **mọi object đã ghi** (để ghi tham chiếu lặp lại) → ghi hàng triệu object qua một stream sẽ hết heap. Gọi `reset()` định kỳ, hoặc tốt hơn: đừng dùng Java serialization cho dữ liệu lớn.
- Anonymous class, lambda không `Serializable` → `NotSerializableException: Se$1` khi đặt vào session/cache.
- Serialize `HashMap` 2 phần tử tốn 178 byte, JSON tương đương 27 byte (đo trên JDK 21) — Java serialization ghi kèm mô tả class.

:::senior Góc nhìn senior
Hai quy tắc giữ hệ thống yên ổn: (1) mọi I/O đều có **buffer** và **charset rõ ràng**, và dùng API tiện của `Files` thay vì tự lắp chuỗi stream khi có thể; (2) **không** dùng Java serialization làm định dạng lưu trữ hay trao đổi. Nếu bắt buộc (session của framework, cache cũ), khai báo `serialVersionUID` cho mọi class tham gia, có test "đọc dữ liệu của bản trước", và đưa deserialization vào checklist bảo mật (bài chuyên sâu). Dữ liệu mới: JSON với schema rõ ràng, hoặc Protobuf/Avro khi cần nhỏ và có kiểm soát phiên bản.
:::

:::version 21 Java 8 / 11 / 17 / 21
- `Files.copy`, `Files.newBufferedReader`: Java 7. `transferTo`: Java 9.
- UTF-8 mặc định (JEP 400): Java 18. Dự án Java 17 phải ghi charset tường minh ở mọi chỗ.
- Từ JDK 19, `BufferedInputStream`/`BufferedOutputStream` dùng khoá nội bộ thay cho `synchronized` (để virtual thread không bị pin) — vẫn là một lần lấy/trả khoá cho mỗi lời gọi `read()`.
:::

:::interview Vì sao nên khai báo `serialVersionUID`?
`serialVersionUID` là số phiên bản dùng để kiểm tra class lúc đọc có tương thích với class lúc ghi hay không. Không khai báo thì JVM tự tính từ cấu trúc class (tên, field, method, interface) — thêm một field, thêm một method cũng có thể làm số thay đổi, và dữ liệu đã lưu (session, cache, file) không đọc được nữa với `InvalidClassException: local class incompatible`. Số tự tính còn có thể khác nhau giữa các compiler. Khai báo cố định (vd `1L`) cho phép tự quản lý tương thích: thêm field thì đọc dữ liệu cũ được với giá trị mặc định; thay đổi không tương thích (đổi kiểu field) thì chủ động tăng số.
:::

:::quiz Đọc file 20 MB, cách nào **nhanh nhất** theo số đo trên JDK 21?
- [ ] `FileInputStream.read()` từng byte
- [ ] `BufferedInputStream.read()` từng byte
- [x] `read(byte[8192])` theo mảng
- [ ] Ba cách như nhau vì hệ điều hành đã có cache

Từng byte không buffer ≈ 6–7 giây, `BufferedInputStream` từng byte ≈ 440 ms, theo mảng 6–26 ms. Buffer giảm system call; đọc theo mảng giảm thêm số lời gọi method.
:::

:::quiz Class `Con extends Cha implements Serializable`, `Cha` không `Serializable` và có constructor không tham số in ra một dòng. Khi **deserialize** một `Con`, constructor nào chạy?
- [ ] Constructor của `Con` và của `Cha`
- [ ] Không constructor nào
- [x] Chỉ constructor không tham số của `Cha`
- [ ] Chỉ constructor của `Con`

JVM gọi constructor không tham số của lớp cha gần nhất không `Serializable` để khởi tạo phần dữ liệu không được ghi; phần `Serializable` gán thẳng từ dữ liệu, bỏ qua constructor. Đã chạy thử trên JDK 21.
:::

:::exercise Chép file có báo tiến độ
Viết `static long chep(Path nguon, Path dich, LongConsumer baoTienDo)` chép file theo khối 64 KB, gọi `baoTienDo` với tổng số byte đã chép sau mỗi **1 MB**, trả về tổng số byte. Không để lại file `dich` dở dang nếu có lỗi giữa chừng.
???
```java
static long chep(Path nguon, Path dich, LongConsumer baoTienDo) throws IOException {
    Path tam = dich.resolveSibling(dich.getFileName() + ".part");
    long tong = 0, lanBaoTruoc = 0;
    try (InputStream in = Files.newInputStream(nguon);
         OutputStream out = Files.newOutputStream(tam)) {
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) != -1) {
            out.write(buf, 0, n);                  // chỉ ghi n byte đã đọc, không ghi cả mảng
            tong += n;
            if (tong - lanBaoTruoc >= 1 << 20) { baoTienDo.accept(tong); lanBaoTruoc = tong; }
        }
    } catch (IOException e) {
        Files.deleteIfExists(tam);
        throw e;
    }
    Files.move(tam, dich, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    return tong;
}
```

Ba chi tiết quan trọng: `write(buf, 0, n)` thay vì `write(buf)` (lần đọc cuối thường không đầy mảng); ghi ra file tạm rồi `move` để người đọc `dich` không bao giờ thấy file dở dang; xoá file tạm khi lỗi. Đã chạy thử với file 20 MB: báo tiến độ 19 lần, trả 20000000.
:::
