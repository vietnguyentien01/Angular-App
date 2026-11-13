---
title: "Báo cáo doanh thu bằng CTE và window function — top N mỗi nhóm, luỹ kế, tỉ trọng, so với kỳ trước"
summary: "Window function tính trên một nhóm dòng mà không gộp dòng như GROUP BY. Luyện ROW_NUMBER/RANK/DENSE_RANK, top 1 mỗi danh mục, doanh thu luỹ kế, tỉ trọng đơn trong tổng của khách, LAG để so tháng trước và khoảng cách giữa hai lần mua — tất cả đã chạy trên dữ liệu shop."
level: intermediate
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, window-function, cte, report]
related: [sql/review/aggregation/group-by-having, sql/deep-dive/aggregation/cte-de-quy-va-window-nang-cao]
---

## TL;DR

- `GROUP BY` **gộp** nhiều dòng thành một; window function `… OVER (…)` **giữ nguyên** từng dòng và thêm cột tính trên "cửa sổ" của nó.
- `PARTITION BY` = chia nhóm cho cửa sổ; `ORDER BY` trong `OVER` = thứ tự trong nhóm (cần cho xếp hạng, luỹ kế, LAG/LEAD).
- Top N mỗi nhóm: `ROW_NUMBER() OVER (PARTITION BY nhom ORDER BY …)` trong subquery/CTE, rồi lọc `rn <= N` bên ngoài.
- Window function **không** dùng được trong `WHERE` (chạy sau WHERE) — bọc bằng CTE.

## Cơ chế

```text
FROM/JOIN → WHERE → GROUP BY → HAVING → [window functions] → SELECT → ORDER BY → LIMIT
```

Vì window chạy sau `GROUP BY`, bạn có thể vừa gom nhóm vừa dùng window trên kết quả gom (vd `sum(sum(x)) OVER ()`), nhưng thường dễ đọc hơn khi tách bằng CTE.

## Năm báo cáo (kết quả thật)

```sql title="1. Sản phẩm đắt nhất mỗi danh mục"
SELECT danh_muc, name, price
FROM (
  SELECT c.name AS danh_muc, p.name, p.price,
         ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.price DESC) AS rn
  FROM products p JOIN categories c ON c.id = p.category_id
) t
WHERE rn = 1;
-- Gia dụng: Máy lọc nước · Chăm sóc sức khoẻ: Máy đo huyết áp · Phụ kiện: Lõi lọc thay thế
```

```sql title="2. Tổng tiền từng đơn và doanh thu luỹ kế"
WITH don AS (
  SELECT o.id, o.created_at, sum(i.quantity * i.unit_price) AS tong
  FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.status <> 'cancelled'
  GROUP BY o.id
)
SELECT id, created_at, tong,
       sum(tong) OVER (ORDER BY created_at, id) AS luy_ke
FROM don ORDER BY created_at, id;
-- 1  2026-10-01  2200000   2200000
-- 2  2026-10-15  5000000   7200000
-- 3  2026-10-20  2600000   9800000
-- 5  2026-11-02  2400000  12200000
-- 6  2026-11-05  1050000  13250000
```

```sql title="3. Tỉ trọng mỗi đơn trong tổng chi tiêu của khách"
WITH don AS (/* như trên, thêm o.customer_id */)
SELECT id, customer_id, tong,
       round(100.0 * tong / sum(tong) OVER (PARTITION BY customer_id), 1) AS pct
FROM don;
-- khách 1: đơn 1 26.7% · đơn 2 60.6% · đơn 6 12.7%
```

```sql title="4. Doanh thu tháng và tăng trưởng so với tháng trước"
WITH thang AS (
  SELECT date_trunc('month', o.created_at)::date AS thang, sum(i.quantity * i.unit_price) AS dt
  FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.status <> 'cancelled'
  GROUP BY 1
)
SELECT thang, dt,
       LAG(dt) OVER (ORDER BY thang) AS thang_truoc,
       round(100.0 * (dt - LAG(dt) OVER (ORDER BY thang)) / LAG(dt) OVER (ORDER BY thang), 1) AS tang_truong
FROM thang;
-- 2026-10-01  9800000  NULL     NULL
-- 2026-11-01  3450000  9800000  -64.8
```

```sql title="5. Số ngày giữa hai lần mua liên tiếp của mỗi khách"
SELECT customer_id, id, created_at,
       created_at - LAG(created_at) OVER (PARTITION BY customer_id ORDER BY created_at) AS cach_ngay
FROM orders WHERE status <> 'cancelled';
-- khách 1: NULL, 14, 21
```

## Xếp hạng khi bằng điểm

| Giá trị | `ROW_NUMBER` | `RANK` | `DENSE_RANK` |
|---|---|---|---|
| 100 | 1 | 1 | 1 |
| 90 | 2 | 2 | 2 |
| 90 | 3 | 2 | 2 |
| 80 | 4 | **4** | **3** |

`ROW_NUMBER` luôn duy nhất (bằng điểm thì thứ tự tuỳ ý — thêm cột phụ vào `ORDER BY` để ổn định); `RANK` nhảy hạng sau khi bằng điểm; `DENSE_RANK` không nhảy.

## Pitfalls

```sql bad
SELECT id FROM orders WHERE ROW_NUMBER() OVER (ORDER BY id) = 1;
-- ERROR: window functions are not allowed in WHERE
```

```sql bad
-- Chia cho LAG = NULL hoặc 0
round(100.0 * (dt - LAG(dt) OVER w) / LAG(dt) OVER w, 1)
-- tháng đầu NULL là đúng; nhưng tháng trước bằng 0 → lỗi chia cho 0: dùng NULLIF(LAG(dt) OVER w, 0)
```

Khai báo cửa sổ một lần cho gọn: `… OVER w … WINDOW w AS (ORDER BY thang)`.

:::senior Góc nhìn senior
Báo cáo tính bằng SQL ngay trong DB thường nhanh và đúng hơn kéo hàng chục nghìn dòng về Node rồi `reduce`. Nhưng báo cáo nặng chạy trên DB chính lúc cao điểm sẽ tranh tài nguyên với giao dịch — tách sang **read replica**, bảng tổng hợp làm sẵn theo ngày (materialized view, job ban đêm), hoặc kho dữ liệu riêng khi quy mô lớn.
:::

:::version Hỗ trợ window function
Window function có ở PostgreSQL từ 8.4, MySQL 8.0+, SQL Server, Oracle. MySQL 5.7 (vẫn còn trong dự án cũ) **không** có — phải dùng biến phiên hoặc subquery.
:::

:::interview Làm sao lấy 3 sản phẩm bán chạy nhất của mỗi danh mục?
Tính số lượng bán theo sản phẩm (GROUP BY), rồi đánh số trong mỗi danh mục bằng `ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY so_luong DESC, product_id)` trong một CTE, và lọc `WHERE rn <= 3` ở truy vấn ngoài. Muốn giữ cả các sản phẩm bằng hạng thì dùng `RANK` hoặc `DENSE_RANK` thay cho `ROW_NUMBER`. Ở PostgreSQL còn có cách `LATERAL` join với `LIMIT 3` cho mỗi danh mục.
:::

:::quiz Giá trị 100, 90, 90, 80 xếp giảm dần. `RANK()` của 80 là?
- [ ] 3
- [x] 4
- [ ] 2
- [ ] 5

`RANK` bỏ qua hạng 3 vì có hai dòng cùng hạng 2. `DENSE_RANK` cho 3.
:::

:::quiz Khác biệt chính giữa `sum(tong) OVER (PARTITION BY customer_id)` và `GROUP BY customer_id` + `sum(tong)`?
- [ ] Không khác
- [x] Window giữ nguyên từng đơn và gắn tổng của khách vào mỗi dòng; GROUP BY gộp thành một dòng mỗi khách
- [ ] Window nhanh hơn trong mọi trường hợp
- [ ] GROUP BY không tính được tổng

Vì giữ từng dòng nên tính được tỉ trọng `tong / sum(tong) OVER (…)`.
:::

:::exercise Báo cáo khách hàng thân thiết
Viết một truy vấn (dùng CTE) trả về cho mỗi khách có đơn chưa huỷ: tổng chi tiêu, số đơn, ngày mua gần nhất, hạng chi tiêu toàn hệ thống (`DENSE_RANK`), và nhãn `VIP` nếu tổng ≥ 5.000.000, `Thân thiết` nếu ≥ 2.000.000, còn lại `Mới`. Sắp theo hạng.
???
```sql
WITH chi_tieu AS (
  SELECT o.customer_id,
         sum(i.quantity * i.unit_price) AS tong,
         count(DISTINCT o.id)           AS so_don,
         max(o.created_at)              AS lan_cuoi
  FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.status <> 'cancelled'
  GROUP BY o.customer_id
)
SELECT c.full_name, ct.tong, ct.so_don, ct.lan_cuoi,
       DENSE_RANK() OVER (ORDER BY ct.tong DESC) AS hang,
       CASE WHEN ct.tong >= 5000000 THEN 'VIP'
            WHEN ct.tong >= 2000000 THEN 'Thân thiết'
            ELSE 'Mới' END AS nhan
FROM chi_tieu ct JOIN customers c ON c.id = ct.customer_id
ORDER BY hang;
-- Nguyễn An  8250000  3  2026-11-05  1  VIP
-- Trần Bình  2600000  1  2026-10-20  2  Thân thiết
-- Phạm Dũng  2400000  1  2026-11-02  3  Thân thiết
```

`count(DISTINCT o.id)` vì đã join với `order_items`. Đơn `pending` của Phạm Dũng được tính vì đề chỉ loại đơn huỷ — nếu nghiệp vụ chỉ tính đơn đã thanh toán, đổi điều kiện thành `status IN ('paid', 'shipped')`.
:::
