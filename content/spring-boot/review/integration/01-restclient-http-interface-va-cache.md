---
title: "RestClient, HTTP interface, cache và tác vụ nền — gọi dịch vụ khác cho đúng"
summary: "Nhắc nhanh RestClient, khai báo client bằng interface @HttpExchange với @ImportHttpServices (Spring Framework 7), timeout qua cấu hình, @Cacheable, @Scheduled, @Async, và test client bằng @RestClientTest. Mọi số đo chạy thật trên Spring Boot 4.1.2."
type: card
level: core
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, restclient, http-interface, cache, scheduling]
related: [spring-boot/consolidate/integration/timeout-retry-va-gioi-han-dong-thoi, spring-boot/deep-dive/integration/idempotency-va-goi-dich-vu-dang-tin-cay]
---

## Tóm tắt nhanh

- Gọi HTTP đồng bộ: **`RestClient`** (thay `RestTemplate`). Tạo từ `RestClient.Builder` mà Boot cấu hình sẵn.
- Nhiều endpoint của cùng đối tác → khai báo **interface `@HttpExchange`**, Spring sinh cài đặt; Boot 4 đăng ký bằng **`@ImportHttpServices`** và cấu hình `base-url`, timeout trong yaml.
- **Mọi** lời gọi ra ngoài phải có **timeout** (đọc + kết nối).
- `@Cacheable` cho dữ liệu đọc nhiều, ít đổi (tỷ giá, danh mục). Chỉ có tác dụng khi gọi **qua proxy**.
- Test client bằng `@RestClientTest` + `MockRestServiceServer` — không gọi mạng thật.

## Ví dụ (đã chạy)

```java title="TyGiaClient.java — RestClient"
@Component
public class TyGiaClient {
    public record TyGia(String cap, BigDecimal gia) {}
    private final RestClient client;

    public TyGiaClient(RestClient.Builder builder) {
        this.client = builder.baseUrl("https://ty-gia.vi-du.vn").build();
    }

    public BigDecimal usdSangVnd() {
        TyGia tg = client.get().uri("/ty-gia?cap={cap}", "USD-VND").retrieve().body(TyGia.class);
        if (tg == null || tg.gia() == null || tg.gia().signum() <= 0) throw new IllegalStateException("tỷ giá không hợp lệ: " + tg);
        return tg.gia();
    }
}
```

```java title="HTTP interface"
@HttpExchange("/doi-tac")
public interface CicClient {
    @GetExchange("/cic/{cccd}")
    DiemCic layDiem(@PathVariable String cccd, @RequestParam int tre, @RequestParam int loi);
}

@Configuration
@ImportHttpServices(group = "doi-tac", types = CicClient.class)
class CauHinhDoiTac {}
```

```yaml
spring:
  http:
    serviceclient:
      doi-tac:
        base-url: http://localhost:8080
        read-timeout: 1s
        connect-timeout: 2s
```

Inject `CicClient` như mọi bean. Kết quả gọi tới một dịch vụ giả lập (profile `lab-tichhop`):

```text
gọi bình thường:                       DiemCic[cccd=A, diem=720, lan=1] — 301 ms
đối tác chậm 2s, read-timeout 1s:      ResourceAccessException: I/O error on GET request for "…/doi-tac/cic/B": Request cancelled — 1004 ms
đối tác trả 503:                       ServiceUnavailable — 27 ms
@Cacheable lần 1 / lần 2 / key khác:   313 ms / 0 ms / 311 ms
```

```java title="Test client không cần mạng"
@RestClientTest(TyGiaClient.class)
class TyGiaClientTest {
    @Autowired TyGiaClient client;
    @Autowired MockRestServiceServer server;

    @Test
    void docTyGia() {
        server.expect(requestTo("https://ty-gia.vi-du.vn/ty-gia?cap=USD-VND"))
              .andRespond(withSuccess("{\"cap\":\"USD-VND\",\"gia\":25400}", MediaType.APPLICATION_JSON));
        assertThat(client.usdSangVnd()).isEqualByComparingTo("25400");
    }

    @Test
    void doiTacLoi500() {
        server.expect(requestTo("https://ty-gia.vi-du.vn/ty-gia?cap=USD-VND")).andRespond(withServerError());
        assertThatThrownBy(client::usdSangVnd).isInstanceOf(HttpServerErrorException.InternalServerError.class);
    }
}
// Tests run: 3, Failures: 0
```

## Bảng chọn nhanh

| Cần | Dùng |
|---|---|
| Gọi một vài endpoint | `RestClient` từ `RestClient.Builder` |
| Client cho cả một API của đối tác | Interface `@HttpExchange` + `@ImportHttpServices` |
| Timeout mặc định cho mọi client | `spring.http.clients.read-timeout`, `spring.http.clients.connect-timeout` |
| Timeout riêng cho một nhóm HTTP service | `spring.http.serviceclient.<nhóm>.read-timeout` |
| Thử lại khi lỗi tạm thời | `@Retryable` (Spring Framework 7) — bài *Củng cố* |
| Cache kết quả | `@EnableCaching` + `@Cacheable("ten-cache")`; production dùng Caffeine/Redis |
| Việc định kỳ | `@EnableScheduling` + `@Scheduled(cron = "0 0 2 * * *", zone = "Asia/Ho_Chi_Minh")` |
| Chạy nền không chờ kết quả | `@Async` (+ executor riêng), hoặc message queue cho việc quan trọng |

## Lỗi hay gặp: `@Cacheable` gọi nội bộ

```java bad
@Service class CicService {
    @Cacheable("diem-cic") public DiemCic coCache(String cccd) { … }
    public DiemCic goiNoiBoCache(String cccd) { return coCache(cccd); }   // this.coCache — không qua proxy
}
// gọi goiNoiBoCache("I") hai lần: 619 ms — cả hai lần đều gọi đối tác
```

```java good
// gọi coCache từ bean khác (controller, service khác) → lần 2: 0 ms
```

Cùng lý do với `@Transactional` gọi nội bộ (bài *Transaction không rollback*).

:::version Spring Boot 3 và 4
- `RestClient`: Spring Framework 6.1 / Boot 3.2. HTTP interface: Spring Framework 6.0.
- **`@ImportHttpServices`** và property `spring.http.serviceclient.*`: Spring Framework 7 / Boot 4. Trên Boot 3 phải tự tạo `HttpServiceProxyFactory`.
- Boot 4 tách RestClient thành starter riêng `spring-boot-starter-restclient`; property `spring.http.client.*` đã **deprecated**, thay bằng `spring.http.clients.*` (đã kiểm tra trong metadata của Boot 4.1.2). `@RestClientTest` nằm trong `spring-boot-starter-restclient-test`.
:::

:::interview `RestTemplate`, `RestClient` và `WebClient` khác nhau thế nào?
`RestTemplate` là client đồng bộ cũ với API kiểu template method, vẫn được duy trì nhưng không thêm tính năng. `RestClient` (Spring 6.1+) là client đồng bộ với API fluent hiện đại, dùng chung hạ tầng message converter, hợp với code chặn và virtual thread. `WebClient` là client reactive, không chặn, dùng với WebFlux hoặc khi cần xử lý stream. Với ứng dụng Spring MVC thông thường, chọn `RestClient` (hoặc HTTP interface dựa trên nó).
:::

:::quiz Đối tác phản hồi sau 2 giây, client cấu hình `read-timeout: 1s`. Điều gì xảy ra?
- [ ] Client chờ đủ 2 giây
- [x] Sau khoảng 1 giây ném `ResourceAccessException`
- [ ] Trả `null`
- [ ] Client tự thử lại

Đã chạy: `ResourceAccessException … Request cancelled — 1004 ms`. Không có timeout thì thread của bạn chờ theo đối tác — có khi mãi mãi.
:::

:::quiz Method `@Cacheable("diem-cic")` được gọi lần hai với **cùng tham số từ một bean khác**. Thời gian?
- [x] Gần 0 ms — lấy từ cache
- [ ] Như lần đầu
- [ ] Lỗi vì chưa cấu hình Redis
- [ ] Tuỳ JVM

Đã chạy: 313 ms rồi 0 ms. Không có thư viện cache, Boot dùng `ConcurrentHashMap` đơn giản (không hết hạn, không giới hạn kích thước).
:::
