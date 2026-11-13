---
title: "Docker Compose — chạy API và PostgreSQL bằng một lệnh"
summary: "compose.yaml mô tả nhiều dịch vụ, mạng chung (gọi nhau bằng tên dịch vụ), volume giữ dữ liệu, healthcheck và depends_on với condition service_healthy. Nhắc nhanh up/down/logs/exec và khác biệt giữa down với down -v — đã kiểm: dữ liệu còn sau down, mất sau down -v."
type: card
level: core
version: 29
lastReviewed: 2026-11-13
tags: [docker, compose, postgresql, volume]
related: [docker/consolidate/compose/compose-api-va-postgres, docker/deep-dive/compose/moi-truong-dev-test-prod]
---

## TL;DR

- Compose tạo **một network** cho các dịch vụ trong file; dịch vụ gọi nhau bằng **tên** (`db`, `api`).
- `depends_on` chỉ chờ container **khởi động**; muốn chờ DB **sẵn sàng** thì thêm `healthcheck` cho DB và `condition: service_healthy`.
- Volume có tên (`db-data`) giữ dữ liệu qua `docker compose down`; `down -v` **xoá** volume.
- Không ghi mật khẩu thật vào `compose.yaml`: dùng biến `${DB_PASSWORD}` lấy từ file `.env` (không commit).

## compose.yaml

```yaml title="compose.yaml"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: shop
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: ${DB_PASSWORD:-devpassword}
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro   # chạy lần đầu khi volume còn trống
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop -d shop"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build: .
    environment:
      DATABASE_URL: postgres://shop:${DB_PASSWORD:-devpassword}@db:5432/shop
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy

volumes:
  db-data:
```

## Lệnh

```bash
docker compose up -d --build     # build (nếu cần) và chạy nền
docker compose ps                # trạng thái, kèm (healthy)/(unhealthy)
docker compose logs -f api       # log của một dịch vụ
docker compose exec db psql -U shop -d shop
docker compose down              # dừng và xoá container + network, GIỮ volume
docker compose down -v           # xoá cả volume — mất dữ liệu DB
```

## Bảng chọn nhanh

| Muốn | Trong compose.yaml |
|---|---|
| Dịch vụ gọi nhau | Dùng tên dịch vụ làm host: `db:5432` |
| Chờ DB sẵn sàng | `healthcheck` ở `db` + `depends_on.db.condition: service_healthy` |
| Giữ dữ liệu | `volumes: - db-data:/var/lib/postgresql/data` + khai báo `volumes:` cấp cao nhất |
| Nạp dữ liệu mẫu lần đầu | Mount `.sql` vào `/docker-entrypoint-initdb.d/` |
| Secret/mật khẩu | `${BIEN}` lấy từ `.env` hoặc biến shell; có giá trị mặc định cho dev `${BIEN:-dev}` |
| Mở cổng ra máy | `ports: - "3000:3000"`; DB chỉ cho nội bộ thì **không** khai `ports` |

## Lỗi hay gặp: đổi init.sql mà dữ liệu không đổi

Script trong `/docker-entrypoint-initdb.d/` chỉ chạy khi **thư mục dữ liệu trống** (lần đầu tạo volume). Sửa `init.sql` rồi `up` lại sẽ không có tác dụng — phải `docker compose down -v` (mất dữ liệu) hoặc viết migration.

:::version compose.yaml và version
Tên file khuyến nghị là `compose.yaml` (vẫn nhận `docker-compose.yml`). Trường `version: "3.8"` ở đầu file đã lỗi thời và bị bỏ qua — gặp trong dự án cũ thì xoá đi được.
:::

:::interview depends_on có đảm bảo database sẵn sàng trước khi API khởi động không?
Mặc định không: `depends_on` chỉ đảm bảo container DB được **khởi động** trước, mà PostgreSQL cần vài giây nữa mới nhận kết nối. Cần `healthcheck` (vd `pg_isready`) trên dịch vụ DB và `depends_on: db: condition: service_healthy` ở API. Dù vậy, app vẫn nên **tự thử lại** kết nối, vì DB có thể khởi động lại giữa chừng — trên Kubernetes cũng không có `depends_on`.
:::

:::quiz Chạy `docker compose down` rồi `docker compose up -d`. Sản phẩm bạn vừa thêm qua API còn không?
- [x] Còn — `down` xoá container và network nhưng giữ volume có tên
- [ ] Mất — `down` xoá mọi thứ
- [ ] Chỉ còn nếu dùng `--build`
- [ ] Tuỳ hệ điều hành

Đã kiểm: còn sau `down`, mất sau `down -v`.
:::

:::quiz Trong compose, API kết nối DB bằng host nào?
- [ ] `localhost`
- [ ] `127.0.0.1`
- [x] `db` — tên dịch vụ trong compose.yaml
- [ ] IP của máy chủ

Compose đăng ký tên dịch vụ vào DNS của network chung.
:::

:::quiz Bạn sửa `db/init.sql` thêm một bảng rồi chạy `docker compose up -d`. Bảng mới không xuất hiện. Vì sao?
- [ ] Sai cú pháp SQL
- [x] Script khởi tạo chỉ chạy khi volume dữ liệu còn trống (lần đầu)
- [ ] Phải dùng `--build`
- [ ] PostgreSQL không đọc file .sql

Dùng migration cho thay đổi schema; `down -v` chỉ dành cho môi trường dev có thể xoá dữ liệu.
:::
