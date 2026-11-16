---
title: "Sealed, record pattern và mô hình hoá domain — data-oriented programming trong Java 21–25"
summary: "Dùng sealed interface + record để mô hình 'một trong vài dạng', switch có kiểm tra đủ trường hợp, record pattern lồng nhau và biến _, guard when; so sánh với cây kế thừa có method ảo; flexible constructor body của Java 25 và primitive pattern (preview). Mọi ví dụ đã chạy trên JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [java, sealed, record, pattern-matching, domain-modeling, java-25]
related: [java/review/oop/class-interface-record-enum, java/consolidate/oop/equals-hashcode-va-ke-thua]
---

## TL;DR

- **Sealed interface** liệt kê đóng các dạng có thể có (`permits`). Kết hợp với **record** cho mỗi dạng, ta có kiểu "tổng" (sum type) giống union trong TypeScript.
- `switch` trên kiểu sealed **không cần `default`**: compiler kiểm tra đủ trường hợp. Thêm một dạng mới → mọi `switch` chưa xử lý báo lỗi biên dịch.
- **Record pattern** tách thành phần ngay trong `case`, lồng được nhiều tầng. `_` bỏ qua thành phần không dùng (Java 22+). `when` thêm điều kiện.
- Chọn **method ảo** khi các dạng thay đổi nhiều nhưng thao tác ít đổi; chọn **sealed + switch** khi các dạng ổn định nhưng thao tác hay thêm.
- Java 25: được viết code **trước `super(...)`** trong constructor (JEP 513).

## Cơ chế: sealed + record + switch

```java title="KetQuaXet.java"
sealed interface KetQuaXet permits Duyet, TuChoi, CanBoSung {}
record Duyet(BigDecimal hanMuc) implements KetQuaXet {}
record TuChoi(String lyDo) implements KetQuaXet {}
record CanBoSung(List<String> giayTo) implements KetQuaXet {}

record DiaChi(String tinh, String phuong) {}
record HoSo(String ma, DiaChi diaChi, KetQuaXet ketQua) {}

static String thongBao(HoSo h) {
    return switch (h) {
        case HoSo(var ma, DiaChi(var tinh, _), Duyet(var han))
                when han.compareTo(new BigDecimal("500000000")) >= 0
            -> ma + " (" + tinh + "): duyệt hạn mức lớn " + han + ", cần cấp phó duyệt lại";
        case HoSo(var ma, _, Duyet(var han))    -> ma + ": duyệt " + han;
        case HoSo(var ma, _, TuChoi(var lyDo))  -> ma + ": từ chối — " + lyDo;
        case HoSo(var ma, _, CanBoSung(var ds)) -> ma + ": bổ sung " + String.join(", ", ds);
    };
}
```

Đã chạy thử:

```text
HS-01 (Hà Nội): duyệt hạn mức lớn 800000000, cần cấp phó duyệt lại
HS-01: duyệt 50000000
HS-01: từ chối — thu nhập không đủ
HS-01: bổ sung sao kê lương, HĐLĐ
```

Những gì compiler kiểm tra cho bạn:

- Thiếu một dạng → *the switch expression does not cover all possible input values*.
- Class ngoài `permits` cố implement → *class is not allowed to extend sealed class*.
- `case` nằm sau một `case` rộng hơn (vd `case HoSo h` trước `case HoSo(…, Duyet(…))`) → lỗi *dominated*.

Thứ tự `case` quan trọng: `case` có `when` phải đặt trước `case` cùng dạng không có điều kiện.

Các dạng của một sealed interface phải nằm cùng module (hoặc cùng package nếu không dùng module). Với record, khai báo cùng file hoặc cùng package là đủ.

## So sánh: method ảo hay sealed + switch?

```java title="Cách 1 — đa hình bằng method ảo"
interface Hinh { double dienTich(); }
record Tron(double r) implements Hinh { public double dienTich() { return Math.PI * r * r; } }
record Vuong(double a) implements Hinh { public double dienTich() { return a * a; } }
```

```java title="Cách 2 — dữ liệu + thao tác tách riêng"
sealed interface Hinh permits Tron, Vuong {}
record Tron(double r) implements Hinh {}
record Vuong(double a) implements Hinh {}

static double dienTich(Hinh h) {
    return switch (h) {
        case Tron(var r)  -> Math.PI * r * r;
        case Vuong(var a) -> a * a;
    };
}
```

| Tiêu chí | Method ảo | Sealed + switch |
|---|---|---|
| Thêm **dạng** mới | Dễ: thêm một class | Phải sửa mọi `switch` (compiler chỉ chỗ) |
| Thêm **thao tác** mới | Phải sửa mọi class | Dễ: thêm một hàm |
| Thao tác cần biết nhiều dạng cùng lúc (so 2 đối tượng) | Khó (double dispatch) | Dễ: `switch` trên cặp record |
| Dạng do bên ngoài mở rộng (plugin) | Phù hợp | Không — sealed là đóng |
| Hợp với | Hành vi phong phú, ổn định | Kết quả xử lý, message, sự kiện, lỗi nghiệp vụ |

Trong ứng dụng enterprise, sealed + record rất hợp cho **kết quả** (thay vì ném exception cho luồng nghiệp vụ bình thường), **sự kiện domain**, và **message giữa các service** — giống discriminated union mà dev TypeScript đã quen.

## Bài tập nhỏ đã chạy: phí chuyển khoản

Quy tắc giả định: nội bộ miễn phí; liên ngân hàng 0,02% (Napas 24/7: 0,03%), tối thiểu 2.000 đ, tối đa 50.000 đ; quốc tế USD 150.000 đ, ngoại tệ khác 250.000 đ.

```java
sealed interface GiaoDich permits NoiBo, LienNganHang, QuocTe {}
record NoiBo(BigDecimal soTien) implements GiaoDich {}
record LienNganHang(BigDecimal soTien, boolean napas247) implements GiaoDich {}
record QuocTe(BigDecimal soTien, String tienTe) implements GiaoDich {}

static BigDecimal phi(GiaoDich g) {
    return switch (g) {
        case NoiBo _ -> BigDecimal.ZERO;
        case LienNganHang(var tien, var nhanh) -> {
            BigDecimal p = tien.multiply(new BigDecimal(nhanh ? "0.0003" : "0.0002"))
                               .setScale(0, RoundingMode.HALF_UP);
            yield p.max(MIN).min(MAX);
        }
        case QuocTe(var tien, var tt) when tt.equals("USD") -> new BigDecimal("150000");
        case QuocTe(var tien, _) -> new BigDecimal("250000");
    };
}
// 5.000.000 nội bộ → 0; liên NH → 2000 (1000 < min); 500.000.000 Napas → 50000 (max); USD → 150000; EUR → 250000
```

## Tính năng mới theo phiên bản

| Phiên bản | Tính năng | Trạng thái |
|---|---|---|
| 16 | `record`, `instanceof` có biến | chính thức |
| 17 | `sealed` | chính thức |
| 21 | pattern trong `switch`, record pattern | chính thức |
| 22 | biến không tên `_` | chính thức |
| 25 | flexible constructor body (JEP 513) | chính thức |
| 25 | primitive pattern (`case int d when d >= 80`) | **preview** (JEP 507) |

Đã kiểm tra: ví dụ `HoSo` với `--source 21` báo *unnamed variables are not supported in -source 21*. Với Java 21, thay `_` bằng tên biến bất kỳ.

### Flexible constructor body (Java 25)

Trước Java 25, `super(...)` phải là câu lệnh đầu tiên, nên kiểm tra tham số phải nhét vào một static method. Giờ có thể kiểm tra và chuẩn hoá trước:

```java
class QuanTri extends NguoiDung {
    final int capDo;
    QuanTri(String email, int capDo) {
        if (capDo < 1 || capDo > 3) throw new IllegalArgumentException("capDo 1..3");
        String chuan = email.strip().toLowerCase();
        super(chuan);               // không còn bắt buộc là dòng đầu
        this.capDo = capDo;
    }
}
new QuanTri("  Admin@Bank.VN ", 2).email;   // "admin@bank.vn"
```

Trước `super(...)` vẫn **không** được đọc field hay gọi method của `this`. Đã thử `--release 21` và `24`: *flexible constructors is not supported*.

### Primitive pattern (preview trong Java 25)

```java
String xepLoai = switch (diem) {
    case int d when d >= 80 -> "giỏi";
    case int d when d >= 65 -> "khá";
    case int d -> "khác";
};
```

Chạy không có cờ → lỗi *primitive patterns are a preview feature*. Với `--enable-preview --source 25` chạy được. Tính năng preview **có thể đổi** ở bản sau — không dùng trong code production.

:::senior Góc nhìn senior
Đừng biến mọi thứ thành sealed hierarchy. Câu hỏi thiết kế: *tập các dạng có đóng và ổn định không, và ai sẽ thêm thao tác mới?* Một `sealed interface KetQua` cho kết quả xét duyệt là ranh giới nghiệp vụ rõ ràng, compiler bảo vệ. Còn danh sách loại sản phẩm do bộ phận kinh doanh thêm mỗi quý thì nên là dữ liệu (bảng cấu hình), không phải kiểu. Khi trả sealed type qua REST/JSON, nhớ cấu hình serializer (vd Jackson `@JsonTypeInfo` + `@JsonSubTypes`) để client biết dạng nào.
:::

:::quiz Thêm `record Huy(String nguoiHuy) implements KetQuaXet` và khai báo nó trong `permits`. Điều gì xảy ra với hàm `thongBao` ở trên?
- [ ] Vẫn chạy, `Huy` rơi vào case cuối
- [ ] Chạy được, gặp `Huy` thì ném `MatchException`
- [x] Lỗi biên dịch: switch không phủ hết giá trị — phải thêm `case HoSo(var ma, _, Huy(var ai))`
- [ ] Cảnh báo, không lỗi

Đây là lợi ích chính của sealed: mọi nơi cần cập nhật đều bị compiler chỉ ra.
:::

:::quiz Trong một `switch` trên `HoSo`, `case HoSo h -> …` đứng **trước** `case HoSo(var ma, _, Duyet(var han)) -> …`. Kết quả?
- [ ] Chạy bình thường, case sau không bao giờ chạy
- [x] Lỗi biên dịch: case sau bị case trước "dominate"
- [ ] Case cụ thể hơn được ưu tiên dù đứng sau
- [ ] Lỗi lúc chạy

Java yêu cầu case cụ thể đứng trước case tổng quát.
:::

:::exercise Thêm loại giao dịch mới
Thêm `record ViDienTu(BigDecimal soTien, String nhaCungCap) implements GiaoDich` (phí cố định 1.100 đ) vào ví dụ phí chuyển khoản. Bạn phải sửa những chỗ nào, và compiler báo gì nếu quên?
???
1. Thêm `ViDienTu` vào `permits` của `GiaoDich` (nếu quên: *class is not allowed to extend sealed class*).
2. Thêm nhánh vào `phi`:

```java
case ViDienTu _ -> new BigDecimal("1100");
```

Nếu quên bước 2, `phi` báo *the switch expression does not cover all possible input values*. Không có `default` nên không có chuyện "lặng lẽ" tính phí 0 cho loại mới — đó là lý do không nên thêm `default` vào switch trên sealed type.
:::
