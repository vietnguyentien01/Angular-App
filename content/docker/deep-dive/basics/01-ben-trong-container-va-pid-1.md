---
title: "Bên trong container — namespaces, cgroups, layer overlay và vấn đề PID 1"
summary: "Container là tiến trình Linux được cô lập bằng namespaces và giới hạn bằng cgroups, chạy trên các layer chồng nhau. Số đo thật: node làm PID 1 không xử lý SIGTERM bị dừng sau 10,2 giây, thêm --init còn 0,15 giây; app tự xử lý SIGTERM 0,16 giây. Kèm cách Node nhìn thấy giới hạn bộ nhớ của container."
level: advanced
version: 29
lastReviewed: 2026-11-13
tags: [docker, linux, namespaces, cgroups, signals]
related: [docker/review/basics/image-container-va-lenh-co-ban, docker/consolidate/basics/debug-container]
---

## TL;DR

- **Namespaces** cô lập cái tiến trình *nhìn thấy*: PID (chỉ thấy tiến trình của mình, bắt đầu từ PID 1), network, mount, hostname, user. **cgroups** giới hạn cái nó *dùng được*: RAM, CPU, I/O.
- Image = các **layer chỉ đọc** chồng nhau (OverlayFS); container thêm một **layer ghi** mỏng. Nhiều container dùng chung layer của cùng image.
- Tiến trình **PID 1** được kernel đối xử đặc biệt: tín hiệu không có handler bị **bỏ qua** (kể cả SIGTERM). Node làm PID 1 mà không xử lý SIGTERM → `docker stop` chờ hết 10 giây rồi SIGKILL.
- Cách sửa: app tự xử lý `SIGTERM`, hoặc chạy với `--init` (tini làm PID 1, chuyển tín hiệu và dọn tiến trình zombie).

## PID 1 — số đo thật

```bash
docker run -d --name t1 node:24-alpine node -e "setInterval(()=>{},1000)"
docker exec t1 ps -o pid,args
#   PID COMMAND
#     1 node -e setInterval(()=>{},1000)        ← node chính là PID 1
docker stop t1      # 10155 ms: SIGTERM bị bỏ qua, hết thời gian chờ thì SIGKILL

docker run -d --init --name t2 node:24-alpine node -e "setInterval(()=>{},1000)"
docker stop t2      # 149 ms: tini (PID 1) chuyển SIGTERM tới node; node không có handler nên thoát theo mặc định
```

| Cách chạy | `docker stop` |
|---|---|
| `node` là PID 1, không có handler SIGTERM | ~10,2 s (bị SIGKILL, exit 137) |
| `--init` (hoặc `init: true` trong compose) | ~0,15 s |
| API có `process.on('SIGTERM', …)` đóng server và pool DB | ~0,16 s, exit 0, request đang chạy được hoàn thành |
| `CMD npm start` (dạng shell) | ~10,2 s — tín hiệu dừng ở shell/npm |

Vì sao `--init` mà vẫn nên tự xử lý SIGTERM: `--init` chỉ giúp tiến trình **thoát nhanh**; tự xử lý mới giúp **thoát đúng** — ngừng nhận request, chờ request dở, đóng kết nối DB (bài *Cấu trúc dự án* môn Node.js).

## Layer và copy-on-write

```bash
docker history product-api --format '{{.Size}}\t{{.CreatedBy}}'
# 0B      CMD ["node" "src/server.js"]
# 0B      HEALTHCHECK …
# 0B      USER node
# 28.7kB  COPY src ./src
# 12.3kB  COPY package.json ./
# …       COPY /app/node_modules ./node_modules
```

Lệnh chỉ đổi siêu dữ liệu (`CMD`, `USER`, `ENV`) có layer 0 B. Xoá file ở layer sau **không** làm image nhỏ đi — file vẫn nằm ở layer trước. Vì vậy `RUN apt-get install … && rm -rf /var/lib/apt/lists/*` phải nằm trong **cùng** một `RUN`, và secret không bao giờ được `COPY` vào rồi `rm` sau.

## cgroups và Node.js

```bash
docker run --rm -m 256m node:24-alpine node -e "…"
# heap limit MB 259          ← V8 đặt giới hạn heap theo bộ nhớ container
# os.totalmem MB 16086       ← nhưng os.totalmem() vẫn báo RAM của MÁY CHỦ
# constrainedMemory MB 256   ← process.constrainedMemory() đọc giới hạn cgroup
```

Node bản mới tự nhận giới hạn bộ nhớ của cgroup khi tính heap mặc định. Thư viện tự chia worker/cache theo `os.totalmem()` hay `os.cpus().length` có thể tính sai trong container — dùng `process.constrainedMemory()` và `os.availableParallelism()`, hoặc đặt rõ `--max-old-space-size` thấp hơn giới hạn container (chừa chỗ cho bộ nhớ ngoài heap như Buffer).

## Container và máy ảo

| | Container | VM |
|---|---|---|
| Kernel | Dùng chung với máy chủ | Riêng |
| Cô lập | Namespaces + cgroups (+ seccomp, capabilities) | Hypervisor |
| Khởi động | Mili giây | Giây đến phút |
| Rủi ro | Lỗ hổng kernel/thoát container ảnh hưởng máy chủ | Ranh giới mạnh hơn |

Vì dùng chung kernel, chạy container bằng `root` (UID 0 bên trong thường là UID 0 bên ngoài nếu không bật user namespace) là rủi ro thật — lý do bài Dockerfile luôn có `USER node`.

:::senior Góc nhìn senior
Hai dòng cấu hình nhỏ ngăn hai loại sự cố lớn: xử lý `SIGTERM` (deploy không cắt ngang request, không mất dữ liệu đang ghi) và giới hạn bộ nhớ khớp với `--max-old-space-size` (container bị OOM-kill có kiểm soát thay vì kéo sập máy chủ). Khi hệ thống chạy trên Kubernetes, cả hai còn quan trọng hơn: pod bị dừng thường xuyên khi scale và deploy, và `terminationGracePeriodSeconds` chỉ có ích nếu app thực sự lắng nghe SIGTERM.
:::

:::quiz Node chạy làm PID 1 trong container, không đăng ký `process.on('SIGTERM')`. `docker stop` mất bao lâu?
- [ ] Gần như tức thì — Node thoát mặc định khi nhận SIGTERM
- [x] Khoảng 10 giây — kernel bỏ qua tín hiệu không có handler gửi tới PID 1, Docker hết thời gian chờ rồi gửi SIGKILL
- [ ] Không bao giờ dừng
- [ ] Phụ thuộc kích thước image

Đã đo: 10.155 ms. Với `--init`: 149 ms.
:::

:::quiz Dockerfile có `COPY secret.json /app/` rồi một lệnh sau đó `RUN rm /app/secret.json`. Image cuối có còn secret không?
- [ ] Không, đã xoá
- [x] Còn — file nằm trong layer của lệnh `COPY`; layer sau chỉ đánh dấu xoá
- [ ] Chỉ còn nếu dùng alpine
- [ ] Docker tự lọc file tên secret

Dùng `RUN --mount=type=secret` để file chỉ tồn tại trong lúc chạy lệnh đó.
:::

:::exercise Đo và sửa thời gian dừng của ba image
Build ba biến thể từ cùng một app Express nhỏ: (A) `CMD npm start`; (B) `CMD ["node", "server.js"]` không có handler SIGTERM; (C) như B nhưng thêm handler gọi `server.close()`. Với mỗi biến thể, đo `docker stop` và exit code; sau đó chạy B với `--init` và đo lại. Ghi kết quả vào bảng và giải thích từng dòng.
???
Kết quả mong đợi (khớp với số đo ở trên): (A) ~10 s, exit 137 — SIGTERM tới `sh`/`npm` là PID 1; npm có thể không chuyển tiếp đúng tới node, hết thời gian chờ bị SIGKILL. (B) ~10 s, exit 137 — node là PID 1 không có handler, kernel bỏ qua SIGTERM. (C) dưới 1 s, exit 0 — handler đóng server rồi `process.exit(0)`. (B + `--init`) dưới 1 s, exit 143 (128 + 15) — tini chuyển SIGTERM, node thoát theo hành vi mặc định của tín hiệu.

Đo bằng: `t=$(date +%s%N); docker stop x; echo $(( ($(date +%s%N)-t)/1000000 ))ms; docker inspect x -f '{{.State.ExitCode}}'`. Thử thêm: gửi request chậm (`/slow` chờ 3 s) ngay trước khi stop — chỉ (C) trả kết quả cho request đó; các biến thể khác cắt ngang kết nối.
:::
