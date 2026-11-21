---
title: "God class và Service Locator — phụ thuộc ẩn, test rò trạng thái và cách tách dần"
summary: "Service Locator giấu phụ thuộc: thiếu đăng ký chỉ lộ ra lúc chạy, và registry toàn cục làm test sau nhận tỷ giá giả của test trước (mong 250.000, nhận 10). Sửa bằng constructor injection, rồi tách God class theo lý do thay đổi qua từng bước nhỏ. Đã chạy trên JDK 25."
level: intermediate
version: 25
lastReviewed: 2026-11-19
tags: [design-patterns, anti-pattern, god-class, service-locator, dependency-injection, refactoring]
related: [design-patterns/review/anti-patterns/anti-pattern-thuong-gap, design-patterns/consolidate/frameworks/tu-viet-mini-di-container]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

- **Service Locator**: class tự "xin" phụ thuộc từ một registry toàn cục (`DichVu.lay(TyGia.class)`). Nhìn constructor không biết class cần gì; thiếu đăng ký chỉ nổ khi chạy tới đúng dòng đó.
- Registry toàn cục là **state dùng chung giữa các test**: test sau nhận cấu hình giả của test trước — đã tái hiện.
- **Constructor injection** làm phụ thuộc hiện rõ, thiếu thì không tạo được object, mỗi test tự tạo object với phụ thuộc giả của mình.
- **God class** thường đi kèm: 20 phụ thuộc lấy từ locator, 3.000 dòng, mọi tính năng đều sửa nó.
- Tách God class **dần dần**: tìm cụm method dùng chung một nhóm field/phụ thuộc → tách thành class mới → class cũ uỷ quyền → chuyển dần nơi gọi.

## Cơ chế: phụ thuộc ẩn

```java bad title="Service Locator"
final class DichVu {
    private static final Map<Class<?>, Object> REG = new HashMap<>();
    static <T> void dat(Class<T> k, T v) { REG.put(k, v); }
    static <T> T lay(Class<T> k) { ... throw new IllegalStateException("chưa đăng ký " + k.getSimpleName()); }
}

class BaoCaoLocator {                          // constructor rỗng: trông như không cần gì
    String tao(long usd) {
        long vnd = usd * DichVu.lay(TyGia.class).usd();
        DichVu.lay(Email.class).gui("báo cáo: " + vnd);
        return "đã gửi " + vnd;
    }
}
```

```java good title="Constructor injection"
class BaoCao {
    private final TyGia tyGia; private final Email email;
    BaoCao(TyGia tyGia, Email email) { this.tyGia = tyGia; this.email = email; }
    String tao(long usd) { ... }
}
```

## Demo: ba "test" chạy liên tiếp

```java
// test 1: quên đăng ký Email
DichVu.dat(TyGia.class, () -> 25_000);
new BaoCaoLocator().tao(10);

// test 2: dùng tỷ giá giả = 1 cho một ca đặc biệt
DichVu.dat(TyGia.class, () -> 1);
DichVu.dat(Email.class, hopThu::add);
new BaoCaoLocator().tao(10);

// test 3: tưởng đang dùng tỷ giá 25.000
new BaoCaoLocator().tao(10);
```

```text
test 1: chưa đăng ký Email
test 2: đã gửi 10
test 3 (mong 250000): đã gửi 10  ← rò trạng thái từ test 2
DI: đã gửi 250000 [báo cáo: 250000]
```

Test 3 **pass hay fail tuỳ thứ tự chạy**: chạy riêng thì lỗi "chưa đăng ký", chạy sau test 2 thì nhận tỷ giá 1. JUnit không đảm bảo thứ tự method, và Maven Surefire có thể chạy song song — đây là nguồn của test "lúc xanh lúc đỏ" (flaky). Với constructor injection, mỗi test `new BaoCao(tyGiaGia, emailGia)` — không có gì dùng chung.

## Tách God class từng bước

```java bad title="DonHangService — 3.000 dòng, 18 phụ thuộc"
@Service
class DonHangService {
    // kho, thanhToan, tyGia, khuyenMai, email, sms, vanChuyen, hoaDon, keToan, ...
    DonHang dat(...)            { /* kiểm tra kho, tính giá, khuyến mãi, thuế, trừ tiền, gửi email */ }
    long tinhGia(...)           { ... }
    long apKhuyenMai(...)       { ... }
    void guiEmailXacNhan(...)   { ... }
    void guiSms(...)            { ... }
    HoaDon xuatHoaDon(...)      { ... }
    void dongBoKeToan(...)      { ... }
    BaoCao baoCaoThang(...)     { ... }
}
```

Các bước, mỗi bước một PR có test xanh:

1. **Tìm cụm**: nhóm method dùng chung field/phụ thuộc. `tinhGia`, `apKhuyenMai` dùng `tyGia`, `khuyenMai` → cụm "định giá". `guiEmailXacNhan`, `guiSms` dùng `email`, `sms` → cụm "thông báo".
2. **Tách class, giữ chữ ký cũ**: tạo `DinhGia` chứa hai method; `DonHangService.tinhGia(...)` giờ chỉ gọi `dinhGia.tinhGia(...)`. Nơi gọi chưa phải đổi.
3. **Chuyển nơi gọi** sang `DinhGia` trực tiếp, xoá method uỷ quyền.
4. Lặp lại cho cụm khác. Phần thông báo nên thành **sự kiện** (`DonHangDaDat`) để `dat()` không còn phụ thuộc email/SMS.

```java good title="Sau vài bước"
@Service
class DatHang {                                   // còn 4 phụ thuộc
    private final KhoHang kho; private final DinhGia dinhGia;
    private final ThanhToan thanhToan; private final ApplicationEventPublisher suKien;
    DonHang dat(...) {
        kho.giu(...);
        var gia = dinhGia.tinh(...);
        thanhToan.tru(...);
        suKien.publishEvent(new DonHangDaDat(...));   // thông báo, hoá đơn, kế toán tự nghe
        ...
    }
}
```

## Pitfalls

- **Service Locator đội lốt**: `ApplicationContext.getBean(X.class)` hay `@Autowired ApplicationContext` trong code nghiệp vụ là Service Locator. Chỉ chấp nhận ở code hạ tầng (factory chọn bean theo tên lúc chạy — mà ngay cả khi đó, tiêm `Map<String, X>` vẫn tốt hơn).
- **Static method tiện ích gọi hạ tầng** (`AuditUtil.ghi(...)` mở kết nối DB bên trong): cùng vấn đề phụ thuộc ẩn.
- **Tách God class một lần**: PR 5.000 dòng không review nổi, xung đột với mọi nhánh khác. Tách dần.
- **Tách theo tầng kỹ thuật** (`DonHangValidator`, `DonHangMapper`, `DonHangHelper`) thay vì theo nghiệp vụ: số file tăng, coupling giữ nguyên.
- **Constructor 12 tham số sau khi bỏ locator**: không phải lỗi của DI — DI chỉ làm lộ ra class đang làm quá nhiều việc. Đó là tín hiệu tách tiếp.

:::senior Góc nhìn senior
Chỉ số thực dụng để tìm God class: lịch sử git. `git log --format= --name-only | sort | uniq -c | sort -rn | head` cho biết file nào bị sửa nhiều nhất; file vừa dài vừa nằm đầu danh sách là nơi tốn chi phí nhất của đội — mọi PR đều đụng nó, xung đột merge liên tục. Ưu tiên tách những file đó, không phải file dài nhưng không ai sửa.
:::

:::version Java 8 / 17 / 25
Không phụ thuộc phiên bản Java. Spring từ 4.3 không cần `@Autowired` khi class có một constructor; Spring Boot 2.6+ mặc định **cấm** vòng phụ thuộc giữa bean — thường lộ ra đúng lúc bạn bỏ Service Locator và chuyển sang constructor injection, vì locator đã che vòng đó đi.
:::

:::interview Vì sao Service Locator được coi là anti-pattern trong khi nó cũng giúp tách cài đặt khỏi interface?
Nó tách được cài đặt, nhưng **giấu phụ thuộc**: chữ ký class không cho biết cần gì, thiếu đăng ký chỉ lỗi lúc chạy, registry toàn cục là state chung làm test phụ thuộc thứ tự, và mọi class phụ thuộc vào chính locator. Constructor injection đạt cùng mục tiêu (tách cài đặt) mà phụ thuộc hiện rõ, kiểm tra được khi khởi động, và test chỉ cần `new`.
:::

:::quiz Ba test chạy liên tiếp trong cùng JVM, dùng chung Service Locator toàn cục. Test 3 mong nhận 250.000 nhưng nhận "đã gửi 10". Nguyên nhân?
```java
// registry toàn cục: static Map<Class<?>, Object>
class BaoCaoLocator {
    String tao(long usd) {
        long vnd = usd * DichVu.lay(TyGia.class).usd();   // tự lấy phụ thuộc từ registry
        DichVu.lay(Email.class).gui("báo cáo: " + vnd);
        return "đã gửi " + vnd;
    }
}

// test 1
DichVu.dat(TyGia.class, () -> 25_000);
// test 2: dùng tỷ giá giả cho một ca đặc biệt
DichVu.dat(TyGia.class, () -> 1);
DichVu.dat(Email.class, hopThu::add);
// test 3: không đăng ký gì, tưởng đang dùng tỷ giá 25.000
new BaoCaoLocator().tao(10);
```

- [ ] Lỗi làm tròn
- [x] Registry toàn cục vẫn giữ tỷ giá giả = 1 mà test 2 đăng ký
- [ ] JUnit chạy song song
- [ ] `TyGia` là lambda

Đã chạy: state toàn cục sống qua các test. Chạy test 3 một mình thì lại nhận "chưa đăng ký Email".
:::

:::quiz `DonHangService` là God class 3.000 dòng; method `tinhGia(...)` của nó đang được gọi ở 15 chỗ. Bước đầu tiên an toàn nhất để tách phần tính giá ra?
- [ ] Xoá `tinhGia` và sửa mọi nơi gọi trong cùng PR
- [x] Tạo `DinhGia`, chuyển logic sang đó, để `DonHangService.tinhGia` uỷ quyền sang `DinhGia` — nơi gọi chưa cần đổi
- [ ] Đổi `tinhGia` thành static
- [ ] Viết lại `DonHangService` từ đầu

Giữ chữ ký cũ làm PR nhỏ và test hiện có vẫn chạy. Chuyển nơi gọi ở PR sau.
:::

:::exercise Gỡ Service Locator khỏi một class
```java
class XuatHoaDon {
    HoaDon xuat(String maDon) {
        var don = DichVu.lay(KhoDonHang.class).tim(maDon);
        var thue = DichVu.lay(CauHinh.class).thueVat();
        var hd = new HoaDon(don, thue);
        DichVu.lay(KhoHoaDon.class).luu(hd);
        if (DichVu.lay(CauHinh.class).guiEmail()) DichVu.lay(Email.class).gui(don.email(), hd);
        return hd;
    }
}
```
Viết lại bằng constructor injection và nêu những gì test dễ hơn.
???
```java
final class XuatHoaDon {
    private final KhoDonHang khoDon; private final KhoHoaDon khoHoaDon;
    private final CauHinhHoaDon cauHinh; private final Email email;

    XuatHoaDon(KhoDonHang khoDon, KhoHoaDon khoHoaDon, CauHinhHoaDon cauHinh, Email email) {
        this.khoDon = khoDon; this.khoHoaDon = khoHoaDon; this.cauHinh = cauHinh; this.email = email;
    }

    HoaDon xuat(String maDon) {
        var don = khoDon.tim(maDon).orElseThrow(() -> new IllegalArgumentException("không có đơn " + maDon));
        var hd = new HoaDon(don, cauHinh.thueVat());
        khoHoaDon.luu(hd);
        if (cauHinh.guiEmail()) email.gui(don.email(), hd);
        return hd;
    }
}

record CauHinhHoaDon(BigDecimal thueVat, boolean guiEmail) {}   // chỉ phần cấu hình class này cần
```

Test dễ hơn: (1) nhìn constructor biết ngay cần 4 thứ; (2) mỗi test `new XuatHoaDon(khoGia, khoHdGia, new CauHinhHoaDon(new BigDecimal("0.08"), false), emailGia)` — không đăng ký, không dọn registry, chạy song song được; (3) ca "không gửi email" chỉ cần `guiEmail=false` và kiểm `emailGia` không được gọi; (4) thiếu phụ thuộc là lỗi biên dịch, không phải lỗi lúc chạy. `CauHinhHoaDon` thay cho `CauHinh` chung khổng lồ — Interface Segregation áp dụng cho cấu hình.
:::
