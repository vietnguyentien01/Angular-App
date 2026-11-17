---
title: "Log có cấu trúc, metric nghiệp vụ, bảo vệ actuator và graceful shutdown"
summary: "Bật log JSON chuẩn ECS bằng một property, đếm đăng nhập thất bại bằng Micrometer, đóng actuator khỏi internet, và kiểm chứng graceful shutdown: request 4 giây vẫn hoàn tất khi nhận SIGTERM, request mới bị từ chối, quá thời gian chờ thì bị cắt. Đo thật trên Boot 4.1.2."
level: intermediate
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, logging, metrics, actuator, graceful-shutdown]
related: [spring-boot/review/production/actuator-health-va-metric, spring-boot/deep-dive/production/dong-goi-docker-va-khoi-dong-nhanh]
---

## Tóm tắt nhanh

- Log production là **JSON một dòng** để hệ thống log (ELK, Loki, Cloud Logging) tìm theo trường: `logging.structured.format.console=ecs` (hoặc `logstash`, `gelf`).
- Metric nghiệp vụ cho những câu hỏi mà log trả lời chậm: "bao nhiêu đăng nhập thất bại trong 5 phút?" → cảnh báo khi tăng đột biến.
- Actuator **không** mở ra internet: cổng quản trị riêng (`management.server.port`) hoặc security riêng; `show-details` chỉ khi đã xác thực.
- Graceful shutdown (mặc định từ Boot 3.4): SIGTERM → ngừng nhận request mới → chờ request đang chạy (tối đa `spring.lifecycle.timeout-per-shutdown-phase`, mặc định 30 s) → đóng DB pool.
- Thời gian chờ của Kubernetes (`terminationGracePeriodSeconds`, mặc định 30 s) phải **lớn hơn** thời gian chờ của Spring.

## Log có cấu trúc

```bash
java -jar app.jar --logging.structured.format.console=ecs
```

Một dòng log (đã định dạng lại cho dễ đọc):

```json
{
  "@timestamp": "2026-11-16T06:18:31.732154184Z",
  "log": { "level": "INFO", "logger": "vn.hoc.donhang.Cham" },
  "process": { "pid": 12718, "thread": { "name": "http-nio-8080-exec-1" } },
  "service": { "name": "don-hang-api", "version": "0.0.1-SNAPSHOT", "node": {} },
  "message": "bắt đầu xử lý chậm 10 ms",
  "ecs": { "version": "8.11" }
}
```

Tiếng Việt được escape `\uXXXX` — JSON hợp lệ, hệ thống log hiển thị lại đúng. `service.name` lấy từ `spring.application.name`. Giá trị đặt vào MDC (vd `traceId`, `maDonHang`) cũng thành trường riêng.

```java bad
log.info("Đơn " + don.getId() + " của khách " + kh.getEmail() + " đã tạo, token=" + token);
// nối chuỗi luôn tốn kể cả khi tắt INFO; lộ email và token vào log
```

```java good
log.info("Đã tạo đơn {} cho khách {}", don.getId(), kh.getId());
```

## Metric nghiệp vụ: đăng nhập thất bại

```java title="DangNhapController.java"
Authentication a;
try {
    a = auth.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(req.tenDangNhap(), req.matKhau()));
} catch (AuthenticationException e) {
    metrics.counter("dang_nhap", "ket_qua", "that_bai").increment();   // không gắn tên đăng nhập vào tag
    throw e;
}
metrics.counter("dang_nhap", "ket_qua", "thanh_cong").increment();
```

```text
POST /api/dang-nhap  ×4 (sai, sai, không tồn tại, đúng)  → 401 401 401 200
dang_nhap_total{ket_qua="thanh_cong"} 1.0
dang_nhap_total{ket_qua="that_bai"} 3.0
```

Cảnh báo kiểu `rate(dang_nhap_total{ket_qua="that_bai"}[5m]) > ngưỡng` phát hiện dò mật khẩu hàng loạt. Tên đăng nhập cụ thể ghi vào **log** (có kiểm soát), không vào tag metric.

## Bảo vệ actuator

Thí nghiệm: security của dự án chỉ cho phép `/actuator/health/**`, nên khi mở thêm endpoint thì `/actuator/metrics`, `/livez`, `/readyz` đều trả **401** — đúng mong muốn với API công khai, nhưng probe của Kubernetes và Prometheus cũng bị chặn. Hai cách:

```yaml
management:
  server:
    port: 9090                  # actuator ở cổng riêng, chỉ mở trong mạng nội bộ cluster
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      show-details: when-authorized
```

hoặc một `SecurityFilterChain` riêng cho `/actuator/**` (`securityMatcher` + `@Order`), cho phép health/prometheus từ mạng nội bộ và đòi vai trò quản trị cho phần còn lại. **Không bao giờ** mở `env`, `heapdump`, `threaddump`, `configprops` ra ngoài.

## Graceful shutdown

Endpoint thử nghiệm ngủ 4 giây. Gửi request, 1 giây sau gửi `SIGTERM` (đã chạy):

```text
log:  Commencing graceful shutdown. Waiting for active requests to complete
      request mới trong lúc tắt → không kết nối được
      Graceful shutdown complete
      process thoát sau 4.7 s
request đang chạy: xong sau 4000 ms → 200
```

Request 5 giây với `spring.lifecycle.timeout-per-shutdown-phase=2s`:

```text
log:  Graceful shutdown aborted with one or more requests still active
request đang chạy: → 000 (curl exit 52: server đóng kết nối, không trả lời)
```

Trong container: `docker stop` gửi SIGTERM — đã thấy cùng hai dòng log *Commencing… / complete* (bài chuyên sâu). Kubernetes gửi SIGTERM, chờ `terminationGracePeriodSeconds`, rồi SIGKILL. Readiness chuyển sang `OUT_OF_SERVICE` khi bắt đầu tắt để load balancer ngừng gửi request.

## Pitfalls

- `show-details: always` ra internet → lộ loại DB, dung lượng đĩa, đường dẫn (đã thấy `diskSpace.path` trong output).
- Liveness probe phụ thuộc DB → DB chậm làm mọi pod bị khởi động lại.
- `java -jar` chạy qua script shell không `exec` → SIGTERM tới shell, không tới JVM, graceful shutdown không xảy ra.
- Log ở mức DEBUG trên production cho cả gói `org.hibernate.SQL` → log bùng nổ, lộ dữ liệu.
- Metric với tag là id/email (bùng nổ số chuỗi thời gian).

:::senior Góc nhìn senior
"Sẵn sàng cho production" nên là một checklist trong định nghĩa hoàn thành của team: log JSON có traceId; metric RED (Rate, Errors, Duration) tự có từ `http.server.requests` + vài metric nghiệp vụ; health/readiness đúng nghĩa; actuator ở cổng nội bộ; graceful shutdown khớp với cấu hình Kubernetes; cảnh báo dựa trên metric chứ không dựa trên việc ai đó đọc log. Kiểm tra checklist bằng một môi trường staging và một lần tắt pod thật khi đang có tải.
:::

:::version Spring Boot 3 và 4
- Log có cấu trúc (`logging.structured.format.*`): Boot **3.4**. Trước đó cần thư viện như `logstash-logback-encoder`.
- Graceful shutdown có từ Boot 2.3 (`server.shutdown=graceful`) và thành **mặc định** từ Boot 3.4.
- `management.endpoint.health.probes.add-additional-paths` (đường dẫn `/livez`, `/readyz` ở cổng chính): Boot 3.x trở lên.
:::

:::interview Graceful shutdown trong Spring Boot hoạt động thế nào và cần lưu ý gì khi chạy trên Kubernetes?
Khi nhận SIGTERM, web server ngừng nhận kết nối mới và chờ các request đang xử lý hoàn tất trong giới hạn `spring.lifecycle.timeout-per-shutdown-phase` (mặc định 30 s), rồi context đóng các bean (DB pool, executor). Trên Kubernetes cần: `terminationGracePeriodSeconds` lớn hơn thời gian chờ của Spring; readiness probe để pod bị gỡ khỏi Service sớm; có thể thêm `preStop` sleep vài giây vì việc cập nhật endpoint của Service không tức thời; và đảm bảo JVM là PID 1 (hoặc nhận được tín hiệu) trong container.
:::

:::quiz Request đang chạy 5 giây, `timeout-per-shutdown-phase=2s`, ứng dụng nhận SIGTERM. Client nhận gì?
- [ ] 200 sau 5 giây
- [ ] 503
- [x] Kết nối bị đóng không có phản hồi
- [ ] 200 ngay lập tức

Đã chạy: *Graceful shutdown aborted with one or more requests still active*, curl exit 52.
:::

:::quiz Vì sao không nên gắn tên đăng nhập làm tag của metric `dang_nhap`?
- [ ] Prometheus không hỗ trợ chuỗi tiếng Việt
- [x] Mỗi giá trị tag là một chuỗi thời gian riêng — số người dùng không giới hạn làm bùng nổ bộ nhớ, và lộ dữ liệu cá nhân vào hệ thống metric
- [ ] Vì metric phải là số
- [ ] Vì Micrometer cấm

Dùng tag có vài giá trị cố định (`thanh_cong`, `that_bai`).
:::

:::exercise Metric thời gian gọi đối tác
Đo thời gian mỗi lần gọi CIC (bài *Timeout, retry*) thành metric `doi_tac.goi` với tag `doi_tac=cic` và `ket_qua=thanh_cong|loi`, xem được trên `/actuator/prometheus`.
???
```java
private final MeterRegistry metrics;

public DiemCic layDiem(String cccd) {
    Timer.Sample mau = Timer.start(metrics);
    String ketQua = "loi";
    try {
        DiemCic d = client.layDiem(cccd, 0, 0);
        ketQua = "thanh_cong";
        return d;
    } finally {
        mau.stop(metrics.timer("doi_tac.goi", "doi_tac", "cic", "ket_qua", ketQua));
    }
}
```

Trên Prometheus sẽ có `doi_tac_goi_seconds_count`, `_sum`, `_max` theo từng tag. Đây cùng dạng với `don_hang_tao_total` và `dang_nhap_total` đã chạy ở trên. Nếu muốn có percentile (p95, p99), bật histogram cho meter này: `management.metrics.distribution.percentiles-histogram.doi_tac.goi=true`. Cách nhanh hơn: HTTP client do Boot cấu hình đã có metric `http.client.requests` theo `uri` và `status`.
:::
