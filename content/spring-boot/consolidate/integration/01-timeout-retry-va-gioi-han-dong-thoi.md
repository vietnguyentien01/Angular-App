---
title: "Timeout, retry và giới hạn đồng thời khi gọi đối tác — với @Retryable và @ConcurrencyLimit của Spring 7"
summary: "Đo thật: timeout cắt lời gọi chậm sau 1 giây, @Retryable thành công ở lần thứ 3 sau 347 ms, luôn lỗi thì dừng sau 4 lần, đối tác treo thì mất 4,7 giây; @ConcurrencyLimit(2) giữ tối đa 2 lời gọi; và bẫy đọc field qua proxy ra null."
level: intermediate
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, resilience, retry, timeout, concurrency]
related: [spring-boot/review/integration/restclient-http-interface-va-cache, spring-boot/deep-dive/integration/idempotency-va-goi-dich-vu-dang-tin-cay]
---

## Tóm tắt nhanh

- **Timeout trước, retry sau.** Retry không có timeout chỉ nhân thời gian chờ lên.
- Chỉ retry lỗi **tạm thời** (503, timeout, mất kết nối), **không** retry lỗi của chính request (400, 401, 404, 409).
- Chỉ retry thao tác **idempotent** (GET, PUT, hoặc POST có idempotency key) — retry POST "trừ tiền" có thể trừ hai lần.
- Có **backoff** (100 ms, 200 ms, 400 ms…) và **giới hạn số lần**, tính trước thời gian tệ nhất.
- Giới hạn số lời gọi đồng thời tới đối tác (`@ConcurrencyLimit`) để không làm sập họ — và không để họ kéo sập mình.

## Cơ chế

Spring Framework 7 có sẵn các annotation resilience trong `spring-context`, bật bằng `@EnableResilientMethods`. Giống `@Transactional`, chúng hoạt động qua **proxy**.

```java
@Configuration
@EnableResilientMethods
class CauHinh {}

@Service
class CicService {
    @Retryable(includes = {HttpServerErrorException.class, ResourceAccessException.class},
               maxRetries = 3, delay = 100, multiplier = 2)
    public DiemCic coThuLai(String cccd, int loi) { return client.layDiem(cccd, 0, loi); }

    @ConcurrencyLimit(2)
    public DiemCic gioiHan(String cccd) { return client.layDiem(cccd, 300, 0); }
}
```

`maxRetries = 3` nghĩa là **tối đa 4 lần gọi** (1 lần đầu + 3 lần thử lại). Khoảng nghỉ: 100 → 200 → 400 ms. Có thêm `jitter` (dao động ngẫu nhiên, tránh mọi client cùng thử lại một lúc), `maxDelay`, `timeout` (ngừng thử lại khi đã quá thời gian — xem bài tập).

## Số đo (dịch vụ đối tác giả lập, profile `lab-tichhop`)

```text
1. gọi bình thường:                          DiemCic[cccd=A, diem=720, lan=1] — 301 ms
2. đối tác chậm 2s, read-timeout 1s:         ResourceAccessException … Request cancelled — 1004 ms
3. đối tác trả 503 (không retry):            ServiceUnavailable — 27 ms
4. @Retryable, lỗi 2 lần đầu:                DiemCic[cccd=D, diem=720, lan=3] — 347 ms
5. @Retryable, luôn lỗi:                     ServiceUnavailable sau 743 ms, đối tác nhận 4 lần gọi
6. @ConcurrencyLimit(2), 6 lời gọi × 300 ms: tối đa đồng thời 2 — 941 ms
```

- (4): lần 3 thành công, tổng ≈ 100 + 200 ms nghỉ + 3 lời gọi.
- (5): hết 3 lần thử lại, exception **gốc** được ném ra — người gọi xử lý như lỗi thường (ProblemDetail 503/502).
- (6): 6 lời gọi chạy thành 3 đợt (≈ 900 ms). Các lời gọi thứ 3–6 **chờ** (chính sách `BLOCK`, mặc định); `policy = ThrottlePolicy.REJECT` để từ chối ngay.

## Code bad / good

```java bad
@Retryable(maxRetries = 5)                                 // retry mọi exception, kể cả 400/404
public KetQua thanhToan(YeuCau yc) {
    return client.post().uri("/thanh-toan").body(yc).retrieve().body(KetQua.class);   // POST không có idempotency key
}
```

```java good
@Retryable(includes = {HttpServerErrorException.ServiceUnavailable.class, ResourceAccessException.class},
           maxRetries = 2, delay = 200, multiplier = 2, jitter = 50)
public KetQua thanhToan(YeuCau yc, String idempotencyKey) {
    return client.post().uri("/thanh-toan").header("Idempotency-Key", idempotencyKey)
                 .body(yc).retrieve().body(KetQua.class);
}
```

`ResourceAccessException` do **read timeout** nghĩa là: không biết đối tác đã xử lý hay chưa. Chỉ an toàn để retry khi đối tác hỗ trợ idempotency key (bài chuyên sâu).

## Bẫy: đọc field qua proxy

```java bad
@Service class CicService {
    final AtomicInteger toiDa = new AtomicInteger();
    @ConcurrencyLimit(2) public DiemCic gioiHan(…) { … toiDa.accumulateAndGet(…) … }
}
// ở nơi khác: cicService.toiDa   →   null
```

```java good
public int toiDaDongThoi() { return toiDa.get(); }        // gọi method → proxy chuyển vào object thật
// tối đa đồng thời 2 … (đọc field qua proxy: null)
```

Bean có `@ConcurrencyLimit`/`@Retryable`/`@Transactional` được thay bằng **lớp con CGLIB**. Field của lớp con không bao giờ được khởi tạo (constructor của bean thật không chạy trên proxy); chỉ **method** được chuyển tiếp. Không truy cập field của bean khác — luôn đi qua method.

## Pitfalls

- Retry nhiều tầng: service A retry 3 lần gọi B, B retry 3 lần gọi C → C nhận 16 lời gọi cho một request. Chỉ retry ở **một** tầng (thường là gần đối tác nhất).
- Retry bên trong transaction: mỗi lần thử giữ kết nối DB và có thể chạm dữ liệu đã bị đánh dấu rollback-only.
- Timeout của client lớn hơn timeout của gateway phía trước → người dùng đã nhận 504 mà server vẫn chờ.
- `@Retryable` trên method `private` hoặc gọi nội bộ → không có tác dụng (proxy).
- Không log/đo số lần retry → không biết đối tác đang chập chờn.

:::senior Góc nhìn senior
Viết **ngân sách thời gian** cho mỗi luồng: request của người dùng có 3 giây; gọi CIC tối đa 1 s × 2 lần + nghỉ = 2,3 s; còn lại cho DB và xử lý. Cấu hình timeout và retry từ ngân sách đó, không theo cảm tính. Với đối tác quan trọng của ngân hàng (CIC, Napas, cổng thuế), thêm circuit breaker (Resilience4j) để ngừng gọi khi họ sập hẳn, và metric `số lần retry`, `số lần timeout` theo từng đối tác.
:::

:::version Spring Boot 3 và 4
- Boot 3: retry bằng thư viện **Spring Retry** (`@EnableRetry`, `@Retryable(maxAttempts = …)` — lưu ý `maxAttempts` tính cả lần đầu), giới hạn đồng thời bằng Resilience4j bulkhead.
- Spring Framework 7 / Boot 4: `@Retryable` (`maxRetries` **không** tính lần đầu), `@ConcurrencyLimit`, `@EnableResilientMethods` có sẵn trong `spring-context`; còn có `RetryTemplate` mới trong `org.springframework.core.retry` để retry bằng code.
:::

:::interview Khi nào nên và không nên retry một lời gọi HTTP?
Nên retry khi lỗi có khả năng là tạm thời và thao tác an toàn khi lặp lại: 503/502/504, timeout kết nối, mất kết nối, với GET/PUT/DELETE hoặc POST có idempotency key. Không retry lỗi do chính request (4xx), và không retry thao tác không idempotent khi không chắc đối tác chưa xử lý (read timeout của lệnh chuyển tiền). Retry phải có giới hạn số lần, backoff có jitter, timeout cho từng lần, và chỉ ở một tầng; khi đối tác sập kéo dài thì dùng circuit breaker thay vì retry mãi.
:::

:::quiz `@Retryable(maxRetries = 3, delay = 100, multiplier = 2)`, đối tác luôn trả 503. Đối tác nhận bao nhiêu lời gọi?
- [ ] 3
- [x] 4
- [ ] 5
- [ ] 1

1 lần đầu + 3 lần thử lại. Đã chạy: *đối tác nhận 4 lần gọi*, tổng 743 ms.
:::

:::quiz Đọc trực tiếp field `cicService.toiDa` của một bean có `@ConcurrencyLimit` từ bean khác. Kết quả?
- [ ] Giá trị đúng
- [x] `null` — bạn đang đọc field của proxy CGLIB, không phải của object thật
- [ ] Lỗi biên dịch
- [ ] `0`

Đã chạy: *đọc field qua proxy: null*. Gọi qua method thì ra 2.
:::

:::exercise Ngân sách thời gian khi đối tác treo
Đối tác không trả lời (treo). Client có `read-timeout: 1s`, method có `@Retryable(maxRetries = 3, delay = 100, multiplier = 2)` và retry cả `ResourceAccessException`. Người gọi phải chờ tối đa bao lâu trước khi nhận lỗi? Đề xuất cấu hình để giữ dưới 2,5 giây.
???
4 lần gọi × 1 s timeout + nghỉ 100 + 200 + 400 ms ≈ **4,7 s**. Đã chạy với đối tác giả lập chờ 2 s mỗi lần: `ResourceAccessException sau 4712 ms`.

Để dưới 2,5 s, giảm cả hai: ví dụ `read-timeout: 700ms`, `maxRetries = 2`, `delay = 100`, `multiplier = 2` → 3 × 0,7 + 0,1 + 0,2 = 2,4 s.

Cẩn thận với thuộc tính `timeout` của `@Retryable`: nó **không** cắt ngang lời gọi đang chạy, chỉ ngừng thử lại khi đã quá thời gian. Đã chạy `@Retryable(…, timeout = 2500)` với đối tác treo: `ResourceAccessException sau 3310 ms, đối tác nhận 3 lần` — vượt 2,5 s vì lần gọi thứ 3 bắt đầu trước mốc đó và chờ hết read-timeout. Giới hạn cứng cho từng lần gọi vẫn phải là timeout của HTTP client. Quan trọng hơn: với lỗi timeout của thao tác **không** idempotent, không retry mà trả lỗi để kiểm tra trạng thái sau.
:::
