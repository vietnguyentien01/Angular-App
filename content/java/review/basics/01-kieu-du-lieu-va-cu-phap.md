---
title: "Kiểu dữ liệu và cú pháp Java — primitive, wrapper, String, switch expression"
summary: "Nhắc nhanh 8 kiểu primitive và wrapper, vì sao == trên Integer và String là bẫy, phép chia và tràn số, var, switch expression, text block, chương trình đầu tiên trên Java 21 và bản rút gọn của Java 25. Mọi output đã chạy trên JDK 21."
type: card
level: core
version: 21
lastReviewed: 2026-11-18
tags: [java, basics, primitive, string, switch]
related: [java/consolidate/basics/tinh-tien-voi-bigdecimal, java/deep-dive/basics/ben-trong-string-va-boxing]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS; chương trình đầu tiên viết theo Java 21, bản rút gọn của Java 25 chuyển vào ghi chú phiên bản."
---

## Tóm tắt nhanh

- 8 **primitive**: `byte short int long float double char boolean`. Mỗi kiểu có **wrapper** (`Integer`, `Long`…) là object, có thể `null`.
- `==` so sánh **giá trị** với primitive, nhưng so sánh **tham chiếu** với object. So sánh nội dung `String`, `Integer`, `BigDecimal` → dùng `equals` (với `BigDecimal` xem bài *Tính tiền*).
- `int / int` là **chia nguyên**; `int` tràn số **lặng lẽ** (không báo lỗi). Cần báo lỗi thì dùng `Math.addExact`.
- `double` không biểu diễn chính xác `0.1` → **không dùng cho tiền**.

## Chương trình đầu tiên (Java 21)

Khóa học lấy **Java 21 LTS** làm mốc vì đây là bản phổ biến nhất trong dự án enterprise hiện nay. Trên Java 21, chương trình cần một `public class` có method `public static void main(String[] args)`:

```java title="Hello.java"
import java.util.Scanner;

public class Hello {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Tên bạn: ");
        String ten = sc.nextLine();
        System.out.println("Xin chào, " + ten + "!");
    }
}
```

```bash
java Hello.java      # chạy thẳng file nguồn, không cần javac (có từ Java 11)
```

## Ví dụ nhanh (đã chạy trên JDK 21)

```java
Integer a = 127, b = 127, c = 128, d = 128;
a == b;          // true  — Integer từ -128 tới 127 được cache
c == d;          // false — hai object khác nhau
c.equals(d);     // true

String s1 = "java", s3 = new String("java");
s1 == s3;        // false
s1.equals(s3);   // true

7 / 2;           // 3      7 / 2.0 → 3.5
-7 % 3;          // -1     Math.floorMod(-7, 3) → 2
Integer.MAX_VALUE + 1;          // -2147483648 (tràn số, không báo lỗi)
Math.addExact(Integer.MAX_VALUE, 1);  // ArithmeticException: integer overflow
0.1 + 0.2;       // 0.30000000000000004
1 + 2 + "3" + 4 + 5;  // "3345" — cộng số trước, gặp String thì nối chuỗi
'a' + 1;         // 98 (char được nâng lên int)
```

```java title="switch expression và text block"
String kind = switch (day) {
    case 1, 2, 3, 4, 5 -> "ngày làm việc";
    case 6, 7 -> {
        String t = "cuối tuần";
        yield t.toUpperCase();      // khối {} trả giá trị bằng yield
    }
    default -> throw new IllegalArgumentException("day=" + day);
};

var list = new ArrayList<String>();   // var: kiểu suy ra từ vế phải, vẫn là static typing

String json = """
    {
      "ten": "Nguyễn An",
      "tuoi": 30
    }
    """;                            // text block: giữ xuống dòng, tự bỏ thụt lề chung
```

## Bảng chọn nhanh

| Muốn | Dùng |
|---|---|
| Số nguyên thông thường | `int`; vượt ~2,1 tỷ → `long` (`3_000_000_000L`) |
| Tiền tệ, số cần chính xác | `BigDecimal` (tạo từ `String`), hoặc `long` đơn vị nhỏ nhất |
| Giá trị có thể "không có" | wrapper (`Integer`) hoặc `Optional` — nhớ kiểm tra `null` |
| So sánh nội dung object | `equals`; an toàn với `null`: `Objects.equals(a, b)` |
| Nối chuỗi trong vòng lặp | `StringBuilder` |
| Định dạng chuỗi | `"Đơn %d: %s".formatted(id, ten)` |
| Rẽ nhánh trả về giá trị | `switch` expression với `->` (không cần `break`) |

## Lỗi hay gặp: unboxing `null`

```java bad
Integer soLuong = null;               // vd đọc từ DB, cột cho phép NULL
int tong = soLuong + 1;               // NullPointerException
Integer v = flag ? soLuong : 0;       // NPE! kiểu của biểu thức là int → unbox soLuong
```

```java good
int tong = (soLuong == null ? 0 : soLuong) + 1;
int v = Objects.requireNonNullElse(soLuong, 0);
```

Đã chạy thử: dòng `flag ? soLuong : 0` ném `NullPointerException: Cannot invoke "java.lang.Integer.intValue()"…`. Thông báo NPE chi tiết như vậy có từ Java 14 (helpful NullPointerException).

:::version Java 17 / 21 / 25
- `var`: Java 10. Switch expression `->`: Java 14. Text block: Java 15. Dự án Java 17 dùng được tất cả.
- `java Hello.java` chạy thẳng file nguồn: Java 11.
- **Khi nâng lên Java 25**: một file chỉ cần `void main() { … }`, không cần `public class`, `static`, `String[] args`; lớp `IO` có sẵn `IO.println` và `IO.readln("Tên bạn: ")` (JEP 512). Trên Java 21 cách viết này báo lỗi biên dịch *implicitly declared classes are not supported*. Dự án Maven/Spring vẫn viết class đầy đủ như trên.
:::

:::interview Vì sao `Integer a = 127, b = 127; a == b` là true nhưng với 128 lại false?
Autoboxing gọi `Integer.valueOf`, method này trả object **có sẵn trong cache** cho giá trị từ -128 tới 127 (cận trên chỉnh được bằng `-XX:AutoBoxCacheMax`). Ngoài khoảng đó mỗi lần boxing tạo object mới, nên `==` (so sánh tham chiếu) trả false. Bài học: không bao giờ dùng `==` để so sánh wrapper — dùng `equals` hoặc unbox về primitive.
:::

:::quiz `System.out.println(1 + 2 + "3" + 4 + 5);` in ra gì?
- [ ] 15
- [ ] 12345
- [x] 3345
- [ ] 339

Toán tử `+` chạy từ trái sang phải: `1 + 2 = 3` (số), `3 + "3" = "33"` (chuỗi), sau đó mọi phép `+` đều là nối chuỗi. Đã chạy thử.
:::

:::quiz Đoạn nào ném `NullPointerException`? (`Integer n = null; boolean flag = true;`)
- [x] `Integer v = flag ? n : 0;`
- [ ] `Integer v = flag ? null : 0;`
- [x] `int m = n;`
- [ ] `Integer v = n;`

Đã chạy thử. Trong `flag ? n : 0` một vế là `Integer`, vế kia là `int` → kiểu kết quả là `int`, nên `n` bị unbox. Với `flag ? null : 0`, vế `null` không có kiểu primitive nên kết quả là `Integer`, in ra `null`.
:::

:::quiz `int x = 10; x += 5.7;` — kết quả?
- [ ] Lỗi biên dịch vì mất độ chính xác
- [x] `x = 15` — toán tử gộp `+=` tự ép kiểu về `int`
- [ ] `x = 16`
- [ ] `x = 15.7`

`x += 5.7` tương đương `x = (int) (x + 5.7)`, cắt phần thập phân. Viết `x = x + 5.7` thì mới báo lỗi biên dịch. Đã chạy thử.
:::
