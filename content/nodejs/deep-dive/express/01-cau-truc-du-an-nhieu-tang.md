---
title: Cấu trúc một backend Express thật — tầng route/service/repository, config, log, graceful shutdown
summary: "Chia dự án theo module nghiệp vụ và ba tầng có trách nhiệm rõ ràng, nạp và kiểm config từ biến môi trường bằng Zod, log có cấu trúc với request id, health check, và tắt server êm khi container nhận SIGTERM — so sánh với NestJS và với kiến trúc Angular quen thuộc."
level: advanced
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, express, architecture, config, logging]
related: [nodejs/consolidate/express/xu-ly-loi-va-validation, nodejs/consolidate/rest-api/viet-api-co-test]
---

## TL;DR

- **Route/controller**: HTTP (đọc request, validate, trả status). **Service**: nghiệp vụ, không biết HTTP. **Repository**: SQL/ORM, không biết nghiệp vụ.
- Chia thư mục theo **module nghiệp vụ** (`products/`, `orders/`) thay vì theo loại file (`controllers/`, `services/`) khi dự án lớn dần.
- Config: đọc **một lần** từ `process.env`, kiểm bằng schema, thiếu biến bắt buộc thì **không khởi động**.
- Log JSON có `requestId`; `/health` cho load balancer; xử lý `SIGTERM` để không cắt ngang request khi deploy.

## Cấu trúc thư mục

```text
src/
  config.js                 # đọc + kiểm biến môi trường
  app.js                    # buildApp(deps): middleware chung, gắn router, error handler
  server.js                 # tạo deps thật, listen, graceful shutdown
  db.js                     # pool PostgreSQL
  shared/ errors.js validate.js auth.js
  products/
    product.routes.js       # HTTP
    product.service.js      # nghiệp vụ: giá, tồn kho, quyền
    product.repo.js         # SQL
    product.schemas.js      # Zod
  orders/ …
test/
```

So với Angular: route ≈ component (giao tiếp với "bên ngoài"), service ≈ service, repository ≈ lớp gọi `HttpClient`. Cùng tư tưởng: lớp ngoài mỏng, logic nằm ở service có thể test riêng.

## Config được kiểm tra

```js title="src/config.js"
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error('Thiếu hoặc sai biến môi trường:', parsed.error.issues.map((i) => i.path.join('.')));
  process.exit(1);
}
export const config = parsed.data;
```

Chạy local: `node --env-file=.env src/server.js` (Node 20.6+), `.env` nằm trong `.gitignore`, có `.env.example` liệt kê tên biến.

## Service không biết HTTP

```js title="src/orders/order.service.js"
import { AppError } from '../shared/errors.js';

export function createOrderService({ orderRepo, productRepo }) {
  return {
    async create(userId, input) {
      const products = await productRepo.findManyByIds(input.items.map((i) => i.productId));
      for (const item of input.items) {
        const p = products.find((x) => x.id === item.productId);
        if (!p) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Không có sản phẩm', { productId: item.productId });
        if (p.stock < item.quantity) throw new AppError(409, 'OUT_OF_STOCK', 'Hết hàng', { productId: p.id });
      }
      const total = input.items.reduce((s, i) => s + products.find((p) => p.id === i.productId).price * i.quantity, 0);
      return orderRepo.createWithItems({ userId, total, items: input.items });   // một transaction
    },
  };
}
```

Test service không cần supertest: truyền `orderRepo`/`productRepo` giả và gọi `create` trực tiếp.

## Log, health check, graceful shutdown

```js title="src/app.js (trích)"
import { randomUUID } from 'node:crypto';

app.use((req, res, next) => {
  req.id = req.get('x-request-id') ?? randomUUID();
  res.set('x-request-id', req.id);
  const t0 = performance.now();
  res.on('finish', () => console.log(JSON.stringify({
    level: 'info', reqId: req.id, method: req.method, url: req.originalUrl,
    status: res.statusCode, ms: Math.round(performance.now() - t0),
  })));
  next();
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));
```

```js title="src/server.js (trích) — đã chạy thử: request đang xử lý vẫn nhận được 'ok' rồi mới thoát"
const server = buildApp(deps).listen(config.PORT);

process.on('SIGTERM', () => {
  console.log('SIGTERM: ngừng nhận request mới');
  server.close(async () => {          // chờ các request đang chạy xong
    await pool.end();                 // đóng kết nối DB
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();   // quá 10s thì buộc thoát
});
```

Docker/Kubernetes gửi `SIGTERM` khi dừng container rồi chờ một khoảng (mặc định 10s với `docker stop`, 30s với Kubernetes) trước khi `SIGKILL`.

## Express tự cấu trúc hay NestJS?

| | Express + cấu trúc tự đặt | NestJS |
|---|---|---|
| Học | Nhanh, ít khái niệm | Module, provider, decorator, DI — **rất giống Angular** |
| Linh hoạt | Cao; dễ "mỗi người một kiểu" | Quy ước chặt, team lớn dễ đồng bộ |
| Hệ sinh thái | Middleware Express | Có sẵn validation pipe, guard, Swagger, microservice |
| Hợp với | Service nhỏ, team nhỏ, cần hiểu nền tảng | Backend lớn, team đông, dev đến từ Angular/Spring |

Nền tảng (HTTP, middleware, tầng, test) ở bài này dùng được cho cả hai — NestJS mặc định chạy trên Express.

:::senior Góc nhìn senior
Ranh giới tầng quan trọng hơn tên thư mục: service **không** nhận `req`/`res`, repository **không** ném lỗi HTTP. Giữ được hai điều đó thì đổi framework (Express → Fastify/NestJS), đổi DB, hay thêm một kênh vào khác (job queue, CLI) đều chỉ chạm lớp ngoài. Với dev Angular chuyển sang fullstack, NestJS thường là con đường nhanh nhất — nhưng phỏng vấn sẽ hỏi Express "trần" để kiểm bạn hiểu nền tảng.
:::

:::quiz Trong kiến trúc ở trên, `throw new AppError(409, 'OUT_OF_STOCK')` nên nằm ở tầng nào?
- [ ] Repository, ngay sau câu SELECT
- [x] Service — đây là quy tắc nghiệp vụ; route chỉ chuyển lỗi cho error handler
- [ ] Error handler
- [ ] Middleware validate

Validate định dạng ở rìa (Zod), quy tắc nghiệp vụ ở service, SQL ở repository.
:::

:::quiz Container nhận `SIGTERM` khi deploy bản mới. App không xử lý tín hiệu này. Điều gì có thể xảy ra?
- [ ] Không sao, Node tự chờ request xong
- [x] Process bị dừng ngay hoặc bị SIGKILL sau thời gian chờ — các request đang xử lý (vd đang ghi đơn hàng) bị cắt ngang
- [ ] Docker tự chuyển request sang container mới
- [ ] Node bỏ qua SIGTERM

`server.close()` ngừng nhận kết nối mới và chờ request đang chạy xong; nhớ đóng pool DB.
:::

:::exercise Tái cấu trúc API sản phẩm thành module
Lấy API ở bài *Viết một REST API có test* và tách thành `products/product.routes.js`, `product.service.js`, `product.repo.js`, `product.schemas.js` theo cấu trúc trên, thêm `config.js` có kiểm biến môi trường và `/health`. Yêu cầu: 8 test cũ vẫn xanh **không sửa test**; thêm 2 unit test cho service (không dùng supertest).
???
Gợi ý chia: `product.schemas.js` chứa `ListQuery`, `ProductInput`, `ProductPatch`; `product.repo.js` giữ `createMemoryProductRepo` (sau này thêm bản PostgreSQL cùng interface); `product.service.js` nhận `{ productRepo }`, có `list/get/create/update/remove`, ném `AppError(404)` khi không có; `product.routes.js` tạo `express.Router()`, validate rồi gọi service; `app.js` nhận deps, gắn `app.use('/api/products', productRouter(services))`, thêm error handler xử lý `AppError`.

Test cũ vẫn xanh vì hợp đồng HTTP (URL, status, body) không đổi — đó là giá trị của test theo hợp đồng. Unit test service ví dụ: `get(999)` với repo rỗng ném `AppError` có `status 404`; `update` gọi `repo.update` với đúng id và patch (dùng `vi.fn()`).
:::
