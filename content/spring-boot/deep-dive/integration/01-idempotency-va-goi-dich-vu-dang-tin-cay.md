---
title: "Idempotency và gọi dịch vụ đáng tin cậy — một request thanh toán chỉ trừ tiền một lần"
summary: "Tái hiện trên PostgreSQL: 5 request thanh toán giống nhau trừ tiền 5 lần; thêm Idempotency-Key với bảng có khoá chính và INSERT … ON CONFLICT DO NOTHING thì chỉ trừ 1 lần, các request trùng nhận lại kết quả cũ. Kèm thiết kế cho retry, job định kỳ nhiều instance và outbox."
level: advanced
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, idempotency, reliability, postgresql, distributed-systems]
related: [spring-boot/consolidate/integration/timeout-retry-va-gioi-han-dong-thoi, spring-boot/deep-dive/transactions/proxy-isolation-va-khoa]
---

## TL;DR

- Mạng không đáng tin: request có thể **đã được xử lý** dù client nhận timeout. Client (hoặc chính bạn khi retry) sẽ gửi lại.
- **Idempotent** = gọi nhiều lần cho cùng kết quả như gọi một lần. GET/PUT/DELETE vốn idempotent; POST thì không — trừ khi có **idempotency key**.
- Cài đặt: client sinh một khoá duy nhất cho mỗi thao tác (UUID), gửi trong header `Idempotency-Key`; server lưu khoá trong bảng có **khoá chính**, request đầu xử lý, request trùng trả lại kết quả đã lưu.
- Để DB đảm bảo "chỉ một": `INSERT … ON CONFLICT DO NOTHING` + transaction. Không dùng "SELECT xem có chưa rồi INSERT" (check-then-act).
- Cùng tư duy cho **job định kỳ** chạy trên nhiều instance và cho **message** gửi đi ít nhất một lần.

## Cơ chế

```text
client ── POST /thanh-toan  Idempotency-Key: khoa-7f3a ──► server
                                                       BEGIN
                                                       INSERT INTO yeu_cau_da_xu_ly(khoa) VALUES ('khoa-7f3a') ON CONFLICT DO NOTHING
                                                        ├─ 1 dòng → request đầu tiên: trừ tiền, lưu kết quả vào dòng đó, COMMIT
                                                        └─ 0 dòng → khoá đã có: SELECT ket_qua … FOR UPDATE (chờ request đầu commit), trả lại
```

Trên PostgreSQL, hai `INSERT` cùng khoá chính chạy đồng thời: cái sau **chờ** transaction của cái trước kết thúc, rồi thấy xung đột và không chèn. Nhờ vậy không cần khoá ở tầng ứng dụng, chạy đúng cả khi có nhiều instance.

```sql title="V4__idempotency.sql"
CREATE TABLE yeu_cau_da_xu_ly (
  khoa      text PRIMARY KEY,
  ket_qua   text,
  tao_luc   timestamptz NOT NULL DEFAULT now()
);
```

```java title="ThanhToanService.java"
@Transactional
public String thanhToan(String khoa, String donId) {
    int moi = jdbc.sql("insert into yeu_cau_da_xu_ly(khoa) values (?) on conflict (khoa) do nothing")
                  .param(khoa).update();
    if (moi == 0) {
        return "TRẢ LẠI: " + jdbc.sql("select ket_qua from yeu_cau_da_xu_ly where khoa = ? for update")
                                 .param(khoa).query(String.class).single();
    }
    String kq = truTien(donId);                                     // thao tác không được lặp
    jdbc.sql("update yeu_cau_da_xu_ly set ket_qua = ? where khoa = ?").params(kq, khoa).update();
    return kq;
}
```

## Số đo (profile `lab-idem`, PostgreSQL 16)

```text
không idempotency, 5 request giống nhau: trừ tiền 5 lần
có Idempotency-Key, 5 request đồng thời: trừ tiền 1 lần;
   kết quả: [đã trừ tiền đơn D2, TRẢ LẠI: đã trừ tiền đơn D2, TRẢ LẠI: …, TRẢ LẠI: …, TRẢ LẠI: …]
gửi lại sau 1 phút: TRẢ LẠI: đã trừ tiền đơn D2; đã trừ thêm 0
```

Chi tiết cài đặt thật cần thêm:

- Lưu cả **mã HTTP và body** đã trả để trả lại y hệt; lưu **băm nội dung request** — cùng khoá mà body khác là lỗi của client (422/409).
- Khoá theo phạm vi người dùng (`khach_hang_id + khoa`) để người này không đụng khoá của người kia.
- Thời hạn lưu (24 giờ, 7 ngày) và job dọn dẹp.
- Nếu xử lý lỗi (exception) thì transaction rollback, dòng khoá cũng biến mất → client gửi lại được. Lỗi nghiệp vụ "đã biết" (thẻ hết hạn) thì nên lưu kết quả lỗi để không xử lý lại.
- Thao tác có gọi ra ngoài (cổng thanh toán) thì không gói trọn trong một transaction DB được: lưu trạng thái `DANG_XU_LY`, gọi đối tác (với idempotency key của đối tác), cập nhật kết quả; request trùng thấy `DANG_XU_LY` thì trả 409/202 để client hỏi lại sau.

## Job định kỳ trên nhiều instance

`@Scheduled(cron = "0 0 2 * * *")` chạy trên **mọi** instance. Ba pod → job đối soát chạy ba lần. Các lựa chọn:

| Cách | Ghi chú |
|---|---|
| Thiết kế job idempotent (đánh dấu từng bản ghi đã xử lý) | Luôn nên làm, kể cả khi đã có khoá |
| Khoá trên DB (thư viện ShedLock, hoặc `SELECT … FOR UPDATE SKIP LOCKED` theo lô) | Phổ biến với Spring Boot |
| Chạy job ở một nơi riêng (Kubernetes CronJob, Spring Batch) | Tách khỏi service xử lý request |

`FOR UPDATE SKIP LOCKED` cho phép nhiều worker lấy các lô **khác nhau** từ cùng một bảng mà không chờ nhau — cũng là cách tiến trình đọc bảng outbox (bài *Proxy, isolation và khoá*) mở rộng ra nhiều instance.

## So sánh phương án

| Vấn đề | Giải pháp |
|---|---|
| Client gửi lại POST sau timeout | Idempotency-Key + bảng khoá chính |
| Bấm nút hai lần trên frontend | Vẫn cần idempotency ở server (frontend chỉ giảm khả năng) |
| Không trùng dữ liệu nghiệp vụ (một hợp đồng một số) | UNIQUE constraint |
| Gửi message sau commit, không mất | Outbox + gửi ít nhất một lần + bên nhận idempotent |
| Retry khi gọi đối tác | Chỉ với thao tác idempotent hoặc đối tác nhận idempotency key |

## Tính năng mới theo phiên bản

- Spring Framework 7 / Boot 4 có `@Retryable`, `@ConcurrencyLimit`, `RetryTemplate` trong core — retry và giới hạn đồng thời không cần thư viện ngoài.
- Idempotency key **không** có sẵn trong Spring; tự cài đặt như trên hoặc dùng thư viện. Header `Idempotency-Key` có bản nháp đặc tả tại IETF (nhóm HTTPAPI) — kiểm tra trạng thái hiện tại trước khi trích dẫn; nhiều cổng thanh toán đã dùng header này từ lâu.

:::senior Góc nhìn senior
Trong hệ thống tài chính, câu hỏi review quan trọng nhất cho mọi endpoint ghi là: *"gửi hai lần thì sao?"*. Đặt idempotency ở biên (API thanh toán, API tạo hồ sơ), dùng DB làm trọng tài (khoá chính/UNIQUE), và làm cho mọi consumer message idempotent. Khi tích hợp đối tác, đọc kỹ họ hỗ trợ idempotency thế nào và có API tra cứu trạng thái giao dịch hay không — đó là thứ cứu bạn khi gặp timeout.
:::

:::quiz Client gửi `POST /thanh-toan` và nhận timeout sau 1 giây. Kết luận nào đúng?
- [ ] Giao dịch chắc chắn chưa xảy ra, gửi lại an toàn
- [ ] Giao dịch chắc chắn đã xảy ra
- [x] Không biết — server có thể đã xử lý; chỉ gửi lại an toàn khi có idempotency key (hoặc tra cứu trạng thái trước)
- [ ] Server sẽ tự rollback

Timeout chỉ nói client đã ngừng chờ, không nói gì về phía server.
:::

:::quiz Vì sao không cài idempotency bằng "SELECT xem khoá có chưa, chưa có thì xử lý rồi INSERT khoá"?
- [ ] Vì chậm hơn
- [x] Hai request đồng thời cùng thấy "chưa có" và cùng xử lý (check-then-act)
- [ ] Vì PostgreSQL không hỗ trợ SELECT trước INSERT
- [ ] Vì cần Redis

Dùng ràng buộc khoá chính và `INSERT … ON CONFLICT DO NOTHING` để DB quyết định ai là người đầu tiên. Đã đo: 5 request đồng thời chỉ trừ tiền 1 lần.
:::
