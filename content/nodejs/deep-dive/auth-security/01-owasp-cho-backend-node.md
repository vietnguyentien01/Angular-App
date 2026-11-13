---
title: OWASP cho backend Node.js — injection, phân quyền đối tượng, mass assignment, rate limit, header bảo mật, bí mật và dependency
summary: "Đi qua các lỗ hổng hay gặp nhất của một REST API Node theo OWASP API Security Top 10, mỗi lỗ hổng có ví dụ đã chạy thử (SQL injection lấy cả bảng bằng chuỗi x' OR '1'='1, body quá lớn bị 413, rate limit 429, CORS chặn origin lạ) và cách phòng thủ."
level: advanced
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, security, owasp, sql-injection, rate-limit]
related: [nodejs/consolidate/auth-security/jwt-cookie-va-phan-quyen, sql/review/queries/select-where-join]
---

## TL;DR

| Lỗ hổng | Phòng thủ chính |
|---|---|
| Phân quyền theo đối tượng bị hỏng (IDOR/BOLA) | Kiểm chủ sở hữu trong mọi truy vấn: `WHERE id = $1 AND user_id = $2` |
| Injection (SQL, NoSQL, lệnh shell) | **Truy vấn tham số hoá**, không nối chuỗi; không `exec` với input |
| Xác thực yếu | bcrypt/argon2, rate limit đăng nhập, token ngắn hạn, thông báo lỗi chung |
| Mass assignment | Chỉ nhận trường cho phép (schema Zod `strict`/chọn trường), không `update(req.body)` |
| Tiêu thụ tài nguyên không giới hạn | Giới hạn kích thước body, `limit` tối đa, timeout, rate limit |
| Cấu hình sai | `helmet`, CORS danh sách cụ thể, tắt stack trace ra client, HTTPS |
| SSRF | Không fetch URL do người dùng gửi tới mạng nội bộ; danh sách host cho phép |
| Lộ bí mật, dependency có lỗ hổng | Secret ngoài code, `npm audit`, Dependabot/Renovate, lockfile |

## 1. SQL injection (đã chạy thử với `pg`)

```js bad
const email = "x' OR '1'='1";
await pool.query(`SELECT id, email FROM users WHERE email = '${email}'`);   // trả về TẤT CẢ user (2/2 dòng)
```

```js good
await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);   // 0 dòng — input chỉ là dữ liệu
```

Tên cột/hướng sắp xếp không tham số hoá được → dùng **danh sách cho phép**: `const col = { price: 'price', name: 'name' }[req.query.sort] ?? 'id'`.

## 2. Mass assignment

```js bad
await userRepo.update(req.user.id, req.body);   // gửi { "role": "admin" } là thành admin
```

```js good
const { name, phone } = MeUpdate.parse(req.body);   // chỉ nhận trường cho phép
await userRepo.update(req.user.id, { name, phone });
```

Đã thử: gửi `{ name: 'An', role: 'admin' }` → chỉ `name` được dùng.

## 3. Giới hạn tài nguyên và rate limit (đã chạy thử)

```js
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

app.disable('x-powered-by');                                    // helmet cũng làm việc này
app.use(helmet());                                              // CSP, HSTS, nosniff, …
app.use(cors({ origin: ['https://shop.example.vn'], credentials: true }));
app.use(express.json({ limit: '100kb' }));                      // body 200KB → 413

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
app.post('/api/auth/login', loginLimiter, login);               // lần thứ 6 trong 15 phút → 429
```

Kết quả đo: `helmet` thêm `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options` và bỏ `X-Powered-By`; request từ `https://evil.example` **không** nhận header `Access-Control-Allow-Origin`; body 200 KB bị `413`; lần login thứ 6 bị `429`.

Rate limit lưu trong bộ nhớ chỉ đúng với **một** instance; chạy nhiều container thì dùng store Redis. Sau reverse proxy, cấu hình `app.set('trust proxy', 1)` để lấy đúng IP client.

## 4. SSRF và lệnh shell

```js bad
app.post('/api/preview', async (req, res) => res.send(await (await fetch(req.body.url)).text()));
// url = http://169.254.169.254/latest/meta-data/  → đọc metadata/credential của máy chủ cloud
```

Chỉ cho phép host trong danh sách, chặn IP nội bộ sau khi phân giải DNS, đặt timeout. Với lệnh hệ thống, dùng `execFile('convert', [input, output])` thay vì ghép chuỗi lệnh rồi gọi `exec` (shell sẽ diễn giải `;`, `&&`, `$(...)` trong input).

## 5. Bí mật và chuỗi cung ứng

- Secret (DB, JWT, API key) nằm trong biến môi trường/secret manager; `.env` trong `.gitignore`; kiểm config khi khởi động (bài *Cấu trúc dự án*).
- `npm ci` với lockfile trong CI; `npm audit --audit-level=high` làm một bước CI; bật Dependabot/Renovate.
- Log không ghi mật khẩu, token, số thẻ: lọc trường nhạy cảm trước khi log body.

:::senior Góc nhìn senior
Bảo mật API chủ yếu là **phân quyền đúng** và **không tin input** — hai lớp mà framework không tự làm cho bạn. Đưa vào quy trình: checklist khi review PR (route mới có `requireAuth`? truy vấn có lọc theo chủ sở hữu? schema có chặn trường lạ?), test phân quyền tự động cho mỗi route, và `npm audit` trong CI. Với dự án y tế/tài chính, dữ liệu cá nhân còn chịu quy định pháp lý (ở Việt Nam: Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân) — log và môi trường test không được chứa dữ liệu thật.
:::

:::quiz Câu truy vấn được ghép bằng template string `SELECT * FROM users WHERE email = '${email}'` với `email = "x' OR '1'='1"`. Kết quả là gì?
- [ ] 0 dòng
- [x] Mọi dòng của bảng — điều kiện thành `email = 'x' OR '1'='1'` luôn đúng
- [ ] Lỗi cú pháp, không trả gì
- [ ] Chỉ dòng có email `x`

Đã chạy thử trên PostgreSQL: 2/2 dòng. Bản tham số hoá `$1` trả 0 dòng.
:::

:::quiz Route `PATCH /api/me` gọi `userRepo.update(req.user.id, req.body)`. Lỗ hổng gì?
- [ ] SQL injection
- [x] Mass assignment — client tự gửi `role`, `isVerified`, `balance`… và được ghi vào DB
- [ ] CSRF
- [ ] Không có lỗ hổng vì đã `requireAuth`

Đã xác thực không có nghĩa là được sửa mọi trường.
:::

:::exercise Rà soát bảo mật một route
Tìm ít nhất 5 vấn đề và viết lại route:

```js
app.get('/api/orders', async (req, res) => {
  const sort = req.query.sort || 'created_at';
  const rows = await pool.query(
    `SELECT * FROM orders WHERE customer_email = '${req.query.email}' ORDER BY ${sort} LIMIT ${req.query.limit}`);
  res.json(rows.rows);
});
```
???
Vấn đề: (1) không xác thực — ai cũng gọi được; (2) lọc theo `email` do client gửi → xem đơn của bất kỳ ai (IDOR) — phải lọc theo `req.user.id`; (3) SQL injection qua `email`; (4) injection qua `sort` (`ORDER BY` không tham số hoá được); (5) `limit` không giới hạn → `limit=10000000` tốn tài nguyên, và cũng injection; (6) `SELECT *` có thể trả cột nội bộ (ghi chú nội bộ, mã giảm giá…).

```js
const SORT = { created_at: 'created_at', total: 'total' };
const Q = z.object({
  sort: z.enum(['created_at', 'total']).default('created_at'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
app.get('/api/orders', requireAuth, validate(Q, 'query'), async (req, res) => {
  const { sort, limit } = req.valid.query;
  const { rows } = await pool.query(
    `SELECT id, status, total, created_at FROM orders WHERE user_id = $1 ORDER BY ${SORT[sort]} DESC, id DESC LIMIT $2`,
    [req.user.id, limit]);
  res.json({ data: rows });
});
```

`SORT[sort]` an toàn vì giá trị đến từ danh sách cố định trong code, không phải từ client.
:::
