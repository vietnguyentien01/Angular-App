---
title: "Regex chuyên sâu — backtracking, ReDoS, possessive và atomic group, StackOverflowError, đặt giới hạn thời gian"
summary: "Đo trên JDK 21: mẫu kinh điển ^(a+)+$ đã được engine tối ưu (0 ms), nhưng (.*,){11}P mất 3,6 giây với dòng 30 trường; sửa bằng lớp ký tự chặt, possessive hoặc atomic group; (a|b)* tràn stack với chuỗi 3.000 ký tự; và cách đặt giới hạn thời gian cho regex bằng CharSequence."
level: advanced
version: 21
lastReviewed: 2026-11-21
tags: [java, regex, redos, performance, security, internals]
related: [java/consolidate/text/xu-ly-van-ban-va-optional-dung-cho, java/deep-dive/basics/ben-trong-string-va-boxing]
---

## Tóm tắt nhanh

- `java.util.regex` là engine **backtracking**: gặp ngõ cụt thì lùi lại thử cách chia khác. Mẫu có nhiều cách chia cùng một chuỗi có thể chạy theo **hàm mũ** — gọi là *catastrophic backtracking*. Khi chuỗi do người dùng gửi lên, đó là lỗ hổng từ chối dịch vụ **ReDoS** (Regular expression Denial of Service).
- JDK 9+ có tối ưu cho vòng lặp lồng nhau đơn giản: đo trên JDK 21, `^(a+)+$`, `^(a|aa)+$`, `^(\w+\s?)*$` với chuỗi 28 ký tự + `!` đều **0 ms**. Nhưng mẫu có **lặp có giới hạn** quanh `.*`, như `^(.*,){11}P`, vẫn bùng nổ: **3.631 ms** với dòng 30 trường.
- Sửa: thay `.*` bằng lớp ký tự loại trừ dấu phân cách (`[^,]*`), hoặc dùng **possessive** (`*+`) / **atomic group** (`(?>…)`) để cấm lùi lại.
- Nhóm lặp có nhánh như `(a|b)*` dùng **đệ quy** trong engine: chuỗi 3.000 ký tự đã ném `StackOverflowError` với stack mặc định. `[ab]*` thì không.
- `java.util.regex` không có timeout. Có thể tự đặt giới hạn bằng một `CharSequence` kiểm tra thời gian trong `charAt`.

## Cơ chế: vì sao lùi lại tốn kém

`(.*,){11}P` trên dòng `ma,ten,ma,ten,…,x` (không có `P`):

1. Lần lặp 1: `.*` nuốt **cả dòng**, rồi lùi từng ký tự tới khi gặp `,` cuối cùng.
2. Lần lặp 2: `.*` nuốt phần còn lại… không còn `,` nào → lần lặp 1 phải lùi tiếp tới dấu `,` áp chót, lần lặp 2 thử lại.
3. Mười một lần lặp, mỗi lần có thể kết thúc ở bất kỳ dấu `,` nào phía sau lần trước → số cách thử là **tổ hợp** của số dấu phẩy chọn 11. Không có `P` ở cuối nên engine phải thử **hết** trước khi kết luận "không khớp".

Đo trên JDK 21 (dòng có n trường, không có `P`):

```text
14 trường: (.*,){11}P     5 ms | ([^,]*,){11}P 0.036 ms
18 trường: (.*,){11}P    10 ms | ([^,]*,){11}P 0.131 ms
22 trường: (.*,){11}P    93 ms | ([^,]*,){11}P 0.063 ms
26 trường: (.*,){11}P   647 ms | ([^,]*,){11}P 0.026 ms
30 trường: (.*,){11}P  3631 ms | ([^,]*,){11}P 0.019 ms
```

Thêm 4 trường, thời gian tăng 5–7 lần. Một dòng CSV 40 trường sẽ treo một thread hàng phút. Với `[^,]*`, mỗi lần lặp **chỉ có một** cách kết thúc (dấu phẩy kế tiếp), không còn gì để thử lại.

## Những mẫu JDK đã xử lý được

Cùng phép đo, chuỗi `"a".repeat(n) + "!"`:

```text
^(a+)+$:              n=20 0ms  n=24 0ms  n=28 0ms
^(a|aa)+$:            n=20 0ms  n=24 0ms  n=28 0ms
^(\w+\s?)*$:          n=20 0ms  n=24 0ms  n=28 0ms
^([a-z0-9]+[._-]?)+@: n=20 0ms  n=24 0ms  n=28 0ms
(x+x+)+y:             n=26 0ms
```

Đây là những mẫu ReDoS kinh điển trong tài liệu bảo mật — với nhiều engine backtracking khác (và với Java 8) chúng chạy theo hàm mũ. Từ JDK 9, khi vòng lặp là greedy và cả mẫu không có backreference, engine ghi nhớ vị trí đã thử thất bại để không thử lại, nên các mẫu trên chạy gần như tuyến tính. **Đừng** dựa vào tối ưu này:

- Nó không áp cho lặp có giới hạn `{n}`, cho backreference (`\1`) — đo `^(a+)+\1b` tăng dần 1 → 4 → 14 ms khi n từ 14 lên 18.
- Cùng regex có thể chạy ở nơi khác (JavaScript ở frontend, Go, Python, cơ sở dữ liệu), nơi không có tối ưu đó.

## Sửa: cấm lùi lại

```java
Pattern xau    = Pattern.compile("^(.*,){11}P");
Pattern chat   = Pattern.compile("^([^,]*,){11}P");       // lớp ký tự không chồng lấn với dấu phân cách
Pattern poss   = Pattern.compile("^([^,]*+,){11}P");      // possessive: *+ nuốt rồi không trả lại
Pattern atomic = Pattern.compile("^(?>[^,]*,){11}P");     // atomic group: khớp xong thì "khoá" nhóm lại
// chat / poss / atomic trên dòng 30 trường: < 1 ms (đo được 0,3 ms cho cả hai mẫu cuối)
```

Possessive và atomic **đổi nghĩa** của mẫu nếu dùng sai chỗ:

```java
"aaa".matches("a*a");    // true  — a* lùi một ký tự để a cuối khớp
"aaa".matches("a*+a");   // false — a*+ nuốt hết, không trả lại → a cuối không còn gì để khớp
```

Quy tắc an toàn: chỉ dùng possessive khi phần phía sau **không thể** bắt đầu bằng ký tự mà phần possessive đã nuốt (như `[^,]*+` theo sau là `,`).

## Tràn stack

```java
Pattern.compile("(a|b)*").matcher("ab".repeat(n)).matches();
```

```text
200 ký tự ok   600 ok   1.000 ok   1.600 ok   3.000 → StackOverflowError
-Xss4m: 3.000 ok
```

Nhóm lặp có nhánh (`(a|b)*`, `(\s|\S)*`, `(.|\n)*`) được engine cài bằng đệ quy — mỗi lần lặp thêm vài frame. Với input vài nghìn ký tự (một đoạn JSON, một email), thread xử lý request chết vì `StackOverflowError`. Viết bằng lớp ký tự: `[ab]*` chạy được với 100.000 ký tự. `(.|\n)*` thay bằng `.*` với cờ `Pattern.DOTALL`.

## Đặt giới hạn thời gian

```java title="GioiHanThoiGian.java"
final class GioiHanThoiGian implements CharSequence {
    private final CharSequence goc;
    private final long hetHan;                         // System.nanoTime()

    GioiHanThoiGian(CharSequence goc, long hetHan) { this.goc = goc; this.hetHan = hetHan; }

    @Override public char charAt(int i) {
        if (System.nanoTime() > hetHan) throw new IllegalStateException("regex quá thời gian");
        return goc.charAt(i);
    }
    @Override public int length() { return goc.length(); }
    @Override public CharSequence subSequence(int s, int e) { return new GioiHanThoiGian(goc.subSequence(s, e), hetHan); }
    @Override public String toString() { return goc.toString(); }
}

xau.matcher(new GioiHanThoiGian(dong, System.nanoTime() + 100_000_000L)).find();
// IllegalStateException: regex quá thời gian — sau 100 ms (đã chạy trên JDK 21)
```

Engine đọc input qua `charAt` liên tục trong lúc backtracking, nên kiểm tra thời gian ở đó dừng được cả mẫu xấu nhất. Đổi lại, mỗi `charAt` tốn thêm một lời gọi `nanoTime` (vài chục nano giây) — chỉ bọc khi **mẫu** hoặc **input** đến từ người dùng (vd tính năng "tìm theo regex" cho admin). Cách khác: giới hạn **độ dài input** trước khi chạy regex — đơn giản và hiệu quả nhất.

## Bên trong `Pattern`

- `Pattern.compile` dịch regex thành một cây node (`Pattern$Start`, `Pattern$Loop`, `Pattern$Branch`…). Việc này tốn kém hơn nhiều so với một lần khớp — bài *Xử lý văn bản* đo được `String.matches` chậm ~3 lần so với dùng lại `Pattern`.
- `Pattern` bất biến, dùng chung giữa các thread. `Matcher` giữ trạng thái (vị trí, nhóm) → mỗi thread một `Matcher`; dùng lại cho chuỗi khác bằng `matcher.reset(s)`.
- `String.split` với **một ký tự** không phải ký tự đặc biệt (`split(",")`) có đường tắt không dùng regex. `split(", ")` (hai ký tự) thì compile regex mỗi lần.

## So sánh phương án

| Việc | Chọn | Tránh |
|---|---|---|
| Tách theo dấu phân cách cố định | `split(",")`, hoặc đọc CSV bằng thư viện (OpenCSV, Jackson CSV) | `(.*,){n}` |
| Khớp "mọi thứ tới dấu X" | `[^X]*` | `.*X` lặp nhiều lần |
| Khớp nhiều dòng | `.*` với `Pattern.DOTALL` | `(.\|\n)*` |
| Regex từ người dùng | Giới hạn độ dài + `GioiHanThoiGian`, hoặc thư viện RE2/J (thời gian tuyến tính, không backtracking) | Chạy thẳng trên thread request |
| Kiểm tra định dạng trong vòng lặp lớn | `static final Pattern` | `String.matches` |
| Phân tích cú pháp phức tạp (biểu thức, ngôn ngữ) | Parser viết tay hoặc ANTLR | Một regex khổng lồ |

## Tính năng mới theo phiên bản

- **Java 1.4**: `java.util.regex`. **Java 7**: nhóm có tên, `UNICODE_CHARACTER_CLASS`.
- **Java 8**: `Pattern.splitAsStream`, `asPredicate`. **Java 9**: `Matcher.results()`, `replaceAll(Function)`, tối ưu chống backtracking cho vòng lặp không giới hạn.
- **Java 11**: `asMatchPredicate()`. **Java 21**: không thay đổi engine; mọi số đo trong bài chạy trên JDK 21.

:::senior Góc nhìn senior
Đưa regex vào danh sách review bảo mật như SQL: mẫu nào chạy trên **input người dùng**, mẫu nào do **người dùng nhập**. Với cái đầu, viết mẫu không chồng lấn (lớp ký tự loại trừ dấu phân cách, không lồng `+` trong `+`), giới hạn độ dài input ở biên API, và thêm test hiệu năng với input xấu nhất (chuỗi dài gần khớp nhưng hỏng ở cuối). Với cái sau, đừng dùng `java.util.regex` trực tiếp — dùng engine thời gian tuyến tính như RE2/J, hoặc chạy trong executor riêng có timeout. Sự cố ReDoS ngoài thực tế (vd sự cố của Cloudflare năm 2019) đều bắt đầu từ một regex "trông vô hại".
:::

:::quiz Theo số đo trên JDK 21, mẫu nào chạy **chậm theo cấp số nhân** với input không khớp?
- [ ] `^(a+)+$` với `"a".repeat(28) + "!"`
- [ ] `^(\w+\s?)*$` với `"a".repeat(28) + "!"`
- [x] `^(.*,){11}P` với một dòng 30 trường không có `P`
- [ ] `^([^,]*,){11}P` với cùng dòng đó

JDK 9+ tối ưu được vòng lặp lồng nhau không giới hạn (0 ms), nhưng không tối ưu được lặp có giới hạn quanh `.*`: 3.631 ms ở 30 trường. Lớp ký tự `[^,]*` chỉ có một cách khớp: 0,02 ms.
:::

:::quiz `"aaa".matches("a*+a")` trả về gì, và vì sao?
- [ ] `true` — `a*+` giống `a*`
- [x] `false` — possessive `a*+` nuốt cả ba `a` và không trả lại, `a` cuối không còn gì để khớp
- [ ] Lỗi cú pháp regex
- [ ] `true` — engine tự lùi lại khi cần

Possessive cấm backtracking, nhanh hơn nhưng đổi nghĩa nếu phần sau cần ký tự mà nó đã nuốt. Đã chạy thử: `a*a` → `true`, `a*+a` → `false`.
:::

:::exercise Sửa regex đọc log
Một service đọc log dạng `2026-11-21 10:15:03 [INFO] [order-service] userId=42 msg=...` bằng `^(.*) \[(.*)\] \[(.*)\] (.*)$`. Với dòng **không khớp** có nhiều cặp `[...]` (vd nội dung có ký tự xuống dòng ở cuối), đo trên JDK 21: 101 ký tự 3 ms, 341 ký tự 72 ms, 661 ký tự **1.100 ms** — gấp đôi độ dài thì chậm ~15 lần. Viết lại mẫu cho chặt và an toàn.
???
```java
static final Pattern LOG = Pattern.compile(
    "^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}) \\[([A-Z]{4,5})\\] \\[([^\\]]{1,64})\\] (.*)$");
```

- Thời gian có định dạng cố định → `\d{4}-\d{2}-…` thay cho `.*`, không còn chỗ để thử nhiều cách chia.
- Mức log chỉ là chữ in hoa 4–5 ký tự (`INFO`, `WARN`, `ERROR`, `DEBUG`).
- Tên service: `[^\]]{1,64}` — mọi thứ trừ `]`, có giới hạn độ dài.
- Chỉ còn một `.*` ở cuối, sau khi mọi thứ phía trước đã cố định: nó khớp phần còn lại trong một lượt.

Đã chạy cùng các dòng xấu: mẫu mới chỉ mất 0,03–0,1 ms ở mọi độ dài. Thêm một lớp bảo vệ: bỏ qua (hoặc cắt) dòng dài hơn ví dụ 10.000 ký tự trước khi chạy regex, và viết test với input xấu nhất để chắc chắn thời gian xử lý vẫn tuyến tính.
:::
