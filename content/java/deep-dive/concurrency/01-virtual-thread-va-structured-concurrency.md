---
title: "Virtual thread, pinning, structured concurrency và ScopedValue — so sánh JDK 21 với JDK 25"
summary: "Virtual thread hoạt động thế nào (mount/unmount trên carrier thread), đo 10.000 việc I/O với pool 200 thread và với virtual thread, tái hiện lỗi pinning của synchronized trên JDK 21 và thấy nó biến mất trên JDK 25, structured concurrency (preview) và ScopedValue (chính thức ở Java 25)."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [java, virtual-thread, structured-concurrency, scoped-value, loom, java-25]
related: [java/consolidate/concurrency/race-condition-deadlock-va-completablefuture, java/deep-dive/functional/ben-trong-stream-parallel-va-gatherers]
---

## Tóm tắt nhanh

- **Virtual thread** là thread do JVM quản lý, rất rẻ (tạo được hàng trăm nghìn). Khi chặn I/O, nó **unmount** khỏi *carrier thread* (thread hệ điều hành) để carrier chạy việc khác.
- Lợi ích là **thông lượng** cho việc chờ I/O, không phải tốc độ CPU. Việc nặng CPU không nhanh hơn.
- Trên **JDK 21–23**, chặn I/O bên trong `synchronized` làm virtual thread bị **pin** vào carrier. **JDK 24+** đã sửa (JEP 491). Đo được: 8 việc chạy 810 ms trên JDK 21, 107 ms trên JDK 25.
- **Structured concurrency** (`StructuredTaskScope`, **preview** ở Java 25): các việc con gắn với một khối code. Một việc lỗi → việc còn lại tự bị huỷ.
- **ScopedValue** (chính thức ở **Java 25**): truyền ngữ cảnh (mã request, người dùng) bất biến, thay cho `ThreadLocal`.

## Cơ chế: mount và unmount

```text
carrier thread (ForkJoinPool, số lượng ≈ số CPU)
   ├─ mount VT#1 → chạy → gọi socket.read() → unmount (stack VT#1 lưu vào heap)
   ├─ mount VT#2 → chạy → Thread.sleep → unmount
   └─ mount VT#1 (dữ liệu đã về) → chạy tiếp
```

Platform thread = một thread hệ điều hành, mỗi thread giữ stack riêng (thường cỡ 1 MB, cấp phát dần). Virtual thread lưu stack trên heap và chỉ chiếm carrier khi thực sự chạy.

Đo trên JDK 25, máy 4 CPU (mỗi việc `Thread.sleep(100 ms)` giả lập một lời gọi API):

```text
10.000 việc, pool 200 platform thread:  5083 ms    (10.000 / 200 × 100 ms ≈ 5 s)
10.000 việc, virtual thread:              188 ms
100.000 virtual thread:                   789 ms
```

Đó là lý do Spring Boot (`spring.threads.virtual.enabled=true`), Tomcat, Jetty, Helidon đều đã hỗ trợ virtual thread: mỗi request một virtual thread, viết code chặn quen thuộc mà vẫn chịu được rất nhiều kết nối đồng thời.

## Pinning: JDK 21 và JDK 25

Thử với scheduler chỉ có **một** carrier (`-Djdk.virtualThreadScheduler.parallelism=1 -Djdk.virtualThreadScheduler.maxPoolSize=1`) để thấy rõ:

```java
static void goiApi() { Thread.sleep(Duration.ofMillis(100)); }   // bỏ qua try/catch cho gọn
static void goiApiTrongSynchronized() { synchronized (new Object()) { goiApi(); } }
// chạy 8 việc trên newVirtualThreadPerTaskExecutor()
```

```text
JDK 21: 8 việc synchronized + sleep, 1 carrier: 810 ms   ← chạy lần lượt
JDK 21: 8 việc không synchronized,   1 carrier: 100 ms
JDK 25: 8 việc synchronized + sleep, 1 carrier: 107 ms
JDK 25: 8 việc không synchronized,   1 carrier: 100 ms
```

Trên JDK 21, `-Djdk.tracePinnedThreads=short` in ra:

```text
VirtualThread[#22]/runnable@ForkJoinPool-1-worker-1 reason:MONITOR
    Vt.goiApiTrongSynchronized(Vt.java:8) <== monitors:1
```

Trên JDK 21, ứng dụng dùng thư viện có `synchronized` quanh I/O (driver JDBC cũ, một số HTTP client, code cũ của bạn) có thể **chậm hơn** khi bật virtual thread, vì số carrier ít. Cách xử lý trên 21: đổi `synchronized` thành `ReentrantLock` ở chỗ có I/O, hoặc nâng lên JDK 24+. Một số trường hợp vẫn pin trên JDK 25 (vd gọi native qua JNI giữ stack). Theo dõi bằng sự kiện JFR `jdk.VirtualThreadPinned`.

## Những điều không nên làm với virtual thread

- **Không gộp vào pool.** Virtual thread rẻ, tạo mới cho từng việc. `newFixedThreadPool(100)` gồm virtual thread chỉ làm mất lợi ích.
- **Giới hạn tài nguyên bằng `Semaphore`**, không bằng kích thước pool: 10.000 virtual thread vẫn chỉ nên mở tối đa N kết nối tới DB (pool kết nối đã làm việc này) hay N request tới đối tác.
- **Cẩn thận với `ThreadLocal` lớn**: mỗi virtual thread có bản sao riêng. Cache object nặng (vd `SimpleDateFormat`) trong `ThreadLocal` với 100.000 thread là 100.000 bản.
- Việc nặng CPU (mã hoá, nén, tính toán) vẫn dùng pool platform thread cỡ số CPU.

## Structured concurrency (preview ở Java 25)

`CompletableFuture` không "biết" các việc thuộc về nhau: một việc lỗi, việc kia vẫn chạy tiếp và bị bỏ rơi. `StructuredTaskScope` gắn các việc con vào một khối `try`:

```java
record HoSo(String cic, String saoKe) {}

static HoSo taiHoSo() throws InterruptedException {
    try (var scope = StructuredTaskScope.open()) {        // mặc định: một việc lỗi → huỷ phần còn lại
        Subtask<String> cic   = scope.fork(() -> goiCic());      // 200 ms
        Subtask<String> saoKe = scope.fork(() -> goiSaoKe());    // 1000 ms
        scope.join();                                    // đợi cả hai, hoặc ném nếu có việc lỗi
        return new HoSo(cic.get(), saoKe.get());
    }                                                    // ra khỏi khối: không còn việc con nào chạy
}
```

Đã chạy trên JDK 25 với `--enable-preview --source 25`:

```text
bình thường:        HoSo[cic=CIC[REQ-42], saoKe=sao kê[REQ-42]]  1010 ms
CIC lỗi sau 200 ms:   huỷ: sao kê
                    FailedException: CIC lỗi  sau 203 ms     ← không đợi sao kê 1 giây
```

Không có cờ preview: *StructuredTaskScope is a preview API and is disabled by default*. API này đã đổi qua nhiều bản preview (Java 21 dùng `new StructuredTaskScope.ShutdownOnFailure()`, Java 25 dùng `StructuredTaskScope.open()`), nên **không dùng trong production** cho tới khi chính thức. Hiện tại dùng `CompletableFuture` với timeout, hoặc `ExecutorService` trong try-with-resources.

## ScopedValue (chính thức ở Java 25)

```java
static final ScopedValue<String> MA_YEU_CAU = ScopedValue.newInstance();

ScopedValue.where(MA_YEU_CAU, "REQ-42").run(() -> {
    xuLyYeuCau();               // ở bất kỳ đâu bên trong: MA_YEU_CAU.get() → "REQ-42"
});
MA_YEU_CAU.isBound();           // false — ra khỏi run() là hết
```

Trong ví dụ structured concurrency ở trên, việc con fork từ scope **thấy** giá trị `REQ-42` của thread cha (kết quả `CIC[REQ-42]`).

| | `ThreadLocal` | `ScopedValue` |
|---|---|---|
| Thay đổi giá trị | `set` bất cứ lúc nào | Bất biến trong phạm vi `run` |
| Thời gian sống | Tới khi `remove()` — quên là rò rỉ (nhất là với pool) | Tự kết thúc khi ra khỏi `run` |
| Truyền cho thread con | Phải dùng `InheritableThreadLocal` (sao chép) | Tự có với structured concurrency |
| Chi phí với rất nhiều virtual thread | Mỗi thread một bản | Chia sẻ, rẻ |

Đã kiểm tra `--release 24`: *ScopedValue is a preview API*; `--release 25`: biên dịch bình thường.

## So sánh phương án

| Việc | Java 17 | Java 21 | Java 25 |
|---|---|---|---|
| Nhiều request chờ I/O | Pool lớn hoặc reactive (WebFlux) | Virtual thread (cẩn thận pinning) | Virtual thread |
| Gọi song song vài dịch vụ | `CompletableFuture` + executor | `CompletableFuture` + virtual thread | Như 21; structured concurrency còn preview |
| Truyền ngữ cảnh request | `ThreadLocal` (MDC) | `ThreadLocal` | `ScopedValue` |
| Việc nặng CPU | `newFixedThreadPool(nCPU)` | Như 17 | Như 17 |

:::senior Góc nhìn senior
Virtual thread làm lựa chọn reactive (WebFlux, RxJava) bớt cần thiết cho phần lớn ứng dụng enterprise: code chặn dễ đọc, dễ debug, stack trace có ý nghĩa. Nhưng nó dịch điểm nghẽn sang chỗ khác — DB pool, rate limit của đối tác, bộ nhớ. Trước khi bật cho cả hệ thống: nâng lên JDK 24+ (hoặc rà `synchronized` quanh I/O trên 21), đặt giới hạn đồng thời ở mỗi tài nguyên phía sau, và load test với JFR bật `jdk.VirtualThreadPinned`.
:::

:::quiz 10.000 việc, mỗi việc chờ I/O 100 ms. Pool 200 platform thread mất khoảng bao lâu?
- [ ] 100 ms
- [ ] 1 giây
- [x] 5 giây
- [ ] 50 giây

Mỗi lượt 200 việc mất 100 ms, cần 50 lượt. Đo được 5083 ms; virtual thread: 188 ms.
:::

:::quiz Vì sao bật virtual thread trên JDK 21 có thể làm ứng dụng chậm đi?
- [ ] Virtual thread chạy code chậm hơn platform thread
- [x] Chặn I/O trong `synchronized` làm virtual thread bị pin vào carrier, mà số carrier chỉ cỡ số CPU
- [ ] Virtual thread không hỗ trợ JDBC
- [ ] GC phải quét nhiều stack hơn

Đã tái hiện: 8 việc trong `synchronized` chạy tuần tự (810 ms) trên JDK 21, chạy đồng thời (107 ms) trên JDK 25 nhờ JEP 491.
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

Đã chạy thử với `traCuu` giả lập 20 ms và một bộ đếm số lời gọi đang chạy: tối đa đồng thời **20**, tổng 5.101 ms (5.000 × 20 ms / 20).

`Semaphore` giới hạn **tài nguyên**, còn số thread thì không cần giới hạn. Trên Java 24+, cách gọn hơn là Stream với `Gatherers.mapConcurrent(20, this::traCuu)` (bài *Bên trong Stream*), vốn chạy trên virtual thread và giữ thứ tự kết quả. Nhớ đặt timeout cho HTTP client của `traCuu`.
:::
