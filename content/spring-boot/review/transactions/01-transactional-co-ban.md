---
title: "@Transactional cơ bản — ranh giới transaction, rollback, readOnly và propagation"
summary: "Nhắc nhanh @Transactional đặt ở đâu, khi nào rollback (RuntimeException có, checked exception không), readOnly, REQUIRED và REQUIRES_NEW, và sự kiện sau commit. Mọi kết quả chạy thật trên PostgreSQL 16 với Spring Boot 4.1.2."
type: card
level: core
version: 4
lastReviewed: 2026-11-19
tags: [spring-boot, transaction, jpa, rollback]
related: [spring-boot/consolidate/transactions/transaction-khong-rollback-va-lost-update, spring-boot/deep-dive/transactions/proxy-isolation-va-khoa]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

- Đặt `@Transactional` trên **method public của service** — đó là ranh giới một đơn vị nghiệp vụ (tạo đơn = trừ kho + lưu đơn, cùng thành công hoặc cùng huỷ).
- Mặc định **rollback khi có `RuntimeException`/`Error`**, **commit khi có checked exception**. Muốn khác thì dùng `rollbackFor`.
- Method chỉ đọc: `@Transactional(readOnly = true)` — PostgreSQL còn **từ chối** lệnh ghi trong transaction này.
- `REQUIRED` (mặc định) tham gia transaction đang có; `REQUIRES_NEW` mở transaction riêng (vd ghi nhật ký vẫn lưu dù nghiệp vụ lỗi).
- Việc chỉ nên làm khi dữ liệu đã chắc chắn lưu (gửi email, đẩy message) → `@TransactionalEventListener(phase = AFTER_COMMIT)`.

## Ví dụ (đã chạy, profile `lab-tx` của dự án mẫu)

```java title="DonHangService.java"
@Transactional
public DonHang taoDon(Long khachHangId, List<DongYeuCau> dong) {
    var kh = khachHangRepo.findById(khachHangId).orElseThrow(() -> new KhongTimThayException("khách hàng", khachHangId));
    var don = new DonHang(kh, clock.instant());
    for (DongYeuCau d : dong) {
        SanPham sp = sanPhamRepo.findById(d.sanPhamId()).orElseThrow(…);
        sp.xuatKho(d.soLuong());          // ném HetHangException (RuntimeException) nếu không đủ
        don.themDong(sp, d.soLuong());
    }
    return donHangRepo.save(don);
}
```

Gửi đơn có dòng thứ hai hết hàng → 409, và tồn kho của dòng thứ nhất **không** bị trừ (bài *Xử lý lỗi API* có response thật).

Kết quả với từng loại exception (giá gốc 1.500.000):

```text
RuntimeException trong @Transactional        → giá = 1500000   (rollback)
checked exception trong @Transactional       → giá = 777       (commit!)
checked exception + rollbackFor = Exception  → giá = 1500000   (rollback)
```

```java title="Ghi nhật ký vẫn lưu khi nghiệp vụ lỗi"
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void ghi(String noiDung) { em.persist(new NhatKy(noiDung)); }
// nghiệp vụ gọi ghi(...) rồi ném lỗi → nhật ký 0 → 1, giá vẫn 1500000
```

```java title="Gửi email chỉ khi commit thành công"
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
void sauCommit(DaThanhToan e) { … }
```

```text
thanh toán thành công:  [@EventListener] nhận sự kiện ngay khi publish
                        [AFTER_COMMIT] gửi email cho sản phẩm 1
thanh toán lỗi:         [@EventListener] nhận sự kiện ngay khi publish
                        (không có AFTER_COMMIT — không gửi email cho giao dịch đã huỷ)
```

## Bảng chọn nhanh

| Cần | Cách |
|---|---|
| Nhiều thao tác ghi thành công/thất bại cùng nhau | `@Transactional` trên method service |
| Chỉ đọc | `@Transactional(readOnly = true)` |
| Rollback cả với checked exception | `@Transactional(rollbackFor = Exception.class)` |
| Lưu nhật ký/audit độc lập với kết quả | `REQUIRES_NEW` trên bean **khác** |
| Hành động sau khi commit | `@TransactionalEventListener(AFTER_COMMIT)` |
| Kiểm soát transaction bằng code | `TransactionTemplate` |
| Giới hạn thời gian | `@Transactional(timeout = 5)` (giây) |

## Lỗi hay gặp: checked exception không rollback

```java bad
@Transactional
public void nhapKho(…) throws IOException {
    capNhatTonKho(…);
    docFileHoaDon(…);          // ném IOException → transaction VẪN commit phần đã cập nhật
}
```

```java good
@Transactional(rollbackFor = Exception.class)
public void nhapKho(…) throws IOException { … }
// hoặc bọc IOException thành exception nghiệp vụ unchecked
```

Đây là quy ước kế thừa từ EJB: checked exception được coi là "kết quả nghiệp vụ có thể xử lý". Trong code hiện đại, exception nghiệp vụ thường là unchecked nên vấn đề ít gặp, nhưng thư viện I/O vẫn ném checked.

:::version Spring Boot 3 và 4
Ngữ nghĩa `@Transactional` không đổi qua Spring 5/6/7. Dùng `org.springframework.transaction.annotation.Transactional` — `jakarta.transaction.Transactional` cũng được Spring hỗ trợ nhưng thiếu `readOnly`, `propagation` chi tiết.
:::

:::interview `@Transactional` rollback trong trường hợp nào?
Mặc định khi một `RuntimeException` hoặc `Error` thoát ra khỏi method có `@Transactional`. Checked exception thì transaction vẫn commit, trừ khi khai báo `rollbackFor`. Exception bị bắt và nuốt bên trong method thì không có rollback (với một ngoại lệ: nếu exception đi qua một method `@Transactional` khác tham gia cùng transaction, transaction bị đánh dấu rollback-only và commit cuối sẽ ném `UnexpectedRollbackException`). `@Transactional` chỉ có tác dụng khi lời gọi đi qua proxy của Spring — gọi nội bộ trong cùng class thì không.
:::

:::quiz Method `@Transactional` cập nhật giá rồi ném `IOException`. Giá trong DB?
- [ ] Không đổi — mọi exception đều rollback
- [x] Đã đổi — checked exception mặc định commit
- [ ] Tuỳ DB
- [ ] Lỗi biên dịch

Đã chạy: `checked exception → giá = 777`.
:::

:::quiz Method `@Transactional thanhToan()` publish sự kiện `DaThanhToan`, rồi ở dòng sau ném `RuntimeException` (transaction rollback). Có hai listener cho sự kiện này. Listener nào chạy?
```java
@EventListener
void a(DaThanhToan e) { log.info("[@EventListener]"); }

@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
void b(DaThanhToan e) { log.info("[AFTER_COMMIT]"); }
```

- [x] `@EventListener` (chạy ngay khi publish)
- [ ] `@TransactionalEventListener(phase = AFTER_COMMIT)`
- [ ] Cả hai
- [ ] Không cái nào

Đã chạy: chỉ thấy dòng `[@EventListener]`. Dùng AFTER_COMMIT cho mọi tác động ra bên ngoài (email, SMS, message queue).
:::

:::quiz Transaction `readOnly = true` thực hiện một câu `UPDATE` trên PostgreSQL. Kết quả?
- [ ] UPDATE chạy bình thường, `readOnly` chỉ là gợi ý
- [x] Lỗi: *cannot execute UPDATE in a read-only transaction*
- [ ] UPDATE bị bỏ qua im lặng
- [ ] Transaction tự chuyển thành ghi

Đã chạy (bài chuyên sâu). Với PostgreSQL, Spring đặt kết nối ở chế độ read-only và DB thực thi điều đó.
:::
