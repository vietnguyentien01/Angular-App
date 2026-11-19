---
title: "Builder và static factory đúng cách — tham số bắt buộc, kiểm tra một chỗ, object bất biến"
summary: "Constructor nhiều tham số cùng kiểu bị gọi nhầm thứ tự mà compiler im lặng. Viết Builder cho record khoản vay: tham số bắt buộc ở điểm vào, giá trị mặc định, kiểm tra trong compact constructor để mọi đường tạo object đều được kiểm, static factory có tên và method with. Đã chạy trên JDK 25."
level: intermediate
version: 25
lastReviewed: 2026-11-19
tags: [design-patterns, builder, static-factory, record, immutability]
related: [design-patterns/review/creational/factory-builder-singleton, design-patterns/review/modern-java/pattern-voi-lambda-record-sealed]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

- Constructor `(long, int, int, BigDecimal, String)` cho phép đổi chỗ hai `int` mà **không lỗi biên dịch** — lỗi chỉ lộ ra khi khách hàng nhận lịch trả nợ sai.
- Builder tốt: tham số **bắt buộc** ở điểm vào (`builder(soTien, kyHan)`), tham số tuỳ chọn có **giá trị mặc định**, method có tên theo nghiệp vụ.
- Đặt kiểm tra hợp lệ trong **compact constructor của record**, không chỉ trong `build()` — để mọi đường tạo object (builder, constructor, method `with`) đều được kiểm.
- **Static factory có tên** cho các cấu hình hay dùng: `KhoanVay.tinChapNhanh(soTien)`.
- Object bất biến: "sửa" = tạo object mới (`voiLaiSuat(...)`).

## Cơ chế: vì sao constructor dài nguy hiểm

```java bad title="KhoanVayCu.java"
class KhoanVayCu {
    KhoanVayCu(long soTien, int kyHanThang, int thoiGianAnHan, BigDecimal laiSuat, String taiSanBaoDam) { ... }
    KhoanVayCu(long soTien, int kyHanThang, BigDecimal laiSuat) { this(soTien, kyHanThang, 0, laiSuat, null); }
}

// ý định: kỳ hạn 24 tháng, ân hạn 6 tháng
new KhoanVayCu(500_000_000, 6, 24, new BigDecimal("0.1"), "Sổ đỏ");
// cũ, ý định kỳ hạn 24 ân hạn 6: kỳ hạn 6 tháng, ân hạn 24 tháng
```

Đây là *telescoping constructor*: mỗi tổ hợp tham số tuỳ chọn thêm một constructor, và tại nơi gọi không ai biết số `6` hay `24` là gì. IDE có hiện tên tham số, nhưng code review trên GitHub thì không.

## Code tốt: record + Builder

```java good title="KhoanVay.java"
record KhoanVay(long soTien, int kyHanThang, int anHanThang, BigDecimal laiSuatNam, String taiSanBaoDam) {
    KhoanVay {                                       // chạy với MỌI cách tạo object
        if (soTien <= 0) throw new IllegalArgumentException("số tiền phải > 0");
        if (kyHanThang < 1 || kyHanThang > 360) throw new IllegalArgumentException("kỳ hạn 1–360 tháng: " + kyHanThang);
        if (anHanThang < 0 || anHanThang >= kyHanThang)
            throw new IllegalArgumentException("ân hạn phải < kỳ hạn: " + anHanThang + "/" + kyHanThang);
        Objects.requireNonNull(laiSuatNam, "laiSuatNam");
    }

    Optional<String> baoDam() { return Optional.ofNullable(taiSanBaoDam); }   // tín chấp: không có tài sản

    KhoanVay voiLaiSuat(String nam) {               // "with" method: object mới, object cũ không đổi
        return new KhoanVay(soTien, kyHanThang, anHanThang, new BigDecimal(nam), taiSanBaoDam);
    }

    static KhoanVay tinChapNhanh(long soTien) {     // static factory có tên
        return builder(soTien, 12).laiSuat("0.18").build();
    }

    static Builder builder(long soTien, int kyHanThang) { return new Builder(soTien, kyHanThang); }

    static final class Builder {
        private final long soTien;                   // bắt buộc
        private final int kyHanThang;                // bắt buộc
        private int anHanThang = 0;                  // mặc định
        private BigDecimal laiSuatNam = new BigDecimal("0.105");
        private String taiSanBaoDam;

        private Builder(long soTien, int kyHanThang) { this.soTien = soTien; this.kyHanThang = kyHanThang; }
        Builder anHan(int thang) { this.anHanThang = thang; return this; }
        Builder laiSuat(String nam) { this.laiSuatNam = new BigDecimal(nam); return this; }
        Builder baoDamBang(String taiSan) { this.taiSanBaoDam = taiSan; return this; }
        KhoanVay build() { return new KhoanVay(soTien, kyHanThang, anHanThang, laiSuatNam, taiSanBaoDam); }
    }
}
```

## Demo (đã chạy trên JDK 25)

```java
var kv = KhoanVay.builder(500_000_000, 24).anHan(6).baoDamBang("Sổ đỏ").build();
KhoanVay.builder(500_000_000, 6).anHan(24).build();
KhoanVay.tinChapNhanh(50_000_000);
kv.voiLaiSuat("0.095");
new KhoanVay(500_000_000, 6, 24, new BigDecimal("0.1"), null);   // bỏ qua builder
```

```text
KhoanVay[soTien=500000000, kyHanThang=24, anHanThang=6, laiSuatNam=0.105, taiSanBaoDam=Sổ đỏ]
builder: ân hạn phải < kỳ hạn: 24/6
KhoanVay[soTien=50000000, kyHanThang=12, anHanThang=0, laiSuatNam=0.18, taiSanBaoDam=null]
0.105 → 0.095, cùng object? false
constructor: ân hạn phải < kỳ hạn: 24/6
```

Dòng cuối là lý do đặt kiểm tra trong compact constructor: constructor của record luôn `public` ngang với record, nên ai đó **sẽ** gọi thẳng nó, bỏ qua builder.

Java 25 chưa có cú pháp tạo bản sao record kiểu `kv with { laiSuatNam = ...; }` (JEP 468 vẫn đang ở giai đoạn đề xuất); viết `kv.with()` báo *cannot find symbol*. Hiện tại viết tay method `voiX` như trên.

## Pitfalls

- **Builder không kiểm tra gì**: `build()` chỉ gọi constructor, các trường bắt buộc có thể là `null`/`0`. Đưa tham số bắt buộc vào điểm vào của builder, hoặc kiểm tra trong `build()`/constructor.
- **Builder có setter rồi tái dùng giữa nhiều thread**: builder là object tạm, có trạng thái thay đổi — tạo mới cho mỗi lần dựng, không để thành field `static`.
- **Lombok `@Builder` trên class có field khởi tạo sẵn**: giá trị mặc định bị bỏ qua khi dùng builder nếu thiếu `@Builder.Default`. Kiểm tra code sinh ra (Delombok) hoặc viết builder tay cho domain quan trọng.
- **Builder cho object 2–3 trường**: thừa. `record` với constructor là đủ, tên field hiện ngay trong `toString`.
- **`Optional` làm field/tham số**: `Optional` dành cho **giá trị trả về**. Lưu `null` bên trong, lộ ra `Optional` qua method như `baoDam()`.

:::senior Góc nhìn senior
Builder trong code domain là chỗ thể hiện **ngôn ngữ nghiệp vụ**: `baoDamBang("Sổ đỏ")`, `anHan(6)` đọc như hợp đồng tín dụng. Còn test thì dùng một kiểu builder khác — *test data builder* (`khoanVayMau().kyHan(36).build()`) với mọi giá trị hợp lệ sẵn, mỗi test chỉ ghi đè trường nó quan tâm. Hai loại builder có mục đích khác nhau; đừng nhồi giá trị mặc định cho test vào builder production.
:::

:::version Java 8 / 16 / 25
Trước Java 16, builder thường đi kèm class có field `final`, getter, `equals`/`hashCode` viết tay (hoặc Lombok `@Value @Builder`). Từ Java 16, `record` lo phần dữ liệu và compact constructor lo kiểm tra, builder chỉ còn phần "đặt tên tham số". Trên Java 25, phần lớn record nhỏ không cần builder nữa.
:::

:::interview Khi nào dùng Builder, khi nào dùng static factory, khi nào dùng constructor?
Constructor (hoặc record) khi tham số ít và đều bắt buộc. Static factory khi cần **tên** nói lên ý nghĩa (`tinChapNhanh`, `Duration.ofSeconds`), khi có thể trả về object có sẵn/cache hoặc lớp con, hoặc khi có nhiều cách tạo cùng kiểu tham số. Builder khi có nhiều tham số tuỳ chọn hoặc nhiều tham số cùng kiểu dễ nhầm. Dù chọn cách nào, kiểm tra bất biến (invariant) ở **một nơi** mà mọi đường tạo object đều đi qua.
:::

:::quiz Vì sao đặt kiểm tra `anHanThang < kyHanThang` trong compact constructor thay vì chỉ trong `Builder.build()`?
- [ ] Compact constructor chạy nhanh hơn
- [x] Constructor của record luôn gọi được trực tiếp (và qua method `with`), nên kiểm tra ở `build()` có thể bị bỏ qua
- [ ] `build()` không được ném exception
- [ ] Compiler yêu cầu như vậy

Đã chạy: `new KhoanVay(500_000_000, 6, 24, ...)` bỏ qua builder vẫn bị chặn với "ân hạn phải < kỳ hạn: 24/6".
:::

:::quiz `kv` là một `KhoanVay` có lãi suất 0,105. Gọi `kv.voiLaiSuat("0.095")` trả về gì?
```java
record KhoanVay(long soTien, int kyHanThang, int anHanThang, BigDecimal laiSuatNam, String taiSanBaoDam) {
    KhoanVay voiLaiSuat(String nam) {
        return new KhoanVay(soTien, kyHanThang, anHanThang, new BigDecimal(nam), taiSanBaoDam);
    }
}
```

- [ ] Chính `kv` sau khi đổi lãi suất
- [x] Một `KhoanVay` mới có lãi suất 0,095; `kv` vẫn giữ 0,105
- [ ] `null` nếu lãi suất không đổi
- [ ] Lỗi biên dịch vì record bất biến

Đã chạy: `0.105 → 0.095, cùng object? false`. Object bất biến an toàn khi chia sẻ giữa các thread và làm key của `Map`.
:::

:::exercise Builder cho lệnh chuyển tiền
Thiết kế `record LenhChuyenTien(String tuTaiKhoan, String denTaiKhoan, long soTien, String noiDung, LocalDate ngayHieuLuc)`: hai tài khoản và số tiền bắt buộc; nội dung mặc định "Chuyen tien"; ngày hiệu lực mặc định là hôm nay; không được chuyển cho chính mình; nội dung tối đa 140 ký tự. Viết record + builder và chỉ ra các ca cần test.
???
```java
record LenhChuyenTien(String tuTaiKhoan, String denTaiKhoan, long soTien, String noiDung, LocalDate ngayHieuLuc) {
    LenhChuyenTien {
        Objects.requireNonNull(tuTaiKhoan); Objects.requireNonNull(denTaiKhoan); Objects.requireNonNull(ngayHieuLuc);
        if (tuTaiKhoan.equals(denTaiKhoan)) throw new IllegalArgumentException("không chuyển cho chính mình");
        if (soTien <= 0) throw new IllegalArgumentException("số tiền phải > 0");
        if (noiDung.length() > 140) throw new IllegalArgumentException("nội dung tối đa 140 ký tự");
    }
    static Builder tu(String tk, String den, long soTien, Clock dongHo) { return new Builder(tk, den, soTien, dongHo); }

    static final class Builder {
        private final String tu, den; private final long soTien;
        private String noiDung = "Chuyen tien";
        private LocalDate ngay;
        private Builder(String tu, String den, long soTien, Clock dongHo) {
            this.tu = tu; this.den = den; this.soTien = soTien; this.ngay = LocalDate.now(dongHo);
        }
        Builder noiDung(String nd) { this.noiDung = nd; return this; }
        Builder hieuLucNgay(LocalDate d) { this.ngay = d; return this; }
        LenhChuyenTien build() { return new LenhChuyenTien(tu, den, soTien, noiDung, ngay); }
    }
}
```

Đã chạy thử với `Clock.fixed(2026-11-16T03:00:00Z, Asia/Ho_Chi_Minh)`: lệnh mặc định có `noiDung=Chuyen tien, ngayHieuLuc=2026-11-16`; `001 → 001` báo "không chuyển cho chính mình"; nội dung 140 ký tự được nhận, 141 ký tự bị từ chối.

Nhận `Clock` thay vì gọi `LocalDate.now()` trực tiếp để test được "mặc định là hôm nay" (`Clock.fixed(...)`). Ca cần test: thiếu mỗi tham số bắt buộc, `tu == den`, số tiền 0 và âm, nội dung đúng 140 và 141 ký tự, ngày mặc định theo `Clock` cố định, và gọi thẳng constructor cũng bị kiểm tra.
:::
