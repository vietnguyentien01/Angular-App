---
title: "Thread, ExecutorService và đồng bộ — nền tảng concurrency trong Java"
summary: "Nhắc nhanh thread và virtual thread, ExecutorService với try-with-resources, Future và timeout, synchronized, AtomicInteger/LongAdder, ConcurrentHashMap, CompletableFuture, và cách xử lý InterruptedException. Mọi output đã chạy trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-16
tags: [java, concurrency, thread, executor, completablefuture]
related: [java/consolidate/concurrency/race-condition-deadlock-va-completablefuture, java/deep-dive/concurrency/virtual-thread-va-structured-concurrency]
---

## Tóm tắt nhanh

- Không tự tạo `new Thread` cho từng việc trong code nghiệp vụ. Dùng **`ExecutorService`**; việc chờ I/O (HTTP, DB) dùng **virtual thread** (`Executors.newVirtualThreadPerTaskExecutor()`).
- Từ Java 19, `ExecutorService` là `AutoCloseable`: **`try (var ex = …) { … }`** đợi mọi task xong rồi đóng.
- Biến dùng chung giữa nhiều thread mà có ghi → phải đồng bộ: `synchronized`, `AtomicInteger`/`LongAdder`, hoặc collection concurrent.
- `Future.get` ném `ExecutionException` (bọc lỗi của task); `CompletableFuture.join` ném `CompletionException`.
- Bắt `InterruptedException` thì **khôi phục cờ**: `Thread.currentThread().interrupt()`.

## Ví dụ nhanh (đã chạy trên JDK 25)

```java title="Bộ đếm dùng chung"
int dem = 0;
// 4 thread, mỗi thread dem++ 100.000 lần, không đồng bộ
// 3 lần chạy thử: 400000, 400000, 390870 — đúng hai lần, sai một lần

synchronized void tang() { dem++; }                 // 400000
var atomic = new AtomicInteger(); atomic.incrementAndGet();   // 400000
var adder = new LongAdder(); adder.increment();     // 400000 — nhanh hơn khi nhiều thread cùng ghi
```

```java title="ExecutorService và Future"
try (var ex = Executors.newFixedThreadPool(2)) {
    Future<Integer> f = ex.submit(() -> { Thread.sleep(100); return 42; });
    f.get(1, TimeUnit.SECONDS);                     // 42

    Future<Integer> loi = ex.submit(() -> { throw new IllegalStateException("hỏng"); });
    loi.get();     // ExecutionException, getCause(): IllegalStateException: hỏng

    Future<?> cham = ex.submit(() -> Thread.sleep(5_000));
    cham.get(200, TimeUnit.MILLISECONDS);           // TimeoutException → cham.cancel(true) interrupt task
}   // close(): đợi các task, rồi shutdown
```

```java title="CompletableFuture"
var cf = CompletableFuture.supplyAsync(() -> "khách K1")
    .thenApply(String::toUpperCase)
    .thenCombine(CompletableFuture.supplyAsync(() -> 3), (k, n) -> k + " có " + n + " đơn");
cf.join();                     // "KHÁCH K1 có 3 đơn"

var cfLoi = CompletableFuture.supplyAsync(() -> { throw new IllegalArgumentException("API lỗi"); });
cfLoi.join();                  // CompletionException, getCause().getMessage(): "API lỗi"
cfLoi.exceptionally(e -> "mặc định").join();   // "mặc định" — e ở đây là CompletionException bọc lỗi gốc
```

```java title="Virtual thread và ConcurrentHashMap"
var chm = new ConcurrentHashMap<String, LongAdder>();
try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 10_000; i++) {
        String k = "k" + (i % 3);
        ex.submit(() -> chm.computeIfAbsent(k, x -> new LongAdder()).increment());
    }
}
// {k0=3334, k1=3333, k2=3333}

Thread vt = Thread.ofVirtual().name("ao-1").start(() -> …);
// Thread.currentThread() trong đó: VirtualThread[#10054,ao-1]/runnable@ForkJoinPool-1-worker-2
```

## Bảng chọn nhanh

| Cần | Dùng |
|---|---|
| Chạy nhiều việc chờ I/O cùng lúc | `Executors.newVirtualThreadPerTaskExecutor()` |
| Việc tốn CPU, giới hạn theo số lõi | `Executors.newFixedThreadPool(n)` |
| Bộ đếm dùng chung | `AtomicInteger`/`AtomicLong`; nhiều thread ghi liên tục → `LongAdder` |
| Map dùng chung | `ConcurrentHashMap` (`computeIfAbsent`, `merge` là atomic) |
| List dùng chung, đọc nhiều ghi ít | `CopyOnWriteArrayList` |
| Một đoạn code chỉ một thread được chạy | `synchronized` hoặc `ReentrantLock` |
| Ghép kết quả các việc bất đồng bộ | `CompletableFuture` (`thenCombine`, `allOf`) |
| Đặt timeout | `future.get(t, unit)`, `cf.orTimeout(...)`, `cf.completeOnTimeout(...)` |
| Chạy định kỳ | `ScheduledExecutorService` (trong Spring: `@Scheduled`) |

## Lỗi hay gặp: nuốt `InterruptedException`

```java bad
try { Thread.sleep(1000); } catch (InterruptedException e) { }
// cờ interrupt bị xoá → code phía trên không biết thread đã được yêu cầu dừng, shutdown bị treo
```

```java good
try { Thread.sleep(1000); }
catch (InterruptedException e) {
    Thread.currentThread().interrupt();   // khôi phục cờ
    return;                               // hoặc ném tiếp
}
```

`cancel(true)` và `shutdownNow()` chỉ **yêu cầu** dừng bằng cách interrupt. Task phải tôn trọng yêu cầu đó.

:::version Java 17 / 21 / 25
- `CompletableFuture`: Java 8; `orTimeout`, `completeOnTimeout`: Java 9.
- **Virtual thread** (JEP 444) và `ExecutorService` là `AutoCloseable`: **Java 21** (tính năng thứ hai có từ Java 19). Trên Java 17 phải gọi `shutdown()` + `awaitTermination()` trong `finally`.
- Java 24 sửa lỗi virtual thread bị "pin" khi gặp `synchronized` (JEP 491) — xem bài chuyên sâu.
:::

:::interview `synchronized`, `volatile` và `AtomicInteger` khác nhau thế nào?
`volatile` chỉ đảm bảo **khả năng nhìn thấy**: thread khác luôn đọc giá trị mới nhất, nhưng `x++` vẫn không atomic (đọc–sửa–ghi là ba bước). `synchronized` đảm bảo cả **loại trừ lẫn nhau** (một thread một lúc) lẫn nhìn thấy, áp dụng cho cả một khối code. `AtomicInteger` dùng lệnh CAS của CPU để thực hiện các thao tác như `incrementAndGet` một cách atomic mà không cần khoá — nhanh hơn `synchronized` cho một biến đơn lẻ. Nhiều biến phải cập nhật cùng nhau thì vẫn cần khoá.
:::

:::quiz 4 thread cùng chạy `dem++` 100.000 lần trên một `int` thường. Kết quả?
- [ ] Luôn 400000
- [ ] Luôn nhỏ hơn 400000
- [x] Có thể 400000, có thể nhỏ hơn — không xác định
- [ ] Ném `ConcurrentModificationException`

Đã chạy thử 3 lần: 400000, 400000, 390870. Chạy test vài lần thấy đúng **không** chứng minh code thread-safe.
:::

:::quiz `CompletableFuture.supplyAsync(() -> { throw new IllegalArgumentException("x"); }).join()` ném gì?
- [ ] `IllegalArgumentException`
- [x] `CompletionException`, cause là `IllegalArgumentException`
- [ ] `ExecutionException`
- [ ] Không ném, trả `null`

`get()` thì ném `ExecutionException`. Đã chạy thử.
:::

:::quiz Tạo `Executors.newFixedThreadPool(1)`, submit một task, không gọi `shutdown`/`close`. `main` kết thúc. Chuyện gì xảy ra?
- [ ] JVM thoát ngay
- [x] JVM không thoát — thread của pool không phải daemon và vẫn chờ việc
- [ ] JVM thoát sau khi task xong
- [ ] Lỗi biên dịch

Đã chạy thử với `timeout 5`: process bị giết sau 5 giây (exit 124). Dùng `try (var ex = …)` để không quên.
:::
