---
title: "CTE đệ quy, khung cửa sổ (window frame) và LATERAL"
summary: "Duyệt cây danh mục nhiều cấp bằng WITH RECURSIVE, hiểu khung mặc định RANGE của window function — vì sao last_value 'sai' và luỹ kế gộp các dòng cùng ngày — trung bình trượt 3 ngày bằng ROWS, và top N mỗi nhóm bằng LATERAL. Mọi kết quả đã chạy trên PostgreSQL 16."
level: advanced
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, recursive-cte, window-frame, lateral]
related: [sql/consolidate/aggregation/bao-cao-doanh-thu-va-window]
---

## TL;DR

- `WITH RECURSIVE` = phần **gốc** `UNION ALL` phần **đệ quy** tham chiếu chính CTE; dừng khi phần đệ quy không sinh dòng mới. Dùng cho cây danh mục, sơ đồ tổ chức, chuỗi giới thiệu.
- Có `ORDER BY` trong `OVER` mà không ghi khung thì khung mặc định là **`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`** — tính tới dòng hiện tại **và mọi dòng bằng giá trị sắp xếp với nó**.
- Trung bình trượt, luỹ kế theo **từng dòng**: ghi rõ `ROWS BETWEEN …`.
- `LATERAL` cho phép subquery trong `FROM` tham chiếu bảng bên trái — top N mỗi nhóm có `LIMIT`, dùng được index.

## CTE đệ quy: cây danh mục

```sql
CREATE TABLE cat_tree (id int PRIMARY KEY, parent_id int REFERENCES cat_tree(id), name text NOT NULL);
INSERT INTO cat_tree VALUES
  (1, NULL, 'Gia dụng'), (2, 1, 'Nhà bếp'), (3, 2, 'Nồi chiên'), (4, 2, 'Máy xay'),
  (5, 1, 'Lọc nước'), (6, NULL, 'Sức khoẻ'), (7, 6, 'Máy massage');

WITH RECURSIVE tree AS (
  SELECT id, name, parent_id, 1 AS depth, name::text AS path
  FROM cat_tree WHERE parent_id IS NULL                        -- gốc
  UNION ALL
  SELECT c.id, c.name, c.parent_id, t.depth + 1, t.path || ' › ' || c.name
  FROM cat_tree c JOIN tree t ON c.parent_id = t.id            -- đệ quy
)
SELECT id, depth, path FROM tree ORDER BY path;
-- 1 1 Gia dụng
-- 5 2 Gia dụng › Lọc nước
-- 2 2 Gia dụng › Nhà bếp
-- 4 3 Gia dụng › Nhà bếp › Máy xay
-- 3 3 Gia dụng › Nhà bếp › Nồi chiên
-- 6 1 Sức khoẻ
-- 7 2 Sức khoẻ › Máy massage
```

"Mọi danh mục con cháu của Gia dụng" (để lọc sản phẩm khi bấm vào danh mục cha): đổi phần gốc thành `WHERE id = 1` → `{1, 2, 3, 4, 5}`.

Dữ liệu có chu trình (A là cha B, B là cha A) làm truy vấn chạy mãi: thêm điều kiện dừng theo `depth`, hoặc dùng mệnh đề `CYCLE` (PostgreSQL 14+).

## Khung cửa sổ

```sql
SELECT x,
       last_value(x) OVER (ORDER BY x) AS lv_mac_dinh,
       last_value(x) OVER (ORDER BY x ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS lv_dung
FROM (VALUES (1), (2), (3)) t(x);
-- x | lv_mac_dinh | lv_dung
-- 1 |      1      |    3
-- 2 |      2      |    3
-- 3 |      3      |    3
```

Khung mặc định chỉ tới dòng hiện tại nên `last_value` luôn là chính nó.

```sql
SELECT d, v,
       sum(v) OVER (ORDER BY d)                     AS range_mac_dinh,
       sum(v) OVER (ORDER BY d ROWS UNBOUNDED PRECEDING) AS rows_frame
FROM (VALUES ('2026-10-01'::date, 1), ('2026-10-01', 2), ('2026-10-02', 3)) t(d, v);
-- 2026-10-01 | 1 | 3 | 1
-- 2026-10-01 | 2 | 3 | 3
-- 2026-10-02 | 3 | 6 | 6
```

Hai dòng cùng ngày là "peer" trong `RANGE` nên cùng nhận luỹ kế 3. Muốn luỹ kế theo **từng đơn**: `ROWS` và thêm cột phụ (`ORDER BY d, id`).

```sql title="Trung bình trượt 3 ngày (bảng 500.000 đơn)"
WITH ngay AS (
  SELECT created_at AS d, sum(total) AS dt FROM big_orders
  WHERE created_at BETWEEN '2025-01-01' AND '2025-01-07' GROUP BY 1
)
SELECT d, dt, round(avg(dt) OVER (ORDER BY d ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)) AS tb3
FROM ngay ORDER BY d;
-- 2025-01-03 | 399580000 | 399646667   (trung bình của 01, 02, 03)
```

Lưu ý: `ROWS 2 PRECEDING` là **2 dòng trước**, không phải 2 ngày — ngày không có đơn thì bị thiếu dòng. Muốn đúng theo lịch: sinh đủ ngày bằng `generate_series` rồi `LEFT JOIN`, hoặc dùng `RANGE BETWEEN interval '2 days' PRECEDING AND CURRENT ROW`.

## LATERAL: top 2 sản phẩm đắt nhất mỗi danh mục

```sql
SELECT c.name, p.name, p.price
FROM categories c
CROSS JOIN LATERAL (
  SELECT name, price FROM products WHERE category_id = c.id ORDER BY price DESC LIMIT 2
) p;
-- Gia dụng: Máy lọc nước, Nồi chiên không dầu · Chăm sóc sức khoẻ: Máy đo huyết áp, Máy massage cổ · Phụ kiện: Lõi lọc thay thế
```

So với `ROW_NUMBER() … WHERE rn <= 2`: `LATERAL` + `LIMIT` dừng sớm cho từng nhóm nhờ index `(category_id, price DESC)` — nhanh hơn rõ khi mỗi nhóm có rất nhiều dòng mà chỉ cần vài dòng đầu. Danh mục không có sản phẩm muốn vẫn hiện: `LEFT JOIN LATERAL (…) p ON true`.

| Bài toán | Lựa chọn |
|---|---|
| Cây/đồ thị không biết trước độ sâu | `WITH RECURSIVE` (hoặc cột `path` kiểu `ltree` nếu đọc rất nhiều) |
| Xếp hạng, luỹ kế, so dòng trước/sau | Window function, ghi rõ khung |
| Top N mỗi nhóm, nhóm lớn, có index | `LATERAL … LIMIT N` |
| Top N mỗi nhóm, dữ liệu vừa phải | `ROW_NUMBER()` trong CTE |

:::senior Góc nhìn senior
Khung mặc định `RANGE` là nguồn của những báo cáo "lệch một chút" khó phát hiện: luỹ kế nhảy bậc ở ngày có nhiều đơn, `last_value`/`nth_value` trả giá trị lạ. Quy tắc cho team: mọi window có `ORDER BY` mà dùng hàm khung (`sum`, `avg`, `last_value`) phải **ghi khung tường minh**. Với cây danh mục đọc nhiều ghi ít (menu website), cân nhắc lưu sẵn `path` hoặc dùng bảng closure thay vì đệ quy mỗi request.
:::

:::quiz `last_value(x) OVER (ORDER BY x)` trên các giá trị 1, 2, 3 trả về gì ở dòng x = 1?
- [ ] 3
- [x] 1
- [ ] NULL
- [ ] Lỗi

Khung mặc định kết thúc ở dòng hiện tại. Đã chạy thử.
:::

:::quiz `sum(v) OVER (ORDER BY d)` với hai dòng cùng ngày 01/10 (v = 1 và 2). Dòng đầu tiên nhận giá trị?
- [ ] 1
- [x] 3 — hai dòng cùng `d` là peer trong khung RANGE mặc định
- [ ] 2
- [ ] 6

Muốn luỹ kế từng dòng: `ROWS UNBOUNDED PRECEDING` và `ORDER BY d, id`.
:::

:::exercise Báo cáo doanh thu theo cây danh mục
Với `cat_tree` ở trên và giả sử `products.category_id` trỏ vào lá của cây: viết truy vấn trả về **mọi** danh mục (kể cả cha) kèm tổng doanh thu của **toàn bộ cây con** của nó. Gợi ý: CTE đệ quy sinh cặp (tổ tiên, con cháu).
???
```sql
WITH RECURSIVE closure AS (
  SELECT id AS ancestor, id AS descendant FROM cat_tree             -- mỗi nút là con cháu của chính nó
  UNION ALL
  SELECT cl.ancestor, c.id FROM closure cl JOIN cat_tree c ON c.parent_id = cl.descendant
),
dt_san_pham AS (
  SELECT p.category_id, sum(i.quantity * i.unit_price) AS dt
  FROM order_items i JOIN orders o ON o.id = i.order_id JOIN products p ON p.id = i.product_id
  WHERE o.status <> 'cancelled'
  GROUP BY p.category_id
)
SELECT t.id, t.name, coalesce(sum(d.dt), 0) AS doanh_thu_cay_con
FROM cat_tree t
JOIN closure cl ON cl.ancestor = t.id
LEFT JOIN dt_san_pham d ON d.category_id = cl.descendant
GROUP BY t.id, t.name
ORDER BY t.id;
```

`closure` là "bảng bao đóng" sinh tạm: với 7 danh mục ở trên nó có 7 cặp (nút, chính nó) + các cặp tổ tiên–con cháu. Nếu báo cáo này chạy thường xuyên, lưu `closure` thành bảng thật và cập nhật khi cây đổi.
:::
