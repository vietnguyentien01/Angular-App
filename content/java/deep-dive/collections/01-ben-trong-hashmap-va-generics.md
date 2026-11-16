---
title: "Bên trong HashMap và generics — bucket, resize, treeify, PECS và type erasure"
summary: "Quan sát bảng băm của HashMap bằng reflection: resize khi vượt load factor, treeify khi trùng hash, vì sao key trùng hash mà không Comparable chậm cả nghìn lần; rồi generics: invariance, PECS với ? extends/? super, type erasure và heap pollution. Đo trên JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [java, hashmap, generics, type-erasure, internals]
related: [java/consolidate/oop/equals-hashcode-va-ke-thua, java/consolidate/collections/loi-thuong-gap-voi-collection]
---

## TL;DR

- `HashMap` là mảng bucket (độ dài luôn là lũy thừa của 2). Vượt `capacity × 0.75` phần tử → **gấp đôi** và chia lại toàn bộ.
- Một bucket có ≥ 8 phần tử **và** bảng ≥ 64 bucket → chuyển thành cây đỏ-đen (`TreeNode`). Cây chỉ nhanh khi key **`Comparable`**.
- Biết trước số phần tử → `HashMap.newHashMap(n)` (Java 19+), không phải `new HashMap<>(n)`.
- Generics **bất biến**: `List<Integer>` không phải `List<Number>`. Đọc ra dùng `? extends T`, ghi vào dùng `? super T` (**PECS**: Producer Extends, Consumer Super).
- Generics bị **xoá kiểu** lúc chạy: `List<String>` và `List<Integer>` cùng một `Class`. Raw type phá an toàn kiểu, lỗi chỉ lộ ra ở chỗ đọc.

## Cơ chế bên trong HashMap

```text
table: Node[]   (độ dài 16, 32, 64, …)
index = (hash ^ (hash >>> 16)) & (table.length - 1)
bucket: null | Node → Node → … (danh sách) | TreeNode (cây đỏ-đen)
```

`hash ^ (hash >>> 16)` trộn 16 bit cao xuống thấp, vì phép `&` với `length - 1` chỉ dùng các bit thấp.

Quan sát field `table` bằng reflection (`--add-opens java.base/java.util=ALL-UNNAMED`), đã chạy trên JDK 25:

```text
mới tạo: 0                     ← lazy: chưa cấp phát mảng
sau 1 phần tử: 16 bucket
sau 13 phần tử: 32 bucket      ← 16 × 0.75 = 12, phần tử thứ 13 gây resize
sau 25 phần tử: 64 bucket
sau 49 phần tử: 128 bucket
sau 97 phần tử: 256 bucket
```

Mỗi lần resize phải duyệt và chia lại mọi phần tử. Với map lớn, đặt kích thước ban đầu đúng:

```java
new HashMap<>(100);          // table = 128 → sẽ resize khi vượt 96 phần tử!
HashMap.newHashMap(100);     // table = 256 → chứa đủ 100 phần tử không resize
```

Tham số của constructor là **capacity**, không phải số phần tử. `newHashMap(n)` (Java 19) tự tính `n / 0.75`.

### Khi mọi key trùng hash

```java
record Xau(int v) { @Override public int hashCode() { return 42; } }
```

12 key `Xau` → bảng đã lên **64** bucket, và bucket 42 chứa `TreeNode`. Khi một bucket vượt 8 phần tử mà bảng còn < 64 (`MIN_TREEIFY_CAPACITY`), `HashMap` ưu tiên **resize** thay vì treeify.

Đo thời gian `put` (JDK 25, đo thô):

| Số key | Cùng hash, **không** Comparable | Cùng hash, Comparable | Hash tốt |
|---|---|---|---|
| 10.000 | 147 ms | 20 ms | 2 ms |
| 50.000 | **21.348 ms** | 11 ms | 2 ms |

Cây đỏ-đen cần thứ tự để rẽ trái/phải. Key không `Comparable` → mọi key "bằng nhau" về thứ tự, nên khi chèn `HashMap` phải tìm khắp cây xem key đã có chưa: mỗi lần `put` gần như O(n), tổng O(n²). Đây là lý do `hashCode` tệ (vd luôn trả hằng số, hoặc chỉ dùng một field ít giá trị) có thể làm treo cả service — và là dạng tấn công từ chối dịch vụ khi key do người dùng gửi lên.

## Generics: bất biến và PECS

```java bad
List<Integer> ints = new ArrayList<>();
List<Number> nums = ints;    // lỗi: List<Integer> cannot be converted to List<Number>
```

Nếu dòng trên được phép, `nums.add(3.5)` sẽ nhét `Double` vào list `Integer`. Mảng thì cho phép (`Object[] a = new String[1]`) và phải trả giá lúc chạy: `a[0] = 1` → `ArrayStoreException`.

Để một method nhận được cả `List<Integer>` lẫn `List<Double>`:

```java
static double tong(List<? extends Number> ds) {      // PRODUCER: chỉ đọc ra Number
    double t = 0;
    for (Number n : ds) t += n.doubleValue();
    return t;
}
tong(List.of(1, 2, 3));    // 6.0
tong(List.of(1.5, 2.5));   // 4.0
// ds.add(1) → lỗi: compiler không biết list thật là List<Integer> hay List<Double>

static void themSo(List<? super Integer> dich) {     // CONSUMER: chỉ ghi Integer vào
    dich.add(1); dich.add(2);
}
themSo(new ArrayList<Number>());   // [1, 2]
themSo(new ArrayList<Object>());   // [1, 2]
```

Chữ ký trong JDK dùng đúng quy tắc này:

```java
// Collections.copy
static <T> void copy(List<? super T> dest, List<? extends T> src)
// Collections.max
static <T extends Comparable<? super T>> T max(Collection<? extends T> coll)
```

`Comparable<? super T>` cho phép lớp con dùng `compareTo` kế thừa từ lớp cha (vd `java.sql.Timestamp` kế thừa từ `java.util.Date`).

## Type erasure và heap pollution

```java
new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass();   // true
```

Tham số kiểu chỉ tồn tại lúc biên dịch; bytecode dùng `Object` (hoặc cận trên) và chèn ép kiểu ở chỗ đọc. Hệ quả:

- Không viết được `new T[10]` (*generic array creation*), `new T()`, `instanceof List<String>`.
- Không overload được `f(List<String>)` và `f(List<Integer>)` — cùng chữ ký sau khi xoá kiểu.
- Raw type làm hỏng an toàn kiểu mà lỗi lộ ra ở **chỗ khác**:

```java bad
List raw = new ArrayList<String>();
raw.add(42);                 // chỉ là cảnh báo unchecked
List<String> strs = raw;     // cảnh báo unchecked
strs.size();                 // 1 — chưa có gì sai
String s = strs.get(0);      // ClassCastException: Integer cannot be cast to String
```

Đừng bỏ qua cảnh báo `[unchecked]`. Bật `-Xlint:unchecked` và xử lý khi gặp. Tránh raw type, kể cả trong code cũ.

## So sánh phương án

| Tình huống | Lựa chọn |
|---|---|
| Map lớn biết trước kích thước | `HashMap.newHashMap(n)` |
| Key do người dùng gửi lên | Key là `String`/`record` (hash tốt, `Comparable` nếu được) |
| Cần thứ tự, truy vấn khoảng | `TreeMap` thay vì sort `HashMap` mỗi lần |
| Cache LRU nhỏ trong process | `LinkedHashMap(…, true)` + `removeEldestEntry`; production thì dùng thư viện cache (Caffeine) |
| Method nhận collection để đọc | `Collection<? extends T>` |
| Method nhận collection để ghi | `Collection<? super T>` |
| Giá trị trả về | Kiểu cụ thể (`List<T>`), không dùng wildcard |

## Tính năng mới theo phiên bản

- **Java 8**: bucket treeify (JEP 180).
- **Java 19**: `HashMap.newHashMap`, `HashSet.newHashSet`, `LinkedHashMap.newLinkedHashMap`.
- **Java 21**: SequencedCollection/SequencedMap (JEP 431).
- Generics vẫn bị xoá kiểu ở Java 25. Dự án Valhalla (value class, chuyên biệt hoá generics) đang phát triển, **chưa** có trong bản phát hành chính thức.

:::senior Góc nhìn senior
Hiểu cấu trúc bên trong giúp đọc đúng sự cố: CPU 100% ở `HashMap.putVal`/`TreeNode.find` trong thread dump thường là `hashCode` tệ hoặc key do bên ngoài kiểm soát; GC bận với `Node[]` khổng lồ là map resize liên tục. Với generics, quy tắc thực dụng: tham số dùng wildcard theo PECS, kiểu trả về thì cụ thể, và coi mọi cảnh báo `unchecked` là bug tiềm ẩn cần lý do rõ ràng nếu `@SuppressWarnings`.
:::

:::quiz `new HashMap<>(100)` rồi đưa 100 phần tử vào. Có resize không?
- [ ] Không — đã khai báo chứa 100
- [x] Có — capacity được làm tròn lên 128, ngưỡng là 128 × 0.75 = 96
- [ ] Có — mỗi lần put đều resize
- [ ] Tuỳ hash của key

Tham số là capacity, không phải số phần tử. `HashMap.newHashMap(100)` cho bảng 256. Đã kiểm tra bằng reflection.
:::

:::quiz Method nào biên dịch được?
- [ ] `void f(List<? extends Number> l) { l.add(1); }`
- [x] `void f(List<? super Integer> l) { l.add(1); }`
- [x] `Number f(List<? extends Number> l) { return l.get(0); }`
- [ ] `Integer f(List<? super Integer> l) { return l.get(0); }`

`? extends` đọc được, không ghi được (trừ `null`). `? super` ghi được `Integer`, nhưng đọc ra chỉ biết là `Object`.
:::

:::exercise Cache LRU 2 phần tử
Viết `LruCache<K, V>` dựa trên `LinkedHashMap` giữ tối đa `max` phần tử, bỏ phần tử ít được dùng gần đây nhất. Với `max = 2`: `put a`, `put b`, `get a`, `put c` — còn lại những key nào?
???
```java
class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int max;
    LruCache(int max) { super(16, 0.75f, true); this.max = max; }   // true = thứ tự truy cập
    @Override protected boolean removeEldestEntry(Map.Entry<K, V> eldest) { return size() > max; }
}
```

Kết quả `[a, c]` (đã chạy thử): `get a` đưa `a` lên cuối, nên khi thêm `c` thì `b` là cũ nhất và bị bỏ. Đây là trường hợp hiếm mà kế thừa collection là đúng: `removeEldestEntry` là hook được **thiết kế** để override. Class này không thread-safe — dùng nhiều thread thì cần thư viện cache.
:::
