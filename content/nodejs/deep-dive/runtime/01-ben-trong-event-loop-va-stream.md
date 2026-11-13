---
title: Bên trong Node.js — các pha của event loop, thread pool của libuv, stream và worker_threads
summary: "Các pha timers/poll/check, việc nào chạy trên thread pool (fs, crypto, dns.lookup, zlib) và giới hạn 4 luồng mặc định, stream với backpressure qua pipeline để xử lý file lớn không tốn RAM, và khi nào cần worker_threads hay tách job queue."
level: advanced
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, event-loop, libuv, streams, worker-threads]
related: [nodejs/review/runtime/event-loop-va-async, nodejs/consolidate/runtime/doan-thu-tu-va-loi-async]
---

## TL;DR

- Event loop của libuv đi qua các pha: **timers → pending callbacks → poll (I/O) → check (`setImmediate`) → close callbacks**; giữa mỗi callback, Node xả microtask.
- I/O mạng dùng cơ chế của hệ điều hành (epoll/kqueue/IOCP) — không tốn luồng. Còn **fs, crypto nặng (`pbkdf2`, `scrypt`), `dns.lookup`, zlib** chạy trên **thread pool** của libuv, mặc định **4 luồng** (`UV_THREADPOOL_SIZE`).
- File/response lớn → **stream** + `pipeline` (tự xử lý backpressure và dọn dẹp khi lỗi); đừng `readFile` cả file 2 GB.
- JavaScript nặng CPU → **`worker_threads`** (cùng process, luồng riêng) hoặc **job queue** (process riêng, chịu lỗi tốt hơn).

## Cơ chế bên trong

```text
   ┌─► timers          (setTimeout/setInterval đến hạn)
   │   pending callbacks
   │   poll            (chờ và chạy callback I/O; nếu rảnh có thể chờ ở đây)
   │   check           (setImmediate)
   └── close callbacks (socket.on('close'))
         ▲ giữa mỗi callback: process.nextTick queue → Promise microtasks
```

Thread pool giải thích một hiện tượng hay gặp: 6 lệnh `crypto.pbkdf2` cùng lúc thì 4 lệnh chạy trước, 2 lệnh phải chờ một luồng rảnh. Đặt `UV_THREADPOOL_SIZE=8` (trước khi process khởi động, tối đa 1024) giúp khi server làm nhiều hash/nén/đọc file, nhưng không vượt quá số lõi CPU thật.

## Stream và backpressure

```js title="export-csv.js — nén file CSV 200.000 dòng, bộ nhớ ổn định (đã chạy thử)"
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { createGzip } from 'node:zlib';

const upper = new Transform({
  transform(chunk, _enc, cb) { cb(null, chunk.toString().toUpperCase()); },
});
await pipeline(createReadStream('big.csv'), upper, createGzip(), createWriteStream('big.csv.gz'));
```

**Backpressure**: khi bên ghi chậm (đĩa, client mạng yếu), `write()` trả `false`; `pipeline` tự tạm dừng bên đọc tới khi bên ghi rảnh (`drain`). Tự nối `.on('data', d => out.write(d))` mà bỏ qua giá trị trả về là cách làm RAM phình to.

Trong Express, trả file lớn: `pipeline(createReadStream(path), res)` hoặc `res.sendFile` / `res.download`.

## worker_threads cho việc nặng CPU

```js title="hash-worker.js (một file vừa là main vừa là worker — đã chạy thử)"
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';

if (isMainThread) {
  const w = new Worker(new URL(import.meta.url), { workerData: 300_000 });
  w.once('message', (h) => console.log('xong', h));   // trong lúc đó timer ở main vẫn chạy đều
} else {
  let h = 'x';
  for (let i = 0; i < workerData; i++) h = createHash('sha256').update(h).digest('hex');
  parentPort.postMessage(h);
}
```

## So sánh phương án cho việc nặng

| Phương án | Ưu | Nhược | Hợp với |
|---|---|---|---|
| Làm ngay trong request | Đơn giản | Chặn mọi request khác | Việc < vài ms |
| `worker_threads` (pool, vd Piscina) | Không chặn event loop, chia sẻ bộ nhớ được | Vẫn chung process: crash/hết RAM ảnh hưởng server | Resize ảnh, parse file lớn, tính toán |
| Job queue (BullMQ + Redis) + worker process | Retry, lập lịch, scale riêng, server trả lời ngay | Thêm hạ tầng | Gửi email hàng loạt, xuất báo cáo, đồng bộ dữ liệu |
| `cluster` / nhiều container | Dùng hết các lõi cho **nhiều request** | Không làm **một** việc nhanh hơn | Tăng thông lượng HTTP |

:::senior Góc nhìn senior
Đo trước khi tối ưu: `node --cpu-prof`, `clinic doctor`, hoặc metric **event loop lag/utilization** (`perf_hooks.monitorEventLoopDelay`, `performance.eventLoopUtilization()`). Một API p99 chậm thường do (1) một đoạn đồng bộ nặng (JSON.parse/stringify payload lớn, regex thảm hoạ), (2) thread pool bị nghẽn bởi bcrypt/fs, hoặc (3) DB — không phải do "Node đơn luồng". Trên Kubernetes/Docker, chạy một process mỗi container và scale bằng số replica thay cho `cluster`.
:::

:::quiz Server xử lý login bằng `bcrypt` (bản native, chạy trên thread pool) và cùng lúc đọc nhiều file bằng `fs`. Đột nhiên đọc file chậm hẳn giờ cao điểm. Giải thích hợp lý nhất?
- [ ] Event loop bị chặn bởi bcrypt
- [x] bcrypt và fs dùng chung thread pool (mặc định 4 luồng) — hash chiếm hết luồng, fs phải xếp hàng
- [ ] Ổ cứng hỏng
- [ ] Node giới hạn 4 file mở cùng lúc

Tăng `UV_THREADPOOL_SIZE` hợp lý, giảm cost bcrypt quá cao, hoặc tách service xác thực.
:::

:::quiz Vì sao dùng `pipeline(read, transform, write)` thay vì `read.on('data', c => write.write(c))`?
- [ ] Nhanh hơn 10 lần
- [x] `pipeline` tôn trọng backpressure và tự huỷ/dọn mọi stream khi một bước lỗi; cách tự nối bỏ qua `write()` trả `false` nên dữ liệu dồn vào RAM
- [ ] `on('data')` không còn được hỗ trợ
- [ ] `pipeline` chạy trên thread pool

Lỗi giữa chừng với cách tự nối còn để lại file dở dang và file descriptor không đóng.
:::

:::exercise Endpoint xuất 1 triệu đơn hàng ra CSV
Viết `GET /api/reports/orders.csv` stream dữ liệu từ PostgreSQL ra client: không nạp hết vào RAM, header `Content-Type: text/csv; charset=utf-8` và `Content-Disposition: attachment`, client ngắt kết nối giữa chừng thì dừng truy vấn. Gợi ý thư viện `pg-query-stream`.
???
```js
import QueryStream from 'pg-query-stream';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

app.get('/api/reports/orders.csv', requireAuth, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const rows = client.query(new QueryStream(
      'SELECT id, customer_name, total, created_at FROM orders ORDER BY id', [], { batchSize: 1000 }));
    const toCsv = new Transform({
      objectMode: true,
      transform(r, _e, cb) {
        const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
        cb(null, [r.id, esc(r.customer_name), r.total, r.created_at.toISOString()].join(',') + '\n');
      },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.write('﻿id,customer_name,total,created_at\n');   // BOM để Excel đọc đúng tiếng Việt
    await pipeline(rows, toCsv, res);                          // client ngắt → pipeline huỷ rows
  } finally {
    client.release();
  }
});
```

Điểm chấm: dùng cursor/stream thay vì `SELECT` toàn bộ; `pipeline` để client ngắt kết nối thì stream truy vấn bị huỷ; luôn `release()` connection trong `finally`; escape dấu ngoặc kép trong CSV; chặn quyền (xuất toàn bộ đơn hàng là dữ liệu nhạy cảm). Kiểm bằng `curl -o /dev/null` và theo dõi RSS của process ổn định.
:::
