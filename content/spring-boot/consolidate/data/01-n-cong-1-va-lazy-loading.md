---
title: "N+1 query và lazy loading — đếm câu SQL rồi sửa bằng fetch join, @EntityGraph, batch fetch và projection"
summary: "Đếm số câu SQL bằng Hibernate Statistics: 10 đơn hàng sinh 13 câu (N+1), sửa còn 1 câu bằng @EntityGraph hoặc 3 câu bằng batch fetch; tái hiện LazyInitializationException; dùng projection DTO cho màn hình danh sách. Chạy thật trên PostgreSQL 16, Hibernate 7.4."
level: intermediate
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, jpa, hibernate, n-plus-1, performance]
related: [spring-boot/review/data/entity-repository-va-flyway, spring-boot/deep-dive/data/persistence-context-va-dirty-checking]
---

## Tóm tắt nhanh

- **N+1**: 1 query lấy danh sách cha + N query lấy quan hệ lazy của từng phần tử. Code nhìn vô hại, chạy chậm dần theo dữ liệu.
- Phát hiện bằng cách **đếm câu SQL** (Hibernate Statistics, log `org.hibernate.SQL`) trong test và môi trường dev.
- Sửa theo nhu cầu: **`@EntityGraph`/`join fetch`** (nạp cùng lúc), **`default_batch_fetch_size`** (nạp theo lô), hoặc **projection DTO** (chỉ lấy cột cần).
- `LazyInitializationException` = truy cập quan hệ lazy **ngoài transaction**. Sửa bằng cách nạp đủ dữ liệu trong service, **không** bằng `FetchType.EAGER` hay bật open-in-view.

## Cơ chế

Quan hệ `LAZY` được thay bằng **proxy** (với `@ManyToOne`) hoặc **collection bọc** (`PersistentBag` với `@OneToMany`). Lần đầu truy cập, Hibernate chạy một câu SELECT — cần `EntityManager` còn mở (tức là đang trong transaction, khi đã tắt open-in-view).

Đo bằng `Statistics.getPrepareStatementCount()` trong profile `lab-data` của dự án mẫu. Dữ liệu: 10 đơn của khách 1, mỗi đơn 2 dòng, dùng 2 sản phẩm khác nhau.

## N+1: đếm được 13 câu

```java bad
List<DonHang> dons = donHangRepo.findByKhachHangId(1L);
for (DonHang d : dons)
    for (var l : d.getDong())
        tong += l.getSanPham().getTen().length();
// N+1: 10 đơn → 13 câu SQL
```

```text
1:  select … from don_hang dh1_0 where dh1_0.khach_hang_id=?                   ← 1 câu lấy danh sách
2:  select … from dong_don_hang d1_0 where d1_0.don_hang_id=?                  ← mỗi đơn 1 câu (10 câu)
3:  select … from san_pham sp1_0 where sp1_0.id=?                              ← mỗi sản phẩm 1 câu (2 câu)
…
```

1 + 10 + 2 = 13. Sản phẩm chỉ có 2 câu vì sản phẩm đã nạp được giữ trong persistence context (bài chuyên sâu). Với 1.000 đơn thì là hơn 1.000 câu — mỗi câu chỉ vài ms nhưng cộng lại thành vài giây.

## Sửa 1: `@EntityGraph` — 1 câu

```java good
@EntityGraph(attributePaths = {"khachHang", "dong", "dong.sanPham"})
@Query("select d from DonHang d where d.khachHang.id = :khachHangId")
List<DonHang> timDayDuTheoKhach(Long khachHangId);
// @EntityGraph: 10 đơn → 1 câu SQL
```

```text
select dh1_0.id, d1_0.don_hang_id, …, sp1_0.ten, …, kh1_0.ho_ten, …
from don_hang dh1_0 left join dong_don_hang d1_0 on dh1_0.id=d1_0.don_hang_id left join san_pham sp1_0 … left join khach_hang kh1_0 …
```

Đánh đổi: kết quả join có số dòng = số dòng chi tiết (10 đơn × 2 dòng = 20 dòng), dữ liệu đơn bị lặp lại trong mỗi dòng. Fetch **hai** collection cùng lúc (vd `dong` và `thanhToan`) tạo tích Đề-các và Hibernate có thể từ chối (`MultipleBagFetchException`).

## Sửa 2: batch fetch — 3 câu

```yaml
spring:
  jpa:
    properties:
      hibernate.default_batch_fetch_size: 50
```

Cùng đoạn code N+1 ở trên, không đổi gì:

```text
N+1: 10 đơn → 3 câu SQL
select … from don_hang dh1_0 where dh1_0.khach_hang_id=?
select … from dong_don_hang d1_0 where d1_0.don_hang_id = any (?)
select … from san_pham sp1_0 where sp1_0.id = any (?)
```

Hibernate gom các proxy chưa nạp thành một câu `= any (?)` (PostgreSQL). Đây là "lưới an toàn" tốt cho cả ứng dụng: không phải sửa từng query, N+1 thành 1+1+1.

## Sửa 3: projection cho màn hình danh sách

Màn hình danh sách đơn chỉ cần mã, ngày, trạng thái, số dòng — không cần nạp entity:

```java good
record TomTatDon(Long id, Instant taoLuc, TrangThai trangThai, long soDong) {}

@Query("""
    select new vn.hoc.donhang.donhang.DonHangRepository$TomTatDon(d.id, d.taoLuc, d.trangThai, count(l))
    from DonHang d left join d.dong l
    where d.khachHang.id = :khachHangId
    group by d.id, d.taoLuc, d.trangThai
    order by d.id desc""")
List<TomTatDon> tomTatTheoKhach(Long khachHangId, Pageable pageable);
```

```text
projection DTO: [TomTatDon[id=10, …, soDong=2], TomTatDon[id=9, …, soDong=2], TomTatDon[id=8, …, soDong=2]] — 1 câu SQL
select dh1_0.id,dh1_0.tao_luc,dh1_0.trang_thai,count(d1_0.id) from don_hang dh1_0 left join dong_don_hang d1_0 … group by … order by dh1_0.id desc fetch first ? rows only
```

Không có entity trong persistence context, không có dirty checking, phân trang làm trong DB — rẻ nhất cho màn hình chỉ đọc.

## LazyInitializationException

```java bad
DonHang d = donHangRepo.findById(1L).orElseThrow();   // repository tự mở/đóng transaction
d.getDong().size();
// LazyInitializationException: Cannot lazily initialize collection of role
//   'vn.hoc.donhang.donhang.DonHang.dong' with key '1' (no session)
```

```java good
@Transactional(readOnly = true)
public DonHangResponse sangResponse(Long id) {       // chuyển sang DTO bên trong transaction
    DonHang d = chiTiet(id);
    var dong = d.getDong().stream().map(l -> new DongResponse(…)).toList();
    return new DonHangResponse(…, dong);
}
```

## Pitfalls

- Đổi sang `FetchType.EAGER` để "sửa" lazy: mọi chỗ nạp `DonHang` đều kéo theo dòng và sản phẩm, kể cả khi không cần; N+1 vẫn xảy ra với query JPQL.
- Bật lại open-in-view: lỗi biến mất, N+1 chạy trong lúc sinh JSON — chậm hơn và khó thấy hơn.
- `join fetch` collection kèm phân trang: Hibernate 7.4 (đã xem SQL) phân trang bảng cha trong subquery rồi mới join, nên kết quả đúng; bản Hibernate cũ có thể **phân trang trong bộ nhớ** (nạp hết rồi cắt) kèm cảnh báo *applying in memory* — kiểm tra log và SQL trên phiên bản bạn dùng.
- `toString()`/`equals()` của entity chạm vào quan hệ lazy → query ngoài ý muốn, hoặc vòng lặp vô hạn.

:::senior Góc nhìn senior
Đặt **giới hạn số câu SQL** làm một phần của test: test tích hợp cho endpoint danh sách kiểm tra `Statistics.getPrepareStatementCount() <= 3`. N+1 hay xuất hiện lại khi ai đó thêm một field vào DTO (chạm vào quan hệ mới) — test này bắt được ngay. Kết hợp `default_batch_fetch_size` làm lưới an toàn toàn cục, `@EntityGraph`/projection cho các màn hình quan trọng.
:::

:::version Spring Boot 3 và 4
`@EntityGraph`, `default_batch_fetch_size` và `select new` DTO có từ các bản Spring Data/Hibernate cũ, dùng được trên Boot 2/3/4. Dạng SQL của batch fetch phụ thuộc phiên bản Hibernate và DB: Hibernate 7.4 trên PostgreSQL sinh `= any (?)` (một tham số mảng), các bản cũ thường sinh `in (?, ?, …)`.
:::

:::interview N+1 query là gì và bạn xử lý thế nào?
Lấy N bản ghi cha bằng 1 query, rồi truy cập quan hệ lazy của từng bản ghi sinh thêm N query. Phát hiện bằng log SQL hoặc Hibernate Statistics, tốt nhất là có test giới hạn số câu SQL. Xử lý tuỳ trường hợp: `join fetch`/`@EntityGraph` khi cần đủ entity và dữ liệu không quá lớn; `hibernate.default_batch_fetch_size` để gom các lần nạp lazy thành vài câu `IN`; projection DTO cho màn hình chỉ đọc. Không dùng EAGER hay open-in-view để che lỗi.
:::

:::quiz 10 đơn, mỗi đơn 2 dòng, các dòng dùng chung 2 sản phẩm. Duyệt `don → dong → sanPham` với quan hệ lazy, không batch fetch. Bao nhiêu câu SQL?
- [ ] 1
- [ ] 21
- [x] 13
- [ ] 31

1 (đơn) + 10 (dòng của từng đơn) + 2 (sản phẩm, mỗi cái nạp một lần rồi lấy lại từ persistence context). Đã đo.
:::

:::quiz Bật `hibernate.default_batch_fetch_size: 50` mà không sửa code N+1 ở trên. Còn bao nhiêu câu?
- [ ] 1
- [x] 3
- [ ] 12
- [ ] 13

Mỗi "tầng" quan hệ một câu `= any (?)`. Đã đo.
:::

:::exercise Endpoint danh sách đơn không N+1
Viết `GET /api/khach-hang/{id}/don-hang` trả danh sách đơn kèm từng dòng (tên sản phẩm, số lượng, đơn giá) và tổng tiền, sao cho số câu SQL **không phụ thuộc** số đơn. Kiểm tra bằng Hibernate Statistics.
???
Repository dùng `@EntityGraph` (đã có ở trên):

```java
@EntityGraph(attributePaths = {"khachHang", "dong", "dong.sanPham"})
@Query("select d from DonHang d where d.khachHang.id = :khachHangId")
List<DonHang> timDayDuTheoKhach(Long khachHangId);
```

Service chuyển sang DTO trong transaction:

```java
@Transactional(readOnly = true)
public List<DonHangResponse> donCuaKhach(Long khachHangId) {
    return donHangRepo.timDayDuTheoKhach(khachHangId).stream()
        .map(d -> new DonHangResponse(d.getId(), d.getKhachHang().getHoTen(), d.getTrangThai(), d.getTaoLuc(),
                d.tongTien(), d.getDong().stream()
                    .map(l -> new DongResponse(l.getSanPham().getId(), l.getSanPham().getTen(), l.getSoLuong(), l.getDonGia()))
                    .toList()))
        .toList();
}
```

Đo trong `lab-data`: `@EntityGraph: 10 đơn → 1 câu SQL`. Nếu khách có hàng nghìn đơn thì phải phân trang — khi đó lấy trang ID đơn trước (hoặc dựa vào cách Hibernate 7 phân trang bằng subquery như trong pitfalls), rồi nạp chi tiết cho đúng các ID đó.
:::
