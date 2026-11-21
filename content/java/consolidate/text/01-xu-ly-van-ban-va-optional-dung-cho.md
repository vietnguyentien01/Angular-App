---
title: "Xử lý văn bản và Optional dùng đúng chỗ — đọc sao kê bằng regex, chuẩn hoá số điện thoại, làm tròn khi format"
summary: "Luyện tay: phân tích dòng sao kê bằng nhóm có tên và trả Optional, chuẩn hoá số điện thoại Việt Nam, rồi các bẫy: \\w không khớp chữ có dấu, CASE_INSENSITIVE cần UNICODE_CASE, String.matches trong vòng lặp chậm ~3 lần, %.1f làm tròn HALF_UP, Optional làm field/tham số. Chạy trên JDK 21."
level: intermediate
version: 21
lastReviewed: 2026-11-21
tags: [java, regex, string-format, optional, pitfalls]
related: [java/review/text/regex-format-va-optional-co-ban, java/consolidate/basics/tinh-tien-voi-bigdecimal]
---

## Tóm tắt nhanh

- Dữ liệu văn bản từ bên ngoài (file sao kê, form, CSV): **neo cả dòng** bằng `^…$` + `matches()`, dùng **nhóm có tên**, và kiểm tra lại giá trị sau khi tách (ngày có thật không, số có đúng định dạng không).
- Hàm phân tích trả **`Optional`** (hoặc một kết quả có lý do lỗi) thay vì ném exception cho từng dòng sai.
- `\w` chỉ khớp chữ **ASCII**: `"Trần"` không khớp `\w+`. Chữ tiếng Việt dùng `\p{L}`. Không phân biệt hoa thường cho tiếng Việt cần thêm `UNICODE_CASE`.
- `String.matches`/`split`/`replaceAll` biên dịch regex **mỗi lần gọi**. Trong vòng lặp lớn, giữ `Pattern` trong `static final`: đo được nhanh hơn ~3 lần.
- `String.format("%.1f", 2.25)` cho `"2.3"`: Formatter làm tròn **HALF_UP** trên dạng thập phân ngắn nhất của số. Tiền thì làm tròn bằng `BigDecimal` trước, format sau.
- `Optional` chỉ làm **kiểu trả về**. Không làm field, không làm tham số, không bọc collection.

## Cơ chế: regex khớp thế nào

`java.util.regex` là engine **backtracking**: thử khớp từ trái sang phải, gặp ngõ cụt thì lùi lại thử nhánh khác. `matches()` yêu cầu khớp từ vị trí 0 tới hết chuỗi; `find()` thử bắt đầu từ từng vị trí. Hiểu điều này giúp viết mẫu chặt (ít nhánh để thử) — và tránh mẫu có thể chạy hàng giây (bài chuyên sâu).

## Bài tập chính: đọc sao kê

```java title="SaoKe.java"
record GiaoDich(LocalDate ngay, String loai, BigDecimal tien, String noiDung) {}

static final Pattern DONG = Pattern.compile(
    "^(?<ngay>\\d{2}/\\d{2}/\\d{4})\\s*;\\s*(?<loai>CK|RUT|NAP)\\s*;\\s*" +
    "(?<tien>\\d{1,3}(?:\\.\\d{3})*)\\s*;\\s*(?<nd>.*)$");
static final DateTimeFormatter NGAY =
    DateTimeFormatter.ofPattern("dd/MM/uuuu").withResolverStyle(ResolverStyle.STRICT);

static Optional<GiaoDich> phanTich(String dong) {
    Matcher m = DONG.matcher(dong.strip());
    if (!m.matches()) return Optional.empty();
    try {
        return Optional.of(new GiaoDich(
            LocalDate.parse(m.group("ngay"), NGAY),
            m.group("loai"),
            new BigDecimal(m.group("tien").replace(".", "")),
            m.group("nd").strip()));
    } catch (DateTimeParseException e) {
        return Optional.empty();                 // regex đúng hình dạng, nhưng ngày không có thật
    }
}
```

Chạy trên JDK 21:

```text
15/11/2026; CK; 1.500.000; Nguyen Van An chuyen tien → GiaoDich[ngay=2026-11-15, loai=CK, tien=1500000, noiDung=Nguyen Van An chuyen tien]
16/11/2026;RUT;200.000;ATM                            → GiaoDich[ngay=2026-11-16, loai=RUT, tien=200000, noiDung=ATM]
31/02/2026; NAP; 100.000; sai ngày                    → BỎ QUA (regex khớp, LocalDate STRICT từ chối 31/02)
17/11/2026; CK; 1500000; thiếu dấu chấm               → BỎ QUA (định dạng tiền quy định có dấu chấm)
18/11/2026; CK; 12.50.000; sai nhóm                   → BỎ QUA (\d{1,3}(?:\.\d{3})* chặn nhóm 2 chữ số)
```

Ba lớp kiểm tra: regex kiểm tra **hình dạng**, `ResolverStyle.STRICT` kiểm tra **ngày có thật** (mặc định `SMART` sẽ lặng lẽ chỉnh 31/02 thành 28/02), `BigDecimal` cho **số tiền chính xác**. Chú ý `uuuu` (năm) thay vì `yyyy` khi dùng `STRICT` — `yyyy` là "năm của kỷ nguyên" và cần thêm trường kỷ nguyên mới parse được ở chế độ này.

Trong ứng dụng thật, trả `Optional` mới chỉ nói "không được"; người dùng cần biết **vì sao** và **dòng nào**. Khi đó trả một sealed result `ThanhCong | Loi(dong, lyDo)` như bài *Thiết kế exception*.

## Chuẩn hoá số điện thoại

```java good
static final Pattern KHONG_PHAI_SO = Pattern.compile("[^\\d+]");
static final Pattern SDT_VN = Pattern.compile("0[35789]\\d{8}");

static Optional<String> chuanHoaSdt(String s) {
    String so = KHONG_PHAI_SO.matcher(s).replaceAll("");           // bỏ khoảng trắng, chấm, ngoặc, gạch
    if (so.startsWith("+84")) so = "0" + so.substring(3);
    else if (so.startsWith("84") && so.length() == 11) so = "0" + so.substring(2);
    return SDT_VN.matcher(so).matches() ? Optional.of(so) : Optional.empty();
}
```

```text
+84 912 345 678 → 0912345678        84912345678 → 0912345678
0912.345.678    → 0912345678        0123456789  → không hợp lệ (đầu số 01 cũ)
(091) 2345678   → 0912345678        091234567   → không hợp lệ (9 chữ số)
```

Chuẩn hoá **ở biên vào hệ thống** (API, import), lưu một dạng duy nhất trong DB. Tìm kiếm, kiểm tra trùng và gửi SMS khi đó mới đúng.

## Code bad / good

### `\w` và tiếng Việt

```java bad
"Trần Thị Ánh".matches("[a-zA-Z ]+");     // false — chữ có dấu không phải a-z
"Xin chào".matches("\\w+ \\w+");          // false — \w chỉ là [a-zA-Z_0-9]
Pattern.compile("^nguyễn", Pattern.CASE_INSENSITIVE).matcher("NGUYỄN An").find();   // false
```

```java good
"Trần Thị Ánh".matches("[\\p{L} ]+");                  // true — \p{L}: mọi chữ cái Unicode
"Xin chào".matches("(?U)\\w+ \\w+");                   // true — (?U) = UNICODE_CHARACTER_CLASS
Pattern.compile("^nguyễn", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher("NGUYỄN An").find();   // true
```

`CASE_INSENSITIVE` một mình chỉ so hoa thường cho ký tự **ASCII**. Kiểm tra họ tên bằng `[a-zA-Z]` là lỗi hay gặp trong form đăng ký, chặn hầu hết người dùng Việt Nam. Nhớ chuẩn hoá NFC trước khi so khớp (bài *Bên trong String*): `ệ` dạng NFD là ba code point và có thể không khớp `\p{L}+` như bạn nghĩ.

### `String.matches` trong vòng lặp

100.000 số điện thoại, JDK 21:

```text
String.matches("0[35789]\\d{8}"):   125 ms, 121 ms, 52 ms
Pattern static final + matcher():    36 ms,  33 ms,  9 ms
```

```java bad
for (String d : dong) if (d.matches("0[35789]\\d{8}")) dem++;   // compile lại regex mỗi lần
```

```java good
private static final Pattern SDT = Pattern.compile("0[35789]\\d{8}");
for (String d : dong) if (SDT.matcher(d).matches()) dem++;
```

`Pattern` là bất biến và **thread-safe**, dùng chung được. `Matcher` thì **không** thread-safe — tạo mới mỗi lần dùng (rẻ).

### Làm tròn khi format

```java
String.format("%.1f", 2.25);    // "2.3"   — HALF_UP
String.format("%.1f", 2.15);    // "2.2"   — dù double 2.15 thực ra là 2.1499999…
String.format("%.0f", 2.5);     // "3"
String.format("%.2f", 1.005);   // "1.01"  — new BigDecimal(1.005) = 1.00499999999999989…
Math.round(-2.5);               // -2      — Math.round làm tròn về phía +∞
new BigDecimal("2.25").setScale(1, RoundingMode.HALF_EVEN);   // 2.2
```

Formatter lấy dạng thập phân ngắn nhất của `double` (như `Double.toString`) rồi làm tròn HALF_UP. Kết quả "đẹp" với mắt người, nhưng **khác** với cách làm tròn của ngân hàng (HALF_EVEN) và của `Math.round`. Với tiền: tính và làm tròn bằng `BigDecimal` theo quy định nghiệp vụ, rồi mới format để hiển thị.

### Optional sai chỗ

```java bad
class KhachHang {
    private Optional<String> email;                       // field: không Serializable, Jackson/JPA cần cấu hình
}
void guiThu(Optional<String> email) { … }                 // người gọi vẫn truyền null được
Optional<List<Don>> timDon(String ma);                    // hai cách nói "không có": empty và list rỗng
if (o.isPresent()) return o.get(); else return "?";       // dài hơn, dễ quên kiểm tra ở chỗ khác
```

```java good
class KhachHang {
    private String email;                                  // có thể null
    Optional<String> email() { return Optional.ofNullable(email); }   // getter trả Optional
}
void guiThu(String email) { … }                           // hoặc hai method: guiThu(), guiThu(email)
List<Don> timDon(String ma);                              // không có → List.of()
return o.orElse("?");
```

## Pitfalls

- `split` không bỏ khoảng trắng đầu/cuối cả chuỗi: `" a ,b,, c ".split("\\s*,\\s*")` → `[" a", "b", "", "c "]`. `strip()` trước rồi mới `split`.
- `split` bỏ phần rỗng ở **cuối**: `"a,b,,".split(",")` → `[a, b]`; giữ lại thì `split(",", -1)` → `[a, b, , ]`. CSV có cột cuối trống sẽ mất cột.
- `Optional.orElse(goiDb())` **luôn** chạy `goiDb()`; dùng `orElseGet(() -> goiDb())` (bài *Viết báo cáo bằng Stream*).
- `Optional.of(x)` khi `x` có thể null → `NullPointerException` ngay tại chỗ tạo.
- Regex kiểm tra email "hoàn hảo" theo RFC dài hàng trăm ký tự và dễ bị chậm. Kiểm tra hình dạng đơn giản, rồi xác thực thật bằng cách gửi mail.
- Log/CSV/JSON dùng locale mặc định của máy: `String.format("%.2f", x)` trên máy cấu hình `vi_VN` cho `"1234,50"`, máy đọc file sẽ hiểu sai. Dữ liệu cho máy đọc luôn dùng `Locale.ROOT`.

:::senior Góc nhìn senior
Regex là công cụ kiểm tra **hình dạng**, không phải công cụ kiểm tra **nghĩa**. Ngày 31/02, số tài khoản sai checksum, email không tồn tại đều qua được regex. Thiết kế xử lý dữ liệu vào theo lớp: chuẩn hoá (strip, NFC, bỏ ký tự phân cách) → kiểm tra hình dạng (regex chặt, neo `^…$`) → phân tích thành kiểu có nghĩa (`LocalDate` STRICT, `BigDecimal`) → kiểm tra nghiệp vụ. Mỗi lớp trả lỗi rõ ràng. Và đặt mọi `Pattern` thành `static final` có tên mô tả — `SDT_VN` dễ đọc và dễ test hơn một chuỗi regex rải rác giữa code.
:::

:::version 21 Java 8 / 17 / 21
- `Matcher.results()`, `Optional.stream()`, `Optional.or()`: Java 9. `Pattern.asMatchPredicate()`: Java 11.
- Nhóm có tên `(?<ten>…)`: Java 7. `ResolverStyle.STRICT`: Java 8.
- Java 21: không thay đổi gì ở phần này; JDK 9+ có tối ưu chống backtracking cho một số mẫu lồng nhau (bài chuyên sâu).
:::

:::interview Làm sao kiểm tra và tách dữ liệu từ một dòng văn bản theo định dạng cố định một cách an toàn?
Chuẩn hoá đầu vào (bỏ khoảng trắng thừa, chuẩn Unicode NFC), rồi dùng một `Pattern` biên dịch sẵn, neo `^…$` và gọi `matches()` để cả dòng phải đúng định dạng. Dùng nhóm có tên để tách từng phần, mỗi nhóm chặt nhất có thể (`\d{2}`, `[^;]*` thay vì `.*`) vừa đúng vừa tránh backtracking tốn kém. Sau khi tách, phân tích thành kiểu có nghĩa — `LocalDate` với `ResolverStyle.STRICT`, `BigDecimal` cho tiền — vì regex không biết ngày có thật hay không. Trả kết quả (hoặc danh sách lỗi theo dòng) thay vì ném exception ở dòng sai đầu tiên.
:::

:::quiz `Pattern.compile("^nguyễn", Pattern.CASE_INSENSITIVE).matcher("NGUYỄN An").find()` trả về gì?
- [ ] `true`
- [x] `false`
- [ ] Ném exception vì ký tự không phải ASCII
- [ ] `true` trên Windows, `false` trên Linux

`CASE_INSENSITIVE` một mình chỉ áp cho ký tự ASCII; `ễ` và `Ễ` không được coi là giống nhau. Thêm `Pattern.UNICODE_CASE` thì trả `true`. Đã chạy thử trên JDK 21.
:::

:::quiz `String.format("%.1f", 2.25)` và `new BigDecimal("2.25").setScale(1, RoundingMode.HALF_EVEN)` cho kết quả gì?
- [ ] `2.2` và `2.2`
- [x] `2.3` và `2.2`
- [ ] `2.3` và `2.3`
- [ ] `2.2` và `2.3`

Formatter làm tròn HALF_UP, còn HALF_EVEN làm tròn số 5 về chữ số chẵn gần nhất. Đã chạy thử. Tiền tệ phải làm tròn bằng `BigDecimal` theo đúng quy định, không dựa vào format.
:::

:::exercise Tách họ tên
Viết `static Optional<HoTen> tachHoTen(String s)` với `record HoTen(String ho, String dem, String ten)`: chuẩn hoá khoảng trắng thừa, chỉ chấp nhận chữ cái Unicode và khoảng trắng, cần ít nhất hai từ. Thử với `"  trần   thị ánh "`, `"Nguyễn An"`, `"An"`, `"Lê 123"`.
???
```java
static final Pattern HO_TEN = Pattern.compile("^\\p{L}+(?: \\p{L}+)+$");
static final Pattern NHIEU_KHOANG_TRANG = Pattern.compile("\\s+");

static Optional<HoTen> tachHoTen(String s) {
    String chuan = NHIEU_KHOANG_TRANG.matcher(Normalizer.normalize(s, Normalizer.Form.NFC).strip()).replaceAll(" ");
    if (!HO_TEN.matcher(chuan).matches()) return Optional.empty();
    String[] tu = chuan.split(" ");
    String dem = String.join(" ", Arrays.copyOfRange(tu, 1, tu.length - 1));
    return Optional.of(new HoTen(tu[0], dem, tu[tu.length - 1]));
}
```

Kết quả: `"  trần   thị ánh "` → `HoTen[ho=trần, dem=thị, ten=ánh]`, `"Nguyễn An"` → `HoTen[ho=Nguyễn, dem=, ten=An]`, `"An"` và `"Lê 123"` → `Optional.empty`. Viết hoa chữ đầu mỗi từ thì thêm bước `tu.substring(0, 1).toUpperCase(Locale.ROOT) + …` — cẩn thận với `Locale` mặc định khi đổi hoa thường (bài *Bên trong String*). Mẫu `\p{L}+(?: \p{L}+)+` không có hai nhánh chồng lấn nhau nên không bị backtracking tốn kém.
:::
