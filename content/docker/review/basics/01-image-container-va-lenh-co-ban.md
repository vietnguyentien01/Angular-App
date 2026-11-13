---
title: "Image, container và các lệnh docker hằng ngày"
summary: "Image là khuôn chỉ đọc gồm nhiều layer, container là một tiến trình chạy từ image đó với lớp ghi riêng. Nhắc nhanh run/ps/logs/exec/stop, map cổng, biến môi trường, volume, và bẫy localhost bên trong container — kèm kết quả chạy thật trên Docker 29."
type: card
level: core
version: 29
lastReviewed: 2026-11-13
tags: [docker, container, image, cli]
related: [docker/consolidate/basics/debug-container, docker/deep-dive/basics/ben-trong-container-va-pid-1]
---

## TL;DR

- **Image**: gói chỉ đọc (hệ điều hành tối thiểu + runtime + code), xếp thành các **layer**. **Container**: một tiến trình chạy từ image, có lớp ghi riêng — xoá container là mất lớp ghi đó.
- Container **không** phải máy ảo: dùng chung kernel với máy chủ, khởi động trong mili giây.
- Dữ liệu cần giữ (database) → **volume**. Cấu hình → **biến môi trường**. Truy cập từ ngoài → **map cổng** `-p máy:container`.
- Bên trong container, `localhost` là **chính container đó**, không phải máy của bạn.

## Lệnh hằng ngày

```bash
docker run --rm -it node:24-alpine node -v          # chạy một lệnh rồi xoá container
docker run -d --name pg -e POSTGRES_PASSWORD=pw \
  -p 5432:5432 -v pgdata:/var/lib/postgresql/data postgres:16-alpine   # chạy nền
docker ps                                           # container đang chạy (-a: cả đã dừng)
docker logs -f pg                                   # xem log (stdout/stderr)
docker exec -it pg psql -U postgres                 # chạy lệnh trong container đang chạy
docker stop pg && docker rm pg                      # dừng (SIGTERM, chờ 10s rồi SIGKILL) và xoá
docker images                                       # image trên máy
docker system df                                    # dung lượng image/container/volume
```

## Bảng chọn nhanh

| Muốn | Dùng |
|---|---|
| Truyền cấu hình | `-e KEY=value` hoặc `--env-file .env` |
| Mở cổng ra máy | `-p 3000:3000` (máy:container) |
| Giữ dữ liệu khi xoá container | Volume có tên: `-v pgdata:/var/lib/postgresql/data` |
| Sửa code trên máy, container thấy ngay (dev) | Bind mount: `-v "$PWD":/app` |
| Vào xem bên trong | `docker exec -it <tên> sh` |
| Tự xoá khi chạy xong | `--rm` |
| Xử lý tín hiệu đúng cho tiến trình chính | `--init` (bài Chuyên sâu) |

## Lỗi hay gặp: `localhost` trong container

```bash
docker run --rm node:24-alpine node -e \
  "require('net').connect(5432,'localhost').on('error',e=>console.log(e.code))"
# ECONNREFUSED — PostgreSQL chạy trên máy bạn (hoặc container khác), không phải trong container này
```

Cách đúng: container nối với nhau qua **tên dịch vụ** trong cùng network (compose: `postgres://…@db:5432/shop`); muốn gọi dịch vụ trên máy chủ từ Docker Desktop: `host.docker.internal`.

:::version Docker Engine 29, Compose v2+
Lệnh compose hiện là `docker compose` (plugin, có khoảng trắng); `docker-compose` (Python, có gạch nối) là bản cũ đã ngừng phát triển. Image `node:24-alpine`/`node:26-alpine` theo các bản Node LTS; tránh tag `latest` trong dự án thật vì nó đổi theo thời gian.
:::

:::interview Container khác máy ảo (VM) thế nào?
VM ảo hoá phần cứng: mỗi VM có kernel và hệ điều hành riêng, nặng (GB), khởi động chậm (phút). Container chỉ cô lập **tiến trình** bằng tính năng của kernel Linux (namespaces cho cô lập, cgroups cho giới hạn tài nguyên) và dùng chung kernel máy chủ — nhẹ (MB), khởi động nhanh, đóng gói ứng dụng cùng phụ thuộc để chạy giống nhau ở mọi nơi. Đổi lại, cô lập yếu hơn VM; trên macOS/Windows, Docker Desktop thực ra chạy một VM Linux nhỏ để có kernel Linux.
:::

:::quiz API chạy trong container cấu hình `DATABASE_URL=postgres://…@localhost:5432/shop`, PostgreSQL chạy trong một container khác của cùng compose. Kết quả?
- [ ] Kết nối được vì cùng máy
- [x] `ECONNREFUSED` — `localhost` là chính container API; phải dùng tên dịch vụ, vd `@db:5432`
- [ ] Docker tự chuyển hướng
- [ ] Chỉ lỗi trên Windows

Đã chạy thử: `ECONNREFUSED`.
:::

:::quiz Bạn `docker rm` container PostgreSQL chạy **không** có volume rồi chạy lại. Dữ liệu cũ?
- [ ] Còn nguyên
- [x] Mất — dữ liệu nằm trong lớp ghi của container đã xoá
- [ ] Còn nếu dùng `--rm`
- [ ] Còn trong image

Dữ liệu cần giữ phải ở volume (hoặc bind mount).
:::

:::quiz `-p 8080:3000` nghĩa là gì?
- [ ] Container lắng nghe 8080, máy dùng 3000
- [x] Cổng 8080 trên máy chủ chuyển vào cổng 3000 trong container
- [ ] Mở cả 8080 và 3000 trong container
- [ ] Giới hạn băng thông

Thứ tự luôn là `máy:container`. App trong container phải lắng nghe `0.0.0.0` (hoặc mọi interface), không chỉ `127.0.0.1`.
:::
