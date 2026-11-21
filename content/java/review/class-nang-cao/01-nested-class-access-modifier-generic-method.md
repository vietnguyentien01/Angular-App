---
title: "Nested class, access modifier và generic method — những thứ viết hằng ngày nhưng hay nhầm"
summary: "Nhắc nhanh bốn loại nested class (static, inner, local, anonymous) và khi nào dùng loại nào, bảng bốn mức truy cập private/package-private/protected/public, generic method với bounded type và wildcard theo quy tắc PECS. Mọi output đã chạy trên JDK 21."
type: card
level: core
version: 21
lastReviewed: 2026-11-21
tags: [java, nested-class, access-modifier, generics]
related: [java/consolidate/class-nang-cao/bay-cua-inner-class-va-generic, java/deep-dive/class-nang-cao/ben-trong-nested-class-va-generic-method]
---

## Tóm tắt nhanh

- **Nested class** có bốn loại: `static` nested (không gắn với object ngoài), **inner** (gắn với một object ngoài, đọc được field của nó), **local** (khai báo trong method), **anonymous** (không tên, tạo ngay tại chỗ).
- Mặc định chọn **`static` nested class**. Chỉ dùng inner khi thật sự cần đọc state của object ngoài.
- Bốn mức truy cập, từ hẹp tới rộng: `private` → *package-private* (không ghi gì) → `protected` → `public`.
- **Generic method** khai báo kiểu riêng trước kiểu trả về: `static <T> void hoanDoi(T[] a, int i, int j)`. Giới hạn kiểu bằng `<T extends Comparable<? super T>>`.
- Wildcard theo **PECS**: tham số chỉ đọc ra dùng `? extends T` (Producer Extends), tham số chỉ ghi vào dùng `? super T` (Consumer Super).

## Ví dụ nhanh (đã chạy trên JDK 21)

```java title="Bốn loại nested class"
public class DonHang {
    private int soDu = 100;

    static class Builder { … }                          // 1. static nested: new DonHang.Builder()

    class GiaoDich {                                    // 2. inner: cần một DonHang có sẵn
        int tru(int x) { soDu -= x; return soDu; }       //    đọc/ghi field của object ngoài
    }

    void loc(List<Integer> gia) {
        int nguong = 5;                                  // effectively final
        class LocGia implements Predicate<Integer> {     // 3. local class
            public boolean test(Integer x) { return x > nguong; }
        }
        gia.stream().filter(new LocGia()).toList();      // [6, 9] với gia = [3, 6, 9]

        Runnable r = new Runnable() {                    // 4. anonymous class
            public void run() { System.out.println(this.getClass().getName()); }   // DonHang$1
        };
        Runnable l = () -> System.out.println(this.getClass().getName());          // DonHang — lambda không tạo "this" mới
    }
}

var don = new DonHang();
DonHang.GiaoDich g = don.new GiaoDich();   // cú pháp tạo inner class
g.tru(30);                                 // 70
```

```java title="Generic method"
static <T extends Comparable<? super T>> T lonNhat(List<? extends T> ds) {
    T max = ds.get(0);
    for (T x : ds) if (x.compareTo(max) > 0) max = x;
    return max;
}
lonNhat(List.of(3, 9, 2));                  // 9
lonNhat(List.of("táo", "chuối", "xoài"));   // "xoài" — so theo mã Unicode

static double tong(Collection<? extends Number> ds) { … }   // đọc ra Number
tong(List.of(1, 2.5, 3L));                                  // 6.5

static void themSo(List<? super Integer> dich) { dich.add(1); dich.add(2); }   // ghi vào
themSo(new ArrayList<Number>());   // [1, 2]
themSo(new ArrayList<Object>());   // [1, 2]
```

## Bảng chọn nhanh

| Mức truy cập | Cùng class | Cùng package | Lớp con ở package khác | Mọi nơi |
|---|---|---|---|---|
| `private` | ✓ | | | |
| *(không ghi)* package-private | ✓ | ✓ | | |
| `protected` | ✓ | ✓ | ✓ (chỉ qua kế thừa) | |
| `public` | ✓ | ✓ | ✓ | ✓ |

| Cần | Dùng |
|---|---|
| Builder, DTO con, `Node` của cấu trúc dữ liệu | `static` nested class |
| Iterator đọc state của collection ngoài | inner class |
| Logic một lần trong method, cần đặt tên cho dễ đọc | local class (hoặc private method) |
| Interface một method | **lambda** — không dùng anonymous class |
| Interface nhiều method, cài đặt một lần (listener cũ của Swing) | anonymous class |
| Method chạy được với nhiều kiểu | generic method `<T>` |
| Tham số collection chỉ đọc / chỉ ghi | `? extends T` / `? super T` |

## Lỗi hay gặp: `protected` không có nghĩa là "lớp con dùng được ở mọi chỗ"

```java bad
package vn.hoc.b;
public class TietKiem extends vn.hoc.a.TaiKhoan {
    void ok()  { soDu += 1; }                  // được: truy cập qua kế thừa (this)
    void sai(TaiKhoan khac) { khac.soDu = 0; } // lỗi: soDu has protected access in TaiKhoan
    void sai2() { noiBo = 2; }                 // lỗi: noiBo is not public in TaiKhoan; cannot be accessed from outside package
}
```

Đã biên dịch thử trên JDK 21: hai lỗi đúng như comment. Ở package khác, lớp con chỉ chạm được thành viên `protected` của **chính nó** (hoặc object kiểu của nó), không chạm được của một object `TaiKhoan` bất kỳ. Thành viên không ghi mức truy cập (package-private) thì lớp con ở package khác không thấy.

:::version 21 Java 8 / 11 / 21
- Lambda thay cho anonymous class một method: Java 8. Local/anonymous class đọc được biến local *effectively final* (không cần ghi `final`): Java 8.
- **Nestmates** (Java 11): inner class đọc `private` của class ngoài trực tiếp, không cần method trung gian `access$000` mà javac sinh ra ở Java 8 — xem bài chuyên sâu.
- `record`, `enum`, `interface` lồng bên trong class luôn là `static` (ngầm định). Từ Java 16, inner class được khai báo thành viên `static` và local record/enum/interface.
:::

:::interview Static nested class và inner class khác nhau thế nào? Khi nào dùng cái nào?
Inner class (không `static`) gắn với **một instance** của class ngoài: tạo bằng `ngoai.new Trong()`, đọc được field và method của instance đó, và thường giữ một tham chiếu ẩn `this$0` tới nó. Static nested class chỉ là một class được đặt bên trong để gom nhóm và kiểm soát truy cập — không gắn với instance nào, tạo bằng `new Ngoai.Trong()`. Mặc định nên dùng `static`: rõ ràng hơn, không giữ object ngoài trong bộ nhớ một cách vô tình (bài *Bẫy của inner class* có số đo). Chỉ dùng inner khi class con thật sự cần state của object ngoài, ví dụ iterator của một collection tự viết.
:::

:::quiz Trong một method của class `A`, `Runnable r = new Runnable() { public void run() { System.out.println(this.getClass().getName()); } };` rồi `r.run()` in ra gì?
- [ ] `A`
- [x] `A$1`
- [ ] `java.lang.Runnable`
- [ ] Lỗi biên dịch vì `this` không dùng được trong anonymous class

Trong anonymous class, `this` là chính object anonymous (class `A$1` do javac đặt tên). Lambda thì khác: `this` trong lambda là object `A` bao quanh. Đã chạy thử.
:::

:::quiz Method nào biên dịch được với lời gọi `themSo(new ArrayList<Number>())`, trong đó `themSo` gọi `dich.add(1)`? (chọn nhiều)
- [x] `static void themSo(List<? super Integer> dich)`
- [ ] `static void themSo(List<? extends Integer> dich)`
- [x] `static void themSo(List<Number> dich)`
- [ ] `static void themSo(List<Integer> dich)`

`List<? extends Integer>` không cho `add` (compiler không biết kiểu cụ thể), và không nhận `ArrayList<Number>`. `List<Integer>` cũng không nhận `ArrayList<Number>` vì generics bất biến. `? super Integer` nhận cả `List<Number>` lẫn `List<Object>`.
:::
