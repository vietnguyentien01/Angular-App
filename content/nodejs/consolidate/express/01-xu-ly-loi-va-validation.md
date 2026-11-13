---
title: Xử lý lỗi tập trung và validation request bằng Zod trong Express 5
summary: "Một lớp AppError, một middleware validate dùng Zod cho body/query, một error handler trả JSON thống nhất (cả JSON hỏng và lỗi không lường trước) — kèm các bẫy của Express 5 như req.query chỉ đọc. Mọi đoạn code đã chạy bằng supertest."
level: intermediate
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, express, validation, zod, error-handling]
related: [nodejs/review/express/routing-va-middleware, nodejs/consolidate/rest-api/viet-api-co-test]
---

## TL;DR

- **Không tin dữ liệu từ client**: validate body, query, params ở rìa hệ thống, trước khi vào service.
- Route chỉ `throw new AppError(404, 'NOT_FOUND', …)`; **một** error handler biến lỗi thành response JSON.
- Lỗi không lường trước → `500` với thông báo chung; chi tiết chỉ ghi vào **log**, không trả về client.
- Express 5: `req.query` là getter **chỉ đọc** — gán lại sẽ ném `TypeError` trong ESM. Lưu dữ liệu đã validate ở chỗ khác (vd `req.valid`).

## Cơ chế

```text
request → express.json() → validate(schema) → handler → response
                 │ JSON hỏng          │ sai dữ liệu     │ throw / reject
                 └────────────────────┴─────────────────┴──→ errorHandler → JSON lỗi
```

## Code

```js title="errors.js"
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') {           // express.json() gặp JSON hỏng
    return res.status(400).json({ error: 'INVALID_JSON', message: 'Body không phải JSON hợp lệ' });
  }
  req.log?.error(err) ?? console.error(err);          // log đầy đủ ở server
  res.status(500).json({ error: 'INTERNAL', message: 'Có lỗi xảy ra' });
}
```

```js title="validate.js"
import { AppError } from './errors.js';

export const validate = (schema, where = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[where]);
  if (!r.success) {
    return next(new AppError(400, 'VALIDATION', 'Dữ liệu không hợp lệ',
      r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))));
  }
  req.valid = { ...req.valid, [where]: r.data };      // KHÔNG gán req.query = …
  next();
};
```

```js title="products.routes.js"
import { z } from 'zod';

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),       // query luôn là string → coerce
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const ProductInput = z.object({
  name: z.string().trim().min(1, 'Bắt buộc'),
  price: z.number().int().positive(),
});

router.get('/', validate(ListQuery, 'query'), async (req, res) => {
  res.json(await productService.list(req.valid.query));
});
router.post('/', validate(ProductInput), async (req, res) => {
  res.status(201).json(await productService.create(req.valid.body));
});
router.get('/:id', async (req, res) => {
  const p = await productService.get(Number(req.params.id));
  if (!p) throw new AppError(404, 'NOT_FOUND', 'Không có sản phẩm');   // Express 5 tự chuyển lỗi
  res.json(p);
});
```

Kết quả đã kiểm bằng supertest: `GET /?limit=500` → `400`, `details[0].field = 'limit'`; `POST` `{ name: '  ', price: 1.5 }` → `400` với hai lỗi `name`, `price`; body `{bad` → `400 INVALID_JSON`; `name: ' Quạt '` được trim thành `'Quạt'`.

## Pitfalls

```js bad
res.status(500).json({ error: err.message, stack: err.stack });   // lộ cấu trúc DB, đường dẫn file
```

```js bad
const page = req.query.page + 1;   // '2' + 1 = '21' — query luôn là string
```

```js bad
if (!req.body.price) …   // price = 0 hợp lệ nhưng bị coi là thiếu
```

:::senior Góc nhìn senior
Validation ở rìa (Zod) chặn dữ liệu **sai định dạng**; quy tắc **nghiệp vụ** (hết hàng, vượt hạn mức) vẫn nằm trong service và ném `AppError` với code riêng (`OUT_OF_STOCK`). Frontend dựa vào `error` code — không dựa vào `message` vì message có thể đổi hay dịch. Dùng chung schema Zod để sinh kiểu TypeScript (`z.infer`) cho cả backend và frontend là cách giữ hợp đồng API đồng bộ.
:::

:::version Zod 3 → 4, Express 4 → 5
Zod 4 (2025) nhanh hơn và đổi một số API báo lỗi (vd `error.issues` vẫn giữ, `error.errors` bị bỏ; tham số `message` chuyển sang `error`, dạng chuỗi như `min(1, 'Bắt buộc')` vẫn chạy). Express 4 cần `express-async-errors` hoặc `try/catch` + `next(err)` cho route async; `req.query` gán lại được.
:::

:::interview Bạn tổ chức xử lý lỗi trong một API Express thế nào?
Một lớp lỗi ứng dụng (`AppError` với status, code, message, details) cho lỗi đã biết; route và service chỉ `throw`. Một error handler 4 tham số ở cuối app: lỗi đã biết → status và JSON tương ứng; lỗi parse JSON → 400; còn lại → log đầy đủ (kèm request id) và trả 500 chung chung. Validation request bằng schema (Zod/Joi) trong middleware trước handler. Express 5 tự bắt lỗi của handler async nên không cần try/catch lặp lại.
:::

:::quiz Trong một module ESM, middleware viết `req.query = parsed` trên Express 5. Điều gì xảy ra?
- [ ] `req.query` được thay bằng `parsed`
- [x] Ném `TypeError: Cannot set property query … which has only a getter` — đã chạy thử
- [ ] Lặng lẽ bỏ qua
- [ ] Chỉ lỗi khi query rỗng

Lưu kết quả validate vào chỗ riêng như `req.valid.query` hoặc `res.locals`.
:::

:::quiz `GET /products?page=2` và code `const next = req.query.page + 1`. `next` là?
- [ ] `3`
- [x] `'21'`
- [ ] `NaN`
- [ ] Lỗi

Query string luôn là string; dùng `z.coerce.number()` hoặc `Number()` có kiểm tra.
:::

:::quiz Client gửi body `{bad` với `Content-Type: application/json`. Không có nhánh xử lý riêng, error handler mặc định của bạn trả `500`. Nên trả gì?
- [ ] 500 — server lỗi
- [x] 400 — lỗi của client; bắt `err.type === 'entity.parse.failed'`
- [ ] 404
- [ ] 200 với body rỗng

Trả 500 cho lỗi của client làm nhiễu cảnh báo và che lỗi thật.
:::

:::exercise Thêm validation cho API đơn hàng
Viết schema Zod và route `POST /api/orders` nhận `{ customerPhone, items: [{ productId, quantity }], note? }`:
số điện thoại Việt Nam 10 số bắt đầu bằng 0; `items` có 1–50 phần tử, `quantity` nguyên 1–99, không trùng `productId`; `note` tối đa 500 ký tự. Sản phẩm hết hàng → service ném lỗi nghiệp vụ `409 OUT_OF_STOCK` kèm `productId`. Viết 4 test supertest: hợp lệ, thiếu items, trùng productId, hết hàng.
???
```js
const OrderInput = z.object({
  customerPhone: z.string().regex(/^0\d{9}$/, 'Số điện thoại 10 số, bắt đầu bằng 0'),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
  })).min(1).max(50)
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, 'Trùng sản phẩm'),
  note: z.string().max(500).optional(),
});

router.post('/', validate(OrderInput), async (req, res) => {
  res.status(201).json(await orderService.create(req.valid.body));
});

// trong orderService.create:
if (stock < item.quantity) throw new AppError(409, 'OUT_OF_STOCK', 'Sản phẩm đã hết hàng', { productId: item.productId });
```

Test: (1) body hợp lệ → `201`; (2) `items: []` → `400`, `details[0].field = 'items'`; (3) hai item cùng `productId` → `400` với message "Trùng sản phẩm"; (4) mock service ném `AppError(409…)` → `409`, `error = 'OUT_OF_STOCK'`. Lỗi của `refine` trên mảng có `path` là `['items']`.
:::
