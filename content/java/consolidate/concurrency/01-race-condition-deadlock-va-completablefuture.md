---
title: "Race condition, deadlock, visibility và gọi song song có timeout"
summary: "Chạy thử: dem++ mất cập nhật chỉ thỉnh thoảng, check-then-act trên HashMap làm mất dữ liệu, deadlock phát hiện bằng ThreadMXBean, vòng lặp không bao giờ dừng vì thiếu volatile, JVM không thoát vì quên shutdown; rồi gọi ba dịch vụ song song với timeout và giá trị dự phòng."
level: intermediate
version: 25
lastReviewed: 2026-11-16
tags: [java, concurrency, race-condition, deadlock, completablefuture, pitfalls]
related: [java/review/concurrency/thread-executor-va-dong-bo, java/deep-dive/concurrency/virtual-thread-va-structured-concurrency]
---

## TL;DR

- Lỗi concurrency **không lặp lại được** mỗi lần chạy. Test xanh không chứng minh code đúng — phải lập luận dựa trên quy tắc.
- **Check-then-act** (`if (!map.containsKey(k)) map.put(…)`) không atomic. Dùng `computeIfAbsent`/`merge` của `ConcurrentHashMap`.
- **Deadlock**: hai thread giữ khoá theo thứ tự ngược nhau. Phòng bằng cách luôn lấy khoá theo **một thứ tự cố định**, hoặc dùng `tryLock` có timeout.
- **Visibility**: không có `volatile`/`synchronized`, thread khác có thể **không bao giờ** thấy giá trị mới.
- Gọi nhiều dịch vụ song song: `CompletableFuture` với executor riêng, `orTimeout`/`completeOnTimeout` cho từng lời gọi.

## Cơ chế: vì sao `dem++` sai

`dem++` là ba bước: đọc `dem` vào thanh ghi, cộng 1, ghi lại. Hai thread cùng đọc 10, cùng ghi 11 → mất một lần cộng.

Đã chạy 5 lần trên JDK 25 (4 thread × 1.000.000 lần):

```text
lần 0: 3970351
lần 1: 4000000
lần 2: 4000000
lần 3: 4000000
lần 4: 4000000
```

Bốn lần "đúng" một phần vì JIT có thể biến cả vòng lặp thành một phép cộng lớn, nên các thread ít khi chen vào nhau. Code thật (cập nhật số dư giữa các lời gọi DB, gửi tin…) không được tối ưu như vậy và lỗi lộ ra thường xuyên hơn — thường chỉ dưới tải thật trên production.

**Java Memory Model** quy định: chỉ khi có quan hệ *happens-before* (cùng khoá `synchronized`, ghi/đọc biến `volatile`, `Thread.start`/`join`, các collection và executor của `java.util.concurrent`…) thì thao tác ghi của thread này mới chắc chắn được thread kia nhìn thấy.

Mọi kết quả dưới đây đã chạy trên JDK 25.

## Check-then-act

```java bad
Map<String, List<String>> map = new HashMap<>();
// 8 thread cùng làm:
if (!map.containsKey("k")) map.put("k", new ArrayList<>());   // hai thread cùng thấy "chưa có"
synchronized (map) { map.get("k").add("t" + id); }
// 20 lần chạy: 1 lần list chỉ còn < 8 phần tử — list của thread khác bị put đè
```

```java good
var chm = new ConcurrentHashMap<String, List<String>>();
chm.computeIfAbsent("k", k -> new CopyOnWriteArrayList<>()).add("t" + id);
// 20 lần chạy: 0 lần mất phần tử
```

Cùng dạng lỗi: `if (soDu >= tien) soDu -= tien;` — hai lần rút tiền cùng lúc đều qua được điều kiện. Trong hệ thống thật, kiểm tra và trừ phải nằm trong **một** thao tác atomic: một khoá, hoặc tốt hơn là một câu lệnh SQL `UPDATE tai_khoan SET so_du = so_du - ? WHERE id = ? AND so_du >= ?` và kiểm tra số dòng bị ảnh hưởng.

## Deadlock

```java bad
Object a = new Object(), b = new Object();
Thread t1 = new Thread(() -> { synchronized (a) { ngu(100); synchronized (b) { } } });  // chuyển A → B
Thread t2 = new Thread(() -> { synchronized (b) { ngu(100); synchronized (a) { } } });  // chuyển B → A
```

Sau 500 ms:

```text
ManagementFactory.getThreadMXBean().findDeadlockedThreads() → 2 thread
t1.getState() = BLOCKED, t2.getState() = BLOCKED
```

```java good
// luôn khoá theo thứ tự cố định, vd theo số tài khoản nhỏ hơn trước
Object dau = soTkA.compareTo(soTkB) < 0 ? khoaA : khoaB;
Object sau = dau == khoaA ? khoaB : khoaA;
synchronized (dau) { synchronized (sau) { chuyenTien(); } }
```

Trên production: `jstack <pid>` (hoặc `jcmd <pid> Thread.print`) in thread dump, cuối dump có mục *Found one Java-level deadlock*.

## Visibility

```java bad
boolean dung = false;
// thread đọc:
while (!dung) n++;
// main: sleep 300 ms rồi dung = true
// sau 2 giây: thread đọc VẪN chạy
```

```java good
volatile boolean dung = false;
// thread đọc dừng gần như ngay lập tức
```

JIT được phép đọc `dung` một lần rồi giữ trong thanh ghi, vì theo JMM không có gì buộc nó phải đọc lại. Cờ dừng, cờ "đã cấu hình xong" dùng `volatile` hoặc `AtomicBoolean`.

## Quên shutdown

```java bad
var ex = Executors.newFixedThreadPool(1);
ex.submit(() -> IO.println("task chạy"));
IO.println("main xong");
// in hai dòng rồi treo: chạy với `timeout 5 java …` thì bị giết, exit code 124
```

```java good
try (var ex = Executors.newFixedThreadPool(1)) { ex.submit(…); }   // Java 19+
```

Trong ứng dụng Spring, executor nên là bean (`ThreadPoolTaskExecutor`) để Spring đóng khi tắt ứng dụng.

## Gọi ba dịch vụ song song

Xét duyệt khoản vay cần điểm CIC (300 ms), sao kê (400 ms) và thu nhập (dịch vụ chậm, 2 giây). Yêu cầu: chạy song song, thu nhập chờ tối đa 1 giây rồi dùng giá trị dự phòng.

```java good
record HoSoTinDung(int diemCic, String saoKe, String thuNhap) {}

try (ExecutorService io = Executors.newVirtualThreadPerTaskExecutor()) {
    var cic     = CompletableFuture.supplyAsync(() -> goiCic(), io);
    var saoKe   = CompletableFuture.supplyAsync(() -> goiSaoKe(), io);
    var thuNhap = CompletableFuture.supplyAsync(() -> goiThuNhap(), io)
        .completeOnTimeout("chưa có (quá 1s)", 1, TimeUnit.SECONDS);

    HoSoTinDung hs = cic.thenCombine(saoKe, (c, s) -> new Object[]{c, s})
        .thenCombine(thuNhap, (cs, t) -> new HoSoTinDung((Integer) cs[0], (String) cs[1], t))
        .join();
}
// HoSoTinDung[diemCic=720, saoKe=sao kê 6 tháng, thuNhap=chưa có (quá 1s)] trong 1017 ms
```

- `completeOnTimeout`: hết giờ thì dùng giá trị dự phòng. `orTimeout`: hết giờ thì **thất bại** với `TimeoutException` (đã chạy thử: lỗi sau 501 ms).
- Luôn truyền executor (tham số thứ hai). Không truyền thì `supplyAsync` dùng **ForkJoinPool common pool**, được chia sẻ với parallel stream của cả ứng dụng — lời gọi I/O chặn sẽ làm nghẽn chỗ khác.
- Hết timeout, task gốc **vẫn chạy tiếp** ở nền (`completeOnTimeout` không huỷ nó). Đặt timeout ở cả HTTP client.

## Pitfalls

- `HashMap`, `ArrayList`, `SimpleDateFormat` dùng chung giữa các thread mà không đồng bộ.
- `synchronized` trên object thay đổi được (`synchronized (this.list)` rồi gán `list = new …`) hoặc trên `String` literal/`Integer` (dùng chung toàn JVM).
- Bean Spring là singleton: field mutable trong `@Service` là state dùng chung giữa mọi request.
- `parallelStream()` gọi I/O.
- Gọi `future.get()` không timeout trong thread xử lý request — dịch vụ phía sau treo thì request treo theo.

:::senior Góc nhìn senior
Cách an toàn nhất là **không chia sẻ state mutable**: object bất biến (record), dữ liệu thuộc về một request, và để DB/transaction xử lý cập nhật đồng thời (khoá dòng, optimistic locking với cột `version`). Khi buộc phải chia sẻ, đóng gói nó sau một API nhỏ dùng `java.util.concurrent` — không rải `synchronized` khắp code. Mọi lời gọi ra ngoài đều phải có timeout, và nên có circuit breaker (vd Resilience4j) ở dịch vụ quan trọng.
:::

:::version Java 17 / 21 / 25
Mọi API trong bài có từ Java 8–9, trừ virtual thread và `try (ExecutorService …)` (Java 21 / 19). Trên Java 17, thay `newVirtualThreadPerTaskExecutor()` bằng một `newFixedThreadPool` có kích thước phù hợp và đóng nó trong `finally`.
:::

:::interview Làm sao phát hiện và phòng deadlock?
Phát hiện: thread dump (`jstack`, `jcmd Thread.print`, hoặc `ThreadMXBean.findDeadlockedThreads()` trong health check) cho biết thread nào giữ khoá nào và chờ khoá nào. Phòng: (1) lấy nhiều khoá theo một thứ tự toàn cục cố định; (2) giữ khoá trong thời gian ngắn nhất, không gọi I/O hay code bên ngoài khi đang giữ khoá; (3) dùng `ReentrantLock.tryLock(timeout)` để có thể bỏ cuộc; (4) giảm nhu cầu khoá bằng dữ liệu bất biến và collection concurrent. Với DB, deadlock giữa các transaction thì DB tự phát hiện và huỷ một bên — ứng dụng cần retry.
:::

:::quiz Thread A lặp `while (!dung) n++;` với `boolean dung` thường; thread main đặt `dung = true`. Điều gì có thể xảy ra?
- [ ] Thread A luôn dừng ngay
- [x] Thread A có thể chạy mãi không dừng
- [ ] Ném exception
- [ ] Lỗi biên dịch

Không có quan hệ happens-before, JIT được phép không đọc lại `dung`. Đã chạy thử: sau 2 giây thread vẫn chạy. Thêm `volatile` thì dừng ngay.
:::

:::quiz `supplyAsync(task)` không truyền executor chạy trên thread nào?
- [ ] Một thread mới cho mỗi task
- [x] ForkJoinPool common pool — dùng chung với parallel stream
- [ ] Thread đang gọi
- [ ] Một virtual thread

Common pool có số thread = số CPU − 1. Task chặn I/O trong đó làm nghẽn mọi thứ khác dùng pool này.
:::

:::exercise Bộ đếm lượt truy cập theo API
`Map<String, Integer> luot = new HashMap<>();` được cập nhật từ nhiều request: `luot.put(api, luot.getOrDefault(api, 0) + 1);`. Chỉ ra lỗi và sửa sao cho đúng khi có nhiều thread, không dùng `synchronized`.
???
Hai lỗi: (1) `HashMap` không thread-safe — ghi đồng thời có thể làm hỏng cấu trúc bên trong; (2) `getOrDefault` + `put` là check-then-act, mất lượt đếm.

```java
private final ConcurrentHashMap<String, LongAdder> luot = new ConcurrentHashMap<>();

void ghiNhan(String api) {
    luot.computeIfAbsent(api, k -> new LongAdder()).increment();
}
long soLuot(String api) {
    LongAdder a = luot.get(api);
    return a == null ? 0 : a.sum();
}
```

Đã chạy thử 10.000 lượt trên virtual thread cho 3 key: `{k0=3334, k1=3333, k2=3333}`. Cách khác: `luot.merge(api, 1, Integer::sum)` với `ConcurrentHashMap<String, Integer>` — cũng atomic, nhưng `LongAdder` ít tranh chấp hơn khi rất nhiều thread cùng tăng một key.
:::
