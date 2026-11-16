---
title: "Bên trong Stream — xử lý theo chiều dọc, thao tác có trạng thái, parallel stream và Stream Gatherers"
summary: "Quan sát thứ tự Stream thực sự chạy, vì sao sorted phá short-circuit, parallel stream dùng ForkJoin common pool và làm hỏng ArrayList, forEach vs forEachOrdered; rồi Stream Gatherers (Java 24): window, scan, fold, mapConcurrent và tự viết gatherer. Đo trên JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [java, stream, parallel, gatherers, internals, java-24]
related: [java/consolidate/functional/viet-bao-cao-bang-stream, java/deep-dive/concurrency/virtual-thread-va-structured-concurrency]
---

## TL;DR

- Stream xử lý **theo chiều dọc**: mỗi phần tử đi qua toàn bộ pipeline rồi mới tới phần tử sau. Nhờ vậy `limit`, `findFirst`, `anyMatch` dừng sớm được.
- Thao tác **có trạng thái** (`sorted`, `distinct`) phải đợi đủ dữ liệu → phá short-circuit ở phía trước nó.
- `parallel()` chạy trên **ForkJoinPool common pool** (số thread = số CPU − 1). Side effect vào collection không thread-safe → mất dữ liệu hoặc exception.
- **Gatherers** (Java 24) là "collector cho bước trung gian": cửa sổ, tích luỹ chạy dần, xử lý đồng thời có giới hạn — trước đây phải viết vòng lặp.

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

Đo trên máy 4 CPU, JDK 25:

```text
thread dùng: [ForkJoinPool.commonPool-worker-N, main]   parallelism=3   cpu=4
```

Thread gọi (`main`) cũng tham gia làm việc. Common pool **dùng chung cho cả JVM**: parallel stream ở một request chặn I/O sẽ làm chậm mọi parallel stream (và `CompletableFuture` không truyền executor) ở chỗ khác.

### Side effect làm hỏng dữ liệu

```java bad
var unsafe = new ArrayList<Integer>();
IntStream.range(0, 100_000).parallel().forEach(unsafe::add);
// lần chạy thử: ArrayIndexOutOfBoundsException, list còn 54.516 phần tử (mong đợi 100.000)
```

```java good
List<Integer> ok = IntStream.range(0, 100_000).parallel().boxed().toList();   // 100000
```

Collector tự xử lý song song đúng cách: mỗi luồng gom vào container riêng, rồi `combiner` gộp lại.

### Thứ tự

```java
IntStream.range(0, 10).parallel().mapToObj(String::valueOf).collect(joining(","));  // 0,1,2,…,9 — collect giữ thứ tự gặp
IntStream.range(0, 10).parallel().forEach(sb::append);          // 6103482795 — thứ tự bất kỳ
IntStream.range(0, 10).parallel().forEachOrdered(sb::append);   // 0123456789
```

### Khi nào parallel có lợi

- Dữ liệu **lớn** (hàng trăm nghìn phần tử trở lên) và mỗi phần tử tốn **CPU** đáng kể.
- Nguồn **chia đôi dễ**: `ArrayList`, mảng, `IntStream.range`. `LinkedList`, `Stream.iterate`, I/O chia rất kém.
- Không có thao tác phụ thuộc thứ tự tốn kém (`limit`, `findFirst` trên stream có thứ tự).
- **Không** dùng cho việc chặn I/O (gọi HTTP, DB) — common pool bị chiếm hết. Dùng virtual thread (bài *Concurrency*) hoặc `mapConcurrent` dưới đây.

## Stream Gatherers (Java 24)

`Stream.gather(Gatherer)` là bước trung gian tuỳ biến, có trạng thái. `Gatherers` có sẵn vài loại (đã chạy trên JDK 25):

```java
Stream.of(1, 2, 3, 4, 5, 6, 7).gather(Gatherers.windowFixed(3)).toList();
// [[1, 2, 3], [4, 5, 6], [7]]        — chia lô, vd insert DB 500 bản ghi một lần

Stream.of(1, 2, 3, 4, 5).gather(Gatherers.windowSliding(3)).toList();
// [[1, 2, 3], [2, 3, 4], [3, 4, 5]]  — trung bình trượt

Stream.of(100, 200, -50, 300).gather(Gatherers.scan(() -> 0, Integer::sum)).toList();
// [100, 300, 250, 550]               — số dư sau từng giao dịch

Stream.of(1, 2, 3, 4).gather(Gatherers.fold(() -> "", (acc, n) -> acc + n)).toList();
// [1234]                             — gộp thành một phần tử
```

`mapConcurrent` chạy hàm trên **virtual thread**, giới hạn số việc đồng thời, giữ thứ tự kết quả:

```java
Stream.of("A", "B", "C", "D", "E", "F", "G", "H")
    .gather(Gatherers.mapConcurrent(4, ma -> goiApiCham(ma)))    // mỗi lần gọi 200 ms
    .toList();
// [A✓, B✓, …, H✓] trong 408 ms — 8 việc, tối đa 4 cùng lúc → 2 đợt
```

Đây là cách gọn để "gọi API cho 1.000 mã, tối đa 20 request cùng lúc" mà không cần tự quản lý executor.

### Tự viết gatherer

Bỏ phần tử trùng **liên tiếp** (khác `distinct` — chỉ so với phần tử ngay trước):

```java
Gatherer<Integer, ?, Integer> boTrungLienTiep = Gatherer.ofSequential(
    () -> new int[]{Integer.MIN_VALUE, 0},             // trạng thái: [giá trị trước, đã có chưa]
    (st, n, down) -> {
        if (st[1] == 0 || st[0] != n) { st[0] = n; st[1] = 1; return down.push(n); }
        return true;                                    // true = tiếp tục nhận phần tử
    });

Stream.of(1, 1, 2, 2, 2, 1, 3, 3).gather(boTrungLienTiep).toList();   // [1, 2, 1, 3]
```

Một gatherer gồm `initializer` (tạo trạng thái), `integrator` (xử lý từng phần tử, trả `false` để dừng sớm), và tuỳ chọn `combiner` (chạy song song) và `finisher` (đẩy phần còn lại khi hết dữ liệu).

## So sánh phương án

| Việc | Cách cũ | Cách mới |
|---|---|---|
| Chia lô 500 bản ghi | Vòng `for` với `subList` | `gather(windowFixed(500))` |
| Số dư chạy dần | Vòng `for` + biến tích luỹ | `gather(scan(...))` |
| Gọi I/O song song có giới hạn | `ExecutorService` + `Future` | `gather(mapConcurrent(n, f))` |
| Song song CPU, dữ liệu lớn | `parallel()` | `parallel()` (sau khi đo) |
| Tổng hợp cuối | `collect` | `collect` (Gatherer cho bước giữa, Collector cho bước cuối) |

## Tính năng mới theo phiên bản

- **Java 9**: `takeWhile`, `dropWhile`, `iterate` ba tham số, `ofNullable`.
- **Java 16**: `toList()`, `mapMulti`.
- **Java 22–23**: Gatherers ở dạng **preview** (đã thử `--release 23`: *Gatherers is a preview API*).
- **Java 24**: Gatherers chính thức (JEP 485).

:::senior Góc nhìn senior
Hai câu hỏi trước khi thêm `.parallel()`: dữ liệu có đủ lớn và đủ tốn CPU không, và có ai khác đang dùng common pool không? Trong web service, câu trả lời thường là "không" — request đã chạy song song với nhau rồi, parallel stream chỉ thêm tranh chấp. Với Gatherers, hãy giới thiệu dần qua những chỗ rõ lợi ích (chia lô, `mapConcurrent` cho I/O) và giữ gatherer tự viết trong một class tiện ích có test — code trạng thái khó đọc hơn vòng lặp nếu đặt rải rác.
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

`ArrayList` không thread-safe. Kết quả không xác định — lần chạy thử vừa ném exception vừa chỉ còn 54.516 phần tử.
:::

:::exercise Chia lô khi import
Có `List<String> maKhachHang` gồm 1.234 mã. Viết pipeline chia thành các lô 500 mã, gọi `int luuLo(List<String> lo)` (trả số bản ghi đã lưu) cho mỗi lô, và tính tổng số bản ghi đã lưu.
???
```java
int tong = maKhachHang.stream()
    .gather(Gatherers.windowFixed(500))     // 3 lô: 500, 500, 234
    .mapToInt(lo -> luuLo(lo))
    .sum();
```

Trên Java 21 (chưa có Gatherers):

```java
int tong = 0;
for (int i = 0; i < maKhachHang.size(); i += 500)
    tong += luuLo(maKhachHang.subList(i, Math.min(i + 500, maKhachHang.size())));
```

Nếu `luuLo` gọi DB và muốn 3 lô chạy song song tối đa 2 cùng lúc, thay `mapToInt` bằng `.gather(Gatherers.mapConcurrent(2, this::luuLo))` rồi `.mapToInt(Integer::intValue).sum()`. Cần chú ý transaction và pool kết nối DB có đủ.
:::
