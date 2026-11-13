---
title: "Bên trong truy vấn — logic ba giá trị của NULL, ba thuật toán JOIN và semi/anti join"
summary: "Vì sao NULL = NULL không đúng mà cũng không sai, PostgreSQL chọn Nested Loop, Hash Join hay Merge Join ra sao (số đo thật: 0,3 ms với 10 đơn có index, 1,16 s khi join toàn bộ 1,5 triệu dòng), EXISTS/NOT EXISTS thành semi/anti join, và vai trò của thống kê với planner."
level: advanced
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, planner, join-algorithms, three-valued-logic]
related: [sql/review/queries/select-where-join, sql/consolidate/performance/doc-explain-va-sua-n-cong-1]
---

## TL;DR

- SQL dùng **logic ba giá trị**: `TRUE`, `FALSE`, `UNKNOWN` (NULL). `WHERE` chỉ giữ dòng `TRUE` — `UNKNOWN` bị loại như `FALSE`.
- Bạn viết **cái gì**, planner chọn **làm thế nào**: Nested Loop (ít dòng ngoài + index bên trong), Hash Join (bảng lớn, điều kiện `=`), Merge Join (cả hai bên đã/được sắp xếp).
- `EXISTS` → **semi join** (dừng ở dòng khớp đầu tiên); `NOT EXISTS` → **anti join**. Vì vậy `EXISTS` không nhân bản dòng như `JOIN`.
- Planner dựa vào **thống kê** (`ANALYZE`); thống kê sai → kế hoạch sai.

## Logic ba giá trị (đã chạy)

```sql
SELECT (NULL = NULL) IS NULL       AS a,   -- t : NULL = NULL cho NULL, không phải true
       NULL IS NOT DISTINCT FROM NULL AS b, -- t : so sánh coi NULL bằng NULL
       (NULL AND false)            AS c,   -- f : false thắng
       (NULL OR true)              AS d,   -- t : true thắng
       (NULL AND true) IS NULL     AS e;   -- t : vẫn không biết
```

| `AND` | TRUE | FALSE | NULL |
|---|---|---|---|
| **TRUE** | TRUE | FALSE | NULL |
| **FALSE** | FALSE | FALSE | FALSE |
| **NULL** | NULL | FALSE | NULL |

Hệ quả thực tế:

- `NOT IN (1, NULL)` = `id <> 1 AND id <> NULL` = `… AND NULL` → không bao giờ TRUE (bài Ôn lại đã đo: 0 dòng).
- `WHERE discount <> 0` **bỏ qua** dòng có `discount IS NULL` — muốn tính cả: `discount IS DISTINCT FROM 0`.
- `UNIQUE` cho phép **nhiều** NULL (mỗi NULL "khác nhau"); PostgreSQL 15+ có `UNIQUE NULLS NOT DISTINCT` nếu muốn chặn.
- `CHECK (price > 0)` **chấp nhận** NULL (CHECK chỉ từ chối FALSE) — vì vậy cần thêm `NOT NULL`.

## Ba thuật toán JOIN (bảng 500.000 đơn, 1,5 triệu dòng chi tiết, tắt parallel cho dễ đọc)

```text
-- 10 đơn của một khách, có index ở cả hai bên
Nested Loop (actual rows=30)
  -> Bitmap Heap Scan on big_orders o (rows=10)
  -> Index Only Scan using big_items_order_idx on big_items i (rows=3 loops=10)
Execution Time: 0.292 ms

-- 125.000 đơn 'paid' join toàn bộ chi tiết
Hash Join (actual rows=375000)
  Hash Cond: (i.order_id = o.id)
  -> Seq Scan on big_items i (rows=1500000)
  -> Hash -> Seq Scan on big_orders o (rows=125000)
Execution Time: 698.833 ms

-- join cả hai bảng, không lọc
Hash Join (actual rows=1500000)        Execution Time: 1157.094 ms
```

| Thuật toán | Cách làm | Tốt khi |
|---|---|---|
| **Nested Loop** | Với mỗi dòng bên ngoài, tìm dòng khớp bên trong (thường qua index) | Bên ngoài ít dòng, bên trong có index trên cột nối |
| **Hash Join** | Dựng bảng băm từ bên nhỏ hơn, quét bên lớn và tra băm | Hai bên lớn, điều kiện bằng (`=`), không có index phù hợp |
| **Merge Join** | Sắp hai bên theo khoá nối rồi đi song song | Hai bên đã sắp sẵn (index) hoặc kết quả cần sắp theo khoá đó |

Đọc kế hoạch: cùng một câu JOIN nhưng điều kiện lọc khác nhau cho thuật toán khác nhau — **đừng** đánh giá truy vấn mà không xem `EXPLAIN` với dữ liệu thật. Hash Join cần bộ nhớ (`work_mem`); băm không vừa thì tràn ra đĩa (`Batches: > 1` trong EXPLAIN).

## EXISTS và NOT EXISTS

```text
EXPLAIN … WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
  -> Hash Right Anti Join          -- giữ khách KHÔNG có dòng khớp

EXPLAIN … WHERE EXISTS (SELECT 1 FROM big_items i WHERE i.order_id = o.id AND i.product_id = 3) AND o.customer_id = 7
  -> Nested Loop Semi Join         -- mỗi đơn dừng ở chi tiết khớp đầu tiên
```

`IN (subquery)` cũng thường được chuyển thành semi join. `NOT IN (subquery)` thì **không** an toàn với NULL và thường khó tối ưu thành anti join — một lý do nữa để dùng `NOT EXISTS`.

## Thống kê và planner

- `ANALYZE` lấy mẫu dữ liệu: số dòng, số giá trị khác nhau, giá trị phổ biến, histogram. Autovacuum chạy `ANALYZE` định kỳ, nhưng sau khi nạp/xoá hàng loạt nên chạy tay.
- Ước tính sai thường gặp với **cột tương quan** (`city` và `province`): planner nhân xác suất như thể độc lập → ước tính quá ít dòng → chọn Nested Loop cho tập lớn. Sửa: `CREATE STATISTICS … (dependencies) ON city, province FROM customers`.
- Truy vấn tham số hoá (prepared statement) có thể dùng **kế hoạch chung** cho mọi giá trị: tốt với giá trị phổ biến, tệ với giá trị hiếm (hoặc ngược lại).

:::senior Góc nhìn senior
Khi một truy vấn "tự nhiên chậm" sau một thời gian, nghi phạm số một là **dữ liệu đổi phân bố** khiến planner đổi kế hoạch — không phải code đổi. Giữ lại `EXPLAIN (ANALYZE, BUFFERS)` của các truy vấn quan trọng (trong PR, trong runbook) để có cái so sánh. Và nhớ rằng bạn không ra lệnh cho planner trong PostgreSQL (không có hint chuẩn): bạn thay đổi index, thống kê, cách viết truy vấn, hoặc cấu trúc dữ liệu.
:::

:::quiz Cột `discount` có giá trị 0, 5000 và NULL. `WHERE discount <> 0` trả về những dòng nào?
- [ ] 5000 và NULL
- [x] Chỉ 5000 — `NULL <> 0` là UNKNOWN nên bị loại
- [ ] Cả ba
- [ ] Không dòng nào

Muốn tính cả NULL: `discount IS DISTINCT FROM 0`, hoặc thiết kế cột `NOT NULL DEFAULT 0`.
:::

:::quiz Bảng có `CHECK (price > 0)` nhưng không có `NOT NULL`. Chèn dòng có `price = NULL` thì sao?
- [ ] Bị từ chối vì NULL không lớn hơn 0
- [x] Được chấp nhận — CHECK chỉ từ chối khi biểu thức là FALSE, còn NULL > 0 là UNKNOWN
- [ ] PostgreSQL tự đặt price = 0
- [ ] Lỗi cú pháp

Ràng buộc "bắt buộc có và phải dương" cần cả `NOT NULL` và `CHECK`.
:::

:::exercise Giải thích một kế hoạch chậm
Báo cáo "đơn hàng có sản phẩm thuộc danh mục Chăm sóc sức khoẻ trong tháng" chạy 4 giây. EXPLAIN cho thấy `Nested Loop (rows=12 ước tính, actual rows=180000)` với vòng trong là `Seq Scan on order_items … loops=180000`. Giải thích chuyện gì xảy ra, ba nguyên nhân có thể, và các bước bạn sẽ thử theo thứ tự.
???
Planner **ước tính** bên ngoài chỉ có 12 dòng nên chọn Nested Loop (rẻ khi ít vòng), nhưng thực tế có 180.000 dòng → vòng trong (quét tuần tự `order_items`) chạy 180.000 lần. Gốc rễ là **ước tính sai**, không phải thuật toán sai.

Nguyên nhân có thể: (1) thống kê cũ sau khi nạp dữ liệu hàng loạt (chưa `ANALYZE`); (2) điều kiện trên các cột tương quan khiến planner nhân xác suất quá nhỏ (vd `category_id` và một cờ liên quan); (3) điều kiện bọc trong hàm (`date_trunc('month', created_at) = …`) khiến planner dùng ước tính mặc định rất thô.

Thứ tự thử: `ANALYZE orders, order_items, products;` rồi xem lại EXPLAIN → viết lại điều kiện thời gian dạng khoảng nửa mở trên cột trần → thêm index cho `order_items(order_id)` hoặc `(product_id)` tuỳ hướng join để vòng trong không còn Seq Scan → nếu còn ước tính sai do tương quan, `CREATE STATISTICS` cho các cột liên quan → đo lại bằng `EXPLAIN (ANALYZE, BUFFERS)`, ghi số trước/sau.
:::
