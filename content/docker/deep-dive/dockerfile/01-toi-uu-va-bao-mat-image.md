---
title: "Tối ưu và bảo mật image — chọn image gốc, distroless, cache mount, chạy read-only, quét lỗ hổng"
summary: "So sánh kích thước đo thật của image gốc (node:24 1,65 GB, slim 333 MB, alpine 244 MB, distroless 203 MB), build API trên distroless nonroot (219 MB, không có shell, UID 65532), chạy với --read-only và --cap-drop ALL vẫn phục vụ được request, cache mount cho npm, quét lỗ hổng và build đa kiến trúc."
level: advanced
version: 29
lastReviewed: 2026-11-13
tags: [docker, security, distroless, image-size, supply-chain]
related: [docker/consolidate/dockerfile/dockerfile-cho-node-api, docker/deep-dive/basics/ben-trong-container-va-pid-1]
---

## TL;DR

- Ít thứ trong image = ít thứ để tấn công và ít thứ phải vá. Thứ tự lựa chọn hay gặp: `alpine`/`slim` → **distroless** khi team đã quen debug không cần shell.
- Chạy với **user không phải root**, filesystem **chỉ đọc** (`--read-only`), **bỏ mọi capability** (`--cap-drop ALL`), `no-new-privileges`.
- `RUN --mount=type=cache,target=/root/.npm` giữ cache npm giữa các lần build mà không đưa vào image.
- Quét image trong CI (Trivy, Docker Scout, Grype); cập nhật image gốc định kỳ; ghim theo digest khi cần build tái lập.

## Image gốc (đo trên máy soạn bài)

| Image gốc | Kích thước | Có shell/package manager | Ghi chú |
|---|---|---|---|
| `node:24` | 1,65 GB | Có (Debian đầy đủ, có cả trình biên dịch) | Tiện cho stage build cần compile gói native |
| `node:24-slim` | 333 MB | Có (Debian rút gọn) | Tương thích glibc, an toàn khi gói native kén |
| `node:24-alpine` | 244 MB | Có (`sh`, `apk`) | musl libc; vài gói native cần build lại |
| `gcr.io/distroless/nodejs24-debian12` | 203 MB | **Không** | Chỉ có Node và thư viện cần thiết; tag `:nonroot` chạy UID 65532 |

## API trên distroless (đã build và chạy)

```dockerfile title="Dockerfile.distroless"
# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM gcr.io/distroless/nodejs24-debian12:nonroot
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
EXPOSE 3000
CMD ["src/server.js"]          # ENTRYPOINT của image đã là node
```

| Kiểm | Kết quả |
|---|---|
| Kích thước | 219 MB (bản alpine ở bài Củng cố: 260 MB) |
| `docker run --rm --entrypoint sh …` | Lỗi — không có shell để kẻ tấn công (hoặc bạn) dùng |
| UID của tiến trình | `65532` (nonroot) |
| Chạy với `--read-only --cap-drop ALL --security-opt no-new-privileges` | `/health` → `{"status":"ok"}`, `/api/products` trả dữ liệu bình thường |

Hệ quả của "không có shell": `HEALTHCHECK … wget …` không dùng được (không có `wget`) — đặt healthcheck ở orchestrator (Kubernetes probe gọi HTTP trực tiếp) hoặc viết healthcheck bằng chính `node -e`. Debug: `docker debug` (Docker Desktop) hoặc tạm dùng biến thể `:debug` của distroless có busybox.

App cần ghi file tạm khi chạy `--read-only`: mount một thư mục tạm riêng `--tmpfs /tmp`.

## Cache mount và thứ tự layer

```dockerfile
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
```

Khác với cache **layer** (chỉ dùng lại khi lockfile không đổi), cache **mount** giữ thư mục tải về của npm qua mọi lần build — lockfile đổi một gói thì npm chỉ tải gói đó. Thư mục cache không nằm trong image. Ở GitHub Actions, kết hợp với `cache-from/to: type=gha` (bài CI).

## Quét lỗ hổng và chuỗi cung ứng

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --severity HIGH,CRITICAL product-api
docker scout cves product-api          # Docker Desktop / Docker Scout CLI
```

Tự chạy: kết quả liệt kê CVE theo gói (của hệ điều hành và của `node_modules`), phiên bản đã vá; image `node:24` đầy đủ thường có nhiều CVE hơn hẳn alpine/distroless vì chứa nhiều gói hơn.

- **Ghim theo digest** để build tái lập: `FROM node:24-alpine@sha256:…` (Dependabot/Renovate cập nhật digest).
- **SBOM và provenance**: `docker buildx build --sbom=true --provenance=true` đính kèm danh sách thành phần và nguồn gốc build vào image.
- **Đa kiến trúc** (máy dev Apple Silicon, server ARM giá rẻ): `docker buildx build --platform linux/amd64,linux/arm64 -t … --push .`

:::senior Góc nhìn senior
Bảo mật image là việc **liên tục**, không phải một lần: image hôm nay sạch, tháng sau đã có CVE mới trong OpenSSL hay glibc. Quy trình cần ba thứ: rebuild định kỳ (kể cả khi code không đổi) để lấy bản vá của image gốc, quét trong CI có ngưỡng chặn rõ ràng, và một người/nhóm chịu trách nhiệm xử lý kết quả quét. Distroless giảm mạnh số CVE nhưng đổi lấy độ khó debug — quyết định cùng team vận hành, đừng áp đặt một mình.
:::

:::quiz Image distroless không có shell. Điều nào sau đây **không** còn dùng được như bình thường?
- [ ] `CMD ["src/server.js"]`
- [x] `HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1`
- [ ] Biến môi trường
- [ ] Map cổng `-p`

Không có `sh` và `wget`. Dùng probe HTTP của orchestrator hoặc healthcheck viết bằng `node`.
:::

:::quiz Chạy container với `--read-only`. App cần ghi file upload tạm vào `/tmp`. Cách đúng?
- [ ] Bỏ `--read-only`
- [x] Thêm `--tmpfs /tmp` (hoặc mount một volume riêng cho thư mục cần ghi)
- [ ] Chạy bằng root
- [ ] `chmod 777 /`

Chỉ mở đúng thư mục cần ghi; phần còn lại của filesystem giữ chỉ đọc.
:::

:::exercise Làm cứng compose của API
Sửa dịch vụ `api` trong `compose.yaml` của bài Củng cố để: chạy filesystem chỉ đọc nhưng vẫn ghi được `/tmp`; bỏ mọi capability; cấm leo thang đặc quyền; giới hạn 512 MB RAM và 1 CPU; Node dùng tối đa 384 MB heap; tự khởi động lại khi chết trừ khi bạn dừng tay. Kiểm bằng `docker compose up` và một request.
???
```yaml
  api:
    build: .
    read_only: true
    tmpfs:
      - /tmp
    cap_drop: [ALL]
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          memory: 512m
          cpus: "1.0"
    environment:
      DATABASE_URL: postgres://shop:${DB_PASSWORD:-devpassword}@db:5432/shop
      NODE_OPTIONS: --max-old-space-size=384
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
```

Kiểm: `docker compose up -d --build`, `curl localhost:3000/health`, `docker compose exec api sh -c 'touch /app/x'` phải báo `Read-only file system` còn `touch /tmp/x` thì được (image alpine có shell); `docker stats --no-stream` thấy giới hạn 512MiB. `--max-old-space-size` thấp hơn giới hạn container để chừa chỗ cho bộ nhớ ngoài heap (Buffer, native).
:::
