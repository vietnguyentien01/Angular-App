---
title: "Debug container — logs, exec, inspect, exit code và năm lỗi hay gặp"
summary: "Quy trình khi container không chạy hoặc không truy cập được: ps -a, logs, inspect exit code, exec vào xem. Năm tình huống đã tái hiện thật — app chỉ nghe 127.0.0.1, thiếu biến môi trường (exit 1), hết bộ nhớ (exit 137, OOMKilled), localhost sai chỗ, healthcheck báo unhealthy vì thứ tự route."
level: intermediate
version: 29
lastReviewed: 2026-11-13
tags: [docker, debugging, logs, troubleshooting]
related: [docker/review/basics/image-container-va-lenh-co-ban, docker/consolidate/dockerfile/dockerfile-cho-node-api]
---

## TL;DR

- Container "biến mất" → `docker ps -a` (gồm container đã dừng) → `docker logs <tên>` → `docker inspect` xem `ExitCode`, `OOMKilled`.
- Exit code: `0` thoát bình thường, `1` lỗi do app, `137` bị SIGKILL (thường do **hết bộ nhớ** hoặc `docker stop` quá thời gian chờ), `143` thoát sau SIGTERM.
- Truy cập từ máy không được → app trong container phải lắng nghe **`0.0.0.0`**, không phải `127.0.0.1`; kiểm `-p`.
- Vào bên trong để xem: `docker exec -it <tên> sh` → `env`, `ls`, `wget -qO- localhost:3000/health`.

## Quy trình

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker logs --tail 50 -f api                     # app in gì trước khi chết?
docker inspect api --format 'ExitCode={{.State.ExitCode}} OOMKilled={{.State.OOMKilled}}'
docker inspect api --format '{{json .Config.Env}}'    # biến môi trường thực tế (cẩn thận: có thể chứa secret)
docker exec -it api sh                           # nếu container còn chạy
docker stats --no-stream                         # CPU/RAM từng container
docker compose ps                                # (healthy) / (unhealthy) / Exited (1)
```

## Năm tình huống (đã tái hiện)

| Triệu chứng | Kiểm thấy | Nguyên nhân | Sửa |
|---|---|---|---|
| `curl localhost:3101` không kết nối được dù có `-p 3101:3000` | App chạy, log bình thường | App gọi `listen(3000, '127.0.0.1')` — chỉ nhận kết nối **trong** container | `listen(3000)` hoặc `'0.0.0.0'` |
| Container dừng ngay sau khi chạy | `Exited (1)`, log `Thiếu DATABASE_URL` | Thiếu biến môi trường | Truyền `-e`/`env_file`; app nên kiểm config và báo rõ khi khởi động |
| Container chết ngẫu nhiên khi tải cao | `ExitCode=137 OOMKilled=true` | Vượt giới hạn bộ nhớ (`-m 64m` trong thử nghiệm) | Tăng giới hạn, tìm rò rỉ, đặt `--max-old-space-size` cho Node thấp hơn giới hạn container |
| API log `ECONNREFUSED 127.0.0.1:5432` | API chạy, DB chạy | `DATABASE_URL` trỏ `localhost` | Dùng tên dịch vụ `db` |
| `docker compose ps` báo `(unhealthy)` dù API trả dữ liệu | `curl /health` → `404 NOT_FOUND` | Route `/health` gắn **sau** handler 404 của app | Đăng ký `/health` trước handler 404 (xem bài Dockerfile cho API) |

Tình huống cuối là lỗi thật gặp khi soạn bài: `server.js` thêm `app.get('/health')` sau khi `buildApp()` đã gắn handler 404 — mọi request tới `/health` rơi vào 404, healthcheck thất bại.

## Code: kiểm config sớm, báo rõ

```js bad
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });   // thiếu biến → lỗi mơ hồ ở request đầu tiên
```

```js good
if (!process.env.DATABASE_URL) {
  console.error('Thiếu DATABASE_URL');
  process.exit(1);          // container dừng ngay với exit 1 và log rõ ràng
}
```

Trong thử nghiệm, image API với `DATABASE_URL` rỗng **không** dừng — `pg.Pool` chỉ kết nối khi có truy vấn đầu tiên, nên lỗi chỉ lộ ra khi có request. Đó là lý do nên kiểm config lúc khởi động (bài *Cấu trúc dự án* của môn Node.js).

:::senior Góc nhìn senior
Log ra **stdout/stderr** (không ghi file trong container) để `docker logs` và hệ thống log thu được. Với production, trạng thái "đang chạy" chưa đủ — cần **healthcheck** thật (kiểm cả kết nối DB) để orchestrator biết khởi động lại hoặc ngừng gửi traffic. Và đặt giới hạn bộ nhớ cho mọi container: một container rò rỉ không được phép kéo sập cả máy.
:::

:::version Docker Desktop và Linux
Trên Linux, container chạy trực tiếp trên máy; trên macOS/Windows, Docker Desktop chạy một VM Linux — `host.docker.internal` trỏ về máy thật, và hiệu năng bind mount chậm hơn. Docker Desktop có tab Logs/Exec/Stats trong giao diện cho cùng các việc ở bài này.
:::

:::interview Container của bạn cứ khởi động lại liên tục trên server. Bạn điều tra thế nào?
Xem trạng thái và số lần restart (`docker ps -a`, `docker inspect` → `RestartCount`, `ExitCode`, `OOMKilled`); đọc log của lần chạy trước (`docker logs --tail 100`). Exit 137 + `OOMKilled=true` → thiếu bộ nhớ: xem `docker stats`, giới hạn `-m`, rò rỉ bộ nhớ trong app. Exit 1 → lỗi app: thường là thiếu biến môi trường, không kết nối được DB, cổng bị chiếm. Healthcheck thất bại → orchestrator giết container: gọi thử endpoint health từ trong container bằng `docker exec`. Nếu container chết quá nhanh để `exec`, chạy lại image với `--entrypoint sh` để vào xem.
:::

:::quiz `docker inspect` cho `ExitCode=137 OOMKilled=true`. Nguyên nhân?
- [ ] App gọi `process.exit(137)`
- [x] Container bị kernel giết vì vượt giới hạn bộ nhớ
- [ ] Sai cổng
- [ ] Thiếu biến môi trường

Đã tái hiện bằng `-m 64m` và một vòng lặp cấp phát bộ nhớ. 137 = 128 + 9 (SIGKILL).
:::

:::quiz App trong container gọi `listen(3000, '127.0.0.1')`, chạy với `-p 3101:3000`. `curl localhost:3101` từ máy của bạn?
- [ ] Trả `ok`
- [x] Không kết nối được — `127.0.0.1` trong container chỉ nhận kết nối từ chính container
- [ ] Trả 404
- [ ] Chỉ chạy được trên Windows

Đã chạy thử: bản lắng nghe mặc định (mọi interface) trả `ok`, bản `127.0.0.1` không kết nối được.
:::

:::exercise Ba container hỏng
Tự tạo và debug từng container sau, ghi lại lệnh bạn dùng để tìm ra nguyên nhân:
1. `docker run -d --name a -p 3201:3000 node:24-alpine node -e "require('http').createServer((q,r)=>r.end('ok')).listen(3000,'127.0.0.1')"`
2. `docker run -d --name b node:24-alpine node -e "if(!process.env.API_KEY){console.error('Thiếu API_KEY');process.exit(1)}"`
3. `docker run -d --name c -m 64m --memory-swap 64m node:24-alpine node -e "const a=[];setInterval(()=>a.push(Buffer.alloc(1e7,1)),50)"`
???
1. `curl localhost:3201` thất bại; `docker logs a` không có lỗi; `docker exec a wget -qO- localhost:3000` trả `ok` → app chạy nhưng chỉ nghe loopback của container. Sửa: `listen(3000)`.
2. `docker ps` không thấy → `docker ps -a` thấy `Exited (1)`; `docker logs b` → `Thiếu API_KEY`. Sửa: `-e API_KEY=…`.
3. Sau vài giây `docker ps -a` thấy `Exited (137)`; `docker inspect c --format '{{.State.OOMKilled}}'` → `true`. Sửa: tăng `-m` hoặc sửa rò rỉ bộ nhớ.

Dọn dẹp: `docker rm -f a b c`.
:::
