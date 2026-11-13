---
title: Đoán thứ tự chạy và các lỗi async hay gặp trong Node.js
summary: "Luyện đoán output với nextTick, Promise, setTimeout, setImmediate (khác nhau giữa CommonJS và ESM), rồi sửa bốn lỗi async kinh điển — forEach với async, quên await, Promise.all làm sập cả lô, unhandled rejection làm process thoát."
level: intermediate
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, event-loop, async, pitfalls]
related: [nodejs/review/runtime/event-loop-va-async, nodejs/deep-dive/runtime/ben-trong-event-loop-va-stream]
---

## TL;DR

- Hai hàng đợi microtask: **`process.nextTick`** rồi **Promise**. Chúng chạy hết trước khi sang timer/I/O.
- Trong **CommonJS**, `nextTick` chạy trước Promise. Trong **ESM**, code top-level đã chạy bên trong một Promise job, nên Promise `.then` đăng ký ở top-level chạy **trước** `nextTick`.
- `forEach` **không chờ** callback async. Dùng `for…of` (tuần tự) hoặc `Promise.all(arr.map(...))` (song song).
- Promise bị reject không ai bắt → Node in lỗi và **thoát với exit code 1**.

## Cơ chế

```text
  [code đồng bộ hiện tại]
        ↓ hết
  [nextTick queue] → [Promise microtask queue]   (lặp tới khi cả hai rỗng)
        ↓
  pha timers → pha poll (I/O) → pha check (setImmediate) → … → quay lại
  (sau MỖI callback ở các pha, Node lại xả microtask)
```

Mọi output dưới đây đã chạy thử trên Node 22.

```js title="order.cjs"
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
Promise.resolve()
  .then(() => { console.log('then1'); process.nextTick(() => console.log('tick-in-then')); })
  .then(() => console.log('then2'));
process.nextTick(() => console.log('tick'));
```

Kết quả: `tick then1 then2 tick-in-then …` rồi mới tới `timeout`/`immediate`. `tick-in-then` chạy **sau** `then2` vì Node xả hết hàng Promise đang chạy rồi mới quay lại nextTick.

:::warning timeout hay immediate trước?
Ở **top-level**, thứ tự `setTimeout(…, 0)` và `setImmediate` **không được đảm bảo** (phụ thuộc thời điểm vào vòng lặp). **Bên trong một callback I/O** (vd `fs.readFile`), `setImmediate` **luôn** chạy trước — đã chạy thử: `immediate timeout`.
:::

## Bốn lỗi async

### 1. `forEach` với async

```js bad
[1, 2, 3].forEach(async (x) => { await save(x); });
console.log(saved.length);   // 0 — forEach đã trả về ngay
```

```js good
for (const x of items) await save(x);                 // tuần tự, giữ thứ tự
await Promise.all(items.map((x) => save(x)));          // song song
```

### 2. Quên `await` trong route

```js bad
app.post('/orders', async (req, res) => {
  orderService.create(req.body);   // lỗi DB → unhandled rejection, client vẫn nhận 201
  res.status(201).end();
});
```

```js good
const order = await orderService.create(req.body);
res.status(201).json(order);
```

Bật rule ESLint `@typescript-eslint/no-floating-promises` (hoặc `no-misused-promises`) để bắt lỗi này lúc viết code.

### 3. `Promise.all` làm sập cả lô

```js bad
await Promise.all(emails.map(sendMail));   // một email lỗi → cả lô báo lỗi, không biết cái nào đã gửi
```

```js good
const results = await Promise.allSettled(emails.map(sendMail));
const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [emails[i]] : []));
```

### 4. Gửi 10.000 request cùng lúc

`Promise.all` trên 10.000 phần tử mở 10.000 kết nối cùng lúc — DB/API bên kia từ chối hoặc bạn bị rate limit. Chia lô:

```js good
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}
```

(Hoặc dùng thư viện `p-limit` để giới hạn số việc chạy đồng thời.)

:::senior Góc nhìn senior
Phần lớn bug async trên production không nằm ở thứ tự microtask mà ở **lỗi bị nuốt** và **quá tải**: Promise không await, catch rỗng, gửi song song không giới hạn. Đặt ba hàng rào: lint `no-floating-promises`, error handler tập trung có log, và giới hạn đồng thời cho mọi vòng lặp gọi I/O.
:::

:::version CommonJS và ESM
Dự án Node mới nên dùng ESM (`"type": "module"`). Khác biệt thứ tự `nextTick`/Promise ở trên là hệ quả của việc module ESM được nạp bất đồng bộ — đừng viết code phụ thuộc vào thứ tự đó; nếu cần "chạy sau", dùng `await` rõ ràng.
:::

:::interview `process.nextTick` khác `setImmediate` và `Promise.resolve().then` thế nào?
`nextTick` và Promise đều là **microtask** — chạy ngay khi code đồng bộ hiện tại xong, trước bất kỳ timer hay I/O nào; trong CommonJS, hàng `nextTick` được xả trước hàng Promise. `setImmediate` là **macrotask** ở pha check của event loop — chạy sau pha poll (I/O). Gọi `nextTick` đệ quy có thể "bỏ đói" event loop (I/O không bao giờ được xử lý), nên ưu tiên `setImmediate` hoặc `queueMicrotask` khi muốn nhường.
:::

:::quiz File `order.cjs` (CommonJS) in ra gì cho 4 dòng đầu?
```js
Promise.resolve().then(() => { console.log('then1'); process.nextTick(() => console.log('tick-in-then')); })
  .then(() => console.log('then2'));
process.nextTick(() => console.log('tick'));
```

- [ ] then1 tick then2 tick-in-then
- [x] tick then1 then2 tick-in-then
- [ ] tick then1 tick-in-then then2
- [ ] then1 then2 tick tick-in-then

Đã chạy thử. Hàng nextTick được xả trước; trong lúc xả hàng Promise, `then2` (đã sẵn sàng) chạy trước khi Node quay lại nextTick.
:::

:::quiz Cùng đoạn `A, setTimeout B, Promise C, nextTick D, E` — chạy dưới dạng `.cjs` và `.mjs` cho kết quả gì?
- [ ] Cả hai: A E D C B
- [ ] Cả hai: A E C D B
- [x] `.cjs`: A E D C B — `.mjs`: A E C D B
- [ ] `.cjs`: A E C D B — `.mjs`: A E D C B

Đã chạy thử cả hai. Trong ESM, top-level chạy trong một Promise job nên microtask Promise được xả trước khi tới nextTick.
:::

:::quiz Script ESM chỉ có `Promise.reject(new Error('x'))` và một `setTimeout` in chữ sau 100ms. Kết quả?
- [ ] In cảnh báo rồi vẫn in chữ sau 100ms
- [x] In lỗi và process thoát với exit code 1, timer không chạy
- [ ] Không có gì xảy ra
- [ ] Treo mãi

Đã chạy thử trên Node 22: `exit=1`. Mặc định `--unhandled-rejections=throw` từ Node 15.
:::

:::exercise Sửa hàm import sản phẩm
Hàm sau nhận danh sách 5.000 sản phẩm từ file Excel và lưu vào DB. Nó có ba lỗi. Viết lại để: chờ lưu xong mới trả kết quả; tối đa 20 lệnh lưu chạy cùng lúc; trả về `{ saved, failed: [{ sku, reason }] }` thay vì dừng ở lỗi đầu tiên.

```js
export async function importProducts(rows) {
  let saved = 0;
  rows.forEach(async (row) => {
    await db.product.upsert(row);
    saved++;
  });
  return { saved };
}
```
???
```js
export async function importProducts(rows, concurrency = 20) {
  let saved = 0;
  const failed = [];
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((row) => db.product.upsert(row)));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') saved++;
      else failed.push({ sku: batch[j].sku, reason: r.reason?.message ?? String(r.reason) });
    });
  }
  return { saved, failed };
}
```

Ba lỗi: (1) `forEach` không chờ nên luôn trả `saved: 0`; (2) không giới hạn đồng thời — 5.000 kết nối cùng lúc; (3) một dòng lỗi thành unhandled rejection làm sập process. Kiểm chứng bằng test: mock `upsert` lỗi ở 2 dòng, kỳ vọng `saved = rows.length - 2` và `failed.length = 2`.
:::
