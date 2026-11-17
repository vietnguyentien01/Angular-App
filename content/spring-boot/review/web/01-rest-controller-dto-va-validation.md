---
title: "REST controller, DTO và validation — viết một API đúng chuẩn"
summary: "Nhắc nhanh @RestController, @GetMapping/@PostMapping, @PathVariable/@RequestParam/@RequestBody, DTO bằng record, @Valid với Bean Validation, ResponseEntity và mã trạng thái, phân trang với Pageable. Mọi request/response chạy thật trên Spring Boot 4.1.2."
type: card
level: core
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, spring-mvc, rest, validation]
related: [spring-boot/consolidate/web/xu-ly-loi-api-voi-problemdetail, spring-boot/deep-dive/web/ben-trong-mot-request-spring-mvc]
---

## Tóm tắt nhanh

- `@RestController` = controller trả dữ liệu (JSON) thay vì view. Mỗi method gắn với một method HTTP + đường dẫn.
- Nhận và trả **DTO bằng `record`**, không trả thẳng entity JPA (lộ field nội bộ, lỗi lazy loading, vòng lặp JSON).
- `@Valid @RequestBody` + annotation như `@NotBlank`, `@Positive` → dữ liệu sai bị chặn với **400** trước khi vào method.
- Tạo mới trả **201** + header `Location`. Lỗi trả **ProblemDetail** (RFC 9457) — Spring Boot làm sẵn cho các lỗi chuẩn.
- Danh sách lớn luôn **phân trang** (`Pageable`), không trả cả bảng.

## Ví dụ (dự án `don-hang-api`, đã chạy)

```java title="SanPhamController.java"
@RestController
@RequestMapping("/api/san-pham")
public class SanPhamController {

    public record TaoSanPhamRequest(
            @NotBlank @Size(max = 200) String ten,
            @NotNull @Positive @Digits(integer = 15, fraction = 0) BigDecimal gia,
            @PositiveOrZero int tonKho) {}

    public record SanPhamResponse(Long id, String ten, BigDecimal gia, int tonKho) {
        static SanPhamResponse tu(SanPham s) { return new SanPhamResponse(s.getId(), s.getTen(), s.getGia(), s.getTonKho()); }
    }

    private final SanPhamRepository repo;
    public SanPhamController(SanPhamRepository repo) { this.repo = repo; }

    @GetMapping
    public Page<SanPhamResponse> timKiem(@RequestParam(defaultValue = "") String q,
                                         @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        return repo.findByTenContainingIgnoreCase(q, pageable).map(SanPhamResponse::tu);
    }

    @GetMapping("/{id}")
    public SanPhamResponse chiTiet(@PathVariable Long id) {
        return repo.findById(id).map(SanPhamResponse::tu)
                   .orElseThrow(() -> new KhongTimThayException("sản phẩm", id));
    }

    @PostMapping
    public ResponseEntity<SanPhamResponse> tao(@Valid @RequestBody TaoSanPhamRequest req) {
        SanPham s = repo.save(new SanPham(req.ten().strip(), req.gia(), req.tonKho()));
        return ResponseEntity.created(URI.create("/api/san-pham/" + s.getId())).body(SanPhamResponse.tu(s));
    }
}
```

```text
POST /api/san-pham  {"ten":"Ấm siêu tốc","gia":450000,"tonKho":30}
→ 201  Location: /api/san-pham/6
  {"id":6,"ten":"Ấm siêu tốc","gia":450000,"tonKho":30}

GET /api/san-pham?q=máy&size=2&sort=gia,desc
→ 200 {"content":[{"id":2,"ten":"Máy lọc nước","gia":5000000,"tonKho":5},
                  {"id":3,"ten":"Máy đo huyết áp","gia":1200000,"tonKho":12}],
       "page":{"size":2,"number":0,"totalElements":3,"totalPages":2}}

GET /api/san-pham/abc
→ 400 {"detail":"Failed to convert 'id' with value: 'abc'","instance":"/api/san-pham/abc","status":400,"title":"Bad Request"}

DELETE /api/san-pham/1   (không có handler DELETE)
→ 405 {"detail":"Method 'DELETE' is not supported.", … ,"title":"Method Not Allowed"}
```

## Bảng chọn nhanh

| Lấy dữ liệu từ | Annotation | Ví dụ |
|---|---|---|
| Đường dẫn | `@PathVariable` | `/api/san-pham/{id}` |
| Query string | `@RequestParam` | `?q=máy&page=0` |
| Body JSON | `@RequestBody` (+ `@Valid`) | tạo/cập nhật |
| Header | `@RequestHeader` | `Idempotency-Key` |
| Phân trang + sắp xếp | `Pageable` (+ `@PageableDefault`) | `?page=0&size=20&sort=gia,desc` |

| Tình huống | Mã |
|---|---|
| Đọc thành công | 200 |
| Tạo mới | 201 + `Location` |
| Thành công, không có nội dung (xoá) | 204 |
| Dữ liệu sai | 400 |
| Chưa đăng nhập / không có quyền | 401 / 403 |
| Không tồn tại | 404 |
| Xung đột trạng thái (hết hàng, trùng email, sai version) | 409 |

## Lỗi hay gặp: trả entity JPA ra JSON

```java bad
@GetMapping("/{id}")
public DonHang chiTiet(@PathVariable Long id) { return repo.findById(id).orElseThrow(); }
// quan hệ LAZY ngoài transaction → LazyInitializationException hoặc serialize cả đồ thị object;
// DonHang ↔ DongDonHang tham chiếu hai chiều → vòng lặp vô hạn khi sinh JSON;
// đổi tên field trong entity = đổi API mà không ai biết
```

```java good
public record DonHangResponse(Long id, String khachHang, TrangThai trangThai, Instant taoLuc,
                              BigDecimal tongTien, List<DongResponse> dong) {}
// chuyển entity → DTO trong service, bên trong transaction
```

:::version Spring Boot 3 và 4
- `ProblemDetail` cho lỗi chuẩn: Spring Framework 6 / Boot 3 trở lên.
- Trả `Page` thẳng ra JSON: Spring Data cảnh báo *Serializing PageImpl instances as-is is not supported* (đã thấy trong log khi chạy bản đầu). Bài này bật `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)` để có dạng gọn `{"content": …, "page": {…}}` như ở trên.
- Boot 4 dùng **Jackson 3** (package `tools.jackson.*`); annotation `@JsonProperty`… vẫn ở `com.fasterxml.jackson.annotation`.
:::

:::interview Vì sao không nên trả entity JPA trực tiếp từ controller?
Entity là mô hình lưu trữ, không phải hợp đồng API. Trả trực tiếp gây ba vấn đề: (1) quan hệ lazy bị truy cập ngoài transaction (`LazyInitializationException`) hoặc kéo theo cả đồ thị object, sinh thêm query; (2) quan hệ hai chiều gây vòng lặp khi serialize; (3) mọi thay đổi entity (thêm field nội bộ, đổi tên cột) thành thay đổi API ngoài ý muốn, kể cả lộ dữ liệu nhạy cảm. DTO (record) tách hai thứ này và cho phép tối ưu query cho đúng dữ liệu cần trả.
:::

:::quiz `POST` tạo sản phẩm thành công nên trả gì?
- [ ] 200 và body rỗng
- [x] 201, header `Location` trỏ tới tài nguyên mới, body là sản phẩm vừa tạo
- [ ] 204
- [ ] 202

`ResponseEntity.created(uri).body(dto)`. Đã chạy: `201`, `Location: /api/san-pham/6`.
:::

:::quiz `GET /api/san-pham/abc` với `@PathVariable Long id`. Kết quả?
- [ ] 500 vì `NumberFormatException`
- [x] 400 — Spring không chuyển được `abc` sang `Long`
- [ ] 404
- [ ] Method nhận `id = null`

Đã chạy: `400`, `"detail":"Failed to convert 'id' with value: 'abc'"`.
:::

:::quiz Endpoint nhận `@RequestBody TaoSanPhamRequest req` nhưng **quên `@Valid`**. Gửi `{"ten":"","gia":-1}`. Chuyện gì xảy ra?
- [ ] 400 như bình thường
- [x] Không có validation — method chạy với dữ liệu sai
- [ ] Lỗi khởi động
- [ ] 422

Đã thử: endpoint không có `@Valid` nhận `{"ten":""}` và chạy bình thường (`chạy với ten=[]`); thêm `@Valid` thì trả 400. Annotation ràng buộc trên record chỉ có tác dụng khi có `@Valid` (hoặc `@Validated`) ở chỗ nhận.
:::
