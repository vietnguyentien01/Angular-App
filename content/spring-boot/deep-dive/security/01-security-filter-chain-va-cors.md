---
title: "Bên trong Spring Security — chuỗi filter, SecurityContext, CORS cho Angular và header bảo mật"
summary: "Liệt kê 14 filter thật mà Spring Security 7 dựng cho API JWT, theo dấu một request qua chúng, SecurityContext gắn với thread, vì sao CORS phải nằm trong filter chain, preflight từ localhost:4200 được chấp nhận còn origin lạ bị 403, và các header bảo mật mặc định."
level: advanced
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, spring-security, cors, internals, filters]
related: [spring-boot/consolidate/security/jwt-va-phan-quyen-theo-chu-so-huu, spring-boot/deep-dive/web/ben-trong-mot-request-spring-mvc]
---

## TL;DR

- Spring Security là **một Servlet filter** (`FilterChainProxy`) chứa nhiều `SecurityFilterChain`; mỗi chain là một danh sách filter có thứ tự.
- Kết quả xác thực nằm trong **`SecurityContextHolder`** (mặc định ThreadLocal) — chỉ có trên thread xử lý request.
- Lỗi trong chain được `ExceptionTranslationFilter` chuyển thành **401** (qua `AuthenticationEntryPoint`) hoặc **403** (qua `AccessDeniedHandler`). Vì xảy ra **trước** DispatcherServlet, `@RestControllerAdvice` **không** bắt được.
- **CORS phải xử lý trong security chain** (`http.cors()`): preflight `OPTIONS` không có token, nếu đi qua phần xác thực trước sẽ bị 401.
- Header bảo mật (`X-Content-Type-Options`, `X-Frame-Options`, `Cache-Control`) được thêm mặc định.

## Cơ chế: các filter thật

Với cấu hình trong bài *Spring Security cơ bản*, log DEBUG của `DefaultSecurityFilterChain` liệt kê (Spring Security 7):

```text
DisableEncodeUrlFilter
WebAsyncManagerIntegrationFilter
SecurityContextHolderFilter            ← chuẩn bị SecurityContext cho request
HeaderWriterFilter                     ← header bảo mật
CorsFilter                             ← trả lời preflight, thêm Access-Control-*
LogoutFilter
OAuth2ProtectedResourceMetadataFilter  ← /.well-known/oauth-protected-resource
BearerTokenAuthenticationFilter        ← đọc "Authorization: Bearer", gọi JwtDecoder
RequestCacheAwareFilter
SecurityContextHolderAwareRequestFilter
AnonymousAuthenticationFilter          ← chưa xác thực → AnonymousAuthenticationToken
SessionManagementFilter
ExceptionTranslationFilter             ← AuthenticationException → 401, AccessDeniedException → 403
AuthorizationFilter                    ← quy tắc authorizeHttpRequests
```

Không có `CsrfFilter` (đã tắt), không có `UsernamePasswordAuthenticationFilter` (không dùng form login). Đọc danh sách này là cách nhanh nhất để biết cấu hình thật sự đang làm gì: bật bằng `logging.level.org.springframework.security.web.DefaultSecurityFilterChain=debug`.

```text
request ─► … ─► CorsFilter ─► BearerTokenAuthenticationFilter ─► … ─► ExceptionTranslationFilter ─► AuthorizationFilter
                                     │ sai chữ ký                         ▲ bắt exception từ phía sau
                                     └──────────► 401 (entry point) ──────┘
                                                                           AuthorizationFilter thiếu quyền → 403
                                                         qua hết → DispatcherServlet → @PreAuthorize → controller
```

Token bị sửa một ký tự:

```text
401
WWW-Authenticate: Bearer error="invalid_token", error_description="An error occurred while attempting to decode the Jwt: Signed JWT rejected: Invalid signature", error_uri="https://tools.ietf.org/html/rfc6750#section-3.1", resource_metadata="http://localhost:8080/.well-known/oauth-protected-resource"
```

```text
GET /.well-known/oauth-protected-resource
{"resource":"http://localhost:8080","bearer_methods_supported":["header"],"tls_client_certificate_bound_access_tokens":true}
```

Body của 401/403 từ filter chain **rỗng** — không phải ProblemDetail như các lỗi khác (đã thấy khi chạy). Muốn cùng định dạng, cấu hình `authenticationEntryPoint` và `accessDeniedHandler` ghi ProblemDetail, vì `@RestControllerAdvice` không chạm tới tầng này. Riêng `AccessDeniedException` ném từ `@PreAuthorize` thì xảy ra **trong** DispatcherServlet — advice có thể bắt nó nếu bạn khai báo handler, khi đó nó không còn tới `ExceptionTranslationFilter`.

## SecurityContext

```java
Authentication a = SecurityContextHolder.getContext().getAuthentication();   // trên thread của request
```

Code chạy trên thread khác (`@Async`, `CompletableFuture`, virtual thread tự tạo) **không thấy** context, trừ khi bọc executor bằng `DelegatingSecurityContextExecutor` hoặc truyền `Authentication` như tham số. Đây là cùng một loại vấn đề với transaction gắn thread (bài *Proxy, isolation và khoá*).

## CORS cho frontend Angular

Angular dev server chạy ở `http://localhost:4200`, API ở `:8080` → khác origin → trình duyệt gửi **preflight** `OPTIONS` trước request có header `Authorization`.

```java
@Bean
CorsConfigurationSource corsConfigurationSource(BaoMatProperties p) {
    var c = new CorsConfiguration();
    c.setAllowedOrigins(p.corsNguonChoPhep());                 // [http://localhost:4200] từ cấu hình
    c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
    c.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    c.setMaxAge(3600L);
    var s = new UrlBasedCorsConfigurationSource();
    s.registerCorsConfiguration("/api/**", c);
    return s;
}
// trong SecurityFilterChain: .cors(cors -> {})  → dùng bean trên
```

```text
OPTIONS /api/don-hang  Origin: http://localhost:4200  Access-Control-Request-Method: POST
→ 200
Access-Control-Allow-Origin: http://localhost:4200
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Max-Age: 3600

OPTIONS /api/don-hang  Origin: http://evil.example
→ 403   (không có header Access-Control-*)
```

- CORS là cơ chế của **trình duyệt** để nới lỏng same-origin policy, **không** phải cơ chế bảo vệ API: `curl` hay server khác gọi thẳng vẫn được. Bảo vệ thật là xác thực + phân quyền.
- Không dùng `allowedOrigins("*")` cùng với `allowCredentials(true)` — Spring từ chối tổ hợp này.
- Ở production, nếu Angular được phục vụ **cùng domain** với API (qua reverse proxy, `/api` → backend), không cần CORS.

## Header bảo mật mặc định

```text
X-Content-Type-Options: nosniff
X-XSS-Protection: 0
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
X-Frame-Options: DENY
```

`Strict-Transport-Security` chỉ được thêm cho request HTTPS. Với API trả JSON nhạy cảm, `Cache-Control: no-store` ngăn proxy/trình duyệt lưu lại dữ liệu. Content-Security-Policy thuộc về nơi phục vụ HTML (frontend), cấu hình qua `headers(h -> h.contentSecurityPolicy(...))` nếu Spring phục vụ trang.

## So sánh phương án

| Nhu cầu | Cách |
|---|---|
| Actuator dùng Basic, API dùng JWT | Hai `SecurityFilterChain` với `securityMatcher("/actuator/**")` và `@Order` |
| Lỗi 401/403 dạng ProblemDetail | `exceptionHandling(e -> e.authenticationEntryPoint(…).accessDeniedHandler(…))` |
| Token từ IdP (Keycloak, Entra ID) | `spring.security.oauth2.resourceserver.jwt.issuer-uri`, bỏ `JwtDecoder` tự tạo |
| SPA không lưu token trong JS | Mô hình BFF: backend giữ token, trình duyệt dùng cookie `HttpOnly` + CSRF |
| Truyền người dùng sang thread khác | `DelegatingSecurityContextExecutor` hoặc truyền tham số |

## Tính năng mới theo phiên bản

- **Spring Security 6** (Boot 3): `authorizeHttpRequests` + `AuthorizationFilter` thay `authorizeRequests`; `SecurityContextHolderFilter` thay `SecurityContextPersistenceFilter`.
- **Spring Security 7** (Boot 4): authority yếu tố xác thực (`FACTOR_PASSWORD`…) phục vụ MFA; metadata OAuth 2.0 Protected Resource (`/.well-known/oauth-protected-resource`, `resource_metadata` trong `WWW-Authenticate`).

:::senior Góc nhìn senior
Khi debug bảo mật, đừng đoán — bật log `org.springframework.security=debug` ở môi trường dev: nó in chain được chọn, từng filter đã chạy, và lý do từ chối. Với hệ thống nhiều service, chuẩn hoá phần security thành một auto-configuration nội bộ (bài *Auto-configuration*): định dạng lỗi 401/403, cách đọc vai trò từ token của IdP công ty, header bảo mật — để mỗi team không tự cấu hình theo một kiểu.
:::

:::quiz `@RestControllerAdvice` có `@ExceptionHandler(AuthenticationException.class)`. Request gửi token sai chữ ký. Handler này có chạy không?
- [ ] Có
- [x] Không — lỗi xảy ra trong `BearerTokenAuthenticationFilter`, trước khi tới DispatcherServlet
- [ ] Chỉ khi bật `@EnableMethodSecurity`
- [ ] Tuỳ thứ tự bean

Cấu hình `authenticationEntryPoint` trong `SecurityFilterChain` để đổi response của trường hợp này.
:::

:::quiz Preflight `OPTIONS` từ `http://localhost:4200` bị trả 401 dù đã có `@CrossOrigin` trên controller. Nguyên nhân hay gặp?
- [x] CORS không được bật trong `SecurityFilterChain`, nên preflight (không có token) bị chặn ở tầng security trước khi tới controller
- [ ] Angular gửi sai header
- [ ] Phải dùng HTTPS
- [ ] `@CrossOrigin` chỉ dùng cho GET

`http.cors(...)` đặt `CorsFilter` trước các filter xác thực, nên preflight được trả lời ngay.
:::
