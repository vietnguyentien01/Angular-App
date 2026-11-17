---
title: "Unit of Work, transactional outbox và saga — giữ dữ liệu nhất quán khi có message và nhiều service"
summary: "Ghi DB rồi gửi broker mất sự kiện khi process chết giữa hai bước, đã tái hiện trên PostgreSQL 16. Outbox ghi sự kiện cùng transaction, relay gửi bằng FOR UPDATE SKIP LOCKED: 4 relay gửi đúng 1.000 lần, bỏ khoá thì trùng 470–560. Consumer idempotent và saga có bước bù."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, outbox, saga, unit-of-work, postgresql, distributed-systems]
related: [design-patterns/review/architecture/layered-hexagonal-va-repository, spring-boot/deep-dive/integration/idempotency-va-goi-dich-vu-dang-tin-cay]
---

## Tóm tắt nhanh

- **Unit of Work**: gom mọi thay đổi của một thao tác nghiệp vụ, ghi xuống **một lần** trong một transaction. Persistence context của JPA và `@Transactional` là Unit of Work.
- **Dual write** (ghi DB rồi gửi Kafka/RabbitMQ) không thể nguyên tử: process chết giữa hai bước → đơn có trong DB nhưng **không ai biết**. Đã tái hiện.
- **Transactional outbox**: ghi sự kiện vào bảng `outbox` **cùng transaction** với dữ liệu; một relay đọc bảng và gửi đi. Dữ liệu và sự kiện cùng sống hoặc cùng chết.
- Outbox đảm bảo **at-least-once**: relay chết sau khi gửi, trước khi đánh dấu → gửi lại → consumer phải **idempotent** (bảng sự kiện đã xử lý).
- Nhiều relay song song cần `FOR UPDATE SKIP LOCKED`. Đo được: 4 relay, 1.000 sự kiện → đúng 1.000 lần gửi; bỏ khoá → 1.470–1.560 lần.
- **Saga**: transaction dài qua nhiều service, mỗi bước có **bước bù** (compensation). Không rollback được thì bù.

## Cơ chế: vì sao dual write hỏng

```text
datHang():  BEGIN → insert don_hang → COMMIT → broker.send(DonHangDaTao)
                                          ▲
                              process bị kill ở đây → đơn tồn tại, sự kiện không bao giờ đi
```

Đảo thứ tự (gửi trước rồi commit) thì ngược lại: commit lỗi → có sự kiện cho một đơn không tồn tại. Không có thứ tự nào đúng, vì DB và broker là hai hệ thống, không chung transaction (XA/2PC thì chậm và phần lớn broker hiện đại không hỗ trợ).

Tái hiện trên PostgreSQL 16 (broker giả lập bằng một danh sách trong bộ nhớ):

```text
ghi kép: process bị kill sau commit
ghi kép: đơn trong DB = 2, sự kiện trong broker = 1 [DonHangDaTao:DH1]
```

DH2 đã được trừ tiền, ghi DB — nhưng kho, email, kế toán không bao giờ nghe thấy.

## Outbox

```sql
create table ob.outbox(
  id bigserial primary key, loai text not null, du_lieu text not null,
  tao_luc timestamptz not null default now(), gui_luc timestamptz);
```

```java good title="Ghi đơn và sự kiện trong MỘT transaction"
c.setAutoCommit(false);
insert into ob.don_hang values (?, ?)
insert into ob.outbox(loai, du_lieu) values ('DonHangDaTao', ?)
c.commit();
```

```java good title="Relay"
select id, du_lieu from ob.outbox where gui_luc is null order by id limit 10
for update skip locked;                 -- khoá các dòng đang gửi, relay khác bỏ qua chúng
// gửi từng sự kiện lên broker
update ob.outbox set gui_luc = now() where id = ?;
commit;
```

```text
outbox: process bị kill sau commit
outbox: đơn = 2, outbox chưa gửi = 2, broker = 0              ← sự kiện nằm an toàn trong DB
relay: relay chết sau khi gửi, trước khi đánh dấu → broker = 2, outbox chưa gửi = 2
relay chạy lại: gửi 2, broker = 4 [1:DonHangDaTao:DH1, 2:DonHangDaTao:DH2, 1:DonHangDaTao:DH1, 2:DonHangDaTao:DH2]
consumer: xử lý 2 sự kiện (bỏ qua bản trùng)
```

Ba điều cần thấy:

1. Process chết sau commit: không mất gì — sự kiện đã nằm trong `outbox`.
2. Relay chết giữa "gửi" và "đánh dấu": sự kiện bị gửi **hai lần**. Đây là bản chất của at-least-once, không phải lỗi của cài đặt.
3. Consumer chống trùng bằng khoá chính trên `id` sự kiện:

```sql
insert into ob.da_xu_ly values (?) on conflict do nothing;   -- 1 dòng: lần đầu, xử lý; 0 dòng: trùng, bỏ qua
```

Bảng `da_xu_ly` phải nằm **cùng transaction** với thay đổi mà consumer làm, nếu không bạn lại có dual write ở phía consumer.

## Nhiều relay song song

1.000 sự kiện, 4 relay chạy cùng lúc, mỗi lần lấy 10 dòng:

```text
có  FOR UPDATE SKIP LOCKED: gửi 1000 lần cho 1000 sự kiện, còn chưa gửi 0, trùng trong broker = 0
không khoá (lần 1):         gửi 1470 lần cho 1000 sự kiện, còn chưa gửi 0, trùng trong broker = 470
không khoá (lần 2):         gửi 1560 lần cho 1000 sự kiện, còn chưa gửi 0, trùng trong broker = 560
```

Không khoá, nhiều relay cùng đọc thấy một dòng `gui_luc is null` và cùng gửi. `FOR UPDATE` đơn thuần thì đúng nhưng các relay xếp hàng chờ nhau; `SKIP LOCKED` cho relay sau lấy **lô khác** ngay. Consumer vẫn phải idempotent — khoá chỉ giảm trùng, không loại được trùng do relay chết giữa chừng.

## Saga: khi một thao tác trải qua nhiều service

Đặt hàng = tạo đơn (service đơn) → giữ kho (service kho) → trừ tiền (service thanh toán) → xác nhận. Không có transaction chung. Mỗi bước có một **bước bù**:

```java title="Saga điều phối (orchestration), rút gọn"
record Buoc(String ten, Runnable lam, Runnable bu) {}

static boolean chay(List<Buoc> buoc) {
    var daXong = new ArrayDeque<Buoc>();
    for (var b : buoc) {
        try { b.lam().run(); daXong.push(b); }
        catch (RuntimeException e) {
            while (!daXong.isEmpty()) daXong.pop().bu().run();    // bù theo thứ tự ngược
            return false;
        }
    }
    return true;
}
```

```text
thành công? true  [✓ tạo đơn, ✓ giữ kho 2, ✓ trừ tiền 300000, ✓ xác nhận đơn] | đơn=DA_XAC_NHAN kho=8 số dư=700000
thành công? false [✓ tạo đơn, ✓ giữ kho 3, ✗ trừ tiền 900000: không đủ số dư, ↩ bù giữ kho 3, ↩ bù tạo đơn] | đơn=DA_HUY kho=8 số dư=700000
```

Bản thật khác bản rút gọn ở chỗ: mỗi bước là một message/lời gọi qua mạng (đi qua outbox), trạng thái saga được **lưu DB** để tiếp tục sau khi process khởi động lại, và bước bù cũng có thể lỗi — phải thử lại tới khi thành công (bước bù phải idempotent). Bù không phải "xoá như chưa có gì": đơn chuyển sang `DA_HUY`, vẫn để lại dấu vết cho kiểm toán.

## So sánh phương án

| Vấn đề | Cách | Đánh đổi |
|---|---|---|
| Ghi nhiều bảng trong một service | Transaction DB (Unit of Work) | Đơn giản nhất — dùng khi có thể |
| Ghi DB + phát sự kiện | Outbox + relay (polling hoặc CDC như Debezium) | Thêm bảng, độ trễ vài trăm ms, at-least-once |
| Ghi DB + phát sự kiện, "nhanh gọn" | `@TransactionalEventListener(AFTER_COMMIT)` gửi trực tiếp | Mất sự kiện khi process chết sau commit |
| Nhiều service cùng một thao tác | Saga (điều phối hoặc biên đạo) | Trạng thái trung gian nhìn thấy được, cần bước bù |
| Nhiều DB cùng một transaction | 2PC/XA | Chậm, khoá lâu, phụ thuộc hỗ trợ của hạ tầng — hiếm dùng |

**Điều phối** (orchestration, như trên): một nơi biết toàn bộ luồng, dễ theo dõi. **Biên đạo** (choreography): mỗi service nghe sự kiện và tự làm bước của mình — lỏng hơn nhưng khó trả lời "đơn DH2 đang ở bước nào".

## Tính năng mới theo phiên bản

- **PostgreSQL 9.5**: `SKIP LOCKED` và `ON CONFLICT` — hai thứ làm outbox và consumer idempotent trở nên gọn.
- **Java 21**: virtual thread — relay chạy nhiều luồng polling rẻ hơn, nhưng `SKIP LOCKED` vẫn là thứ ngăn trùng.
- **Spring Modulith**: có sẵn "event publication registry" — một dạng outbox cho sự kiện giữa các module trong cùng ứng dụng.

:::senior Góc nhìn senior
Trước khi dựng outbox và saga, hỏi lại: hai thứ này có **thật sự** phải ở hai service không? Một transaction DB trong một service rẻ hơn mọi pattern phân tán. Khi đã cần, ba thứ phải có từ ngày đầu: id sự kiện duy nhất và consumer idempotent; dọn bảng outbox (xoá dòng đã gửi sau N ngày, nếu không bảng phình mãi); và giám sát "sự kiện chưa gửi lâu nhất bao nhiêu giây" — chỉ số đó tăng là relay đang chết.
:::

:::quiz Relay gửi sự kiện lên broker thành công rồi bị kill trước khi `update outbox set gui_luc = now()`. Điều gì xảy ra?
- [ ] Sự kiện bị mất
- [x] Lần chạy sau relay gửi lại sự kiện đó; consumer nhận hai lần và phải tự chống trùng
- [ ] PostgreSQL tự đánh dấu đã gửi
- [ ] Broker tự loại bản trùng

Đã tái hiện: broker có 4 message cho 2 sự kiện; consumer dùng `on conflict do nothing` nên chỉ xử lý 2.
:::

:::exercise Thiết kế consumer idempotent cho tích điểm
Service tích điểm nhận `DonHangDaTao(suKienId, maKhach, tongTien)` và cộng `tongTien / 10_000` điểm. Message có thể đến hai lần và đến không theo thứ tự. Viết phần xử lý (SQL + Java) sao cho mỗi sự kiện chỉ cộng điểm một lần, kể cả khi service chết giữa chừng.
???
Ghi nhận "đã xử lý" và cộng điểm **trong cùng một transaction**:

```java
@Transactional
void xuLy(DonHangDaTao e) {
    int moi = jdbc.sql("insert into da_xu_ly(su_kien_id) values (?) on conflict do nothing")
                  .param(e.suKienId()).update();
    if (moi == 0) return;                                   // đã xử lý trước đó
    jdbc.sql("update diem set so_diem = so_diem + ? where ma_khach = ?")
        .params(e.tongTien() / 10_000, e.maKhach()).update();
}
```

- Chết sau `insert` nhưng trước `commit` → cả hai bị rollback, lần nhận lại xử lý bình thường.
- Nhận hai lần → lần hai `insert` trả 0 dòng, bỏ qua. Đã kiểm chứng cơ chế này với bảng `ob.da_xu_ly`: 4 message, 2 lần xử lý.
- Không theo thứ tự: cộng điểm là phép **giao hoán** nên thứ tự không quan trọng. Nếu là cập nhật trạng thái (đơn đã giao rồi mới tới "đơn đang giao"), cần thêm số phiên bản trong sự kiện và chỉ áp dụng khi phiên bản mới hơn (`update ... where phien_ban < ?`).
- Chỉ **ack** message với broker **sau** khi commit. Ack trước rồi chết là mất sự kiện.
:::
