---
title: "Singleton và khởi tạo lười thread-safe — holder idiom, enum, StableValue và những cách phá Singleton"
summary: "Tái hiện Singleton ngây thơ tạo 32 object khi 32 thread gọi cùng lúc, sửa bằng holder idiom dựa trên khởi tạo class của JVM, thử phá Singleton bằng reflection và serialization (enum chống được cả hai), và StableValue (preview ở Java 25). Đã chạy trên JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, singleton, concurrency, lazy-initialization, stable-value, java-25]
related: [design-patterns/review/creational/factory-builder-singleton, design-patterns/consolidate/anti-patterns/god-class-va-service-locator]
---

## Tóm tắt nhanh

- `if (instance == null) instance = new X();` **không thread-safe**: 32 thread gọi cùng lúc lúc khởi động tạo ra **32 object** (đo được khi constructor mất 5 ms).
- **Holder idiom** (`private static class Holder { static final X INSTANCE = new X(); }`) vừa lười vừa thread-safe, không cần `synchronized`: JVM đảm bảo một class chỉ được khởi tạo một lần.
- **Enum Singleton** chống được cả reflection (*Cannot reflectively create enum objects*) và serialization.
- Singleton bằng class thường bị phá bởi reflection (`setAccessible`) và serialization (deserialize ra object mới), trừ khi có `readResolve`.
- **Java 25**: `StableValue` (preview, JEP 502) — giá trị khởi tạo lười đúng một lần, thread-safe, JIT coi như hằng số.

## Cơ chế: race khi khởi tạo lười

```java bad title="CauHinhNgayTho"
class CauHinhNgayTho {
    private static CauHinhNgayTho instance;
    private CauHinhNgayTho() { /* đọc file cấu hình: ~5 ms */ }
    static CauHinhNgayTho get() {
        if (instance == null) instance = new CauHinhNgayTho();    // check-then-act
        return instance;
    }
}
```

Cho 32 thread chờ ở một `CountDownLatch` rồi cùng gọi `get()`:

```text
ngây thơ: số lần chạy constructor=32, số object khác nhau=32
```

Mọi thread đều thấy `instance == null` trước khi thread đầu tiên gán xong. Khi constructor gần như không tốn thời gian, lỗi hiếm hơn nhưng **vẫn xảy ra** — ba lần chạy liên tiếp: 2, 1, 2 object. Đó là kiểu bug "thỉnh thoảng" khó tái hiện nhất: hai pool kết nối, hai bộ đếm, cấu hình bị đọc hai lần.

Cách sửa cổ điển *double-checked locking* (kiểm tra, `synchronized`, kiểm tra lại) chỉ đúng khi field là **`volatile`**; thiếu `volatile`, một thread có thể thấy tham chiếu khác `null` trỏ tới object **chưa khởi tạo xong** (Java Memory Model cho phép sắp xếp lại lệnh). Không cần nhớ cách viết đó — dùng holder.

## Holder idiom

```java good title="CauHinhHolder"
class CauHinhHolder {
    private CauHinhHolder() { /* đọc cấu hình */ }
    private static class Holder { static final CauHinhHolder INSTANCE = new CauHinhHolder(); }
    static CauHinhHolder get() { return Holder.INSTANCE; }
}
```

```text
holder: số lần chạy constructor=1, số object khác nhau=1
```

Class `Holder` chỉ được JVM khởi tạo khi `get()` truy cập `Holder.INSTANCE` lần đầu (lười). Đặc tả JVM (JLS §12.4.2) yêu cầu khởi tạo class có khoá: thread khác phải chờ tới khi khởi tạo xong. Sau đó mỗi lần gọi chỉ là đọc một field `static final`, không có chi phí đồng bộ.

## Phá Singleton

```java
class PhienBan implements Serializable {
    static final PhienBan INSTANCE = new PhienBan();
    private PhienBan() {}
}

Constructor<PhienBan> c = PhienBan.class.getDeclaredConstructor();
c.setAccessible(true);
c.newInstance() == PhienBan.INSTANCE;               // reflection: cùng object? false
saoChep(PhienBan.INSTANCE) == PhienBan.INSTANCE;    // serialization: cùng object? false
```

Thêm `private Object readResolve() { return INSTANCE; }` thì deserialize trả lại instance có sẵn (`có readResolve: cùng object? true`). Enum được JVM xử lý riêng:

```text
enum serialization: cùng object? true
enum reflection: java.lang.IllegalArgumentException: Cannot reflectively create enum objects
```

(`saoChep` = ghi object ra `ObjectOutputStream` rồi đọc lại bằng `ObjectInputStream`.)

## StableValue (preview ở Java 25)

```java
static final Supplier<CauHinh> CAU_HINH =
    StableValue.supplier(() -> new CauHinh("jdbc:postgresql://db/donhang"));

CAU_HINH.get();   // lần đầu: tạo; các lần sau: trả lại giá trị đó
```

Với 32 thread gọi đồng thời, chạy bằng `java --enable-preview --source 25`:

```text
StableValue: số lần tạo=1, số object=1, CauHinh[url=jdbc:postgresql://db/donhang]
```

Không bật preview: *StableValue is a preview API and is disabled by default*. Khác holder idiom: không cần thêm class lồng, dùng được cho field **không static** (mỗi object một giá trị lười), và JVM được phép tối ưu giá trị đã đặt như hằng số. Vì là preview, API có thể đổi tên hoặc đổi hình ở bản JDK sau — chưa dùng trong production.

## So sánh phương án

| Cách | Lười | Thread-safe | Chống reflection/serialization | Ghi chú |
|---|---|---|---|---|
| `static final` khởi tạo ngay | Không (khi class nạp) | Có | Không | Đủ dùng cho phần lớn trường hợp |
| Kiểm tra `null` ngây thơ | Có | **Không** | Không | Không dùng |
| `synchronized get()` | Có | Có | Không | Mọi lần gọi đều lấy khoá |
| Double-checked + `volatile` | Có | Có | Không | Dễ viết sai |
| Holder idiom | Có | Có | Không | Gọn, nhanh |
| `enum` | Không | Có | **Có** | Không kế thừa class khác được |
| `StableValue` (Java 25, preview) | Có | Có | — | Dùng cả cho field thường |
| Bean singleton của Spring | Tuỳ (`@Lazy`) | Có (container khởi tạo một lần) | — | Lựa chọn mặc định trong ứng dụng Spring |

## Tính năng mới theo phiên bản

- **Java 5**: Java Memory Model mới (JSR 133) — từ đây double-checked locking với `volatile` mới đúng.
- **Java 5**: `enum` — cách viết Singleton chống reflection/serialization.
- **Java 25**: `StableValue` preview (JEP 502).

:::senior Góc nhìn senior
Singleton tự viết là **trạng thái toàn cục**: mọi class gọi `X.getInstance()` đều phụ thuộc ngầm vào nó, test không thay được, và thứ tự khởi tạo giữa các Singleton trở thành bug khó lần. Trong ứng dụng có DI container, hãy để container tạo một instance và tiêm qua constructor. Chỉ tự viết (holder/enum) cho thư viện nhỏ không có container, hoặc cho thứ thật sự là hằng số của process.
:::

:::quiz Vì sao holder idiom thread-safe mà không cần `synchronized`?
- [ ] Vì field là `private`
- [x] JVM đảm bảo một class chỉ được khởi tạo một lần, có khoá; thread khác chờ tới khi khởi tạo xong
- [ ] Vì `static` luôn thread-safe
- [ ] Vì constructor là `private`

Lần truy cập đầu tới `Holder.INSTANCE` kích hoạt khởi tạo class `Holder`. Đã đo: 32 thread → 1 lần chạy constructor.
:::

:::quiz Cách nào giữ được Singleton khi bị reflection `setAccessible(true)` gọi constructor private?
- [ ] Holder idiom
- [ ] Thêm `readResolve`
- [x] Dùng `enum`
- [ ] Đánh dấu constructor là `final`

Đã chạy: JVM từ chối với *Cannot reflectively create enum objects*. `readResolve` chỉ chống serialization.
:::

:::exercise Bộ sinh mã giao dịch
Một lớp `BoSinhMa` cấp mã giao dịch tăng dần trong ngày, hiện viết là Singleton ngây thơ với `long dem` và `get()` kiểm tra `null`. Production thỉnh thoảng có **hai giao dịch trùng mã**. Liệt kê các lỗi và đề xuất thiết kế lại cho ứng dụng Spring chạy 3 instance.
???
Có ba lớp lỗi:

1. **Khởi tạo**: `get()` không thread-safe → có thể có hai `BoSinhMa`, mỗi cái đếm riêng.
2. **Bộ đếm**: `dem++` trên `long` không phải thao tác nguyên tử → hai thread có thể nhận cùng giá trị. Dùng `AtomicLong.incrementAndGet()`.
3. **Phạm vi**: Singleton chỉ là một instance **trong một JVM**. Ba instance ứng dụng là ba bộ đếm độc lập → trùng mã là chắc chắn, dù sửa (1) và (2).

Thiết kế lại: mã phải duy nhất **toàn hệ thống**, nên nguồn sự thật nằm ngoài JVM — sequence của PostgreSQL (`nextval('ma_giao_dich_seq')`), hoặc mã không cần phối hợp (UUID v7, hoặc tiền tố theo instance + bộ đếm). Trong Spring: một bean `BoSinhMa` (singleton scope của container) gọi repository lấy `nextval`, tiêm qua constructor — không còn `getInstance()`. Thêm ràng buộc `UNIQUE` trên cột mã để lỗi, nếu còn, lộ ra ngay thay vì âm thầm.
:::
