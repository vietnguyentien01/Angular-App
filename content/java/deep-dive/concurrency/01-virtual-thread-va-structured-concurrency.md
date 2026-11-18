---
title: "Virtual thread trên Java 21 — pinning và cách xử lý, gọi song song có huỷ, truyền ngữ cảnh; những gì JDK 24–25 thay đổi"
summary: "Virtual thread mount/unmount thế nào, đo 10.000 việc I/O với pool 200 thread và với virtual thread, tái hiện pinning của synchronized trên JDK 21 và sửa bằng ReentrantLock, gọi song song có huỷ khi lỗi, ThreadLocal đúng cách; structured concurrency và ScopedValue khi nâng cấp."
level: advanced
version: 21
lastReviewed: 2026-11-18
tags: [java, virtual-thread, structured-concurrency, scoped-value, loom, java-21]
related: [java/consolidate/concurrency/race-condition-deadlock-va-completablefuture, java/deep-dive/functional/ben-trong-stream-parallel-va-gatherers]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS — đo lại toàn bộ trên JDK 21, thêm cách sửa pinning bằng ReentrantLock và gọi song song có huỷ bằng Future; structured concurrency và ScopedValue chuyển thành phần preview/nâng cấp."
---

## Tóm tắt nhanh

- **Virtual thread** (chính thức từ **Java 21**) là thread do JVM quản lý, rất rẻ (tạo được hàng trăm nghìn). Khi chặn I/O, nó **unmount** khỏi *carrier thread* (thread hệ điều hành) để carrier chạy việc khác.
- Lợi ích là **thông lượng** cho việc chờ I/O, không phải tốc độ CPU. Việc nặng CPU không nhanh hơn.
- Trên **JDK 21**, chặn I/O bên trong `synchronized` làm virtual thread bị **pin** vào carrier. Đo được: 8 việc mất 803 ms với `synchronized`, 101 ms khi đổi sang `ReentrantLock`. JDK 24+ đã sửa lỗi này (JEP 491).
- Gọi song song vài dịch vụ trên Java 21: `Future` trên virtual thread, lỗi thì `cancel(true)` các việc còn lại. `StructuredTaskScope` làm việc này gọn hơn nhưng vẫn là **preview** (cả ở Java 21 lẫn 25).
- Truyền ngữ cảnh request trên Java 21: `ThreadLocal` + `remove()` trong `finally`. `ScopedValue` chỉ chính thức từ **Java 25**.

## Cơ chế: mount và unmount

```text
carrier thread (ForkJoinPool, số lượng ≈ số CPU)
   ├─ mount VT#1 → chạy → gọi socket.read() → unmount (stack VT#1 lưu vào heap)
   ├─ mount VT#2 → chạy → Thread.sleep → unmount
   └─ mount VT#1 (dữ liệu đã về) → chạy tiếp
```

Platform thread = một thread hệ điều hành, mỗi thread giữ stack riêng (thường cỡ 1 MB, cấp phát dần). Virtual thread lưu stack trên heap và chỉ chiếm carrier khi thực sự chạy.

Đo trên JDK 21, máy 4 CPU (mỗi việc `Thread.sleep(100 ms)` giả lập một lời gọi API):

```text
10.000 việc, pool 200 platform thread:  5045 ms    (10.000 / 200 × 100 ms ≈ 5 s)
10.000 việc, virtual thread:              272 ms
100.000 virtual thread:                   555 ms
```

Đó là lý do Spring Boot (`spring.threads.virtual.enabled=true`, từ 3.2 trên Java 21), Tomcat, Jetty, Helidon đều đã hỗ trợ virtual thread: mỗi request một virtual thread, viết code chặn quen thuộc mà vẫn chịu được rất nhiều kết nối đồng thời.

## Pinning trên JDK 21 và cách sửa

Thử với scheduler chỉ có **một** carrier (`-Djdk.virtualThreadScheduler.parallelism=1 -Djdk.virtualThreadScheduler.maxPoolSize=1`) để thấy rõ:

```java
static void goiApi() { Thread.sleep(Duration.ofMillis(100)); }   // bỏ qua try/catch cho gọn
static void goiApiTrongSynchronized() { synchronized (new Object()) { goiApi(); } }
static void goiApiTrongLock() {
    var lock = new ReentrantLock();
    lock.lock();
    try { goiApi(); } finally { lock.unlock(); }
}
// chạy 8 việc trên newVirtualThreadPerTaskExecutor()
```

```text
JDK 21: 8 việc synchronized + sleep,   1 carrier: 803 ms   ← chạy lần lượt
JDK 21: 8 việc ReentrantLock + sleep,  1 carrier: 101 ms   ← unmount được khi chờ
JDK 21: 8 việc không khoá,             1 carrier: 100 ms
```

`-Djdk.tracePinnedThreads=short` (có trên JDK 21) in ra chỗ bị pin:

```text
VirtualThread[#29]/runnable@ForkJoinPool-1-worker-1 reason:MONITOR
    Vt.goiApiTrongSynchronized(Vt.java:4) <== monitors:1
```

Ứng dụng Java 21 dùng thư viện có `synchronized` quanh I/O (driver JDBC cũ, một số HTTP client, code cũ của bạn) có thể **chậm hơn** khi bật virtual thread, vì số carrier ít. Cách xử lý:

1. Bật `-Djdk.tracePinnedThreads=short` hoặc sự kiện JFR `jdk.VirtualThreadPinned` khi load test để tìm chỗ bị pin.
2. Code của mình: đổi `synchronized` thành `ReentrantLock` ở chỗ có I/O bên trong. `synchronized` chỉ quanh thao tác trên bộ nhớ (vài micro giây) thì không cần đổi.
3. Thư viện: nâng lên bản đã bỏ `synchronized` quanh I/O. Ví dụ driver PostgreSQL (pgjdbc) đổi sang `ReentrantLock` từ bản **42.6.0** (PR #2635, "replace the usages of synchronized with ReentrantLock"). Với thư viện khác, đọc release note của bản bạn dùng.

Pinning cũng xảy ra khi virtual thread chặn trong code native (JNI) — trường hợp này JDK mới hơn vẫn pin.

## Những điều không nên làm với virtual thread

- **Không gộp vào pool.** Virtual thread rẻ, tạo mới cho từng việc. `newFixedThreadPool(100)` gồm virtual thread chỉ làm mất lợi ích.
- **Giới hạn tài nguyên bằng `Semaphore`**, không bằng kích thước pool: 10.000 virtual thread vẫn chỉ nên mở tối đa N kết nối tới DB (pool kết nối đã làm việc này) hay N request tới đối tác.
- **Cẩn thận với `ThreadLocal` lớn**: mỗi virtual thread có bản sao riêng. Cache object nặng (vd `SimpleDateFormat`) trong `ThreadLocal` với 100.000 thread là 100.000 bản.
- Việc nặng CPU (mã hoá, nén, tính toán) vẫn dùng pool platform thread cỡ số CPU.

## Gọi song song có huỷ khi lỗi (Java 21)

Tải hồ sơ vay cần gọi hai dịch vụ cùng lúc: CIC (200 ms) và sao kê (1 giây). Nếu CIC lỗi thì không cần đợi sao kê nữa:

```java
record HoSo(String cic, String saoKe) {}

static HoSo taiHoSo() throws Exception {
    try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
        Future<String> cic   = ex.submit(() -> goiCic());      // 200 ms
        Future<String> saoKe = ex.submit(() -> goiSaoKe());    // 1000 ms
        try {
            return new HoSo(cic.get(), saoKe.get());
        } catch (ExecutionException e) {
            cic.cancel(true);                   // cancel(true) = interrupt việc đang chạy
            saoKe.cancel(true);
            throw e;
        }
    }                                           // close() đợi mọi việc kết thúc
}
```

Đã chạy trên JDK 21:

```text
bình thường:          HoSo[cic=CIC, saoKe=sao kê]  1019 ms
CIC lỗi sau 200 ms:     huỷ: sao kê
                      IllegalStateException: CIC lỗi  sau 201 ms     ← không đợi sao kê 1 giây
```

Giới hạn của cách này: code đợi theo **thứ tự** `cic.get()` rồi `saoKe.get()`. Nếu sao kê lỗi trước, vẫn phải đợi CIC xong mới biết. Muốn "ai lỗi trước cũng huỷ ngay" thì dùng `ExecutorCompletionService` (lấy việc xong trước) hoặc `CompletableFuture` có executor là virtual thread. Đây chính là bài toán *structured concurrency* sinh ra để giải.

:::version 21 Structured concurrency trên Java 21 (preview)
JDK 21 có `StructuredTaskScope` ở dạng **preview** (JEP 453). Đã chạy với `javac --enable-preview --release 21` và `java --enable-preview`:

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<String> cic   = scope.fork(() -> goiCic());
    Subtask<String> saoKe = scope.fork(() -> goiSaoKe());
    scope.join().throwIfFailed();          // việc nào lỗi trước cũng huỷ phần còn lại
    return new HoSo(cic.get(), saoKe.get());
}
// CIC lỗi: "huỷ: sao kê", ExecutionException: CIC lỗi sau 202 ms
```

Không có cờ: *StructuredTaskScope is a preview API and is disabled by default*. API đã **đổi** ở các bản sau (Java 25 dùng `StructuredTaskScope.open()` thay cho `ShutdownOnFailure`), nên **không dùng preview trong production** — code sẽ phải sửa khi nâng JDK.
:::

## Truyền ngữ cảnh request (Java 21)

Mã request, người dùng hiện tại, tenant… thường đi qua `ThreadLocal` (MDC của logback/log4j cũng là `ThreadLocal`):

```java
static final ThreadLocal<String> MA_YEU_CAU = new ThreadLocal<>();

MA_YEU_CAU.set("REQ-42");
try {
    xuLyYeuCau();               // ở bất kỳ đâu trên thread này: MA_YEU_CAU.get() → "REQ-42"
} finally {
    MA_YEU_CAU.remove();        // bắt buộc: thread của pool sống lâu, quên là rò rỉ / lộ dữ liệu
}
```

Hai điều cần nhớ khi dùng với virtual thread:

- Việc **submit sang virtual thread khác** không thấy giá trị: đã chạy thử `ex.submit(() -> MA_YEU_CAU.get())` trên JDK 21 → `null`. Muốn truyền thì đọc giá trị trước rồi đưa vào lambda, hoặc dùng `InheritableThreadLocal` (sao chép lúc tạo thread).
- Mỗi virtual thread một bản sao — giữ giá trị nhỏ (một chuỗi, một id), đừng cache object nặng.

:::version 25 Khi nâng lên Java 25: ScopedValue
`ScopedValue` (chính thức ở Java 25, JEP 506; preview ở Java 21–24) thay `ThreadLocal` cho ngữ cảnh bất biến:

```java
static final ScopedValue<String> MA_YEU_CAU = ScopedValue.newInstance();

ScopedValue.where(MA_YEU_CAU, "REQ-42").run(() -> xuLyYeuCau());
MA_YEU_CAU.isBound();           // false — ra khỏi run() là hết, không thể quên dọn
```

| | `ThreadLocal` | `ScopedValue` |
|---|---|---|
| Thay đổi giá trị | `set` bất cứ lúc nào | Bất biến trong phạm vi `run` |
| Thời gian sống | Tới khi `remove()` — quên là rò rỉ | Tự kết thúc khi ra khỏi `run` |
| Truyền cho thread con | `InheritableThreadLocal` (sao chép) | Tự có với structured concurrency |
| Chi phí với rất nhiều virtual thread | Mỗi thread một bản | Chia sẻ, rẻ |

Trên JDK 21 thử được với `--enable-preview` (đã chạy: việc con fork trong `StructuredTaskScope` đọc được `REQ-42` của thread cha), nhưng như mọi API preview, không dùng trong production.
:::

## So sánh phương án

| Việc | Java 17 | **Java 21** | Khi nâng lên Java 25 |
|---|---|---|---|
| Nhiều request chờ I/O | Pool lớn hoặc reactive (WebFlux) | Virtual thread (rà `synchronized` quanh I/O) | Virtual thread, không còn lo pinning do `synchronized` |
| Gọi song song vài dịch vụ | `CompletableFuture` + executor | `Future`/`CompletableFuture` trên virtual thread, tự huỷ khi lỗi | Như 21; structured concurrency vẫn preview |
| Truyền ngữ cảnh request | `ThreadLocal` (MDC) | `ThreadLocal` + `remove()` | `ScopedValue` |
| Việc nặng CPU | `newFixedThreadPool(nCPU)` | Như 17 | Như 17 |

:::senior Góc nhìn senior
Virtual thread làm lựa chọn reactive (WebFlux, RxJava) bớt cần thiết cho phần lớn ứng dụng enterprise: code chặn dễ đọc, dễ debug, stack trace có ý nghĩa. Nhưng nó dịch điểm nghẽn sang chỗ khác — DB pool, rate limit của đối tác, bộ nhớ. Trước khi bật cho cả hệ thống Java 21: load test với `jdk.VirtualThreadPinned` bật, sửa `synchronized` quanh I/O trong code của mình, nâng driver/thư viện lên bản không pin, và đặt giới hạn đồng thời ở mỗi tài nguyên phía sau. Nếu không kiểm soát được thư viện bên thứ ba, nâng lên JDK 24+ là cách triệt để.
:::

:::quiz 10.000 việc, mỗi việc chờ I/O 100 ms. Pool 200 platform thread mất khoảng bao lâu?
- [ ] 100 ms
- [ ] 1 giây
- [x] 5 giây
- [ ] 50 giây

Mỗi lượt 200 việc mất 100 ms, cần 50 lượt. Đo được trên JDK 21: 5045 ms; virtual thread: 272 ms.
:::

:::quiz Vì sao bật virtual thread trên JDK 21 có thể làm ứng dụng chậm đi?
- [ ] Virtual thread chạy code chậm hơn platform thread
- [x] Chặn I/O trong `synchronized` làm virtual thread bị pin vào carrier, mà số carrier chỉ cỡ số CPU
- [ ] Virtual thread không hỗ trợ JDBC
- [ ] GC phải quét nhiều stack hơn

Đã tái hiện trên JDK 21: 8 việc trong `synchronized` chạy tuần tự (803 ms); đổi sang `ReentrantLock` thì chạy đồng thời (101 ms). JDK 24+ sửa lỗi này (JEP 491).
:::

:::exercise Giới hạn số lời gọi tới đối tác
Bạn dùng `newVirtualThreadPerTaskExecutor()` để gọi API tra cứu của đối tác cho 5.000 hồ sơ. Đối tác chỉ cho phép tối đa 20 request cùng lúc. Viết đoạn code giới hạn số lời gọi đồng thời mà vẫn dùng virtual thread.
???
```java
var gioiHan = new Semaphore(20);
try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
    for (String ma : maHoSo) {
        ex.submit(() -> {
            gioiHan.acquire();                 // virtual thread chờ ở đây rất rẻ
            try {
                return traCuu(ma);
            } finally {
                gioiHan.release();
            }
        });
    }
}
```

Đã chạy thử trên JDK 21 với `traCuu` giả lập 20 ms và một bộ đếm số lời gọi đang chạy: tối đa đồng thời **20**, tổng 5.130 ms (5.000 × 20 ms / 20).

`Semaphore` giới hạn **tài nguyên**, còn số thread thì không cần giới hạn. Khi nâng lên Java 24+, cách gọn hơn là Stream với `Gatherers.mapConcurrent(20, this::traCuu)` (bài *Bên trong Stream*). Nhớ đặt timeout cho HTTP client của `traCuu`.
:::
