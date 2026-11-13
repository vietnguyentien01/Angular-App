---
title: API ở quy mô thật — phân trang offset và cursor, idempotency key, versioning, cache và tài liệu OpenAPI
summary: "Vì sao OFFSET lớn chậm (đo bằng EXPLAIN: đọc 150.020 dòng để lấy 20) và cách phân trang bằng cursor, idempotency key chống tạo trùng đơn khi client gửi lại, các cách đánh version API, ETag và Cache-Control, và giữ hợp đồng API bằng OpenAPI."
level: advanced
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, rest, pagination, idempotency, openapi]
related: [nodejs/review/rest-api/thiet-ke-rest, nodejs/consolidate/rest-api/viet-api-co-test]
---

## TL;DR

- `LIMIT 20 OFFSET 150000` vẫn phải **đọc và bỏ** 150.000 dòng. Danh sách dài/vô tận → **cursor (keyset) pagination**: `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20`.
- POST tạo đơn/thanh toán: client gửi `Idempotency-Key`; server lưu kết quả lần đầu và **trả lại đúng kết quả đó** cho các lần gửi lại.
- Versioning: đổi hợp đồng **không tương thích** mới cần version mới (`/api/v2/...`); thêm trường tuỳ chọn thì không.
- Hợp đồng API viết bằng **OpenAPI** → sinh tài liệu, client TypeScript, và test hợp đồng.

## Phân trang: offset hay cursor

Đo trên PostgreSQL 16 với 200.000 dòng, có index `(created_at DESC, id DESC)`:

```sql
EXPLAIN (ANALYZE) SELECT id FROM products ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 150000;
-- Index Only Scan … (actual rows=150020)   Execution Time: ~25 ms

EXPLAIN (ANALYZE) SELECT id FROM products
WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20;
-- Index Only Scan … Index Cond: (ROW(created_at, id) < …) (actual rows=20)   Execution Time: ~0.05 ms
```

| | Offset (`?page=7`) | Cursor (`?after=<token>`) |
|---|---|---|
| Nhảy tới trang bất kỳ | ✓ | ✗ (chỉ trước/sau) |
| Tốc độ trang sâu | Chậm dần theo offset | Ổn định |
| Dữ liệu thêm/xoá trong lúc xem | Lặp hoặc sót dòng | Không lặp, không sót |
| Hợp với | Bảng quản trị có số trang, dữ liệu vừa phải | Feed, lịch sử đơn, infinite scroll, export |

```js title="cursor là base64url của (created_at, id) của dòng cuối"
const encode = (row) => Buffer.from(JSON.stringify([row.created_at, row.id])).toString('base64url');
const decode = (s) => JSON.parse(Buffer.from(s, 'base64url').toString());

// response: { data: [...], nextCursor: data.length === limit ? encode(data.at(-1)) : null }
```

Cột sắp xếp phải **duy nhất khi ghép** (thêm `id` làm tie-breaker) — chỉ `created_at` thì hai dòng cùng thời điểm có thể bị sót.

## Idempotency key (đã chạy thử)

```js title="idempotency.js — store có get/set, production dùng Redis có TTL 24h"
import { createHash } from 'node:crypto';

export function idempotency(store) {
  return async (req, res, next) => {
    const key = req.get('Idempotency-Key');
    if (!key) return res.status(400).json({ error: 'IDEMPOTENCY_KEY_REQUIRED' });
    const scope = `${req.user?.id ?? 'anon'}:${key}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(req.body)).digest('hex');

    const saved = await store.get(scope);
    if (saved) {
      if (saved.fingerprint !== fingerprint) return res.status(422).json({ error: 'IDEMPOTENCY_KEY_REUSED' });
      if (saved.status === 'processing') return res.status(409).json({ error: 'REQUEST_IN_PROGRESS' });
      return res.status(saved.status).set('Idempotent-Replayed', 'true').json(saved.body);
    }
    await store.set(scope, { fingerprint, status: 'processing' });
    const json = res.json.bind(res);
    res.json = (body) => { store.set(scope, { fingerprint, status: res.statusCode, body }); return json(body); };
    next();
  };
}

app.post('/api/orders', requireAuth, idempotency(redisStore), createOrder);
```

Đã kiểm: gửi hai lần cùng key → handler chỉ chạy **một** lần, lần hai nhận lại đúng `201` và body cũ kèm `Idempotent-Replayed: true`; cùng key nhưng body khác → `422`; thiếu key → `400`.

Lưu ý cho bản production: bước "kiểm tra rồi ghi" phải **nguyên tử** (Redis `SET key value NX EX 86400`, hoặc bảng có `UNIQUE (user_id, key)`), nếu không hai request đến cùng lúc vẫn lọt cả hai. Phía frontend tạo key một lần cho mỗi lần bấm "Đặt hàng" (`crypto.randomUUID()`), dùng lại khi retry.

## Versioning

| Cách | Ví dụ | Ghi chú |
|---|---|---|
| Trong URL | `/api/v2/orders` | Dễ thấy, dễ định tuyến, phổ biến nhất |
| Header | `Accept: application/vnd.shop.v2+json` | URL gọn, khó thử bằng trình duyệt |
| Không version, chỉ tiến hoá tương thích | Thêm trường tuỳ chọn, không đổi nghĩa trường cũ | Hợp với API nội bộ có một frontend |

Thay đổi **phá vỡ**: xoá/đổi tên trường, đổi kiểu, đổi nghĩa status code, thêm trường **bắt buộc** vào request. Giữ version cũ một thời gian, báo bằng header `Deprecation`/`Sunset`.

## Cache và ETag

```js
app.get('/api/categories', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');   // danh mục ít đổi: CDN/trình duyệt giữ 5 phút
  res.json(await categoryRepo.list());               // Express tự tạo ETag; client gửi If-None-Match → 304
});
```

Dữ liệu theo người dùng: `Cache-Control: private, no-store` cho dữ liệu nhạy cảm (giỏ hàng, hồ sơ).

## OpenAPI

Viết (hoặc sinh từ schema Zod bằng `@asteasolutions/zod-to-openapi`) file `openapi.yaml` mô tả path, schema, mã lỗi → Swagger UI cho QA/frontend, sinh client TypeScript (`openapi-typescript`) cho Angular/React, và kiểm trong CI rằng response thật khớp schema.

:::senior Góc nhìn senior
Ba câu hỏi trước khi chốt một endpoint: (1) **gọi lại** có an toàn không — nếu không, cần idempotency; (2) danh sách có thể **lớn tới đâu** — nếu không giới hạn, dùng cursor và đặt `limit` tối đa; (3) ai **phụ thuộc** vào hợp đồng này — càng nhiều client (mobile không cập nhật được ngay), càng phải tiến hoá tương thích và có version. Thanh toán, trừ tồn kho, gửi tin nhắn là ba chỗ bắt buộc idempotent.
:::

:::quiz Người dùng bấm "Đặt hàng", mạng chập chờn, app tự retry `POST /api/orders` cùng `Idempotency-Key`. Server làm đúng thì sao?
- [ ] Tạo hai đơn, sau đó gộp lại
- [x] Chỉ tạo một đơn; lần retry nhận lại đúng response của lần đầu
- [ ] Trả 409 cho lần retry và bắt người dùng tải lại trang
- [ ] Trả 500 vì trùng key

Đã kiểm bằng test: handler chỉ chạy một lần.
:::

:::quiz Vì sao cursor pagination cần thêm `id` cùng với `created_at`?
- [ ] Để URL dài hơn khó đoán
- [x] Nhiều dòng có thể trùng `created_at`; ghép `(created_at, id)` tạo thứ tự duy nhất để không lặp hoặc sót dòng giữa hai trang
- [ ] PostgreSQL không so sánh được timestamp
- [ ] Để dùng được OFFSET

Index cũng phải theo đúng `(created_at DESC, id DESC)` để truy vấn chỉ đọc 20 dòng như trong EXPLAIN.
:::

:::exercise Chuyển "Lịch sử đơn hàng" sang cursor pagination
`GET /api/me/orders?page=N` đang dùng OFFSET và người dùng báo "thấy một đơn hai lần" khi có đơn mới trong lúc cuộn. Thiết kế lại: query `?limit=20&after=<cursor>`, response `{ data, nextCursor }`, câu SQL, index cần có, và 3 test (trang đầu, trang tiếp theo dùng `nextCursor`, đơn mới chèn vào giữa hai lần gọi không làm lặp dữ liệu).
???
```sql
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC, id DESC);

-- trang đầu
SELECT id, total, created_at FROM orders WHERE user_id = $1
ORDER BY created_at DESC, id DESC LIMIT $2;
-- trang sau
SELECT id, total, created_at FROM orders
WHERE user_id = $1 AND (created_at, id) < ($3, $4)
ORDER BY created_at DESC, id DESC LIMIT $2;
```

```js
router.get('/me/orders', requireAuth, validate(z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  after: z.string().optional(),
}), 'query'), async (req, res) => {
  const { limit, after } = req.valid.query;
  let cursor;
  try { cursor = after ? decode(after) : undefined; } catch { return res.status(400).json({ error: 'INVALID_CURSOR' }); }
  const data = await orderRepo.listByUser(req.user.id, { limit, cursor });
  res.json({ data, nextCursor: data.length === limit ? encode(data.at(-1)) : null });
});
```

Test 3: lấy trang 1 (20 đơn mới nhất), chèn một đơn mới, lấy trang 2 bằng `nextCursor` → không có id nào của trang 1 xuất hiện lại (với OFFSET, đơn cuối trang 1 sẽ bị đẩy sang trang 2 và hiện hai lần). Cursor là dữ liệu từ client: luôn validate và bắt lỗi decode.
:::
