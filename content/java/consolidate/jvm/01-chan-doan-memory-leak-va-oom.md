---
title: "Chẩn đoán memory leak và OutOfMemoryError — từ histogram tới heap dump"
summary: "Tái hiện một memory leak kinh điển (map phiên đăng nhập không bao giờ xoá), chẩn đoán bằng jcmd GC.class_histogram khi ứng dụng đang chạy và heap dump tự động khi OOM, đọc kết quả, rồi sửa bằng cache có giới hạn và đo lại thấy heap ổn định. Chạy trên JDK 21."
level: intermediate
version: 21
lastReviewed: 2026-11-18
tags: [java, jvm, memory-leak, heap-dump, troubleshooting]
related: [java/review/jvm/bo-nho-jvm-va-cong-cu, java/deep-dive/jvm/gc-jit-va-do-hieu-nang]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS; chạy lại toàn bộ bài (histogram, heap dump, bản sửa) trên JDK 21; ScopedValue chuyển thành ghi chú khi nâng lên Java 25."
---

## Tóm tắt nhanh

- Java có GC nhưng vẫn **rò rỉ bộ nhớ**: object còn được tham chiếu (từ `static`, cache, listener, `ThreadLocal`) thì GC không dọn được.
- Dấu hiệu: heap sau mỗi lần GC **tăng dần** qua nhiều giờ, GC chạy ngày càng dày, cuối cùng `OutOfMemoryError`.
- Quy trình: **histogram** (`jcmd <pid> GC.class_histogram`) để biết loại object nào đang nhiều → **heap dump** để biết **ai đang giữ** chúng → sửa → đo lại.
- Production luôn bật `-XX:+HeapDumpOnOutOfMemoryError` kèm đường dẫn có đủ dung lượng.
- Mọi cache phải có **giới hạn** (kích thước, thời gian sống), hoặc dùng thư viện cache (Caffeine).

## Cơ chế: GC dọn được gì

GC bắt đầu từ các **GC root** (biến local của các thread đang chạy, field `static`, tham chiếu JNI…) và đánh dấu mọi object **đi tới được**. Object không đi tới được mới bị thu hồi. Một `static Map` sống suốt đời ứng dụng nên mọi thứ trong nó cũng sống mãi.

Nguồn rò rỉ hay gặp:

| Nguồn | Ví dụ |
|---|---|
| Collection `static` không giới hạn | `static Map<String, Session>` không bao giờ `remove` |
| Cache tự viết | `HashMap` làm cache kết quả theo tham số người dùng |
| Listener/callback | đăng ký vào event bus nhưng không huỷ đăng ký |
| `ThreadLocal` trên thread pool | `set()` nhưng không `remove()` — thread sống mãi nên giá trị cũng vậy |
| Key `equals`/`hashCode` sai | mỗi lần `put` tạo một entry mới thay vì ghi đè |
| Chuỗi `intern()` hoặc class sinh động | metaspace tăng mãi |

## Tái hiện

```java bad title="Leak.java"
public class Leak {
    record PhienDangNhap(String token, String nguoiDung, byte[] duLieu) {}
    static final Map<String, PhienDangNhap> PHIEN = new HashMap<>();   // không bao giờ xoá

    static void dangNhap(int i) {
        String token = UUID.randomUUID().toString();
        PHIEN.put(token, new PhienDangNhap(token, "user" + i, new byte[2048]));
    }
    // main: gọi dangNhap liên tục
}
```

```bash
java -Xmx128m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=dumps \
     -XX:+ExitOnOutOfMemoryError -cp out vn.hoc.Leak
```

## Bước 1: histogram khi ứng dụng đang chạy

Sau 1,5 giây (đã chạy trên JDK 21):

```text
$ jcmd 1456 GC.class_histogram
 num     #instances         #bytes  class name (module)
-------------------------------------------------------
   1:        111669       73508896  [B (java.base@21.0.12.1)
   2:         77585        1862040  java.lang.String (java.base@21.0.12.1)
   3:         35173        1125536  java.util.HashMap$Node (java.base@21.0.12.1)
   4:         34001         816024  vn.hoc.Leak$PhienDangNhap
   5:          4397         671640  [Ljdk.internal.vm.FillerElement; (java.base@21.0.12.1)
   6:           309         290608  [Ljava.util.HashMap$Node; (java.base@21.0.12.1)
```

Cách đọc:

- `[B` là `byte[]` — luôn đứng đầu ở mọi ứng dụng (vì `String` cũng chứa `byte[]`), tự nó chưa nói lên gì.
- Tìm **class của chính bạn** trong top: `Leak$PhienDangNhap` có 34.001 instance và số `HashMap$Node` (35.173) gần bằng — dấu hiệu chúng nằm trong một `HashMap`.
- Chạy histogram **hai lần cách nhau vài phút**. Class nào tăng đều mà không giảm là nghi phạm.

`GC.class_histogram` kích hoạt một full GC (chỉ đếm object còn sống), nên trên production hãy chạy lúc tải thấp.

## Bước 2: heap dump khi OOM

```text
java.lang.OutOfMemoryError: Java heap space
Dumping heap to dumps/java_pid1456.hprof ...
Heap dump file created [141261710 bytes in 0.082 secs]
Terminating due to java.lang.OutOfMemoryError: Java heap space
```

File `.hprof` (~140 MB với heap 128 MB) mở bằng **Eclipse MAT** hoặc **VisualVM**. Trong MAT, *Leak Suspects* và *Dominator Tree* sẽ chỉ ra `Leak.PHIEN` (một `HashMap`) giữ gần toàn bộ heap; *Path to GC Roots* cho thấy nó được giữ bởi field `static` của class `Leak`.

Lưu ý: heap dump chứa **mọi dữ liệu trong bộ nhớ** — token, thông tin khách hàng, mật khẩu đang xử lý. Ở ngân hàng/bảo hiểm, file này phải được xử lý như dữ liệu nhạy cảm (mã hoá, giới hạn người truy cập, xoá sau khi phân tích).

## Bước 3: sửa và đo lại

```java good title="Fix.java"
static final int TOI_DA = 10_000;
static final Map<String, PhienDangNhap> PHIEN = Collections.synchronizedMap(
    new LinkedHashMap<>(16, 0.75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, PhienDangNhap> e) {
            return size() > TOI_DA;
        }
    });
```

Cùng `-Xmx128m`, 300.000 lần đăng nhập:

```text
100000 lần đăng nhập: 10000 phiên, heap dùng 23 MB
200000 lần đăng nhập: 10000 phiên, heap dùng 23 MB
300000 lần đăng nhập: 10000 phiên, heap dùng 23 MB
```

Trong ứng dụng thật, phiên đăng nhập cần **hết hạn theo thời gian** và xoá khi đăng xuất — dùng Caffeine (`expireAfterAccess`, `maximumSize`) hoặc lưu ngoài JVM (Redis) nếu chạy nhiều instance.

## Pitfalls

- Tăng `-Xmx` để "sửa" leak: chỉ làm OOM đến muộn hơn, và mỗi lần full GC lâu hơn.
- Không có heap dump vì quên cờ, hoặc thư mục dump không đủ chỗ / không ghi được trong container (mount một volume).
- Bắt `OutOfMemoryError` để chạy tiếp: trạng thái ứng dụng đã không đáng tin. Thoát (`ExitOnOutOfMemoryError`) để được khởi động lại sạch sẽ.
- Nhầm OOM heap với `OOMKilled` của container (bài *Bộ nhớ JVM*), hay với `Metaspace` (nạp class liên tục, thường do classloader của plugin/hot reload).
- `ThreadLocal` không `remove()` trong `finally` trên thread pool của web server.

:::senior Góc nhìn senior
Leak hiếm khi lộ trong test vì test chạy ngắn. Hãy có **quan sát** sẵn trước khi cần: metric heap sau GC (`jvm.memory.used` sau GC qua Micrometer/Prometheus), số lần GC, cảnh báo khi đường "heap sau GC" có xu hướng tăng qua 24 giờ. Khi xảy ra sự cố, quy trình chuẩn là: lấy histogram (nhanh, nhỏ), lấy heap dump (nặng, nhạy cảm), khởi động lại để khôi phục dịch vụ, rồi mới phân tích offline.
:::

:::version Java 17 / 21 / 25
`jcmd` có từ Java 7, các lệnh `GC.class_histogram`, `GC.heap_dump`, `Thread.print`, `JFR.start` dùng được trên Java 8+ (JFR miễn phí từ 11). `jmap -histo` và `jmap -dump` vẫn chạy nhưng `jcmd` là công cụ được khuyến nghị.
:::

:::interview Java có garbage collector, vậy làm sao vẫn có memory leak?
GC chỉ thu hồi object **không còn tham chiếu** từ các GC root. Nếu code vẫn giữ tham chiếu tới object không còn dùng nữa — trong một collection `static`, cache không giới hạn, listener chưa huỷ đăng ký, `ThreadLocal` trên thread pool — thì GC coi chúng là đang dùng. Heap tăng dần tới khi `OutOfMemoryError`. Điều tra bằng histogram (loại object nào tăng) và heap dump (đường tham chiếu tới GC root, xem trong Eclipse MAT).
:::

:::quiz Histogram cho thấy `[B` đứng đầu với 73 MB. Kết luận đúng là gì?
- [ ] Leak chắc chắn nằm ở mảng byte
- [x] Chưa kết luận được — `byte[]` luôn nhiều vì `String` dùng nó; cần tìm class của ứng dụng trong top và so sánh hai lần chụp
- [ ] Cần tăng `-Xmx`
- [ ] Do compact strings

Trong ví dụ, manh mối là `Leak$PhienDangNhap` (34.001 instance) đi cùng số `HashMap$Node` tương đương.
:::

:::quiz Cờ nào giúp có dữ liệu để phân tích sau khi ứng dụng production gặp OOM? (chọn nhiều)
- [x] `-XX:+HeapDumpOnOutOfMemoryError`
- [x] `-XX:HeapDumpPath=/dumps` (một volume đủ chỗ)
- [ ] `-Xmx` thật lớn
- [x] `-Xlog:gc*:file=/logs/gc.log` để xem xu hướng heap trước sự cố

Heap dump cho biết ai giữ bộ nhớ lúc OOM; log GC cho biết heap tăng dần thế nào trước đó.
:::

:::exercise Tìm leak trong ThreadLocal
Một filter của web server làm `NGUOI_DUNG.set(layNguoiDung(request))` ở đầu request với `static final ThreadLocal<NguoiDung> NGUOI_DUNG`, và các service đọc `NGUOI_DUNG.get()`. Sau vài ngày, heap tăng và có lúc service đọc ra **người dùng của request khác**. Giải thích hai lỗi và sửa.
???
Web server dùng **thread pool**: thread không chết sau mỗi request. Không gọi `remove()` thì (1) giá trị cũ vẫn nằm trong thread — rò rỉ, nhất là khi object `NguoiDung` lớn hoặc giữ tham chiếu tới nhiều thứ khác; (2) request sau chạy trên cùng thread mà rẽ vào nhánh không gọi `set` (vd endpoint public) sẽ đọc ra người dùng của request trước — lỗi **bảo mật**.

```java
try {
    NGUOI_DUNG.set(layNguoiDung(request));
    chain.doFilter(request, response);
} finally {
    NGUOI_DUNG.remove();       // luôn dọn, kể cả khi có exception
}
```

Đó là cách đúng trên Java 21. **Khi nâng lên Java 25** có thể thay bằng `ScopedValue` (bài *Virtual thread và structured concurrency*; trên Java 21 API này còn là preview):

```java
ScopedValue.where(NGUOI_DUNG, layNguoiDung(request))
           .call(() -> { chain.doFilter(request, response); return null; });
```

Dùng `call` chứ không phải `run`: `doFilter` ném checked exception, mà `run` nhận `Runnable` nên báo *unreported exception IOException* (đã thử). Giá trị tự hết hiệu lực khi ra khỏi `call` (`isBound()` trả `false`), không thể quên dọn. Spring Security đã tự xử lý việc này cho `SecurityContextHolder`.
:::
