---
title: "Cập nhật đồng thời, connection pool và HTTP song song — lost update, FOR UPDATE, optimistic lock, 40001, sendAsync so với virtual thread"
summary: "Tái hiện trên PostgreSQL 16: 100 lần trừ tiền song song kiểu đọc-rồi-ghi mất 73 lần; sửa bằng UPDATE nguyên tử, FOR UPDATE, optimistic lock hoặc REPEATABLE READ kèm retry lỗi 40001; bên trong HikariCP; HttpClient gọi 200 request bằng sendAsync so với send trên virtual thread. JDK 21."
level: advanced
version: 21
lastReviewed: 2026-11-21
tags: [java, jdbc, transaction, concurrency, httpclient, internals]
related: [java/consolidate/jdbc-http/goi-database-va-api-dung-cach, java/deep-dive/concurrency/virtual-thread-va-structured-concurrency]
---

## Tóm tắt nhanh

- **Lost update**: hai transaction cùng đọc số dư 1.000.000, cùng ghi 999.000 → mất một lần trừ. Đã tái hiện: 100 lần trừ 1.000 song song (10 thread), kết quả **973.000** thay vì 900.000 — mất 73 lần.
- Bốn cách sửa, đều đã chạy ra đúng: `UPDATE … SET so_du = so_du - ?` (nguyên tử), `SELECT … FOR UPDATE` (khoá dòng), **optimistic lock** với cột `version` (102 lần thử lại cho 100 thao tác), `REPEATABLE READ` (PostgreSQL từ chối 41/100 bằng SQLState `40001`, ứng dụng phải thử lại).
- Isolation mặc định của PostgreSQL là **READ COMMITTED** — không chống lost update kiểu đọc-rồi-ghi. Transaction (`@Transactional`) **không** tự làm code đúng khi chạy đồng thời.
- HikariCP giữ kết nối trong một cấu trúc gần như không khoá, đặt lại trạng thái (autocommit, isolation, read-only) khi kết nối được trả về.
- `HttpClient`: gọi `send` trên virtual thread nhanh ngang `sendAsync` (200 request: 167 ms so với 181 ms), mà code tuần tự dễ đọc hơn.

## Lost update

```java bad
// mỗi thread: trừ 1.000 trong một transaction READ COMMITTED (mặc định)
BigDecimal du;
try (var ps = c.prepareStatement("SELECT so_du FROM tai_khoan WHERE so = '001'"); var rs = ps.executeQuery()) {
    rs.next(); du = rs.getBigDecimal(1);
}
try (var ps = c.prepareStatement("UPDATE tai_khoan SET so_du = ? WHERE so = '001'")) {
    ps.setBigDecimal(1, du.subtract(new BigDecimal("1000")));
    ps.executeUpdate();
}
c.commit();
```

```text
100 lần trừ 1.000 từ 1.000.000, 10 thread song song (JDK 21, PostgreSQL 16):
đọc-rồi-ghi (READ COMMITTED):       973000.00   ← mất 73 lần trừ
SELECT … FOR UPDATE:                900000.00
UPDATE so_du = so_du - 1000:        900000.00
optimistic lock (cột version):      900000.00, version = 100, thử lại 102 lần
REPEATABLE READ, không retry:       941000.00 — 59 commit, 41 lỗi 40001
```

Ở READ COMMITTED, mỗi câu `SELECT` thấy dữ liệu **đã commit tại thời điểm câu đó chạy**. Hai transaction đọc cùng lúc thấy cùng giá trị, rồi lần lượt ghi đè lên nhau; database không biết giá trị bạn ghi được tính từ một lần đọc cũ.

Đây là lỗi kinh điển với JPA: `TaiKhoan tk = repo.findById(id); tk.setSoDu(tk.getSoDu() - tien); repo.save(tk);` trong `@Transactional` là đúng mẫu "đọc-rồi-ghi" ở trên.

## Bốn cách sửa

### 1. Để database tính

```java good
UPDATE tai_khoan SET so_du = so_du - ? WHERE so = ? AND so_du >= ?
```

Đọc và ghi trong **một** câu lệnh; database khoá dòng trong lúc cập nhật. Điều kiện `so_du >= ?` kiểm tra số dư ngay trong lệnh, `executeUpdate() == 0` nghĩa là không đủ tiền. Nhanh nhất, nên là lựa chọn đầu tiên khi logic đủ đơn giản để viết thành SQL.

### 2. Khoá bi quan: `SELECT … FOR UPDATE`

```java
SELECT so_du FROM tai_khoan WHERE so = ? FOR UPDATE   -- khoá dòng tới khi commit/rollback
```

Transaction thứ hai chờ ở câu `SELECT` cho tới khi transaction thứ nhất xong, rồi đọc giá trị mới. Dùng khi logic phức tạp phải làm trong Java (tính phí, kiểm tra hạn mức nhiều bảng). Cái giá: các giao dịch trên cùng tài khoản chạy **tuần tự**, và có thể **deadlock** nếu hai transaction khoá hai dòng theo thứ tự ngược nhau (luôn khoá theo thứ tự cố định, vd theo `id` tăng dần). JPA: `@Lock(LockModeType.PESSIMISTIC_WRITE)`.

### 3. Khoá lạc quan: cột `version`

```java good
// đọc so_du và version
UPDATE tai_khoan SET so_du = ?, version = version + 1 WHERE so = ? AND version = ?
// executeUpdate() == 0 → có người khác đã sửa trước → đọc lại và thử lại
```

Không khoá gì khi đọc; lúc ghi mới kiểm tra "dữ liệu có còn như lúc tôi đọc không". Đã chạy: 100 thao tác cần 102 lần thử lại (va chạm nhiều vì cả 100 thao tác cùng một dòng), kết quả đúng `900000.00`, `version = 100`. Hợp với dữ liệu ít tranh chấp (sửa hồ sơ khách hàng, cấu hình) và với thao tác dài có người dùng ở giữa (mở form, sửa, lưu). JPA: thêm field `@Version`, Hibernate ném `OptimisticLockException`.

### 4. Isolation cao hơn + retry

```java
c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
// PostgreSQL: transaction thứ hai ghi vào dòng đã bị sửa sau khi nó bắt đầu →
// SQLState 40001: ERROR: could not serialize access due to concurrent update
```

PostgreSQL phát hiện xung đột và **huỷ** một bên thay vì để mất dữ liệu. Ứng dụng **bắt buộc** phải thử lại khi gặp `40001` — không retry thì 41/100 thao tác thất bại như số đo trên. `SERIALIZABLE` chặt hơn nữa (chống cả anomaly giữa nhiều dòng) nhưng tỉ lệ lỗi cao hơn. Lưu ý: hành vi của từng mức isolation **khác nhau giữa các database** (MySQL InnoDB ở REPEATABLE READ không báo lỗi như PostgreSQL mà vẫn có thể mất cập nhật với đọc thường).

| Cách | Khi nào | Rủi ro |
|---|---|---|
| `UPDATE … = col - ?` | Logic viết được bằng SQL | Logic nằm trong SQL |
| `SELECT … FOR UPDATE` | Logic phức tạp, tranh chấp cao | Chạy tuần tự, deadlock nếu khoá sai thứ tự |
| Optimistic `version` | Tranh chấp thấp, thao tác dài | Retry nhiều khi tranh chấp cao |
| `REPEATABLE READ`/`SERIALIZABLE` | Nhiều dòng, khó chỉ ra chỗ khoá | Phải có retry `40001` ở mọi chỗ |

## Bên trong connection pool

HikariCP — pool mặc định của Spring Boot:

- Kết nối nằm trong một `ConcurrentBag`: mỗi thread ưu tiên lấy lại kết nối nó vừa trả (`ThreadLocal` list), không có thì lấy từ danh sách chung bằng CAS (compare-and-swap), không có nữa thì **chờ** tối đa `connectionTimeout` (mặc định 30 s) — đây là nguồn của lỗi `Connection is not available` ở bài củng cố.
- `getConnection()` trả về một **proxy** bọc kết nối thật. `close()` trên proxy trả kết nối về pool, đặt lại `autoCommit`, isolation, read-only, catalog nếu bạn đã đổi, và rollback transaction còn dở.
- Kết nối bị kiểm tra "còn sống" trước khi cho mượn nếu đã nằm yên lâu, và bị thay sau `maxLifetime` (mặc định 30 phút) — nên đặt nhỏ hơn timeout của firewall/load balancer/database để không nhận phải kết nối đã bị phía bên kia cắt.

Driver PostgreSQL cũng có tối ưu riêng: sau khi một `PreparedStatement` chạy 5 lần (`prepareThreshold=5`), driver chuyển sang *server-side prepared statement* — database phân tích câu SQL một lần và dùng lại kế hoạch. Đóng `PreparedStatement` nhưng giữ câu SQL giống hệt (không nối chuỗi) thì driver vẫn nhận ra và dùng lại.

## HttpClient bên trong

- Một `HttpClient` giữ **pool kết nối** cho mỗi host (HTTP/1.1 keep-alive) và có thể dùng **HTTP/2** (nhiều request trên một kết nối) nếu server hỗ trợ — đã chạy: yêu cầu `HTTP_2` với server chỉ hỗ trợ 1.1 thì tự hạ xuống `HTTP_1_1`. Tạo client mới cho mỗi request là bỏ hết những thứ này.
- `sendAsync` dùng một executor nội bộ và `CompletableFuture`; `send` chặn thread gọi tới khi có phản hồi.

200 request tới endpoint mất 100 ms, cùng một client, JDK 21:

```text
                 sendAsync   send trên virtual thread
lần 1:           1161 ms     201 ms     ← lần 1 của sendAsync phải mở nhiều kết nối mới
lần 2:            181 ms     167 ms
```

```java
// cách 1: bất đồng bộ
var fs = dsMa.stream().map(ma -> client.sendAsync(req(ma), ofString()).thenApply(HttpResponse::body)).toList();
CompletableFuture.allOf(fs.toArray(CompletableFuture[]::new)).join();

// cách 2: code chặn, mỗi việc một virtual thread
try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
    for (var ma : dsMa) ex.submit(() -> client.send(req(ma), ofString()).body());
}
```

Trên Java 21, cách 2 cho cùng thông lượng với code tuần tự, stack trace có nghĩa và xử lý exception bằng `try/catch` bình thường. `sendAsync` vẫn hợp khi cần ghép nhiều bước bất đồng bộ (`thenCompose`) hoặc trong code reactive. Dù cách nào, nhớ giới hạn **số request đồng thời** tới mỗi đối tác (`Semaphore`, bài *Virtual thread*) — đối tác có rate limit, và pool kết nối HTTP/1.1 mở thêm kết nối khi tất cả đang bận.

## So sánh phương án

| Việc | Java 21, JDBC thuần | Trong Spring |
|---|---|---|
| Trừ số dư | `UPDATE … so_du = so_du - ? … AND so_du >= ?` | `@Modifying @Query` với cùng câu SQL |
| Sửa bản ghi qua form | Cột `version` + `WHERE version = ?` | `@Version` (JPA) |
| Logic phức tạp trên một dòng nóng | `SELECT … FOR UPDATE` | `@Lock(PESSIMISTIC_WRITE)` |
| Retry `40001`, optimistic | Vòng lặp có giới hạn + backoff | `@Retryable` (Spring Retry) / Resilience4j |
| Gọi nhiều API song song | `send` trên virtual thread + `Semaphore` | `RestClient` + `spring.threads.virtual.enabled=true` |

## Tính năng mới theo phiên bản

- **JDBC 4.0** (Java 6): driver tự nạp. **JDBC 4.2** (Java 8): `java.time` qua `setObject`/`getObject(…, LocalDate.class)`.
- **Java 11**: `java.net.http`. **Java 21**: `HttpClient.close()`, virtual thread chính thức — cách 2 ở trên trở thành mặc định nên dùng.
- JDBC 4.3 (Java 9): `Connection.beginRequest`/`endRequest` để pool báo cho driver ranh giới của một lần mượn.

:::senior Góc nhìn senior
Mọi thao tác "đọc giá trị, tính, ghi lại" trên dữ liệu tiền, tồn kho, hạn mức đều phải được chỉ rõ là chống đồng thời bằng cách nào — viết điều đó vào code review checklist. Test đơn vị không bao giờ bắt được lost update; cần test tích hợp chạy song song trên database thật (Testcontainers với PostgreSQL) như số đo ở trên. Khi chọn cách: ưu tiên để database làm (UPDATE nguyên tử, ràng buộc `CHECK (so_du >= 0)` như lưới an toàn cuối), rồi optimistic cho dữ liệu ít tranh chấp, khoá bi quan cho điểm nóng, và luôn có retry có giới hạn cho `40001`/`OptimisticLockException`.
:::

:::quiz Code JPA: `@Transactional void tru(id, tien) { var tk = repo.findById(id).orElseThrow(); tk.setSoDu(tk.getSoDu().subtract(tien)); }`. Hai request chạy cùng lúc trên PostgreSQL mặc định. Điều gì có thể xảy ra?
- [ ] Không vấn đề gì, `@Transactional` đã đảm bảo an toàn
- [x] Lost update: cả hai đọc cùng số dư, một lần trừ bị ghi đè
- [ ] PostgreSQL luôn báo lỗi 40001
- [ ] Deadlock chắc chắn xảy ra

READ COMMITTED không chống đọc-rồi-ghi. Đã tái hiện bằng JDBC thuần: 100 lần trừ song song mất 73 lần. Thêm `@Version` vào entity, hoặc viết UPDATE nguyên tử, hoặc `@Lock(PESSIMISTIC_WRITE)`.
:::

:::quiz Với optimistic lock, `UPDATE … WHERE id = ? AND version = ?` trả về 0. Ý nghĩa và cách xử lý đúng?
- [ ] Lỗi SQL, ném exception cho người dùng
- [x] Có transaction khác đã sửa dòng sau khi mình đọc; đọc lại dữ liệu mới và thử lại (có giới hạn), hoặc báo người dùng dữ liệu đã thay đổi
- [ ] Dòng đã bị xoá, bỏ qua
- [ ] Tăng `version` lên rồi chạy lại cùng câu UPDATE

Chạy lại cùng câu với version mới mà không đọc lại sẽ ghi đè thay đổi của người khác — chính là lost update. Với thao tác có người dùng ở giữa (sửa form), thường trả lỗi 409 Conflict để họ xem dữ liệu mới.
:::

:::exercise Retry lỗi 40001
Viết `static <T> T trongTransaction(DataSource ds, int soLanToiDa, SqlCong<T> viec)` (với `interface SqlCong<T> { T chay(Connection c) throws SQLException; }`) mở transaction `REPEATABLE READ`, chạy `viec`, commit; nếu gặp SQLState `40001` thì rollback và thử lại với backoff ngẫu nhiên, tối đa `soLanToiDa` lần.
???
```java
interface SqlCong<T> { T chay(Connection c) throws SQLException; }

static <T> T trongTransaction(DataSource ds, int soLanToiDa, SqlCong<T> viec) throws SQLException, InterruptedException {
    for (int lan = 1; ; lan++) {
        try (Connection c = ds.getConnection()) {
            c.setAutoCommit(false);
            c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            try {
                T kq = viec.chay(c);
                c.commit();
                return kq;
            } catch (SQLException e) {
                c.rollback();
                if (!"40001".equals(e.getSQLState()) || lan >= soLanToiDa) throw e;
            }
        }
        Thread.sleep(ThreadLocalRandom.current().nextLong(5, 20L * lan));   // jitter: tránh các bên thử lại cùng lúc
    }
}
```

- Mỗi lần thử là một **transaction mới** với kết nối mới từ pool — không thử lại câu lệnh trong transaction đã hỏng.
- `viec` phải không có tác dụng phụ ngoài database (không gửi email, không gọi API) vì nó có thể chạy nhiều lần.
- Đã chạy thử trên JDK 21 + PostgreSQL 16 với ví dụ trừ tiền đọc-rồi-ghi ở trên (100 thao tác, 10 thread, `soLanToiDa = 20`): cả 100 thao tác thành công, số dư cuối đúng 900000.00, tổng cộng 87 lần phải thử lại.
:::
