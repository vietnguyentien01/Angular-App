---
title: "Bên trong String và boxing — compact strings, string pool, nối chuỗi, Unicode, chi phí của Integer"
summary: "String lưu byte[] kèm coder (Latin-1 hoặc UTF-16), string pool và intern, nối chuỗi biên dịch thành invokedynamic, length() đếm UTF-16 chứ không đếm ký tự, tiếng Việt NFC/NFD, cache của Integer và cái giá bộ nhớ của boxing — đo trên JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [java, string, unicode, boxing, memory, internals]
related: [java/review/basics/kieu-du-lieu-va-cu-phap, java/deep-dive/jvm/gc-jit-va-do-hieu-nang]
---

## TL;DR

- `String` bất biến, bên trong là `byte[] value` + `byte coder`: chuỗi chỉ có ký tự Latin-1 tốn **1 byte/ký tự**, còn lại 2 byte (compact strings, Java 9).
- Literal giống nhau dùng chung một object trong **string pool**; chuỗi tạo lúc chạy thì không, trừ khi `intern()`.
- `a + b` trong code biên dịch thành **`invokedynamic makeConcatWithConstants`**. Nối trong vòng lặp vẫn chậm vì mỗi vòng tạo chuỗi mới.
- `length()` đếm **đơn vị UTF-16**: emoji tính 2. Tiếng Việt có hai cách mã hoá (NFC, NFD) — so sánh, tìm kiếm phải chuẩn hoá trước.
- `Integer[]` 5 triệu phần tử tốn ~100 MB; `int[]` tốn ~20 MB.

## Cấu trúc của String

Đã liệt kê bằng reflection trên JDK 25 — các field không static của `String`:

```text
byte[] value       // dữ liệu
byte coder         // 0 = LATIN1, 1 = UTF16
int hash           // hashCode được cache sau lần tính đầu
boolean hashIsZero // phân biệt "chưa tính" với "hash thật sự bằng 0"
```

`-XX:+PrintFlagsFinal` cho thấy `CompactStrings = true` mặc định. Một chuỗi chỉ cần **một** ký tự ngoài Latin-1 (vd `ọ`, `ế`) là cả chuỗi chuyển sang UTF-16, 2 byte/ký tự. `"Học Java"` gồm các code unit `48 1ecd 63 20 4a 61 76 61` — `ọ` là U+1ECD.

Vì bất biến, `String` an toàn để chia sẻ giữa các thread, làm key của `HashMap` (hash cache sẵn) và làm literal dùng chung.

## String pool và `intern`

```java
String s1 = "java";
s1 == "ja" + "va";        // true  — hằng số được gộp lúc biên dịch
String part = "ja";
String s4 = part + "va";  // tạo lúc chạy
s1 == s4;                 // false
s1 == s4.intern();        // true  — intern trả object trong pool
```

Pool nằm trong heap (từ Java 7) và được GC dọn. `intern()` hữu ích khi có rất nhiều chuỗi trùng (mã tỉnh, mã sản phẩm đọc từ file), nhưng G1 đã có tuỳ chọn tự gộp mảng byte trùng (`-XX:+UseStringDeduplication`) mà không cần sửa code. Đo trước khi quyết định.

## Nối chuỗi bên dưới là gì

```java
static String greet(String name, int age) { return "Xin chào " + name + ", " + age + " tuổi"; }
```

`javap -c` trên JDK 25:

```text
0: aload_0
1: iload_1
2: invokedynamic #7, 0   // InvokeDynamic #0:makeConcatWithConstants:(Ljava/lang/String;I)Ljava/lang/String;
7: areturn
```

Từ Java 9 (JEP 280), `javac` không sinh `StringBuilder` nữa mà để `StringConcatFactory` chọn chiến lược lúc chạy — nối một biểu thức `+` là nhanh, không cần tự viết `StringBuilder`.

Nhưng trong **vòng lặp**, mỗi `r += i` tạo một chuỗi mới và chép lại toàn bộ — độ phức tạp O(n²). Đo trên JDK 25 với 50.000 vòng:

```text
lần 0: += 977 ms, StringBuilder 2 ms
lần 1: += 902 ms, StringBuilder 1 ms
lần 2: += 799 ms, StringBuilder 0 ms
```

(Số đo thô bằng `System.nanoTime`, chỉ để thấy bậc độ lớn. Đo nghiêm túc thì dùng JMH — xem bài *GC, JIT và đo hiệu năng*.)

## Unicode: `length()` không phải số ký tự

```java
String emoji = "Chào 😀";
emoji.length();                         // 7 — 😀 là cặp surrogate, 2 đơn vị UTF-16
emoji.codePointCount(0, emoji.length()); // 6
new StringBuilder("ab😀").reverse();     // "😀ba" — reverse() xử lý đúng surrogate
```

Tiếng Việt còn một bẫy nữa: chữ `ệ` có thể là **một** code point (NFC) hoặc `e` + dấu mũ + dấu nặng (NFD). Dữ liệu copy từ macOS, PDF hay một số bàn phím thường là NFD.

```java
String nfc = Normalizer.normalize("Việt", Normalizer.Form.NFC);
String nfd = Normalizer.normalize("Việt", Normalizer.Form.NFD);
nfc.length();      // 4
nfd.length();      // 6
nfc.equals(nfd);   // false — nhìn giống hệt nhau trên màn hình
nfc.equals(Normalizer.normalize(nfd, Normalizer.Form.NFC));   // true
```

Tìm kiếm theo tên khách hàng, so khớp địa chỉ, kiểm tra trùng → chuẩn hoá về NFC ở biên vào hệ thống (API, import file).

Một số method phụ thuộc locale: `"i".toUpperCase(Locale.of("tr"))` cho `"İ"` (chữ I có chấm của tiếng Thổ Nhĩ Kỳ). Với mã, khoá, tên trường kỹ thuật, luôn truyền `Locale.ROOT`.

Thêm hai điều nên biết:

- `"a,b,,c,".split(",")` cho **4** phần tử (chuỗi rỗng ở cuối bị bỏ). Muốn giữ thì dùng `split(",", -1)` → 5.
- `"Aa".hashCode() == "BB".hashCode()` (đều là 2112). Hash trùng là bình thường, nên `HashMap` luôn so thêm bằng `equals`.

## Boxing tốn bao nhiêu

Đo trên JDK 25 (`-Xmx1g`), mảng 5 triệu phần tử:

```text
Integer[]: ~101 MB, int[]: ~20 MB
```

Mỗi `Integer` là một object: header + 4 byte giá trị, làm tròn lên 16 byte. Thêm 4 byte tham chiếu trong mảng (compressed oops). `int[]` chỉ 4 byte/phần tử. `List<Integer>` cũng mang chi phí như `Integer[]`. Với dữ liệu số lớn, dùng `int[]`/`long[]`, `IntStream`, hoặc thư viện collection primitive.

Cache của `Integer` (-128…127) đổi được bằng `-XX:AutoBoxCacheMax=2000`. Đã chạy thử: `Integer a = 1000, b = 1000; a == b` cho `false` mặc định và `true` với cờ này. Đây là lý do thêm để **không** dựa vào `==` với wrapper — kết quả phụ thuộc cấu hình JVM.

## So sánh phương án

| Tình huống | Chọn | Vì sao |
|---|---|---|
| Nối vài chuỗi trong một biểu thức | `+` | `invokedynamic` đã tối ưu |
| Nối trong vòng lặp | `StringBuilder` hoặc `String.join` / `Collectors.joining` | Tránh O(n²) |
| Đếm ký tự người dùng thấy | `codePointCount` (emoji ghép phức tạp còn cần `BreakIterator`) | `length()` đếm UTF-16 |
| So sánh tên tiếng Việt | Chuẩn hoá NFC rồi `equals` | Hai cách mã hoá |
| Nhiều chuỗi trùng chiếm heap | Đo, rồi thử String Deduplication (G1) trước `intern` | Không sửa code |
| Mảng số lớn | `int[]` / `long[]` | Nhỏ hơn ~5 lần so với `Integer[]` |

## Tính năng mới theo phiên bản

- **Java 9**: compact strings (JEP 254), nối chuỗi qua `invokedynamic` (JEP 280).
- **Java 11**: `strip`, `isBlank`, `repeat`, `lines`.
- **Java 15**: text block. **Java 21**: `StringBuilder.repeat`, `String.indexOf(ch, from, to)`.
- **Java 25**: `UseCompactObjectHeaders` (JEP 519) thành tính năng chính thức, tắt mặc định — header object nhỏ hơn. Đã thử với bài đo trên: vẫn ~101 MB, vì một `Integer` sau khi làm tròn vẫn chiếm 16 byte. Lợi ích rõ hơn với object có nhiều field nhỏ.

:::senior Góc nhìn senior
Những "tối ưu" như `intern()` hay tự viết `StringBuilder` cho một phép nối đơn giản thường chỉ làm code khó đọc mà không nhanh hơn. Ưu tiên đúng trước: chuẩn hoá Unicode ở biên, `Locale.ROOT` cho dữ liệu kỹ thuật, `equals` thay vì `==`. Khi nghi ngờ về hiệu năng, đo bằng JMH và xem heap dump — thường thủ phạm là collection của object boxing hoặc chuỗi trùng, không phải phép `+`.
:::

:::quiz `"Chào 😀".length()` trả về bao nhiêu?
- [ ] 6
- [x] 7
- [ ] 9
- [ ] 10

Emoji 😀 nằm ngoài BMP nên chiếm 2 đơn vị UTF-16 (cặp surrogate). `codePointCount` cho 6. Đã chạy thử.
:::

:::quiz Vì sao hai chuỗi "Việt" nhìn giống nhau nhưng `equals` trả false?
- [ ] Một chuỗi có khoảng trắng ẩn
- [x] Một chuỗi ở dạng NFC (4 code unit), chuỗi kia ở dạng NFD (6 code unit: chữ gốc + dấu kết hợp)
- [ ] Khác coder Latin-1 và UTF-16
- [ ] `equals` phân biệt hoa thường

Chuẩn hoá cả hai về NFC bằng `java.text.Normalizer` rồi so. Đã chạy thử.
:::

:::exercise Đếm ký tự cho ô nhập tên
Form đăng ký giới hạn tên tối đa 50 "ký tự". Viết `static boolean hopLe(String ten)` sao cho: tên được chuẩn hoá NFC và `strip()` trước, độ dài tính theo code point, không rỗng. Kiểm tra với `"  Nguyễn Văn An  "` (dạng NFD) và một chuỗi 50 emoji.
???
```java
static boolean hopLe(String ten) {
    String s = Normalizer.normalize(ten, Normalizer.Form.NFC).strip();
    int n = s.codePointCount(0, s.length());
    return n > 0 && n <= 50;
}
```

Với NFD, `length()` lớn hơn nhiều so với số chữ người dùng thấy; sau NFC + `strip()` "Nguyễn Văn An" có 13 code point. 50 emoji có `length()` = 100 nhưng 50 code point → hợp lệ. Lưu ý frontend (`input.maxLength` của trình duyệt cũng đếm UTF-16) và cột DB phải dùng cùng quy tắc đếm.
:::
