---
title: Đăng nhập bằng JWT trong cookie httpOnly, phân quyền theo vai trò và theo chủ sở hữu
summary: "Cài đặt luồng login/logout/me với bcrypt và JWT đặt trong cookie httpOnly, middleware requireAuth và requireRole, kiểm quyền theo chủ sở hữu (chống IDOR), chặn token giả và alg none. Toàn bộ đã chạy bằng supertest, kèm bẫy cookie Secure trên HTTP."
level: intermediate
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, auth, jwt, cookie, authorization]
related: [nodejs/review/auth-security/xac-thuc-va-bao-mat-co-ban, nodejs/deep-dive/auth-security/owasp-cho-backend-node]
---

## TL;DR

- Login: tìm user → `bcrypt.compare` → `jwt.sign({ sub, role }, secret, { expiresIn: '15m' })` → đặt cookie `HttpOnly`.
- `requireAuth`: đọc cookie → `jwt.verify` **có chỉ định `algorithms`** → gắn `req.user`. Sai/hết hạn → `401`.
- `requireRole('admin')`: sai vai trò → `403`. Dữ liệu của người khác → kiểm **chủ sở hữu** trong handler (thường trả `404` để không lộ là tài nguyên tồn tại).
- Thông báo lỗi login **giống nhau** cho "sai email" và "sai mật khẩu".

## Cơ chế

```text
POST /login {email, password}
  → bcrypt.compare ✓ → Set-Cookie: access_token=<JWT>; HttpOnly; SameSite=Lax; (Secure ở production)
GET /api/me  (trình duyệt tự gửi cookie)
  → requireAuth: jwt.verify(chữ ký, hạn, thuật toán) → req.user = { id, role } → handler
```

## Code (đã chạy thử)

```bash
npm install cookie-parser jsonwebtoken bcryptjs
```

```js title="auth.js"
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET;   // ≥ 32 ký tự ngẫu nhiên, không commit
const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000,
};

export function authRoutes(router, { userRepo }) {
  router.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    const user = await userRepo.findByEmail(String(email ?? ''));
    const ok = user && (await bcrypt.compare(String(password), user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });   // không nói sai email hay sai mật khẩu

    const token = jwt.sign({ sub: String(user.id), role: user.role }, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '15m',
    });
    res.cookie('access_token', token, COOKIE).status(204).end();
  });

  router.post('/api/auth/logout', (req, res) => {
    res.clearCookie('access_token', { ...COOKIE, maxAge: undefined }).status(204).end();
  });
}

export function requireAuth(req, res, next) {
  const token = req.cookies.access_token;            // cần app.use(cookieParser())
  if (!token) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  try {
    const p = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: Number(p.sub), role: p.role };
    next();
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN' });   // hết hạn, sai chữ ký, alg lạ
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'FORBIDDEN' });
```

```js title="routes.js"
app.get('/api/me', requireAuth, (req, res) => res.json(req.user));
app.delete('/api/products/:id', requireAuth, requireRole('admin'), deleteProduct);

app.get('/api/orders/:id', requireAuth, async (req, res) => {
  const order = await orderRepo.findById(Number(req.params.id));
  if (!order || (req.user.role !== 'admin' && order.userId !== req.user.id)) {
    return res.status(404).json({ error: 'NOT_FOUND' });   // chống IDOR
  }
  res.json(order);
});
```

Test bằng `request.agent(app)` (giữ cookie giữa các request) đã kiểm: chưa login → `/api/me` `401`; staff xoá sản phẩm → `403`; admin → `204`; token ký bằng secret khác → `401`; token `alg: none` → `401`; sau logout, cookie bị xoá và `/api/me` lại `401`.

## Pitfalls

:::warning Cookie Secure trên HTTP
Ban đầu bài thử đặt `secure: true` cố định — test qua HTTP **thất bại**: cookie jar không gửi lại cookie `Secure` trên kết nối không mã hoá, nên `/api/me` luôn `401`. Ở production luôn bật `Secure` (HTTPS); ở môi trường dev/test HTTP thì tắt theo biến môi trường như code trên. (Trình duyệt hiện đại coi `http://localhost` là ngữ cảnh an toàn nên thường vẫn nhận cookie Secure ở localhost — đừng dựa vào điều đó cho domain khác.)
:::

```js bad
jwt.verify(token, secret);   // không giới hạn thuật toán → mở cửa cho lỗi nhầm thuật toán ở thư viện/cấu hình khác
```

```js bad
if (!user) return res.status(404).json({ error: 'Email không tồn tại' });   // lộ email nào đã đăng ký
```

```js bad
app.get('/api/orders/:id', requireAuth, async (req, res) => res.json(await orderRepo.findById(req.params.id)));
// đổi id trên URL là xem được đơn của người khác (IDOR)
```

:::senior Góc nhìn senior
Phân quyền có hai lớp: **vai trò** (staff/admin — middleware) và **quyền trên từng bản ghi** (đơn này của ai — trong service hoặc ngay trong câu SQL: `WHERE id = $1 AND user_id = $2`). Lỗi IDOR (Broken Object Level Authorization) đứng đầu OWASP API Security Top 10 chính vì lớp thứ hai hay bị quên. Viết test riêng: "user A không đọc được đơn của user B".
:::

:::version Refresh token
Access token 15 phút buộc đăng nhập lại thường xuyên. Mô hình phổ biến: thêm **refresh token** dài hạn (vd 7–30 ngày) trong cookie httpOnly riêng có `path=/api/auth/refresh`, lưu hash của nó trong DB để thu hồi được, và **xoay vòng** (cấp mới, huỷ cũ) mỗi lần dùng. Với một web app một backend, session cookie + Redis thường đơn giản hơn JWT.
:::

:::interview Làm sao thu hồi (revoke) một JWT trước khi nó hết hạn?
JWT tự chứa thông tin nên server không "xoá" được nó. Các cách: (1) access token **ngắn hạn** (5–15 phút) và chỉ thu hồi refresh token (lưu trong DB); (2) lưu `tokenVersion` trong bảng user, nhúng vào token, tăng version khi đổi mật khẩu/khoá tài khoản — verify thì so version (mất một lần đọc DB); (3) danh sách chặn `jti` trong Redis tới khi token hết hạn. Nếu cần thu hồi tức thì thường xuyên, session phía server phù hợp hơn JWT.
:::

:::quiz Staff đã đăng nhập gọi `GET /api/orders/99` — đơn của user khác. Code an toàn trả gì?
- [ ] 200 kèm đơn hàng
- [ ] 401
- [x] 404 (hoặc 403) — không trả dữ liệu; nhiều hệ thống chọn 404 để không lộ đơn có tồn tại
- [ ] 500

Đây là kiểm quyền theo chủ sở hữu; thiếu nó là lỗi IDOR.
:::

:::quiz Kẻ tấn công tự ký token `{ role: 'admin' }` bằng secret đoán mò rồi gắn vào cookie. `requireAuth` ở trên trả gì?
- [ ] Cho qua vì payload hợp lệ
- [x] 401 — `jwt.verify` kiểm chữ ký bằng secret của server và thất bại
- [ ] 403
- [ ] 200 nếu token chưa hết hạn

Đã chạy thử, cả token `alg: none` cũng bị từ chối nhờ `algorithms: ['HS256']`.
:::

:::quiz Vì sao login trả cùng một lỗi `INVALID_CREDENTIALS` cho sai email và sai mật khẩu?
- [ ] Cho code ngắn hơn
- [x] Để không cho kẻ tấn công dò email nào đã đăng ký (user enumeration)
- [ ] Vì bcrypt không phân biệt được
- [ ] Chuẩn REST yêu cầu

Cùng lý do, form "quên mật khẩu" nên luôn trả "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn".
:::

:::exercise Thêm đổi mật khẩu và vô hiệu hoá token cũ
Thêm `POST /api/auth/change-password` (cần đăng nhập) nhận `{ currentPassword, newPassword }`: mật khẩu mới ≥ 10 ký tự và khác mật khẩu cũ; sai mật khẩu hiện tại → `400 WRONG_PASSWORD`. Sau khi đổi, **mọi token cũ** (kể cả trên thiết bị khác) phải bị từ chối. Viết test: token cũ → `401` sau khi đổi.
???
Dùng `tokenVersion`:

```js
// login: nhúng version
jwt.sign({ sub: String(user.id), role: user.role, ver: user.tokenVersion }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });

// requireAuth: thêm bước so version (đọc DB hoặc cache ngắn hạn)
const user = await userRepo.findById(Number(p.sub));
if (!user || user.tokenVersion !== p.ver) return res.status(401).json({ error: 'TOKEN_REVOKED' });

// change-password
router.post('/api/auth/change-password', requireAuth, validate(ChangePassword), async (req, res) => {
  const user = await userRepo.findById(req.user.id);
  if (!(await bcrypt.compare(req.valid.body.currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: 'WRONG_PASSWORD' });
  }
  await userRepo.update(user.id, {
    passwordHash: await bcrypt.hash(req.valid.body.newPassword, 12),
    tokenVersion: user.tokenVersion + 1,
  });
  res.clearCookie('access_token').status(204).end();
});
```

Schema: `z.object({ currentPassword: z.string(), newPassword: z.string().min(10) }).refine(v => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Phải khác mật khẩu cũ' })`. Test: agent A login, agent B login cùng user; A đổi mật khẩu; B gọi `/api/me` → `401 TOKEN_REVOKED`.
:::
