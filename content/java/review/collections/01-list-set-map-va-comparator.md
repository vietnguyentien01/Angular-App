---
title: "List, Set, Map và Comparator — chọn đúng collection"
summary: "Nhắc nhanh ArrayList/HashSet/HashMap và các biến thể giữ thứ tự, collection bất biến List.of, các method Map hay dùng (merge, computeIfAbsent), Comparator nhiều tiêu chí, sắp xếp tiếng Việt bằng Collator và SequencedCollection (Java 21). Output đã chạy trên JDK 21."
type: card
level: core
version: 21
lastReviewed: 2026-11-18
tags: [java, collections, list, map, comparator]
related: [java/consolidate/collections/loi-thuong-gap-voi-collection, java/deep-dive/collections/ben-trong-hashmap-va-generics]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS; chạy lại ví dụ trên JDK 21 và sửa thứ tự in của HashMap cho đúng output thật."
---

## Tóm tắt nhanh

- Mặc định: **`ArrayList`**, **`HashMap`**, **`HashSet`**. Cần giữ thứ tự thêm vào → `LinkedHashMap`/`LinkedHashSet`. Cần sắp xếp theo key → `TreeMap`/`TreeSet`.
- `List.of`, `Set.of`, `Map.of` tạo collection **bất biến** và **không nhận `null`**. `Arrays.asList` có kích thước cố định và ghi xuyên xuống mảng gốc.
- Đếm/gom nhóm bằng `merge` và `computeIfAbsent` thay vì `if (map.containsKey…)`.
- Sắp xếp: `Comparator.comparing(...).thenComparing(...)`. Chuỗi tiếng Việt cần `Collator`.

## Ví dụ nhanh (đã chạy trên JDK 21)

```java
record SP(String ten, String loai, int gia) {}
var ds = List.of(new SP("Nồi chiên", "Gia dụng", 1500000), new SP("Máy lọc", "Gia dụng", 5000000),
                 new SP("Máy đo HA", "Sức khoẻ", 1200000), new SP("Lõi lọc", "Phụ kiện", 350000),
                 new SP("Ấm điện", "Gia dụng", 350000));

ds.add(…);              // UnsupportedOperationException — List.of bất biến

var sx = new ArrayList<>(ds);
sx.sort(Comparator.comparing(SP::loai)
                  .thenComparing(SP::gia, Comparator.reverseOrder()));
// Gia dụng: Máy lọc, Nồi chiên, Ấm điện → Phụ kiện: Lõi lọc → Sức khoẻ: Máy đo HA

Map<String, Integer> dem = new HashMap<>();
for (var s : ds) dem.merge(s.loai(), 1, Integer::sum);          // {Gia dụng=3, Sức khoẻ=1, Phụ kiện=1} (thứ tự của HashMap)

Map<String, List<String>> theoLoai = new LinkedHashMap<>();
for (var s : ds) theoLoai.computeIfAbsent(s.loai(), k -> new ArrayList<>()).add(s.ten());
// {Gia dụng=[Nồi chiên, Máy lọc, Ấm điện], Sức khoẻ=[Máy đo HA], Phụ kiện=[Lõi lọc]}

dem.getOrDefault("Điện tử", 0);   // 0
```

```java title="Thứ tự lặp và tiếng Việt"
// thêm lần lượt: Huế, Hà Nội, Đà Nẵng, Cần Thơ, An Giang
LinkedHashSet → [Huế, Hà Nội, Đà Nẵng, Cần Thơ, An Giang]     // thứ tự thêm
TreeSet       → [An Giang, Cần Thơ, Huế, Hà Nội, Đà Nẵng]     // so theo mã Unicode: "u" < "à", "Đ" đứng cuối
new TreeSet<>(Collator.getInstance(Locale.of("vi")))
              → [An Giang, Cần Thơ, Đà Nẵng, Hà Nội, Huế]     // đúng thứ tự tiếng Việt
// HashSet: thứ tự không xác định — đừng dựa vào nó
```

```java title="SequencedCollection (Java 21)"
List<String> l = new ArrayList<>(List.of("a", "b", "c"));
l.getFirst(); l.getLast();    // "a" "c"   (trước Java 21: l.get(0), l.get(l.size() - 1))
l.reversed();                 // [c, b, a] — là view, không sao chép
linkedHashMap.firstEntry();   // x=1
```

## Bảng chọn nhanh

| Cần | Dùng | Ghi chú |
|---|---|---|
| Danh sách, truy cập theo vị trí | `ArrayList` | `LinkedList` hầu như không bao giờ nhanh hơn |
| Không trùng, kiểm tra tồn tại nhanh | `HashSet` | phần tử phải có `equals`/`hashCode` đúng |
| Tra theo key | `HashMap` | |
| Giữ thứ tự thêm vào (vd trả JSON theo thứ tự) | `LinkedHashMap` / `LinkedHashSet` | |
| Sắp xếp theo key, lấy khoảng (`subMap`, `floorKey`) | `TreeMap` / `TreeSet` | `O(log n)`, không nhận key `null` |
| Key là enum | `EnumMap` / `EnumSet` | nhanh và gọn hơn `HashMap` |
| Hàng đợi / ngăn xếp | `ArrayDeque` (`push`/`pop`, `offer`/`poll`) | thay cho `Stack`, `Vector` |
| Lấy phần tử ưu tiên cao nhất | `PriorityQueue` | |
| Giá trị trả về không cho sửa | `List.copyOf(...)`, `List.of(...)` | |

## Lỗi hay gặp: `remove(int)` và `remove(Object)`

```java bad
var nums = new ArrayList<>(List.of(10, 20, 30));
nums.remove(1);        // xoá phần tử ở VỊ TRÍ 1 → [10, 30], không phải xoá số 1
```

```java good
nums.remove(Integer.valueOf(10));   // xoá giá trị 10 → [30]
```

`List<Integer>` có hai overload `remove(int index)` và `remove(Object o)`; truyền `int` thì luôn chọn overload theo vị trí.

:::version Java 17 / 21 / 25
- `List.of`/`Map.of`: Java 9. `List.copyOf`, `Collectors.toUnmodifiableList`: Java 10. `Stream.toList()`: Java 16.
- `getFirst`, `getLast`, `reversed`, `firstEntry` trên `List`/`LinkedHashMap` (SequencedCollection, JEP 431): **Java 21**.
- `Locale.of`: Java 19 (Java 17 dùng `new Locale("vi")`).
:::

:::interview `HashMap`, `LinkedHashMap` và `TreeMap` khác nhau thế nào?
Cả ba đều là `Map`. `HashMap` dùng bảng băm, `get`/`put` trung bình O(1), thứ tự lặp không xác định. `LinkedHashMap` thêm danh sách liên kết nên lặp theo thứ tự thêm vào (hoặc thứ tự truy cập — dùng để làm cache LRU với `removeEldestEntry`). `TreeMap` là cây đỏ-đen, O(log n), lặp theo thứ tự key (tự nhiên hoặc `Comparator`), hỗ trợ truy vấn khoảng như `headMap`, `ceilingKey`; không nhận key `null`.
:::

:::quiz `var nums = new ArrayList<>(List.of(10, 20, 30)); nums.remove(1);` — `nums` còn gì?
- [ ] [20, 30]
- [x] [10, 30]
- [ ] [10, 20, 30]
- [ ] Ném `IndexOutOfBoundsException`

`remove(1)` chọn overload `remove(int index)`. Đã chạy thử.
:::

:::quiz Đoạn nào ném exception? (chọn nhiều)
- [x] `List.of("a", null)`
- [x] `Map.of("k", null)`
- [ ] `new HashMap<String, Integer>().put("k", null)`
- [x] `new TreeMap<String, Integer>().put(null, 1)`

Đã chạy thử: ba cái đầu tiên được đánh dấu đều ném `NullPointerException`. `HashMap` cho phép giá trị `null` (và một key `null`), nhưng khi đó `get("k")` trả `null` giống hệt key không tồn tại — dùng `containsKey` để phân biệt.
:::

:::quiz `var view = Collections.unmodifiableList(goc); var copy = List.copyOf(goc); goc.add("y");` (goc ban đầu là `[x]`). `view` và `copy` là gì?
- [ ] `[x]` và `[x]`
- [x] `[x, y]` và `[x]`
- [ ] `[x, y]` và `[x, y]`
- [ ] Ném `UnsupportedOperationException`

`unmodifiableList` là **view** chỉ đọc lên list gốc — gốc đổi thì view đổi. `copyOf` sao chép. Đã chạy thử.
:::
