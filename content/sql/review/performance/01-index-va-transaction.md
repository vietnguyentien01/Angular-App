---
title: "Index, EXPLAIN và transaction — những điều cần nhớ"
summary: "Index B-tree biến quét 500.000 dòng (15,7 ms) thành đọc 10 dòng (0,19 ms) — số đo thật. Nhắc khi nào index được dùng và khi nào không (bọc cột trong biểu thức, cột đầu của index ghép, điều kiện khớp quá nhiều dòng), cách đọc EXPLAIN cơ bản, và transaction với ACID."
type: card
level: core
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, index, explain, transaction]
related: [sql/consolidate/performance/doc-explain-va-sua-n-cong-1, sql/deep-dive/performance/isolation-va-khoa]
---

## TL;DR

- **Index** (B-tree mặc định) giống mục lục: tìm theo cột đã đánh index mà không quét cả bảng. Đổi lại, **ghi chậm hơn** và tốn dung lượng.
- Khoá chính và `UNIQUE` tự có index. **Khoá ngoại thì không** — nên tự tạo index cho cột khoá ngoại hay dùng để lọc/join.
- Index **không được dùng** khi: bọc cột trong biểu thức/hàm (`customer_id + 0`, `lower(email)`), lọc theo cột **không phải cột đầu** của index ghép, hoặc điều kiện khớp phần lớn bảng.
- **Transaction**: nhóm nhiều lệnh thành một khối "tất cả hoặc không gì cả" — `BEGIN … COMMIT` / `ROLLBACK`.

## Đo thật trên bảng 500.000 đơn (PostgreSQL 16)

```sql
EXPLAIN ANALYZE SELECT * FROM big_orders WHERE customer_id = 123;
-- Parallel Seq Scan … Rows Removed by Filter: 166663 (mỗi worker)   Execution Time: 15.715 ms

CREATE INDEX big_orders_customer_idx ON big_orders (customer_id);
EXPLAIN ANALYZE SELECT * FROM big_orders WHERE customer_id = 123;
-- Bitmap Index Scan on big_orders_customer_idx … rows=10                Execution Time: 0.185 ms

EXPLAIN ANALYZE SELECT * FROM big_orders WHERE customer_id + 0 = 123;
-- Parallel Seq Scan lại — biểu thức trên cột làm index vô dụng          Execution Time: 16.300 ms
```

Index ghép `(customer_id, created_at)`:

| Điều kiện | Dùng index? (EXPLAIN thật) |
|---|---|
| `customer_id = 5 AND created_at >= '2025-03-01'` | ✓ Bitmap Index Scan, `Index Cond` có cả hai cột |
| `created_at = '2025-03-01'` (thiếu cột đầu) | ✗ Parallel Seq Scan |
| `status = 'paid'` (khớp ~25% bảng, không có index) | ✗ Seq Scan — kể cả có index, quét cả bảng có thể rẻ hơn |

## Đọc EXPLAIN nhanh

| Thấy | Nghĩa |
|---|---|
| `Seq Scan` | Đọc cả bảng — ổn với bảng nhỏ hoặc lấy phần lớn bảng |
| `Index Scan` / `Index Only Scan` | Dùng index; *Only* = không cần đọc bảng |
| `Bitmap Index Scan` + `Bitmap Heap Scan` | Dùng index để gom vị trí rồi đọc bảng theo khối |
| `Rows Removed by Filter` lớn | Đọc nhiều mà bỏ nhiều — ứng viên cho index |
| `rows=` ước tính lệch xa `actual rows=` | Thống kê cũ → `ANALYZE ten_bang` |

`EXPLAIN` chỉ ước tính; `EXPLAIN ANALYZE` **chạy thật** (cẩn thận với `UPDATE/DELETE` — bọc trong `BEGIN … ROLLBACK`).

## Transaction

```sql
BEGIN;
UPDATE products SET stock = stock - 2 WHERE id = 4;
INSERT INTO orders (customer_id, status, created_at) VALUES (2, 'pending', current_date) RETURNING id;
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (7, 4, 2, 1200000);
COMMIT;      -- có lỗi ở bất kỳ bước nào → ROLLBACK, kho không bị trừ oan
```

| ACID | Ý nghĩa |
|---|---|
| **A**tomicity | Tất cả lệnh thành công, hoặc không lệnh nào có hiệu lực |
| **C**onsistency | Sau transaction, mọi ràng buộc vẫn đúng |
| **I**solation | Transaction chạy đồng thời không thấy trạng thái dở dang của nhau (mức độ tuỳ isolation level) |
| **D**urability | Đã `COMMIT` thì không mất, kể cả mất điện |

## Lỗi hay gặp: index mọi cột "cho chắc"

Mỗi index làm **mọi** `INSERT/UPDATE/DELETE` chậm thêm và chiếm dung lượng. Tạo index từ **truy vấn thật** (log truy vấn chậm, `pg_stat_statements`), không phải từ danh sách cột.

:::version CREATE INDEX trên production
`CREATE INDEX` thường khoá ghi bảng trong lúc tạo. Trên bảng lớn đang chạy, dùng `CREATE INDEX CONCURRENTLY` (không chạy được trong transaction; lâu hơn nhưng không chặn ghi).
:::

:::interview Index là gì? Khi nào thêm index làm hệ thống chậm đi?
Index là cấu trúc dữ liệu phụ (mặc định B-tree đã sắp xếp) giúp tìm dòng theo giá trị cột mà không quét cả bảng — tăng tốc `WHERE`, `JOIN`, `ORDER BY`. Nó làm chậm đi khi bảng **ghi nhiều**: mỗi `INSERT/UPDATE/DELETE` phải cập nhật mọi index liên quan; quá nhiều index còn tốn RAM/đĩa và làm planner khó chọn. Index cũng vô ích nếu truy vấn bọc cột trong hàm, không dùng cột đầu của index ghép, hoặc lấy phần lớn bảng.
:::

:::quiz Bảng có index trên `customer_id`. Truy vấn nào **không** dùng được index đó?
- [ ] `WHERE customer_id = 123`
- [ ] `WHERE customer_id IN (1, 2, 3)`
- [x] `WHERE customer_id + 0 = 123`
- [ ] `WHERE customer_id BETWEEN 10 AND 20`

Đã đo: biểu thức trên cột khiến PostgreSQL quay lại quét tuần tự (16,3 ms so với 0,19 ms).
:::

:::quiz Index ghép `(customer_id, created_at)`. Truy vấn chỉ lọc `created_at = '2025-03-01'` thì sao?
- [ ] Dùng index bình thường
- [x] Không dùng được hiệu quả — B-tree sắp theo `customer_id` trước; EXPLAIN thật cho Seq Scan
- [ ] Lỗi
- [ ] Dùng index nếu thêm `ORDER BY`

Thứ tự cột trong index ghép quan trọng: đặt cột lọc bằng (`=`) hay dùng nhất lên đầu.
:::

:::quiz Đặt hàng gồm trừ kho, tạo đơn, tạo chi tiết đơn. Bước tạo chi tiết lỗi. Không dùng transaction thì sao?
- [ ] PostgreSQL tự hoàn tác cả ba
- [x] Kho đã bị trừ và đơn rỗng đã được tạo — dữ liệu không nhất quán
- [ ] Không có gì được ghi
- [ ] Chỉ bước lỗi bị hoàn tác, đúng như mong muốn

Mỗi lệnh ngoài transaction tự commit riêng. Bọc cả ba trong `BEGIN … COMMIT`.
:::
