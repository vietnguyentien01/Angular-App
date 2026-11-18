---
title: "Lambda, method reference và Stream cơ bản"
summary: "Nhắc nhanh cú pháp lambda, bốn dạng method reference, các functional interface có sẵn (Predicate, Function, Supplier, Consumer…), pipeline Stream filter → map → sorted → toList, reduce, flatMap và Optional. Mọi output đã chạy trên JDK 21."
type: card
level: core
version: 21
lastReviewed: 2026-11-18
tags: [java, lambda, stream, optional, functional]
related: [java/consolidate/functional/viet-bao-cao-bang-stream, java/deep-dive/functional/ben-trong-stream-parallel-va-gatherers]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS; Gatherers ghi rõ là tính năng của Java 24+, chưa có trên Java 21."
---

## Tóm tắt nhanh

- Lambda `(x) -> biểu thức` là cài đặt ngắn gọn của một **functional interface** (interface có đúng một method trừu tượng).
- Method reference `Don::khach` = lambda `d -> d.khach()`.
- Stream = **nguồn → các bước trung gian (lazy) → một bước kết thúc**. Không có bước kết thúc thì không chạy gì cả. Stream chỉ dùng được **một lần**.
- `Optional` là kiểu trả về cho "có thể không có". Dùng `map`/`orElse`/`orElseThrow`, tránh `get()`.
- Biến bên ngoài dùng trong lambda phải là **effectively final** (không bị gán lại).

## Ví dụ nhanh (đã chạy trên JDK 21)

```java
record Don(String ma, String khach, String tinh, String trangThai, BigDecimal tien, List<String> sanPham) {}
// 6 đơn: D1 An 2,2tr · D2 Bình 1,2tr · D3 Chi 1,5tr (huỷ) · D4 An 5tr · D5 Dũng 2,4tr · D6 An 1,05tr

List<String> top = dons.stream()
    .filter(d -> !d.trangThai().equals("CANCELLED"))
    .sorted(Comparator.comparing(Don::tien).reversed())
    .limit(3)
    .map(d -> d.ma() + ":" + d.tien())
    .toList();                                   // [D4:5000000, D5:2400000, D1:2200000]

dons.stream().filter(...).map(Don::tien)
    .reduce(BigDecimal.ZERO, BigDecimal::add);   // 11850000

dons.stream().map(Don::khach).distinct().sorted()
    .collect(Collectors.joining(", ", "[", "]"));   // [An, Bình, Chi, Dũng]

dons.stream().flatMap(d -> d.sanPham().stream()).distinct().toList();
// [Nồi chiên, Lõi lọc, Máy đo HA, Máy lọc]

IntStream.rangeClosed(1, 5).map(i -> i * i).sum();   // 55 — stream primitive, không boxing

dons.stream().filter(d -> d.khach().equals("Zed")).findFirst()
    .map(Don::ma).orElse("không có");            // "không có"
```

## Functional interface có sẵn

| Interface | Method | Ví dụ |
|---|---|---|
| `Predicate<T>` | `boolean test(T)` | `d -> d.tien().signum() > 0`; ghép `and`, `or`, `negate` |
| `Function<T, R>` | `R apply(T)` | `Don::khach`; ghép `andThen`, `compose` |
| `Supplier<T>` | `T get()` | `ArrayList::new` |
| `Consumer<T>` | `void accept(T)` | `System.out::println` |
| `BiFunction<T, U, R>` | `R apply(T, U)` | `(a, b) -> a + b` |
| `UnaryOperator<T>` / `BinaryOperator<T>` | `T apply(T)` / `T apply(T, T)` | `String::toUpperCase` / `BigDecimal::add` |
| `IntPredicate`, `ToIntFunction`… | bản primitive | tránh boxing |

`x2.andThen(p3).apply(5)` = (5 × 2) + 3 = **13**; `x2.compose(p3).apply(5)` = (5 + 3) × 2 = **16**.

Bốn dạng method reference:

| Dạng | Ví dụ | Tương đương |
|---|---|---|
| Static method | `Integer::parseInt` | `s -> Integer.parseInt(s)` |
| Method của object cụ thể | `log::add` | `x -> log.add(x)` |
| Method của tham số đầu | `String::toUpperCase` | `s -> s.toUpperCase()` |
| Constructor | `ArrayList::new` | `() -> new ArrayList<>()` |

## Bảng chọn nhanh

| Muốn | Viết |
|---|---|
| Lọc, biến đổi, lấy list | `.filter(...).map(...).toList()` |
| Có ít nhất một / tất cả / không cái nào | `anyMatch` / `allMatch` / `noneMatch` |
| Phần tử đầu thoả điều kiện | `.filter(...).findFirst()` → `Optional` |
| Tổng, min, max số | `mapToInt(...).sum()`, `.max()`, `summaryStatistics()` |
| Gộp tiền `BigDecimal` | `.map(...).reduce(BigDecimal.ZERO, BigDecimal::add)` |
| Ghép chuỗi | `Collectors.joining(", ")` |
| List con → một list phẳng | `flatMap(x -> x.list().stream())` |
| Đếm/gom nhóm | `Collectors.groupingBy` (xem bài *Viết báo cáo bằng Stream*) |

## Lỗi hay gặp: sửa biến bên ngoài trong lambda

```java bad
int tong = 0;
dons.forEach(d -> tong += d.tien().intValue());
// lỗi: local variables referenced from a lambda expression must be final or effectively final
```

```java good
int tong = dons.stream().mapToInt(d -> d.tien().intValue()).sum();
```

Lambda có thể chạy sau này, hoặc trên thread khác; Java cấm sửa biến local để tránh race condition. Lách bằng `int[] tong = {0}` hay `AtomicInteger` là dấu hiệu nên dùng `reduce`/`sum`/`collect`.

:::version Java 17 / 21 / 25
- Lambda, Stream, `Optional`: Java 8. `Stream.iterate(seed, hasNext, next)`, `takeWhile`/`dropWhile`: Java 9.
- `Collectors.teeing`: Java 12. **`Stream.toList()`: Java 16** — trên Java 11 dùng `collect(Collectors.toList())`. `mapMulti`: Java 16.
- **Khi nâng lên Java 24+**: `Stream.gather` + `Gatherers` (chia lô, tích luỹ chạy dần) — preview ở Java 22–23, chính thức Java 24. Java 21 **chưa có**, dùng vòng lặp hoặc `Collectors` (xem bài chuyên sâu).
:::

:::interview Stream khác vòng lặp for thế nào? Khi nào không nên dùng Stream?
Stream mô tả **cái cần làm** (lọc, biến đổi, gom nhóm) theo kiểu khai báo, các bước trung gian lazy và có thể song song hoá. Vòng `for` mô tả **cách làm** từng bước. Không nên dùng Stream khi logic có nhiều nhánh, cần `break`/`continue` phức tạp, cần exception checked, hay sửa state bên ngoài — khi đó vòng `for` dễ đọc và debug hơn. Hiệu năng thường tương đương; với code cực nóng thì đo bằng JMH thay vì đoán.
:::

:::quiz `Function<Integer,Integer> x2 = n -> n * 2, p3 = n -> n + 3;` — `x2.compose(p3).apply(5)` bằng bao nhiêu?
- [ ] 13
- [x] 16
- [ ] 10
- [ ] 8

`compose` chạy hàm tham số **trước**: p3(5) = 8, rồi x2(8) = 16. `andThen` thì ngược lại: 13. Đã chạy thử.
:::

:::quiz Đoạn này in gì? `var s = dons.stream().map(Don::ma); s.count(); s.count();`
- [ ] 6 rồi 6
- [ ] 6 rồi 0
- [x] Lần thứ hai ném `IllegalStateException: stream has already been operated upon or closed`
- [ ] Lỗi biên dịch

Stream chỉ dùng được một lần. Cần dùng lại thì tạo stream mới từ collection. Đã chạy thử.
:::

:::quiz Giá trị `Optional<String> o = Optional.empty()`. Cách lấy giá trị nào an toàn? (chọn nhiều)
- [ ] `o.get()`
- [x] `o.orElse("mặc định")`
- [x] `o.map(String::length).orElse(-1)`
- [x] `o.orElseThrow(() -> new KhongTimThay(...))`

`get()` trên Optional rỗng ném `NoSuchElementException: No value present` (đã chạy thử). `orElseThrow` với exception nghiệp vụ là cách thể hiện rõ ý "phải có".
:::
