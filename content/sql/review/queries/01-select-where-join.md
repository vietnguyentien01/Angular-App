---
title: "SELECT, WHERE, JOIN và NULL — kèm cơ sở dữ liệu bán hàng mẫu"
summary: "Nhắc nhanh thứ tự viết và thứ tự chạy của một câu SELECT, INNER/LEFT JOIN, ba bẫy NULL (= NULL, NOT IN có NULL, lọc LEFT JOIN trong WHERE) và EXISTS. Có script tạo cơ sở dữ liệu shop dùng cho cả môn; mọi kết quả đã chạy trên PostgreSQL 16."
type: card
level: core
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, join, null-handling]
related: [sql/consolidate/queries/viet-truy-van-ban-hang, sql/review/aggregation/group-by-having]
---

## TL;DR

- Viết: `SELECT … FROM … JOIN … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT`. Chạy (logic): **FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT**. Vì vậy `WHERE` không dùng được alias đặt trong `SELECT`.
- `INNER JOIN` chỉ giữ dòng khớp cả hai bên; `LEFT JOIN` giữ mọi dòng bên trái, bên phải không khớp thì là `NULL`.
- `NULL` nghĩa là "không biết": `x = NULL` **không bao giờ đúng** — dùng `IS NULL`.
- "Không có bản ghi liên quan" → `NOT EXISTS` (an toàn hơn `NOT IN`).

## Cơ sở dữ liệu mẫu `shop`

Tạo database rồi chạy script (đã chạy trên PostgreSQL 16): `createdb shop && psql -d shop -f shop.sql`. Không cài PostgreSQL được thì dùng Docker: `docker run --name pg -e POSTGRES_PASSWORD=pw -p 5432:5432 -d postgres:16`.

```sql title="shop.sql"
CREATE TABLE customers (
  id         serial PRIMARY KEY,
  full_name  text NOT NULL,
  phone      text NOT NULL UNIQUE,
  city       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE categories (id serial PRIMARY KEY, name text NOT NULL UNIQUE);
CREATE TABLE products (
  id          serial PRIMARY KEY,
  category_id int  NOT NULL REFERENCES categories(id),
  name        text NOT NULL,
  price       int  NOT NULL CHECK (price > 0),
  stock       int  NOT NULL DEFAULT 0 CHECK (stock >= 0)
);
CREATE TABLE orders (
  id          serial PRIMARY KEY,
  customer_id int  NOT NULL REFERENCES customers(id),
  status      text NOT NULL CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
  created_at  date NOT NULL
);
CREATE TABLE order_items (
  order_id   int NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id int NOT NULL REFERENCES products(id),
  quantity   int NOT NULL CHECK (quantity > 0),
  unit_price int NOT NULL CHECK (unit_price > 0),
  PRIMARY KEY (order_id, product_id)
);

INSERT INTO customers (full_name, phone, city) VALUES
  ('Nguyễn An', '0901000001', 'Hà Nội'), ('Trần Bình', '0901000002', 'Hà Nội'),
  ('Lê Chi', '0901000003', 'Đà Nẵng'), ('Phạm Dũng', '0901000004', 'TP.HCM'),
  ('Hoàng Em', '0901000005', 'TP.HCM');
INSERT INTO categories (name) VALUES ('Gia dụng'), ('Chăm sóc sức khoẻ'), ('Phụ kiện');
INSERT INTO products (category_id, name, price, stock) VALUES
  (1, 'Nồi chiên không dầu', 1500000, 20), (1, 'Máy lọc nước', 5000000, 5),
  (2, 'Máy massage cổ', 900000, 0), (2, 'Máy đo huyết áp', 1200000, 12),
  (3, 'Lõi lọc thay thế', 350000, 100);
INSERT INTO orders (customer_id, status, created_at) VALUES
  (1, 'paid', '2026-10-01'), (1, 'shipped', '2026-10-15'), (2, 'paid', '2026-10-20'),
  (3, 'cancelled', '2026-10-21'), (4, 'pending', '2026-11-02'), (1, 'paid', '2026-11-05');
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  (1, 1, 1, 1500000), (1, 5, 2, 350000), (2, 2, 1, 5000000), (3, 4, 1, 1200000),
  (3, 5, 4, 350000), (4, 1, 1, 1500000), (5, 4, 2, 1200000), (6, 5, 3, 350000);
```

Tóm tắt dữ liệu: 5 khách (Hoàng Em **chưa có đơn**), 5 sản phẩm (Máy massage cổ **hết hàng**), 6 đơn (1 đơn huỷ, 1 đơn chờ).

## Ví dụ nhanh

```sql
-- Đơn chưa huỷ kèm tên khách → 5 dòng: đơn 1, 2, 3, 5, 6
SELECT o.id, c.full_name, o.status
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status <> 'cancelled'
ORDER BY o.id;

-- Khách chưa từng đặt hàng → Hoàng Em
SELECT c.full_name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);

-- Tìm không phân biệt hoa thường (PostgreSQL): ILIKE
SELECT name, price FROM products WHERE name ILIKE '%máy%' ORDER BY price DESC LIMIT 2;
-- → Máy lọc nước, Máy đo huyết áp
```

## Bảng chọn nhanh

| Muốn | Viết |
|---|---|
| Dòng khớp ở cả hai bảng | `JOIN` (= `INNER JOIN`) |
| Mọi dòng bên trái, kể cả không khớp | `LEFT JOIN` |
| Dòng bên trái **không** có bên phải | `LEFT JOIN … WHERE phải.id IS NULL` hoặc `NOT EXISTS` |
| Lọc trên bảng bên phải mà vẫn giữ mọi dòng bên trái | Đặt điều kiện trong **`ON`**, không trong `WHERE` |
| Kiểm tra rỗng | `IS NULL` / `IS NOT NULL`; giá trị mặc định: `COALESCE(x, 0)` |
| Lấy N dòng đầu theo thứ tự | `ORDER BY … LIMIT N` (thiếu `ORDER BY` thì thứ tự không xác định) |

## Lỗi hay gặp: lọc LEFT JOIN trong WHERE

```sql bad
-- Muốn: mỗi khách kèm số đơn đã thanh toán (kể cả 0)
SELECT c.full_name, count(o.id)
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid'
GROUP BY c.full_name;
-- Chỉ ra 2 khách: WHERE loại các dòng NULL, LEFT JOIN thành INNER JOIN
```

```sql good
SELECT c.full_name, count(o.id)
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'
GROUP BY c.full_name;
-- Đủ 5 khách: Nguyễn An 2, Trần Bình 1, ba người còn lại 0
```

:::version PostgreSQL và các hệ khác
Cú pháp trong bài là SQL chuẩn, chạy được trên PostgreSQL 13–18 (đã chạy trên 16). Khác biệt hay gặp: `ILIKE` chỉ có ở PostgreSQL (MySQL so sánh không phân biệt hoa thường theo collation); `LIMIT` ở PostgreSQL/MySQL, SQL Server dùng `TOP`/`OFFSET … FETCH`.
:::

:::interview Khác nhau giữa INNER JOIN và LEFT JOIN? Khi nào dùng EXISTS?
`INNER JOIN` chỉ trả các cặp dòng thoả điều kiện ở cả hai bảng; `LEFT JOIN` trả mọi dòng của bảng trái, cột của bảng phải là `NULL` khi không khớp. `EXISTS` dùng khi chỉ cần biết "có hay không" bản ghi liên quan mà không cần cột của nó — không làm nhân bản dòng như JOIN (một khách có 3 đơn sẽ thành 3 dòng), và `NOT EXISTS` xử lý `NULL` đúng, khác với `NOT IN`.
:::

:::quiz `SELECT count(*) FROM customers WHERE id NOT IN (1, NULL);` trả về bao nhiêu (bảng có 5 khách)?
- [ ] 4
- [ ] 5
- [x] 0
- [ ] Lỗi

`id <> NULL` cho kết quả "không biết", nên cả điều kiện không bao giờ đúng. Đã chạy thử: 0. Subquery trong `NOT IN` mà có một giá trị `NULL` cũng gây ra lỗi này — dùng `NOT EXISTS`.
:::

:::quiz Join `orders` với `order_items` cho khách Nguyễn An (3 đơn) trả bao nhiêu dòng?
- [ ] 3
- [x] 4 — đơn 1 có 2 sản phẩm, đơn 2 và 6 mỗi đơn 1
- [ ] 1
- [ ] 6

JOIN với bảng "nhiều" nhân bản dòng bên "một". Đếm đơn sau khi join phải dùng `count(DISTINCT o.id)`.
:::

:::quiz Vì sao `SELECT price * 2 AS gia_moi FROM products WHERE gia_moi > 2000000` báo lỗi?
- [ ] `AS` sai cú pháp
- [x] `WHERE` chạy trước `SELECT` nên chưa biết alias `gia_moi` — lặp lại biểu thức hoặc dùng subquery/CTE
- [ ] Không được nhân trong SELECT
- [ ] Phải dùng HAVING

`ORDER BY` thì dùng được alias vì chạy sau `SELECT`.
:::
