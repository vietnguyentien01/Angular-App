---
title: "Viết báo cáo bằng Stream — groupingBy, toMap, partitioningBy và các bẫy"
summary: "Luyện viết báo cáo bán hàng bằng Collectors: đếm theo trạng thái, doanh thu BigDecimal theo tỉnh, gom mã đơn theo khách, chia hai nhóm, top sản phẩm. Chạy thử các bẫy: toMap trùng key, stream dùng hai lần, peek và tính lazy, side effect, toList() bất biến, orElse luôn chạy."
level: intermediate
version: 25
lastReviewed: 2026-11-16
tags: [java, stream, collectors, groupingby, pitfalls]
related: [java/review/functional/lambda-va-stream-co-ban, java/consolidate/collections/loi-thuong-gap-voi-collection]
---

## Tóm tắt nhanh

- `groupingBy(key, downstream)` là công cụ chính cho báo cáo. Downstream hay dùng: `counting()`, `mapping(f, toList())`, `reducing(ZERO, f, BigDecimal::add)`, `summingInt`.
- Truyền `TreeMap::new` làm tham số thứ hai để kết quả có thứ tự.
- `toMap(k, v)` **ném `IllegalStateException`** khi trùng key — luôn nghĩ tới hàm merge thứ ba.
- Stream lazy: không có bước kết thúc thì `peek`, `map` không chạy. `findFirst` chỉ xử lý tới phần tử cần thiết.
- Không thêm vào list bên ngoài trong `forEach`: dùng `collect`/`toList`.

## Dữ liệu dùng trong bài

```java
record Don(String ma, String khach, String tinh, String trangThai, BigDecimal tien, List<String> sanPham) {}

var dons = List.of(
    new Don("D1", "An",   "Hà Nội",  "PAID",      new BigDecimal("2200000"), List.of("Nồi chiên", "Lõi lọc")),
    new Don("D2", "Bình", "Hà Nội",  "PAID",      new BigDecimal("1200000"), List.of("Máy đo HA")),
    new Don("D3", "Chi",  "Đà Nẵng", "CANCELLED", new BigDecimal("1500000"), List.of("Nồi chiên")),
    new Don("D4", "An",   "Hà Nội",  "SHIPPED",   new BigDecimal("5000000"), List.of("Máy lọc")),
    new Don("D5", "Dũng", "TP.HCM",  "PENDING",   new BigDecimal("2400000"), List.of("Máy đo HA", "Máy đo HA")),
    new Don("D6", "An",   "Hà Nội",  "PAID",      new BigDecimal("1050000"), List.of("Lõi lọc")));
```

Mọi kết quả dưới đây đã chạy trên JDK 25 (`import static java.util.stream.Collectors.*`).

## Cơ chế: Collector

Một `Collector` gồm bốn phần: tạo container (`supplier`), thêm một phần tử (`accumulator`), gộp hai container khi chạy song song (`combiner`), và bước cuối (`finisher`). `groupingBy` là collector tạo `Map`; với mỗi key, nó chạy một **downstream collector** riêng. Vì vậy collector lồng nhau được: `groupingBy(tinh, groupingBy(khach, counting()))`.

## Các báo cáo

```java
// 1. Số đơn theo trạng thái, có thứ tự
dons.stream().collect(groupingBy(Don::trangThai, TreeMap::new, counting()));
// {CANCELLED=1, PAID=3, PENDING=1, SHIPPED=1}

// 2. Doanh thu theo tỉnh (bỏ đơn huỷ), cộng BigDecimal
dons.stream().filter(d -> !d.trangThai().equals("CANCELLED"))
    .collect(groupingBy(Don::tinh, TreeMap::new,
                        reducing(BigDecimal.ZERO, Don::tien, BigDecimal::add)));
// {Hà Nội=9450000, TP.HCM=2400000}

// 3. Mã đơn của từng khách
dons.stream().collect(groupingBy(Don::khach, TreeMap::new, mapping(Don::ma, toList())));
// {An=[D1, D4, D6], Bình=[D2], Chi=[D3], Dũng=[D5]}

// 4. Chia hai nhóm: từ 2 triệu trở lên và dưới 2 triệu
dons.stream().collect(partitioningBy(d -> d.tien().compareTo(new BigDecimal("2000000")) >= 0,
                                     mapping(Don::ma, toList())));
// {false=[D2, D3, D6], true=[D1, D4, D5]}

// 5. Số lần mỗi sản phẩm xuất hiện
dons.stream().flatMap(d -> d.sanPham().stream())
    .collect(groupingBy(Function.identity(), TreeMap::new, counting()));
// {Lõi lọc=2, Máy lọc=1, Máy đo HA=3, Nồi chiên=2}

// 6. Hai kết quả trong một lượt duyệt
dons.stream().collect(teeing(counting(),
                             reducing(BigDecimal.ZERO, Don::tien, BigDecimal::add),
                             (n, t) -> "n=" + n + " tổng=" + t));
// n=6 tổng=13350000
```

## Code bad / good

### `toMap` trùng key

```java bad
dons.stream().collect(toMap(Don::khach, Don::ma));
// IllegalStateException: Duplicate key An (attempted merging values D1 and D4)
```

```java good
dons.stream().collect(toMap(Don::khach, Don::tien, BigDecimal::add, TreeMap::new));
// {An=8250000, Bình=1200000, Chi=1500000, Dũng=2400000}
```

Lỗi này thường không lộ ra ở môi trường test (dữ liệu ít, không trùng) mà chỉ xuất hiện trên production.

### Tiền bằng `summingDouble`

```java bad
groupingBy(Don::khach, summingDouble(d -> d.tien().doubleValue()))
// {An=8250000.0, …} — đúng với số này, nhưng là double: cộng nhiều số lẻ sẽ sai
```

```java good
groupingBy(Don::khach, reducing(BigDecimal.ZERO, Don::tien, BigDecimal::add))
```

### Side effect trong `forEach`

```java bad
var ketQua = new ArrayList<String>();
dons.stream().filter(d -> d.tinh().equals("Hà Nội")).forEach(d -> ketQua.add(d.ma()));
```

```java good
List<String> ketQua = dons.stream().filter(d -> d.tinh().equals("Hà Nội")).map(Don::ma).toList();
// [D1, D2, D4, D6]
```

Hai cách cho cùng kết quả khi chạy tuần tự, nhưng cách đầu sẽ hỏng ngay khi ai đó thêm `.parallel()` (bài chuyên sâu đo được list chỉ còn ~54.000/100.000 phần tử).

## Pitfalls

```java
// Tính lazy
var log = new ArrayList<String>();
var s = dons.stream().peek(d -> log.add(d.ma())).filter(d -> d.khach().equals("Bình"));
log;              // [] — chưa có bước kết thúc
s.findFirst();
log;              // [D1, D2] — dừng ngay khi tìm thấy

// toList() trả list bất biến
dons.stream().map(Don::ma).toList().add("X");     // UnsupportedOperationException
dons.stream().map(Don::ma).collect(toCollection(ArrayList::new));   // cần sửa sau đó

// orElse luôn tính giá trị mặc định
Optional.of("có").orElse(taoMacDinh());     // taoMacDinh() VẪN chạy
Optional.of("có").orElseGet(this::taoMacDinh);   // không chạy
// đếm số lần gọi supplier qua hai dòng trên: 1
```

`orElse(goiDatabase())` hay `orElse(new ObjectNang())` là nguồn chậm và side effect khó thấy. Giá trị mặc định tốn kém thì dùng `orElseGet`.

Thêm vài điều cần nhớ:

- `peek` chỉ dùng để debug. Đừng đặt logic nghiệp vụ trong đó.
- `Collectors.toList()` không cam kết là list mutable, dù hiện tại trả `ArrayList`. Cần sửa thì dùng `toCollection(ArrayList::new)`.
- `groupingBy` không có tham số map → `HashMap`, thứ tự key không xác định.
- `sorted()` trên record không `Comparable` → `ClassCastException` lúc chạy. Luôn truyền `Comparator`.

:::senior Góc nhìn senior
Stream tốt cho báo cáo trong bộ nhớ với dữ liệu vừa phải. Khi dữ liệu nằm trong DB, `GROUP BY` ở SQL gần như luôn đúng hơn: kéo 1 triệu dòng về để `groupingBy` tốn mạng, bộ nhớ và GC. Quy tắc: lọc và tổng hợp ở nơi có dữ liệu; Stream dùng để biến đổi kết quả cuối, ghép dữ liệu từ nhiều nguồn, hoặc xử lý dữ liệu đã nằm sẵn trong bộ nhớ.
:::

:::version Java 17 / 21 / 25
`teeing` (Java 12) và `toList()` (Java 16) có trên Java 17. Trên Java 11, thay `toList()` bằng `collect(Collectors.toList())`. `Map.Entry.comparingByValue()` có từ Java 8.
:::

:::interview `Collectors.toMap` ném exception khi nào và xử lý thế nào?
Khi hai phần tử cho cùng key mà không có hàm merge, `toMap` ném `IllegalStateException: Duplicate key …`. Xử lý: truyền tham số thứ ba để gộp (`BigDecimal::add`, `(a, b) -> a` giữ cái đầu), hoặc dùng `groupingBy` nếu muốn giữ mọi giá trị. Ngoài ra `toMap` ném `NullPointerException` nếu value là `null` (vì nó dùng `Map.merge`). Tham số thứ tư chọn loại map, vd `TreeMap::new` hoặc `LinkedHashMap::new` để giữ thứ tự.
:::

:::quiz `var log = …; var s = dons.stream().peek(d -> log.add(d.ma())).filter(d -> d.khach().equals("Bình")); s.findFirst();` — `log` chứa gì?
- [ ] [] — peek không chạy với findFirst
- [x] [D1, D2]
- [ ] [D1, D2, D3, D4, D5, D6]
- [ ] [D2]

Stream xử lý từng phần tử qua toàn bộ pipeline. `findFirst` dừng ngay sau D2. Đã chạy thử.
:::

:::quiz Có 3 đơn của "An". `dons.stream().collect(toMap(Don::khach, Don::ma))` cho gì?
- [ ] `{An=D6, …}` — giữ giá trị cuối
- [ ] `{An=D1, …}` — giữ giá trị đầu
- [x] Ném `IllegalStateException: Duplicate key An`
- [ ] `{An=[D1, D4, D6], …}`

Đã chạy thử. Muốn giữ cả ba thì dùng `groupingBy(Don::khach, mapping(Don::ma, toList()))`.
:::

:::exercise Top 2 sản phẩm bán chạy
Từ `dons`, bỏ đơn huỷ, tìm 2 sản phẩm xuất hiện nhiều nhất (một đơn có thể chứa cùng sản phẩm hai lần, tính cả hai). Nếu bằng số lần thì xếp theo tên. In dạng `"Tên (số lần)"`.
???
```java
List<String> top2 = dons.stream()
    .filter(d -> !d.trangThai().equals("CANCELLED"))
    .flatMap(d -> d.sanPham().stream())
    .collect(groupingBy(Function.identity(), counting()))
    .entrySet().stream()
    .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                     .thenComparing(Map.Entry.comparingByKey()))
    .limit(2)
    .map(e -> e.getKey() + " (" + e.getValue() + ")")
    .toList();
// [Máy đo HA (3), Lõi lọc (2)]
```

Đã chạy thử. "Nồi chiên" chỉ còn 1 vì D3 bị huỷ. Kiểu `<String, Long>` phải ghi rõ vì `counting()` trả `Long` và `.reversed()` chặn suy luận kiểu.
:::

:::exercise Khách VIP
Liệt kê (theo tên) những khách có tổng tiền các đơn không huỷ **lớn hơn** 3.000.000 đ, tính bằng `BigDecimal`.
???
```java
BigDecimal nguong = new BigDecimal("3000000");
List<String> vip = dons.stream()
    .filter(d -> !d.trangThai().equals("CANCELLED"))
    .collect(groupingBy(Don::khach, reducing(BigDecimal.ZERO, Don::tien, BigDecimal::add)))
    .entrySet().stream()
    .filter(e -> e.getValue().compareTo(nguong) > 0)
    .map(Map.Entry::getKey)
    .sorted()
    .toList();
// [An] — An 8.250.000, Dũng 2.400.000, Bình 1.200.000
```

Đã chạy thử. Hai bước: gom nhóm trước (cần đủ dữ liệu của mỗi khách), rồi lọc trên kết quả — giống `GROUP BY … HAVING` trong SQL.
:::
