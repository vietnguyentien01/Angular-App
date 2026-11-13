---
title: Xác thực và bảo mật cơ bản — hash mật khẩu, session/JWT, CORS
summary: "Phân biệt xác thực (authentication) và phân quyền (authorization); mật khẩu phải hash bằng bcrypt/argon2; session cookie và JWT khác nhau ở đâu; vì sao token nên nằm trong cookie httpOnly; CORS là gì và không phải là gì."
type: card
level: core
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, auth, jwt, security, cors]
related: [nodejs/consolidate/auth-security/jwt-cookie-va-phan-quyen, nodejs/deep-dive/auth-security/owasp-cho-backend-node]
---

## TL;DR

- **Authentication** = bạn là ai (đăng nhập). **Authorization** = bạn được làm gì (vai trò, quyền).
- Mật khẩu: **không bao giờ** lưu thô hay mã hoá hai chiều; lưu **hash có salt, chậm** (bcrypt, argon2). So sánh bằng hàm `compare` của thư viện.
- **Session**: server lưu phiên, client giữ session id trong cookie. **JWT**: server ký token chứa thông tin, client gửi lại; server chỉ cần kiểm chữ ký.
- Token/session id cho web: để trong **cookie `HttpOnly; Secure; SameSite`** — JavaScript (và mã XSS) không đọc được.
- **CORS** là trình duyệt chặn JavaScript đọc response khác origin; nó **không** bảo vệ API khỏi Postman, curl hay server khác.

## Ví dụ (đã chạy thử với `bcryptjs`, `jsonwebtoken`)

```js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const hash = await bcrypt.hash('matkhau123', 10);        // lưu chuỗi này vào DB
const ok = await bcrypt.compare('matkhau123', hash);     // true

const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
  algorithm: 'HS256',
  expiresIn: '15m',
});
res.cookie('access_token', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 15 * 60 * 1000 });
```

## Bảng chọn nhanh

| | Session cookie | JWT |
|---|---|---|
| Trạng thái lưu ở | Server (Redis/DB) | Trong token (client giữ) |
| Thu hồi ngay (đăng xuất, khoá tài khoản) | Dễ: xoá session | Khó: phải chờ hết hạn hoặc có danh sách chặn |
| Nhiều service cùng kiểm | Cần kho session chung | Mỗi service tự kiểm chữ ký |
| Hợp với | Web app một backend | Nhiều service, mobile, API cho bên thứ ba |

| Lưu token ở trình duyệt | XSS đọc được? | Cần chống CSRF? |
|---|---|---|
| `localStorage` | **Có** | Không (phải tự gắn header) |
| Cookie `HttpOnly` | **Không** | Có — dùng `SameSite=Lax/Strict` và/hoặc CSRF token |

## Lỗi hay gặp: nhét dữ liệu nhạy cảm vào JWT

```js bad
jwt.sign({ sub: 1, email, password: user.password, cccd: user.cccd }, secret);
```

Payload JWT chỉ được **mã hoá base64url, không mã hoá bí mật** — ai có token cũng đọc được (đã thử: `JSON.parse(Buffer.from(token.split('.')[1], 'base64url'))`). Chỉ để id, vai trò, thời hạn.

:::version Thư viện
`bcrypt` (native) nhanh hơn `bcryptjs` (thuần JS, cài dễ hơn); argon2 (`argon2`) là lựa chọn được khuyến nghị cho dự án mới theo OWASP Password Storage Cheat Sheet. Node có sẵn `crypto.scrypt` nếu không muốn thêm thư viện.
:::

:::interview Lưu JWT ở localStorage hay cookie? Vì sao?
Với web app, nên để trong cookie `HttpOnly; Secure; SameSite=Lax` (hoặc `Strict`): JavaScript không đọc được nên mã độc XSS không lấy cắp được token. Đổi lại phải chống CSRF — `SameSite` chặn phần lớn trường hợp, thêm CSRF token cho thao tác nhạy cảm. `localStorage` tiện (tự gắn header `Authorization`) nhưng một lỗ XSS là lộ token. Access token ngắn hạn (5–15 phút) + refresh token trong cookie httpOnly là mô hình phổ biến.
:::

:::quiz Cách lưu mật khẩu đúng là?
- [ ] Mã hoá AES với khoá trong `.env`, giải mã khi đăng nhập
- [ ] SHA-256 một lần
- [x] Hash chậm có salt (bcrypt/argon2), khi đăng nhập dùng `compare`
- [ ] Base64

SHA-256 quá nhanh — kẻ tấn công thử hàng tỷ mật khẩu mỗi giây. Mã hoá hai chiều nghĩa là lộ khoá là lộ toàn bộ mật khẩu.
:::

:::quiz API của bạn bật CORS chỉ cho `https://shop.example.vn`. Điều này có ngăn một script Python gọi thẳng API không?
- [ ] Có, CORS chặn mọi nguồn khác
- [x] Không — CORS chỉ là cơ chế của **trình duyệt**; bảo vệ API phải bằng xác thực, phân quyền, rate limit
- [ ] Có, nếu dùng HTTPS
- [ ] Chỉ chặn được POST

CORS cho phép/không cho phép JavaScript trên trang khác origin **đọc** response.
:::

:::quiz Payload của JWT có bí mật không?
- [ ] Có, chỉ server đọc được
- [x] Không — chỉ base64url; chữ ký chống **sửa**, không chống **đọc**
- [ ] Có nếu dùng HS256
- [ ] Có nếu token còn hạn

Không đặt mật khẩu, số giấy tờ, dữ liệu cá nhân vào payload.
:::
