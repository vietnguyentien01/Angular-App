---
title: "Thiết kế schema cho tính năng mới và nối API Node.js với PostgreSQL"
summary: "Từ yêu cầu 'mã giảm giá' và 'sổ địa chỉ' ra bảng, cột, ràng buộc CHECK nhiều cột và unique index một phần (mỗi khách một địa chỉ mặc định), viết migration, rồi thay repo trong bộ nhớ bằng repo PostgreSQL dùng thư viện pg — cùng bộ test API, 10/10 test xanh."
level: intermediate
version: 16
lastReviewed: 2026-11-13
tags: [sql, postgresql, schema-design, migration, nodejs]
related: [sql/review/design/khoa-rang-buoc-va-kieu-du-lieu, nodejs/consolidate/rest-api/viet-api-co-test, sql/deep-dive/design/chuan-hoa-jsonb-va-migration]
---

## TL;DR

- Thiết kế từ **câu hỏi nghiệp vụ**: thực thể nào, quan hệ gì, quy tắc nào **luôn đúng** (→ ràng buộc), truy vấn nào hay chạy (→ index).
- Quy tắc nhiều cột: `CHECK` cấp bảng. "Chỉ một dòng thoả điều kiện": **unique index một phần** (`… WHERE is_default`).
- Mọi thay đổi schema đi qua **migration** có số thứ tự, commit cùng code, chạy trong CI và khi deploy.
- Node: một `pg.Pool` cho cả app, **luôn** dùng tham số `$1, $2`, đổi mã lỗi PostgreSQL thành lỗi API có nghĩa.

## Từ yêu cầu ra schema

> Yêu cầu: (1) mã giảm giá theo **phần trăm hoặc số tiền** (không cả hai), có thời hạn, đơn tối thiểu, giới hạn lượt dùng; (2) khách lưu nhiều địa chỉ giao hàng, **đúng một** địa chỉ mặc định.

```sql title="migrations/003_vouchers_addresses.sql (đã chạy thử trên shop)"
CREATE TABLE vouchers (
  code         text PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{4,20}$'),
  percent_off  int  CHECK (percent_off BETWEEN 1 AND 100),
  amount_off   int  CHECK (amount_off > 0),
  min_total    int  NOT NULL DEFAULT 0,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  max_uses     int  CHECK (max_uses > 0),             -- NULL = không giới hạn
  CHECK ((percent_off IS NULL) <> (amount_off IS NULL)),   -- đúng MỘT trong hai
  CHECK (ends_at > starts_at)
);

ALTER TABLE orders
  ADD COLUMN voucher_code text REFERENCES vouchers(code),
  ADD COLUMN discount int NOT NULL DEFAULT 0 CHECK (discount >= 0);   -- lưu số tiền giảm thực tế lúc mua
CREATE INDEX orders_voucher_code_idx ON orders (voucher_code) WHERE voucher_code IS NOT NULL;

CREATE TABLE addresses (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id int  NOT NULL REFERENCES customers(id),
  receiver    text NOT NULL,
  phone       text NOT NULL,
  line        text NOT NULL,
  ward        text NOT NULL,
  province    text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX addresses_one_default_idx ON addresses (customer_id) WHERE is_default;
```

Kiểm chứng (chạy trong transaction rồi `ROLLBACK`): voucher có cả `percent_off` và `amount_off` → `violates check constraint "vouchers_check"`; địa chỉ mặc định thứ hai của cùng khách → `duplicate key value violates unique constraint "addresses_one_default_idx"`; địa chỉ thường thứ hai → thêm được.

Đổi địa chỉ mặc định phải là **một transaction**: bỏ cờ cũ rồi đặt cờ mới.

```sql
BEGIN;
UPDATE addresses SET is_default = false WHERE customer_id = $1 AND is_default;
UPDATE addresses SET is_default = true  WHERE id = $2 AND customer_id = $1;
COMMIT;
```

## Migration

```text
migrations/
  001_init.sql
  002_add_stock.sql
  003_vouchers_addresses.sql
```

- Không sửa migration **đã chạy** trên môi trường chung — tạo migration mới.
- Thêm cột `NOT NULL` vào bảng có dữ liệu: thêm kèm `DEFAULT`, hoặc thêm cho phép NULL → điền dữ liệu → đặt `NOT NULL`.
- Công cụ: `node-pg-migrate`, Prisma Migrate, Drizzle Kit, Knex (Node); Flyway/Liquibase (Java, nhiều công ty dùng chung).

## Nối API với PostgreSQL

```bash
npm install pg
```

```js title="src/db.js"
import pg from 'pg';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
```

```js title="src/product-repo-pg.js — cùng interface với repo trong bộ nhớ"
export function createPgProductRepo(pool) {
  return {
    async list({ page, limit, q }) {
      const where = q ? 'WHERE name ILIKE $3' : '';
      const params = q ? [limit, (page - 1) * limit, `%${q}%`] : [limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT id, name, price, count(*) OVER () AS total
         FROM products ${where} ORDER BY id LIMIT $1 OFFSET $2`, params);
      const total = rows[0] ? Number(rows[0].total) : 0;
      return { items: rows.map(({ total: _t, ...p }) => p), total };
    },
    async findById(id) {
      const { rows } = await pool.query('SELECT id, name, price FROM products WHERE id = $1', [id]);
      return rows[0] ?? null;
    },
    async create({ name, price }) {
      const { rows } = await pool.query(
        'INSERT INTO products (name, price) VALUES ($1, $2) RETURNING id, name, price', [name, price]);
      return rows[0];
    },
    async update(id, patch) {
      const { rows } = await pool.query(
        `UPDATE products SET name = COALESCE($2, name), price = COALESCE($3, price)
         WHERE id = $1 RETURNING id, name, price`, [id, patch.name ?? null, patch.price ?? null]);
      return rows[0] ?? null;
    },
    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [id]);
      return rowCount > 0;
    },
  };
}
```

`${where}` chỉ ghép **chuỗi cố định trong code**, còn giá trị từ client (`q`) đi qua tham số `$3`. `count(*) OVER ()` lấy tổng số dòng ngay trong cùng truy vấn với trang hiện tại.

Chạy lại **đúng bộ test** của bài *Viết một REST API có test* với repo này và một database thử (`DATABASE_URL=postgres://…/apitest npx vitest run`): tạo bảng mới trong `beforeEach`, đóng pool trong `afterAll` → **10/10 test xanh** (8 test dùng repo bộ nhớ và 2 test với PostgreSQL thật).

```js title="Đổi mã lỗi PostgreSQL thành lỗi API"
const PG = { UNIQUE: '23505', FOREIGN_KEY: '23503', CHECK: '23514', NOT_NULL: '23502' };

export function mapDbError(err) {
  if (err.code === PG.UNIQUE) return new AppError(409, 'DUPLICATE', 'Dữ liệu đã tồn tại', { constraint: err.constraint });
  if (err.code === PG.FOREIGN_KEY) return new AppError(400, 'INVALID_REFERENCE', 'Tham chiếu không tồn tại', { constraint: err.constraint });
  if (err.code === PG.CHECK) return new AppError(400, 'CONSTRAINT_VIOLATION', 'Dữ liệu vi phạm quy tắc', { constraint: err.constraint });
  return err;
}
```

## Pitfalls

```js bad
const { rows } = await pool.query(`SELECT * FROM products WHERE name ILIKE '%${q}%'`);   // SQL injection
```

```js bad
const client = await pool.connect();
await client.query('BEGIN'); /* … lỗi ở đây … */   // không release → pool cạn kết nối, app treo
```

Transaction với `pg` luôn theo khuôn `try { BEGIN … COMMIT } catch { ROLLBACK; throw } finally { client.release() }` (bài Chuyên sâu về isolation có đầy đủ).

:::senior Góc nhìn senior
Schema sống lâu hơn code: một cột sai kiểu hay một ràng buộc thiếu sẽ theo dự án nhiều năm. Review migration kỹ như review API công khai — hỏi "dữ liệu hiện có có vi phạm không?", "bảng lớn thì `ALTER` này khoá bao lâu?", "rollback thế nào?". Với bảng lớn trên production, tách thay đổi thành nhiều bước tương thích ngược (thêm cột → ghi cả hai → đọc cột mới → bỏ cột cũ) để deploy không downtime.
:::

:::version ORM hay SQL thuần
Prisma, Drizzle, TypeORM, Sequelize giúp sinh kiểu TypeScript và migration, nhưng phỏng vấn và debug hiệu năng vẫn cần đọc được SQL chúng sinh ra. Drizzle và Kysely gần SQL nhất; Prisma có schema riêng. Dự án đơn giản dùng `pg` + SQL thuần như bài này là hoàn toàn chuyên nghiệp.
:::

:::interview Bạn thiết kế bảng cho "mỗi khách có nhiều địa chỉ, đúng một địa chỉ mặc định" thế nào để DB tự đảm bảo quy tắc?
Bảng `addresses` có `customer_id` là khoá ngoại tới `customers` (quan hệ 1-n) và cột `is_default boolean NOT NULL DEFAULT false`. Quy tắc "tối đa một mặc định" dùng unique index một phần: `CREATE UNIQUE INDEX … ON addresses (customer_id) WHERE is_default`. Đổi mặc định làm trong một transaction (bỏ cờ cũ, đặt cờ mới). "Ít nhất một mặc định" khó ép bằng ràng buộc đơn giản — xử lý ở service (địa chỉ đầu tiên tự thành mặc định).
:::

:::quiz Ràng buộc `CHECK ((percent_off IS NULL) <> (amount_off IS NULL))` đảm bảo điều gì?
- [ ] Cả hai cột đều có giá trị
- [x] Đúng một trong hai cột có giá trị — không được cả hai, không được không có
- [ ] Cả hai cùng NULL
- [ ] `percent_off` lớn hơn `amount_off`

`<>` giữa hai giá trị boolean nghĩa là "khác nhau" — XOR. Đã kiểm: voucher có cả hai bị từ chối.
:::

:::quiz Vì sao code repo ghép `${where}` vào câu SQL mà vẫn không bị SQL injection?
- [ ] Vì thư viện `pg` tự escape mọi thứ
- [x] Vì `where` chỉ là một trong hai chuỗi cố định viết trong code; giá trị người dùng (`q`) luôn đi qua tham số `$3`
- [ ] Vì có `ILIKE`
- [ ] Vì PostgreSQL không bị SQL injection

Quy tắc: chỉ ghép những gì code kiểm soát hoàn toàn (tên cột từ danh sách cho phép, đoạn `WHERE` cố định).
:::

:::exercise Thiết kế bảng đánh giá sản phẩm
Yêu cầu: khách chỉ được đánh giá sản phẩm **đã mua trong đơn đã giao** (`shipped`), mỗi khách tối đa một đánh giá cho mỗi sản phẩm, số sao 1–5, nội dung tối đa 2.000 ký tự, có thể sửa (lưu thời điểm sửa). Trang sản phẩm cần hiển thị điểm trung bình và 10 đánh giá mới nhất. Viết migration, truy vấn cho trang sản phẩm, và chỉ ra quy tắc nào ép bằng DB, quy tắc nào kiểm trong service.
???
```sql
CREATE TABLE reviews (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  int NOT NULL REFERENCES products(id),
  customer_id int NOT NULL REFERENCES customers(id),
  stars       smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body        text CHECK (length(body) <= 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  UNIQUE (product_id, customer_id)
);
CREATE INDEX reviews_product_created_idx ON reviews (product_id, created_at DESC);

-- Trang sản phẩm
SELECT round(avg(stars), 1) AS diem, count(*) AS so_danh_gia FROM reviews WHERE product_id = $1;
SELECT r.stars, r.body, r.created_at, c.full_name
FROM reviews r JOIN customers c ON c.id = r.customer_id
WHERE r.product_id = $1 ORDER BY r.created_at DESC LIMIT 10;
```

DB ép: số sao, độ dài, một đánh giá/khách/sản phẩm (`UNIQUE` — upsert bằng `ON CONFLICT (product_id, customer_id) DO UPDATE SET stars = EXCLUDED.stars, body = EXCLUDED.body, updated_at = now()`). Service kiểm "đã mua trong đơn shipped" bằng `EXISTS (SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.customer_id = $1 AND i.product_id = $2 AND o.status = 'shipped')` — quy tắc này phụ thuộc bảng khác nên không viết được bằng `CHECK`. Khi lượng đánh giá lớn, lưu sẵn `rating_avg`, `rating_count` trên `products` và cập nhật trong cùng transaction.
:::
