---
title: "Actuator, health probe và metric — ứng dụng tự báo tình trạng của mình"
summary: "Nhắc nhanh Spring Boot Actuator: mặc định chỉ mở health, mở thêm metric và Prometheus có chủ đích, liveness/readiness cho Kubernetes, health có chi tiết DB, metric http.server.requests tự có và metric nghiệp vụ tự định nghĩa bằng MeterRegistry. Đo thật trên Boot 4.1.2."
type: card
level: core
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, actuator, health, metrics, prometheus]
related: [spring-boot/consolidate/production/log-metric-va-graceful-shutdown, spring-boot/deep-dive/production/dong-goi-docker-va-khoi-dong-nhanh]
---

## TL;DR

- `spring-boot-starter-actuator` thêm các endpoint vận hành dưới `/actuator`. Mặc định **qua HTTP chỉ mở `health`** — mở thêm phải ghi rõ.
- `/actuator/health/liveness` (process còn sống?) và `/actuator/health/readiness` (sẵn sàng nhận request?) cho probe của Kubernetes.
- Metric HTTP (`http.server.requests`), JVM, HikariCP… có sẵn. Thêm `micrometer-registry-prometheus` để có `/actuator/prometheus`.
- Metric nghiệp vụ (đơn tạo thành công, đơn hết hàng) viết bằng **`MeterRegistry`** — một dòng code.
- Endpoint actuator **phải được bảo vệ** (security riêng hoặc cổng quản trị riêng); `env`, `heapdump`, `configprops` lộ cấu hình và dữ liệu.

## Mặc định (đã chạy)

```text
GET /actuator            → {"_links":{"self":…,"health":…,"health-path":…}}
GET /actuator/health     → {"groups":["liveness","readiness"],"status":"UP"}
GET /actuator/metrics    → 404   (chưa mở)
GET /actuator/env        → 404
```

## Cấu hình thường dùng

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: always          # production: when-authorized
      probes:
        add-additional-paths: true  # thêm /livez và /readyz ở cổng chính
```

```text
GET /actuator/health
  "components": { "db": {"details":{"database":"PostgreSQL","validationQuery":"isValid()"},"status":"UP"},
                  "diskSpace": {…,"status":"UP"}, "livenessState": {"status":"UP"},
                  "readinessState": {"status":"UP"}, "ping": {"status":"UP"}, "ssl": {…} }
GET /livez  → 200      GET /readyz → 200
```

## Metric nghiệp vụ

```java title="DonHangService.java"
private final MeterRegistry metrics;

@Transactional
public DonHang taoDon(Long khachHangId, List<DongYeuCau> dong) {
    …
    try {
        sp.xuatKho(d.soLuong());
    } catch (HetHangException e) {
        metrics.counter("don_hang.tao", "ket_qua", "het_hang").increment();
        throw e;
    }
    …
    DonHang daLuu = donHangRepo.save(don);
    metrics.counter("don_hang.tao", "ket_qua", "thanh_cong").increment();
    metrics.summary("don_hang.gia_tri", "don_vi", "vnd").record(daLuu.tongTien().doubleValue());
    return daLuu;
}
```

Sau 3 đơn thành công, 1 đơn hết hàng, 3 lần xem sản phẩm (1 lần 404):

```text
GET /actuator/prometheus
don_hang_gia_tri_count{don_vi="vnd"} 3
don_hang_gia_tri_sum{don_vi="vnd"} 1050000.0
don_hang_gia_tri_max{don_vi="vnd"} 350000.0
don_hang_tao_total{ket_qua="het_hang"} 1.0
don_hang_tao_total{ket_qua="thanh_cong"} 3.0
http_server_requests_seconds_count{…,method="GET",outcome="CLIENT_ERROR",status="404",uri="/api/san-pham/{id}"} 1
http_server_requests_seconds_count{…,method="GET",outcome="SUCCESS",status="200",uri="/api/san-pham/{id}"} 2
http_server_requests_seconds_count{…,method="POST",outcome="CLIENT_ERROR",status="409",uri="/api/don-hang"} 1
http_server_requests_seconds_count{…,method="POST",outcome="SUCCESS",status="201",uri="/api/don-hang"} 3
```

`uri` là **template** (`/api/san-pham/{id}`), không phải đường dẫn thật — nhờ vậy số chuỗi thời gian không bùng nổ theo id. Tên `don_hang.tao` thành `don_hang_tao_total` theo quy ước Prometheus.

## Bảng chọn nhanh

| Cần | Cách |
|---|---|
| Kubernetes biết pod còn sống | liveness probe → `/actuator/health/liveness` (hoặc `/livez`) |
| Kubernetes chỉ gửi traffic khi sẵn sàng | readiness probe → `/actuator/health/readiness` (`/readyz`) |
| Prometheus thu thập metric | `micrometer-registry-prometheus` + mở `prometheus` |
| Đếm sự kiện nghiệp vụ | `metrics.counter("ten", "tag", "gia_tri").increment()` |
| Đo thời gian một đoạn code | `Timer` / `@Timed` (cần `TimedAspect`) |
| Phân phối giá trị (giá trị đơn hàng) | `DistributionSummary` |
| Bảo vệ actuator | `management.server.port` riêng (chỉ mạng nội bộ) + security |

## Lỗi hay gặp: tag có giá trị không giới hạn

```java bad
metrics.counter("don_hang.tao", "khach_hang_id", id.toString()).increment();   // mỗi khách một chuỗi thời gian
```

```java good
metrics.counter("don_hang.tao", "ket_qua", "thanh_cong").increment();          // tag có vài giá trị cố định
```

Mỗi tổ hợp tag là một chuỗi thời gian riêng trong Prometheus. Tag theo id người dùng/đơn hàng làm bộ nhớ của ứng dụng lẫn của Prometheus tăng không giới hạn.

:::version Spring Boot 3 và 4
- Health group `liveness`/`readiness` có từ Boot 2.3 (tự bật khi chạy trên Kubernetes). Trong lần chạy thử với Boot 4.1.2 (không chạy trên Kubernetes), `/actuator/health` vẫn liệt kê hai group này.
- Micrometer Observation API (Boot 3+) hợp nhất metric và tracing; tracing gửi tới OpenTelemetry qua `spring-boot-starter-opentelemetry` (Boot 4).
:::

:::interview Liveness và readiness probe khác nhau thế nào?
Liveness trả lời "process có còn hoạt động không" — fail thì Kubernetes khởi động lại container; chỉ nên fail khi ứng dụng hỏng không tự hồi phục được (deadlock, trạng thái nội bộ hỏng). Readiness trả lời "có nên gửi traffic tới không" — fail thì pod bị gỡ khỏi load balancer nhưng không bị khởi động lại; dùng khi đang khởi động, đang tắt, hoặc phụ thuộc quan trọng tạm thời không dùng được. Đưa kiểm tra DB vào liveness là sai lầm phổ biến: DB chậm một lúc làm Kubernetes khởi động lại mọi pod cùng lúc.
:::

:::quiz Thêm starter actuator, không cấu hình gì. `GET /actuator/metrics` trả gì?
- [ ] Danh sách metric
- [x] 404 — mặc định chỉ `health` được mở qua HTTP
- [ ] 401
- [ ] 500

Đã chạy. Phải thêm `metrics` vào `management.endpoints.web.exposure.include`.
:::

:::quiz Vì sao metric `http.server.requests` dùng `uri="/api/san-pham/{id}"` thay vì `/api/san-pham/1`?
- [ ] Để ẩn id vì lý do bảo mật
- [x] Để số chuỗi thời gian không tăng theo mỗi id khác nhau
- [ ] Vì Prometheus không hỗ trợ số
- [ ] Do lỗi của Micrometer

Template giữ số tổ hợp tag nhỏ và cố định — cùng nguyên tắc khi tự đặt tag.
:::
