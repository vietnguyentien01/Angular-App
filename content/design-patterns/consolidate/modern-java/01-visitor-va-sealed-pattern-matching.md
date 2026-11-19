---
title: "Visitor và sealed pattern matching — thêm loại mới, thêm thao tác mới, và cái bẫy của default"
summary: "So sánh Visitor cổ điển với sealed interface + switch trên mô hình sản phẩm ngân hàng. Đã thử cả hai khi thêm sản phẩm trả góp: compiler chỉ đúng mọi chỗ cần sửa. Nhưng chỉ cần một nhánh default là trả góp lặng lẽ có lãi 0. Thêm guard when và lỗi case bị che. Đã chạy trên JDK 25."
level: intermediate
version: 25
lastReviewed: 2026-11-19
tags: [design-patterns, visitor, sealed, pattern-matching, java-21, java-25]
related: [design-patterns/review/modern-java/pattern-voi-lambda-record-sealed, design-patterns/consolidate/behavioral/strategy-va-state-thay-if-else]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

- **Visitor** giải bài toán: một tập **kiểu cố định**, nhiều **thao tác** thay đổi (tính lãi, xuất báo cáo, kiểm tra rủi ro) mà không nhét mọi thao tác vào từng class.
- Java 21+: `sealed interface` + `switch` pattern matching làm được điều đó với ít code hơn nhiều, và compiler vẫn báo **mọi chỗ** thiếu `case` khi thêm kiểu mới.
- **Đừng thêm `default`** vào switch trên sealed type: nó tắt kiểm tra đầy đủ. Đã thử: thêm `TraGop`, code biên dịch được và tính lãi trả góp = 0.
- `when` (guard) cho điều kiện phụ; `case` tổng quát phải đứng **sau** `case` có guard, nếu không compiler báo *dominated*.
- Khi tập kiểu **mở** (plugin, bên thứ ba thêm kiểu) thì sealed không phù hợp — dùng đa hình (method trên interface) hoặc Strategy.

## Cơ chế: bài toán của Visitor

Có hai trục thay đổi:

| | Thêm thao tác mới (xuất báo cáo) | Thêm kiểu mới (trả góp) |
|---|---|---|
| Đa hình thường (method trên mỗi class) | Sửa **mọi class** | Thêm một class |
| Visitor / sealed + switch | Thêm **một** visitor/hàm | Sửa **mọi** visitor/hàm — compiler chỉ chỗ |

Ngân hàng hiếm khi thêm loại sản phẩm (mỗi năm vài lần) nhưng liên tục thêm thao tác (báo cáo NHNN, tính dự phòng, xuất CIC). Đó là chỗ Visitor/sealed thắng.

## Visitor cổ điển

```java bad title="Visitor — nhiều code nghi lễ"
interface SanPhamV { <R> R chapNhan(VisitorSP<R> v); }
interface VisitorSP<R> { R tienGui(TienGuiV t); R vayV(VayV v); }

record TienGuiV(long soDu, int laiSuatBp) implements SanPhamV {
    public <R> R chapNhan(VisitorSP<R> v) { return v.tienGui(this); }      // double dispatch
}
record VayV(long duNo, int laiSuatBp) implements SanPhamV {
    public <R> R chapNhan(VisitorSP<R> v) { return v.vayV(this); }
}

class LaiThangV implements VisitorSP<Long> {
    public Long tienGui(TienGuiV t) { return t.soDu() * t.laiSuatBp() / 10_000 / 12; }
    public Long vayV(VayV v) { return -(v.duNo() * v.laiSuatBp() / 10_000 / 12); }
}
// visitor: [1000000, -4375000]
```

Thêm `TraGopV` (và method `traGop` vào `VisitorSP`):

```text
M2b.java:10: error: LaiThangV is not abstract and does not override abstract method traGop(TraGopV) in VisitorSP
```

Compiler bắt được — đó là ưu điểm thật của Visitor. Nhược điểm: method `chapNhan` trong mọi kiểu, interface visitor, double dispatch khó đọc với người mới.

## sealed + switch

```java good title="Cùng mô hình, Java 21+"
sealed interface SanPham permits TienGui, Vay, The {}
record TienGui(long soDu, int laiSuatBp) implements SanPham {}
record Vay(long duNo, int laiSuatBp) implements SanPham {}
record The(long duNo, long hanMuc) implements SanPham {}

static long laiThang(SanPham sp) {
    return switch (sp) {
        case TienGui(long soDu, int ls) -> soDu * ls / 10_000 / 12;
        case Vay(long duNo, int ls) -> -(duNo * ls / 10_000 / 12);
        case The(long duNo, long hm) when duNo == 0 -> 0;
        case The(long duNo, long hm) -> -(duNo * 2_800 / 10_000 / 12);
    };
}

static String moTa(SanPham sp) {
    return switch (sp) {
        case TienGui t when t.soDu() >= 1_000_000_000 -> "tiền gửi VIP";
        case TienGui t -> "tiền gửi";
        case Vay v -> "khoản vay";
        case The t -> "thẻ tín dụng (dùng " + (t.duNo() * 100 / t.hanMuc()) + "% hạn mức)";
    };
}
```

```text
tiền gửi: 1000000
khoản vay: -4375000
thẻ tín dụng (dùng 24% hạn mức): -280000
thẻ tín dụng (dùng 0% hạn mức): 0
tiền gửi VIP: 10833333
```

Lãi suất lưu bằng **basis point** (`600` = 6%) và tiền bằng `long` đồng — không dùng `double` cho tiền. Thêm thao tác mới (`moTa`) chỉ là thêm một hàm; các record không phải biết.

## Demo: thêm sản phẩm trả góp

Thêm `TraGop` vào `permits`:

```text
M2a.java:22: error: the switch expression does not cover all possible input values
    return switch (sp) {
           ^
M2a.java:31: error: the switch expression does not cover all possible input values
    return switch (sp) {
           ^
2 errors
```

Hai lỗi, đúng hai hàm cần sửa. Giờ thử thêm `default` vào cả hai switch "cho chắc", rồi thêm `TraGop`:

```java bad
case The t -> "thẻ tín dụng (...)";
default -> "khác";
```

```text
khác: 0
```

Biên dịch thành công, khoản trả góp 30 triệu được báo cáo là "khác" với lãi **0**. Đây là lỗi tệ nhất: không exception, không cảnh báo, số liệu sai đi thẳng vào báo cáo.

## Thứ tự case và guard

```java bad
case TienGui t -> "tiền gửi";
case TienGui t when t.soDu() >= 1_000_000_000 -> "tiền gửi VIP";
```

```text
M2c.java:32: error: this case label is dominated by a preceding case label
```

`case TienGui t` khớp mọi tiền gửi nên nhánh VIP không bao giờ chạy — compiler từ chối. Quy tắc: cụ thể trước, tổng quát sau. Nếu hai guard chồng nhau (`when soDu > 1 tỷ` rồi `when soDu > 500 triệu`) thì compiler **không** phát hiện được, phải tự sắp đúng.

## Pitfalls

- **`default` trên sealed type** — tắt kiểm tra đầy đủ (xem demo). Nếu cần nhánh "còn lại", liệt kê tường minh.
- **Sealed interface rồi để lớp con `non-sealed`** — mở lại hệ phân cấp, switch lại cần `default`.
- **Dùng sealed cho tập kiểu mở** (đối tác thêm loại thanh toán qua cấu hình) — không khả thi, mỗi lần thêm phải biên dịch lại. Dùng đa hình hoặc Strategy.
- **Logic dài trong mỗi `case`** — switch thành hàm 300 dòng. Mỗi `case` nên gọi một hàm có tên.
- **`switch` statement (không phải expression) trên sealed** — từ Java 21, switch statement dùng pattern cũng phải đầy đủ; nhưng switch kiểu cũ trên enum (không pattern) thì không. Ưu tiên switch **expression**.

:::senior Góc nhìn senior
Mô hình domain bằng sealed + record là cách "làm cho trạng thái sai không biểu diễn được": khoản vay không có field `hanMuc`, thẻ không có `laiSuatBp` cố định. Khi review, tìm `default ->` trong switch trên kiểu sealed hoặc enum quan trọng và hỏi "nếu thêm loại mới thì sao?". Một dòng `default` tiết kiệm 10 giây hôm nay có thể là một sự cố báo cáo sai sau một năm.
:::

:::version Java 17 / 21 / 22 / 25
Java 17: `sealed` chính thức, nhưng switch pattern matching còn preview. Java 21: record pattern (JEP 440) và switch pattern matching (JEP 441) chính thức — cách viết trong bài này chạy được từ 21. Java 22: `_` cho thành phần không dùng (`case The(long duNo, _)`). Java 25: primitive type trong pattern vẫn là preview (JEP 507). Dự án còn ở Java 17: dùng `if (sp instanceof TienGui t)` và tự giữ kỷ luật, hoặc Visitor cổ điển nếu cần compiler kiểm tra.
:::

:::interview Khi nào chọn sealed + switch, khi nào chọn đa hình (method trên mỗi class)?
Đa hình khi **tập kiểu mở hoặc hay thêm** và tập thao tác ít đổi: mỗi kiểu tự biết cách làm, thêm kiểu không sửa code cũ. Sealed + switch khi **tập kiểu đóng, ít đổi** và thao tác hay thêm (báo cáo, chuyển đổi, kiểm tra): thêm thao tác chỉ là thêm hàm, thêm kiểu thì compiler chỉ ra mọi switch cần sửa. Điều kiện để sealed phát huy: không có `default`.
:::

:::quiz Bạn thêm `record TraGop(long conLai, int soKy) implements SanPham` và thêm `TraGop` vào `permits`. Hàm `laiThang` dưới đây có nhánh `default -> 0`. Kết quả?
```java
sealed interface SanPham permits TienGui, Vay, The, TraGop {}

static long laiThang(SanPham sp) {
    return switch (sp) {
        case TienGui(long soDu, int ls) -> soDu * ls / 10_000 / 12;
        case Vay(long duNo, int ls) -> -(duNo * ls / 10_000 / 12);
        case The(long duNo, long hm) -> -(duNo * 2_800 / 10_000 / 12);
        default -> 0;
    };
}
```

- [ ] Lỗi biên dịch ở `laiThang`
- [x] Biên dịch được; trả góp được tính lãi 0
- [ ] Ném `MatchException` khi chạy
- [ ] Cảnh báo lúc biên dịch

Đã chạy: `khác: 0`. `default` khớp mọi thứ nên compiler không còn lý do báo thiếu `case`.
:::

:::quiz Vì sao compiler từ chối đoạn switch dưới đây (`TienGui` là record trong một sealed interface)?
```java
return switch (sp) {
    case TienGui t -> "tiền gửi";
    case TienGui t when t.soDu() >= 1_000_000_000 -> "tiền gửi VIP";
    case Vay v -> "khoản vay";
    case The t -> "thẻ tín dụng";
};
```

- [ ] Không được có hai case cùng kiểu
- [x] Case đầu khớp mọi `TienGui`, nên case có guard không bao giờ được chạy (dominated)
- [ ] Guard `when` phải đứng cuối switch
- [ ] Guard không dùng được với record

Đã chạy: *this case label is dominated by a preceding case label*. Đặt case cụ thể (có guard) trước.
:::

:::exercise Thêm thao tác "dự phòng rủi ro"
Viết `long duPhong(SanPham sp)` theo quy tắc: tiền gửi 0; khoản vay 1% dư nợ; thẻ tín dụng 2% dư nợ nếu dùng trên 80% hạn mức, còn lại 1%. Không dùng `default`. Sau đó thêm `TraGop(long conLai, int soKy)` và cho biết compiler báo những gì.
???
```java
static long duPhong(SanPham sp) {
    return switch (sp) {
        case TienGui t -> 0;
        case Vay(long duNo, int ls) -> duNo / 100;
        case The(long duNo, long hm) when duNo * 100 > hm * 80 -> duNo * 2 / 100;
        case The(long duNo, long hm) -> duNo / 100;
    };
}
```

Đã chạy: vay 500 triệu → 5.000.000; thẻ dư nợ 45/50 triệu (90%) → 900.000; thẻ 12/50 triệu → 120.000; tiền gửi → 0.

Thêm `TraGop` vào `permits` → mỗi hàm switch trên `SanPham` (`laiThang`, `moTa`, `duPhong`) báo *the switch expression does not cover all possible input values*. So sánh `duNo * 100 > hm * 80` thay vì chia để tránh làm tròn; với số tiền rất lớn cần `Math.multiplyExact` để phát hiện tràn `long`.
:::
