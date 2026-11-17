---
title: "Auto-configuration hoạt động thế nào — điều kiện, báo cáo --debug và tự viết một auto-config"
summary: "Spring Boot tìm auto-config ở đâu, các @Conditional quyết định bean nào được tạo, đọc báo cáo điều kiện bằng --debug, và tự viết một auto-configuration có @ConditionalOnMissingBean để người dùng ghi đè được. Chạy thật trên Spring Boot 4.1.2."
level: advanced
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, auto-configuration, conditional, internals]
related: [spring-boot/review/core/bean-di-va-cau-hinh, spring-boot/consolidate/core/loi-di-va-cau-hinh-thuong-gap]
---

## Tóm tắt nhanh

- `@SpringBootApplication` = `@Configuration` + `@ComponentScan` + **`@EnableAutoConfiguration`**.
- Auto-config là các class `@AutoConfiguration` bình thường, được liệt kê trong file `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` của mỗi jar.
- Mỗi auto-config có **điều kiện**: có class X trên classpath không, đã có bean Y chưa, property Z bật chưa. Nhờ vậy thêm một starter là có tính năng, khai báo bean của mình là **ghi đè** được.
- `--debug` in **báo cáo điều kiện** (*Conditions Evaluation Report*): auto-config nào matched, cái nào không và vì sao. Đây là công cụ đầu tiên khi "Spring tự làm gì đó mà mình không hiểu".

## Cơ chế

```text
SpringApplication.run
 └─ @EnableAutoConfiguration
     └─ đọc mọi META-INF/spring/…AutoConfiguration.imports trên classpath
         └─ với từng class: đánh giá @ConditionalOnClass, @ConditionalOnBean/MissingBean,
            @ConditionalOnProperty, … → matched thì đăng ký các @Bean bên trong
```

Auto-config được xử lý **sau** bean của bạn. Vì vậy `@ConditionalOnMissingBean` nhìn thấy bean bạn khai báo và lùi lại — đây là cơ chế "convention, có thể ghi đè" của Spring Boot.

Trong dự án `don-hang-api` (web, JPA, Flyway, actuator), báo cáo `--debug` có 122 mục *matched*. Ví dụ DataSource:

```text
DataSourceAutoConfiguration matched:
   - @ConditionalOnClass found required classes 'javax.sql.DataSource', 'org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType' (OnClassCondition)
   - @ConditionalOnMissingBean (types: io.r2dbc.spi.ConnectionFactory; SearchStrategy: all) did not find any beans (OnBeanCondition)
```

Đọc ra: có driver JDBC trên classpath, không dùng R2DBC → Boot tạo `DataSource` (HikariCP) từ `spring.datasource.*`. Bạn khai báo `@Bean DataSource` riêng thì Boot không tạo nữa.

## Tự viết một auto-configuration

Tình huống: nhiều service trong công ty cần gửi thông báo. Thư viện chung cung cấp kênh mặc định (ghi log), service nào cần thì tự khai báo kênh riêng (Zalo, SMS).

```java title="ThongBaoAutoConfiguration.java"
@AutoConfiguration
@ConditionalOnProperty(prefix = "thong-bao", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ThongBaoAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    KenhThongBao kenhLog() {
        return noiDung -> "[log] " + noiDung;
    }
}
```

```text title="src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports"
vn.hoc.thongbao.ThongBaoAutoConfiguration
```

Ứng dụng chỉ inject `KenhThongBao`. Kết quả ba lần chạy:

```text
mặc định:                           KenhThongBao: [log] đơn D1 đã thanh toán
ứng dụng tự khai báo @Bean kenhZalo: KenhThongBao: [zalo] đơn D1 đã thanh toán
--thong-bao.enabled=false:           KenhThongBao: (không có bean)
```

Báo cáo `--debug` giải thích từng trường hợp:

```text
ThongBaoAutoConfiguration matched:
   - @ConditionalOnProperty (thong-bao.enabled=true) matched (OnPropertyCondition)

ThongBaoAutoConfiguration#kenhLog matched:
   - @ConditionalOnMissingBean (types: vn.hoc.thongbao.KenhThongBao; SearchStrategy: all) did not find any beans (OnBeanCondition)
```

```text
ThongBaoAutoConfiguration#kenhLog:
   Did not match:
      - @ConditionalOnMissingBean (types: vn.hoc.thongbao.KenhThongBao; SearchStrategy: all) found beans of type 'vn.hoc.thongbao.KenhThongBao' kenhZalo (OnBeanCondition)
```

Quy tắc khi viết auto-config:

- **Không** để package của auto-config bị component scan quét (đặt khác package với ứng dụng). Nếu bị quét, nó chạy như `@Configuration` thường, trước bean của người dùng, và `@ConditionalOnMissingBean` không còn đáng tin.
- Mọi bean "mặc định" đều `@ConditionalOnMissingBean`.
- Phụ thuộc vào thư viện tuỳ chọn → `@ConditionalOnClass` (và khai báo dependency đó là `optional`).
- Thứ tự giữa các auto-config: `@AutoConfiguration(after = …)` / `before = …`.
- Cấu hình bằng `@ConfigurationProperties` riêng (vd `thong-bao.*`).
- Đóng gói thành `xxx-spring-boot-starter` (chỉ khai báo dependency) + `xxx-spring-boot-autoconfigure` (code) nếu chia sẻ trong công ty.

## So sánh phương án

| Cần | Cách |
|---|---|
| Đổi một tham số của bean do Boot tạo | Property (`spring.datasource.hikari.maximum-pool-size`) |
| Tuỳ biến một phần (vd thêm module Jackson) | Bean *customizer* Boot cung cấp (`…Customizer`) |
| Thay hẳn bean của Boot | Khai báo `@Bean` cùng kiểu (Boot lùi nhờ `@ConditionalOnMissingBean`) |
| Tắt hẳn một auto-config | `spring.autoconfigure.exclude=…` hoặc `@SpringBootApplication(exclude = …)` |
| Chia sẻ cấu hình chung cho nhiều service | Auto-configuration + starter nội bộ |

Ưu tiên theo thứ tự từ trên xuống: property và customizer giữ được phần còn lại của auto-config; thay hẳn bean thì bạn tự chịu trách nhiệm mọi thứ bean đó từng làm.

## Tính năng mới theo phiên bản

- **Boot 2.7**: file `AutoConfiguration.imports` và `@AutoConfiguration` thay cho khai báo trong `spring.factories`. **Boot 3.0**: bỏ hẳn cách cũ cho auto-config.
- **Boot 4.0**: code auto-config được tách theo module công nghệ (`spring-boot-jdbc`, `spring-boot-flyway`, `spring-boot-webmvc`…) thay vì một jar `spring-boot-autoconfigure` lớn; starter mới như `spring-boot-starter-flyway`. Ứng dụng dùng starter thì gần như không phải đổi gì; code import trực tiếp class auto-config cũ cần cập nhật package.

:::senior Góc nhìn senior
"Magic" của Spring Boot chỉ là các `@Conditional` có thể đọc được. Khi đội gặp hành vi lạ — hai `DataSource`, Jackson định dạng ngày khác mong đợi, security tự bật — quy trình là: chạy `--debug` (hoặc endpoint actuator `/actuator/conditions`), tìm auto-config liên quan, đọc điều kiện và source của nó. Với thư viện nội bộ, viết auto-config đúng chuẩn (`@ConditionalOnMissingBean`, property riêng, không bị component scan) để các team dùng mà không phải copy cấu hình.
:::

:::quiz Bạn khai báo `@Bean ObjectMapper` (hoặc `JsonMapper`) riêng trong ứng dụng. Điều gì xảy ra với bean JSON mapper mà Boot tự cấu hình?
- [ ] Hai bean cùng tồn tại, lỗi trùng bean khi inject
- [x] Bean của Boot không được tạo (`@ConditionalOnMissingBean`), mọi thứ dùng bean của bạn — kể cả mất các tuỳ chỉnh từ `spring.jackson.*`
- [ ] Bean của bạn bị bỏ qua
- [ ] Boot gộp cấu hình của hai bean

Đây là lý do nên tuỳ biến bằng customizer thay vì thay hẳn bean. Kiểm chứng bằng `--debug`, giống ví dụ `kenhLog` ở trên.
:::

:::quiz Auto-config của bạn đặt trong package `vn.hoc.donhang.thongbao`, cùng package gốc với `@SpringBootApplication` của ứng dụng. Vấn đề gì có thể xảy ra?
- [ ] Không vấn đề gì
- [x] Component scan quét nó như `@Configuration` thường, xử lý trước bean của ứng dụng nên `@ConditionalOnMissingBean` có thể không thấy bean người dùng khai báo
- [ ] Spring báo lỗi trùng
- [ ] Auto-config không bao giờ chạy

Auto-config phải nằm ngoài vùng component scan và chỉ được nạp qua file `AutoConfiguration.imports`.
:::

:::exercise Thêm điều kiện theo classpath
Mở rộng `ThongBaoAutoConfiguration`: nếu trên classpath có class `vn.hoc.zalo.ZaloClient` (thư viện tuỳ chọn) **và** có property `thong-bao.zalo.token`, tạo bean `KenhThongBao` gửi qua Zalo; nếu không thì dùng kênh log như cũ. Người dùng vẫn ghi đè được bằng bean riêng.
???
```java
@AutoConfiguration
@ConditionalOnProperty(prefix = "thong-bao", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ThongBaoAutoConfiguration {

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "vn.hoc.zalo.ZaloClient")
    @ConditionalOnProperty(prefix = "thong-bao.zalo", name = "token")
    static class ZaloConfig {
        @Bean
        @ConditionalOnMissingBean
        KenhThongBao kenhZalo(@Value("${thong-bao.zalo.token}") String token) {
            var client = new vn.hoc.zalo.ZaloClient(token);
            return client::gui;
        }
    }

    @Bean
    @ConditionalOnMissingBean
    KenhThongBao kenhLog() { return noiDung -> "[log] " + noiDung; }
}
```

Đã chạy thử (với một `ZaloClient` giả lập trên classpath):

```text
không có token:          KenhThongBao: [log] đơn D1 đã thanh toán
có token:                KenhThongBao: [zalo:abc…] đơn D1 đã thanh toán
có token + bean riêng:   KenhThongBao: [zalo] đơn D1 đã thanh toán     ← bean của ứng dụng thắng
```

Các lớp lồng nhau được xử lý trước `@Bean` của lớp ngoài, nên khi đủ điều kiện, `kenhZalo` được tạo trước và `kenhLog` lùi lại (`@ConditionalOnMissingBean`). `@ConditionalOnClass(name = "…")` dùng **chuỗi** để không lỗi nạp class khi thư viện vắng mặt. Kiểm tra cả ba trường hợp bằng `--debug` hoặc bằng `ApplicationContextRunner` trong test.
:::
