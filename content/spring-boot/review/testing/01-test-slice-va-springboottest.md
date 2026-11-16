---
title: "Test slice và @SpringBootTest — chọn đúng loại test cho từng tầng"
summary: "Nhắc nhanh @WebMvcTest với MockMvcTester, @DataJpaTest, @SpringBootTest, @MockitoBean, và khi nào dùng test đơn vị thuần không cần Spring. Mọi test chạy thật với Spring Boot 4.1.2: 13 test xanh, có PostgreSQL thật qua Testcontainers."
type: card
level: core
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, testing, webmvctest, datajpatest, mockito]
related: [spring-boot/consolidate/testing/testcontainers-va-test-api-co-bao-mat, spring-boot/deep-dive/testing/context-caching-va-toc-do-test]
---

## TL;DR

- **Logic thuần** (tính phí, làm tròn, kiểm tra trạng thái) → test JUnit bình thường, `new` object, **không** cần Spring (mili giây).
- **Controller** (URL, JSON, validation, mã lỗi, security) → **`@WebMvcTest`**: chỉ dựng tầng web, repository/service thay bằng **`@MockitoBean`**.
- **Repository / query** → **`@DataJpaTest`**: chỉ dựng JPA, mỗi test **rollback** sau khi chạy. Dùng DB thật (Testcontainers), không dùng H2 cho query đặc thù PostgreSQL.
- **Luồng đầy đủ** (đăng nhập → tạo đơn → xem) → **`@SpringBootTest`**: dựng cả ứng dụng. Ít test loại này, chạy chậm nhất.
- `MockMvcTester` (AssertJ) là API mới, dễ đọc hơn `MockMvc` + `andExpect`.

## Ví dụ (dự án `don-hang-api`, đã chạy)

```java title="SanPhamControllerTest.java"
@WebMvcTest(SanPhamController.class)
@Import(CauHinhBaoMat.class)                       // dùng đúng SecurityFilterChain của ứng dụng
class SanPhamControllerTest {

    @Autowired MockMvcTester mvc;
    @MockitoBean SanPhamRepository repo;

    @Test
    void xemChiTietKhongCanDangNhap() {
        given(repo.findById(1L)).willReturn(Optional.of(new SanPham("Nồi chiên", new BigDecimal("1500000"), 20)));

        assertThat(mvc.get().uri("/api/san-pham/1"))
            .hasStatusOk()
            .bodyJson().extractingPath("$.ten").isEqualTo("Nồi chiên");
    }

    @Test
    void khachHangKhongDuocTaoSanPham() {
        assertThat(mvc.post().uri("/api/san-pham").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_KHACH")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"ten\":\"x\",\"gia\":1,\"tonKho\":1}"))
            .hasStatus(403);
    }

    @Test
    void adminGuiDuLieuSaiNhan400KemDanhSachLoi() {
        assertThat(mvc.post().uri("/api/san-pham").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"ten\":\" \",\"gia\":-1,\"tonKho\":1}"))
            .hasStatus(400)
            .bodyJson().extractingPath("$.loi[*].truong").asArray().containsExactly("gia", "ten");
    }
}
```

`jwt()` (từ `spring-security-test`) tạo sẵn một `Authentication` JWT — không cần phát token thật.

```java title="SanPhamRepositoryTest.java"
@DataJpaTest
@Import(TestcontainersConfig.class)               // PostgreSQL 16 thật trong Docker
class SanPhamRepositoryTest {
    @Autowired SanPhamRepository repo;

    @Test
    void truKhoChiKhiDuHang() {
        SanPham sp = repo.save(new SanPham("Bình giữ nhiệt", new BigDecimal("250000"), 3));
        assertThat(repo.truKhoNeuDu(sp.getId(), 2)).isEqualTo(1);
        assertThat(repo.truKhoNeuDu(sp.getId(), 2)).isEqualTo(0);       // chỉ còn 1
    }

    @Test
    void moiTestBatDauVoiDuLieuGoc() {
        assertThat(repo.count()).isEqualTo(5);     // bản ghi của test khác đã rollback
    }
}
```

```text
SanPhamControllerTest:  6 test, 0.846 s   (context web, không DB)
SanPhamRepositoryTest:  3 test, 1.808 s   (JPA + PostgreSQL)
DonHangApiIT:           2 test, 10.26 s   (cả ứng dụng + Tomcat + PostgreSQL, gồm thời gian khởi động container)
Tests run: 13, Failures: 0, Errors: 0
```

## Bảng chọn nhanh

| Muốn kiểm tra | Loại test | Dựng gì |
|---|---|---|
| Quy tắc nghiệp vụ thuần | JUnit thuần | Không có Spring |
| URL, JSON, validation, 401/403, ProblemDetail | `@WebMvcTest(XController.class)` | Controller, advice, filter, converter |
| Query, mapping entity, ràng buộc DB | `@DataJpaTest` + Testcontainers | JPA, repository, DataSource |
| Gọi HTTP ra ngoài | `@RestClientTest` | `RestClient` + server giả |
| Luồng xuyên tầng, cấu hình thật | `@SpringBootTest` | Toàn bộ ứng dụng |
| Thay một bean trong context bằng mock | `@MockitoBean` | — |

## Lỗi hay gặp: `@SpringBootTest` cho mọi thứ

```java bad
@SpringBootTest                          // dựng cả ứng dụng, DB, security… để test một phép cộng
class PhiVanChuyenTest {
    @Autowired PhiVanChuyenService phi;
    @Test void mienPhi() { … }
}
```

```java good
class PhiVanChuyenTest {
    PhiVanChuyenService phi = new PhiVanChuyenService(
        new CuaHangProperties(new BigDecimal("30000"), new BigDecimal("500000"), Duration.ofMinutes(15)));
    @Test void mienPhiTuNamTramNghin() {
        assertThat(phi.tinhPhi(new BigDecimal("499999"))).isEqualByComparingTo("30000");
        assertThat(phi.tinhPhi(new BigDecimal("500000"))).isEqualByComparingTo("0");
    }
}
```

Đã chạy: `Tests run: 1 … Time elapsed: 0.096 s`, so với `2.252 s` của bản `@SpringBootTest` tương đương. Constructor injection (bài *Bean, DI và cấu hình*) là thứ cho phép viết test kiểu này.

:::version Spring Boot 3 và 4
- `@MockitoBean`/`@MockitoSpyBean` (Spring Framework 6.2, Boot 3.4) thay `@MockBean`/`@SpyBean` (đã deprecated ở Boot 3.4 và bị gỡ ở Boot 4).
- `MockMvcTester` có từ Spring Framework 6.2. `RestTestClient` mới ở Spring Framework 7 (thay cho `TestRestTemplate` trong test tích hợp).
- Boot 4 tách annotation test theo module: `@WebMvcTest` ở `org.springframework.boot.webmvc.test.autoconfigure`, `@DataJpaTest` ở `org.springframework.boot.data.jpa.test.autoconfigure`; thêm starter `spring-boot-starter-webmvc-test`, `spring-boot-starter-data-jpa-test`.
:::

:::interview `@WebMvcTest` và `@SpringBootTest` khác nhau thế nào?
`@WebMvcTest` là *test slice*: chỉ nạp các bean tầng web (controller được chỉ định, `@ControllerAdvice`, filter, converter, cấu hình MVC/Security) và cấu hình `MockMvc`; service/repository không có, phải cung cấp bằng `@MockitoBean`. Nó nhanh và tập trung kiểm tra hợp đồng HTTP. `@SpringBootTest` nạp toàn bộ ứng dụng như khi chạy thật (có thể kèm server thật ở cổng ngẫu nhiên), dùng cho test tích hợp luồng nhiều tầng; chậm hơn nhiều nên chỉ dùng cho số ít kịch bản quan trọng.
:::

:::quiz Bạn muốn kiểm tra endpoint trả 400 kèm danh sách field khi body sai. Loại test nào phù hợp nhất?
- [ ] `@SpringBootTest` với PostgreSQL
- [x] `@WebMvcTest` với repository là `@MockitoBean`
- [ ] `@DataJpaTest`
- [ ] Test JUnit thuần gọi method controller

Validation và advice thuộc tầng web; không cần DB. Đã chạy: `0.846 s` cho 6 test.
:::

:::quiz Trong `@DataJpaTest`, test A `save` một sản phẩm. Test B chạy sau đếm số sản phẩm. B thấy bản ghi của A không?
- [ ] Có
- [x] Không — mỗi test chạy trong transaction và rollback ở cuối
- [ ] Tuỳ thứ tự chạy
- [ ] Chỉ khi dùng H2

Đã chạy `moiTestBatDauVoiDuLieuGoc`: luôn đếm được 5 (dữ liệu từ migration).
:::
