---
title: "Testcontainers và test API có bảo mật — PostgreSQL thật, @ServiceConnection, RestTestClient"
summary: "Cấu hình Testcontainers với @ServiceConnection để test chạy trên PostgreSQL 16 thật, viết test tích hợp đăng nhập → tạo đơn → kiểm tra 403/401 bằng RestTestClient, kiểm tra rollback khi hết hàng, và những bẫy dữ liệu dùng chung giữa các test. 13 test xanh trên Spring Boot 4.1.2."
level: intermediate
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, testing, testcontainers, integration-test, security]
related: [spring-boot/review/testing/test-slice-va-springboottest, spring-boot/deep-dive/testing/context-caching-va-toc-do-test]
---

## Tóm tắt nhanh

- **Testcontainers** chạy PostgreSQL thật trong Docker cho mỗi lần test; `@ServiceConnection` tự đưa URL/user/password của container vào `spring.datasource.*`. Không còn "test xanh trên H2, đỏ trên PostgreSQL".
- Test tích hợp đi **qua HTTP thật** (`RANDOM_PORT` + `RestTestClient`): đăng nhập lấy token thật, gửi `Authorization: Bearer`, kiểm tra mã trạng thái và body.
- Kiểm tra cả **đường lỗi**: người khác xem đơn → 403, không token → 401, hết hàng → 409 **và** tồn kho không đổi.
- `@SpringBootTest` với server thật **không** rollback dữ liệu sau test (request chạy trên thread khác, commit thật) — test phải tự chuẩn bị dữ liệu và không phụ thuộc thứ tự.

## Cơ chế

```text
@Import(TestcontainersConfig)
   └─ bean PostgreSQLContainer có @ServiceConnection
        └─ Boot khởi động container (image postgres:16-alpine), lấy JDBC URL ngẫu nhiên
        └─ tạo ConnectionDetails → DataSource trỏ vào container
        └─ Flyway chạy migration V1, V2, V3 như production
```

Lần đầu Testcontainers kéo image (đã chạy: *Pull complete. 13 layers, pulled in 7s*), các lần sau dùng lại. Máy CI cần Docker (hoặc dịch vụ tương thích).

```java title="TestcontainersConfig.java"
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfig {
    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer("postgres:16-alpine");
    }
}
```

```xml title="pom.xml (test)"
<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-testcontainers</artifactId><scope>test</scope></dependency>
<dependency><groupId>org.testcontainers</groupId><artifactId>testcontainers-postgresql</artifactId><scope>test</scope></dependency>
<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security-test</artifactId><scope>test</scope></dependency>
```

`@DataJpaTest` kèm `@Import(TestcontainersConfig.class)` dùng luôn container này (đã thấy log *Container postgres:16-alpine started* cho context của repository test), không thay bằng DB nhúng.

## Test tích hợp có bảo mật

```java title="DonHangApiIT.java"
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@Import(TestcontainersConfig.class)
class DonHangApiIT {

    @Autowired RestTestClient client;

    String dangNhap(String ten, String matKhau) {
        Map<?, ?> body = client.post().uri("/api/dang-nhap").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("tenDangNhap", ten, "matKhau", matKhau))
                .exchange().expectStatus().isOk()
                .expectBody(Map.class).returnResult().getResponseBody();
        return (String) body.get("accessToken");
    }

    @Test
    void khachTaoDonRoiXemDuocConNguoiKhacThiKhong() {
        String an = dangNhap("an", "matkhau-an");
        String binh = dangNhap("binh", "matkhau-binh");

        var taoDon = client.post().uri("/api/don-hang").headers(h -> h.setBearerAuth(an))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("dong", List.of(Map.of("sanPhamId", 4, "soLuong", 2))))
                .exchange().expectStatus().isCreated()
                .expectBody(DonHangController.DonHangResponse.class).returnResult();
        Long id = taoDon.getResponseBody().id();
        assertThat(taoDon.getResponseHeaders().getLocation()).hasPath("/api/don-hang/" + id);
        assertThat(taoDon.getResponseBody().tongTien()).isEqualByComparingTo("700000");

        client.get().uri("/api/don-hang/{id}", id).headers(h -> h.setBearerAuth(an)).exchange().expectStatus().isOk();
        client.get().uri("/api/don-hang/{id}", id).headers(h -> h.setBearerAuth(binh)).exchange().expectStatus().isEqualTo(HttpStatus.FORBIDDEN);
        client.get().uri("/api/don-hang/{id}", id).exchange().expectStatus().isUnauthorized();
    }

    @Test
    void hetHangTraVe409VaKhongTruKho() {
        String an = dangNhap("an", "matkhau-an");
        client.post().uri("/api/don-hang").headers(h -> h.setBearerAuth(an)).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("dong", List.of(Map.of("sanPhamId", 1, "soLuong", 1), Map.of("sanPhamId", 5, "soLuong", 1))))
                .exchange().expectStatus().isEqualTo(HttpStatus.CONFLICT)
                .expectBody().jsonPath("$.conLai").isEqualTo(0);

        client.get().uri("/api/san-pham/1").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.tonKho").isEqualTo(20);       // dòng 1 không bị trừ
    }
}
```

```text
Tests run: 2, Failures: 0, Errors: 0, Skipped: 0 -- in vn.hoc.donhang.donhang.DonHangApiIT
```

Một test này kiểm tra cùng lúc: cấu hình security thật, phát và kiểm tra JWT, phân quyền theo chủ sở hữu, validation, transaction rollback, Flyway, mapping JPA, serialize JSON — những thứ unit test không thấy.

## Code bad / good

```java bad
@SpringBootTest
@AutoConfigureTestDatabase                            // thay PostgreSQL bằng H2
class BaoCaoIT { … }                                  // query dùng ILIKE, JSONB, window function → chỉ lỗi trên production
```

```java good
@SpringBootTest
@Import(TestcontainersConfig.class)                   // cùng DB, cùng phiên bản, cùng migration với production
class BaoCaoIT { … }
```

## Pitfalls

- **Dữ liệu dùng chung**: test `RANDOM_PORT` commit thật. Ví dụ ở trên tạo đơn và trừ kho sản phẩm 4; test nào sau đó giả định "sản phẩm 4 còn 100" sẽ chập chờn tuỳ thứ tự. Mỗi test tự tạo dữ liệu riêng (sản phẩm mới), hoặc dọn trong `@AfterEach`.
- `@Transactional` trên class test `RANDOM_PORT` **không** rollback được thay đổi do request HTTP tạo ra (request chạy trên thread của Tomcat, transaction khác).
- Test phụ thuộc giờ thật — tiêm `Clock` cố định bằng `@TestConfiguration`.
- Quên kiểm tra body/header, chỉ kiểm tra mã trạng thái.
- Mỗi context tự khởi động một container → bộ test chậm dần (bài chuyên sâu có số đo và cách sửa).

:::senior Góc nhìn senior
Kim tự tháp test của một service Spring Boot thường là: nhiều test thuần cho quy tắc nghiệp vụ, một lớp `@WebMvcTest` cho hợp đồng HTTP (gồm mọi mã lỗi và 401/403), một lớp `@DataJpaTest` cho query không tầm thường, và **vài** test `@SpringBootTest` cho luồng giá trị nhất (đặt hàng, thanh toán). Test tích hợp chạy trên DB thật bằng Testcontainers trong CI là khác biệt lớn nhất giữa "test có" và "test đáng tin".
:::

:::version Spring Boot 3 và 4
- `@ServiceConnection` có từ Boot 3.1 — trước đó dùng `@DynamicPropertySource` để đặt `spring.datasource.url` bằng tay.
- **Testcontainers 2** (đi cùng Boot 4) đổi tên module (`testcontainers-postgresql` thay vì `postgresql`) và package: dùng `org.testcontainers.postgresql.PostgreSQLContainer`; class cũ `org.testcontainers.containers.PostgreSQLContainer` vẫn còn trong jar để chuyển đổi dần.
- `RestTestClient` (Spring Framework 7) và `@AutoConfigureRestTestClient` (Boot 4) dùng thay `TestRestTemplate`.
:::

:::interview Vì sao dùng Testcontainers thay cho H2 khi test?
H2 không phải PostgreSQL: khác cú pháp (`ILIKE`, JSONB, `ON CONFLICT`, window function), khác kiểu dữ liệu, khác hành vi khoá và isolation, và Flyway migration viết cho PostgreSQL có thể không chạy được trên H2. Test xanh trên H2 vì thế không chứng minh code chạy đúng trên production. Testcontainers chạy đúng image DB (cùng phiên bản) trong Docker, Spring Boot kết nối qua `@ServiceConnection`; đổi lại test cần Docker và chậm hơn một chút lúc khởi động — giảm được bằng cách dùng chung container giữa các test.
:::

:::quiz Test `@SpringBootTest(webEnvironment = RANDOM_PORT)` có `@Transactional` trên class, gọi `POST /api/don-hang` qua `RestTestClient`. Sau test, đơn hàng có còn trong DB không?
- [ ] Không — `@Transactional` trên test luôn rollback
- [x] Còn — request chạy trên thread của server, trong transaction riêng đã commit
- [ ] Tuỳ cấu hình Flyway
- [ ] Lỗi biên dịch

Rollback tự động chỉ áp dụng cho code chạy trên **chính thread test** (như `@DataJpaTest`, hay `MockMvc` không có server thật).
:::

:::quiz `@ServiceConnection` làm gì?
- [ ] Khởi động PostgreSQL cài trên máy
- [x] Lấy thông tin kết nối (URL, user, mật khẩu) từ container và cấu hình DataSource của Boot trỏ vào đó
- [ ] Tạo DB nhúng
- [ ] Chạy migration

Không cần viết `spring.datasource.url` cho test.
:::

:::exercise Test phân quyền cho "đơn của tôi"
Viết test tích hợp cho `GET /api/don-hang/cua-toi`: an tạo 1 đơn, binh tạo 1 đơn; an chỉ thấy đơn của an; không token → 401; admin (không phải `KHACH`) → 403. Test không được giả định số đơn có sẵn trong DB.
???
```java
@Test
void donCuaToiChiThayDonCuaMinh() {
    String an = dangNhap("an", "matkhau-an"), binh = dangNhap("binh", "matkhau-binh"), admin = dangNhap("admin", "matkhau-admin");
    Long donAn = taoDon(an), donBinh = taoDon(binh);

    var ds = client.get().uri("/api/don-hang/cua-toi?size=100").headers(h -> h.setBearerAuth(an))
            .exchange().expectStatus().isOk()
            .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {}).returnResult().getResponseBody();
    assertThat(ds).extracting(m -> ((Number) m.get("id")).longValue()).contains(donAn).doesNotContain(donBinh);

    client.get().uri("/api/don-hang/cua-toi").exchange().expectStatus().isUnauthorized();
    client.get().uri("/api/don-hang/cua-toi").headers(h -> h.setBearerAuth(admin)).exchange().expectStatus().isForbidden();
}

Long taoDon(String token) {
    return client.post().uri("/api/don-hang").headers(h -> h.setBearerAuth(token)).contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("dong", List.of(Map.of("sanPhamId", 4, "soLuong", 1))))
            .exchange().expectStatus().isCreated()
            .expectBody(DonHangController.DonHangResponse.class).returnResult().getResponseBody().id();
}
```

Đã chạy: `Tests run: 3, Failures: 0` cho `DonHangApiIT` sau khi thêm test này. Dùng `contains`/`doesNotContain` với id vừa tạo thay vì đếm tổng — vì test khác (cùng DB) cũng có thể đã tạo đơn cho an.
:::
