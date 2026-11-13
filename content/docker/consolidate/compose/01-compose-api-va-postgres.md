---
title: "Compose cho API + PostgreSQL — healthcheck, chờ DB sẵn sàng, dữ liệu mẫu, kiểm dữ liệu còn sau khi tắt"
summary: "Chạy API sản phẩm và PostgreSQL bằng một lệnh docker compose up: DB có healthcheck pg_isready, API chỉ khởi động khi DB healthy, dữ liệu mẫu nạp từ init.sql, mật khẩu lấy từ .env. Đã chạy thật và kiểm từng bước: (healthy), dữ liệu còn sau down, mất sau down -v, dừng êm khi nhận SIGTERM."
level: intermediate
version: 29
lastReviewed: 2026-11-13
tags: [docker, compose, postgresql, healthcheck, nodejs]
related: [docker/review/compose/compose-nhieu-dich-vu, docker/consolidate/dockerfile/dockerfile-cho-node-api]
---

## TL;DR

- Một file `compose.yaml` + một file `.env` (không commit) là đủ để cả team chạy được API + DB giống nhau.
- `healthcheck` ở DB + `depends_on … condition: service_healthy` ở API → API không khởi động khi DB chưa nhận kết nối.
- `HEALTHCHECK` trong Dockerfile của API → `docker compose ps` hiển thị `(healthy)` khi `/health` kiểm được cả DB.
- `down` giữ dữ liệu, `down -v` xoá; script trong `docker-entrypoint-initdb.d` chỉ chạy khi volume trống.

## Các file

```yaml title="compose.yaml (đã chạy thật)"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: shop
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: ${DB_PASSWORD:-devpassword}
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop -d shop"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build: .
    environment:
      DATABASE_URL: postgres://shop:${DB_PASSWORD:-devpassword}@db:5432/shop
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy

volumes:
  db-data:
```

```sql title="db/init.sql"
CREATE TABLE IF NOT EXISTS products (
  id    serial PRIMARY KEY,
  name  text NOT NULL,
  price int  NOT NULL CHECK (price > 0)
);
INSERT INTO products (name, price) VALUES
  ('Máy lọc nước', 5000000), ('Nồi chiên không dầu', 1500000), ('Máy massage cổ', 900000);
```

```text title=".env (thêm vào .gitignore) và .env.example (commit, không có giá trị thật)"
DB_PASSWORD=doi-mat-khau-nay
```

Dịch vụ `db` **không** khai `ports` — chỉ API trong cùng network truy cập được. Cần xem DB từ máy (DBeaver, psql) thì tạm thêm `ports: ["5432:5432"]` cho môi trường dev.

## Chạy và kiểm từng bước

| # | Lệnh | Kết quả đã thấy |
|---|---|---|
| 1 | `docker compose up -d --build` | `Container …-db-1 Healthy` rồi mới `Container …-api-1 Started` |
| 2 | `docker compose ps` | `db … (healthy)`, `api … (healthy)` |
| 3 | `curl "localhost:3000/api/products?limit=2"` | `{"data":[{"id":1,"name":"Máy lọc nước",…},{"id":2,…}],"page":1,"limit":2,"total":3}` |
| 4 | `curl -X POST localhost:3000/api/products -H 'Content-Type: application/json' -d '{"name":"Quạt điều hoà","price":2000000}'` | `{"id":4,"name":"Quạt điều hoà","price":2000000}` |
| 5 | `docker compose down` rồi `up -d`, tìm `?q=Quạt` | Vẫn có sản phẩm id 4 — volume được giữ |
| 6 | `docker compose down -v` rồi `up -d`, tìm `?q=Quạt` | `"data":[]` — volume bị xoá, `init.sql` chạy lại, còn 3 sản phẩm mẫu |
| 7 | `docker compose stop api` | Khoảng 0,26 giây; log `SIGTERM received, closing` |
| 8 | `docker compose exec db psql -U shop -d shop -c "select count(*) from products"` | Đếm trực tiếp trong DB |

## Pitfalls

```yaml bad
depends_on:
  - db          # chỉ chờ container khởi động — API có thể chạy trước khi PostgreSQL nhận kết nối
```

```yaml bad
environment:
  POSTGRES_PASSWORD: matkhauthat123   # commit lên git là lộ
```

```yaml bad
api:
  environment:
    DATABASE_URL: postgres://shop:pw@localhost:5432/shop   # localhost là chính container api
```

Khi gặp lỗi: `docker compose logs db api`, `docker compose ps`, `docker compose exec api wget -qO- localhost:3000/health`.

:::senior Góc nhìn senior
Compose là công cụ cho **dev và test** (và cho server nhỏ một máy). Giá trị lớn nhất của nó với team: người mới clone repo, chạy `docker compose up` là có môi trường giống hệt — không cài PostgreSQL bản này bản kia, không "máy em chạy được". Production nhiều máy cần orchestrator (Kubernetes, ECS, Cloud Run…), nơi các khái niệm ở đây đổi tên nhưng giữ nguyên ý: healthcheck → readiness/liveness probe, volume → persistent volume hoặc DB được quản lý, `.env` → secret manager.
:::

:::version Lệnh và cú pháp
`docker compose` (v2+, hiện v5.x trong bài) hỗ trợ `depends_on.condition`, `develop.watch`, `profiles`, `include`. Tài liệu cũ dùng `docker-compose` và `version: "3"` — các khoá cơ bản vẫn giống nhau.
:::

:::interview Bạn chia sẻ môi trường phát triển (API + DB) cho cả team thế nào để ai cũng chạy được giống nhau?
Một `compose.yaml` trong repo mô tả API (build từ Dockerfile) và PostgreSQL ghim phiên bản (`postgres:16-alpine`), DB có healthcheck và API chờ DB healthy, dữ liệu mẫu nạp bằng script init hoặc migration + seed, cấu hình qua biến môi trường với `.env.example` liệt kê tên biến (file `.env` thật không commit). Kèm README một dòng: `cp .env.example .env && docker compose up -d --build`. Test tích hợp trong CI dùng cùng image PostgreSQL để môi trường CI giống local.
:::

:::quiz Bạn chạy `docker compose down -v` rồi `up -d`. Bảng `products` có gì?
- [ ] Dữ liệu cũ kèm sản phẩm vừa thêm
- [x] Chỉ 3 sản phẩm mẫu — volume mới trống nên `init.sql` chạy lại
- [ ] Bảng không tồn tại
- [ ] Lỗi vì volume đã xoá

Đã kiểm: tìm sản phẩm "Quạt" trả `data: []`, đếm trong DB được 3.
:::

:::quiz Trong compose ở trên, vì sao dịch vụ `db` không khai `ports`?
- [ ] Quên khai
- [x] API truy cập DB qua network nội bộ của compose bằng tên `db`; không mở cổng ra máy chủ thì DB không bị truy cập từ bên ngoài
- [ ] PostgreSQL không chạy được khi có `ports`
- [ ] Compose tự mở cổng 5432

`ports` chỉ cần khi một thứ **bên ngoài** compose phải kết nối vào.
:::

:::exercise Thêm Adminer và môi trường test
Mở rộng compose: (1) thêm dịch vụ `adminer` (giao diện web quản lý DB) chỉ chạy khi bật profile `tools`; (2) thêm dịch vụ `test` chạy `npm test` với một PostgreSQL **riêng** không dùng volume (dữ liệu mất sau mỗi lần chạy). Viết lệnh để chạy từng phần.
???
```yaml
services:
  # … db, api như trên …
  adminer:
    image: adminer
    profiles: [tools]
    ports: ["8080:8080"]
    depends_on: [db]

  db-test:
    image: postgres:16-alpine
    profiles: [test]
    environment:
      POSTGRES_DB: shop_test
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: test
    tmpfs:
      - /var/lib/postgresql/data          # dữ liệu trên RAM, mất khi dừng
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop -d shop_test"]
      interval: 2s
      retries: 20

  test:
    build:
      context: .
      target: deps                         # hoặc một stage riêng có devDependencies
    profiles: [test]
    command: npm test
    environment:
      DATABASE_URL: postgres://shop:test@db-test:5432/shop_test
    depends_on:
      db-test:
        condition: service_healthy
```

Lệnh: `docker compose --profile tools up -d` (mở http://localhost:8080, server `db`); `docker compose --profile test run --rm test` (chạy test rồi thoát). Lưu ý: stage `deps` trong Dockerfile ở bài trước cài `--omit=dev` nên không có vitest — cần thêm stage `test` cài đủ dependency và copy cả `test/`, hoặc mount source vào container test.
:::
