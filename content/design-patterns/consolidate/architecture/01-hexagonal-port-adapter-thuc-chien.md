---
title: "Hexagonal thực chiến — use case duyệt vay, adapter bộ nhớ cho test và adapter PostgreSQL thật"
summary: "Viết use case duyệt vay chỉ phụ thuộc ba port (kho hồ sơ, tra cứu tín dụng, thông báo), chạy cùng một bộ hồ sơ với adapter bộ nhớ (8 ms) và adapter PostgreSQL 16 (131 ms) ra cùng kết quả. Cách lắp trong Spring, cách test và những chỗ hay làm sai. Đã chạy trên JDK 25."
level: intermediate
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, hexagonal, ports-and-adapters, testing, postgresql, architecture]
related: [design-patterns/review/architecture/layered-hexagonal-va-repository, design-patterns/deep-dive/principles/coupling-cohesion-va-ranh-gioi-module]
---

## Tóm tắt nhanh

- **Port ra** (driven): thứ use case cần từ bên ngoài — lưu trữ, tra cứu CIC, gửi thông báo. Domain định nghĩa interface.
- **Port vào** (driving): cách bên ngoài gọi use case — ở đây chính là class `DuyetVay` với method `xuLy`. Controller REST, job batch, consumer Kafka đều là **adapter vào** gọi nó.
- Cùng một use case chạy với adapter **bộ nhớ** (test, vài ms) và adapter **PostgreSQL** (production) — đã chạy, kết quả giống hệt nhau.
- Test quy tắc nghiệp vụ bằng adapter giả; test adapter riêng bằng Testcontainers. Đừng trộn hai loại.
- Adapter chịu trách nhiệm **dịch**: lỗi `SQLException` → exception của adapter, dòng DB ↔ record domain.

## Cơ chế: use case

```java good title="domain/DuyetVay.java"
public final class DuyetVay {
    private final KhoHoSo kho; private final TraCuuTinDung cic; private final ThongBao thongBao;
    public DuyetVay(KhoHoSo kho, TraCuuTinDung cic, ThongBao thongBao) { ... }

    public HoSoVay xuLy(String ma) {
        var hs = kho.tim(ma).orElseThrow(() -> new IllegalArgumentException("không có hồ sơ " + ma));
        if (hs.trangThai() != HoSoVay.TrangThai.CHO_DUYET) throw new IllegalStateException(ma + " đã xử lý: " + hs.trangThai());
        long traMoiThang = hs.soTienVay() / hs.kyHanThang();
        long tongNo = cic.tongTraNoThang(hs.cccd()) + traMoiThang;
        HoSoVay kq;
        if (cic.nhomNo(hs.cccd()) >= 3) kq = hs.tuChoi("nợ xấu nhóm " + cic.nhomNo(hs.cccd()));
        else if (tongNo * 100 > hs.thuNhapThang() * 50) kq = hs.tuChoi("DTI " + (tongNo * 100 / hs.thuNhapThang()) + "% > 50%");
        else kq = hs.duyet();
        kho.luu(kq);
        thongBao.gui(ma, kq.trangThai() + (kq.lyDo() == null ? "" : " — " + kq.lyDo()));
        return kq;
    }
}
```

`HoSoVay` là record bất biến với `duyet()`/`tuChoi(lyDo)` trả object mới. Không annotation JPA, không Spring.

## Hai adapter cho cùng một port

```java title="adapter/KhoBoNho.java"
public final class KhoBoNho implements Ports.KhoHoSo {
    private final Map<String, HoSoVay> du = new HashMap<>();
    public Optional<HoSoVay> tim(String ma) { return Optional.ofNullable(du.get(ma)); }
    public void luu(HoSoVay hs) { du.put(hs.ma(), hs); }
}
```

```java title="adapter/KhoPostgres.java (rút gọn)"
public final class KhoPostgres implements Ports.KhoHoSo {
    public Optional<HoSoVay> tim(String ma) {
        try (var c = kn(); var ps = c.prepareStatement(
                "select ma, cccd, thu_nhap, so_tien, ky_han, trang_thai, ly_do from hx.ho_so where ma = ?")) {
            ...                                   // ResultSet → new HoSoVay(...)
        } catch (SQLException e) { throw new IllegalStateException("lỗi đọc hồ sơ " + ma, e); }
    }
    public void luu(HoSoVay hs) {
        // insert ... on conflict (ma) do update set trang_thai = excluded.trang_thai, ly_do = excluded.ly_do
    }
}
```

## Demo: cùng ba hồ sơ, hai adapter

CIC giả: CCCD kết thúc bằng `9` là nợ nhóm 3; kết thúc bằng `5` đang trả nợ 8 triệu/tháng.

```text
[bộ nhớ] [HS1: DA_DUYET, HS2: TU_CHOI — nợ xấu nhóm 3, HS3: TU_CHOI — DTI 65% > 50%] (8 ms)
[bộ nhớ] HS1 đã xử lý: DA_DUYET
[postgres] [HS1: DA_DUYET, HS2: TU_CHOI — nợ xấu nhóm 3, HS3: TU_CHOI — DTI 65% > 50%] (131 ms)
[postgres] HS1 đã xử lý: DA_DUYET
```

HS3: thu nhập 20 triệu, khoản mới 120 triệu/24 tháng = 5 triệu/tháng, cộng 8 triệu đang trả = 13 triệu = 65% thu nhập. Thời gian Postgres gồm cả mở kết nối không có pool (mỗi lời gọi một kết nối) — adapter production sẽ dùng `DataSource` có pool.

## Lắp trong Spring

```java title="Cấu hình — nơi duy nhất biết cả domain lẫn adapter"
@Configuration
class CauHinhVay {
    @Bean DuyetVay duyetVay(KhoHoSo kho, TraCuuTinDung cic, ThongBao tb) { return new DuyetVay(kho, cic, tb); }
}

@Repository class KhoJdbc implements Ports.KhoHoSo { /* JdbcClient */ }
@Component class CicHttp implements Ports.TraCuuTinDung { /* RestClient + timeout */ }

@RestController class HoSoController {                 // adapter vào
    private final DuyetVay duyetVay;
    @PostMapping("/ho-so/{ma}/duyet") HoSoDto duyet(@PathVariable String ma) { return HoSoDto.tu(duyetVay.xuLy(ma)); }
}
```

`@Transactional` đặt ở đâu? Ở adapter vào (controller/service ứng dụng bọc use case) hoặc một decorator quanh use case — không đặt annotation Spring trong domain nếu muốn domain độc lập framework. Nhiều đội chấp nhận `@Transactional` trong lớp service ứng dụng mỏng gọi domain: thực dụng, ít lớp hơn.

## Pitfalls

- **Port theo hình dạng bảng DB** (`findByCccdAndTrangThaiOrderByNgayTaoDesc`): port nên nói ngôn ngữ nghiệp vụ (`hoSoDangChoCua(cccd)`).
- **Adapter giả quá thông minh**: `KhoBoNho` mà có logic lọc, phân trang riêng sẽ khác hành vi thật. Giữ đơn giản và có **một bộ test hợp đồng** chạy với cả hai adapter.
- **Lộ exception kỹ thuật**: `SQLException` đi thẳng tới use case làm domain phụ thuộc JDBC ngầm. Adapter đổi thành exception của nó.
- **Mapping hai chiều khắp nơi**: entity ↔ domain ↔ DTO cho mọi bảng là over-engineering với phần CRUD. Áp dụng hexagonal cho **lõi nghiệp vụ**, phần quản trị CRUD để layered.
- **Gọi hệ thống ngoài trong vòng lặp domain** (CIC gọi 2 lần cho một hồ sơ như code trên: `nhomNo` hai lần) — adapter thật thì là hai request mạng. Lấy kết quả một lần vào biến.

:::senior Góc nhìn senior
Giá trị lớn nhất của hexagonal không phải "đổi được DB" (hiếm khi xảy ra) mà là **tốc độ phản hồi khi sửa quy tắc**: quy tắc duyệt vay đổi mỗi quý theo chính sách tín dụng, và đội chạy hàng trăm ca kiểm thử nghiệp vụ trong vài giây. Thứ hai là **cô lập đối tác**: CIC, core banking, cổng thanh toán đổi API — chỉ một adapter đổi theo. Nếu dự án không có hai nhu cầu này, đừng trả chi phí của hexagonal.
:::

:::version Java 17 / 21 / 25
Record cho `HoSoVay` (Java 16), text block cho SQL trong adapter (Java 15), `sealed interface KetQuaDuyet permits DaDuyet, TuChoi` làm kết quả use case có kiểu rõ ràng (Java 17/21). Spring Framework 6.1+ có `JdbcClient` — adapter JDBC gọn hơn `JdbcTemplate`.
:::

:::interview Bạn test use case trong kiến trúc hexagonal thế nào?
Hai lớp test. (1) **Test use case** với adapter giả (bộ nhớ, stub CIC): nhanh, nhiều ca, tập trung vào quy tắc — DTI biên 50%, nợ nhóm 2/3, hồ sơ đã xử lý. (2) **Test adapter** với hạ tầng thật qua Testcontainers: SQL đúng, mapping đúng, xử lý lỗi kết nối. Thêm một bộ **test hợp đồng** chung chạy với cả adapter giả và adapter thật để chắc chắn adapter giả cư xử giống thật. Cuối cùng vài test end-to-end qua REST cho luồng chính.
:::

:::quiz Bạn muốn thêm cửa vào "duyệt hàng loạt từ file CSV mỗi đêm". Theo hexagonal, cần sửa gì?
- [ ] Sửa `DuyetVay` để đọc CSV
- [x] Thêm một adapter vào (job batch) đọc CSV và gọi `duyetVay.xuLy(ma)`; use case không đổi
- [ ] Thêm port ra `DocCsv` vào domain
- [ ] Viết lại `KhoPostgres`

Cửa vào mới là adapter vào. Use case giữ nguyên, nên quy tắc duyệt giống hệt giữa REST và batch.
:::

:::quiz Vì sao `KhoBoNho` chạy 8 ms còn `KhoPostgres` 131 ms cho cùng ba hồ sơ, và điều đó nói gì về chiến lược test?
- [ ] Postgres sai
- [x] Adapter thật tốn I/O và kết nối; quy tắc nghiệp vụ nên test bằng adapter giả, adapter thật test riêng với số ca ít hơn
- [ ] Nên bỏ test với Postgres
- [ ] Phải dùng H2 thay Postgres

Hàng trăm ca quy tắc × hàng trăm ms là vài phút; với adapter giả là vài giây. Nhưng vẫn cần test adapter thật (H2 khác Postgres ở nhiều chỗ, như `on conflict`).
:::

:::exercise Test hợp đồng cho port KhoHoSo
Viết một lớp test trừu tượng `KhoHoSoContract` để chạy **cùng các ca** cho `KhoBoNho` và `KhoPostgres`: tìm hồ sơ không có, lưu rồi tìm, lưu đè cập nhật trạng thái.
???
```java
abstract class KhoHoSoContract {
    abstract Ports.KhoHoSo taoKho();                       // mỗi lớp con trả adapter của mình

    final HoSoVay mau = new HoSoVay("HS1", "001203004561", 30_000_000, 240_000_000, 24, HoSoVay.TrangThai.CHO_DUYET, null);

    @Test void khongCo() { assertThat(taoKho().tim("KHONG_CO")).isEmpty(); }

    @Test void luuRoiTim() {
        var kho = taoKho();
        kho.luu(mau);
        assertThat(kho.tim("HS1")).contains(mau);
    }

    @Test void luuDeCapNhat() {
        var kho = taoKho();
        kho.luu(mau);
        kho.luu(mau.tuChoi("DTI 65% > 50%"));
        assertThat(kho.tim("HS1")).get().extracting(HoSoVay::trangThai, HoSoVay::lyDo)
            .containsExactly(HoSoVay.TrangThai.TU_CHOI, "DTI 65% > 50%");
    }
}

class KhoBoNhoTest extends KhoHoSoContract { Ports.KhoHoSo taoKho() { return new KhoBoNho(); } }

@Testcontainers
class KhoPostgresTest extends KhoHoSoContract {
    @Container static PostgreSQLContainer pg = new PostgreSQLContainer("postgres:16");
    Ports.KhoHoSo taoKho() { /* tạo schema sạch rồi */ return new KhoPostgres(dataSourceTu(pg)); }
}
```

(Bản trong bài nhận URL và dùng user cố định cho gọn; adapter production nhận `DataSource` để test truyền được thông tin kết nối của container.)

Đã chạy ba ca hợp đồng này (bằng một `main` thay cho JUnit) với cả hai adapter trên PostgreSQL 16: `khongCo=true luuRoiTim=true luuDeCapNhat=true` cho cả `KhoBoNho` và `KhoPostgres`.

So sánh `contains(mau)` dựa vào `equals` của record — đọc từ DB ra phải bằng hệt object đã lưu (kể cả `lyDo = null`). Nếu adapter Postgres trả chuỗi rỗng thay cho `null`, test hợp đồng bắt được ngay. Mỗi khi phát hiện khác biệt giữa adapter giả và thật, thêm một ca vào hợp đồng.
:::
