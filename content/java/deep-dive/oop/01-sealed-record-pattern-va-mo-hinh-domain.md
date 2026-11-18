---
title: "Sealed, record pattern và mô hình hoá domain — data-oriented programming trong Java 21"
summary: "Sealed interface + record để mô hình 'một trong vài dạng', switch kiểm tra đủ trường hợp, record pattern lồng nhau, guard when; so sánh với method ảo; kiểm tra tham số trước super(...) trên Java 21; biến _ và flexible constructor body khi nâng cấp. Đã chạy trên JDK 21."
level: advanced
version: 21
lastReviewed: 2026-11-18
tags: [java, sealed, record, pattern-matching, domain-modeling, java-21]
related: [java/review/oop/class-interface-record-enum, java/consolidate/oop/equals-hashcode-va-ke-thua]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS: mọi ví dụ viết theo Java 21 (không dùng biến _), constructor kiểm tra tham số qua static method; biến _, flexible constructor body và primitive pattern chuyển thành phần nâng cấp."
---

## Tóm tắt nhanh

- **Sealed interface** liệt kê đóng các dạng có thể có (`permits`). Kết hợp với **record** cho mỗi dạng, ta có kiểu "tổng" (sum type) giống union trong TypeScript.
- `switch` trên kiểu sealed **không cần `default`**: compiler kiểm tra đủ trường hợp. Thêm một dạng mới → mọi `switch` chưa xử lý báo lỗi biên dịch.
- **Record pattern** (chính thức ở **Java 21**) tách thành phần ngay trong `case`, lồng được nhiều tầng. `when` thêm điều kiện. Trên Java 21 mọi thành phần phải có tên (`var dc`) — biến không tên `_` chỉ có từ Java 22.
- Chọn **method ảo** khi các dạng thay đổi nhiều nhưng thao tác ít đổi; chọn **sealed + switch** khi các dạng ổn định nhưng thao tác hay thêm.
- Trên Java 21, `super(...)` phải là câu lệnh đầu tiên của constructor: kiểm tra/chuẩn hoá tham số bằng static method gọi **bên trong** `super(...)`.

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
        case HoSo(var ma, DiaChi(var tinh, var phuong), Duyet(var han))
                when han.compareTo(new BigDecimal("500000000")) >= 0
            -> ma + " (" + tinh + "): duyệt hạn mức lớn " + han + ", cần cấp phó duyệt lại";
        case HoSo(var ma, var dc, Duyet(var han))    -> ma + ": duyệt " + han;
        case HoSo(var ma, var dc, TuChoi(var lyDo))  -> ma + ": từ chối — " + lyDo;
        case HoSo(var ma, var dc, CanBoSung(var ds)) -> ma + ": bổ sung " + String.join(", ", ds);
    };
}
```

Đã chạy thử trên JDK 21:

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
        case NoiBo n -> BigDecimal.ZERO;
        case LienNganHang(var tien, var nhanh) -> {
            BigDecimal p = tien.multiply(new BigDecimal(nhanh ? "0.0003" : "0.0002"))
                               .setScale(0, RoundingMode.HALF_UP);
            yield p.max(MIN).min(MAX);
        }
        case QuocTe q when q.tienTe().equals("USD") -> new BigDecimal("150000");
        case QuocTe q -> new BigDecimal("250000");
    };
}
// 5.000.000 nội bộ → 0; liên NH → 2000 (1000 < min); 500.000.000 Napas → 50000 (max); USD → 150000; EUR → 250000
// (đã chạy trên JDK 21 kèm 8 test JUnit, xem bài *Viết test với JUnit*)
```

## Tính năng mới theo phiên bản

| Phiên bản | Tính năng | Trạng thái |
|---|---|---|
| 16 | `record`, `instanceof` có biến | chính thức |
| 17 | `sealed` | chính thức |
| 21 | pattern trong `switch`, record pattern | chính thức |

Đó là bộ tính năng của **Java 21** — đủ để làm toàn bộ bài này.

### Kiểm tra tham số trước `super(...)` (Java 21)

Trên Java 21, `super(...)` phải là câu lệnh đầu tiên của constructor (viết `if` trước nó → lỗi *call to super must be first statement in constructor*, đã thử). Cách làm chuẩn: đưa việc kiểm tra và chuẩn hoá vào **static method** gọi bên trong lời gọi `super`:

```java
class QuanTri extends NguoiDung {
    final int capDo;
    QuanTri(String email, int capDo) {
        super(chuanHoa(email));                 // static method chạy trước khi NguoiDung được tạo
        this.capDo = kiemTraCapDo(capDo);
    }
    private static String chuanHoa(String email) { return email.strip().toLowerCase(); }
    private static int kiemTraCapDo(int c) {
        if (c < 1 || c > 3) throw new IllegalArgumentException("capDo 1..3");
        return c;
    }
}
new QuanTri("  Admin@Bank.VN ", 2).email;   // "admin@bank.vn" (đã chạy trên JDK 21)
```

Với record thì không có vấn đề này: compact constructor (`KhachHang { … }`) đã cho kiểm tra và chuẩn hoá trước khi gán field.

### Rẽ nhánh theo khoảng số (Java 21)

Pattern trong `switch` của Java 21 chỉ áp dụng cho kiểu **tham chiếu**: `case int d` báo lỗi *unexpected type* (đã thử). Xếp loại theo điểm dùng `if`/toán tử ba ngôi, hoặc `case Integer d when …` nếu giá trị là `Object`:

```java
String xepLoai = diem >= 80 ? "giỏi" : diem >= 65 ? "khá" : "khác";   // diem = 72 → "khá"
```

:::version 22+ Khi nâng lên Java 22 / 25
| Phiên bản | Tính năng | Trạng thái |
|---|---|---|
| 22 | biến không tên `_` (JEP 456) | chính thức |
| 25 | flexible constructor body (JEP 513) | chính thức |
| 25 | primitive pattern (`case int d when d >= 80`, JEP 507) | **preview** |

- **Biến `_`**: `case HoSo(var ma, _, Duyet(var han))`, `case NoiBo _` — bỏ qua thành phần không dùng, code gọn hơn. Trên Java 21 báo lỗi *unnamed variables are a preview feature and are disabled by default* (đã thử).
- **Flexible constructor body** (Java 25): được viết code **trước** `super(...)`, nên `QuanTri` ở trên viết thẳng được `if (capDo < 1 || capDo > 3) throw …; String chuan = email.strip().toLowerCase(); super(chuan);`. Trước `super(...)` vẫn **không** được đọc field hay gọi method của `this`.
- **Primitive pattern** (preview ở Java 25): `switch (diem) { case int d when d >= 80 -> "giỏi"; … }`. Preview **có thể đổi** ở bản sau — không dùng trong production.

Các ví dụ trong bài viết theo Java 21 vẫn biên dịch bình thường trên Java 25, nên không cần sửa gì khi nâng cấp.
:::

:::senior Góc nhìn senior
Đừng biến mọi thứ thành sealed hierarchy. Câu hỏi thiết kế: *tập các dạng có đóng và ổn định không, và ai sẽ thêm thao tác mới?* Một `sealed interface KetQua` cho kết quả xét duyệt là ranh giới nghiệp vụ rõ ràng, compiler bảo vệ. Còn danh sách loại sản phẩm do bộ phận kinh doanh thêm mỗi quý thì nên là dữ liệu (bảng cấu hình), không phải kiểu. Khi trả sealed type qua REST/JSON, nhớ cấu hình serializer (vd Jackson `@JsonTypeInfo` + `@JsonSubTypes`) để client biết dạng nào.
:::

:::quiz Thêm `record Huy(String nguoiHuy) implements KetQuaXet` và khai báo nó trong `permits`. Điều gì xảy ra với hàm `thongBao` ở trên?
- [ ] Vẫn chạy, `Huy` rơi vào case cuối
- [ ] Chạy được, gặp `Huy` thì ném `MatchException`
- [x] Lỗi biên dịch: switch không phủ hết giá trị — phải thêm `case HoSo(var ma, var dc, Huy(var ai))`
- [ ] Cảnh báo, không lỗi

Đây là lợi ích chính của sealed: mọi nơi cần cập nhật đều bị compiler chỉ ra.
:::

:::quiz Trong một `switch` trên `HoSo`, `case HoSo h -> …` đứng **trước** `case HoSo(var ma, var dc, Duyet(var han)) -> …`. Kết quả?
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
case ViDienTu v -> new BigDecimal("1100");
```

Nếu quên bước 2, `phi` báo *the switch expression does not cover all possible input values*. Không có `default` nên không có chuyện "lặng lẽ" tính phí 0 cho loại mới — đó là lý do không nên thêm `default` vào switch trên sealed type.
:::
