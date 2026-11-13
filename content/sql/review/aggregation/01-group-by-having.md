---
title: "GROUP BY, HAVING, hàm tổng hợp và FILTER"
summary: "Nhắc nhanh count/sum/avg/min/max, quy tắc cột trong SELECT phải nằm trong GROUP BY hoặc hàm tổng hợp, WHERE lọc trước còn HAVING lọc sau khi gom nhóm, count(*) khác count(cột) với NULL, và FILTER để đếm nhiều điều kiện trong một câu. Kết quả chạy trên cơ sở dữ liệu shop."
type: card
level: core
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, group-by, aggregate]
related: [sql/review/queries/select-where-join, sql/consolidate/aggregation/bao-cao-doanh-thu-va-window]
---

## TL;DR

- `GROUP BY` gom các dòng có cùng giá trị thành một nhóm; hàm tổng hợp (`count`, `sum`, `avg`, `min`, `max`) tính trên mỗi nhóm.
- Cột trong `SELECT` phải **nằm trong `GROUP BY`** hoặc **nằm trong hàm tổng hợp** (trừ khi gom theo khoá chính — PostgreSQL cho phép lấy cột khác của bảng đó).
- `WHERE` lọc **dòng trước** khi gom; `HAVING` lọc **nhóm sau** khi gom.
- `count(*)` đếm mọi dòng; `count(cot)` bỏ qua `NULL`; `sum/avg` cũng bỏ qua `NULL`.

## Ví dụ (dữ liệu shop, đã chạy)

```sql
-- Doanh thu theo tháng, bỏ đơn huỷ
SELECT to_char(o.created_at, 'YYYY-MM')   AS thang,
       count(DISTINCT o.id)               AS so_don,
       sum(i.quantity * i.unit_price)     AS doanh_thu
FROM orders o
JOIN order_items i ON i.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY thang
ORDER BY thang;
-- 2026-10 | 3 | 9800000
-- 2026-11 | 2 | 3450000
```

```sql
-- Khách đã chi trên 2 triệu (đơn đã thanh toán hoặc đã giao)
SELECT o.customer_id, sum(i.quantity * i.unit_price) AS tong
FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status IN ('paid', 'shipped')          -- lọc DÒNG
GROUP BY o.customer_id
HAVING sum(i.quantity * i.unit_price) > 2000000 -- lọc NHÓM
ORDER BY tong DESC;
-- 1 | 8250000
-- 2 | 2600000
```

```sql
-- Đếm nhiều điều kiện trong một lần quét (PostgreSQL: FILTER)
SELECT count(*)                                  AS tong,
       count(*) FILTER (WHERE status = 'paid')      AS da_thanh_toan,
       count(*) FILTER (WHERE status = 'cancelled') AS da_huy
FROM orders;
-- 6 | 3 | 1
```

PostgreSQL cho phép `GROUP BY thang` (alias của `SELECT`) — tiện, nhưng không phải hệ nào cũng cho.

## Bảng chọn nhanh

| Câu hỏi nghiệp vụ | Mẫu |
|---|---|
| Mỗi nhóm có bao nhiêu? | `GROUP BY nhom` + `count(*)` |
| Nhóm nào vượt ngưỡng? | `HAVING sum(...) > N` |
| Đếm theo nhiều trạng thái trên một dòng | `count(*) FILTER (WHERE …)` hoặc `sum(CASE WHEN … THEN 1 ELSE 0 END)` |
| Đếm đơn sau khi JOIN với chi tiết | `count(DISTINCT o.id)` |
| Nhóm rỗng vẫn phải hiện (danh mục chưa có sản phẩm) | `LEFT JOIN` từ bảng nhóm + `count(p.id)` |
| Kèm số liệu nhóm vào **từng dòng** (không gộp dòng) | Window function — bài Củng cố |

## Lỗi hay gặp: cột không nằm trong GROUP BY

```sql bad
SELECT customer_id, status, count(*) FROM orders GROUP BY customer_id;
-- ERROR: column "orders.status" must appear in the GROUP BY clause or be used in an aggregate function
```

Một khách có nhiều đơn với nhiều trạng thái — PostgreSQL không biết chọn trạng thái nào. Thêm `status` vào `GROUP BY` (gom theo cặp khách + trạng thái), hoặc dùng hàm tổng hợp (`max(status)`, `array_agg(status)`).

:::version MySQL
MySQL cũ (tắt `ONLY_FULL_GROUP_BY`) cho phép câu sai ở trên và trả **một giá trị bất kỳ** — nguồn bug khó thấy khi chuyển dự án sang PostgreSQL. MySQL 5.7.5+ bật chế độ chặt mặc định.
:::

:::interview WHERE khác HAVING thế nào?
`WHERE` lọc từng dòng **trước** khi gom nhóm và không dùng được hàm tổng hợp; `HAVING` lọc các **nhóm** sau khi gom, dùng được `count/sum/…`. Điều kiện không dính tới tổng hợp nên đặt ở `WHERE` — giảm số dòng phải gom và dùng được index. Ví dụ: "khách ở Hà Nội có trên 2 đơn" → `WHERE city = 'Hà Nội'` và `HAVING count(*) > 2`.
:::

:::quiz Với các giá trị `1, NULL, 3`, `count(*)`, `count(x)`, `sum(x)`, `avg(x)` lần lượt là?
- [ ] 3, 3, 4, 1.33
- [x] 3, 2, 4, 2
- [ ] 3, 2, NULL, NULL
- [ ] 2, 2, 4, 2

Đã chạy: `NULL` bị bỏ qua trong `count(x)`, `sum`, `avg` — trung bình là 4/2 chứ không phải 4/3.
:::

:::quiz Doanh thu tháng 10/2026 (bỏ đơn huỷ) của dữ liệu shop là bao nhiêu?
- [ ] 11.300.000
- [x] 9.800.000
- [ ] 2.200.000
- [ ] 13.250.000

Đơn 1: 1.500.000 + 2 × 350.000 = 2.200.000; đơn 2: 5.000.000; đơn 3: 1.200.000 + 4 × 350.000 = 2.600.000. Đơn 4 (1.500.000) bị huỷ nên loại.
:::

:::quiz Muốn liệt kê mọi danh mục kèm số sản phẩm, kể cả danh mục chưa có sản phẩm nào. Câu nào đúng?
- [ ] `SELECT c.name, count(*) FROM categories c LEFT JOIN products p ON … GROUP BY c.name`
- [x] `SELECT c.name, count(p.id) FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id, c.name`
- [ ] `SELECT c.name, count(p.id) FROM categories c JOIN products p ON … GROUP BY c.name`
- [ ] `SELECT name, count(*) FROM products GROUP BY category_id`

`count(*)` đếm cả dòng `NULL` do `LEFT JOIN` sinh ra nên danh mục rỗng sẽ báo 1; `count(p.id)` báo đúng 0.
:::
