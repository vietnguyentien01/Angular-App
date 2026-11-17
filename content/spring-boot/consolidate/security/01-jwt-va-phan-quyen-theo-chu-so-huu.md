---
title: "JWT và phân quyền theo chủ sở hữu — đăng nhập, resource server, chống IDOR"
summary: "Xây đăng nhập phát JWT (HS256), cấu hình resource server đọc vai trò từ claim, lấy khách hàng từ token thay vì body, và chặn người dùng xem đơn của người khác (IDOR) bằng @PreAuthorize. Kèm lỗi thật: authority FACTOR_PASSWORD lọt vào token. Chạy trên Spring Security 7."
level: intermediate
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, spring-security, jwt, authorization, idor]
related: [spring-boot/review/security/security-filter-chain-co-ban, spring-boot/deep-dive/security/security-filter-chain-va-cors]
---

## Tóm tắt nhanh

- **Xác thực** một lần ở `/api/dang-nhap` → trả **access token JWT ngắn hạn** (15 phút). Mọi request sau gửi `Authorization: Bearer <token>`.
- Resource server (`spring-boot-starter-oauth2-resource-server`) kiểm tra **chữ ký** và **hạn** của token, rồi dựng `Authentication` từ claim.
- **Không bao giờ tin** định danh trong body/URL để quyết định "của ai": lấy `khachHangId` **từ token**.
- Mọi endpoint đọc/sửa tài nguyên theo id phải kiểm tra **quyền sở hữu** — thiếu bước này là lỗ hổng **IDOR** (Broken Object Level Authorization, đứng đầu OWASP API Top 10).
- Khoá ký JWT lấy từ **biến môi trường/secret manager**, đủ dài (≥ 32 byte với HS256), không commit.

## Cơ chế

```text
POST /api/dang-nhap {tenDangNhap, matKhau}
   └─ AuthenticationManager → UserDetailsService + PasswordEncoder (BCrypt)
   └─ JwtEncoder ký claim {sub, vaiTro, khachHangId, iat, exp} bằng HS256 → token

GET /api/don-hang/1   Authorization: Bearer <token>
   └─ BearerTokenAuthenticationFilter → JwtDecoder: kiểm tra chữ ký, exp
   └─ JwtAuthenticationConverter: claim "vaiTro" → ROLE_KHACH
   └─ AuthorizationFilter (quy tắc URL) → @PreAuthorize (quy tắc dữ liệu) → controller
```

HS256 dùng **một khoá bí mật** cho cả ký và kiểm tra — hợp khi một service tự phát và tự kiểm tra token. Khi có nhiều service, hoặc dùng Identity Provider (Keycloak, Microsoft Entra ID…), dùng **RS256**: IdP ký bằng khoá riêng, các service chỉ cần khoá công khai (`spring.security.oauth2.resourceserver.jwt.issuer-uri`).

## Phát token

```java title="DangNhapController.java"
@PostMapping("/api/dang-nhap")
public TokenResponse dangNhap(@Valid @RequestBody DangNhapRequest req) {
    Authentication a = auth.authenticate(
        UsernamePasswordAuthenticationToken.unauthenticated(req.tenDangNhap(), req.matKhau()));
    Instant now = clock.instant();
    var claims = JwtClaimsSet.builder()
        .issuer("don-hang-api").subject(a.getName()).issuedAt(now).expiresAt(now.plus(p.thoiHanToken()))
        .claim("vaiTro", a.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .filter(r -> r.startsWith("ROLE_")).map(r -> r.substring(5)).toList());
    Long kh = KHACH_HANG.get(a.getName());
    if (kh != null) claims.claim("khachHangId", kh);
    var header = JwsHeader.with(MacAlgorithm.HS256).build();
    return new TokenResponse(encoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue(),
                             p.thoiHanToken().toSeconds());
}
```

Phần payload của token (base64 giải mã — **ai cũng đọc được**, đừng đặt dữ liệu nhạy cảm vào):

```json
{"vaiTro":["KHACH"],"iss":"don-hang-api","khachHangId":1,"sub":"an","exp":1794809763,"iat":1794808863}
```

Lỗi gặp khi viết bài: phiên bản đầu đổi **mọi** authority thành vai trò (`r.replace("ROLE_", "")`), và token ra `"vaiTro":["KHACH","FACTOR_PASSWORD"]`. Spring Security 7 thêm authority `FACTOR_PASSWORD` để ghi nhận người dùng đã xác thực bằng mật khẩu; nếu không lọc, nó thành `ROLE_FACTOR_PASSWORD` ở phía resource server. Bài học: chỉ đưa vào token những gì mình chủ động chọn.

```java title="Đọc vai trò từ claim"
var quyen = new JwtGrantedAuthoritiesConverter();
quyen.setAuthoritiesClaimName("vaiTro");
quyen.setAuthorityPrefix("ROLE_");
var c = new JwtAuthenticationConverter();
c.setJwtGrantedAuthoritiesConverter(quyen);
```

## IDOR: bad / good

```java bad
public record TaoDonRequest(Long khachHangId, List<DongRequest> dong) {}   // client tự khai mình là ai

@GetMapping("/{id}")
public DonHangResponse chiTiet(@PathVariable Long id) { return service.sangResponse(id); }
// đăng nhập bằng tài khoản bất kỳ, đổi id từ 1 → 2 → 3… là đọc được đơn của mọi khách
```

```java good
public record TaoDonRequest(List<@Valid DongRequest> dong) {}

@PostMapping
@PreAuthorize("hasRole('KHACH')")
public ResponseEntity<DonHangResponse> tao(@Valid @RequestBody TaoDonRequest req, Authentication auth) {
    Long khachHangId = QuyenTruyCap.khachHangId(auth);           // từ claim của token đã kiểm tra chữ ký
    …
}

@GetMapping("/{id}")
@PreAuthorize("@quyen.coTheXemDon(#id, authentication)")
public DonHangResponse chiTiet(@PathVariable Long id) { … }
```

```java title="QuyenTruyCap.java"
@Component("quyen")
public class QuyenTruyCap {
    @Transactional(readOnly = true)
    public boolean coTheXemDon(Long donHangId, Authentication a) {
        if (a.getAuthorities().stream().anyMatch(g -> g.getAuthority().equals("ROLE_ADMIN"))) return true;
        Long kh = khachHangId(a);
        return kh != null && donHangRepo.findById(donHangId).map(d -> d.getKhachHang().getId().equals(kh)).orElse(false);
    }
}
```

Kết quả (đã chạy):

```text
POST /api/dang-nhap  {an, sai mật khẩu}                 → 401
an   tạo đơn                                             → 201 {"id":1,"khachHang":"Nguyễn An",…}
an   GET /api/don-hang/1                                 → 200
binh GET /api/don-hang/1  (đơn của an)                   → 403
admin GET /api/don-hang/1                                → 200
admin POST /api/don-hang  (không phải KHACH)             → 403
token bị sửa ký tự cuối                                  → 401
   WWW-Authenticate: Bearer error="invalid_token", error_description="… Signed JWT rejected: Invalid signature"
```

Trả **403** cho đơn của người khác vẫn tiết lộ "đơn số 1 tồn tại". Với dữ liệu nhạy cảm (hồ sơ vay, hợp đồng bảo hiểm), trả **404** cho cả "không tồn tại" lẫn "không phải của bạn" — bằng cách lọc theo chủ sở hữu ngay trong query (`findByIdAndKhachHangId`).

## Pitfalls

- Khoá HS256 ngắn hoặc mặc định trong code → ai có mã nguồn là ký được token admin. Dự án mẫu có ràng buộc `@Size(min = 32)` cho khoá và đọc từ `JWT_KHOA`.
- Access token sống lâu (ngày, tuần) và không có cách thu hồi. Token ngắn + refresh token (lưu, thu hồi được) — hoặc dùng IdP.
- Lưu JWT trong `localStorage` của Angular → XSS đọc được. Cân nhắc cookie `HttpOnly` (khi đó **phải** bật lại CSRF) hoặc mô hình BFF.
- Kiểm tra quyền ở frontend (ẩn nút) mà quên ở backend.
- Log nguyên token hoặc header `Authorization`.

:::senior Góc nhìn senior
Trong dự án ngân hàng/bảo hiểm, tự viết đăng nhập và phát token hiếm khi là lựa chọn đúng: dùng Identity Provider của tổ chức (Keycloak, Entra ID, IdP của khách hàng) qua OAuth2/OIDC, service chỉ là **resource server** kiểm tra token. Phần việc thật của team là **phân quyền theo dữ liệu**: viết nó như một lớp riêng (`QuyenTruyCap`), có test cho từng vai trò × từng loại tài nguyên, và rà IDOR trong mọi endpoint nhận id.
:::

:::version Spring Boot 3 và 4
`NimbusJwtEncoder`/`NimbusJwtDecoder` và `oauth2ResourceServer().jwt()` có từ Spring Security 5.x. Spring Security 7 thêm authority yếu tố xác thực (`FACTOR_…`) và header `WWW-Authenticate` có `resource_metadata` (đã thấy khi chạy) theo đặc tả OAuth 2.0 Protected Resource Metadata.
:::

:::interview IDOR là gì và phòng chống thế nào trong Spring Boot?
IDOR (Insecure Direct Object Reference, trong OWASP API Top 10 gọi là Broken Object Level Authorization) là khi API nhận id tài nguyên từ client và trả/sửa tài nguyên đó mà không kiểm tra người gọi có quyền với **chính tài nguyên ấy**. Phòng chống: lấy danh tính từ token đã xác thực, không từ body/URL; với mọi endpoint theo id, kiểm tra quyền sở hữu — bằng `@PreAuthorize` gọi bean kiểm tra, hoặc tốt hơn là đưa điều kiện chủ sở hữu vào query (`where id = ? and khach_hang_id = ?`); viết test cho trường hợp "người dùng A truy cập tài nguyên của B".
:::

:::quiz Vì sao không nên nhận `khachHangId` trong body của request tạo đơn?
- [ ] Vì làm request dài hơn
- [x] Vì client có thể gửi id của người khác; danh tính phải lấy từ token đã kiểm tra chữ ký
- [ ] Vì JSON không hỗ trợ kiểu Long
- [ ] Vì Spring Security cấm

Đây là dạng IDOR phổ biến nhất ở API tạo dữ liệu.
:::

:::quiz Payload của JWT ký bằng HS256 có được mã hoá không?
- [ ] Có, chỉ server đọc được
- [x] Không — chỉ được ký; ai có token đều giải mã base64 và đọc được claim
- [ ] Chỉ phần `sub` được mã hoá
- [ ] Tuỳ thư viện

Chữ ký chống **sửa**, không chống **đọc**. Đã giải mã payload bằng `base64 -d` trong bài.
:::

:::exercise Endpoint "đơn của tôi"
Viết `GET /api/don-hang/cua-toi` trả danh sách tóm tắt (id, ngày, trạng thái, số dòng) các đơn của **người đang đăng nhập**, có phân trang, chỉ cho vai trò `KHACH`, không nhận id khách hàng từ client.
???
```java
@GetMapping("/cua-toi")
@PreAuthorize("hasRole('KHACH')")
public List<DonHangRepository.TomTatDon> cuaToi(Authentication auth, @PageableDefault(size = 20) Pageable pageable) {
    return service.tomTatCuaKhach(QuyenTruyCap.khachHangId(auth), pageable);
}
```

Service gọi projection `tomTatTheoKhach` (bài *N+1*), một câu SQL. Lưu ý đường dẫn `/cua-toi` được khai báo **trước** `/{id}` cho dễ đọc; Spring MVC tự ưu tiên đường dẫn cụ thể hơn, nên `/cua-toi` không bị hiểu là id.

Đã chạy (an tạo 2 đơn, binh 1 đơn):

```text
an:   [{"id":2,…,"trangThai":"CHO_THANH_TOAN","soDong":2},{"id":1,…,"soDong":2}]
binh: [{"id":3,…,"trangThai":"CHO_THANH_TOAN","soDong":1}]
không token → 401
```
:::
