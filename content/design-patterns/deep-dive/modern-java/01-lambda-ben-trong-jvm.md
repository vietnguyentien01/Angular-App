---
title: "Lambda bên trong JVM — invokedynamic, LambdaMetafactory, khi nào lambda là cùng một object"
summary: "Strategy viết bằng lambda thực sự là gì: javap cho thấy invokedynamic và LambdaMetafactory thay cho file .class riêng, lambda không bắt biến được dùng lại còn lambda bắt biến tạo object mới mỗi lần, class lambda là hidden class, và lambda chỉ giữ this khi dùng tới nó. Đã chạy trên JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-19
tags: [design-patterns, lambda, invokedynamic, jvm, bytecode, java-25]
related: [design-patterns/review/modern-java/pattern-voi-lambda-record-sealed, java/deep-dive/functional/ben-trong-stream-parallel-va-gatherers]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

- Lớp vô danh (`new IntUnaryOperator() {...}`) sinh ra file `L$1.class` lúc biên dịch. Lambda **không** sinh file: thân lambda thành method `private static lambda$...` trong chính class đó, và tại chỗ dùng là lệnh **`invokedynamic`**.
- Lần đầu chạy tới `invokedynamic`, JVM gọi **`LambdaMetafactory.metafactory`** để tạo một **hidden class** (`L$$Lambda/0x...`) implement interface, rồi gắn kết quả vào call site.
- Lambda **không bắt biến** (không dùng biến bên ngoài): trên JDK 25 trả về **cùng một object** mỗi lần. Lambda **bắt biến**: object mới mỗi lần (mang theo giá trị bắt được). Đặc tả không hứa hẹn điều nào — đừng dựa vào `==`.
- Lambda chỉ giữ tham chiếu `this` khi thân lambda dùng tới field/method của object — quan trọng khi lambda làm listener sống lâu.
- Hệ quả cho pattern: Strategy/Command bằng lambda rẻ gần như class viết tay; chi phí khởi tạo nằm ở **lần gọi đầu** của mỗi call site.

## Cơ chế: bytecode của một lambda

```java title="L.java"
public class L {
    static IntUnaryOperator khongBat() { return x -> x * 2; }
    static IntUnaryOperator coBat(int heSo) { return x -> x * heSo; }
    static IntUnaryOperator lopVoDanh() {
        return new IntUnaryOperator() { public int applyAsInt(int x) { return x * 3; } };
    }
}
```

```text
$ javac -d out L.java && ls out
L$1.class
L.class                      ← không có file nào cho hai lambda
```

```text
$ javap -c -p -cp out L
  static java.util.function.IntUnaryOperator khongBat();
    Code:
         0: invokedynamic #7,  0     // InvokeDynamic #0:applyAsInt:()Ljava/util/function/IntUnaryOperator;
         5: areturn

  static java.util.function.IntUnaryOperator coBat(int);
    Code:
         0: iload_0                  // đẩy heSo lên stack: giá trị bị bắt
         1: invokedynamic #11,  0    // InvokeDynamic #1:applyAsInt:(I)Ljava/util/function/IntUnaryOperator;
         6: areturn

  private static int lambda$coBat$0(int, int);     // thân lambda: (heSo, x)
```

```text
$ javap -v -cp out L   (phần BootstrapMethods)
BootstrapMethods:
  0: #135 REF_invokeStatic java/lang/invoke/LambdaMetafactory.metafactory:(...)Ljava/lang/invoke/CallSite;
    Method arguments:
      #112 (I)I
      #113 REF_invokeStatic L.lambda$khongBat$0:(I)I
```

Đọc ra: kiểu "nhà máy" của `khongBat` là `()IntUnaryOperator` (không nhận gì), của `coBat` là `(I)IntUnaryOperator` (nhận `heSo`). `invokedynamic` là một **Factory** do JVM dựng lúc chạy: lần đầu gọi bootstrap method để sinh class, các lần sau đi thẳng.

## Demo: object, class và stack trace

```text
không bắt biến, cùng object? true
bắt biến, cùng object? false
lớp vô danh, cùng object? false
class lambda: L$$Lambda/0x0000000027040210
class vô danh: L$1
lambda là synthetic? true, hidden? true
L.lambda$main$0(L.java:16)                 ← dòng đầu stack trace khi lambda ném exception
```

- Không bắt biến → call site trả một instance duy nhất (giống một Singleton Strategy). Bắt biến → mỗi lần một object mang `heSo`.
- Class lambda là **hidden class** (Java 15, JEP 371): không tìm được bằng `Class.forName`, có thể được thu hồi khi không còn dùng. Tên có địa chỉ, đổi mỗi lần chạy — đừng log hay so sánh tên class lambda.
- Stack trace chỉ tới `lambda$main$0` và **đúng số dòng** trong file nguồn — đặt tên method rõ ràng (method reference `this::kiemTraHanMuc`) giúp stack trace dễ đọc hơn.

## Lambda giữ gì trong bộ nhớ

```java title="T.java — object có mảng 50 MB"
public class T {
    byte[] duLieuLon = new byte[50_000_000];
    Runnable lambda()         { return () -> System.out.println("chào"); }
    Runnable lambdaDungThis() { return () -> System.out.println(duLieuLon.length); }
    Runnable voDanh()         { return new Runnable() { public void run() { System.out.println("chào"); } }; }
}
```

Liệt kê field của object lambda/lớp vô danh bằng reflection:

```text
lambda không dùng this, field: []
lambda dùng field, field: [T]
lớp vô danh, field: []
```

Lambda dùng `duLieuLon` giữ tham chiếu tới **cả object `T`** — đăng ký nó làm listener của một bus sống suốt đời ứng dụng là giữ luôn mảng 50 MB. Muốn chỉ giữ thứ cần, chép ra biến cục bộ trước: `int dai = duLieuLon.length; return () -> System.out.println(dai);`.

Lớp vô danh ở đây không có field nào vì javac trên các bản JDK gần đây bỏ tham chiếu tới object bao ngoài khi lớp vô danh không dùng nó (đã kiểm tra trên JDK 25). Với JDK cũ, lớp vô danh trong method instance **luôn** giữ `this` của object bao ngoài — một nguồn rò rỉ bộ nhớ kinh điển của listener trong code Android/Swing.

## So sánh phương án cài đặt Strategy

| Cách | File `.class` lúc build | Object mỗi lần lấy | Giữ `this` | Đọc stack trace |
|---|---|---|---|---|
| Lambda không bắt biến | Không | Dùng lại (JDK 25) | Không | `lambda$tenMethod$0` |
| Lambda bắt biến/field | Không | Mới | Có, nếu dùng field | như trên |
| Method reference `this::kiemTra` | Không | Mới | Có | Tên method thật |
| Lớp vô danh | `X$1.class` | Mới | Tuỳ phiên bản javac/dùng hay không | `X$1.applyAsInt` |
| Class có tên / enum | Có | Tự quyết (thường singleton) | Không | Tên class rõ ràng |

Với Strategy là **khái niệm nghiệp vụ** (biểu phí, chính sách duyệt), class/enum có tên vẫn dễ debug và inject hơn. Lambda hợp cho strategy nhỏ, cục bộ.

## Tính năng mới theo phiên bản

- **Java 7**: `invokedynamic` (JSR 292) — ban đầu cho ngôn ngữ động trên JVM.
- **Java 8**: lambda dùng `invokedynamic` + `LambdaMetafactory`.
- **Java 9**: nối chuỗi `+` cũng dùng `invokedynamic` (`StringConcatFactory`, JEP 280).
- **Java 15**: hidden class (JEP 371); lambda chuyển sang dùng hidden class.
- **Java 21**: switch pattern matching dùng `invokedynamic` (`SwitchBootstraps`) — `javap` một switch trên sealed type sẽ thấy `typeSwitch`.

:::senior Góc nhìn senior
Chi phí của lambda không nằm ở lời gọi (JIT inline được như method thường) mà ở **lần chạy đầu** của mỗi call site: sinh hidden class, liên kết. Ứng dụng có hàng nghìn lambda (Spring, stream khắp nơi) tốn một phần thời gian khởi động cho việc này — một lý do AOT cache của JDK 24+ (môn Spring Boot, bài *Đóng gói Docker và khởi động nhanh*) giúp khởi động nhanh hơn. Trong code nghiệp vụ, đừng tối ưu sớm bằng cách tránh lambda; hãy tránh lambda **giữ object lớn** sống lâu.
:::

:::quiz Lambda trong method dưới đây (bắt tham số `heSo`) được `javac` biên dịch thành gì?
```java
public class L {
    static IntUnaryOperator coBat(int heSo) { return x -> x * heSo; }
}
```

- [ ] Một file `.class` riêng như lớp vô danh
- [x] Một method `private static lambda$coBat$0(int, int)` trong class chứa nó, và `invokedynamic` tại chỗ tạo lambda
- [ ] Một field `static` kiểu `IntUnaryOperator`
- [ ] Code nội tuyến, không có method nào

Đã xem bằng `javap -c -p`: `heSo` được đẩy lên stack trước `invokedynamic` và trở thành tham số đầu của `lambda$coBat$0`.
:::

:::exercise Listener làm rò rỉ bộ nhớ
Một màn hình báo cáo `BaoCaoView` (giữ 200 MB dữ liệu bảng) đăng ký `bus.dangKy(e -> capNhatTieuDe(e))` vào một event bus toàn cục. Đóng màn hình xong, heap không giảm. Giải thích và đưa ra hai cách sửa.
???
`capNhatTieuDe` là method instance, nên lambda bắt `this` (`BaoCaoView`). Bus toàn cục sống suốt đời ứng dụng giữ lambda → giữ `BaoCaoView` → giữ 200 MB. Giống trường hợp `lambda dùng field, field: [T]` ở trên.

Sửa:

1. **Huỷ đăng ký** khi đóng màn hình: `dangKy` trả về một handle (`AutoCloseable`/`Subscription`), gọi `close()` trong vòng đời đóng (giống `takeUntilDestroyed` của Angular, `@PreDestroy` của Spring).
2. **Không bắt object lớn**: chỉ bắt thứ cần (một tham chiếu nhỏ tới phần tiêu đề), hoặc để bus giữ listener bằng `WeakReference` (khó đúng — listener có thể bị thu hồi khi vẫn cần; chỉ dùng khi hiểu rõ).

Cách 1 là cách đúng trong hầu hết trường hợp: vòng đời của listener phải ngắn hơn hoặc bằng vòng đời của thứ nó phụ thuộc. Kiểm chứng bằng heap histogram trước/sau khi đóng màn hình (môn Java, bài *Chẩn đoán memory leak*).
:::
