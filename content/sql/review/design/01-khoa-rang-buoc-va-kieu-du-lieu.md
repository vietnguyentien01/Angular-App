---
title: "Khoá chính, khoá ngoại, ràng buộc và kiểu dữ liệu"
summary: "Nhắc nhanh PRIMARY KEY, FOREIGN KEY và ON DELETE, UNIQUE, NOT NULL, CHECK, chọn kiểu dữ liệu đúng (tiền, thời gian, chuỗi, id), quan hệ 1-n và n-n qua bảng nối. Mỗi ràng buộc kèm thông báo lỗi thật của PostgreSQL khi bị vi phạm."
type: card
level: core
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, schema, constraints]
related: [sql/consolidate/design/thiet-ke-schema-ban-hang, sql/deep-dive/design/chuan-hoa-jsonb-va-migration]
---

## TL;DR

- **Khoá chính** (`PRIMARY KEY`) định danh duy nhất một dòng. **Khoá ngoại** (`REFERENCES`) bảo đảm dòng con trỏ tới dòng cha có thật.
- Ràng buộc là **hàng rào cuối cùng**: dù code có bug, DB vẫn từ chối dữ liệu sai. Đặt `NOT NULL`, `UNIQUE`, `CHECK` cho mọi quy tắc chắc chắn đúng.
- Quan hệ **1-n**: khoá ngoại ở bảng "nhiều" (`orders.customer_id`). Quan hệ **n-n**: bảng nối (`order_items(order_id, product_id)`).
- Tiền: số nguyên (đồng) hoặc `numeric(12,2)` — **không** dùng `float`. Thời điểm: `timestamptz`.

## Ràng buộc và lỗi thật (cơ sở dữ liệu shop)

| Ràng buộc | Câu vi phạm | PostgreSQL trả |
|---|---|---|
| `REFERENCES categories(id)` | `INSERT INTO products (category_id, …) VALUES (99, …)` | `violates foreign key constraint "products_category_id_fkey"` |
| `CHECK (price > 0)` | giá `0` | `violates check constraint "products_price_check"` |
| `UNIQUE` trên `phone` | trùng số `0901000001` | `duplicate key value violates unique constraint "customers_phone_key"` |
| Khoá ngoại không có `ON DELETE` | `DELETE FROM customers WHERE id = 1` (còn đơn) | `… is still referenced from table "orders"` |
| `CHECK (stock >= 0)` | `UPDATE products SET stock = stock - 1` khi stock = 0 | `violates check constraint "products_stock_check"` |

Dòng cuối cho thấy DB chặn **bán âm kho** ngay cả khi hai request cùng trừ kho một lúc — code kiểm `if (stock > 0)` thôi không làm được điều này.

Trong Node, bắt theo mã lỗi (`err.code`): `23505` unique, `23503` foreign key, `23514` check → chuyển thành `409`/`400` có nghĩa thay vì `500`.

## Bảng chọn kiểu dữ liệu

| Dữ liệu | Nên dùng | Tránh |
|---|---|---|
| Id | `bigint GENERATED ALWAYS AS IDENTITY` (hoặc `serial` ở dự án cũ), `uuid` khi cần sinh id ngoài DB | `int` cho bảng có thể vượt 2,1 tỷ dòng |
| Tiền VND | `bigint` (đồng) hoặc `numeric(14,2)` | `real`, `double precision` (sai số làm tròn) |
| Thời điểm sự kiện | `timestamptz` (lưu UTC, hiển thị theo múi giờ) | `timestamp` không múi giờ, chuỗi |
| Ngày (sinh nhật, ngày hiệu lực) | `date` | `timestamptz` |
| Chuỗi | `text` + `CHECK (length(x) <= n)` nếu cần | `char(n)` |
| Trạng thái cố định | `text` + `CHECK (status IN (…))` hoặc `enum` | Số ma thuật `1, 2, 3` không chú thích |
| Số điện thoại, mã bưu chính | `text` | Số (mất số 0 đầu) |
| Đúng/sai | `boolean NOT NULL DEFAULT false` | `0/1` dạng `int` |

## ON DELETE

| Tuỳ chọn | Xoá cha thì | Dùng cho |
|---|---|---|
| (mặc định) `NO ACTION` / `RESTRICT` | Bị chặn nếu còn con | Khách hàng — đã có đơn thì không được xoá |
| `CASCADE` | Xoá luôn con | `order_items` khi xoá đơn |
| `SET NULL` | Con mất liên kết | `products.supplier_id` khi xoá nhà cung cấp (cột phải cho phép NULL) |

Dữ liệu nghiệp vụ quan trọng (khách, đơn) thường **xoá mềm** (`deleted_at timestamptz`) thay vì xoá thật.

:::version Identity column
`GENERATED ALWAYS AS IDENTITY` là cú pháp chuẩn SQL (PostgreSQL 10+), được khuyến nghị thay cho `serial`. Cơ sở dữ liệu shop dùng `serial` cho ngắn gọn; hai cách cùng tạo một sequence phía sau.
:::

:::interview Vì sao vẫn cần ràng buộc trong DB khi code backend đã validate?
Vì code không phải đường duy nhất ghi vào DB (script migration, job, công cụ admin, service khác), và validate ở code không chống được **race condition**: hai request cùng kiểm "email chưa tồn tại" rồi cùng chèn. `UNIQUE`, `CHECK`, khoá ngoại được DB kiểm một cách nguyên tử. Validate ở code để trả lỗi thân thiện; ràng buộc ở DB để dữ liệu luôn đúng.
:::

:::quiz Quan hệ "một đơn có nhiều sản phẩm, một sản phẩm nằm trong nhiều đơn" được thiết kế thế nào?
- [ ] Cột `product_ids int[]` trong `orders`
- [ ] Cột `order_id` trong `products`
- [x] Bảng nối `order_items(order_id, product_id, quantity, unit_price)` với khoá chính ghép
- [ ] Một bảng `orders_products` không có khoá

Bảng nối còn là chỗ lưu thông tin của **mối quan hệ**: số lượng và giá tại thời điểm mua.
:::

:::quiz Vì sao `order_items` lưu `unit_price` thay vì luôn lấy `products.price`?
- [ ] Để truy vấn nhanh hơn
- [x] Giá sản phẩm đổi theo thời gian; đơn cũ phải giữ đúng giá lúc mua
- [ ] Vì PostgreSQL bắt buộc
- [ ] Không cần, đây là dư thừa phải bỏ

Đây là dư thừa **có chủ đích** — giá trị lịch sử, không phải bản sao cần đồng bộ.
:::

:::quiz Lưu giá 0,1 + 0,2 bằng kiểu `double precision` rồi so sánh `= 0.3` cho kết quả?
- [ ] true
- [x] false — số thực dấu phẩy động không biểu diễn chính xác 0,1
- [ ] Lỗi kiểu
- [ ] NULL

Đó là lý do tiền dùng số nguyên hoặc `numeric`.
:::
