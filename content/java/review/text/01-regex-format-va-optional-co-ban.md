---
title: "Regex, định dạng chuỗi và Optional — Pattern/Matcher, String.format, Optional dùng hằng ngày"
summary: "Nhắc nhanh Pattern và Matcher (matches so với find, nhóm có tên, replaceAll với $1, split), String.format và formatted (độ rộng, số lẻ, dấu phân cách theo Locale), và Optional (ofNullable, map, orElse, orElseThrow, không gọi get). Mọi output đã chạy trên JDK 21."
type: card
level: core
version: 21
lastReviewed: 2026-11-21
tags: [java, regex, string-format, optional]
related: [java/consolidate/text/xu-ly-van-ban-va-optional-dung-cho, java/deep-dive/text/regex-backtracking-va-hieu-nang]
---

## Tóm tắt nhanh

- `Pattern.compile(regex)` **một lần** (để `static final`), rồi `pattern.matcher(s)` mỗi lần dùng.
- `matches()` = **cả chuỗi** phải khớp; `find()` = tìm một đoạn khớp ở bất kỳ đâu. Nhầm hai cái này là lỗi số một.
- Trong chuỗi Java, mỗi `\` của regex phải viết thành `\\`: `"\\d{10}"`. `split`, `replaceAll`, `matches` của `String` đều nhận **regex**, nên `.` và `|` phải escape.
- `String.format`/`"…".formatted(...)`: `%s` chuỗi, `%d` số nguyên, `%.2f` hai chữ số lẻ, `%,d` có dấu phân cách hàng nghìn — theo `Locale`.
- `Optional` dùng cho **kiểu trả về** "có thể không có". Lấy giá trị bằng `map`/`orElse`/`orElseThrow`, không dùng `get()`.

## Ví dụ nhanh (đã chạy trên JDK 21)

```java title="Regex"
Pattern SDT = Pattern.compile("0(3|5|7|8|9)\\d{8}");
SDT.matcher("0912345678").matches();          // true
SDT.matcher("SĐT: 0912345678.").matches();    // false — cả chuỗi không khớp
SDT.matcher("SĐT: 0912345678.").find();       // true  — có một đoạn khớp

Pattern GD = Pattern.compile("(?<ngay>\\d{2}/\\d{2}/\\d{4})\\s+(?<loai>CK|RUT|NAP)\\s+(?<tien>[\\d.]+)");
Matcher m = GD.matcher("15/11/2026 CK 1.500.000 Nguyen Van An");
if (m.find()) {
    m.group("ngay");   // "15/11/2026"
    m.group("loai");   // "CK"   — cũng là m.group(2)
    m.group("tien");   // "1.500.000"
}

"2026-11-21".replaceAll("(\\d{4})-(\\d{2})-(\\d{2})", "$3/$2/$1");          // "21/11/2026"
Pattern.compile("\\d+").matcher("đơn 12, 7 và 300").results().map(MatchResult::group).toList();   // [12, 7, 300]
```

```java title="split và escape"
"a.b.c".split(".");                     // []        — "." là "mọi ký tự"
"a.b.c".split("\\.");                   // [a, b, c]
"a|b".split("|");                       // [a, |, b] — "|" rỗng hoặc rỗng
"a|b".split(Pattern.quote("|"));        // [a, b]
```

```java title="Định dạng"
String.format("|%-10s|%8.2f|%05d|%,d|%x|", "An", 3.14159, 42, 1234567, 255);
// |An        |    3.14|00042|1,234,567|ff|      — locale mặc định en_US
String.format(Locale.of("vi", "VN"), "%,d | %,.2f", 1234567, 1234.5);   // "1.234.567 | 1.234,50"
String.format(Locale.ROOT, "%.2f", 1234.5);                             // "1234.50" — dùng cho dữ liệu máy đọc
"Đơn %s: %d sản phẩm".formatted("D1", 3);                               // "Đơn D1: 3 sản phẩm"
String.format("%2$s-%1$s", "a", "b");                                   // "b-a" — chọn tham số theo vị trí
String.format("%s|%b", null, null);                                     // "null|false"
```

```java title="Optional"
Map<String, String> email = Map.of("an", "an@vn");
Optional<String> o = Optional.ofNullable(email.get("binh"));   // Optional.empty

o.map(String::toUpperCase).orElse("không có");                  // "không có"
Optional.ofNullable(email.get("an")).map(String::toUpperCase).orElse("không có");   // "AN@VN"
o.orElseThrow(() -> new NoSuchElementException("không tìm thấy email của binh"));
o.get();                     // NoSuchElementException: No value present
Optional.of(null);           // NullPointerException — dùng ofNullable khi giá trị có thể null
Optional.empty().or(() -> Optional.of("dự phòng")).get();                         // "dự phòng"
Stream.of(Optional.of(1), Optional.<Integer>empty(), Optional.of(3)).flatMap(Optional::stream).toList();   // [1, 3]
```

## Bảng chọn nhanh

| Regex | Nghĩa | Ví dụ |
|---|---|---|
| `\d` `\w` `\s` | chữ số, ký tự chữ (ASCII), khoảng trắng | `"\\d{4}"` |
| `[abc]` `[^,]` | một trong các ký tự / bất kỳ trừ `,` | `"[^,]*"` |
| `*` `+` `?` `{n,m}` | 0+, 1+, 0–1, n tới m lần | `"\\d{8,11}"` |
| `^` `$` | đầu / cuối chuỗi | `"^\\d+$"` |
| `(…)` `(?<ten>…)` `(?:…)` | nhóm có số / có tên / không bắt | `m.group("ten")` |
| `a|b` | a hoặc b | `"CK|RUT"` |

| Muốn | Dùng |
|---|---|
| Cả chuỗi khớp mẫu (kiểm tra định dạng) | `PATTERN.matcher(s).matches()` |
| Tìm / lấy mọi đoạn khớp | `find()` trong vòng lặp, hoặc `results()` |
| Ghép chuỗi có định dạng | `"…%s…".formatted(...)` |
| Số hiển thị cho người Việt | `String.format(Locale.of("vi", "VN"), "%,d", n)` |
| Số ghi file/CSV/log máy đọc | `Locale.ROOT` |
| Tiền tệ có ký hiệu ₫ | `NumberFormat.getCurrencyInstance(Locale.of("vi", "VN"))` (bài *Tính tiền với BigDecimal*) |
| Trả về "có thể không có" | `Optional<T>` |
| Tìm trong collection | `stream().filter(...).findFirst()` → `Optional` |

## Lỗi hay gặp: `replaceAll` với `$` trong chuỗi thay thế

```java bad
String tenFile = "bao-cao-$1.pdf";
"FILE".replaceAll("FILE", tenFile);   // IndexOutOfBoundsException: No group 1
```

```java good
"FILE".replace("FILE", tenFile);                                  // replace: không dùng regex
"FILE".replaceAll("FILE", Matcher.quoteReplacement(tenFile));     // khi buộc phải dùng regex
```

Trong chuỗi thay thế của `replaceAll`, `$1` là "nhóm 1" và `\` là ký tự escape. Đã chạy thử: dữ liệu người dùng có `$` làm `replaceAll` ném exception. Không cần regex thì dùng `replace` — nó thay **mọi** chỗ xuất hiện, chỉ là không hiểu regex.

:::version 21 Java 8 / 11 / 17 / 21
- `Optional`, `String.join`: Java 8. `Optional.or`, `Optional.stream`: Java 9. `Optional.isEmpty`, `orElseThrow()` không tham số: Java 10–11.
- `Matcher.results()`: Java 9. `String.strip`, `repeat`, `isBlank`: Java 11. `"…".formatted(...)`: Java 15.
- `Locale.of`: Java 19 (Java 17 dùng `new Locale("vi", "VN")`).
:::

:::interview Khi nào nên dùng Optional và khi nào không?
`Optional` được thiết kế cho **kiểu trả về** của method có thể không có kết quả (`findById`, `findFirst`), buộc người gọi xử lý trường hợp rỗng một cách tường minh. Không nên dùng làm **field** (không `Serializable`, tốn thêm một object, JPA/Jackson cần cấu hình), làm **tham số** method (người gọi vẫn truyền `null` được, nên viết hai overload hoặc nhận giá trị có thể null), hay bọc **collection** (trả về list rỗng thay vì `Optional<List>`). Không gọi `get()` khi chưa chắc có giá trị; dùng `orElse`, `orElseGet`, `orElseThrow`, `map`, `ifPresent`. Với số nguyên tránh boxing có `OptionalInt`/`OptionalLong`.
:::

:::quiz `Pattern.compile("\\d{10}").matcher("SĐT 0912345678").matches()` trả về gì?
- [ ] `true`
- [x] `false`
- [ ] Ném `PatternSyntaxException`
- [ ] `true` nếu dùng flag `MULTILINE`

`matches()` yêu cầu **cả chuỗi** khớp mẫu. Muốn tìm một đoạn bên trong thì dùng `find()`. Đã chạy thử.
:::

:::quiz `"a.b.c".split(".")` trả về gì?
- [ ] `[a, b, c]`
- [x] Mảng rỗng `[]`
- [ ] `[a.b.c]`
- [ ] Ném `PatternSyntaxException`

`split` nhận regex; `.` khớp mọi ký tự, nên mọi phần đều rỗng và chuỗi rỗng ở cuối bị bỏ hết. Viết `split("\\.")` hoặc `split(Pattern.quote("."))`. Đã chạy thử.
:::

:::quiz Đoạn nào ném exception? (chọn nhiều)
- [x] `Optional.of(null)`
- [x] `Optional.empty().get()`
- [ ] `Optional.ofNullable(null).orElse("x")`
- [x] `String.format("%d", "x")`

`Optional.of(null)` → `NullPointerException`; `get()` trên rỗng → `NoSuchElementException: No value present`; `%d` với chuỗi → `IllegalFormatConversionException: d != java.lang.String`. Đã chạy thử trên JDK 21.
:::
