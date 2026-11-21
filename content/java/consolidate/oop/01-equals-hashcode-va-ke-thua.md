---
title: "equals, hashCode và kế thừa — năm bẫy làm HashSet/HashMap chạy sai"
summary: "Chạy thử năm lỗi kinh điển: thiếu hashCode, key bị sửa sau khi đưa vào HashSet, equals bị overload thay vì override, equals mất tính đối xứng khi kế thừa, và lớp con HashSet đếm sai vì self-use. Sửa bằng record, business key bất biến và composition."
level: intermediate
version: 21
lastReviewed: 2026-11-19
tags: [java, oop, equals, hashcode, composition, pitfalls]
related: [java/review/oop/class-interface-record-enum, java/deep-dive/collections/ben-trong-hashmap-va-generics]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS; chạy lại các ví dụ trên JDK 21."
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

- Override `equals` thì **bắt buộc** override `hashCode`, dùng **cùng các field**. Hai object `equals` nhau phải có cùng `hashCode`.
- Field dùng trong `equals`/`hashCode` phải **bất biến** — sửa nó sau khi đưa vào `HashSet`/`HashMap` là object "biến mất".
- Chữ ký đúng là `equals(Object o)`. Viết `equals(SanPham o)` là **overload**, collection không gọi tới.
- Kế thừa một class có `equals` rồi thêm field → khó giữ tính đối xứng. Ưu tiên `final class`, `record`, hoặc composition.
- `extends HashSet`/`ArrayList` để thêm hành vi dễ vỡ vì phụ thuộc chi tiết bên trong lớp cha.

## Cơ chế: HashSet tìm phần tử thế nào

`HashSet` dùng `HashMap` bên dưới. `contains(x)`:

1. Tính `x.hashCode()` → chọn **bucket**.
2. Trong bucket đó, so từng phần tử bằng `equals`.

Vì vậy `hashCode` sai thì tìm sai bucket — `equals` đúng cũng vô ích. Hợp đồng (Javadoc `Object.equals`): phản xạ, đối xứng, bắc cầu, nhất quán, `x.equals(null) == false`.

Mọi kết quả dưới đây đã chạy trên JDK 21.

## Bẫy 1: chỉ override `equals`

```java bad
class SanPham {
    final String sku;
    SanPham(String sku) { this.sku = sku; }
    @Override public boolean equals(Object o) { return o instanceof SanPham s && s.sku.equals(sku); }
}
set.add(new SanPham("A1")); set.add(new SanPham("A1"));
set.size();                          // 2
set.contains(new SanPham("A1"));     // false
```

`hashCode` mặc định dựa trên định danh object, nên hai object "bằng nhau" gần như luôn rơi vào hai bucket khác nhau.

```java good
@Override public int hashCode() { return sku.hashCode(); }
// size 1, contains true
```

Hoặc gọn nhất: `record SanPham(String sku) {}`.

## Bẫy 2: sửa key sau khi đưa vào set

```java bad
class Diem { int x; … equals/hashCode theo x … }
var d = new Diem(1);
set.add(d);
d.x = 2;
set.contains(d);             // false — d nằm ở bucket của hash(1)
set.contains(new Diem(1));   // false — bucket đúng nhưng equals so x=2 với 1
set.remove(d);               // không xoá được, size vẫn 1 → rò rỉ
```

```java good
// Field trong equals/hashCode phải final. Cần trạng thái thay đổi thì để ở field khác,
// không tham gia equals (vd trangThai của hợp đồng).
```

## Bẫy 3: overload thay vì override

```java bad
class Ma {
    String ma;
    public boolean equals(Ma o) { return o.ma.equals(ma); }   // tham số Ma, không phải Object
    @Override public int hashCode() { return ma.hashCode(); }
}
new Ma("X").equals(new Ma("X"));          // true — gọi trực tiếp thì chạy overload
list.contains(new Ma("X"));               // false — ArrayList gọi equals(Object)
```

Luôn viết `@Override`: compiler sẽ báo lỗi ngay khi chữ ký sai.

## Bẫy 4: kế thừa phá tính đối xứng

```java bad
class Diem2D { final int x, y; … equals: o instanceof Diem2D d && d.x == x && d.y == y }
class DiemMau extends Diem2D {
    final String mau;
    @Override public boolean equals(Object o) {
        return o instanceof DiemMau d && super.equals(d) && d.mau.equals(mau);
    }
}
var p = new Diem2D(1, 2); var cp = new DiemMau(1, 2, "đỏ");
p.equals(cp);   // true
cp.equals(p);   // false — vi phạm đối xứng; HashSet/List cho kết quả tuỳ thứ tự
```

Không có cách nào vừa thêm field vào `equals` ở lớp con vừa giữ đủ hợp đồng (*Effective Java*, Item 10). Lựa chọn: đánh dấu class `final`, dùng `record` (không kế thừa được), hoặc composition — `DiemMau` **chứa** một `Diem2D`.

## Bẫy 5: kế thừa collection

```java bad
class DemSet<E> extends HashSet<E> {
    int soLanThem = 0;
    @Override public boolean add(E e) { soLanThem++; return super.add(e); }
    @Override public boolean addAll(Collection<? extends E> c) { soLanThem += c.size(); return super.addAll(c); }
}
ds.addAll(List.of("a", "b", "c"));
ds.soLanThem;   // 6 — HashSet.addAll bên trong gọi add() đã bị override
```

```java good
class DemSet<E> {                           // composition: bọc, không kế thừa
    private final Set<E> inner = new HashSet<>();
    int soLanThem = 0;
    boolean add(E e) { soLanThem++; return inner.add(e); }
    boolean addAll(Collection<? extends E> c) { soLanThem += c.size(); return inner.addAll(c); }
}
// soLanThem = 3
```

Lớp con phụ thuộc vào việc lớp cha **tự gọi** method nào bên trong — chi tiết có thể đổi giữa các phiên bản JDK.

## Pitfalls khác

- Gọi method có thể bị override **trong constructor**: lớp con chạy method đó khi field của nó chưa khởi tạo. Đã chạy thử: `Cha() { init(); }`, lớp con `init()` dùng `List` field → `NullPointerException`.
- Entity JPA/Hibernate: `equals` theo `id` tự sinh thì object mới (id `null`) phá vỡ `HashSet`. Dùng business key (số hợp đồng, CCCD) hoặc cách làm được tài liệu Hibernate khuyến nghị cho dự án của bạn.
- `equals` dùng `getClass() != o.getClass()` thay vì `instanceof` thì đối xứng, nhưng proxy (Hibernate, Mockito) sẽ không bằng object gốc.

:::senior Góc nhìn senior
Phần lớn class trong code nghiệp vụ nên là `record` (value object, DTO) hoặc `final class` có business key rõ ràng — khi đó `equals`/`hashCode` gần như không cần tự viết. Kế thừa chỉ nên dùng khi lớp cha **được thiết kế để kế thừa** (có tài liệu về self-use, method `protected` có chủ đích). Trong code review, thấy `extends ArrayList`/`HashMap` hay cây kế thừa 3 tầng trở lên là dấu hiệu nên chuyển sang composition.
:::

:::version Java 17 / 21 / 25
`o instanceof SanPham s && …` (pattern matching cho `instanceof`) cần Java 16+. Trên Java 8/11 phải viết `if (!(o instanceof SanPham)) return false; SanPham s = (SanPham) o;`. `Objects.hash(...)` tiện nhưng tạo mảng mỗi lần gọi; với class nóng (hot path) viết tay `31 * h + …`.
:::

:::interview Vì sao override `equals` thì phải override `hashCode`?
Các collection dựa trên hash (`HashMap`, `HashSet`) dùng `hashCode` để chọn bucket rồi mới gọi `equals` trong bucket đó. Nếu hai object `equals` nhau nhưng `hashCode` khác nhau, chúng nằm ở hai bucket, nên `contains`/`get` không tìm thấy và set có thể chứa hai phần tử "bằng nhau". Hợp đồng của `Object` yêu cầu: `a.equals(b)` ⇒ `a.hashCode() == b.hashCode()`. Chiều ngược lại không bắt buộc — trùng hash là bình thường.
:::

:::quiz `Diem` có field `x` **không final**, `equals`/`hashCode` tính theo `x`. Chạy đoạn sau, `set.contains(d)` trả gì?
```java
var set = new HashSet<Diem>();
var d = new Diem(1);
set.add(d);
d.x = 2;
set.contains(d);   // ?
```

- [ ] true
- [x] false
- [ ] Ném `ConcurrentModificationException`
- [ ] Tuỳ JVM

`d` vẫn nằm ở bucket tính theo hash cũ (x=1), còn `contains(d)` tìm ở bucket của x=2. Đã chạy thử; `remove(d)` cũng không xoá được.
:::

:::quiz `class DemSet extends HashSet` override cả `add` và `addAll` để đếm. `addAll(List.of("a","b","c"))` cho `soLanThem` bằng bao nhiêu?
- [ ] 3
- [x] 6
- [ ] 0
- [ ] 9

`HashSet.addAll` (kế thừa từ `AbstractCollection`) gọi `add` cho từng phần tử, và `add` đã bị override nên đếm thêm 3 lần. Đã chạy thử.
:::

:::quiz Chữ ký nào thực sự override `Object.equals`?
- [ ] `public boolean equals(SanPham o)`
- [x] `public boolean equals(Object o)`
- [ ] `public boolean equals(SanPham... o)`
- [ ] `public static boolean equals(Object a, Object b)`

Chỉ `equals(Object)` được collection gọi. Thêm `@Override` để compiler bắt lỗi chữ ký.
:::

:::exercise Hợp đồng bảo hiểm làm key
Class `HopDong` có `soHopDong` (người dùng có thể nhập `" bh-2026-001 "`) và `trangThai` thay đổi theo thời gian. Viết `equals`/`hashCode` sao cho: hai hợp đồng cùng số (không phân biệt hoa thường, bỏ khoảng trắng) là một; đổi trạng thái sau khi đưa vào `HashSet` vẫn tìm thấy.
???
```java
final class HopDong {
    private final String soHopDong;      // business key, chuẩn hoá một lần
    private String trangThai;            // không tham gia equals

    HopDong(String soHopDong, String trangThai) {
        this.soHopDong = soHopDong.strip().toUpperCase(Locale.ROOT);
        this.trangThai = trangThai;
    }
    void doiTrangThai(String tt) { this.trangThai = tt; }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        return o instanceof HopDong h && soHopDong.equals(h.soHopDong);
    }
    @Override public int hashCode() { return soHopDong.hashCode(); }
}
```

Đã chạy thử: thêm `new HopDong("bh-2026-001", "HIEU_LUC")`, đổi sang `"HUY"`, rồi `contains(new HopDong(" BH-2026-001 ", "?"))` → `true`, size 1. Class `final` để tránh bẫy 4. Nếu chỉ cần key thì gọn hơn nữa: `record MaHopDong(String gia) { MaHopDong { gia = gia.strip().toUpperCase(Locale.ROOT); } }`.
:::
