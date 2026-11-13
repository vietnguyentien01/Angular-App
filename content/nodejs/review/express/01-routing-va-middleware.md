---
title: Express 5 — routing, middleware và error handler
summary: "Một app Express là chuỗi middleware chạy theo thứ tự khai báo. Nhắc nhanh route và params, express.json(), middleware next(), handler 404 và error handler 4 tham số, cùng các thay đổi của Express 5 (lỗi async tự bắt, cú pháp wildcard mới)."
type: card
level: core
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, express, middleware]
related: [nodejs/consolidate/express/xu-ly-loi-va-validation, nodejs/deep-dive/express/cau-truc-du-an-nhieu-tang]
---

## TL;DR

- Request đi qua các middleware **theo đúng thứ tự `app.use`/`app.get`**. Mỗi middleware hoặc trả response, hoặc gọi `next()`, hoặc `next(err)`.
- `express.json()` phải đứng **trước** route đọc `req.body`. Không có nó, `req.body` là `undefined` (Express 5).
- Cuối app: một handler **404**, rồi một **error handler** có đúng **4 tham số** `(err, req, res, next)`.
- Express 5: handler `async` ném lỗi hoặc Promise bị reject → **tự chuyển** tới error handler, không cần `try/catch` bao mọi route.

## Ví dụ tối thiểu (đã chạy thử với Express 5.3)

```js title="app.js"
import express from 'express';

export function buildApp() {
  const app = express();
  app.use(express.json());                       // 1. parse JSON body

  app.get('/api/products/:id', async (req, res) => {
    const p = await repo.findById(Number(req.params.id));
    if (!p) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(p);                                  // 200 + JSON
  });

  app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));   // 2. không route nào khớp
  app.use((err, req, res, next) => {                                       // 3. error handler
    console.error(err);
    res.status(500).json({ error: 'INTERNAL' });
  });
  return app;
}
```

```js title="server.js"
import { buildApp } from './app.js';
buildApp().listen(3000);   // tách app khỏi listen để test bằng supertest
```

## Bảng chọn nhanh

| Lấy dữ liệu từ | Ví dụ URL / request | Đọc bằng |
|---|---|---|
| Path param | `/products/42` | `req.params.id` (luôn là **string**) |
| Query string | `/products?page=2&q=noi` | `req.query.page` (string) |
| Body JSON | `POST` với `Content-Type: application/json` | `req.body` (cần `express.json()`) |
| Header | `Authorization: Bearer …` | `req.headers.authorization` hoặc `req.get('Authorization')` |

| Middleware | Dùng cho |
|---|---|
| `app.use(fn)` | Mọi request (log, parse body, CORS) |
| `app.use('/api/admin', fn)` | Một nhánh đường dẫn |
| `app.get('/x', auth, handler)` | Chỉ route này (xác thực, validation) |
| `express.Router()` | Gom route theo tài nguyên: `app.use('/api/products', productRouter)` |

## Lỗi hay gặp: gửi response hai lần

```js bad
app.get('/x', (req, res) => {
  if (!req.query.id) res.status(400).json({ error: 'id required' });   // thiếu return
  res.json({ ok: true });   // Error: Cannot set headers after they are sent
});
```

```js good
if (!req.query.id) return res.status(400).json({ error: 'id required' });
```

:::version Express 4 → 5
Express 5 (stable từ 2024) đổi: lỗi trong handler async được bắt tự động; wildcard phải có tên (`/files/*splat` thay cho `/files/*`, `req.params.splat` là **mảng** các đoạn); `req.body` là `undefined` khi không có parser; bỏ `res.send(status, body)` — dùng `res.status(s).send(body)`. Dự án Express 4 cũ thường bọc route bằng `express-async-handler` hoặc `try/catch` + `next(err)`.
:::

:::interview Middleware trong Express là gì? Thứ tự khai báo ảnh hưởng thế nào?
Middleware là hàm `(req, res, next)` chạy trong chuỗi xử lý một request: có thể đọc/sửa `req`/`res`, kết thúc bằng response, hoặc gọi `next()` để chuyển tiếp (`next(err)` để nhảy tới error handler). Express chạy theo thứ tự khai báo, nên: body parser và CORS phải đứng trước route; middleware xác thực phải đứng trước route cần bảo vệ; handler 404 và error handler đứng cuối. Đặt sai thứ tự là lỗi phổ biến: `req.body` rỗng, route không được bảo vệ, lỗi trả HTML mặc định thay vì JSON.
:::

:::quiz Route `async` ném `throw new Error('db down')` trong Express 5, app có error handler 4 tham số trả `500 {error:'INTERNAL'}`. Client nhận gì?
- [ ] Request treo mãi
- [x] `500` với body `{"error":"INTERNAL"}`
- [ ] Process Node bị crash
- [ ] `200` rỗng

Đã chạy thử bằng supertest. Ở Express 4, cùng đoạn code đó sẽ là unhandled rejection và request treo.
:::

:::quiz Bạn khai báo error handler là `app.use((err, req, res) => …)` (3 tham số). Điều gì xảy ra?
- [ ] Vẫn hoạt động như error handler
- [x] Express coi nó là middleware thường (`req, res, next`), lỗi không đi vào đó
- [ ] Lỗi cú pháp
- [ ] Chỉ bắt lỗi 404

Express phân biệt error handler bằng **số tham số** của hàm — phải đủ 4, kể cả khi không dùng `next`.
:::

:::quiz Route `GET /files/*splat`, request `/files/a/b.txt`. `req.params.splat` là gì trong Express 5?
- [ ] `'a/b.txt'`
- [x] `['a', 'b.txt']`
- [ ] `'b.txt'`
- [ ] `undefined`

Đã chạy thử: wildcard có tên trả mảng các đoạn đường dẫn.
:::
