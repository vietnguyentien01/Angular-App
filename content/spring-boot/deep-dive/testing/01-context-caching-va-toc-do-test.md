---
title: "Context caching và tốc độ bộ test — vì sao thêm một @MockitoBean làm chậm cả bộ test"
summary: "Đọc thống kê cache ApplicationContext của Spring TestContext, thấy 5 context và 4 container PostgreSQL được tạo cho 13 test, rồi giảm còn 4 context và 1 container: tổng thời gian từ 22,7 s xuống 17,3 s, một class từ 2,25 s xuống 0,03 s. Đo trên Spring Boot 4.1.2."
level: advanced
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, testing, performance, testcontainers, internals]
related: [spring-boot/consolidate/testing/testcontainers-va-test-api-co-bao-mat, spring-boot/review/testing/test-slice-va-springboottest]
---

## Tóm tắt nhanh

- Spring TestContext **cache** `ApplicationContext` theo **khoá cấu hình** (class cấu hình, profile, property, `@MockitoBean`, `@Import`, loại web environment…). Hai class test có khoá giống nhau dùng **chung** một context.
- Mỗi khác biệt nhỏ (thêm một `@MockitoBean`, một `@TestPropertySource`, `RANDOM_PORT` hay không) tạo **context mới** — vài giây mỗi cái, cộng thêm container nếu container là bean của context.
- `@DirtiesContext` **huỷ** context khỏi cache — chỉ dùng khi thật sự cần.
- Thống nhất cấu hình test tích hợp (một class cha / annotation riêng) và **một container dùng chung** cho cả JVM.
- Bật log `org.springframework.test.context.cache=debug` để thấy `hitCount`/`missCount`.

## Cơ chế

```text
class test ─► MergedContextConfiguration (khoá) ─► ContextCache (LRU, tối đa 32 mặc định)
                                                     ├─ có → dùng lại (hit)
                                                     └─ không → dựng context mới (miss): quét bean, auto-config,
                                                                 khởi động container/Tomcat/Flyway…
```

Context được giữ tới hết JVM test (hoặc tới khi bị đẩy khỏi cache / `@DirtiesContext`). Vì vậy container khai báo là bean trong context cũng sống tới lúc đó.

## Đo bộ test của dự án mẫu

13 test, 5 class (thứ tự theo tên class):

| Class | Cấu hình | Thời gian |
|---|---|---|
| `DonHangApiIT` | `@SpringBootTest(RANDOM_PORT)` + `@AutoConfigureRestTestClient` + Testcontainers | 10,26 s |
| `DonHangServiceMockIT` | `@SpringBootTest` + `@MockitoBean PhiVanChuyenService` | 2,907 s |
| `PhiVanChuyenIT` | `@SpringBootTest` (môi trường MOCK) | 2,252 s |
| `SanPhamControllerTest` | `@WebMvcTest` | 0,846 s |
| `SanPhamRepositoryTest` | `@DataJpaTest` + Testcontainers | 1,808 s |

```text
Spring test ApplicationContext cache statistics: [… size = 5, maxSize = 32, … missCount = 5, …]
container khởi động: 4
Total time:  22.708 s
```

5 class → 5 context (không class nào dùng lại context của class khác), và 4 trong số đó tự khởi động một container PostgreSQL vì `TestcontainersConfig` tạo container **mới** trong mỗi context.

## Tối ưu

**1. Một container cho cả JVM:**

```java title="TestcontainersConfig.java"
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfig {
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");   // static: dùng chung

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return POSTGRES;
    }
}
```

**2. Cho `PhiVanChuyenIT` cùng cấu hình với `DonHangApiIT`:**

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@Import(TestcontainersConfig.class)
class PhiVanChuyenIT { … }
```

Kết quả:

| Class | Trước | Sau |
|---|---|---|
| `DonHangApiIT` | 10,26 s | 10,34 s |
| `DonHangServiceMockIT` | 2,907 s | 1,581 s |
| `PhiVanChuyenIT` | 2,252 s | **0,032 s** (dùng lại context) |
| `SanPhamRepositoryTest` | 1,808 s | 0,591 s |

```text
… size = 4, … missCount = 4, …
container khởi động: 1
Tests run: 13, Failures: 0, Errors: 0
Total time:  17.271 s        (trước: 22.708 s)
```

Với dự án thật có hàng chục class `@SpringBootTest`, khác biệt là vài phút cho mỗi lần chạy CI.

`DonHangServiceMockIT` vẫn cần context riêng vì `@MockitoBean` thay một bean — đó là cái giá của mock trong test tích hợp. Cách giảm: gom các test cần cùng bộ mock vào một class cha, hoặc dùng fake qua `@TestConfiguration` chung.

## Đánh đổi của container dùng chung

- Dữ liệu do test này commit (đơn hàng, tồn kho) **còn đó** cho test khác — `SanPhamRepositoryTest` vẫn đếm 5 sản phẩm vì không test nào tạo sản phẩm, nhưng một test giả định "sản phẩm 4 còn 100" sẽ sai sau khi `DonHangApiIT` đã trừ kho. Thiết kế test không phụ thuộc dữ liệu của test khác.
- Flyway chỉ migrate lần đầu (các context sau thấy schema đã ở version mới nhất).
- Testcontainers có thêm chế độ **reuse** (giữ container giữa các lần chạy, cho máy dev) — cần bật trong cấu hình Testcontainers của máy, không bật trong CI.

## So sánh phương án

| Kỹ thuật | Lợi | Hại |
|---|---|---|
| Slice test (`@WebMvcTest`, `@DataJpaTest`) | Context nhỏ, nhanh | Không thấy lỗi tích hợp |
| Class cha chung cho `@SpringBootTest` | Một context cho nhiều class | Cấu hình gò bó hơn |
| Container `static` dùng chung | 1 container cho cả bộ test | Dữ liệu chia sẻ, cần test độc lập dữ liệu |
| `@DirtiesContext` | Cô lập tuyệt đối | Dựng lại context — rất chậm |
| `@MockitoBean` trong test tích hợp | Kiểm soát phụ thuộc ngoài | Mỗi tổ hợp mock = một context |
| Chạy song song (Surefire `forkCount`, JUnit parallel) | Tận dụng CPU | Mỗi fork có cache riêng; DB dùng chung cần tách schema |

## Tính năng mới theo phiên bản

- **Spring Framework 6.2 / Boot 3.4**: `@MockitoBean`, `MockMvcTester`.
- **Spring Framework 7 / Boot 4**: `RestTestClient`, test starter theo module, Testcontainers 2, JUnit 6.

:::senior Góc nhìn senior
Bộ test chậm sẽ bị chạy ít đi, rồi bị bỏ qua. Đặt ngân sách: ví dụ unit + slice < 1 phút, toàn bộ < 5 phút trên CI. Theo dõi số context (log cache) như một chỉ số: mỗi PR thêm một tổ hợp `@MockitoBean`/property mới cho `@SpringBootTest` là một context mới — review nên hỏi "có thể dùng lại cấu hình chung không?".
:::

:::quiz Hai class test giống hệt nhau, trừ việc class thứ hai có thêm `@MockitoBean EmailService`. Chúng dùng chung context không?
- [ ] Có, mock chỉ áp dụng cho class thứ hai
- [x] Không — `@MockitoBean` là một phần của khoá cache, class thứ hai dựng context mới
- [ ] Có, nếu cùng package
- [ ] Tuỳ JUnit

Đã thấy: `DonHangServiceMockIT` luôn cần context riêng.
:::

:::quiz Container PostgreSQL khai báo là `@Bean` (không static) trong `@TestConfiguration` được import bởi 4 class có cấu hình khác nhau. Bao nhiêu container được khởi động?
- [ ] 1
- [x] 4 — mỗi context tạo bean của riêng nó
- [ ] 0 — Testcontainers tự dùng chung
- [ ] Tuỳ Docker

Đã đo: 4 container trước khi chuyển sang trường `static`, 1 container sau đó.
:::
