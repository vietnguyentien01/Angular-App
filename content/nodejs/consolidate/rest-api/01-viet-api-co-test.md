---
title: Viết một REST API có test — Express 5, Zod, Vitest và supertest
summary: "Dựng API sản phẩm đầy đủ CRUD có phân trang và tìm kiếm, tiêm repository qua buildApp để test không cần DB, viết 8 test supertest cho các trường hợp thành công và lỗi. Toàn bộ code và test đã chạy xanh."
level: intermediate
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, rest, testing, vitest, supertest]
related: [nodejs/review/rest-api/thiet-ke-rest, nodejs/consolidate/express/xu-ly-loi-va-validation]
---

## TL;DR

- Tách `buildApp(deps)` khỏi `listen()` → test gọi app trực tiếp bằng **supertest**, không mở cổng thật.
- **Tiêm phụ thuộc** (repository) qua tham số → test dùng repo trong bộ nhớ, production dùng repo PostgreSQL. Cùng một app, khác nguồn dữ liệu.
- Mỗi test tạo app **mới** trong `beforeEach` → test độc lập, chạy thứ tự nào cũng được.
- Test theo **hợp đồng HTTP**: status, header `Location`, body — đúng những thứ frontend dựa vào.

## Chuẩn bị

```bash
mkdir product-api && cd product-api
npm init -y && npm pkg set type=module
npm install express@5 zod
npm install --save-dev vitest supertest
npm pkg set scripts.test="vitest run"
mkdir src test
```

## Cơ chế: vì sao tiêm repository

```text
test   ──► buildApp({ productRepo: memoryRepo })   ──► route ──► memoryRepo   (nhanh, không cần DB)
server ──► buildApp({ productRepo: postgresRepo }) ──► route ──► PostgreSQL
```

Route không `import` DB trực tiếp, nên không cần mock module — chỉ cần đưa vào một object có cùng các hàm `list/findById/create/update/remove`.

## Code

```js title="src/product-repo.js (repo trong bộ nhớ)"
export function createMemoryProductRepo(seed = []) {
  const rows = seed.map((p) => ({ ...p }));
  let nextId = Math.max(0, ...rows.map((p) => p.id)) + 1;
  return {
    async list({ page, limit, q }) {
      const filtered = q ? rows.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : rows;
      return { items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
    },
    async findById(id) { return rows.find((p) => p.id === id) ?? null; },
    async create(data) { const p = { id: nextId++, ...data }; rows.push(p); return p; },
    async update(id, patch) {
      const p = rows.find((x) => x.id === id);
      if (!p) return null;
      Object.assign(p, patch);
      return p;
    },
    async remove(id) {
      const i = rows.findIndex((p) => p.id === id);
      if (i === -1) return false;
      rows.splice(i, 1);
      return true;
    },
  };
}
```

```js title="src/app.js"
import express from 'express';
import { z } from 'zod';

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});
const ProductInput = z.object({ name: z.string().trim().min(1), price: z.number().int().positive() });
const ProductPatch = ProductInput.partial();
const Id = z.coerce.number().int().positive();

export function buildApp({ productRepo }) {
  const app = express();
  app.use(express.json());
  const bad = (res, error) => res.status(400).json({ error: 'VALIDATION', details: error.issues.map((i) => i.path.join('.')) });
  const notFound = (res) => res.status(404).json({ error: 'NOT_FOUND' });

  app.get('/api/products', async (req, res) => {
    const q = ListQuery.safeParse(req.query);
    if (!q.success) return bad(res, q.error);
    const { items, total } = await productRepo.list(q.data);
    res.json({ data: items, page: q.data.page, limit: q.data.limit, total });
  });
  app.get('/api/products/:id', async (req, res) => {
    const id = Id.safeParse(req.params.id);
    if (!id.success) return notFound(res);
    const p = await productRepo.findById(id.data);
    return p ? res.json(p) : notFound(res);
  });
  app.post('/api/products', async (req, res) => {
    const body = ProductInput.safeParse(req.body);
    if (!body.success) return bad(res, body.error);
    const p = await productRepo.create(body.data);
    res.status(201).location(`/api/products/${p.id}`).json(p);
  });
  app.patch('/api/products/:id', async (req, res) => {
    const id = Id.safeParse(req.params.id);
    const body = ProductPatch.safeParse(req.body);
    if (!id.success) return notFound(res);
    if (!body.success) return bad(res, body.error);
    const p = await productRepo.update(id.data, body.data);
    return p ? res.json(p) : notFound(res);
  });
  app.delete('/api/products/:id', async (req, res) => {
    const id = Id.safeParse(req.params.id);
    if (!id.success || !(await productRepo.remove(id.data))) return notFound(res);
    res.status(204).end();
  });
  app.use((req, res) => notFound(res));
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'INTERNAL' }); });
  return app;
}
```

```js title="test/products.test.js"
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createMemoryProductRepo } from '../src/product-repo.js';

let app;
beforeEach(() => {
  app = buildApp({
    productRepo: createMemoryProductRepo([
      { id: 1, name: 'Máy lọc nước', price: 5_000_000 },
      { id: 2, name: 'Nồi chiên không dầu', price: 1_500_000 },
      { id: 3, name: 'Máy massage cổ', price: 900_000 },
    ]),
  });
});

describe('GET /api/products', () => {
  it('phân trang và trả tổng số', async () => {
    const res = await request(app).get('/api/products?page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(res.body.data.map((p) => p.id)).toEqual([3]);
  });

  it('tìm theo tên không phân biệt hoa thường', async () => {
    const res = await request(app).get('/api/products?q=MÁY');
    expect(res.body.data.map((p) => p.id)).toEqual([1, 3]);
  });

  it('từ chối limit quá lớn', async () => {
    const res = await request(app).get('/api/products?limit=1000');
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['limit']);
  });
});

describe('POST /api/products', () => {
  it('tạo mới, trả 201 và Location', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Quạt điều hoà', price: 2_000_000 });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/products/4');
    const get = await request(app).get(res.headers.location);
    expect(get.body.name).toBe('Quạt điều hoà');
  });

  it('400 khi thiếu tên và giá âm', async () => {
    const res = await request(app).post('/api/products').send({ price: -5 });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['name', 'price']);
  });
});

describe('PATCH và DELETE', () => {
  it('PATCH chỉ đổi trường gửi lên', async () => {
    const res = await request(app).patch('/api/products/2').send({ price: 1_290_000 });
    expect(res.body).toEqual({ id: 2, name: 'Nồi chiên không dầu', price: 1_290_000 });
  });

  it('DELETE trả 204, gọi lại trả 404', async () => {
    expect((await request(app).delete('/api/products/1')).status).toBe(204);
    expect((await request(app).delete('/api/products/1')).status).toBe(404);
  });

  it('id không phải số → 404', async () => {
    expect((await request(app).get('/api/products/abc')).status).toBe(404);
  });
});
```

```bash
npm test
# Tests  8 passed (8)
```

```js title="src/server.js"
import { buildApp } from './app.js';
import { createMemoryProductRepo } from './product-repo.js';
// Môn SQL thay repo này bằng repo PostgreSQL — app.js không đổi.
buildApp({ productRepo: createMemoryProductRepo() }).listen(process.env.PORT ?? 3000);
```

Chạy thử bằng tay: `node src/server.js`, rồi `curl -i "localhost:3000/api/products?limit=1"`.

## Pitfalls

```js bad
const app = buildApp(deps);                         // tạo MỘT lần cho cả file
it('xoá sản phẩm 1', async () => { /* … */ });
it('có đúng 3 sản phẩm', async () => { /* … */ });   // pass hay fail tuỳ thứ tự chạy
```

```js bad
expect(res.body).toEqual(fullObjectWithTimestamps);   // vỡ mỗi lần thêm trường
```

Dùng `toMatchObject` cho phần bạn quan tâm, `toEqual` khi cần khớp tuyệt đối.

:::senior Góc nhìn senior
Kim tự tháp test cho API: nhiều unit test cho logic thuần (tính giá, kiểm tồn kho), một lớp **integration test** như bài này cho từng route, và vài test chạy với **DB thật** (container PostgreSQL trong CI) để bắt lỗi SQL, ràng buộc, migration. Repo trong bộ nhớ nhanh nhưng không bắt được lỗi `UNIQUE` hay sai kiểu cột — đừng chỉ dựa vào nó.
:::

:::version Công cụ test
Vitest 5 và Jest đều dùng được với supertest; Vitest chạy ESM không cần cấu hình. Node có sẵn `node:test` + `node:assert` nếu không muốn thêm thư viện. Dự án cũ thường dùng Mocha + Chai + supertest.
:::

:::interview Unit test và integration test khác nhau thế nào? Bạn test một REST API ra sao?
Unit test kiểm một đơn vị (hàm, class) cô lập, phụ thuộc được thay bằng giả lập — nhanh, chỉ ra chính xác chỗ sai. Integration test kiểm nhiều phần ghép lại (route + validation + service + repo, hoặc cả DB thật) — chậm hơn nhưng bắt được lỗi ghép nối. Với REST API: tách `buildApp` để dùng supertest; test mỗi route với các trường hợp thành công, validation lỗi, không tìm thấy, không có quyền; kiểm status, header và body; dữ liệu test tạo mới cho từng test; một số test chạy với DB thật trong CI.
:::

:::quiz Vì sao tách `buildApp()` khỏi `app.listen()`?
- [ ] Để server chạy nhanh hơn
- [x] Để test đưa app vào supertest mà không mở cổng thật, và tiêm phụ thuộc khác nhau cho test/production
- [ ] Express 5 bắt buộc
- [ ] Để dùng được TypeScript

supertest nhận trực tiếp app Express và tự gọi qua một cổng tạm.
:::

:::quiz `GET /api/products?page=2&limit=2` với 3 sản phẩm. Body trả gì (theo code trên)?
- [ ] `data` có 2 phần tử id 1, 2
- [x] `data` có 1 phần tử id 3, cùng `page: 2, limit: 2, total: 3`
- [ ] `data` rỗng
- [ ] `400` vì vượt số trang

Trang 2 lấy phần tử thứ 3–4; chỉ còn id 3. Đây là test đầu tiên và nó pass.
:::

:::quiz Hai test dùng chung một app tạo một lần: test A xoá sản phẩm 1, test B kỳ vọng có 3 sản phẩm. Vấn đề là gì?
- [ ] Không vấn đề gì
- [x] Test phụ thuộc thứ tự: B pass hay fail tuỳ A chạy trước hay sau — tạo app và dữ liệu mới trong `beforeEach`
- [ ] supertest không cho dùng lại app
- [ ] Vitest chạy song song nên luôn fail

Test phải độc lập để chạy lẻ, chạy song song, chạy lại đều cho cùng kết quả.
:::

:::exercise Thêm lọc theo khoảng giá và sắp xếp
Thêm vào `GET /api/products` các query `minPrice`, `maxPrice` (số nguyên ≥ 0) và `sort` ∈ `price`, `-price`, `name` (dấu `-` là giảm dần). `minPrice > maxPrice` → `400`. Viết test trước (ít nhất 4 test), rồi sửa `ListQuery` và repo cho tới khi xanh.
???
```js
const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['price', '-price', 'name']).optional(),
}).refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice,
  { message: 'minPrice phải ≤ maxPrice', path: ['minPrice'] });

// trong repo.list({ page, limit, q, minPrice, maxPrice, sort }):
let r = rows.filter((p) =>
  (minPrice === undefined || p.price >= minPrice) && (maxPrice === undefined || p.price <= maxPrice));
if (sort) {
  const desc = sort.startsWith('-');
  const key = sort.replace('-', '');
  r = [...r].sort((a, b) =>
    (key === 'name' ? a.name.localeCompare(b.name, 'vi') : a.price - b.price) * (desc ? -1 : 1));
}
```

Test gợi ý: `?minPrice=1000000` → id 1, 2; `?sort=-price` → 1, 2, 3; `?sort=price` → 3, 2, 1; `?minPrice=5&maxPrice=1` → 400 với `details` chứa `minPrice`; `?sort=abc` → 400. Sắp tên tiếng Việt dùng `localeCompare(…, 'vi')` thay vì so sánh `<`.
:::
