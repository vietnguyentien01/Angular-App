---
title: "Persistence context và dirty checking — vì sao không cần gọi save, merge trả object khác, và insert hàng loạt"
summary: "Đo trên Hibernate 7.4: cache cấp 1 trả cùng object, sửa entity rồi commit tự sinh UPDATE, auto flush trước query, save() với entity detached trả object mới, IDENTITY chặn JDBC batching (696 ms so với 61 ms với SEQUENCE), và bulk update một câu SQL."
level: advanced
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, jpa, hibernate, persistence-context, performance, internals]
related: [spring-boot/consolidate/data/n-cong-1-va-lazy-loading, spring-boot/deep-dive/transactions/proxy-isolation-va-khoa]
---

## Tóm tắt nhanh

- Mỗi transaction có một **persistence context** (bộ nhớ của `EntityManager`): mỗi bản ghi chỉ có **một** object, `findById` lần hai không chạm DB.
- Entity **đang được quản lý** (managed) bị sửa sẽ được **tự động UPDATE** khi flush/commit — *dirty checking*. Không cần `save`.
- Entity **detached** (ngoài transaction) bị sửa thì **không** ai lưu. `save(detached)` gọi `merge`: chép trạng thái vào một object managed **khác** và trả object đó.
- Hibernate **flush trước query** có thể bị ảnh hưởng (auto flush), nên query luôn thấy thay đổi chưa commit của chính transaction.
- Insert hàng loạt: **`IDENTITY` tắt JDBC batching**; dùng `SEQUENCE` + `hibernate.jdbc.batch_size`, và `flush/clear` định kỳ. Cập nhật hàng loạt dùng **bulk update**.

## Cơ chế

```text
transaction bắt đầu ─► persistence context (Map: [kiểu, id] → object + bản chụp trạng thái lúc nạp)
   find/query    → nạp object, lưu bản chụp
   setter/method → chỉ đổi object trong bộ nhớ
   flush (trước query liên quan, trước commit, hoặc gọi tay)
                 → so từng object managed với bản chụp → sinh UPDATE cho cái thay đổi
                 → INSERT/DELETE theo thứ tự đã persist/remove
commit           → đóng context, mọi object thành detached
```

Mọi số đo dưới đây chạy trên Hibernate 7.4.13, PostgreSQL 16, đếm bằng Hibernate `Statistics` (profile `lab-data`, `lab-pc` của dự án mẫu).

## Cache cấp 1 và dirty checking

```java
tx.executeWithoutResult(s -> {
    SanPham a = spRepo.findById(1L).orElseThrow();
    SanPham b = spRepo.findById(1L).orElseThrow();
    // cùng object? true, 1 câu SQL
});

tx.executeWithoutResult(s -> {
    SanPham sp = spRepo.findById(2L).orElseThrow();
    sp.doiGia(new BigDecimal("4900000"));
    // trước commit: 1 câu SQL (chỉ SELECT)
});
// sau commit: 2 câu SQL (thêm UPDATE), giá mới = 4900000
```

Đây là lý do `DonHangService.taoDon` gọi `sp.xuatKho(...)` mà không gọi `save(sp)`: số tồn kho được UPDATE khi commit.

## Auto flush trước query

```java
tx.executeWithoutResult(s -> {
    SanPham sp = repo.findById(1L).orElseThrow();
    sp.doiGia(new BigDecimal("1111111"));                       // chưa flush
    repo.findByTenContainingIgnoreCase("nồi", Pageable.unpaged())
        .stream().filter(x -> x.getGia().compareTo(new BigDecimal("1111111")) == 0).count();
    // auto flush: query thấy giá mới? true, câu SQL trong lúc query: 2   ← UPDATE rồi mới SELECT
    s.setRollbackOnly();
});
```

Trước khi chạy query JPQL đụng tới bảng có thay đổi chưa ghi, Hibernate flush để query đúng. Hệ quả: một transaction sửa nhiều entity rồi chạy query sẽ thấy UPDATE xuất hiện ở chỗ "không ngờ" trong log. Native query thì Hibernate không biết bảng nào bị đụng, nên chính sách flush khác — cẩn thận khi trộn.

## Detached và `merge`

```java
SanPham detached = repo.findById(2L).orElseThrow();      // transaction của repository đã đóng
detached.doiGia(new BigDecimal("1"));
// sửa entity ngoài transaction (detached): 0 câu SQL — không ai lưu

detached.doiGia(new BigDecimal("4800000"));
SanPham ketQua = repo.save(detached);
// save(detached) trả cùng object? false, giá DB = 4800000, version 0 → 1
```

`save` của Spring Data gọi `persist` cho entity mới, `merge` cho entity đã có id. `merge` chép dữ liệu vào bản managed và trả **bản đó**; object bạn truyền vào vẫn là detached với `version` cũ. Tiếp tục dùng `detached` (vd lưu lần nữa) → xung đột version (bài *Transaction*). Quy tắc: luôn dùng giá trị **trả về** của `save`.

## Insert và update hàng loạt

Cấu hình `hibernate.jdbc.batch_size: 50`:

| Cách | Số câu SQL chuẩn bị | Thời gian |
|---|---|---|
| `saveAll` 1.000 `SanPham` (`IDENTITY`) | 1.000 | 696 ms |
| `persist` 1.000 `SanPham` + `flush/clear` mỗi 100 | 1.000 | 380 ms |
| `persist` 1.000 `NhatKy` (`SEQUENCE`, `allocationSize = 50`) + `flush/clear` mỗi 100 | 31 | **61 ms** |
| Bulk `update SanPham s set s.gia = s.gia + 1000 where …` (1.000 dòng) | 1 | 18 ms |

- Với `IDENTITY`, Hibernate phải chạy INSERT **ngay** để lấy id do DB sinh, nên không gom lô được — `batch_size` vô tác dụng.
- `SEQUENCE` với `allocationSize = 50` lấy trước một khối 50 id bằng một lần gọi sequence, nên INSERT được gửi theo lô. Sequence trong DB phải có `INCREMENT BY 50` khớp với `allocationSize`.
- `flush/clear` định kỳ giữ persistence context nhỏ: không có nó, 100.000 entity nằm trong bộ nhớ và mỗi lần flush phải so sánh tất cả.
- Bulk update/delete **bỏ qua** persistence context: entity đang managed không biết giá đã đổi. Chạy bulk ở transaction riêng, hoặc `clear()` sau đó.

## So sánh phương án

| Việc | Cách phù hợp |
|---|---|
| Sửa một vài entity theo nghiệp vụ | Nạp → gọi method → để dirty checking lưu |
| Import hàng nghìn bản ghi | `SEQUENCE` + `jdbc.batch_size` + `flush/clear`, hoặc `JdbcClient`/`COPY` của PostgreSQL |
| Cập nhật theo điều kiện cho nhiều dòng | Bulk JPQL/SQL `update` |
| Đọc để hiển thị | Projection DTO, `readOnly = true` (Hibernate bỏ bước chụp trạng thái) |
| Nhận dữ liệu từ API rồi cập nhật | Nạp entity managed, áp thay đổi từ DTO — không `merge` object tạo từ JSON |

## Tính năng mới theo phiên bản

- **Hibernate 6** (Boot 3): kiểu `Instant`/`OffsetDateTime` và cách sinh SQL mới; **Hibernate 7** (Boot 4): Jakarta Persistence 3.2, nhiều thay đổi API nội bộ — đọc migration guide trước khi nâng cấp ứng dụng có code Hibernate-specific.
- Spring Data JPA (cùng Boot 4) vẫn giữ hành vi `save` = `persist` hoặc `merge` như các bản trước.

:::senior Góc nhìn senior
Phần lớn bug "dữ liệu không lưu" hay "lưu nhầm" của JPA đến từ việc không biết object đang **managed** hay **detached**. Quy ước giúp tránh: service là ranh giới transaction; controller chỉ làm việc với DTO, không cầm entity; cập nhật từ API luôn là *nạp → sửa → để commit lưu*. Với job xử lý dữ liệu lớn, đo trước — JPA thuận tiện cho nghiệp vụ, nhưng import hàng triệu dòng thường nên dùng JDBC batch hoặc công cụ của DB.
:::

:::quiz Trong một method `@Transactional`, bạn `findById` một sản phẩm rồi gọi `sp.doiGia(...)`, không gọi `save`. Kết quả sau khi method kết thúc?
- [ ] Giá không đổi trong DB
- [x] Giá được UPDATE khi commit (dirty checking)
- [ ] Lỗi vì chưa save
- [ ] Chỉ đổi nếu bật `ddl-auto`

Đã đo: 1 câu SQL trước commit, 2 câu sau commit.
:::

:::quiz Vì sao `saveAll` 1.000 entity với `GenerationType.IDENTITY` vẫn sinh 1.000 câu INSERT dù đã đặt `hibernate.jdbc.batch_size: 50`?
- [ ] Do `saveAll` không hỗ trợ batch
- [x] Hibernate phải INSERT ngay để lấy id do DB sinh, nên không gom lô được
- [ ] Do PostgreSQL không hỗ trợ batch
- [ ] Do thiếu `@Transactional`

Đổi sang `SEQUENCE` với `allocationSize = 50` thì giảm còn 31 câu chuẩn bị, 61 ms thay vì 696 ms.
:::
