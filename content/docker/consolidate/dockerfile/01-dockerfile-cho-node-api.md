---
title: "Dockerfile multi-stage cho API Node.js — cache, non-root, healthcheck, sau proxy công ty"
summary: "Đóng gói API Express 5 + PostgreSQL thành image 260 MB thay vì 1,82 GB: multi-stage, thứ tự layer để npm ci được cache, USER node, HEALTHCHECK, CMD dạng exec — kèm hai lỗi thật khi build: /health bị 404 và npm báo SELF_SIGNED_CERT_IN_CHAIN sau proxy."
level: intermediate
version: 29
lastReviewed: 2026-11-13
tags: [docker, dockerfile, multi-stage, nodejs, healthcheck]
related: [docker/review/dockerfile/dockerfile-co-ban, nodejs/consolidate/rest-api/viet-api-co-test, docker/consolidate/compose/compose-api-va-postgres]
---

## TL;DR

- **Multi-stage**: stage `deps` cài dependency; stage cuối chỉ `COPY --from=deps` thư mục `node_modules` cần thiết + source. Image cuối không có công cụ build hay devDependencies.
- Thứ tự: lockfile → `npm ci` → source. Sửa code: `npm ci` vẫn `CACHED`.
- `USER node`, `HEALTHCHECK`, `CMD ["node", …]` — ba dòng nhỏ quyết định bảo mật, khả năng tự phục hồi và tắt êm.
- Build sau proxy chặn TLS: đưa chứng chỉ CA vào bằng **BuildKit secret**, không `COPY` vào image.

## Dự án

API sản phẩm từ môn Node.js (`buildApp` + repo PostgreSQL):

```text
product-api/
  package.json  package-lock.json
  src/app.js  src/product-repo-pg.js  src/server.js
  db/init.sql
  Dockerfile  .dockerignore  compose.yaml
```

## Dockerfile (đã build và chạy thật)

```dockerfile title="Dockerfile"
# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]
```

```text title=".dockerignore"
node_modules
npm-debug.log
.git
.env
.env.*
coverage
test
Dockerfile
compose.yaml
```

```js title="src/server.js"
import pg from 'pg';
import { buildApp } from './app.js';
import { createPgProductRepo } from './product-repo-pg.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = buildApp({
  productRepo: createPgProductRepo(pool),
  healthCheck: () => pool.query('SELECT 1'),   // health thật: kiểm cả kết nối DB
});
const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, () => console.log(`API listening on :${port}`));

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing');
  server.close(async () => { await pool.end(); process.exit(0); });
});
```

## Số đo

| | Dockerfile "chạy được là được" (`FROM node:24`, `COPY . .`, `npm install`, `CMD npm start`) | Dockerfile trên |
|---|---|---|
| Kích thước image | **1,82 GB** | **260 MB** (image gốc `node:24-alpine` chiếm 244 MB) |
| Số gói trong `node_modules` | 128 (có cả vitest, supertest) | 80 |
| Chạy với user | `root` | `node` |
| Sửa 1 dòng trong `src/` rồi build lại | `npm install` chạy lại | `npm ci` **CACHED**, chỉ `COPY src` chạy |
| `docker stop` | **~10 giây** (SIGTERM không tới Node → bị SIGKILL) | ~0,26 giây, log `SIGTERM received, closing` |

## Hai lỗi thật khi build

### 1. Healthcheck báo `unhealthy` dù API trả dữ liệu

Bản đầu thêm `app.get('/health', …)` trong `server.js`, **sau** khi `buildApp()` đã gắn handler 404 cuối app → `GET /health` trả `{"error":"NOT_FOUND"}`, container `(unhealthy)`. Sửa: đưa health check vào `buildApp` (truyền `healthCheck` qua tham số) và đăng ký route trước handler 404:

```js title="src/app.js (trích)"
export function buildApp({ productRepo, healthCheck = async () => {} }) {
  const app = express();
  app.use(express.json());
  app.get('/health', async (req, res) => {
    await healthCheck();             // DB lỗi → throw → error handler trả 500 → healthcheck fail
    res.json({ status: 'ok' });
  });
  // … các route /api/products …
  app.use((req, res) => notFound(res));            // 404 luôn đứng cuối
```

### 2. `npm ci` lỗi `SELF_SIGNED_CERT_IN_CHAIN` sau proxy

Mạng có proxy giải mã HTTPS (phổ biến ở công ty, và ở môi trường soạn bài này): máy bạn tin CA của proxy, nhưng container build thì không. Đừng tắt kiểm tra TLS (`strict-ssl=false`). Đưa CA vào **chỉ trong bước cài** bằng BuildKit secret — file không nằm lại trong image (đã kiểm: `/tmp` của image cuối trống):

```dockerfile
RUN --mount=type=secret,id=corp_ca,target=/tmp/corp-ca.crt \
    NODE_EXTRA_CA_CERTS=/tmp/corp-ca.crt npm ci --omit=dev
```

```bash
docker build --secret id=corp_ca,src=/duong/dan/corp-ca.crt -t product-api .
```

## Chạy thử

```bash
docker build -t product-api .
docker run --rm -p 3000:3000 -e DATABASE_URL=postgres://… product-api
curl localhost:3000/health          # {"status":"ok"}
```

Có DB đi kèm thì dùng compose (bài tiếp theo) — `docker compose up -d --build` rồi `docker compose ps` thấy `api … (healthy)`.

:::senior Góc nhìn senior
Image là **artifact** của pipeline: build một lần, gắn tag theo commit (`product-api:3f2c1a9`), rồi chính image đó đi qua staging và production — không build lại cho từng môi trường. Mọi khác biệt môi trường đi qua biến môi trường lúc chạy. Kiểm image bằng scanner (Trivy, Docker Scout) trong CI và cập nhật image gốc định kỳ: phần lớn lỗ hổng nằm ở image gốc, không phải ở code của bạn.
:::

:::version Image gốc
`node:24-alpine` (musl libc) nhỏ nhưng một số gói native cần build lại; `node:24-slim` (Debian) lớn hơn chút, tương thích rộng hơn; image distroless/`chainguard` nhỏ nhất và không có shell (khó debug). Node 26 đã là LTS từ 10/2026 — đổi `FROM node:26-alpine` khi dự án đã kiểm tra tương thích.
:::

:::interview Multi-stage build là gì và giải quyết vấn đề gì?
Dockerfile có nhiều `FROM`; mỗi stage là một môi trường build riêng, và stage cuối chỉ `COPY --from=…` những gì cần để chạy. Nhờ vậy công cụ build (TypeScript compiler, Angular CLI, devDependencies, cache) ở lại stage trước, image cuối nhỏ hơn, ít bề mặt tấn công hơn, kéo/đẩy nhanh hơn. Ví dụ frontend: stage 1 `npm ci && ng build`, stage 2 `FROM nginx:alpine` chỉ copy `dist/`. Ví dụ API: stage `deps` cài `--omit=dev`, stage cuối copy `node_modules` và source.
:::

:::quiz Image dùng `CMD npm start` (dạng shell). `docker stop` mất khoảng 10 giây. Vì sao?
- [ ] Node khởi động chậm
- [x] Tín hiệu SIGTERM tới tiến trình shell/npm làm PID 1 chứ không tới Node; hết 10 giây chờ, Docker gửi SIGKILL
- [ ] Docker luôn chờ 10 giây
- [ ] Do alpine

Đã đo: ~10 giây với `CMD npm start`, ~0,26 giây với `CMD ["node", "src/server.js"]` có xử lý SIGTERM.
:::

:::quiz Vì sao không sửa lỗi `SELF_SIGNED_CERT_IN_CHAIN` bằng `npm config set strict-ssl false` trong Dockerfile?
- [ ] Vì lệnh đó không tồn tại
- [x] Vì nó tắt kiểm tra chứng chỉ — bất kỳ ai ở giữa đường truyền đều có thể thay gói npm bằng mã độc
- [ ] Vì làm image lớn hơn
- [ ] Vì chỉ chạy được trên Windows

Tin đúng CA của proxy (qua BuildKit secret) là cách an toàn.
:::

:::exercise Dockerfile cho Angular app
Viết Dockerfile multi-stage cho một ứng dụng Angular: stage 1 dùng `node:24-alpine` chạy `npm ci` và `npx ng build`; stage 2 dùng `nginx:alpine` phục vụ thư mục build, cấu hình để mọi đường dẫn không phải file trả về `index.html` (SPA routing). Đo kích thước image cuối và giải thích vì sao nó nhỏ hơn nhiều so với image API.
???
```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/<ten-app>/browser /usr/share/nginx/html
EXPOSE 80
```

```text
server {
  listen 80;
  root /usr/share/nginx/html;
  location / {
    try_files $uri $uri/ /index.html;
  }
  location ~* \.(js|css|woff2|png|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

Stage build cần cả devDependencies (Angular CLI) nên dùng `npm ci` đầy đủ — nhưng chúng không vào image cuối. Đã build thử với chính Learning Hub: image cuối **101 MB** (phần lớn là `nginx:alpine`), không có Node.js hay `node_modules`; `/` và đường dẫn SPA như `/angular/review` đều trả `200 text/html`, file `.js` có `Cache-Control: public, immutable`. Lưu ý khi build sau proxy: `ng build` mặc định tải và nhúng Google Fonts lúc build, nên bước build cũng cần CA (cùng cách `--mount=type=secret` như bước `npm ci`). `.dockerignore` cần loại `node_modules`, `dist`, `.angular`. Đường dẫn `dist/<ten-app>/browser` tuỳ tên project trong `angular.json`.
:::
