---
title: "Viết truy vấn cho bài toán bán hàng — JOIN nhiều bảng, subquery, EXISTS, CASE và các bẫy"
summary: "Luyện tám câu hỏi nghiệp vụ thật trên cơ sở dữ liệu shop: tổng tiền từng đơn, sản phẩm chưa bán được, giá cao hơn trung bình danh mục, phân loại tồn kho, sản phẩm hay mua cùng. Kèm hai bẫy kinh điển: thứ tự AND/OR và BETWEEN với timestamp. Mọi kết quả đã chạy trên PostgreSQL 16."
level: intermediate
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, join, subquery, exists]
related: [sql/review/queries/select-where-join, sql/consolidate/aggregation/bao-cao-doanh-thu-va-window]
---

## TL;DR

- Dịch câu hỏi nghiệp vụ sang SQL theo thứ tự: **cần bảng nào → nối bằng khoá nào → lọc dòng → gom nhóm → lọc nhóm → sắp xếp**.
- Subquery **tương quan** (tham chiếu bảng ngoài) chạy "cho từng dòng" về mặt logic — dễ đọc, PostgreSQL thường tối ưu tốt.
- `AND` ưu tiên hơn `OR` — luôn đặt ngoặc khi trộn hai loại.
- Lọc theo khoảng thời gian dùng **nửa mở** `>= đầu AND < đầu_kỳ_sau`, không dùng `BETWEEN` với `timestamptz`.

Dữ liệu: cơ sở dữ liệu `shop` ở bài [SELECT, WHERE, JOIN](/sql/review).

## Tám truy vấn

```sql title="1. Tổng tiền từng đơn chưa huỷ, kèm tên khách, đơn lớn nhất trước"
SELECT o.id, c.full_name, o.status, sum(i.quantity * i.unit_price) AS tong
FROM orders o
JOIN customers c   ON c.id = o.customer_id
JOIN order_items i ON i.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY o.id, c.full_name
ORDER BY tong DESC;
-- 2 Nguyễn An shipped 5000000 | 3 Trần Bình paid 2600000 | 5 Phạm Dũng pending 2400000
-- 1 Nguyễn An paid 2200000    | 6 Nguyễn An paid 1050000
```

`GROUP BY o.id` cho phép lấy `o.status` vì `id` là khoá chính của `orders` (PostgreSQL hiểu phụ thuộc hàm).

```sql title="2. Sản phẩm chưa bán được (không nằm trong đơn chưa huỷ nào)"
SELECT p.name
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM order_items i JOIN orders o ON o.id = i.order_id
  WHERE i.product_id = p.id AND o.status <> 'cancelled'
);
-- Máy massage cổ
```

```sql title="3. Sản phẩm có giá cao hơn giá trung bình của danh mục nó (subquery tương quan)"
SELECT p.name, p.price
FROM products p
WHERE p.price > (SELECT avg(p2.price) FROM products p2 WHERE p2.category_id = p.category_id);
-- Máy lọc nước 5000000 | Máy đo huyết áp 1200000
```

```sql title="4. Phân loại tồn kho bằng CASE"
SELECT name, stock,
       CASE WHEN stock = 0  THEN 'Hết hàng'
            WHEN stock < 10 THEN 'Sắp hết'
            ELSE 'Còn hàng' END AS tinh_trang
FROM products ORDER BY id;
-- Máy lọc nước: Sắp hết · Máy massage cổ: Hết hàng · còn lại: Còn hàng
```

```sql title="5. Khách ở TP.HCM hoặc Đà Nẵng có đơn trong tháng 11/2026"
SELECT DISTINCT c.full_name
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE c.city IN ('TP.HCM', 'Đà Nẵng')
  AND o.created_at >= '2026-11-01' AND o.created_at < '2026-12-01';
-- Phạm Dũng
```

```sql title="6. Sản phẩm hay được mua cùng 'Lõi lọc thay thế' (self-join)"
SELECT DISTINCT p.name
FROM order_items a
JOIN order_items b ON b.order_id = a.order_id AND b.product_id <> a.product_id
JOIN products p    ON p.id = b.product_id
WHERE a.product_id = 5;
-- Máy đo huyết áp, Nồi chiên không dầu
```

## Hai bẫy

```sql bad title="7. Thứ tự AND/OR"
-- Ý định: đơn paid hoặc shipped CỦA KHÁCH 2
SELECT id FROM orders WHERE status = 'paid' OR status = 'shipped' AND customer_id = 2;
-- → 1, 3, 6 (hiểu thành: paid  OR  (shipped AND khách 2))
```

```sql good
SELECT id FROM orders WHERE (status = 'paid' OR status = 'shipped') AND customer_id = 2;
-- → 3        (hoặc: status IN ('paid', 'shipped') AND customer_id = 2)
```

```sql bad title="8. BETWEEN với timestamptz"
-- Đơn lúc 15:00 ngày 30/11 bị LOẠI: '2026-11-30' nghĩa là 00:00 ngày 30
SELECT count(*) FROM (VALUES (timestamptz '2026-11-30 15:00+07')) t(ts)
WHERE ts BETWEEN '2026-11-01' AND '2026-11-30';   -- 0
```

```sql good
WHERE ts >= '2026-11-01' AND ts < '2026-12-01'    -- nửa mở: đủ cả ngày cuối, không trùng kỳ sau
```

Múi giờ cũng là bẫy: `'2026-11-01'` được hiểu theo `TimeZone` của phiên kết nối. Báo cáo theo giờ Việt Nam: `SET TIME ZONE 'Asia/Ho_Chi_Minh'` hoặc so với `'2026-11-01 00:00+07'`.

:::senior Góc nhìn senior
Truy vấn báo cáo sai thường **không báo lỗi** — chỉ ra con số sai. Tự kiểm bằng: đếm số dòng ở từng bước JOIN (có bị nhân bản không?), so tổng với một cách tính khác (tổng theo đơn = tổng theo sản phẩm?), và thử với trường hợp biên (khách không có đơn, đơn huỷ, ngày cuối tháng). Ghi câu hỏi nghiệp vụ thành comment ngay trên truy vấn để người review kiểm được ý định.
:::

:::version CTE thay subquery lồng sâu
Truy vấn dài nên tách bằng `WITH ten AS (…)` (CTE) cho dễ đọc. Từ PostgreSQL 12, CTE không còn luôn bị "vật chất hoá" — planner có thể gộp vào truy vấn chính, nên tách CTE thường không làm chậm.
:::

:::interview Subquery tương quan là gì? Khi nào nên thay bằng JOIN?
Subquery tương quan tham chiếu cột của truy vấn ngoài (`WHERE p2.category_id = p.category_id`), nên về logic được tính lại cho mỗi dòng bên ngoài. Dễ đọc khi diễn đạt "so với nhóm của chính nó" hoặc "tồn tại bản ghi liên quan" (`EXISTS`). Nếu EXPLAIN cho thấy nó chạy lặp tốn kém, viết lại bằng JOIN với một bảng tổng hợp trước (`JOIN (SELECT category_id, avg(price) … GROUP BY category_id) a USING (category_id)`) hoặc window function `avg(price) OVER (PARTITION BY category_id)`.
:::

:::quiz `SELECT id FROM orders WHERE status = 'paid' OR status = 'shipped' AND customer_id = 2` trên dữ liệu shop trả về?
- [ ] 3
- [x] 1, 3, 6
- [ ] 2, 3
- [ ] Rỗng

`AND` được tính trước: `paid OR (shipped AND khách 2)`. Đơn paid của mọi khách đều lọt vào.
:::

:::quiz Đếm đơn của từng khách sau khi `JOIN order_items` bằng `count(*)` cho Nguyễn An kết quả 4 thay vì 3. Sửa thế nào?
- [ ] Dùng `LEFT JOIN`
- [x] `count(DISTINCT o.id)` — hoặc tính tổng theo đơn trong subquery trước rồi mới join
- [ ] Thêm `ORDER BY`
- [ ] Dùng `HAVING`

Đơn 1 có hai dòng chi tiết nên bị đếm hai lần.
:::

:::exercise Năm câu hỏi của bộ phận kinh doanh
Viết truy vấn trên dữ liệu shop và ghi lại kết quả:
1. Danh sách sản phẩm sắp hết (stock < 10) kèm tên danh mục.
2. Khách chưa từng có đơn **đã thanh toán** (`paid` hoặc `shipped`).
3. Đơn có từ 2 sản phẩm khác nhau trở lên.
4. Mỗi thành phố có bao nhiêu khách và bao nhiêu đơn chưa huỷ (thành phố không có đơn vẫn hiện 0).
5. Sản phẩm bán được nhiều đơn vị nhất (tính trên đơn chưa huỷ).
???
```sql
-- 1 → Máy lọc nước (Gia dụng), Máy massage cổ (Chăm sóc sức khoẻ)
SELECT p.name, c.name AS danh_muc FROM products p JOIN categories c ON c.id = p.category_id WHERE p.stock < 10;

-- 2 → Lê Chi, Phạm Dũng, Hoàng Em
SELECT full_name FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status IN ('paid', 'shipped'));

-- 3 → đơn 1, 3
SELECT order_id FROM order_items GROUP BY order_id HAVING count(*) >= 2;

-- 4 → Hà Nội 2 khách, 4 đơn · TP.HCM 2 khách, 1 đơn · Đà Nẵng 1 khách, 0 đơn
SELECT c.city, count(DISTINCT c.id) AS so_khach, count(o.id) AS so_don
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status <> 'cancelled'
GROUP BY c.city;

-- 5 → Lõi lọc thay thế: 9 đơn vị
SELECT p.name, sum(i.quantity) AS so_luong
FROM order_items i JOIN orders o ON o.id = i.order_id JOIN products p ON p.id = i.product_id
WHERE o.status <> 'cancelled'
GROUP BY p.id, p.name ORDER BY so_luong DESC LIMIT 1;
```

Câu 4 cần điều kiện `status` trong `ON` và `count(DISTINCT c.id)` — nếu không, khách có nhiều đơn bị đếm nhiều lần.
:::
