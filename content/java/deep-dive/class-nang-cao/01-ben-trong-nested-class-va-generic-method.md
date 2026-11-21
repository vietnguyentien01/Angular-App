---
title: "Bên trong nested class và generic method — nestmates, bridge method, lambda so với anonymous class, self-type"
summary: "Xem bằng javap: nestmates (Java 11) thay cho access$000, bridge method do type erasure, lambda qua invokedynamic thành hidden class còn anonymous class là file .class riêng; suy luận kiểu, var với anonymous class và builder kế thừa bằng self-type. Chạy trên JDK 21."
level: advanced
version: 21
lastReviewed: 2026-11-21
tags: [java, nested-class, generics, bytecode, lambda, internals]
related: [java/consolidate/class-nang-cao/bay-cua-inner-class-va-generic, java/deep-dive/collections/ben-trong-hashmap-va-generics]
---

## Tóm tắt nhanh

- JVM không biết "nested class": mỗi nested class là **một file `.class` riêng** (`Ngoai$Trong.class`). javac nối chúng lại bằng thuộc tính `NestHost`/`NestMembers` (Java 11, JEP 181) để inner class đọc được `private` của class ngoài.
- Type erasure buộc javac sinh **bridge method**: class cài `Kho<String>` có cả `luu(String)` lẫn `luu(Object)` (cờ `ACC_BRIDGE`). Lời gọi raw type sai kiểu nổ `ClassCastException` ngay trong bridge.
- **Anonymous class** = một file `.class` lúc biên dịch. **Lambda** = một method `private static lambda$main$0` + `invokedynamic`; lúc chạy JVM tạo một **hidden class**. Ít file hơn, khởi động nhẹ hơn khi có hàng nghìn lambda.
- Generic method được **suy luận kiểu** từ tham số và từ kiểu đích. Khi cần, ghi rõ: `Collections.<Integer>emptyList()`.
- Builder kế thừa được nhờ **self-type**: `Builder<B extends Builder<B>>` — cùng kỹ thuật với `Enum<E extends Enum<E>>` và `Comparable<T>`.

## Nestmates: đọc `private` mà không cần method trung gian

```java
class Ngoai { private int bimat = 42; class Trong { int doc() { return bimat; } } }
```

Cùng một file, biên dịch hai cách bằng javac 21:

```text
$ javac --release 8 … && javap -p Ngoai          $ javac … (release 21) && javap -p Ngoai
class Ngoai {                                      class Ngoai {
  private int bimat;                                 private int bimat;
  Ngoai();                                           Ngoai();
  static int access$000(Ngoai);   ← cửa sau        }
}
```

Trước Java 11, JVM coi `Ngoai` và `Ngoai$Trong` là hai class không liên quan, nên javac phải sinh method `static access$000` (package-private) để `Trong` đọc `bimat` — vừa thêm method thừa, vừa mở một "cửa sau" cho mọi class cùng package. Từ Java 11, `javap -v Ngoai` cho thấy:

```text
NestMembers:
  Ngoai$Trong
```

JVM cho phép các class trong cùng một *nest* đọc `private` của nhau trực tiếp. Reflection cũng theo quy tắc mới: `Ngoai.Trong.class.getNestHost()` trả về class ngoài cùng (đã chạy: với class `Br.Ngoai.Trong`, nest host là `Br`).

## Inner class giữ object ngoài thế nào

```text
$ javap -p 'Br$Ngoai$Trong'      (đọc field bimat của Ngoai)
final Br$Ngoai Br$Ngoai$Trong.this$0
```

Constructor `Trong(Ngoai)` nhận object ngoài làm tham số đầu tiên — `ngoai.new Trong()` chỉ là cú pháp cho `new Trong(ngoai)`. Từ javac 18 (`--release` ≥ 18), field `this$0` bị bỏ khi inner class không dùng tới object ngoài, nhưng tham số constructor vẫn giữ để không phá tương thích nhị phân (bài *Bẫy của inner class* có số đo bộ nhớ).

## Bridge method

```java
interface Kho<T> { void luu(T x); }
static class KhoChuoi implements Kho<String> {
    public void luu(String s) { System.out.println("lưu " + s.length()); }
}
```

Sau type erasure, interface chỉ còn `luu(Object)`. Để `KhoChuoi` vẫn cài đúng interface, javac sinh thêm:

```text
$ javap -v -p 'Br$KhoChuoi'
public void luu(java.lang.Object);
  flags: (0x1041) ACC_PUBLIC, ACC_BRIDGE, ACC_SYNTHETIC
     2: checkcast     #14   // class java/lang/String
     5: invokevirtual #29   // Method luu:(Ljava/lang/String;)V
```

Gọi qua raw type với sai kiểu:

```java
Kho raw = new KhoChuoi();
raw.luu(123);
// ClassCastException: class java.lang.Integer cannot be cast to class java.lang.String …
```

Exception nổ ở lệnh `checkcast` trong bridge — stack trace có một dòng `KhoChuoi.luu` mà bạn không viết. Gặp dòng như vậy trong log, nghĩ ngay tới raw type hoặc heap pollution. Bridge method cũng xuất hiện khi lớp con override với **kiểu trả về hẹp hơn** (covariant return), vd `Object clone()` → `KhachHang clone()`.

Reflection thấy cả hai method: `getDeclaredMethods()` trả về `luu(String)` và `luu(Object)`; lọc bằng `Method.isBridge()` khi viết framework.

## Lambda so với anonymous class

```java
Runnable r1 = new Runnable() { public void run() {} };
Runnable r2 = new Runnable() { public void run() {} };
Runnable l1 = () -> {};
Runnable l2 = () -> {};
```

```text
$ ls *.class                        $ javap -c -p Lm
Lm$1.class   ← r1                     0: new           #7    // class Lm$1
Lm$2.class   ← r2                     8: new           #10   // class Lm$2
Lm.class                             16: invokedynamic #13   // InvokeDynamic #0:run:()Ljava/lang/Runnable;
                                     22: invokedynamic #17   // InvokeDynamic #1:run:()Ljava/lang/Runnable;
                                     private static void lambda$main$0();
                                     private static void lambda$main$1();
```

Lúc chạy:

```text
r1.getClass() → Lm$1
l1.getClass() → Lm$$Lambda/0x00007f6bb4000400   hidden=true
```

- Thân lambda thành một method `private` của chính class đó. Lần đầu chạy tới `invokedynamic`, `LambdaMetafactory` tạo một **hidden class** (Java 15, JEP 371) cài interface và gọi method đó. Những lần sau dùng lại kết quả đã liên kết.
- Lambda không bắt biến nào → JVM dùng lại **một object duy nhất** cho mọi lần chạy qua dòng đó. Anonymous class luôn `new` object mới.
- Tên hidden class thay đổi mỗi lần chạy và không tải lại được bằng `Class.forName` — đừng dựa vào `getClass().getName()` của lambda (vd làm key cache, ghi log so sánh).
- Method reference (`String::compareTo`) cũng đi qua `invokedynamic`, không sinh method `lambda$…` nếu trỏ thẳng được tới method có sẵn.

## Suy luận kiểu của generic method

```java
var ds = new ArrayList<>();          // ArrayList<Object> — diamond không có gì để suy luận
ds.add("x"); ds.add(1);              // [x, 1] — mọi thứ đều lọt vào
List<String> rong = Collections.emptyList();    // T = String, suy từ kiểu đích
Collections.<Integer>emptyList();               // ghi rõ khi không có kiểu đích (vd truyền vào method overload)
```

`var` + diamond rỗng là bẫy: `var ds = new ArrayList<>()` cho `ArrayList<Object>`. Với `var`, luôn ghi kiểu phần tử: `var ds = new ArrayList<String>()`.

Một trường hợp `var` có ích thật — giữ kiểu của anonymous class để đọc field riêng của nó (Java 10+):

```java
var cmp = new Comparator<String>() {
    int dem;
    public int compare(String x, String y) { dem++; return x.compareTo(y); }
};
new ArrayList<>(List.of("c", "a", "b")).sort(cmp);
cmp.dem;   // 4 — đã chạy trên JDK 21; khai báo Comparator<String> cmp thì không đọc được dem
```

## Self-type: builder kế thừa được

```java bad
class Builder { String ten; Builder ten(String t) { ten = t; return this; } }
class NvBuilder extends Builder { NvBuilder phong(String p) { … } }
new NvBuilder().ten("An").phong("IT");   // lỗi: ten() trả Builder, Builder không có phong()
```

```java good
abstract class Builder<B extends Builder<B>> {
    String ten;
    @SuppressWarnings("unchecked") B ten(String t) { ten = t; return (B) this; }
}
class NvBuilder extends Builder<NvBuilder> {
    String phong;
    NvBuilder phong(String p) { phong = p; return this; }
    String build() { return ten + "/" + phong; }
}
new NvBuilder().ten("An").phong("IT").build();   // "An/IT" — đã chạy trên JDK 21
```

`B extends Builder<B>` nghĩa là "B là một builder của chính nó". `java.lang.Enum<E extends Enum<E>>` dùng đúng mẹo này để `compareTo` chỉ nhận enum cùng loại. Ép kiểu `(B) this` là unchecked nhưng an toàn nếu mọi lớp con khai báo đúng `extends Builder<ChinhNo>`; các thư viện như Lombok `@SuperBuilder` sinh sẵn mẫu này.

## So sánh phương án

| Cần | Chọn | Vì sao |
|---|---|---|
| Interface một method | Lambda / method reference | Không thêm file `.class`, không bắt `this` nếu không dùng |
| Callback cần state riêng (bộ đếm, cache) | Static nested class có field | Rõ ràng, test được, không giữ object ngoài |
| Đọc state của object ngoài | Inner class | Đúng mục đích, nhưng để ý vòng đời |
| Builder cho cây class | Self-type `B extends Builder<B>` hoặc Lombok `@SuperBuilder` | Chuỗi gọi giữ đúng kiểu con |
| Framework duyệt method bằng reflection | Bỏ qua `isBridge()` và `isSynthetic()` | Tránh xử lý trùng |

## Tính năng mới theo phiên bản

- **Java 5**: generics, bridge method. **Java 8**: lambda qua `invokedynamic`.
- **Java 10**: `var` (giữ được kiểu anonymous class). **Java 11**: nestmates (JEP 181).
- **Java 15**: hidden class (JEP 371) thay cho `Unsafe.defineAnonymousClass` trong `LambdaMetafactory`. **Java 16**: inner class khai báo được thành viên `static`.
- **Java 18**: javac bỏ `this$0` không dùng (JDK-8271623) khi `--release` ≥ 18.
- **Java 21**: không thay đổi gì ở phần này; bản 21 có đủ mọi tính năng trong bài.

:::senior Góc nhìn senior
Biết bytecode giúp đọc đúng stack trace và heap dump: dòng `access$000` hay `lambda$main$0` trong stack trace, một `KhoChuoi.luu(Object)` bạn không viết, hay hàng nghìn object `Ngoai$1` giữ `this$0` trong heap dump đều chỉ thẳng về cấu trúc code. Khi viết thư viện hoặc framework nội bộ dùng reflection, luôn lọc bridge/synthetic method và không dựa vào tên class của lambda — đó là chi tiết cài đặt, đổi theo phiên bản JDK.
:::

:::quiz Class `KhoChuoi implements Kho<String>` chỉ viết `luu(String)`. `getDeclaredMethods()` của nó trả về những method `luu` nào?
- [ ] Chỉ `luu(String)`
- [x] `luu(String)` và `luu(Object)` — cái sau là bridge method
- [ ] Chỉ `luu(Object)` vì type erasure
- [ ] Không có method nào vì `luu` thuộc interface

Đã xem bằng `javap -v`: `luu(Object)` có cờ `ACC_BRIDGE, ACC_SYNTHETIC`, bên trong `checkcast String` rồi gọi `luu(String)`.
:::

:::quiz Hai lambda `() -> {}` và hai anonymous class `new Runnable() {…}` trong `main` của class `Lm`. Biên dịch xong có những file `.class` nào?
- [ ] `Lm.class`, `Lm$1.class`, `Lm$2.class`, `Lm$3.class`, `Lm$4.class`
- [x] `Lm.class`, `Lm$1.class`, `Lm$2.class`
- [ ] Chỉ `Lm.class`
- [ ] `Lm.class` và `Lm$Lambda.class`

Anonymous class sinh file riêng; lambda thành method `private static lambda$main$0` trong `Lm.class`, class cài interface được tạo lúc chạy (hidden class). Đã chạy thử.
:::

:::exercise Builder có kế thừa
Có `class TaiKhoan { String so; }` và `class TaiKhoanTietKiem extends TaiKhoan { double laiSuat; }`. Viết builder cho cả hai sao cho `TaiKhoanTietKiem.builder().so("001").laiSuat(0.05).build()` biên dịch được (gọi `so` trước `laiSuat`).
???
```java
abstract static class TkBuilder<B extends TkBuilder<B>> {
    String so;
    @SuppressWarnings("unchecked") B so(String s) { so = s; return (B) this; }
}
static final class TietKiemBuilder extends TkBuilder<TietKiemBuilder> {
    double laiSuat;
    TietKiemBuilder laiSuat(double l) { laiSuat = l; return this; }
    TaiKhoanTietKiem build() {
        var t = new TaiKhoanTietKiem();
        t.so = so; t.laiSuat = laiSuat;
        return t;
    }
}
// trong TaiKhoanTietKiem: static TietKiemBuilder builder() { return new TietKiemBuilder(); }
```

`so(...)` trả về `B` = `TietKiemBuilder`, nên gọi tiếp `laiSuat(...)` được. Builder là `static` nested class: không cần object `TaiKhoan` có sẵn để tạo builder. Trong dự án dùng Lombok, `@SuperBuilder` trên cả hai class sinh ra đúng cấu trúc này.
:::
