---
title: "Spring Security cơ bản — mặc định khi thêm starter, SecurityFilterChain, 401 và 403, mã hoá mật khẩu"
summary: "Thêm spring-boot-starter-security thì điều gì xảy ra, viết SecurityFilterChain cho REST API stateless, phân biệt 401 và 403, phân quyền theo URL và theo method, và lưu mật khẩu bằng BCrypt. Mọi request chạy thật trên Spring Boot 4.1.2 (Spring Security 7)."
type: card
level: core
version: 4
lastReviewed: 2026-11-19
tags: [spring-boot, spring-security, authentication, authorization]
related: [spring-boot/consolidate/security/jwt-va-phan-quyen-theo-chu-so-huu, spring-boot/deep-dive/security/security-filter-chain-va-cors]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

- Chỉ thêm starter: **mọi endpoint** đòi đăng nhập (HTTP Basic, user `user`, mật khẩu sinh ngẫu nhiên in trong log). Chỉ dùng để thử.
- Cấu hình thật bằng một bean **`SecurityFilterChain`**: endpoint nào công khai, endpoint nào cần vai trò gì.
- **401** = chưa xác thực (không có/sai token). **403** = đã biết là ai nhưng **không có quyền**.
- Quy tắc theo URL trong filter chain; quy tắc phụ thuộc dữ liệu (đơn hàng của ai) bằng **`@PreAuthorize`** trên method.
- Mật khẩu lưu bằng **BCrypt** qua `DelegatingPasswordEncoder` — không bao giờ lưu dạng rõ hay MD5/SHA.

## Mặc định khi thêm starter (đã chạy)

```text
Using generated security password: ec8e4db4-d01c-47ed-9c97-ec3e4d49530d
This generated password is for development use only. Your security configuration must be updated before running your application in production.

GET  /api/san-pham/1               → 401   WWW-Authenticate: Basic realm="Realm"
GET  /api/san-pham/1  -u user:…    → 200
POST /api/san-pham    -u user:…    → 401   ← đúng mật khẩu vẫn bị chặn
```

POST bị chặn vì **CSRF** bật mặc định và filter CSRF chạy **trước** filter xác thực Basic — request thiếu CSRF token bị từ chối khi còn là "khách vô danh", nên ra 401. Với API stateless dùng token trong header, CSRF được tắt có chủ đích (xem dưới).

## Cấu hình cho REST API (dự án `don-hang-api`)

```java title="CauHinhBaoMat.java"
@Configuration
@EnableMethodSecurity
public class CauHinhBaoMat {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())                        // token trong header Authorization, không dùng cookie
            .cors(cors -> {})
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/dang-nhap").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/san-pham/**").permitAll()
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers("/api/san-pham/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(chuyenVaiTro())));
        return http.build();
    }

    @Bean PasswordEncoder passwordEncoder() { return PasswordEncoderFactories.createDelegatingPasswordEncoder(); }
    // … JwtEncoder/JwtDecoder, UserDetailsService: xem bài Củng cố
}
```

Quy tắc được xét **từ trên xuống**, gặp quy tắc khớp đầu tiên thì dừng — đặt quy tắc cụ thể trước, `anyRequest()` cuối cùng.

```text
GET  /api/san-pham/1   (không token)        → 200
POST /api/san-pham     (không token)        → 401
POST /api/san-pham     (token vai trò KHACH) → 403
POST /api/san-pham     (token vai trò ADMIN) → 201
```

Phân quyền theo method, kể cả dựa trên dữ liệu:

```java
@PostMapping
@PreAuthorize("hasRole('KHACH')")
public ResponseEntity<DonHangResponse> tao(@Valid @RequestBody TaoDonRequest req, Authentication auth) { … }

@GetMapping("/{id}")
@PreAuthorize("@quyen.coTheXemDon(#id, authentication)")       // gọi bean "quyen"
public DonHangResponse chiTiet(@PathVariable Long id) { … }
```

## Mật khẩu (đã chạy)

```text
băm 1: {bcrypt}$2a$10$kx.HNpHwyYFa7MdhDODHQuPnVF10XwiYz5HJwxVyM0af6P1Owx2oa
băm 2: {bcrypt}$2a$10$Xjf/epUyGroJStGzvKPGzeoKheR5cjLacEk8nADH.QvV2Bjm4G39K   ← cùng mật khẩu, khác kết quả (salt ngẫu nhiên)
matches đúng: true, sai: false
thời gian kiểm tra: 74 ms
```

- `{bcrypt}` cho biết thuật toán, nên sau này đổi sang thuật toán mạnh hơn mà vẫn kiểm tra được mật khẩu cũ.
- `$10$` là cost (2^10 vòng). ~74 ms mỗi lần kiểm tra là **cố ý** chậm: kẻ đánh cắp DB cũng phải tốn chừng ấy cho mỗi lần đoán.

## Bảng chọn nhanh

| Cần | Cách |
|---|---|
| Endpoint công khai | `.requestMatchers(...).permitAll()` |
| Cần đăng nhập | `.authenticated()` |
| Cần vai trò | `.hasRole("ADMIN")` (so với authority `ROLE_ADMIN`) |
| Quy tắc theo dữ liệu (chủ sở hữu) | `@PreAuthorize("@bean.method(#id, authentication)")` |
| Lấy người dùng hiện tại trong controller | tham số `Authentication` hoặc `@AuthenticationPrincipal Jwt jwt` |
| API cho SPA/mobile | stateless + JWT (resource server) |
| Web server render HTML, dùng session cookie | giữ CSRF bật |

## Lỗi hay gặp: thứ tự quy tắc

```java bad
.authorizeHttpRequests(auth -> auth
    .anyRequest().authenticated()
    .requestMatchers("/api/dang-nhap").permitAll())
// đã thử: ứng dụng không khởi động — IllegalStateException: Can't configure requestMatchers after anyRequest
```

```java good
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/dang-nhap").permitAll()
    .anyRequest().authenticated())
```

:::version Spring Boot 3 và 4
- Boot 3 → Spring Security 6; Boot 4 → **Spring Security 7**. Cấu hình kiểu lambda DSL như trên dùng được cả hai; `WebSecurityConfigurerAdapter` (Boot 2) đã bị gỡ từ Security 6.
- Spring Security 7 thêm authority ghi nhận **yếu tố xác thực** đã dùng (đã thấy `FACTOR_PASSWORD` trong danh sách authority sau khi đăng nhập bằng mật khẩu) — phục vụ xác thực nhiều yếu tố. Khi chuyển authority vào token, lọc chỉ lấy vai trò (bài *Củng cố*).
:::

:::interview 401 và 403 khác nhau thế nào?
401 Unauthorized thực chất nghĩa là *chưa xác thực*: request không có thông tin đăng nhập, hoặc thông tin sai/hết hạn — client nên đăng nhập (lại). Response kèm header `WWW-Authenticate`. 403 Forbidden nghĩa là server đã biết người gọi là ai nhưng người đó không có quyền với tài nguyên này — đăng nhập lại cũng không giúp gì. Trong Spring Security: lỗi xác thực đi qua `AuthenticationEntryPoint` (401), lỗi phân quyền qua `AccessDeniedHandler` (403).
:::

:::quiz Người dùng có token hợp lệ với vai trò `KHACH` gọi `POST /api/san-pham` (chỉ `ADMIN` được). Mã trả về?
- [ ] 401
- [x] 403
- [ ] 404
- [ ] 405

Đã chạy. 401 dành cho không có hoặc sai token.
:::

:::quiz Gọi `passwordEncoder.encode("matkhau-an")` hai lần (encoder mặc định là BCrypt) cho ra hai chuỗi hash khác nhau. Vì sao?
- [ ] Do lỗi của BCrypt
- [x] Mỗi lần dùng một salt ngẫu nhiên, salt được lưu ngay trong chuỗi kết quả
- [ ] Do thời gian hệ thống khác nhau
- [ ] Do `DelegatingPasswordEncoder` chọn ngẫu nhiên thuật toán

`matches` đọc salt từ chuỗi đã lưu để kiểm tra. Salt khiến hai người dùng cùng mật khẩu có hash khác nhau, vô hiệu hoá bảng tra sẵn (rainbow table).
:::
