---
title: OIDC + PKCE cho SPA và mô hình BFF
summary: Luồng đăng nhập chuẩn cho ứng dụng Angular dùng SSO (Keycloak, Azure AD…), vì sao không còn dùng implicit flow, và khi nào nên chọn Backend-for-Frontend.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [security, oidc, pkce, bff, sso]
related: [angular/consolidate/security/token-va-xsrf]
---

## Authorization Code + PKCE

```text
1. SPA tạo code_verifier (ngẫu nhiên), code_challenge = SHA256(code_verifier)
2. Chuyển hướng tới IdP /authorize?response_type=code&code_challenge=...&state=...
3. Người dùng đăng nhập ở IdP → IdP redirect về SPA với ?code=...&state=...
4. SPA kiểm tra state, gửi code + code_verifier tới /token
5. IdP kiểm tra SHA256(code_verifier) == code_challenge → trả access_token (+ id_token, refresh_token)
```

- **PKCE** chống việc kẻ tấn công chặn được `code` rồi đổi lấy token (họ không có `code_verifier`).
- **state** chống CSRF trong luồng đăng nhập.
- **Implicit flow** (token trả thẳng trên URL) **không còn được khuyến nghị** cho SPA.

## Mô hình BFF (Backend-for-Frontend)

```text
Trình duyệt ──cookie HttpOnly──► BFF (server của bạn) ──access token──► API
```

- Token **không bao giờ** tới trình duyệt → XSS không lấy được token.
- BFF lo refresh token, gắn token khi gọi API.
- Đổi lại: thêm một thành phần server phải vận hành; cần chống CSRF cho cookie.

| | SPA giữ token (PKCE) | BFF |
|---|---|---|
| Độ phức tạp | Thấp hơn | Cao hơn |
| Token lộ khi XSS | Có thể | Không |
| Hợp với | App nội bộ, rủi ro vừa | Ngân hàng, bảo hiểm, dữ liệu nhạy cảm |

:::senior Góc nhìn Senior
Ở dự án ngân hàng / chính phủ, quyết định "SPA giữ token hay BFF" nên được thảo luận với security team và ghi thành ADR. Frontend Senior cần giải thích được trade-off, không chỉ cài thư viện `angular-oauth2-oidc` theo hướng dẫn.
:::

:::quiz PKCE bảo vệ điều gì?
- [ ] Mã hoá access token
- [x] Ngăn kẻ chặn được authorization code đổi nó lấy token, vì họ không có code_verifier
- [ ] Thay thế HTTPS
- [ ] Chống XSS

PKCE ràng buộc code với client đã khởi tạo luồng.
:::

:::quiz Lợi ích bảo mật chính của BFF so với SPA tự giữ token?
- [ ] Đăng nhập nhanh hơn
- [x] Access/refresh token không bao giờ có mặt trong JavaScript của trình duyệt
- [ ] Không cần HTTPS
- [ ] Không cần IdP

Trình duyệt chỉ giữ cookie phiên HttpOnly; token nằm ở server.
:::
