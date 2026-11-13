---
title: Event loop, Promise và async/await trong Node.js
summary: "Node chạy JavaScript trên một luồng, I/O được giao cho hệ điều hành/libuv. Nhắc nhanh thứ tự call stack → microtask (nextTick, Promise) → timer/I/O, cách chạy song song bằng Promise.all và lỗi chặn event loop."
type: card
level: core
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, event-loop, async, promise]
related: [nodejs/consolidate/runtime/doan-thu-tu-va-loi-async, nodejs/deep-dive/runtime/ben-trong-event-loop-va-stream]
---

## TL;DR

- Code JavaScript của bạn chạy trên **một luồng**. Đọc file, gọi DB, gọi HTTP được giao cho libuv/hệ điều hành; khi xong, callback được xếp hàng chờ luồng chính rảnh.
- Thứ tự: **code đồng bộ** → **microtask** (`process.nextTick`, rồi Promise `.then`/`await`) → **macrotask** theo pha (timer, I/O, `setImmediate`…).
- Một vòng lặp CPU nặng **chặn mọi request** khác — server "đơ" dù chỉ một người gọi.
- Việc độc lập: `await Promise.all([...])` chạy song song; `for … await` từng cái là tuần tự.

## Ví dụ nhanh

```js
// file .cjs (CommonJS)
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
process.nextTick(() => console.log('D'));
console.log('E');
// In ra: A E D C B   (đã chạy thử trên Node 22/26)
```

```js
const [user, orders] = await Promise.all([getUser(id), getOrders(id)]); // song song
const results = await Promise.allSettled(jobs);   // không dừng khi một job lỗi
```

## Bảng chọn nhanh

| Cần | Dùng |
|---|---|
| Chờ nhiều việc độc lập, lỗi một cái là dừng | `Promise.all` |
| Chờ tất cả, lấy cả kết quả lỗi | `Promise.allSettled` |
| Lấy kết quả đến trước (vd timeout) | `Promise.race` |
| Việc CPU nặng (hash ảnh, nén, tính toán lớn) | `worker_threads` hoặc đẩy ra job queue |
| Đọc/ghi file lớn | Stream (`fs.createReadStream`, `pipeline`) |

## Lỗi hay gặp: quên `await` / Promise lỗi không ai bắt

```js bad
app.post('/orders', (req, res) => {
  saveOrder(req.body);          // không await: lỗi DB thành unhandled rejection
  res.status(201).end();        // trả 201 dù chưa lưu được
});
```

```js good
app.post('/orders', async (req, res) => {
  const order = await saveOrder(req.body);   // Express 5 tự chuyển lỗi sang error handler
  res.status(201).json(order);
});
```

Từ Node 15, unhandled rejection mặc định **làm process thoát** — tốt cho việc phát hiện lỗi, nhưng phải có process manager/container tự khởi động lại.

:::version Node 20 → 26
Node 26 là bản LTS hiện tại (tháng 11/2026), Node 24 vẫn được hỗ trợ. Các bản gần đây có sẵn `fetch`, test runner `node:test`, `--watch`, `--env-file=.env`, chạy được file `.ts` đơn giản (bỏ type) mà không cần build. Dự án cũ trên Node 16/18 thường dùng `node-fetch`, `nodemon`, `dotenv` cho các việc này.
:::

:::interview Node.js "single-threaded" nghĩa là gì? Vậy sao nó xử lý được hàng nghìn request cùng lúc?
Code JavaScript chạy trên một luồng (event loop), nhưng I/O không chạy trên luồng đó: Node giao cho hệ điều hành (epoll/kqueue) hoặc thread pool của libuv (fs, crypto, dns). Trong lúc chờ DB hay mạng, luồng chính rảnh để nhận request khác. Vì vậy Node mạnh với việc **I/O-bound**; việc **CPU-bound** thì phải dùng worker_threads, tách service, hoặc job queue — nếu không một request nặng sẽ làm chậm tất cả.
:::

:::quiz Đoạn code ESM (`.mjs`) sau in ra gì?
```js
async function f() { console.log(1); await null; console.log(2); }
f();
console.log(3);
```

- [ ] 1 2 3
- [x] 1 3 2
- [ ] 3 1 2
- [ ] 1 3, không in 2

Phần trước `await` chạy đồng bộ; phần sau `await` là microtask, chạy khi code đồng bộ (`console.log(3)`) xong.
:::

:::quiz Ba lệnh `await wait(100)` viết trong vòng `for` mất khoảng bao lâu, và `Promise.all` của ba lệnh đó mất bao lâu?
- [ ] Cả hai ~100ms
- [x] Vòng `for` ~300ms (tuần tự), `Promise.all` ~100ms (song song)
- [ ] Cả hai ~300ms
- [ ] Vòng `for` ~100ms, `Promise.all` ~300ms

Đã đo thử: 300ms và 100ms. Chỉ dùng `Promise.all` khi các việc **không phụ thuộc** nhau.
:::

:::quiz Một route tính SHA-256 lặp 300.000 lần mất ~400ms. Trong lúc đó, request khác tới server ra sao?
- [ ] Được xử lý song song bình thường
- [x] Phải chờ — vòng lặp đồng bộ chặn event loop; timer 10ms trong thử nghiệm chạy sau ~400ms
- [ ] Node tự chuyển việc sang luồng khác
- [ ] Bị trả lỗi 503 ngay

Đã chạy thử: `setTimeout(…, 10)` chỉ chạy sau khi vòng lặp xong. Việc CPU nặng → `worker_threads` hoặc hàng đợi job.
:::
