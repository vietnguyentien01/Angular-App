---
title: "Transaction không rollback và lost update — self-invocation, lỗi bị nuốt, và 20 request cùng trừ kho"
summary: "Tái hiện trên PostgreSQL: gọi nội bộ làm @Transactional mất tác dụng (dữ liệu lỗi vẫn lưu), bắt lỗi bên trong gây UnexpectedRollbackException, 20 request cùng trừ kho chỉ trừ được 1 khi đọc-rồi-ghi; sửa bằng @Version, khoá bi quan hoặc câu UPDATE nguyên tử."
level: intermediate
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, transaction, concurrency, optimistic-locking, pitfalls]
related: [spring-boot/review/transactions/transactional-co-ban, spring-boot/deep-dive/transactions/proxy-isolation-va-khoa]
---

## TL;DR

- `@Transactional` hoạt động nhờ **proxy**. Gọi `this.method()` trong cùng class **không** qua proxy → không có transaction.
- Bắt exception của một method `@Transactional` bên trong một transaction khác rồi tiếp tục → transaction đã bị đánh dấu **rollback-only**, commit ném **`UnexpectedRollbackException`**.
- **Đọc rồi ghi** (đọc tồn kho, trừ trong Java, ghi lại) trên dữ liệu dùng chung = **lost update** khi có nhiều request đồng thời.
- Sửa lost update: **`@Version`** (optimistic, xung đột thì báo lỗi để thử lại), **`PESSIMISTIC_WRITE`** (khoá dòng), hoặc **câu UPDATE có điều kiện** (nguyên tử, thường là tốt nhất cho bộ đếm).

## Cơ chế: proxy

```text
controller ──► [proxy KhoService] ──► mở transaction ──► KhoService.capNhatGia() ──► commit/rollback
                                                              │
                                     this.capNhatGia() ───────┘  (gọi thẳng, không đi qua proxy)
```

Spring bọc bean có `@Transactional` trong một lớp con sinh lúc chạy. Đã in ra: `proxy? true — lớp: TxLab$KhoService$$SpringCGLIB$$0`. Proxy chỉ chặn được lời gọi **từ bên ngoài** đi vào bean.

Mọi kết quả dưới đây chạy với profile `lab-tx` của dự án mẫu (PostgreSQL 16, giá gốc 1.500.000).

## Self-invocation

```java bad
@Service
class KhoService {
    public void nhapHangRoiLoi(Long id) { capNhatGia(id, new BigDecimal("999")); }   // gọi nội bộ

    @Transactional
    public void capNhatGia(Long id, BigDecimal gia) {
        SanPham sp = repo.findById(id).orElseThrow();
        sp.doiGia(gia);
        repo.save(sp);
        throw new IllegalStateException("lỗi sau khi đổi giá");
    }
}
```

```text
gọi kho.capNhatGia(...) từ bean khác  → giá = 1500000   (rollback)
gọi kho.nhapHangRoiLoi(...)            → giá = 999       (không có transaction: save tự commit)
```

Không có transaction bao ngoài, mỗi lời gọi repository chạy transaction riêng của nó, nên `save` commit ngay, exception sau đó không hoàn tác được gì.

```java good
// Cách 1: tách sang bean khác và gọi qua bean đó (rõ ràng nhất)
// Cách 2: đặt @Transactional ở method public được gọi từ ngoài (nhapHangRoiLoi)
// Cách 3: dùng TransactionTemplate trong code
```

Cùng nguyên nhân: `@Transactional` trên method `private`, hoặc `@Async`/`@Cacheable` gọi nội bộ — đều không có tác dụng.

## Bắt lỗi bên trong rồi commit

```java bad
@Transactional
public void batLoiBenTrong(Long id) {
    repo.findById(id).orElseThrow().doiGia(new BigDecimal("555"));
    try {
        kho.capNhatGia(id, new BigDecimal("444"));         // @Transactional (REQUIRED) — ném lỗi
    } catch (IllegalStateException e) {
        log.info("đã bắt lỗi bên trong: {}", e.getMessage());
    }
}
```

```text
đã bắt lỗi bên trong: lỗi sau khi đổi giá
→ UnexpectedRollbackException: Transaction silently rolled back because it has been marked as rollback-only
giá = 1500000
```

Exception đi ra khỏi proxy của `capNhatGia` → Spring đánh dấu transaction (dùng chung) là rollback-only. Bên ngoài bắt lỗi và tưởng mọi thứ ổn, nhưng commit bị từ chối. Muốn bước bên trong được phép thất bại độc lập: cho nó `REQUIRES_NEW`, hoặc kiểm tra điều kiện trước thay vì dùng exception.

## Lost update: 20 request cùng trừ kho

Tồn kho 100, 20 thread cùng trừ 1. Mong đợi: còn 80.

```java bad title="Đọc rồi ghi bằng JDBC, không có version"
Integer ton = jdbc.sql("select ton_kho from san_pham where id = ?").param(id).query(Integer.class).single();
// … các request khác cũng đã đọc 100 …
jdbc.sql("update san_pham set ton_kho = ? where id = ?").params(ton - 1, id).update();
```

| Cách | Còn lại | Thành công | Lỗi |
|---|---|---|---|
| Đọc rồi ghi, không version (JDBC) | **99** | 20 | 0 |
| JPA đọc rồi `sp.xuatKho(1)` với `@Version` | 99 | 1 | 19 × `ObjectOptimisticLockingFailureException` |
| `em.find(…, PESSIMISTIC_WRITE)` rồi trừ | 80 | 20 | 0 |
| `update … set ton_kho = ton_kho - :n where id = :id and ton_kho >= :n` | 80 | 20 | 0 |

- Dòng đầu là kiểu lỗi nguy hiểm nhất: **mọi request đều báo thành công** nhưng kho chỉ giảm 1. Bán vượt số hàng có thật.
- `@Version` (entity `SanPham` có `@Version private long version`) biến lost update thành **lỗi rõ ràng**: Hibernate sinh `update … where id=? and version=?`, cập nhật 0 dòng → exception. Request thua cần **thử lại** (đọc lại, tính lại) hoặc báo người dùng.
- Khoá bi quan cho mọi request xếp hàng trên dòng đó: đúng, nhưng giữ khoá suốt transaction — transaction dài thì chậm và dễ deadlock.
- Câu UPDATE nguyên tử để DB làm phép trừ và kiểm tra điều kiện trong **một** lệnh: không đọc trước, không khoá lâu, trả về số dòng bị ảnh hưởng (0 = không đủ hàng).

```java good
@Modifying
@Query("update SanPham s set s.tonKho = s.tonKho - :soLuong where s.id = :id and s.tonKho >= :soLuong")
int truKhoNeuDu(Long id, int soLuong);
```

## Pitfalls

- `@Transactional` trên controller: transaction dài qua cả phần serialize JSON và gọi dịch vụ ngoài.
- Gọi HTTP/gửi email **bên trong** transaction: giữ kết nối DB trong lúc chờ mạng; nếu sau đó rollback thì email đã gửi rồi. Dùng `AFTER_COMMIT` hoặc outbox (bài chuyên sâu).
- Bắt `ObjectOptimisticLockingFailureException` rồi bỏ qua — mất cập nhật của người dùng mà không báo.
- Retry khi gặp xung đột nhưng retry **bên trong** cùng transaction — phải retry cả transaction.

:::senior Góc nhìn senior
Hỏi với mọi thao tác ghi trên dữ liệu dùng chung (tồn kho, số dư, hạn mức, số ghế): *hai request cùng lúc thì sao?* Chọn chiến lược theo mức tranh chấp: bộ đếm nóng → UPDATE nguyên tử; entity được người dùng sửa qua form (ít tranh chấp) → `@Version` và trả 409 để frontend tải lại; quy trình nhiều bước trên một bản ghi → khoá bi quan trong transaction ngắn. Test concurrency bằng cách chạy song song thật (như bảng trên) — test tuần tự không bao giờ thấy lỗi này.
:::

:::version Spring Boot 3 và 4
Hành vi proxy, rollback-only và `UnexpectedRollbackException` giống nhau trên Spring 5/6/7. Spring mặc định dùng proxy CGLIB (lớp con) cho cả bean có interface, nên tên lớp có `$$SpringCGLIB$$`.
:::

:::interview Vì sao gọi một method `@Transactional` từ method khác trong cùng class thì không có transaction?
`@Transactional` được cài đặt bằng AOP proxy: Spring đưa ra ngoài một object bọc (proxy) quanh bean thật, proxy mở/commit/rollback transaction rồi chuyển lời gọi vào bean. Khi bean tự gọi `this.method()`, lời gọi đi thẳng vào object thật, bỏ qua proxy, nên annotation không có tác dụng. Cách sửa: chuyển method sang bean khác, đặt `@Transactional` ở method được gọi từ ngoài, hoặc dùng `TransactionTemplate`. Cùng giới hạn áp dụng cho `@Async`, `@Cacheable`, `@Retryable` dùng proxy.
:::

:::quiz 20 request đồng thời đọc tồn kho 100 rồi ghi `ton - 1` (không có `@Version`, không khoá). Kết quả có thể là gì?
- [ ] Luôn 80
- [x] Lớn hơn 80, mọi request vẫn báo thành công
- [ ] Ném exception cho 19 request
- [ ] Deadlock

Đã chạy: còn 99, 20 request đều thành công. Đây là lost update.
:::

:::quiz Cùng tình huống nhưng entity có `@Version`. Kết quả?
- [ ] 80, tất cả thành công
- [x] 1 request thành công, các request đọc cùng version còn lại nhận `ObjectOptimisticLockingFailureException`
- [ ] 99, tất cả thành công
- [ ] Deadlock

Đã chạy: còn 99, thành công 1, lỗi 19. Lỗi rõ ràng tốt hơn sai im lặng — nhưng cần retry hoặc báo người dùng.
:::

:::exercise Đặt hàng an toàn khi nhiều người mua cùng lúc
Sửa `DonHangService.taoDon` để không dùng `sp.xuatKho()` (đọc rồi trừ) mà dùng `truKhoNeuDu`; nếu không đủ hàng thì ném `HetHangException` và cả đơn rollback. Giải thích vì sao vẫn cần `@Transactional` trên `taoDon`.
???
```java
@Transactional
public DonHang taoDon(Long khachHangId, List<DongYeuCau> dong) {
    var kh = khachHangRepo.findById(khachHangId).orElseThrow(() -> new KhongTimThayException("khách hàng", khachHangId));
    var don = new DonHang(kh, clock.instant());
    for (DongYeuCau d : dong) {
        if (sanPhamRepo.truKhoNeuDu(d.sanPhamId(), d.soLuong()) == 0) {
            int con = sanPhamRepo.findById(d.sanPhamId()).map(SanPham::getTonKho).orElse(0);
            throw new HetHangException(d.sanPhamId(), con, d.soLuong());
        }
        SanPham sp = sanPhamRepo.getReferenceById(d.sanPhamId());
        don.themDong(sp, d.soLuong());
    }
    return donHangRepo.save(don);
}
```

Đã chạy với 20 đơn đồng thời cho sản phẩm còn 10:

```text
20 đơn đồng thời, tồn kho 10: thành công 10, hết hàng 10, còn 0, số đơn đã lưu 10
đơn 2 dòng, dòng 2 hết: Sản phẩm 3 chỉ còn 0, yêu cầu 1 → tồn kho sp1 = 5   (dòng 1 đã trừ 2 nhưng được hoàn tác)
```

Vẫn cần `@Transactional` vì một đơn có nhiều dòng: dòng 1 trừ kho thành công, dòng 2 hết hàng → exception phải hoàn tác cả lần trừ của dòng 1 và không lưu đơn. Lưu ý: `getReferenceById` trả proxy, cần nạp giá (`sp.getGia()`) trong cùng transaction — và vì bulk update bỏ qua persistence context, nếu entity sản phẩm đã được nạp trước đó trong transaction thì số tồn kho trên object không phản ánh lần trừ.
:::
