---
title: "Chuẩn hoá và phi chuẩn hoá có chủ đích, JSONB với GIN index, migration không downtime"
summary: "Chuẩn hoá 1NF–3NF qua ví dụ bảng đơn hàng 'phẳng', khi nào chấp nhận dư thừa, thuộc tính linh hoạt bằng JSONB với index GIN — số đo thật cho thấy GIN nhanh gấp 3 với điều kiện chọn lọc nhưng chậm hơn quét bảng khi khớp 1/3 dữ liệu — và mẫu expand/contract để đổi schema khi hệ thống đang chạy."
level: advanced
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, normalization, jsonb, migration]
related: [sql/review/design/khoa-rang-buoc-va-kieu-du-lieu, sql/consolidate/design/thiet-ke-schema-ban-hang]
---

## TL;DR

- **Chuẩn hoá**: mỗi sự thật lưu **một chỗ**. 1NF: giá trị nguyên tử, không lặp nhóm cột. 2NF: cột phụ thuộc vào **toàn bộ** khoá. 3NF: cột không phụ thuộc vào cột không phải khoá.
- **Phi chuẩn hoá có chủ đích**: lưu giá trị lịch sử (`unit_price`), số liệu tổng hợp (`rating_avg`) — kèm quy tắc cập nhật rõ ràng.
- **JSONB**: hợp với thuộc tính **thay đổi theo loại** (công suất máy xay, dung tích nồi). Không dùng cho dữ liệu cần ràng buộc, khoá ngoại, hay truy vấn tổng hợp thường xuyên.
- Đổi schema khi đang chạy: **expand → migrate → contract**, mỗi bước tương thích với cả code cũ và mới.

## Chuẩn hoá qua ví dụ

```text
orders_flat(order_id, order_date, customer_name, customer_phone, customer_city,
            product1_name, product1_qty, product1_price, product2_name, product2_qty, product2_price)
```

| Vấn đề | Vi phạm | Tách thành |
|---|---|---|
| `product1_*`, `product2_*` — đơn có 3 sản phẩm thì sao? | 1NF (nhóm lặp) | `order_items(order_id, product_id, quantity, unit_price)` |
| Đổi số điện thoại khách phải sửa mọi đơn cũ | Dư thừa → bất thường khi cập nhật | `customers`, `orders.customer_id` |
| `order_items(order_id, product_id, product_name)`: tên phụ thuộc vào `product_id` chứ không vào cả khoá ghép | 2NF | Tên ở `products` |
| `customers(…, ward, district, province)`, `province` suy ra từ `ward` | 3NF | Bảng đơn vị hành chính (nếu cần đúng tuyệt đối) |

Kết quả chính là cơ sở dữ liệu `shop` của môn này.

**Khi nào phi chuẩn hoá**: số liệu đọc rất nhiều mà tính rất tốn (`products.rating_avg`, `orders.total`) — cập nhật trong **cùng transaction** với dữ liệu gốc, hoặc bằng trigger/job, và có cách tính lại khi lệch. Giá trị lịch sử (giá lúc mua, địa chỉ giao hàng lúc đặt) không phải dư thừa — nó là một sự thật khác.

## JSONB cho thuộc tính linh hoạt

```sql
ALTER TABLE products ADD COLUMN attrs jsonb NOT NULL DEFAULT '{}';
UPDATE products SET attrs = '{"cong_suat": 1500, "dung_tich_l": 5, "mau": "đen"}' WHERE id = 1;

SELECT name, attrs->>'mau' AS mau, (attrs->>'cong_suat')::int AS cong_suat FROM products;
SELECT * FROM products WHERE attrs @> '{"mau": "đen"}';                 -- chứa cặp khoá-giá trị
CREATE INDEX products_attrs_gin ON products USING gin (attrs jsonb_path_ops);
```

Số đo trên 300.000 dòng:

| Truy vấn | Khớp | Quét bảng | GIN `jsonb_path_ops` |
|---|---|---|---|
| `attrs @> '{"cong_suat": 1900, "mau": "bạc"}'` | 5.000 dòng (1,7%) | 33 ms | **9,9 ms** |
| `attrs @> '{"mau": "bạc", "bao_hanh_thang": 36}'` | 100.000 dòng (33%) | **33 ms** | 79,6 ms (planner vẫn chọn index) |
| `attrs->>'mau' = 'bạc'` | — | quét bảng | GIN **không** hỗ trợ toán tử `->>` = |

Ba bài học: GIN chỉ giúp với toán tử nó hỗ trợ (`@>` cho `jsonb_path_ops`); điều kiện khớp phần lớn bảng thì index còn **chậm hơn**; và planner có thể ước tính sai — luôn kiểm bằng `EXPLAIN ANALYZE`. Thuộc tính lọc thường xuyên (vd `mau`) nên thành **cột thật** hoặc index biểu thức: `CREATE INDEX ON products ((attrs->>'mau'))`.

| Dữ liệu | Cột thường | JSONB |
|---|---|---|
| Giá, tồn kho, trạng thái | ✓ (ràng buộc, tổng hợp, index B-tree) | ✗ |
| Thông số khác nhau theo loại sản phẩm | Bảng EAV/bảng con cồng kềnh | ✓ |
| Payload webhook, log bên thứ ba | ✗ | ✓ |
| Khoá ngoại tới bảng khác | ✓ | ✗ (không có khoá ngoại trong JSON) |

## Migration không downtime: expand / contract

Ví dụ đổi `customers.full_name` thành hai cột `family_name`, `given_name`:

1. **Expand**: `ALTER TABLE customers ADD COLUMN family_name text, ADD COLUMN given_name text;` (cho phép NULL — chạy tức thì).
2. **Ghi cả hai**: deploy code ghi đồng thời cột cũ và cột mới.
3. **Migrate**: điền dữ liệu cũ theo lô (`UPDATE … WHERE id BETWEEN $1 AND $2`) để không khoá bảng lâu.
4. **Đọc cột mới**: deploy code đọc cột mới; theo dõi.
5. **Contract**: thêm `NOT NULL`, ngừng ghi cột cũ, cuối cùng `DROP COLUMN full_name`.

Các thao tác cần cẩn thận trên bảng lớn: `ALTER COLUMN … TYPE` (viết lại cả bảng), thêm `NOT NULL` (quét cả bảng — thêm `CHECK … NOT VALID` rồi `VALIDATE CONSTRAINT` riêng), tạo index không `CONCURRENTLY`. Đặt `SET lock_timeout = '5s'` trong migration để không xếp hàng chặn mọi truy vấn khác.

:::senior Góc nhìn senior
Chuẩn hoá trước, phi chuẩn hoá khi **có số đo** chứng minh cần. JSONB là lối thoát tốt cho phần thực sự linh hoạt, nhưng dự án nào dồn mọi thứ vào một cột `data jsonb` sẽ mất ràng buộc, khoá ngoại, thống kê của planner — và trả giá khi báo cáo. Với migration, câu hỏi review quan trọng nhất là "bước này khoá bảng nào, bao lâu, và nếu phải dừng giữa chừng thì sao?".
:::

:::quiz Bảng `order_items(order_id, product_id, product_name, quantity)` với khoá chính `(order_id, product_id)`. `product_name` vi phạm dạng chuẩn nào?
- [ ] 1NF
- [x] 2NF — `product_name` chỉ phụ thuộc vào `product_id`, một phần của khoá ghép
- [ ] 3NF
- [ ] Không vi phạm

Đổi tên sản phẩm sẽ phải sửa mọi dòng chi tiết đơn cũ.
:::

:::quiz Truy vấn `attrs @> '{"mau": "bạc"}'` khớp 33% bảng 300.000 dòng. Có index GIN, EXPLAIN ANALYZE cho 79 ms, quét bảng cho 33 ms. Kết luận đúng?
- [ ] Index GIN bị hỏng, cần tạo lại
- [x] Điều kiện kém chọn lọc thì đọc qua index tốn hơn quét tuần tự; planner ước tính chưa tốt — kiểm bằng số đo, cân nhắc cột thật hoặc thống kê tốt hơn
- [ ] Luôn tắt index GIN
- [ ] JSONB không index được

Index có lợi khi lọc ra một phần nhỏ của bảng.
:::

:::exercise Đổi kiểu cột tiền không downtime
`orders.total` đang là `int` (tối đa ~2,1 tỷ) và sắp tràn vì có đơn dự án lớn. Bảng có 50 triệu dòng, ghi liên tục. Viết kế hoạch migration chuyển sang `bigint` không làm dừng hệ thống, gồm các câu SQL và thứ tự deploy code.
???
`ALTER TABLE orders ALTER COLUMN total TYPE bigint` sẽ **viết lại cả bảng** và khoá ghi suốt thời gian đó — không chấp nhận được. Kế hoạch expand/contract:

```sql
-- 1. Expand (tức thì)
ALTER TABLE orders ADD COLUMN total_big bigint;

-- 2. Đồng bộ ghi mới: trigger (hoặc code ghi cả hai cột)
CREATE FUNCTION sync_total() RETURNS trigger AS $$
BEGIN NEW.total_big := NEW.total; RETURN NEW; END $$ LANGUAGE plpgsql;
CREATE TRIGGER orders_sync_total BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION sync_total();

-- 3. Điền dữ liệu cũ theo lô (chạy lặp từ script, mỗi lô 10.000 dòng)
UPDATE orders SET total_big = total WHERE id BETWEEN $1 AND $2 AND total_big IS NULL;

-- 4. Ràng buộc mà không khoá lâu
ALTER TABLE orders ADD CONSTRAINT total_big_not_null CHECK (total_big IS NOT NULL) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT total_big_not_null;

-- 5. Chuyển đổi (một transaction ngắn, có lock_timeout)
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TRIGGER orders_sync_total ON orders;
ALTER TABLE orders RENAME COLUMN total TO total_old;
ALTER TABLE orders RENAME COLUMN total_big TO total;
COMMIT;

-- 6. Contract (sau khi theo dõi ổn định)
ALTER TABLE orders DROP COLUMN total_old;
```

Code: trước bước 5, code chỉ đọc/ghi `total`; trigger lo đồng bộ. Sau bước 5, cột `total` là `bigint` — code ứng dụng không đổi tên cột, nhưng phía Node lưu ý `pg` trả `bigint` dạng **chuỗi** (để không mất chính xác) — cấu hình `pg.types.setTypeParser(20, Number)` nếu chắc giá trị nằm trong `Number.MAX_SAFE_INTEGER`, hoặc xử lý chuỗi/`BigInt`.
:::
