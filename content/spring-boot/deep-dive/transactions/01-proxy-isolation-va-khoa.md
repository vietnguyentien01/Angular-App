---
title: "Proxy, isolation level và khoá — transaction nhìn từ phía PostgreSQL"
summary: "Đo trên PostgreSQL 16: READ COMMITTED (mặc định) thấy dữ liệu người khác vừa commit, REPEATABLE READ thì không nhưng ném lỗi serialize khi cập nhật trùng; readOnly bị DB thực thi; PESSIMISTIC_WRITE sinh FOR NO KEY UPDATE; và mẫu outbox cho việc gửi message sau commit."
level: advanced
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, transaction, isolation, locking, postgresql, internals]
related: [spring-boot/consolidate/transactions/transaction-khong-rollback-va-lost-update, spring-boot/deep-dive/data/persistence-context-va-dirty-checking]
---

## Tóm tắt nhanh

- `@Transactional` = proxy + `PlatformTransactionManager` (JPA: `JpaTransactionManager`) + một kết nối JDBC gắn với **thread** trong suốt transaction.
- PostgreSQL mặc định **READ COMMITTED**: mỗi câu lệnh thấy dữ liệu đã commit tại thời điểm câu lệnh chạy — đọc hai lần có thể ra hai kết quả.
- **REPEATABLE READ** cho một ảnh chụp cố định suốt transaction; cập nhật dòng mà transaction khác đã sửa → **`could not serialize access due to concurrent update`** → ứng dụng phải **retry**.
- `PESSIMISTIC_WRITE` trên PostgreSQL với Hibernate 7 sinh `SELECT … FOR NO KEY UPDATE`.
- Gửi message/email đáng tin cậy sau commit: **outbox** (ghi vào bảng trong cùng transaction, gửi bằng tiến trình riêng).

## Cơ chế: transaction gắn với thread

```text
proxy.taoDon() ─► TransactionInterceptor
                    ├─ lấy kết nối từ HikariCP, setAutoCommit(false), isolation/readOnly nếu có
                    ├─ gắn kết nối + EntityManager vào ThreadLocal (TransactionSynchronizationManager)
                    ├─ gọi method thật — mọi repository trên CÙNG thread dùng chung kết nối đó
                    └─ commit / rollback, trả kết nối về pool, chạy callback AFTER_COMMIT
```

Hệ quả:

- Code chạy trên **thread khác** (`CompletableFuture.supplyAsync`, `@Async`, parallel stream) **không** tham gia transaction hiện tại.
- Số transaction đồng thời bị giới hạn bởi pool kết nối (HikariCP mặc định 10). Transaction giữ kết nối trong lúc chờ HTTP là cách nhanh nhất làm cạn pool.
- `REQUIRES_NEW` tạm treo transaction ngoài và lấy **kết nối thứ hai** — lồng sâu dưới tải cao có thể tự deadlock ở pool.

## Isolation trên PostgreSQL (đã chạy)

Kịch bản: T1 đọc tồn kho, T2 (thread khác) trừ 30 và commit, T1 đọc lại rồi trừ 1.

```java
var t1 = new TransactionTemplate(tm);
t1.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);   // hoặc READ_COMMITTED
t1.executeWithoutResult(s -> {
    int lan1 = jdbc.sql("select ton_kho from san_pham where id = 2").query(Integer.class).single();
    // … T2 trừ 30 và commit trên thread khác …
    int lan2 = jdbc.sql("select ton_kho from san_pham where id = 2").query(Integer.class).single();
    jdbc.sql("update san_pham set ton_kho = ton_kho - 1 where id = 2").update();
});
```

```text
READ COMMITTED:  đọc lần 1 = 100, transaction khác trừ 30 và commit, đọc lần 2 = 70
READ COMMITTED:  cập nhật sau đó thành công
REPEATABLE READ: đọc lần 1 = 100, transaction khác trừ 30 và commit, đọc lần 2 = 100
REPEATABLE READ: cập nhật sau đó → CannotAcquireLockException / ERROR: could not serialize access due to concurrent update
```

| Isolation (PostgreSQL) | Đọc lại thấy commit mới? | Cập nhật dòng đã bị sửa | Dùng khi |
|---|---|---|---|
| READ COMMITTED (mặc định) | Có | Chờ rồi áp lên giá trị mới | Đa số nghiệp vụ, kết hợp UPDATE nguyên tử / khoá / version |
| REPEATABLE READ | Không (ảnh chụp) | Lỗi serialize → retry | Báo cáo cần số liệu nhất quán trong nhiều câu |
| SERIALIZABLE | Không | Lỗi serialize khi có xung đột bất kỳ → retry | Quy tắc nghiệp vụ phức tạp xuyên nhiều dòng |

Với READ COMMITTED, `update … set ton_kho = ton_kho - 1` vẫn đúng vì PostgreSQL đọc lại dòng mới nhất khi cập nhật. Cái sai là **tính trong Java** từ giá trị đã đọc trước đó (bài *Lost update*).

`readOnly = true`:

```text
readOnly + UPDATE → ERROR: cannot execute UPDATE in a read-only transaction
```

## Khoá bi quan

```java
em.find(SanPham.class, 1L, LockModeType.PESSIMISTIC_WRITE);
```

```sql
select sp1_0.id, sp1_0.gia, sp1_0.ten, sp1_0.ton_kho, sp1_0.version
from san_pham sp1_0 where sp1_0.id=? for no key update of sp1_0
```

`FOR NO KEY UPDATE` khoá dòng với các transaction khác muốn sửa nó, nhưng **không** chặn việc chèn dòng con tham chiếu tới nó (vd `dong_don_hang` trỏ tới `san_pham`) — nhẹ hơn `FOR UPDATE`. Đặt timeout chờ khoá bằng hint `jakarta.persistence.lock.timeout` để request không treo vô hạn.

## Outbox: tác động ra ngoài một cách đáng tin cậy

`@TransactionalEventListener(AFTER_COMMIT)` gửi email sau commit — nhưng nếu process chết ngay sau commit, email mất. Với tích hợp quan trọng (gửi sang hệ thống kế toán, Kafka):

```text
transaction nghiệp vụ:  INSERT don_hang …; INSERT outbox(su_kien='DON_DA_THANH_TOAN', du_lieu=…)  → commit cùng lúc
tiến trình gửi:         SELECT … FROM outbox WHERE da_gui = false FOR UPDATE SKIP LOCKED LIMIT 100
                        → gửi → UPDATE outbox SET da_gui = true
```

Đảm bảo *ít nhất một lần* (at-least-once): bên nhận phải xử lý trùng (idempotent, bài *Gọi dịch vụ & tác vụ nền*). Spring Modulith có sẵn cơ chế event publication registry làm việc tương tự.

## So sánh phương án đồng thời

| Vấn đề | Giải pháp | Đánh đổi |
|---|---|---|
| Bộ đếm (tồn kho, lượt) | `UPDATE … SET x = x - n WHERE x >= n` | Logic nằm trong SQL |
| Form sửa ít tranh chấp | `@Version` + 409 cho client | Người thua phải làm lại |
| Nhiều bước trên một bản ghi | `PESSIMISTIC_WRITE`, transaction ngắn | Chặn người khác, cần timeout |
| Báo cáo nhiều câu nhất quán | `REPEATABLE READ` + `readOnly` | Có thể cần retry |
| Ràng buộc xuyên nhiều dòng | `SERIALIZABLE` + retry, hoặc ràng buộc trong DB | Retry nhiều khi tải cao |
| Không cho trùng | `UNIQUE` constraint trong DB | Bắt `DataIntegrityViolationException` → 409 |

## Tính năng mới theo phiên bản

- Ngữ nghĩa isolation và propagation của `@Transactional` không đổi qua Spring 5/6/7; khác biệt nằm ở DB (PostgreSQL, Oracle, SQL Server xử lý REPEATABLE READ khác nhau).
- **Spring Framework 7**: có sẵn `@Retryable` và `@ConcurrencyLimit` trong `spring-context` (package `org.springframework.resilience.annotation`, bật bằng `@EnableResilientMethods`) — tiện cho việc thử lại khi gặp lỗi serialize mà không cần thư viện Spring Retry (bài *Gọi dịch vụ & tác vụ nền*).

:::senior Góc nhìn senior
Isolation level không thay thế được thiết kế. Phần lớn hệ thống enterprise chạy tốt ở READ COMMITTED nếu: thao tác trên bộ đếm là UPDATE nguyên tử, entity người dùng sửa có `@Version`, quy tắc "không trùng" là UNIQUE constraint, và transaction ngắn, không chứa I/O mạng. Khi nâng isolation, phải có retry **bao ngoài cả transaction** và đo tỉ lệ retry dưới tải thật.
:::

:::quiz PostgreSQL ở READ COMMITTED. Trong một transaction, bạn đọc tồn kho = 100; transaction khác trừ 30 và commit; bạn đọc lại. Kết quả?
- [ ] 100
- [x] 70
- [ ] Lỗi serialize
- [ ] Bị chặn tới khi transaction kia kết thúc

Đã chạy. Ở REPEATABLE READ thì đọc lại vẫn là 100.
:::

:::quiz Method `@Transactional` gọi `CompletableFuture.supplyAsync(() -> repo.save(x))`. Lần `save` đó thuộc transaction nào?
- [ ] Transaction của method gọi
- [x] Không thuộc transaction đó — nó chạy trên thread khác, có transaction riêng của repository (nếu có)
- [ ] Transaction được truyền tự động
- [ ] Lỗi biên dịch

Transaction gắn với thread qua ThreadLocal. Rollback của method gọi không hoàn tác được lần `save` này.
:::
