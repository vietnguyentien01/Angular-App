---
title: "Dockerfile cơ bản — FROM, COPY, RUN, CMD và cache layer"
summary: "Mỗi lệnh trong Dockerfile tạo một layer được cache; layer đổi thì mọi layer sau chạy lại. Nhắc nhanh các lệnh chính, thứ tự copy package.json trước để npm ci được cache, .dockerignore, CMD dạng exec, multi-stage và USER — có số đo: image viết ẩu 1,82 GB so với 260 MB."
type: card
level: core
version: 29
lastReviewed: 2026-11-13
tags: [docker, dockerfile, cache, nodejs]
related: [docker/consolidate/dockerfile/dockerfile-cho-node-api, docker/deep-dive/dockerfile/toi-uu-va-bao-mat-image]
---

## TL;DR

- `FROM` chọn image gốc; `WORKDIR` thư mục làm việc; `COPY` đưa file vào; `RUN` chạy lệnh lúc **build**; `CMD` lệnh chạy khi **container khởi động**.
- Mỗi lệnh là một **layer** có cache. Một layer đổi → mọi layer **sau nó** build lại. Vì vậy: copy `package.json`/lockfile → `npm ci` → **rồi** mới copy source.
- `.dockerignore` loại `node_modules`, `.git`, `.env` khỏi build context.
- `CMD ["node", "src/server.js"]` (dạng **exec**, mảng JSON) — không dùng dạng shell `CMD npm start`.

## Dockerfile tối thiểu cho Node API

```dockerfile title="Dockerfile"
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
```

```text title=".dockerignore"
node_modules
.git
.env
.env.*
coverage
test
```

```bash
docker build -t product-api .
docker run --rm -p 3000:3000 -e DATABASE_URL=… product-api
```

## Bảng lệnh

| Lệnh | Khi nào chạy | Ghi chú |
|---|---|---|
| `FROM node:24-alpine` | Build | Ghim phiên bản; `alpine`/`slim` nhỏ hơn bản đầy đủ |
| `COPY src ./src` | Build | Nội dung file đổi → layer này và sau nó build lại |
| `RUN npm ci --omit=dev` | Build | Không cài devDependencies vào image chạy |
| `ENV NODE_ENV=production` | Build + runtime | Không đặt **secret** bằng `ENV`/`ARG` — chúng nằm lại trong image |
| `USER node` | Runtime | Image `node` có sẵn user `node`; không chạy bằng root |
| `EXPOSE 3000` | Tài liệu | Không tự mở cổng — vẫn cần `-p` |
| `CMD [...]` | Runtime | Ghi đè được: `docker run image node -v` |

## Lỗi hay gặp: Dockerfile "chạy được là được"

```dockerfile bad
FROM node:24
WORKDIR /app
COPY . .
RUN npm install
CMD npm start
```

Đo thật trên cùng một API: image **1,82 GB** (bản tối ưu ở bài Củng cố: **260 MB**), chứa cả devDependencies (128 gói, có cả vitest), chạy bằng **root**, mỗi lần sửa một dòng code là `npm install` chạy lại (vì `COPY . .` đứng trước), và `docker stop` mất **10 giây** vì `CMD` dạng shell không chuyển SIGTERM tới Node.

:::version BuildKit
Docker hiện dùng BuildKit mặc định: build song song các stage, `--mount=type=cache` cho thư mục cache npm, `--mount=type=secret` cho token. Dòng `# syntax=docker/dockerfile:1` ở đầu file bật cú pháp Dockerfile mới nhất.
:::

:::interview Vì sao copy package.json và chạy npm ci trước khi copy source code?
Docker cache từng layer theo nội dung đầu vào. Dependency ít đổi, code đổi liên tục. Nếu copy toàn bộ source trước `npm ci`, mỗi lần sửa code layer `COPY` đổi và `npm ci` chạy lại (vài phút). Copy riêng `package.json` + lockfile, chạy `npm ci`, rồi mới copy source thì sửa code chỉ build lại layer cuối — đã đo: bước `npm ci` báo `CACHED`, chỉ `COPY src` chạy lại.
:::

:::quiz Bạn chỉ sửa một file trong `src/`. Với Dockerfile tối thiểu ở trên, bước nào chạy lại khi build?
- [ ] Tất cả các bước
- [ ] `npm ci` và `COPY src`
- [x] Chỉ `COPY src ./src` và các bước sau nó
- [ ] Không bước nào

`package.json` và lockfile không đổi nên `npm ci` dùng cache.
:::

:::quiz Đặt `ENV DB_PASSWORD=matkhauthat` trong Dockerfile có vấn đề gì?
- [ ] Không vấn đề, ENV được mã hoá
- [x] Mật khẩu nằm lại trong image — ai pull được image đều đọc được (`docker inspect`, `docker history`)
- [ ] Chỉ lỗi khi dùng alpine
- [ ] Container không đọc được ENV

Secret truyền lúc **chạy** (`-e`, secret của orchestrator), không lúc build.
:::

:::quiz `EXPOSE 3000` có làm cổng 3000 truy cập được từ máy của bạn không?
- [ ] Có
- [x] Không — chỉ là tài liệu/siêu dữ liệu; vẫn cần `-p 3000:3000` hoặc `ports:` trong compose
- [ ] Có nếu dùng alpine
- [ ] Chỉ trong compose

`EXPOSE` giúp công cụ và người đọc biết app lắng nghe cổng nào.
:::
