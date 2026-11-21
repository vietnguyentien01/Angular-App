---
title: "Lỗi DI và cấu hình thường gặp — đọc thông báo lỗi khởi động và sửa đúng"
summary: "Tái hiện và đọc các lỗi khởi động: hai bean cùng kiểu, phụ thuộc vòng tròn, placeholder viết sai, cấu hình sai kiểu; rồi hai lỗi không báo gì: prototype bị inject một lần vào singleton và object tự new bỏ qua injection. Chạy trên Spring Boot 4.1.2."
level: intermediate
version: 4
lastReviewed: 2026-11-21
tags: [spring-boot, dependency-injection, troubleshooting, pitfalls]
related: [spring-boot/review/core/bean-di-va-cau-hinh, spring-boot/deep-dive/core/auto-configuration-hoat-dong-the-nao]
changelog:
  - date: 2026-11-21
    note: "Chuyển dự án mẫu sang Java 21; chạy lại các lỗi khởi động (hai bean, vòng phụ thuộc, placeholder, Duration, ghi đè bean) và prototype trên JDK 21, thông báo không đổi."
---

## Tóm tắt nhanh

- Spring Boot in lỗi khởi động theo khuôn **Description / Action** — đọc phần `Description` trước, nó thường nói đúng chỗ sai.
- Hai bean cùng kiểu → chọn rõ bằng `@Qualifier`, `@Primary`, hoặc nhận `List<…>`/`Map<String, …>` nếu thật sự cần tất cả.
- Phụ thuộc vòng tròn bị **chặn mặc định**. Đó là lỗi thiết kế — tách trách nhiệm, đừng bật `allow-circular-references`.
- Cấu hình sai (sai tên key, sai kiểu, vi phạm ràng buộc) nên làm ứng dụng **không khởi động được**: dùng `@ConfigurationProperties` + `@Validated`.
- Hai lỗi **không báo gì**: bean `prototype` inject vào singleton chỉ được tạo một lần; object tạo bằng `new` không được inject.

## Cơ chế: Spring tạo bean thế nào

1. Quét class có annotation và đọc các `@Bean` → tạo **bean definition**.
2. Sắp xếp theo phụ thuộc, tạo từng bean, truyền phụ thuộc qua constructor.
3. Chạy các bước hậu xử lý (bọc proxy cho `@Transactional`, `@Async`…).
4. Mọi bean singleton được tạo **khi khởi động** — nên lỗi lộ ra sớm.

Không tìm được đúng **một** bean phù hợp cho một tham số → khởi động thất bại.

Mọi output dưới đây đã chạy với dự án `di-lab` (Spring Boot 4.1.2, Java 21). Đường dẫn file trong output đã được rút gọn.

## Hai bean cùng kiểu

```java bad
interface GuiThongBao { String gui(String noiDung); }
@Component("sms")   class GuiSms implements GuiThongBao { … }
@Component("email") class GuiEmail implements GuiThongBao { … }

@Service class DatHang { DatHang(GuiThongBao g) { … } }
```

```text
APPLICATION FAILED TO START
Description:
Parameter 0 of constructor in vn.hoc.lab.LabApp$DatHang1 required a single bean, but 2 were found:
	- email: defined in URL [… LabApp$GuiEmail.class]
	- sms: defined in URL [… LabApp$GuiSms.class]
This may be due to missing parameter name information
```

```java good
@Service class DatHang {
    DatHang(@Qualifier("email") GuiThongBao g, List<GuiThongBao> tatCa) { … }
}
// Qualifier → Email: đơn D1 | List có 2 bean
```

`@Primary` trên một bean nghĩa là "mặc định dùng cái này". Muốn chọn theo cấu hình lúc chạy thì nhận `Map<String, GuiThongBao>` (key là tên bean) và tra theo tên.

## Phụ thuộc vòng tròn

```java bad
@Service class A { A(B b) {} }
@Service class B { B(A a) {} }
```

```text
The dependencies of some of the beans in the application context form a cycle:
┌─────┐
|  labApp.A defined in URL […]
↑     ↓
|  labApp.B defined in URL […]
└─────┘
```

Thường gặp: `DonHangService` gọi `KhachHangService` để lấy hạng thành viên, `KhachHangService` gọi lại `DonHangService` để tính tổng chi tiêu. Sửa: tách phần dùng chung ra class thứ ba (vd `ThongKeChiTieu`), hoặc dùng sự kiện (`ApplicationEventPublisher`) cho chiều ngược lại.

## Cấu hình sai

```java bad
@Service class C { C(@Value("${cua-hang.phi-van-chuyn}") String v) { … } }   // gõ thiếu chữ
```

```text
Caused by: org.springframework.util.PlaceholderResolutionException:
  Could not resolve placeholder 'cua-hang.phi-van-chuyn' in value "${cua-hang.phi-van-chuyn}"
```

`@Value` chỉ báo lỗi khi **không tìm thấy** key. Còn với `@ConfigurationProperties`, key thừa hoặc gõ sai tên trong yaml sẽ bị **bỏ qua im lặng** và field nhận giá trị mặc định (`null`) — vì vậy cần `@NotNull` và `@Validated`. Sai kiểu thì luôn bị bắt:

```text
Property: cua-hang.giu-hang-toi-da
Value: "muoi-lam-phut"
Reason: failed to convert java.lang.String to java.time.Duration
        (caused by java.lang.IllegalArgumentException: 'muoi-lam-phut' is not a valid duration)
```

Khi viết dự án mẫu, profile `dev` đặt `phi-van-chuyen: 0` trong khi field ban đầu là `@Positive` → ứng dụng không khởi động (*Reason: must be greater than 0*). Đó là ví dụ ràng buộc cấu hình bắt lỗi thật: hoặc quy tắc sai (phí 0 hợp lệ → đổi sang `@PositiveOrZero`), hoặc cấu hình sai.

## Hai lỗi không báo gì

### Prototype trong singleton

```java bad
@Scope("prototype") @Component class GioHang { final String id = …; }

@Service class Dung {
    private final GioHang gioHang;                    // inject MỘT lần khi tạo Dung
    Dung(GioHang g) { this.gioHang = g; }
}
// inject trực tiếp: 5c089b2f 5c089b2f   ← luôn cùng một giỏ hàng
```

```java good
private final ObjectProvider<GioHang> provider;
// provider.getObject() mỗi lần gọi → ObjectProvider: 2532b351 b967222
```

Thực tế, dữ liệu theo người dùng (giỏ hàng, ngữ cảnh request) hiếm khi nên là bean. Truyền nó như tham số, hoặc lưu ở DB/Redis.

### `new` một bean

```java bad
@Service class DonHangField { @Autowired TinhPhi tinhPhi; … }
new DonHangField().tong();
// bean từ Spring: phí 30000
// new DonHangField(): NullPointerException — field chưa được inject
```

Object tạo bằng `new` không đi qua container: không injection, không proxy, nên `@Transactional`, `@Cacheable`, `@Async` trên nó cũng không có tác dụng.

## Pitfalls khác

- Class nằm **ngoài** package của `@SpringBootApplication` → không được quét, lỗi *No qualifying bean*. Giữ class main ở package gốc.
- Hai `@Configuration` cùng khai báo bean tên giống nhau → Boot mặc định **cấm ghi đè** bean definition. Đã thử: *The bean 'tenCuaHang', defined in … CauHinh2.class, could not be registered. A bean with that name has already been defined in … CauHinh1.class*.
- Đặt logic nặng (gọi API, nạp cả bảng) trong constructor → khởi động chậm và lỗi khó đọc. Dùng `ApplicationRunner` hoặc nạp lười.
- Bean singleton giữ state theo request trong field.

:::senior Góc nhìn senior
Lỗi khởi động là lỗi **rẻ nhất** — nó chặn deploy hỏng trước khi khách hàng thấy. Hãy đẩy càng nhiều lỗi về thời điểm khởi động càng tốt: cấu hình có kiểu và validate, không lazy-init mặc định, readiness probe chỉ báo sẵn sàng khi kết nối DB và migration xong. Khi review, phụ thuộc vòng tròn và `@Lazy` để "chữa" nó là tín hiệu ranh giới module đang sai.
:::

:::version Spring Boot 3 và 4
Từ Boot 2.6, phụ thuộc vòng tròn bị cấm mặc định (`spring.main.allow-circular-references=false`). Thông báo lỗi trong bài là của Boot 4.1; Boot 3.x có cùng bố cục *Description / Action*, nhưng tên lớp exception cho placeholder không tìm thấy có thể khác ở bản cũ.
:::

:::interview Có hai bean cùng implement một interface, làm sao inject đúng cái cần?
Có bốn cách: `@Qualifier("tenBean")` ở chỗ inject để chọn đích danh; `@Primary` trên một bean để làm mặc định; inject `List<Interface>` hoặc `Map<String, Interface>` khi cần tất cả (vd chọn kênh thông báo theo cấu hình); hoặc dùng tên tham số trùng tên bean (dễ vỡ khi đổi tên, không nên dựa vào). Nếu không chọn, Spring báo *required a single bean, but 2 were found* lúc khởi động.
:::

:::quiz Bean `GioHang` scope prototype được inject qua constructor vào một `@Service` singleton. Gọi service hai lần, `gioHang.id` thế nào?
- [ ] Khác nhau mỗi lần gọi
- [x] Giống nhau — prototype chỉ được tạo một lần, lúc tạo service
- [ ] Lỗi khởi động
- [ ] `null` ở lần thứ hai

Đã chạy thử: `5c089b2f 5c089b2f`. Dùng `ObjectProvider<GioHang>.getObject()` để lấy instance mới mỗi lần.
:::

:::quiz Trong yaml gõ sai `cua-hang.mien-phi-tuu: 500000` (thừa chữ `u`), record `@ConfigurationProperties` **không** có `@NotNull` cho `mienPhiTu`. Chuyện gì xảy ra?
- [ ] Khởi động thất bại vì key lạ
- [x] Khởi động bình thường, `mienPhiTu` là `null` — lỗi lộ ra khi tính phí (`NullPointerException`)
- [ ] Spring tự sửa tên key
- [ ] Cảnh báo trong log

Đã thử với `--cua-hang.mien-phi-tuu=500000`: ứng dụng chạy, in `mienPhiTu = null`. Key không khớp field bị bỏ qua. Thêm `@NotNull` + `@Validated` để biến nó thành lỗi khởi động.
:::

:::exercise Phá vòng phụ thuộc
`DonHangService` cần `KhachHangService.hangThanhVien(khachId)` để tính giảm giá. `KhachHangService` cần `DonHangService.tongDaMua(khachId)` để xét hạng. Ứng dụng báo *form a cycle*. Đề xuất cách tách.
???
Phần dùng chung là **dữ liệu chi tiêu**, không phải logic của hai service. Tách thành một class chỉ đọc:

```java
@Service
class ThongKeChiTieu {
    private final DonHangRepository donHang;
    ThongKeChiTieu(DonHangRepository donHang) { this.donHang = donHang; }
    BigDecimal tongDaMua(long khachId) { return donHang.tongTienDaThanhToan(khachId); }
}

@Service class KhachHangService { KhachHangService(ThongKeChiTieu thongKe, …) { … } }   // xét hạng
@Service class DonHangService   { DonHangService(KhachHangService khachHang, …) { … } } // giảm giá
```

Phụ thuộc giờ một chiều: `DonHangService → KhachHangService → ThongKeChiTieu → repository`. Nếu chiều ngược lại là phản ứng với sự kiện (đơn được thanh toán → cập nhật hạng), dùng `ApplicationEventPublisher` + `@TransactionalEventListener` (bài *Transaction*) thay vì gọi trực tiếp.
:::
