---
title: "Một bộ compose cho nhiều môi trường — override, file prod, profile, watch và biến bắt buộc"
summary: "compose.override.yaml được gộp tự động cho môi trường dev (bind mount source, node --watch, mở cổng DB), file prod chọn bằng -f dùng image đã build theo tag, biến bắt buộc ${IMAGE_TAG:?…} chặn deploy thiếu cấu hình, profile cho công cụ phụ, develop.watch — đã kiểm bằng docker compose config."
level: advanced
version: 29
lastReviewed: 2026-11-13
tags: [docker, compose, environments, devops]
related: [docker/consolidate/compose/compose-api-va-postgres, docker/deep-dive/cicd/chien-luoc-deploy]
---

## TL;DR

- `compose.yaml`: phần **chung** mọi môi trường. `compose.override.yaml`: tự động gộp khi chạy `docker compose up` — dành cho **dev**.
- Môi trường khác: chỉ định rõ file, `docker compose -f compose.yaml -f compose.prod.yaml up -d` (khi có `-f`, override **không** tự gộp).
- Biến bắt buộc: `${IMAGE_TAG:?Cần IMAGE_TAG}` → thiếu biến là `compose` dừng với thông báo của bạn, không chạy với giá trị rỗng.
- Dev: bind mount source + `node --watch`, hoặc `develop.watch` của compose. Prod: **image đã build theo tag**, không build tại chỗ, không mount source.

## Ba file

```yaml title="compose.yaml — chung"
services:
  db:
    image: postgres:16-alpine
    # … environment, volumes, healthcheck như bài Củng cố …
  api:
    build: .
    environment:
      DATABASE_URL: postgres://shop:${DB_PASSWORD:-devpassword}@db:5432/shop
    ports: ["3000:3000"]
    depends_on:
      db: { condition: service_healthy }
volumes:
  db-data:
```

```yaml title="compose.override.yaml — dev, tự gộp"
services:
  api:
    command: ["node", "--watch", "src/server.js"]    # khởi động lại khi file đổi
    environment:
      LOG_LEVEL: debug
    volumes:
      - ./src:/app/src:ro                             # sửa code trên máy, container thấy ngay
  db:
    ports:
      - "5432:5432"                                   # mở DB cho DBeaver/psql — chỉ ở dev
```

```yaml title="compose.prod.yaml — chọn bằng -f"
services:
  api:
    image: ghcr.io/example/product-api:${IMAGE_TAG:?Cần IMAGE_TAG}
    restart: unless-stopped
```

## Kiểm bằng `docker compose config`

`docker compose config` in ra cấu hình **sau khi gộp** — luôn chạy nó khi sửa file compose.

| Lệnh | Kết quả đã thấy |
|---|---|
| `docker compose config` (có override) | `api` có `command: node --watch …`, `LOG_LEVEL: debug`, mount `/app/src`; `db` có cổng `5432` |
| `docker compose -f compose.yaml -f compose.prod.yaml config` (thiếu biến) | `error while interpolating services.api.image: required variable IMAGE_TAG is missing a value: Cần IMAGE_TAG` |
| `IMAGE_TAG=3f2c1a9 docker compose -f compose.yaml -f compose.prod.yaml config` | `image: ghcr.io/example/product-api:3f2c1a9`, **không** có `LOG_LEVEL`/`--watch` (override không gộp khi có `-f`) |

Quy tắc gộp: giá trị đơn (`image`, `command`) bị **thay**; `environment`, `ports`, `volumes` được **cộng/ghép** theo khoá.

## Profile và watch

```yaml
services:
  adminer:
    image: adminer
    profiles: [tools]            # chỉ chạy với --profile tools
  api:
    develop:
      watch:
        - action: sync           # đồng bộ file vào container, không build lại
          path: ./src
          target: /app/src
        - action: rebuild        # đổi dependency → build lại image
          path: package-lock.json
```

`docker compose watch` dùng khối `develop.watch` — thay cho bind mount khi bind mount chậm (macOS/Windows) hoặc khi cần build lại tự động lúc đổi lockfile.

## Biến môi trường: thứ tự ưu tiên

Giá trị trong `compose.yaml` kiểu `${BIEN}` được lấy từ: biến của **shell** đang chạy lệnh → file **`.env`** cạnh `compose.yaml` (hoặc `--env-file`). Khác với `env_file:` trong một service — thứ đó đưa biến **vào container**. Hai cơ chế hay bị nhầm:

| Viết | Tác dụng |
|---|---|
| `.env` cạnh compose.yaml | Điền giá trị cho `${…}` **trong file compose** |
| `env_file: [api.env]` trong service | Nạp biến vào **môi trường của container** |
| `environment:` trong service | Đặt biến cho container (ghi đè `env_file`) |

:::senior Góc nhìn senior
Giữ khác biệt giữa các môi trường **ít và rõ**: cùng image, cùng compose gốc, chỉ khác biến môi trường và vài khoá như `image`/`restart`. Mỗi khác biệt là một chỗ "dev chạy, prod lỗi". Compose đủ tốt cho dev, CI và server một máy; khi cần nhiều máy, rolling update, autoscale thì chuyển sang orchestrator — nhưng cấu trúc "image theo tag + cấu hình qua biến" giữ nguyên.
:::

:::quiz Bạn chạy `docker compose -f compose.yaml up -d`. File `compose.override.yaml` có được gộp không?
- [ ] Có, luôn luôn
- [x] Không — khi chỉ định `-f`, compose chỉ dùng đúng các file đó
- [ ] Chỉ gộp phần `environment`
- [ ] Lỗi vì trùng tên dịch vụ

Đã kiểm bằng `config`: bản prod không có `LOG_LEVEL` và `--watch` của override.
:::

:::quiz Vì sao dùng `${IMAGE_TAG:?Cần IMAGE_TAG}` thay vì `${IMAGE_TAG}`?
- [ ] Để có giá trị mặc định
- [x] Thiếu biến thì compose dừng với thông báo lỗi, thay vì âm thầm dùng chuỗi rỗng (ra image `…:` sai hoặc `latest`)
- [ ] Để mã hoá biến
- [ ] Bắt buộc với registry GHCR

`${BIEN:-mac_dinh}` là có giá trị mặc định; `${BIEN:?thông báo}` là bắt buộc.
:::

:::exercise Thiết lập dev / CI / prod cho API
Viết `compose.override.yaml` (dev: hot reload, mở cổng DB, Adminer qua profile), `compose.ci.yaml` (test: DB trên tmpfs, chạy test rồi thoát với exit code của test), `compose.prod.yaml` (image theo tag bắt buộc, restart, giới hạn tài nguyên, không mở cổng DB). Viết ba lệnh tương ứng và cách kiểm từng cấu hình bằng `docker compose config`.
???
Lệnh: dev `docker compose up -d` (tự gộp override), CI `docker compose -f compose.yaml -f compose.ci.yaml run --rm --build test` (exit code của `run` là exit code của lệnh test — CI fail theo), prod `IMAGE_TAG=<sha> docker compose -f compose.yaml -f compose.prod.yaml up -d`.

```yaml
# compose.ci.yaml
services:
  db:
    tmpfs: [/var/lib/postgresql/data]
    volumes: !reset []                 # bỏ volume db-data kế thừa từ compose.yaml (Compose 2.24+)
  test:
    build: { context: ., target: test }   # stage có devDependencies + thư mục test
    command: npm test
    environment:
      DATABASE_URL: postgres://shop:devpassword@db:5432/shop
    depends_on:
      db: { condition: service_healthy }
```

```yaml
# compose.prod.yaml
services:
  api:
    image: ghcr.io/<owner>/product-api:${IMAGE_TAG:?Cần IMAGE_TAG}
    restart: unless-stopped
    deploy:
      resources:
        limits: { memory: 512m, cpus: "1.0" }
  db:
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD:?Cần DB_PASSWORD}
```

Kiểm: `config` của dev có `5432:5432` và profile `tools`; của CI có `tmpfs` và không có `db-data`; của prod báo lỗi khi thiếu `IMAGE_TAG`/`DB_PASSWORD` và không có cổng DB. Thẻ `!reset` (và `!override`) dùng để xoá/thay hẳn giá trị kế thừa thay vì ghép.
:::
