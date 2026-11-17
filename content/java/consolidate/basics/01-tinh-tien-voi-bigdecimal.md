---
title: "Tính tiền đúng với BigDecimal — làm tròn, chia, so sánh và hiển thị VND"
summary: "Vì sao double sai với tiền, tạo BigDecimal đúng cách, chọn RoundingMode (HALF_UP vs HALF_EVEN), chia không hết, bẫy equals với scale, chia đều hoá đơn không mất đồng nào và định dạng VND. Mọi kết quả đã chạy trên JDK 25."
level: intermediate
version: 25
lastReviewed: 2026-11-16
tags: [java, bigdecimal, money, rounding, pitfalls]
related: [java/review/basics/kieu-du-lieu-va-cu-phap, java/deep-dive/basics/ben-trong-string-va-boxing]
---

## Tóm tắt nhanh

- Tiền **không bao giờ** dùng `double`/`float`. Dùng `BigDecimal` (tạo từ **`String`** hoặc `BigDecimal.valueOf`), hoặc `long` theo đơn vị nhỏ nhất (đồng, xu).
- `new BigDecimal(0.1)` **sai**: nó chép nguyên sai số nhị phân của `double`.
- `divide` không hết (1/3) mà không truyền scale + `RoundingMode` → **`ArithmeticException`**.
- `equals` so cả **scale** (`2.0` ≠ `2.00`). So sánh giá trị dùng **`compareTo`**.
- Làm tròn **một lần, ở bước cuối**, theo đúng quy định nghiệp vụ (thuế, ngân hàng) — và chia phần dư cho ai đó thay vì làm mất.

## Cơ chế: vì sao `double` sai

`double` lưu số theo cơ số 2. `0.1` trong cơ số 2 là số vô hạn tuần hoàn, nên bị cắt bớt. Sai số nhỏ, nhưng **cộng dồn** thì lộ ra:

```java
double total = 0;
for (int i = 0; i < 10; i++) total += 0.1;
total;                 // 0.9999999999999999
total == 1.0;          // false

new BigDecimal(0.1);   // 0.1000000000000000055511151231257827021181583404541015625
BigDecimal.valueOf(0.1);   // 0.1  (đi qua Double.toString nên ra "0.1")
new BigDecimal("0.1");     // 0.1  ← cách an toàn nhất
```

`BigDecimal` = một số nguyên lớn (`unscaledValue`) + `scale` (số chữ số sau dấu phẩy). `new BigDecimal("1.20")` có unscaled `120`, scale `2`, precision `3`.

## Code bad / good

### Tạo và cộng

```java bad
double gia = 1499000.0 * 3 * 1.08;   // sai số tích luỹ, làm tròn lúc nào cũng không rõ
BigDecimal vat = new BigDecimal(0.08);   // mang sai số của double vào
```

```java good
BigDecimal price = new BigDecimal("1499000");
BigDecimal sub = price.multiply(new BigDecimal("3"));                 // 4497000
BigDecimal vat = sub.multiply(new BigDecimal("0.08"))
                    .setScale(0, RoundingMode.HALF_UP);              // 359760
BigDecimal total = sub.add(vat);                                      // 4856760
```

`BigDecimal` là **bất biến**: `sub.add(vat)` trả object mới, không sửa `sub`. Quên gán kết quả (`t.add(x);`) là lỗi rất hay gặp.

### Chia

```java bad
BigDecimal.ONE.divide(new BigDecimal("3"));
// ArithmeticException: Non-terminating decimal expansion; no exact representable decimal result.
```

```java good
BigDecimal.ONE.divide(new BigDecimal("3"), 4, RoundingMode.HALF_UP);   // 0.3333
```

### So sánh

```java bad
new BigDecimal("2.0").equals(new BigDecimal("2.00"));     // false — khác scale
Set.of(...) / HashSet chứa 2.0 và 2.00 → size 2
```

```java good
new BigDecimal("2.0").compareTo(new BigDecimal("2.00")) == 0;   // true
// Làm key của Map/Set: chuẩn hoá trước bằng setScale(…) hoặc stripTrailingZeros()
```

Cẩn thận: `new BigDecimal("100").stripTrailingZeros()` in ra `1E+2`. Hiển thị cho người dùng thì dùng `toPlainString()` → `100`.

## Chọn RoundingMode

Đã chạy thử `setScale(0, …)`:

| Giá trị | `HALF_UP` | `HALF_EVEN` (làm tròn ngân hàng) | `DOWN` |
|---|---|---|---|
| 2.5 | 3 | 2 | 2 |
| 3.5 | 4 | 4 | 3 |
| -2.5 | -3 | -2 | -2 |
| 2.45 (về 1 chữ số) | 2.5 | 2.4 | 2.4 |

- `HALF_UP`: cách "làm tròn ở trường", thường dùng cho hoá đơn, thuế.
- `HALF_EVEN`: số .5 làm tròn về **số chẵn** gần nhất, nên trên nhiều giao dịch sai số không lệch về một phía. Mặc định của `MathContext.DECIMAL64` và hay dùng trong tính toán ngân hàng.
- `DOWN`: cắt bỏ — hay dùng khi tính lãi trả khách ("không làm tròn lên có lợi cho khách").

`Math.round(-2.5)` cho **-2** (làm tròn về phía +∞), khác `HALF_UP` của `BigDecimal` (-3). Đừng trộn hai cách.

## Chia đều mà không mất đồng nào

Chia 100.000 đ cho 3 người, làm tròn từng phần: 33.333 × 3 = **99.999** — mất 1 đồng. Cách đúng: chia xuống, rồi dồn phần dư cho vài người đầu.

```java good title="ChiaDeu.java"
record Phan(String nguoi, BigDecimal soTien) {}

static List<Phan> chiaDeu(BigDecimal tong, List<String> nguoi) {
    BigDecimal n = BigDecimal.valueOf(nguoi.size());
    BigDecimal moi = tong.divide(n, 0, RoundingMode.DOWN);
    BigDecimal du = tong.subtract(moi.multiply(n));          // luôn < n
    List<Phan> kq = new ArrayList<>();
    for (int i = 0; i < nguoi.size(); i++) {
        BigDecimal phan = i < du.intValueExact() ? moi.add(BigDecimal.ONE) : moi;
        kq.add(new Phan(nguoi.get(i), phan));
    }
    return kq;
}
// chiaDeu(100000, [An, Bình, Chi]) → An 33334, Bình 33333, Chi 33333 — tổng đúng 100000
```

## Hiển thị VND

```java
NumberFormat vnd = NumberFormat.getCurrencyInstance(Locale.of("vi", "VN"));
vnd.format(new BigDecimal("4856760"));    // "4.856.760 ₫"
"%,d đ".formatted(1500000);               // "1,500,000 đ" — dấu phẩy vì locale mặc định là en
```

Định dạng chỉ ở tầng hiển thị. API trả JSON thì gửi số (hoặc chuỗi `"4856760"`) và để frontend định dạng.

## Pitfalls

- Quên gán kết quả: `total.add(x);` không làm gì cả.
- `BigDecimal` từ `double` (`new BigDecimal(d)`) hoặc tính bằng `double` rồi mới đổi sang `BigDecimal`.
- Làm tròn ở mỗi bước trung gian → sai số cộng dồn. Giữ đủ độ chính xác, làm tròn ở bước quyết định.
- Dùng `equals`/`hashCode` với giá trị khác scale (`HashSet`, key của `HashMap`).
- `long` theo đồng thì an toàn và nhanh, nhưng phép nhân có thể tràn: dùng `Math.multiplyExact`.

:::senior Góc nhìn senior
Ở dự án ngân hàng / bảo hiểm, quy tắc làm tròn là **yêu cầu nghiệp vụ**, không phải lựa chọn của dev: làm tròn ở bước nào, theo mode nào, phần dư về ai. Đóng gói nó vào một kiểu riêng (`record Money(BigDecimal amount, Currency currency)`), validate scale trong constructor, và viết test với những con số "khó" (.5, số âm, chia không hết). Ở tầng DB dùng `NUMERIC(p, s)`, không dùng `FLOAT`.
:::

:::version Java 17 / 21 / 25
API `BigDecimal` và `RoundingMode` gần như không đổi từ Java 8. `Locale.of("vi", "VN")` có từ **Java 19**; Java 17 dùng `new Locale("vi", "VN")` (constructor này đã deprecated từ 19). Ví dụ `void main()` trong bài cần Java 25.
:::

:::interview Vì sao không dùng `double` cho tiền? Thay bằng gì?
`double` là số dấu phẩy động cơ số 2 nên không biểu diễn chính xác phần lớn số thập phân như `0.1`; sai số cộng dồn khi cộng nhiều giao dịch (`0.1` cộng 10 lần ra `0.9999999999999999`). Thay bằng `BigDecimal` tạo từ chuỗi, với scale và `RoundingMode` đặt rõ ràng ở bước làm tròn; hoặc `long` theo đơn vị nhỏ nhất. So sánh bằng `compareTo` vì `equals` phân biệt scale.
:::

:::quiz `new BigDecimal("2.0").equals(new BigDecimal("2.00"))` và `compareTo` cho gì?
- [ ] `true` và `0`
- [x] `false` và `0`
- [ ] `false` và `-1`
- [ ] `true` và `-1`

`equals` so cả giá trị lẫn scale (1 và 2); `compareTo` chỉ so giá trị. Đã chạy thử.
:::

:::quiz `BigDecimal.ONE.divide(new BigDecimal("3"))` làm gì?
- [ ] Trả 0.3333333333
- [ ] Trả 0
- [x] Ném `ArithmeticException` vì kết quả thập phân vô hạn
- [ ] Trả 0.33 theo scale mặc định

Không truyền scale và `RoundingMode` thì `divide` đòi kết quả chính xác. Đã chạy thử.
:::

:::quiz Làm tròn 2.5 và 3.5 về số nguyên với `RoundingMode.HALF_EVEN`?
- [ ] 3 và 4
- [x] 2 và 4
- [ ] 2 và 3
- [ ] 3 và 3

Số đúng ở giữa thì về số chẵn gần nhất. Đã chạy thử.
:::

:::exercise Tính tiền lãi tiết kiệm
Viết `static BigDecimal tienLai(BigDecimal goc, BigDecimal laiSuatNam, LocalDate tu, LocalDate den)`: lãi = gốc × lãi suất năm × số ngày thực gửi / 365, **làm tròn xuống** tới đồng. Tính cho gốc 100.000.000 đ, lãi suất 5,5%/năm, gửi từ 15/01/2026 tới 15/07/2026.
???
```java
static BigDecimal tienLai(BigDecimal goc, BigDecimal laiSuatNam, LocalDate tu, LocalDate den) {
    long soNgay = ChronoUnit.DAYS.between(tu, den);          // 181
    return goc.multiply(laiSuatNam)
              .multiply(BigDecimal.valueOf(soNgay))
              .divide(BigDecimal.valueOf(365), 0, RoundingMode.DOWN);
}

tienLai(new BigDecimal("100000000"), new BigDecimal("0.055"),
        LocalDate.of(2026, 1, 15), LocalDate.of(2026, 7, 15));   // 2727397
```

Đã chạy thử: 181 ngày, lãi **2.727.397 đ** (giá trị chính xác 2.727.397,26…). Nhân hết rồi mới chia: chia `/365` trước sẽ ra số vô hạn và bắt bạn làm tròn sớm.
:::

:::exercise Chia đều phần dư
Dùng `chiaDeu` ở trên cho 100.001 đ và 4 người An, Bình, Chi, Dũng. Mỗi người nhận bao nhiêu? Viết thêm một kiểm tra rằng tổng các phần luôn bằng tổng ban đầu.
???
Mỗi phần chia xuống là 25.000, dư 1 → An 25.001, Bình/Chi/Dũng 25.000 (đã chạy thử). Kiểm tra tổng:

```java
BigDecimal sum = phan.stream().map(Phan::soTien).reduce(BigDecimal.ZERO, BigDecimal::add);
if (sum.compareTo(tong) != 0) throw new IllegalStateException("lệch " + tong.subtract(sum));
```

Đây là loại **invariant** nên có trong test (bài *Viết test với JUnit* có cách viết test tham số cho nhiều bộ số).
:::
