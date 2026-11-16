---
title: "Entity, repository và Flyway — lưu dữ liệu với Spring Data JPA"
summary: "Nhắc nhanh entity JPA, quan hệ @ManyToOne/@OneToMany, repository với query method và @Query, phân trang, và quản lý schema bằng Flyway thay vì để Hibernate tự tạo bảng. Chạy thật với PostgreSQL 16, Hibernate 7.4."
type: card
level: core
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, jpa, spring-data, flyway, postgresql]
related: [spring-boot/consolidate/data/n-cong-1-va-lazy-loading, spring-boot/deep-dive/data/persistence-context-va-dirty-checking]
---

## TL;DR

- **Entity** = class ánh xạ một bảng: `@Entity`, `@Id`, constructor không tham số (`protected` là đủ).
- **Repository** = interface kế thừa `JpaRepository<Entity, Id>`; Spring Data tự sinh cài đặt. Query đơn giản viết bằng **tên method**, query phức tạp dùng **`@Query`** (JPQL).
- Quan hệ: mặc định đặt **`fetch = FetchType.LAZY`** cho `@ManyToOne` (mặc định của JPA là EAGER).
- Schema do **Flyway** quản lý (`db/migration/V1__…sql`), **không** dùng `ddl-auto=update` ngoài môi trường thử nghiệm.
- Tắt **open-in-view** (`spring.jpa.open-in-view=false`).

## Ví dụ (dự án `don-hang-api`, đã chạy)

```sql title="src/main/resources/db/migration/V1__tao_bang.sql"
CREATE TABLE san_pham (
  id      bigserial PRIMARY KEY,
  ten     text NOT NULL,
  gia     numeric(15, 0) NOT NULL CHECK (gia > 0),
  ton_kho int NOT NULL CHECK (ton_kho >= 0),
  version bigint NOT NULL DEFAULT 0
);
CREATE TABLE don_hang (
  id            bigserial PRIMARY KEY,
  khach_hang_id bigint NOT NULL REFERENCES khach_hang(id),
  trang_thai    text NOT NULL,
  tao_luc       timestamptz NOT NULL DEFAULT now()
);
-- … khach_hang, dong_don_hang
```

```text
Migrating schema "public" to version "1 - tao bang"
Successfully applied 1 migration to schema "public", now at version v1 (execution time 00:00.016s)
```

```java title="DonHang.java"
@Entity
@Table(name = "don_hang")
public class DonHang {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "khach_hang_id")
    private KhachHang khachHang;

    @Enumerated(EnumType.STRING)                      // lưu "CHO_THANH_TOAN", không lưu số thứ tự
    private TrangThai trangThai = TrangThai.CHO_THANH_TOAN;

    private Instant taoLuc;                           // timestamptz

    @OneToMany(mappedBy = "donHang", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DongDonHang> dong = new ArrayList<>();

    protected DonHang() {}
    public DonHang(KhachHang khachHang, Instant taoLuc) { … }
    public void themDong(SanPham sp, int soLuong) { dong.add(new DongDonHang(this, sp, soLuong, sp.getGia())); }
}
```

Tên cột lấy theo quy ước: `taoLuc` → `tao_luc`, `khachHang` → `khach_hang_id` (với `@JoinColumn`).

```java title="Repository"
public interface SanPhamRepository extends JpaRepository<SanPham, Long> {
    Page<SanPham> findByTenContainingIgnoreCase(String tuKhoa, Pageable pageable);   // sinh từ tên method
}

public interface DonHangRepository extends JpaRepository<DonHang, Long> {
    List<DonHang> findByKhachHangId(Long khachHangId);                               // đi qua quan hệ

    @Query("""
        select coalesce(sum(l.donGia * l.soLuong), 0) from DongDonHang l
        where l.donHang.khachHang.id = :khachHangId
          and l.donHang.trangThai = vn.hoc.donhang.donhang.TrangThai.DA_THANH_TOAN""")
    BigDecimal tongTienDaThanhToan(Long khachHangId);
}
```

Spring Data kiểm tra mọi `@Query` và tên method lúc **khởi động** — sai tên field là ứng dụng không chạy.

## Bảng chọn nhanh

| Cần | Dùng |
|---|---|
| Lọc đơn giản theo vài field | Query method: `findByTrangThaiAndTaoLucAfter(…)` |
| Join, tính tổng, điều kiện phức tạp | `@Query` (JPQL) |
| Câu SQL đặc thù PostgreSQL (CTE, window, JSONB) | `@Query(nativeQuery = true)` hoặc `JdbcClient` |
| Chỉ cần vài cột để hiển thị | Projection: record DTO trong `select new …` |
| Danh sách có phân trang | Tham số `Pageable`, trả `Page<…>` (có tổng) hoặc `Slice<…>` (không đếm) |
| Đổi schema | File Flyway mới `V3__….sql` — không sửa file đã chạy |
| Cập nhật hàng loạt | `@Modifying @Query("update …")` |

## Lỗi hay gặp: enum lưu dạng số

```java bad
@Enumerated                         // mặc định ORDINAL: CHO_THANH_TOAN=0, DA_THANH_TOAN=1, DA_HUY=2
private TrangThai trangThai;
// thêm DA_GIAO vào giữa enum → mọi dữ liệu cũ đổi nghĩa
```

```java good
@Enumerated(EnumType.STRING)
private TrangThai trangThai;
```

:::version Spring Boot 3 và 4
- Boot 4 đi với **Hibernate 7.4** và Jakarta Persistence **3.2** (đã kiểm tra trong `~/.m2` của dự án mẫu). Package là `jakarta.persistence.*` (từ Boot 3); code `javax.persistence` của Boot 2 phải đổi.
- Boot 4 có starter riêng `spring-boot-starter-flyway`; với PostgreSQL cần thêm `org.flywaydb:flyway-database-postgresql` (Flyway từ bản 10 tách hỗ trợ từng DB ra module riêng).
- Không đặt `spring.jpa.open-in-view` thì Boot in cảnh báo lúc khởi động: *spring.jpa.open-in-view is enabled by default. Therefore, database queries may be performed during view rendering…* (đã thấy khi chạy).
:::

:::interview Vì sao nên tắt open-in-view?
Open-in-view (OSIV) giữ `EntityManager` mở suốt request, kể cả khi đã ra khỏi service, để quan hệ lazy được nạp khi serialize JSON. Nó che giấu N+1 (query phát sinh trong lúc sinh JSON, khó thấy), giữ kết nối DB lâu hơn cần thiết (giảm thông lượng khi tải cao), và làm ranh giới transaction mờ đi. Tắt nó buộc service trả đúng DTO với dữ liệu đã nạp đủ bên trong transaction — lỗi `LazyInitializationException` lộ ra sớm ở môi trường dev thay vì thành vấn đề hiệu năng trên production.
:::

:::quiz Bạn cần thêm cột `ghi_chu` vào bảng `don_hang` đang chạy production. Làm thế nào?
- [ ] Sửa file `V1__tao_bang.sql` thêm cột
- [x] Tạo file mới `V3__them_ghi_chu.sql` chứa `ALTER TABLE don_hang ADD COLUMN ghi_chu text`
- [ ] Đặt `spring.jpa.hibernate.ddl-auto=update`
- [ ] Chạy tay câu ALTER trên production

Flyway lưu checksum của file đã chạy. Đã thử thêm một dòng comment vào `V1` rồi khởi động lại: *Migration checksum mismatch for migration version 1*, ứng dụng không chạy. Migration là lịch sử chỉ thêm, không sửa.
:::

:::quiz Mặc định của JPA cho `@ManyToOne` là gì?
- [x] EAGER — luôn nạp entity bên kia
- [ ] LAZY
- [ ] Tuỳ Hibernate
- [ ] Không nạp gì

Vì vậy luôn ghi rõ `fetch = FetchType.LAZY`. `@OneToMany` mặc định là LAZY.
:::

:::quiz `@Query("select s from SanPham s where s.tenn = :ten")` (gõ sai `tenn`). Khi nào lỗi lộ ra?
- [ ] Khi gọi method lần đầu
- [x] Khi khởi động ứng dụng — Spring Data kiểm tra query lúc tạo repository
- [ ] Không bao giờ, trả danh sách rỗng
- [ ] Khi biên dịch

Đã thử: *UnknownPathException: Could not resolve attribute 'tenn' of 'vn.hoc.donhang.sanpham.SanPham'*, ứng dụng không khởi động. Query JPQL được phân tích lúc khởi động; native query thì không (sai lộ ra khi chạy).
:::
