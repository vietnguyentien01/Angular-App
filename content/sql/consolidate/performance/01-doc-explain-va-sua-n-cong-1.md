---
title: "Đọc EXPLAIN ANALYZE và sửa lỗi N+1 từ Node.js — có số đo thật"
summary: "API 'đơn hàng của khách kèm chi tiết' chạy 11 truy vấn mất 330 ms. Đo, đọc EXPLAIN, gộp thành 2 truy vấn bằng = ANY($1) (49 ms), thêm index cho khoá ngoại (1 ms). Quy trình tối ưu truy vấn từng bước trên bảng 500.000 đơn và 1,5 triệu dòng chi tiết."
level: intermediate
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, explain, n-plus-one, performance, nodejs]
related: [sql/review/performance/index-va-transaction, sql/deep-dive/performance/isolation-va-khoa]
---

## TL;DR

- **N+1**: 1 truy vấn lấy danh sách + N truy vấn lấy chi tiết cho từng phần tử. Chậm vì N lần đi về DB, và tệ hơn nữa nếu mỗi lần là một lần quét bảng.
- Sửa: **gộp** thành `JOIN`, hoặc 2 truy vấn với `WHERE order_id = ANY($1)` rồi ghép trong code.
- Khoá ngoại **không** tự có index — `order_items.order_id` không index thì mỗi lần tìm chi tiết là một lần quét 1,5 triệu dòng.
- Quy trình: **đo** (số truy vấn, thời gian) → `EXPLAIN ANALYZE` → sửa một thứ → đo lại.

## Số đo (PostgreSQL 16, Node 22, máy local)

Bảng `big_orders` 500.000 dòng, `big_items` 1.500.000 dòng; lấy 10 đơn của khách 123 kèm chi tiết:

| Cách | Số truy vấn | Chưa index `big_items(order_id)` | Có index |
|---|---|---|---|
| N+1 | 11 | 330 ms | 5 ms |
| 2 truy vấn với `= ANY($1)` | 2 | 49 ms | 1 ms |

Hai bài học từ bảng: gộp truy vấn giảm số lần đi về DB (330 → 49 ms), nhưng **index đúng chỗ** mới là chênh lệch lớn nhất. Với DB ở máy khác (độ trễ mạng 1–5 ms mỗi lần), N+1 còn tệ hơn nhiều so với số đo local này.

## Code

```js bad title="N+1"
const { rows: orders } = await pool.query(
  'SELECT id, created_at FROM orders WHERE customer_id = $1 ORDER BY id', [customerId]);
for (const o of orders) {
  o.items = (await pool.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [o.id])).rows;
}
```

```js good title="2 truy vấn, ghép trong code"
const { rows: orders } = await pool.query(
  'SELECT id, created_at FROM orders WHERE customer_id = $1 ORDER BY id', [customerId]);
const { rows: items } = await pool.query(
  'SELECT order_id, product_id, quantity FROM order_items WHERE order_id = ANY($1)', [orders.map((o) => o.id)]);
const byOrder = Map.groupBy(items, (i) => i.order_id);       // Node 21+
return orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
```

```sql good title="Hoặc một truy vấn, PostgreSQL gom JSON"
SELECT o.id, o.created_at,
       coalesce(json_agg(json_build_object('productId', i.product_id, 'quantity', i.quantity))
                FILTER (WHERE i.order_id IS NOT NULL), '[]') AS items
FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
WHERE o.customer_id = $1
GROUP BY o.id ORDER BY o.id;
```

```sql title="Index cho khoá ngoại"
CREATE INDEX order_items_order_id_idx ON order_items (order_id);
-- order_items có PRIMARY KEY (order_id, product_id) thì index này đã có sẵn nhờ cột đầu của khoá chính
```

## Đọc EXPLAIN của truy vấn JOIN

```sql
EXPLAIN ANALYZE
SELECT o.id, i.product_id FROM big_orders o JOIN big_items i ON i.order_id = o.id
WHERE o.customer_id = 123;
```

```text
Nested Loop
  ->  Bitmap Heap Scan on big_orders o (actual rows=10 loops=1)
        ->  Bitmap Index Scan on big_orders_cust_created_idx (actual rows=10 loops=1)
  ->  Index Scan using big_items_order_idx on big_items i (actual rows=3 loops=10)
Execution Time: 0.292 ms
```

Đọc từ trong ra ngoài: tìm 10 đơn qua index của `customer_id`, rồi với **mỗi** đơn (`loops=10`) tìm chi tiết qua index của `order_id` (mỗi lần 3 dòng). Tổng thời gian thật là `actual time × loops`. Thấy `Seq Scan` trên bảng lớn ở vòng trong với `loops` cao là dấu hiệu thiếu index.

## Quy trình tối ưu

1. Tìm truy vấn chậm/nhiều nhất: log `log_min_duration_statement = 200ms`, extension `pg_stat_statements`, APM.
2. `EXPLAIN (ANALYZE, BUFFERS)` với **tham số thật** (giá trị phổ biến và giá trị hiếm có thể cho kế hoạch khác nhau).
3. Tìm `Seq Scan` lớn, `Rows Removed by Filter` lớn, `rows` ước tính lệch xa thực tế, `Sort` tràn đĩa.
4. Sửa **một** thứ: index, viết lại truy vấn, `ANALYZE`, giảm cột lấy về.
5. Đo lại và giữ số liệu trước/sau trong PR.

:::senior Góc nhìn senior
N+1 hay sinh ra từ ORM (`include` lười, getter quan hệ trong vòng lặp) và từ GraphQL resolver — không nhìn thấy trong code, chỉ thấy trong log truy vấn. Bật log số truy vấn mỗi request ở môi trường dev, và đặt ngưỡng cảnh báo (vd > 20 truy vấn/request). Ở GraphQL, dùng DataLoader — nó làm đúng việc gom `= ANY($1)` như bài này.
:::

:::version Map.groupBy và ORM
`Map.groupBy`/`Object.groupBy` có từ Node 21 (ES2024); bản cũ dùng `reduce`. ORM: Prisma `include` sinh truy vấn gộp kiểu `IN (…)`; TypeORM/Sequelize với quan hệ lười dễ sinh N+1 — kiểm bằng log SQL của ORM.
:::

:::interview N+1 query là gì và bạn phát hiện, sửa nó thế nào?
Là khi code chạy 1 truy vấn lấy danh sách rồi thêm N truy vấn cho từng phần tử (thường trong vòng lặp hoặc do ORM nạp quan hệ lười). Phát hiện bằng log/đếm số truy vấn mỗi request, APM, hoặc `pg_stat_statements` thấy một truy vấn nhỏ chạy rất nhiều lần. Sửa bằng JOIN, hoặc 2 truy vấn với `IN`/`= ANY($1)` rồi ghép trong code, hoặc eager loading của ORM, DataLoader ở GraphQL. Đồng thời kiểm cột dùng để nối đã có index.
:::

:::quiz Trong bảng số đo, thay đổi nào giảm thời gian nhiều nhất cho cách N+1 (330 ms)?
- [ ] Không đổi gì, chỉ chạy lại cho cache nóng
- [x] Thêm index cho `big_items(order_id)` — còn 5 ms
- [ ] Đổi `SELECT *` thành chọn cột
- [ ] Tăng `max` của pool

Không có index, mỗi truy vấn chi tiết là một lần quét 1,5 triệu dòng. Gộp truy vấn vẫn nên làm — chênh lệch càng lớn khi DB ở xa.
:::

:::quiz EXPLAIN cho `Index Scan on big_items (actual time=0.004..0.015 rows=3 loops=10)`. Bước này tốn khoảng bao lâu?
- [ ] 0,015 ms
- [x] Khoảng 0,15 ms — thời gian mỗi lần nhân với `loops`
- [ ] 10 ms
- [ ] Không xác định được

`actual time` là trung bình **mỗi vòng**.
:::

:::exercise Tối ưu trang "Sản phẩm bán chạy tháng này"
API sau chậm (3 giây) trên bảng `order_items` 5 triệu dòng. Tìm các vấn đề, viết lại thành một truy vấn, đề xuất index, và mô tả cách bạn chứng minh nó nhanh hơn.

```js
const { rows: products } = await pool.query('SELECT * FROM products');
for (const p of products) {
  const { rows } = await pool.query(
    `SELECT sum(i.quantity) AS sold FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE i.product_id = $1 AND to_char(o.created_at, 'YYYY-MM') = $2 AND o.status <> 'cancelled'`,
    [p.id, '2026-11']);
  p.sold = Number(rows[0].sold ?? 0);
}
products.sort((a, b) => b.sold - a.sold);
return products.slice(0, 10);
```
???
Vấn đề: (1) N+1 — một truy vấn cho **mỗi** sản phẩm; (2) `to_char(o.created_at, …) = …` bọc cột trong hàm nên không dùng được index trên `created_at`; (3) tính cho mọi sản phẩm rồi mới cắt 10 trong Node; (4) `SELECT *`.

```sql
SELECT p.id, p.name, sum(i.quantity) AS sold
FROM orders o
JOIN order_items i ON i.order_id = o.id
JOIN products p    ON p.id = i.product_id
WHERE o.created_at >= $1 AND o.created_at < $2      -- '2026-11-01', '2026-12-01'
  AND o.status <> 'cancelled'
GROUP BY p.id, p.name
ORDER BY sold DESC
LIMIT 10;
```

Index: `orders (created_at)` (hoặc `(created_at) WHERE status <> 'cancelled'` nếu đơn huỷ nhiều); `order_items` cần index có `order_id` đứng đầu (khoá chính `(order_id, product_id)` đã đủ). Chứng minh: chạy `EXPLAIN (ANALYZE, BUFFERS)` trước/sau với tháng có dữ liệu thật, ghi thời gian và số buffer đọc; đo thời gian API bằng `autocannon` hoặc log thời gian request; đính kèm số liệu vào PR. Nếu vẫn chậm vì tháng có hàng triệu dòng: bảng tổng hợp doanh số theo ngày cập nhật bằng job.
:::
