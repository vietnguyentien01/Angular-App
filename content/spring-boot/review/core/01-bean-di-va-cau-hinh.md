---
title: "Bean, dependency injection và cấu hình — nền tảng của mọi ứng dụng Spring Boot"
summary: "Nhắc nhanh IoC container, @Component/@Service, constructor injection, @Configuration và @Bean, @ConfigurationProperties có validate, profile và thứ tự ưu tiên cấu hình. Mọi output chạy trên Spring Boot 4.1.2, Java 21."
type: card
level: core
version: 4
lastReviewed: 2026-11-21
tags: [spring-boot, dependency-injection, configuration, profiles]
related: [spring-boot/consolidate/core/loi-di-va-cau-hinh-thuong-gap, spring-boot/deep-dive/core/auto-configuration-hoat-dong-the-nao]
changelog:
  - date: 2026-11-21
    note: "Chuyển dự án mẫu sang Java 21; chạy lại các ví dụ cấu hình (mặc định, profile dev, biến môi trường, validate) trên JDK 21, kết quả không đổi."
---

## Tóm tắt nhanh

- Spring tạo và giữ các object (**bean**), rồi tự truyền chúng vào nơi cần (**dependency injection**). Bạn khai báo, không tự `new`.
- Class đánh dấu `@Component`, `@Service`, `@Repository`, `@RestController` trong package của class `@SpringBootApplication` (và package con) sẽ thành bean.
- Luôn dùng **constructor injection**. Chỉ có một constructor thì không cần `@Autowired`.
- Cấu hình nghiệp vụ gom vào một `record` **`@ConfigurationProperties`** có `@Validated` — sai thì ứng dụng **không khởi động**, thay vì lỗi lúc chạy.
- Mặc định mỗi bean là **singleton**: một instance dùng chung cho mọi request — không giữ state thay đổi được trong field.

## Ví dụ (dự án mẫu `don-hang-api`, đã chạy)

```java title="CuaHangProperties.java"
@Validated
@ConfigurationProperties("cua-hang")
public record CuaHangProperties(
        @NotNull @PositiveOrZero BigDecimal phiVanChuyen,
        @NotNull @Positive BigDecimal mienPhiTu,
        Duration giuHangToiDa) {
}
```

```yaml title="application.yaml"
cua-hang:
  phi-van-chuyen: 30000
  mien-phi-tu: 500000
  giu-hang-toi-da: 15m          # tự chuyển thành Duration PT15M
```

```java title="CauHinhUngDung.java"
@Configuration
@EnableConfigurationProperties(CuaHangProperties.class)
public class CauHinhUngDung {
    @Bean
    Clock clock() {                                   // bean cho class không phải của mình
        return Clock.system(ZoneId.of("Asia/Ho_Chi_Minh"));
    }
}
```

```java title="PhiVanChuyenService.java"
@Service
public class PhiVanChuyenService {
    private final CuaHangProperties cauHinh;

    public PhiVanChuyenService(CuaHangProperties cauHinh) {   // Spring tự truyền vào
        this.cauHinh = cauHinh;
    }

    public BigDecimal tinhPhi(BigDecimal tongTien) {
        return tongTien.compareTo(cauHinh.mienPhiTu()) >= 0 ? BigDecimal.ZERO : cauHinh.phiVanChuyen();
    }
}
```

In cấu hình lúc khởi động với các cách ghi đè khác nhau:

```text
mặc định:                         CuaHangProperties[phiVanChuyen=30000, mienPhiTu=500000, giuHangToiDa=PT15M]
--spring.profiles.active=dev:     The following 1 profile is active: "dev"
                                  CuaHangProperties[phiVanChuyen=0, mienPhiTu=500000, giuHangToiDa=PT15M]
CUAHANG_MIENPHITU=1000000 (env):  CuaHangProperties[phiVanChuyen=30000, mienPhiTu=1000000, giuHangToiDa=PT15M]
--cua-hang.phi-van-chuyen=-5:     APPLICATION FAILED TO START … Reason: must be greater than or equal to 0
```

`application-dev.yaml` chỉ ghi `cua-hang.phi-van-chuyen: 0` — các giá trị khác lấy từ `application.yaml`. Biến môi trường viết hoa, bỏ dấu `-`, thay `.` bằng `_`: `cua-hang.mien-phi-tu` → `CUAHANG_MIENPHITU`.

## Bảng chọn nhanh

| Cần | Dùng |
|---|---|
| Class của mình thành bean | `@Service` (nghiệp vụ), `@Repository`, `@RestController`, `@Component` (khác) |
| Bean cho class thư viện (`Clock`, `RestClient`, `ObjectMapper` tuỳ biến) | `@Bean` trong class `@Configuration` |
| Nhóm cấu hình nghiệp vụ | `record` + `@ConfigurationProperties` + `@Validated` |
| Một giá trị lẻ | `@Value("${…}")` — hạn chế dùng |
| Cấu hình theo môi trường | profile: `application-dev.yaml`, `application-prod.yaml` |
| Bí mật (mật khẩu DB, key) | biến môi trường / secret manager, **không** commit vào yaml |
| Nhiều bean cùng interface | `@Qualifier("ten")`, `@Primary`, hoặc nhận `List<Interface>` |

Thứ tự ưu tiên (cao → thấp, rút gọn): tham số dòng lệnh → biến môi trường → `application-{profile}.yaml` → `application.yaml` → giá trị mặc định trong code.

## Lỗi hay gặp: field injection

```java bad
@Service
public class DonHangService {
    @Autowired TinhPhi tinhPhi;           // field injection
}
new DonHangService().tong();             // NullPointerException — chạy thử: field chưa được inject
```

```java good
@Service
public class DonHangService {
    private final TinhPhi tinhPhi;
    public DonHangService(TinhPhi tinhPhi) { this.tinhPhi = tinhPhi; }   // final, test được bằng new
}
```

Constructor injection làm phụ thuộc hiện rõ, cho phép field `final`, và test đơn vị chỉ cần `new DonHangService(fake)` mà không cần Spring.

:::version Spring Boot 3 và 4
- Spring Boot **4.0** (11/2025) dựa trên Spring Framework 7, Jakarta EE 11, yêu cầu Java **17+**. Dự án mẫu dùng **Java 21 LTS** (`<java.version>21</java.version>`) — bản LTS phổ biến nhất, có virtual thread cho `spring.threads.virtual.enabled=true`. Spring Boot 3.x dùng Spring Framework 6.
- Boot 4 tách starter theo module: `spring-boot-starter-webmvc` (tên cũ `spring-boot-starter-web` vẫn còn), starter test riêng như `spring-boot-starter-webmvc-test`.
- `@ConfigurationProperties` với `record` (constructor binding) dùng được từ Boot 2.6; Boot 3+ không cần `@ConstructorBinding`.
:::

:::interview Vì sao nên dùng constructor injection thay vì field injection?
Constructor injection làm mọi phụ thuộc bắt buộc hiện ra trong chữ ký constructor: không thể tạo object thiếu phụ thuộc, field có thể `final` (bất biến, an toàn khi dùng chung giữa thread), test đơn vị chỉ cần `new` với fake mà không cần container hay reflection. Constructor quá nhiều tham số còn là tín hiệu class đang làm quá nhiều việc. Field injection che giấu phụ thuộc và cho phép object ở trạng thái thiếu (`null`) nếu tạo ngoài Spring.
:::

:::quiz Cấu hình `cua-hang.mien-phi-tu: 500000` trong `application.yaml`, chạy với biến môi trường `CUAHANG_MIENPHITU=1000000`. Giá trị nào được dùng?
- [ ] 500000 — file cấu hình thắng
- [x] 1000000 — biến môi trường ưu tiên cao hơn file
- [ ] Lỗi vì trùng
- [ ] Tuỳ thứ tự khai báo

Đã chạy thử. Đây là cách triển khai cùng một artifact cho nhiều môi trường: chỉ đổi biến môi trường.
:::

:::quiz Bean `@Service` mặc định có scope gì?
- [x] singleton — một instance cho cả ứng dụng
- [ ] prototype — mỗi lần inject một instance
- [ ] request — mỗi HTTP request một instance
- [ ] Tuỳ số thread

Vì vậy field thay đổi được trong service là state dùng chung giữa mọi request — nguồn race condition (xem môn Java, bài *Race condition, deadlock*).
:::

:::quiz Chạy với `--cua-hang.phi-van-chuyen=-5` (property có `@PositiveOrZero`, class có `@Validated`). Kết quả?
- [ ] Ứng dụng chạy, phí âm
- [ ] Ứng dụng chạy, phí về 0
- [x] Không khởi động: *Binding to target … failed … Reason: must be greater than or equal to 0*
- [ ] Lỗi khi gọi API lần đầu

Đã chạy thử. Lỗi cấu hình nên lộ ra lúc deploy, không phải lúc khách đặt hàng.
:::
