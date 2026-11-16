---
title: "Lỗi thường gặp với Collection — ConcurrentModificationException, xoá khi lặp, null và kiểu key"
summary: "Chạy thử: xoá trong for-each khi nào ném ConcurrentModificationException (và khi nào thì không — tệ hơn), xoá theo index bỏ sót phần tử, removeIf và Iterator.remove, view so với bản sao, get(1) trên Map<Long,…> luôn trả null, null trong HashMap; rồi viết báo cáo top khách hàng."
level: intermediate
version: 25
lastReviewed: 2026-11-16
tags: [java, collections, pitfalls, concurrentmodification]
related: [java/review/collections/list-set-map-va-comparator, java/consolidate/functional/viet-bao-cao-bang-stream]
---

## TL;DR

- **Không** sửa collection (`add`/`remove`) bên trong vòng for-each của chính nó. Dùng `removeIf`, `Iterator.remove`, hoặc tạo collection mới.
- `ConcurrentModificationException` là cơ chế **"cố gắng hết sức"** (fail-fast), không được đảm bảo: có trường hợp xoá sai mà **không** có exception.
- `Map<Long, …>.get(1)` trả `null` vì `1` được box thành `Integer`, không bằng `Long` 1. Key/giá trị tra cứu phải **đúng kiểu**.
- `HashMap.get` trả `null` vừa nghĩa là "không có key" vừa là "giá trị null" — tránh lưu `null` làm giá trị.
- Trả collection ra ngoài: `List.copyOf` (bản sao bất biến) an toàn hơn `Collections.unmodifiableList` (view).

## Cơ chế: fail-fast iterator

`ArrayList` có bộ đếm `modCount`, tăng mỗi lần thay đổi cấu trúc. Iterator nhớ giá trị lúc tạo; mỗi lần `next()` nó so lại, khác thì ném `ConcurrentModificationException` (CME). For-each chính là `iterator()` + `hasNext()` + `next()`.

Mọi kết quả dưới đây đã chạy trên JDK 25.

## Xoá trong vòng lặp

```java bad
var ds = new ArrayList<>(List.of("An", "Bình", "Chi", "Dũng"));
for (String s : ds) if (s.startsWith("B")) ds.remove(s);
// ConcurrentModificationException — nhưng "Bình" ĐÃ bị xoá: ds = [An, Chi, Dũng]
```

Tệ hơn — trường hợp **không** có exception:

```java bad
var ds2 = new ArrayList<>(List.of("An", "Bình", "Chi"));
for (String s : ds2) if (s.equals("Bình")) ds2.remove(s);
// ds2 = [An, Chi], không exception, "Chi" KHÔNG được kiểm tra
```

Xoá phần tử kế cuối làm `size` giảm đúng bằng vị trí con trỏ, nên `hasNext()` trả false và vòng lặp kết thúc sớm. Nếu điều kiện cũng đúng với "Chi", bạn sẽ không biết nó bị bỏ qua.

Xoá theo index cũng sai theo cách khác:

```java bad
var ds5 = new ArrayList<>(List.of("A", "B", "C", "D"));
for (int i = 0; i < ds5.size(); i++) ds5.remove(i);
// [B, D] — mỗi lần xoá, phần tử phía sau dồn lên và bị nhảy qua
```

```java good
ds.removeIf(s -> s.startsWith("B") || s.startsWith("C"));          // [An, Dũng]

for (var it = ds4.iterator(); it.hasNext();)                       // khi cần logic phức tạp
    if (it.next().length() > 3) it.remove();                       // [An, Chi]

map.values().removeIf(v -> v > 1);                                  // Map: xoá theo giá trị
map.entrySet().removeIf(e -> e.getKey().equals("a"));               // xoá theo key
```

Với `HashMap`, `for (var k : map.keySet()) if (...) map.remove(k);` cũng ném CME (đã chạy thử).

## View hay bản sao

```java
var goc = new ArrayList<>(List.of("x"));
var view = Collections.unmodifiableList(goc);   // chỉ đọc, nhưng nhìn xuyên xuống goc
var copy = List.copyOf(goc);                    // bản sao bất biến
goc.add("y");
view;   // [x, y]
copy;   // [x]
```

```java bad
class DonHang {
    private final List<String> sanPham = new ArrayList<>();
    List<String> sanPham() { return sanPham; }          // người gọi sửa được state bên trong
}
```

```java good
List<String> sanPham() { return List.copyOf(sanPham); }  // hoặc Collections.unmodifiableList nếu chấp nhận view
```

## Kiểu của key

```java bad
Set<Long> ids = new HashSet<>(List.of(1L, 2L, 3L));
int id = 2;
ids.contains(id);              // false — Integer(2) không equals Long(2)

Map<Long, String> ten = new HashMap<>(Map.of(1L, "An"));
ten.get(1);                    // null
```

```java good
ids.contains((long) id);       // true
ten.get(1L);                   // "An"
```

`contains(Object)`, `get(Object)`, `remove(Object)` nhận `Object` nên compiler không báo lỗi. IntelliJ có inspection *suspicious collection method call* — đừng tắt nó. Hay gặp nhất khi ID trong entity là `Long` còn tham số API là `int`.

## `null` trong Map

```java
var m = new HashMap<String, Integer>();
m.put("k", null);
m.containsKey("k");       // true
m.get("k");               // null
m.get("z");               // null — không phân biệt được với dòng trên
m.getOrDefault("k", 0);   // null! có key nên không dùng giá trị mặc định
```

`Map.of`, `TreeMap` (key), `ConcurrentHashMap` (cả key và giá trị) đều **không nhận** `null`. Quy ước tốt: không bao giờ lưu `null` làm giá trị, dùng "không có key" để biểu diễn "không có".

## Pitfalls

- `Arrays.asList(arr)`: `add`/`remove` ném `UnsupportedOperationException`, còn `set` ghi xuyên xuống mảng gốc.
- `List.of(...).contains(null)` ném `NullPointerException` thay vì trả false.
- Sửa object đang làm key trong `HashMap`/`HashSet` (xem bài *equals, hashCode và kế thừa*).
- Dùng `HashMap` từ nhiều thread mà không đồng bộ → dữ liệu hỏng. Dùng `ConcurrentHashMap` (bài *Concurrency*).
- `subList` cũng là view; sửa list gốc sau đó làm `subList` ném CME.

:::senior Góc nhìn senior
Hai thói quen giảm hẳn loại bug này: (1) code mới ưu tiên **biến đổi tạo collection mới** (Stream, `List.copyOf`) thay vì sửa tại chỗ; (2) API public trả về collection bất biến và nhận tham số kiểu interface (`List`, `Map`) chứ không phải `ArrayList`. Khi review, mọi `remove` nằm trong vòng lặp đều đáng hỏi lại.
:::

:::version Java 17 / 21 / 25
`removeIf` có từ Java 8, `List.copyOf` từ Java 10 — dùng được trên mọi dự án còn được hỗ trợ. Java 21 thêm `reversed()` (cũng là view) cho `List`, `Deque`, `LinkedHashSet`, `LinkedHashMap`.
:::

:::interview `ConcurrentModificationException` có nghĩa là có nhiều thread không?
Không nhất thiết. Nó nghĩa là collection bị thay đổi cấu trúc trong khi một iterator đang duyệt — thường xảy ra ngay trên **một thread**, khi gọi `list.remove` trong for-each. Cơ chế fail-fast so `modCount` với giá trị iterator nhớ, và chỉ là "cố gắng hết sức": có trường hợp không ném exception mà vòng lặp kết thúc sớm. Sửa bằng `removeIf`, `Iterator.remove`, hoặc collection mới. Với nhiều thread, dùng collection concurrent (`ConcurrentHashMap`, `CopyOnWriteArrayList`), iterator của chúng không ném CME.
:::

:::quiz `ds = [An, Bình, Chi]`; `for (String s : ds) if (s.equals("Bình")) ds.remove(s);` — kết quả?
- [ ] Ném `ConcurrentModificationException`, ds không đổi
- [ ] Ném `ConcurrentModificationException`, ds = [An, Chi]
- [x] Không exception, ds = [An, Chi], "Chi" không được duyệt
- [ ] Không exception, ds = [An, Chi], đã duyệt cả "Chi"

Xoá phần tử kế cuối làm `hasNext()` trả false. Đã chạy thử.
:::

:::quiz `Map<Long, String> m = Map.of(1L, "An"); m.get(1)` trả gì?
- [ ] "An"
- [x] null
- [ ] Lỗi biên dịch
- [ ] `ClassCastException`

`get(Object)` nhận mọi object; `1` được box thành `Integer`, `Integer.equals(Long)` là false. Đã chạy thử.
:::

:::exercise Lọc đơn huỷ và đếm theo trạng thái
Cho `List<Don> dons` (mutable), `record Don(String ma, String trangThai, int tien)`. (a) Xoá mọi đơn có trạng thái `"HUY"` ngay trong list. (b) Trả về `Map<String, Integer>` số đơn theo trạng thái, key sắp theo bảng chữ cái. Không dùng Stream.
???
```java
dons.removeIf(d -> d.trangThai().equals("HUY"));

Map<String, Integer> dem = new TreeMap<>();
for (Don d : dons) dem.merge(d.trangThai(), 1, Integer::sum);
```

`removeIf` duyệt và xoá an toàn trong một lượt (với `ArrayList` nó dồn phần tử một lần, nhanh hơn gọi `remove` nhiều lần). `TreeMap` cho key theo thứ tự; `merge` thay cho `getOrDefault` + `put`. Bài *Viết báo cáo bằng Stream* làm lại bài này bằng `Collectors.groupingBy`.
:::

:::exercise Top 2 khách hàng theo tổng tiền
Từ các đơn `D1 An 300`, `D2 Bình 100`, `D3 An 200`, `D4 Chi 100`, in 2 khách có tổng tiền lớn nhất; nếu bằng tiền thì xếp theo tên.
???
```java
Map<String, Integer> tong = new TreeMap<>();
for (var d : dons) tong.merge(d.khach(), d.tien(), Integer::sum);     // {An=500, Bình=100, Chi=100}

var top = new ArrayList<>(tong.entrySet());
top.sort(Map.Entry.<String, Integer>comparingByValue().reversed()
                  .thenComparing(Map.Entry.comparingByKey()));
top.subList(0, Math.min(2, top.size()));                               // [An=500, Bình=100]
```

Đã chạy thử. `Map.Entry.<String, Integer>comparingByValue()` cần ghi rõ kiểu vì gọi `.reversed()` ngay sau đó, compiler không suy được kiểu. Bình và Chi bằng tiền nên tiêu chí phụ chọn Bình.
:::
