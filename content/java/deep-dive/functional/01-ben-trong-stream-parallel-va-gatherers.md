---
title: "Bên trong Stream — xử lý theo chiều dọc, thao tác có trạng thái, parallel stream, chia lô trên Java 21 và Gatherers"
summary: "Quan sát thứ tự Stream thực sự chạy, vì sao sorted phá short-circuit, parallel stream dùng ForkJoin common pool và làm hỏng ArrayList, forEach vs forEachOrdered; chia lô, tích luỹ và gọi I/O song song có giới hạn trên Java 21; rồi Stream Gatherers khi nâng lên Java 24+. Đo trên JDK 21."
level: advanced
version: 21
lastReviewed: 2026-11-18
tags: [java, stream, parallel, gatherers, internals, java-21]
related: [java/consolidate/functional/viet-bao-cao-bang-stream, java/deep-dive/concurrency/virtual-thread-va-structured-concurrency]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS: phần chính viết lại bằng cách làm trên Java 21 (chia lô, tích luỹ, I/O song song có giới hạn), Gatherers chuyển thành phần nâng cấp Java 24+; đo lại trên JDK 21."
---

## Tóm tắt nhanh

- Stream xử lý **theo chiều dọc**: mỗi phần tử đi qua toàn bộ pipeline rồi mới tới phần tử sau. Nhờ vậy `limit`, `findFirst`, `anyMatch` dừng sớm được.
- Thao tác **có trạng thái** (`sorted`, `distinct`) phải đợi đủ dữ liệu → phá short-circuit ở phía trước nó.
- `parallel()` chạy trên **ForkJoinPool common pool** (số thread = số CPU − 1). Side effect vào collection không thread-safe → mất dữ liệu hoặc exception.
- Java 21 chưa có bước trung gian tuỳ biến: chia lô, tích luỹ chạy dần, gọi I/O song song có giới hạn → viết hàm tiện ích nhỏ (`chiaLo`) hoặc dùng `ExecutorService` + `Semaphore`.
- **Gatherers** (Java 24+) gom các việc đó vào ngay pipeline (`gather(windowFixed(500))`) — biết để dùng khi dự án nâng cấp.

## Cơ chế: pipeline lazy

Khi gọi `filter`, `map`, Stream chỉ ghép các bước thành một chuỗi `Sink`. Bước kết thúc (`toList`, `findFirst`…) mới kéo dữ liệu từ nguồn và đẩy **từng phần tử** qua chuỗi đó.

```java
Stream.of(5, 3, 8, 1)
    .filter(n -> { log("f" + n); return n > 2; })
    .map(n -> { log("m" + n); return n * 10; })
    .limit(2)
    .toList();
// [50, 30]   log: f5 m5 f3 m3
```

`8` và `1` không bao giờ được xét — `limit(2)` báo nguồn dừng. Thêm `sorted()`:

```java
Stream.of(5, 3, 8, 1)
    .filter(...)          // f5 f3 f8 f1 — phải lọc hết
    .sorted()             // đợi nhận đủ rồi mới sắp
    .map(...)             // m3 — chỉ chạy cho phần tử đầu
    .findFirst();
// log: f5 f3 f8 f1 m3
```

Hệ quả thực tế: đặt `filter` trước `sorted`/`distinct` để giảm số phần tử phải giữ trong bộ nhớ. Với stream vô hạn (`Stream.iterate`, `Stream.generate`) mà có `sorted` thì không bao giờ kết thúc.

```java
Stream.iterate(1, n -> n * 2).limit(10).toList();     // [1, 2, 4, …, 512]
Stream.iterate(1, n -> n < 1000, n -> n * 3).toList(); // [1, 3, 9, 27, 81, 243, 729]
```

## Parallel stream

Đo trên máy 4 CPU, JDK 21:

```text
thread dùng: [ForkJoinPool.commonPool-worker-N, main]   parallelism=3   cpu=4
```

Thread gọi (`main`) cũng tham gia làm việc. Common pool **dùng chung cho cả JVM**: parallel stream ở một request chặn I/O sẽ làm chậm mọi parallel stream (và `CompletableFuture` không truyền executor) ở chỗ khác.

### Side effect làm hỏng dữ liệu

```java bad
var unsafe = new ArrayList<Integer>();
IntStream.range(0, 100_000).parallel().forEach(unsafe::add);
// 3 lần chạy thử: ArrayIndexOutOfBoundsException (list còn 42.937), rồi 92.844, rồi 13.204 phần tử — mong đợi 100.000
```

```java good
List<Integer> ok = IntStream.range(0, 100_000).parallel().boxed().toList();   // 100000
```

Collector tự xử lý song song đúng cách: mỗi luồng gom vào container riêng, rồi `combiner` gộp lại.

### Thứ tự

```java
IntStream.range(0, 10).parallel().mapToObj(String::valueOf).collect(joining(","));  // 0,1,2,…,9 — collect giữ thứ tự gặp
IntStream.range(0, 10).parallel().forEach(sb::append);          // 2431089765 — thứ tự bất kỳ (sb là StringBuffer)
IntStream.range(0, 10).parallel().forEachOrdered(sb::append);   // 0123456789
```

### Khi nào parallel có lợi

- Dữ liệu **lớn** (hàng trăm nghìn phần tử trở lên) và mỗi phần tử tốn **CPU** đáng kể.
- Nguồn **chia đôi dễ**: `ArrayList`, mảng, `IntStream.range`. `LinkedList`, `Stream.iterate`, I/O chia rất kém.
- Không có thao tác phụ thuộc thứ tự tốn kém (`limit`, `findFirst` trên stream có thứ tự).
- **Không** dùng cho việc chặn I/O (gọi HTTP, DB) — common pool bị chiếm hết. Dùng virtual thread với giới hạn đồng thời (mục dưới).

## Chia lô, tích luỹ và I/O song song trên Java 21

Stream của Java 21 không có bước trung gian "có trạng thái tuỳ biến". Ba việc hay gặp trong dự án enterprise được làm như sau (đã chạy trên JDK 21):

```java title="Chia lô — vd insert DB 500 bản ghi một lần"
static <T> List<List<T>> chiaLo(List<T> ds, int n) {
    return IntStream.range(0, (ds.size() + n - 1) / n)
        .mapToObj(i -> ds.subList(i * n, Math.min(ds.size(), (i + 1) * n)))
        .toList();
}
chiaLo(List.of(1, 2, 3, 4, 5, 6, 7), 3);   // [[1, 2, 3], [4, 5, 6], [7]]
```

`subList` là **view** của list gốc: không tốn bộ nhớ sao chép, nhưng đừng sửa list gốc khi còn dùng các lô (sẽ ném `ConcurrentModificationException`).

```java title="Tích luỹ chạy dần — số dư sau từng giao dịch"
var soDu = new ArrayList<Integer>();
int cong = 0;
for (int g : List.of(100, 200, -50, 300)) { cong += g; soDu.add(cong); }
soDu;   // [100, 300, 250, 550]
```

Đây là chỗ vòng `for` rõ ràng hơn Stream: trạng thái (`cong`) nằm ngay trước mắt, không phải lách luật "effectively final".

```java title="Gọi API cho nhiều mã, tối đa 4 việc cùng lúc, giữ thứ tự kết quả"
List<Future<String>> fs;
try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
    var gioiHan = new Semaphore(4);
    fs = Stream.of("A", "B", "C", "D", "E", "F", "G", "H")
        .map(ma -> ex.submit(() -> {
            gioiHan.acquire();
            try { return goiApiCham(ma); } finally { gioiHan.release(); }   // mỗi lần gọi 200 ms
        }))
        .toList();
}                                                      // close() đợi mọi việc xong
fs.stream().map(Future::resultNow).toList();
// [A✓, B✓, …, H✓] trong 418 ms — 8 việc, tối đa 4 cùng lúc → 2 đợt
```

Mỗi việc chạy trên một virtual thread (rẻ), còn `Semaphore` giới hạn số lời gọi **đồng thời** tới đối tác. `resultNow()` (Java 19) lấy kết quả của `Future` đã xong mà không phải bắt checked exception; nếu việc lỗi, nó ném `IllegalStateException` — cần xử lý lỗi từng mã thì bắt bên trong lambda.

## So sánh phương án

| Việc | Java 21 | Khi nâng lên Java 24+ |
|---|---|---|
| Chia lô 500 bản ghi | `chiaLo(ds, 500)` với `subList` | `gather(Gatherers.windowFixed(500))` |
| Số dư chạy dần | Vòng `for` + biến tích luỹ | `gather(Gatherers.scan(...))` |
| Gọi I/O song song có giới hạn | Virtual thread + `Semaphore` | `gather(Gatherers.mapConcurrent(n, f))` |
| Song song CPU, dữ liệu lớn | `parallel()` (sau khi đo) | như Java 21 |
| Tổng hợp cuối | `collect` | `collect` (Gatherer cho bước giữa, Collector cho bước cuối) |

## Tính năng mới theo phiên bản

- **Java 9**: `takeWhile`, `dropWhile`, `iterate` ba tham số, `ofNullable`.
- **Java 16**: `toList()`, `mapMulti`.
- **Java 19**: `Future.resultNow()`, `ExecutorService` là `AutoCloseable`. **Java 21**: virtual thread chính thức.
- **Java 22–23**: Gatherers ở dạng **preview**. **Java 24**: Gatherers chính thức (JEP 485). JDK 21 không có `java.util.stream.Gatherer` (đã kiểm tra: `ClassNotFoundException`).

:::version 24+ Khi nâng lên Java 24 / 25: Stream Gatherers
`Stream.gather(Gatherer)` là bước trung gian tuỳ biến, có trạng thái — "collector cho bước giữa". Các ví dụ dưới đây đã chạy trên JDK 25 khi soạn bài; trên Java 21 chúng **không biên dịch**.

```java
Stream.of(1, 2, 3, 4, 5, 6, 7).gather(Gatherers.windowFixed(3)).toList();
// [[1, 2, 3], [4, 5, 6], [7]]
Stream.of(1, 2, 3, 4, 5).gather(Gatherers.windowSliding(3)).toList();
// [[1, 2, 3], [2, 3, 4], [3, 4, 5]]  — trung bình trượt
Stream.of(100, 200, -50, 300).gather(Gatherers.scan(() -> 0, Integer::sum)).toList();
// [100, 300, 250, 550]
Stream.of("A", "B", "C", "D", "E", "F", "G", "H")
    .gather(Gatherers.mapConcurrent(4, ma -> goiApiCham(ma))).toList();
// chạy trên virtual thread, tối đa 4 cùng lúc, giữ thứ tự — ~408 ms
```

Tự viết gatherer — bỏ phần tử trùng **liên tiếp**:

```java
Gatherer<Integer, ?, Integer> boTrungLienTiep = Gatherer.ofSequential(
    () -> new int[]{Integer.MIN_VALUE, 0},             // trạng thái: [giá trị trước, đã có chưa]
    (st, n, down) -> {
        if (st[1] == 0 || st[0] != n) { st[0] = n; st[1] = 1; return down.push(n); }
        return true;                                    // true = tiếp tục nhận phần tử
    });
Stream.of(1, 1, 2, 2, 2, 1, 3, 3).gather(boTrungLienTiep).toList();   // [1, 2, 1, 3]
```

Một gatherer gồm `initializer` (tạo trạng thái), `integrator` (xử lý từng phần tử, trả `false` để dừng sớm), và tuỳ chọn `combiner`, `finisher`. Khi nâng cấp, các hàm `chiaLo` và đoạn `Semaphore` ở trên là ứng viên đầu tiên để thay.
:::

:::senior Góc nhìn senior
Hai câu hỏi trước khi thêm `.parallel()`: dữ liệu có đủ lớn và đủ tốn CPU không, và có ai khác đang dùng common pool không? Trong web service, câu trả lời thường là "không" — request đã chạy song song với nhau rồi, parallel stream chỉ thêm tranh chấp. Trên Java 21, gom các tiện ích như `chiaLo` hay "gọi song song có giới hạn" vào **một** class có test, thay vì chép vòng lặp khắp nơi — khi nâng lên Java 24+ chỉ cần thay ở một chỗ bằng Gatherers.
:::

:::quiz `Stream.of(5, 3, 8, 1).filter(n > 2, có log).map(có log).limit(2).toList()` — log là gì?
- [ ] f5 f3 f8 f1 m5 m3
- [x] f5 m5 f3 m3
- [ ] f5 f3 m5 m3
- [ ] f5 f3 f8 f1 m5 m3 m8

Từng phần tử đi hết pipeline; `limit(2)` dừng nguồn sau khi đủ 2. Đã chạy thử.
:::

:::quiz `IntStream.range(0, 100_000).parallel().forEach(arrayList::add)` — kết quả có thể là gì? (chọn nhiều)
- [x] List có ít hơn 100.000 phần tử
- [x] Ném `ArrayIndexOutOfBoundsException`
- [ ] Luôn đúng 100.000 phần tử, chỉ khác thứ tự
- [x] Thỉnh thoảng đúng 100.000 phần tử

`ArrayList` không thread-safe. Kết quả không xác định — ba lần chạy thử trên JDK 21: một lần ném exception, hai lần thiếu phần tử (92.844 và 13.204).
:::

:::exercise Chia lô khi import
Có `List<String> maKhachHang` gồm 1.234 mã. Viết pipeline chia thành các lô 500 mã, gọi `int luuLo(List<String> lo)` (trả số bản ghi đã lưu) cho mỗi lô, và tính tổng số bản ghi đã lưu.
???
```java
int tong = chiaLo(maKhachHang, 500).stream()   // 3 lô: 500, 500, 234 (đã chạy trên JDK 21)
    .mapToInt(lo -> luuLo(lo))
    .sum();
```

Hoặc không cần hàm tiện ích:

```java
int tong = 0;
for (int i = 0; i < maKhachHang.size(); i += 500)
    tong += luuLo(maKhachHang.subList(i, Math.min(i + 500, maKhachHang.size())));
```

Nếu `luuLo` gọi DB và muốn các lô chạy song song tối đa 2 cùng lúc: submit mỗi lô vào `newVirtualThreadPerTaskExecutor()` với `Semaphore(2)` như mục trên. Cần chú ý transaction và pool kết nối DB có đủ. Trên Java 24+: `.gather(Gatherers.windowFixed(500))` rồi `.gather(Gatherers.mapConcurrent(2, this::luuLo))`.
:::
