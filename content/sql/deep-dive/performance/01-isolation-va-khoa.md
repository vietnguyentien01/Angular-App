---
title: "Race condition trong database — isolation level, khoá dòng, deadlock và hàng đợi SKIP LOCKED"
summary: "Năm request cùng trừ kho từ tồn 10: kiểu đọc-rồi-ghi còn 8 (mất cập nhật). Đo và sửa bằng UPDATE nguyên tử có điều kiện, SELECT … FOR UPDATE, SERIALIZABLE kèm thử lại (40001), tránh deadlock (40P01) và hàng đợi job bằng SKIP LOCKED — chạy từ Node.js với pg."
level: advanced
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, transaction, isolation, locking, concurrency]
related: [sql/review/performance/index-va-transaction, sql/consolidate/performance/doc-explain-va-sua-n-cong-1]
---

## TL;DR

- Transaction **không** tự chống race condition. Ở mức mặc định `READ COMMITTED`, mẫu "SELECT rồi UPDATE bằng giá trị tính trong code" làm **mất cập nhật** (lost update).
- Cách sửa đơn giản nhất: để DB tính và kiểm trong **một câu**: `UPDATE … SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock`.
- Cần đọc rồi quyết định nhiều bước → `SELECT … FOR UPDATE` khoá dòng tới hết transaction.
- `SERIALIZABLE` an toàn nhất nhưng transaction có thể bị huỷ với mã `40001` — **bắt buộc** có vòng thử lại.
- Khoá theo thứ tự cố định để tránh deadlock (`40P01`); hàng đợi job nhiều worker: `FOR UPDATE SKIP LOCKED`.

## Đo thật: 5 request cùng trừ 2 đơn vị từ tồn kho 10

```js title="withTx — khuôn transaction với pg"
async function withTx(pool, fn, isolation = 'READ COMMITTED') {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);   // isolation chỉ nhận giá trị cố định trong code
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

```js bad title="Đọc rồi ghi — chạy 5 lần song song"
await withTx(pool, async (c) => {
  const { rows } = await c.query('SELECT stock FROM inv WHERE id = 1');
  if (rows[0].stock >= 2) await c.query('UPDATE inv SET stock = $1 WHERE id = 1', [rows[0].stock - 2]);
});
// Kết quả: còn 8 — cả 5 transaction cùng đọc 10 rồi cùng ghi 8
```

| Cách (5–7 request song song, tồn kho 10, mỗi lần trừ 2) | Kết quả đo |
|---|---|
| Đọc rồi ghi, `READ COMMITTED` | Còn **8** — mất 4 lần trừ kho |
| `UPDATE … SET stock = stock - 2 WHERE stock >= 2 RETURNING` (7 request) | 5 lần thành công, 2 lần `rowCount = 0`, còn **0** |
| `SELECT … FOR UPDATE` rồi kiểm và trừ (7 request) | 5 thành công, 2 báo hết hàng, còn **0** |
| Đọc rồi ghi, `SERIALIZABLE` (5 request) | 1 thành công, 4 lỗi `40001`, còn 8 — **cần thử lại** mới đúng |
| Hai giao dịch chuyển tiền ngược chiều (khoá 1→2 và 2→1) | Một `ok`, một lỗi `40P01` (deadlock detected) |

## Các cách sửa

```js good title="1. UPDATE nguyên tử có điều kiện — ưu tiên"
const { rowCount } = await pool.query(
  'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock', [qty, productId]);
if (rowCount === 0) throw new AppError(409, 'OUT_OF_STOCK', 'Hết hàng', { productId });
```

```js good title="2. Khoá dòng khi cần nhiều bước"
await withTx(pool, async (c) => {
  const { rows } = await c.query('SELECT stock, price FROM products WHERE id = $1 FOR UPDATE', [productId]);
  if (rows[0].stock < qty) throw new AppError(409, 'OUT_OF_STOCK', 'Hết hàng');
  // … tính giá, áp voucher, tạo đơn — dòng sản phẩm bị khoá tới COMMIT
  await c.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [qty, productId]);
});
```

```js good title="3. SERIALIZABLE kèm thử lại"
async function withRetry(fn, attempts = 3) {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (err) {
      if (!['40001', '40P01'].includes(err.code) || i === attempts) throw err;
      await new Promise((r) => setTimeout(r, 20 * i + Math.random() * 20));   // lùi ngẫu nhiên
    }
  }
}
await withRetry(() => withTx(pool, placeOrder, 'SERIALIZABLE'));
```

```sql title="4. Tránh deadlock: khoá theo thứ tự cố định"
-- chuyển tiền a → b: luôn khoá id nhỏ trước
SELECT id FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE;
```

```sql title="5. Hàng đợi job cho nhiều worker (đã chạy: 3 worker chia đều 30 job, không job nào chạy hai lần)"
BEGIN;
SELECT id, payload FROM jobs WHERE status = 'queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED;
-- … xử lý …
UPDATE jobs SET status = 'done' WHERE id = $1;
COMMIT;
```

## Isolation level trong PostgreSQL

| Mức | Thấy dữ liệu của transaction khác đã commit giữa chừng? | Chống lost update kiểu đọc-rồi-ghi? |
|---|---|---|
| `READ COMMITTED` (mặc định) | Có — mỗi câu lệnh thấy snapshot mới | Không |
| `REPEATABLE READ` | Không — cả transaction dùng một snapshot | Có: transaction đến sau bị huỷ (`40001`) khi cập nhật cùng dòng |
| `SERIALIZABLE` | Không | Có, và chống cả các bất thường phức tạp hơn (write skew); phải thử lại khi `40001` |

PostgreSQL không có "dirty read" ở bất kỳ mức nào (`READ UNCOMMITTED` hoạt động như `READ COMMITTED`).

:::senior Góc nhìn senior
Thứ tự ưu tiên khi thiết kế: (1) một câu SQL nguyên tử có điều kiện; (2) ràng buộc DB làm lưới an toàn (`CHECK (stock >= 0)` — trong bài, nó chặn bán âm kho kể cả khi code sai); (3) `FOR UPDATE` cho luồng nhiều bước; (4) `SERIALIZABLE` + retry cho logic phức tạp khó lý luận. Giữ transaction **ngắn**: không gọi API bên ngoài (cổng thanh toán, gửi email) khi đang giữ khoá — làm sau commit, hoặc qua outbox/job.
:::

:::quiz 5 request song song cùng chạy "SELECT stock rồi UPDATE stock = giá_trị_đã_đọc - 2" ở READ COMMITTED, tồn kho ban đầu 10. Kết quả đo được?
- [ ] 0
- [x] 8
- [ ] 2
- [ ] Lỗi deadlock

Cả 5 đọc thấy 10 trước khi ai kịp ghi, nên cùng ghi 8. Transaction ở mức mặc định không ngăn được.
:::

:::quiz Bạn chuyển sang `SERIALIZABLE` nhưng không thêm vòng thử lại. Điều gì xảy ra với 5 request đồng thời?
- [ ] Cả 5 thành công, tồn kho đúng 0
- [x] Chỉ 1 thành công; 4 transaction bị huỷ với lỗi `40001` — người dùng nhận lỗi dù còn hàng
- [ ] PostgreSQL tự thử lại
- [ ] Tồn kho âm

Đã đo: 1 thành công, 4 lỗi `40001`. SERIALIZABLE đổi "dữ liệu sai" thành "lỗi phải thử lại".
:::

:::exercise Đặt hàng nhiều sản phẩm an toàn
Viết hàm `placeOrder(pool, customerId, items)` (items: `[{ productId, quantity }]`) trừ kho **tất cả** sản phẩm và tạo đơn + chi tiết trong một transaction. Yêu cầu: hết hàng ở bất kỳ sản phẩm nào → không trừ sản phẩm nào, ném `OUT_OF_STOCK` kèm `productId`; hai đơn đồng thời chứa cùng các sản phẩm theo thứ tự khác nhau không được deadlock; giá lưu vào `order_items` lấy từ DB, không từ client.
???
```js
export async function placeOrder(pool, customerId, items) {
  const sorted = [...items].sort((a, b) => a.productId - b.productId);   // thứ tự khoá cố định → không deadlock
  return withTx(pool, async (c) => {
    const lines = [];
    for (const { productId, quantity } of sorted) {
      const { rows } = await c.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING price',
        [quantity, productId]);
      if (!rows[0]) throw new AppError(409, 'OUT_OF_STOCK', 'Hết hàng', { productId });   // ROLLBACK hoàn tác các dòng đã trừ
      lines.push({ productId, quantity, unitPrice: rows[0].price });
    }
    const { rows: [order] } = await c.query(
      "INSERT INTO orders (customer_id, status, created_at) VALUES ($1, 'pending', current_date) RETURNING id",
      [customerId]);
    await c.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
       SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[])`,
      [order.id, lines.map((l) => l.productId), lines.map((l) => l.quantity), lines.map((l) => l.unitPrice)]);
    return { orderId: order.id, total: lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) };
  });
}
```

Kiểm chứng: (1) test với một sản phẩm hết hàng ở giữa danh sách → tồn kho mọi sản phẩm **không đổi**; (2) chạy 20 lần song song hai đơn `[1, 5]` và `[5, 1]` → không có lỗi `40P01`; (3) tổng tồn kho trừ đi đúng bằng tổng số lượng các đơn thành công. `UPDATE … RETURNING price` vừa khoá dòng, vừa trừ kho, vừa lấy giá trong một câu.
:::
