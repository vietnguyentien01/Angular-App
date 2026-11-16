---
title: "Xử lý lỗi API với ProblemDetail — một định dạng lỗi cho mọi trường hợp"
summary: "Biến exception nghiệp vụ thành mã HTTP đúng bằng @RestControllerAdvice, trả lỗi validation kèm danh sách field (kể cả field lồng trong danh sách), thêm type và thuộc tính riêng cho lỗi hết hàng, và kiểm tra transaction đã rollback khi lỗi. Mọi response chạy thật."
level: intermediate
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, spring-mvc, error-handling, problem-detail, validation]
related: [spring-boot/review/web/rest-controller-dto-va-validation, spring-boot/consolidate/transactions/transaction-khong-rollback-va-lost-update]
---

## TL;DR

- Một `@RestControllerAdvice` cho cả ứng dụng: exception nghiệp vụ → `ProblemDetail` với mã HTTP đúng. Controller và service **không** tự bắt lỗi để trả JSON.
- Kế thừa `ResponseEntityExceptionHandler` để mọi lỗi chuẩn của Spring MVC (JSON hỏng, sai kiểu, sai method) cũng có cùng định dạng.
- Lỗi validation mặc định chỉ có `"Invalid request content."` — **override** `handleMethodArgumentNotValid` để trả danh sách field.
- Lỗi nghiệp vụ có `type` (URI ổn định) để frontend phân biệt, và thuộc tính bổ sung (`conLai`) để hiển thị.
- Không bao giờ trả stack trace hay câu SQL ra client.

## Cơ chế

Khi method controller ném exception, `DispatcherServlet` hỏi lần lượt các `HandlerExceptionResolver`. Resolver xử lý `@ExceptionHandler` tìm method phù hợp nhất (kiểu exception gần nhất) trong controller rồi trong các `@ControllerAdvice`. `ResponseEntityExceptionHandler` đã có sẵn handler cho các exception chuẩn của Spring MVC (JSON hỏng, sai kiểu tham số, sai method…), mỗi cái tạo một `ProblemDetail`.

`ProblemDetail` theo RFC 9457 (trước đây là RFC 7807), `Content-Type: application/problem+json`:

```json
{ "type": "…", "title": "…", "status": 409, "detail": "…", "instance": "/api/…", "...": "thuộc tính thêm" }
```

Mọi response dưới đây chạy thật với `don-hang-api`.

## Validation: mặc định và sau khi sửa

```text
POST /api/san-pham {"ten":"  ","gia":-1,"tonKho":3}

mặc định:
→ 400 {"detail":"Invalid request content.","instance":"/api/san-pham","status":400,"title":"Bad Request"}
```

Frontend không biết field nào sai. Sửa:

```java title="XuLyLoiApi.java"
@RestControllerAdvice
public class XuLyLoiApi extends ResponseEntityExceptionHandler {

    public record LoiTruong(String truong, String thongDiep) {}

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, HttpHeaders headers,
                                                                  HttpStatusCode status, WebRequest request) {
        ProblemDetail pd = ex.getBody();
        pd.setDetail("Dữ liệu không hợp lệ");
        List<LoiTruong> loi = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> new LoiTruong(f.getField(), f.getDefaultMessage()))
                .sorted(Comparator.comparing(LoiTruong::truong))
                .toList();
        pd.setProperty("loi", loi);
        return handleExceptionInternal(ex, pd, headers, status, request);
    }
    // … các @ExceptionHandler bên dưới
}
```

```text
→ 400 {"detail":"Dữ liệu không hợp lệ","instance":"/api/san-pham","status":400,"title":"Bad Request",
       "loi":[{"truong":"gia","thongDiep":"must be greater than 0"},{"truong":"ten","thongDiep":"must not be blank"}]}

POST /api/don-hang {"khachHangId":null,"dong":[{"sanPhamId":1,"soLuong":0}]}
→ 400 {…,"loi":[{"truong":"dong[0].soLuong","thongDiep":"must be greater than or equal to 1"},
                {"truong":"khachHangId","thongDiep":"must not be null"}]}
```

Field lồng trong danh sách được báo đúng vị trí (`dong[0].soLuong`) nhờ `List<@Valid DongRequest>`. Tên field khớp với tên trong form Angular, nên frontend gắn được lỗi vào đúng ô nhập.

Thông điệp mặc định là tiếng Anh (gửi `Accept-Language: vi` vẫn ra tiếng Anh, đã thử). Muốn tiếng Việt: ghi `message` trong annotation, hoặc tạo `ValidationMessages.properties` trong `src/main/resources`. Đã thử dòng `jakarta.validation.constraints.NotBlank.message=không được để trống` (ghi dạng `\uXXXX` nếu file không phải UTF-8): lỗi trả về `{"truong":"ten","thongDiep":"không được để trống"}`, header `Content-Type: application/problem+json`.

## Lỗi nghiệp vụ

```java
@ExceptionHandler(KhongTimThayException.class)
ProblemDetail khongTimThay(KhongTimThayException e) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
}

@ExceptionHandler(HetHangException.class)
ProblemDetail hetHang(HetHangException e) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
    pd.setType(URI.create("https://api.vi-du.vn/loi/het-hang"));
    pd.setTitle("Không đủ hàng");
    pd.setProperty("sanPhamId", e.sanPhamId());
    pd.setProperty("conLai", e.conLai());
    return pd;
}
```

```text
POST /api/don-hang {"khachHangId":1,"dong":[{"sanPhamId":1,"soLuong":1},{"sanPhamId":2,"soLuong":9}]}
→ 409 {"detail":"Sản phẩm 2 chỉ còn 5, yêu cầu 9","instance":"/api/don-hang","status":409,
       "title":"Không đủ hàng","type":"https://api.vi-du.vn/loi/het-hang","sanPhamId":2,"conLai":5}

GET /api/san-pham/1   → "tonKho":18   (trước đơn lỗi cũng là 18)
```

Đơn trên trừ kho sản phẩm 1 **trước** khi phát hiện sản phẩm 2 hết hàng. Vì `HetHangException` là `RuntimeException` ném ra khỏi method `@Transactional`, cả transaction rollback — tồn kho sản phẩm 1 không bị trừ. Bài *Transaction không rollback* cho thấy khi nào điều này **không** xảy ra.

## Code bad / good

```java bad
@PostMapping
public ResponseEntity<?> tao(@RequestBody TaoDonRequest req) {
    try {
        return ResponseEntity.ok(service.taoDon(…));
    } catch (Exception e) {
        return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));   // 500 cho cả lỗi người dùng
    }
}
```

```java good
@PostMapping
public ResponseEntity<DonHangResponse> tao(@Valid @RequestBody TaoDonRequest req) {
    var don = service.taoDon(…);          // ném exception nghiệp vụ, advice lo phần còn lại
    return ResponseEntity.created(URI.create("/api/don-hang/" + don.getId())).body(…);
}
```

## Pitfalls

- `catch (Exception e)` trong controller: nuốt lỗi, mất mã HTTP đúng, và nếu bắt trong method `@Transactional` thì transaction **không** rollback.
- Trả `e.getMessage()` của exception kỹ thuật (SQL, đường dẫn file) ra client → lộ thông tin. Chỉ trả thông điệp của exception nghiệp vụ; lỗi không lường trước trả thông điệp chung và **log** chi tiết kèm mã truy vết.
- Dùng 200 với `{"success": false}` cho lỗi — client, proxy, monitoring đều hiểu sai.
- `@ControllerAdvice` nhiều cái mà không đặt `@Order` → không biết cái nào thắng.

:::senior Góc nhìn senior
Định dạng lỗi là một phần hợp đồng API, cần thống nhất giữa backend, frontend Angular và cả tài liệu OpenAPI. Thống nhất từ đầu: ProblemDetail, danh sách `type` cho lỗi nghiệp vụ (`het-hang`, `sai-trang-thai`, `trung-email`), trường `loi` cho validation. Frontend viết một interceptor duy nhất đọc định dạng đó. Thêm `traceId` vào ProblemDetail (lấy từ tracing) để đội vận hành tìm log của đúng request khi khách báo lỗi.
:::

:::version Spring Boot 3 và 4
`ProblemDetail` và `ResponseEntityExceptionHandler` trả ProblemDetail có từ Spring Framework 6 (Boot 3). Trên Boot 2.x phải tự định nghĩa class lỗi. Thông điệp mặc định *Invalid request content.* là của Spring Framework 7; các bản khác có thể khác chữ.
:::

:::interview Bạn thiết kế xử lý lỗi cho REST API thế nào?
Một `@RestControllerAdvice` toàn cục kế thừa `ResponseEntityExceptionHandler`; mọi lỗi trả `ProblemDetail` (RFC 9457) với mã HTTP đúng ngữ nghĩa: 400 dữ liệu sai (kèm danh sách field), 401/403 xác thực/phân quyền, 404 không tồn tại, 409 xung đột trạng thái, 500 lỗi không lường trước (thông điệp chung, log đầy đủ, có traceId). Exception nghiệp vụ là class riêng, unchecked, mang dữ liệu cần thiết; controller và service không tự bắt để format. Lỗi nghiệp vụ có `type` ổn định để client phân biệt mà không phải so chuỗi `detail`.
:::

:::quiz Đơn hàng có 2 dòng; dòng 1 đã trừ kho, dòng 2 ném `HetHangException extends RuntimeException` trong method `@Transactional`. Tồn kho của sản phẩm ở dòng 1 thế nào?
- [ ] Bị trừ, vì lệnh trừ đã chạy
- [x] Không đổi — transaction rollback
- [ ] Bị trừ một nửa
- [ ] Tuỳ DB

Đã chạy: tồn kho sản phẩm 1 vẫn là 18 sau đơn lỗi.
:::

:::quiz Thông điệp lỗi validation mặc định (`must not be blank`) là tiếng Anh. Cách nào đổi sang tiếng Việt? (chọn nhiều)
- [x] Ghi `message` trong annotation: `@NotBlank(message = "Tên không được để trống")`
- [x] Tạo `ValidationMessages.properties` với các key như `jakarta.validation.constraints.NotBlank.message`
- [ ] Gửi `Accept-Language: vi`
- [ ] Đặt `spring.jackson.locale=vi`

Đã thử `Accept-Language: vi`: vẫn tiếng Anh, vì không có bộ thông điệp tiếng Việt sẵn.
:::

:::exercise Endpoint đổi giá
Thêm `PATCH /api/san-pham/{id}/gia` nhận `{"gia": …}`: giá bắt buộc và > 0 (thông điệp tiếng Việt), sản phẩm không tồn tại trả 404 theo định dạng chung, thành công trả sản phẩm sau khi đổi. Không gọi `save`.
???
```java
public record DoiGiaRequest(
        @NotNull(message = "Giá mới là bắt buộc") @Positive(message = "Giá phải lớn hơn 0") BigDecimal gia) {}

@PatchMapping("/{id}/gia")
@Transactional
public SanPhamResponse doiGia(@PathVariable Long id, @Valid @RequestBody DoiGiaRequest req) {
    SanPham s = repo.findById(id).orElseThrow(() -> new KhongTimThayException("sản phẩm", id));
    s.doiGia(req.gia());                 // entity đang được quản lý → Hibernate tự UPDATE khi commit
    return SanPhamResponse.tu(s);
}
```

Đã chạy:

```text
{"gia":1390000} → 200 {"id":1,"ten":"Nồi chiên không dầu","gia":1390000,"tonKho":18}
{"gia":0}       → 400 …"loi":[{"truong":"gia","thongDiep":"Giá phải lớn hơn 0"}]
{}              → 400 …"loi":[{"truong":"gia","thongDiep":"Giá mới là bắt buộc"}]
/999/gia        → 404 {"detail":"Không tìm thấy sản phẩm 999",…}
```

Không cần `save` vì *dirty checking* (bài *Persistence context*). Trong dự án thật, đặt `@Transactional` ở service thay vì controller; ở đây đặt ở controller cho gọn.
:::
