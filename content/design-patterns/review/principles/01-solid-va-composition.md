---
title: "SOLID và composition thay kế thừa — nhắc nhanh bằng ví dụ chạy được"
summary: "Năm nguyên tắc SOLID mỗi cái một câu và một dấu hiệu nhận ra khi bị vi phạm, kèm ví dụ kinh điển: lớp con của HashSet đếm sai số phần tử vì kế thừa, sửa bằng composition. Mọi output đã chạy trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, solid, composition, oop]
related: [design-patterns/consolidate/principles/tu-code-smell-den-refactor, design-patterns/deep-dive/principles/coupling-cohesion-va-ranh-gioi-module]
---

## TL;DR

- Pattern là **lời giải có tên** cho một vấn đề lặp lại. Nguyên tắc (SOLID, composition) là lý do vì sao lời giải đó tốt. Học nguyên tắc trước, pattern sẽ tự hiểu.
- **S**ingle Responsibility: một class chỉ có **một lý do để thay đổi**.
- **O**pen/Closed: thêm hành vi mới bằng **thêm code**, không sửa code đang chạy đúng.
- **L**iskov Substitution: lớp con dùng được ở **mọi chỗ** lớp cha được dùng mà không làm sai kết quả.
- **I**nterface Segregation: interface nhỏ, đúng nhu cầu người dùng nó.
- **D**ependency Inversion: code nghiệp vụ phụ thuộc vào **interface**, chi tiết kỹ thuật (DB, HTTP) implement interface đó.
- **Composition thay kế thừa**: "có một" thường an toàn hơn "là một".

## Ví dụ nhanh: kế thừa làm hỏng bộ đếm

Yêu cầu: một `Set` đếm tổng số lần người dùng thêm phần tử.

```java bad title="DemSet.java"
class DemSet<E> extends HashSet<E> {
    int soLanThem = 0;
    @Override public boolean add(E e) { soLanThem++; return super.add(e); }
    @Override public boolean addAll(Collection<? extends E> c) { soLanThem += c.size(); return super.addAll(c); }
}

var s = new DemSet<String>();
s.addAll(List.of("a", "b", "c"));
// kế thừa: soLanThem=6, size=3
```

Đếm ra **6** thay vì 3: bên trong, `HashSet.addAll` (kế thừa từ `AbstractCollection`) gọi lại `add` cho từng phần tử — mà `add` đã bị ghi đè. Lớp con phụ thuộc vào **chi tiết cài đặt** của lớp cha, thứ không có trong tài liệu và có thể đổi ở bản JDK sau.

```java good title="DemSetComposition.java"
class DemSetComposition<E> {
    private final Set<E> ben = new HashSet<>();     // "có một" Set, không "là một" Set
    int soLanThem = 0;
    boolean add(E e) { soLanThem++; return ben.add(e); }
    boolean addAll(Collection<? extends E> c) { boolean doi = false; for (E e : c) doi |= add(e); return doi; }
    int size() { return ben.size(); }
}
// composition: soLanThem=3, size=3
```

Đây chính là ý tưởng của **Decorator** (chủ đề Structural): bọc một object và thêm hành vi, thay vì kế thừa.

## Bảng chọn nhanh: dấu hiệu vi phạm

| Nguyên tắc | Dấu hiệu trong code | Hướng sửa |
|---|---|---|
| SRP | Class tên `...Manager`, `...Util`, 2.000 dòng, sửa báo cáo mà phải đụng code gửi email | Tách theo lý do thay đổi |
| OCP | Mỗi loại mới lại thêm một nhánh `else if` ở 5 chỗ | Strategy, map loại → xử lý, sealed + switch |
| LSP | Lớp con ném `UnsupportedOperationException`, hoặc người gọi phải `instanceof` để xử lý riêng | Tách interface, dùng composition |
| ISP | Implement interface mà nửa số method để trống | Chia interface theo vai trò |
| DIP | Service nghiệp vụ `new JdbcTemplate(...)`, gọi thẳng `HttpClient` | Nhận interface qua constructor (DI) |

## Một lỗi hay gặp: LSP ngay trong JDK

```java
List<String> ds = List.of("x");
ds.add("y");
// List.of(...).add → java.lang.UnsupportedOperationException
```

`List.of` trả về `List` nhưng không cho thêm phần tử. Hàm nhận `List<String>` rồi gọi `add` sẽ chạy tốt với `ArrayList` và nổ với `List.of`. JDK chấp nhận đánh đổi này (method "optional"), nhưng trong code nghiệp vụ của bạn, nếu lớp con không làm được việc của lớp cha thì nó **không nên** là lớp con.

:::version Java 8 / 17 / 25
SOLID không phụ thuộc phiên bản, nhưng cách viết thì có: Java 8 có lambda nên Strategy chỉ còn một dòng; Java 16 có `record` cho value object; Java 17 có `sealed` để giới hạn ai được kế thừa (kế thừa có kiểm soát); Java 21 có switch pattern matching để thay Visitor. Java 25 cho phép viết file nguồn gọn với `void main()` — các ví dụ trong môn này chạy bằng `java File.java`.
:::

:::interview Vì sao nói "ưu tiên composition hơn kế thừa"?
Kế thừa ràng buộc lớp con vào **cách cài đặt** của lớp cha (ví dụ `addAll` gọi lại `add`), phá đóng gói, và cố định quan hệ lúc biên dịch. Composition chỉ phụ thuộc **interface công khai** của object được bọc, đổi được object bên trong lúc chạy, và test dễ hơn. Kế thừa vẫn hợp lý khi có quan hệ "là một" thật, lớp cha được thiết kế để kế thừa (có tài liệu về hook method) hoặc trong một hệ class `sealed` do chính bạn kiểm soát.
:::

:::quiz Vì sao `DemSet` (kế thừa `HashSet`) đếm ra 6 khi `addAll` 3 phần tử?
- [ ] `HashSet` cho phép phần tử trùng
- [x] `HashSet.addAll` bên trong gọi `add` cho từng phần tử, mà `add` đã được ghi đè để đếm thêm
- [ ] Do `List.of` tạo 6 phần tử
- [ ] Lỗi của compiler

Đã chạy: `soLanThem=6, size=3`. Lớp con phụ thuộc chi tiết cài đặt không được công bố của lớp cha.
:::

:::quiz Service nghiệp vụ tự `new SmtpEmailSender("smtp.congty.vn")` bên trong. Vi phạm chủ yếu nguyên tắc nào?
- [ ] Liskov Substitution
- [ ] Interface Segregation
- [x] Dependency Inversion
- [ ] Open/Closed

Nghiệp vụ phụ thuộc trực tiếp vào chi tiết kỹ thuật, không thay được khi test hay khi đổi nhà cung cấp email. Sửa: nhận `EmailSender` (interface) qua constructor.
:::
