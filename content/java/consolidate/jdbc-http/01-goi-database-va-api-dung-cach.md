---
title: "Gọi database và API đúng cách — pool, batch, rò kết nối, fetchSize, timeout và retry"
summary: "Đo trên JDK 21 + PostgreSQL 16: mở kết nối mới 11–17 ms so với lấy từ pool 0,1–0,3 ms; 10.000 insert từ 2,7 giây xuống 73 ms bằng batch; quên đóng kết nối làm pool cạn; đọc 1 triệu dòng hết heap nếu thiếu fetchSize; HttpClient không timeout chờ vô hạn; retry có backoff."
level: intermediate
version: 21
lastReviewed: 2026-11-21
tags: [java, jdbc, httpclient, performance, pitfalls]
related: [java/review/jdbc-http/jdbc-va-httpclient-co-ban, java/deep-dive/jdbc-http/connection-pool-lost-update-va-http-song-song]
---

## Tóm tắt nhanh

- Mở một `Connection` mới là **bắt tay TCP + xác thực + khởi tạo phiên**: đo được 11–17 ms. Ứng dụng luôn lấy kết nối từ **pool** (HikariCP): 0,08–0,29 ms.
- Insert hàng loạt: **một transaction** + **`addBatch`/`executeBatch`**, với PostgreSQL thêm `reWriteBatchedInserts=true`. 10.000 dòng: 2.714 ms → 73 ms.
- Quên đóng `Connection` lấy từ pool → pool cạn → request sau chờ rồi lỗi `Connection is not available, request timed out`.
- Driver PostgreSQL mặc định **tải hết** kết quả vào bộ nhớ. Đọc bảng lớn: `setAutoCommit(false)` + `setFetchSize(n)`.
- `HttpClient`: request **không có timeout thì chờ vô hạn**. Mỗi request đặt `timeout`, client đặt `connectTimeout`. Retry chỉ cho lỗi tạm thời (503, timeout), có backoff và giới hạn số lần.

## Cơ chế: mỗi lần gọi ra ngoài tốn gì

Một truy vấn qua mạng gồm nhiều **round trip** (một lượt gửi đi và nhận về). Mở kết nối PostgreSQL: TCP (1 round trip), có thể TLS (1–2), xác thực SCRAM (2), cài tham số phiên. Mỗi câu lệnh: ít nhất 1 round trip. Tối ưu JDBC phần lớn là **giảm số round trip**: dùng lại kết nối (pool), gom nhiều câu vào một lượt (batch), lấy nhiều dòng một lượt (fetch size), gom commit (transaction).

## Pool kết nối

```java bad
public TaiKhoan tim(String so) throws SQLException {
    try (Connection c = DriverManager.getConnection(URL, USER, PASS)) { … }   // mở kết nối mới mỗi request
}
```

```java good
HikariConfig cfg = new HikariConfig();
cfg.setJdbcUrl("jdbc:postgresql://localhost:5432/hoc");
cfg.setUsername("hoc"); cfg.setPassword("hoc");
cfg.setMaximumPoolSize(10);
DataSource ds = new HikariDataSource(cfg);          // tạo một lần khi ứng dụng khởi động

public TaiKhoan tim(String so) throws SQLException {
    try (Connection c = ds.getConnection()) { … }    // close() trả kết nối về pool, không đóng thật
}
```

Đo trên JDK 21, PostgreSQL 16 cùng máy, 200 lần `SELECT 1`:

```text
DriverManager mỗi lần: 16.9 ms/lần (lần 1), 11.3 ms/lần (lần 2)
HikariCP:               0.29 ms/lần,         0.08 ms/lần
```

Database ở máy khác (mạng thật, có TLS) thì chênh lệch còn lớn hơn. Spring Boot tạo sẵn `HikariDataSource` từ `spring.datasource.*`.

## Insert hàng loạt

10.000 dòng `INSERT INTO giao_dich (so, tien) VALUES (?, ?)`:

```text
từng câu, autocommit (mỗi câu một transaction):   2714 ms
từng câu, một transaction:                          631 ms
addBatch, lô 1000, một transaction:                 139 ms
addBatch + reWriteBatchedInserts=true:               73 ms
```

```java good
c.setAutoCommit(false);
try (PreparedStatement ps = c.prepareStatement("INSERT INTO giao_dich (so, tien) VALUES (?, ?)")) {
    for (int i = 0; i < ds.size(); i++) {
        ps.setString(1, ds.get(i).so());
        ps.setBigDecimal(2, ds.get(i).tien());
        ps.addBatch();
        if ((i + 1) % 1000 == 0) ps.executeBatch();   // gửi theo lô, không giữ 1 triệu câu trong bộ nhớ
    }
    ps.executeBatch();
    c.commit();
} catch (SQLException e) {
    c.rollback();
    throw e;
}
```

- Autocommit: mỗi câu là một transaction, database phải ghi log xuống đĩa (`fsync`) mỗi lần.
- Batch gửi nhiều câu trong một round trip. `reWriteBatchedInserts=true` (tham số URL của driver PostgreSQL) gộp chúng thành `INSERT … VALUES (…), (…), …` nhiều dòng.
- Hibernate cũng batch được nhưng cần `hibernate.jdbc.batch_size` và không dùng `GenerationType.IDENTITY` cho id.

## Rò kết nối

```java bad
Connection c = ds.getConnection();
PreparedStatement ps = c.prepareStatement(sql);
ResultSet rs = ps.executeQuery();
if (!rs.next()) return Optional.empty();   // return sớm — không bao giờ close
…
c.close();
```

Pool 3 kết nối, `connectionTimeout = 1000 ms`, lấy 3 kết nối không trả:

```text
sau 1010 ms: HikariPool-3 - Connection is not available, request timed out after 1000ms
             (total=3, active=3, idle=0, waiting=0)
```

`active` bằng `total` và không giảm là dấu hiệu rò. Bật `leakDetectionThreshold` (vd 60 s) để Hikari ghi log kèm **stack trace nơi lấy kết nối** mà chưa trả. Sửa: mọi `Connection`/`Statement`/`ResultSet` trong try-with-resources như bài cơ bản.

Nguyên nhân thứ hai hay gặp: giữ kết nối trong lúc **chờ việc khác** — gọi HTTP sang đối tác bên trong một transaction `@Transactional`. Đối tác chậm 10 giây thì kết nối bị giữ 10 giây; 10 request cùng lúc là hết pool.

## Đọc bảng lớn

Bảng 1 triệu dòng, `-Xmx128m`:

```text
mặc định:                            OutOfMemoryError: Java heap space
autoCommit=false + fetchSize=1000:   1000000 dòng, 835 ms
```

```java good
c.setAutoCommit(false);                     // driver PostgreSQL chỉ dùng cursor khi trong transaction
try (PreparedStatement ps = c.prepareStatement("SELECT id, ma, ghi_chu, tien FROM lich_su")) {
    ps.setFetchSize(1000);                  // lấy 1000 dòng mỗi round trip
    try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) xuLy(rs);         // xử lý từng dòng, không gom vào List
    }
}
```

Mặc định `fetchSize = 0` nghĩa là "tải hết" — với PostgreSQL toàn bộ kết quả nằm trong heap trước khi `rs.next()` đầu tiên trả về. MySQL Connector/J có quy tắc riêng (`useCursorFetch=true`). Export báo cáo, đồng bộ dữ liệu, job ban đêm đều cần điều này.

## HttpClient: timeout và retry

```java bad
HttpClient client = HttpClient.newHttpClient();                  // không connectTimeout
client.send(HttpRequest.newBuilder(uri).build(), ofString());    // không timeout → chờ vô hạn
// đã chạy với endpoint không trả lời: sau 1,5 giây vẫn đang chờ
for (var ma : dsMa) HttpClient.newHttpClient().send(…);         // tạo client mới mỗi lần: mất pool kết nối HTTP
```

```java good
static final HttpClient CLIENT = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();

HttpRequest req = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(1)).build();
// endpoint chậm 5 giây → HttpTimeoutException: request timed out — sau 504 ms
```

```java title="Retry có backoff"
static HttpResponse<String> goiCoRetry(HttpRequest rq) throws IOException, InterruptedException {
    HttpResponse<String> kq = null;
    for (int lan = 1; lan <= 4; lan++) {
        try {
            kq = CLIENT.send(rq, HttpResponse.BodyHandlers.ofString());
            if (kq.statusCode() != 503 && kq.statusCode() != 429) return kq;   // chỉ retry lỗi tạm thời
        } catch (HttpTimeoutException e) {
            if (lan == 4) throw e;
        }
        Thread.sleep(100L << (lan - 1));                                      // 100, 200, 400 ms
    }
    return kq;
}
// endpoint trả 503 hai lần rồi 200: "lần 1: 503, lần 2: 503, lần 3: 200" — xong sau 312 ms
```

Không retry 4xx (lỗi của chính request: 400, 401, 404) — gửi lại vẫn sai. Không retry thao tác **không idempotent** (POST tạo giao dịch) trừ khi có khoá idempotency: request đầu có thể đã thành công phía đối tác, chỉ là phản hồi bị mất. Trong dự án Spring, dùng Resilience4j (`@Retry`, `@CircuitBreaker`) thay vì tự viết vòng lặp.

## Pitfalls

- `getDouble` cho cột tiền, `setDouble` khi ghi → sai số. Dùng `BigDecimal`.
- `getInt` cho cột có thể NULL → 0.
- `SELECT *` rồi đọc cột theo **số thứ tự** → ai đó thêm cột là đọc sai dữ liệu.
- Bắt `SQLException` chỉ để log rồi bỏ qua trong code chuyển tiền → không rollback. Đọc `getSQLState()` để phân loại: `23505` trùng khoá, `23514` vi phạm `CHECK`, `40001` cần retry (bài chuyên sâu).
- `HttpClient` gửi body `ofString` theo UTF-8, nhưng đọc `ofString()` theo charset trong header `Content-Type` của phản hồi — đối tác không ghi charset thì mặc định UTF-8; nếu họ thực ra gửi windows-1258, chữ có dấu hỏng.
- Log nguyên request/response chứa token, số thẻ, CCCD. Che trước khi log.

:::senior Góc nhìn senior
Hai con số cần biết cho mọi service: **pool size** của database và **timeout** của mọi lời gọi ra ngoài. Pool quá lớn làm database quá tải (mỗi kết nối PostgreSQL là một process); quá nhỏ thì request xếp hàng. Bắt đầu nhỏ (10), đo bằng metric của Hikari (`hikaricp.connections.pending`, `…usage`) rồi chỉnh. Timeout phải nhỏ hơn timeout của người gọi mình — nếu API của bạn có SLA 3 giây mà gọi đối tác với timeout 30 giây, thread của bạn treo lâu hơn chính người dùng chờ. Và không bao giờ giữ kết nối database trong lúc gọi HTTP.
:::

:::version 21 Java 8 / 11 / 17 / 21
- `addBatch`/`executeBatch`: JDBC 2.0. `executeLargeBatch` (trả `long[]`): Java 8.
- `HttpClient`: Java 11. Java 21: `HttpClient` là `AutoCloseable`; gọi `send` trên virtual thread chặn rất rẻ, nên code chặn đơn giản thay được `sendAsync` trong nhiều trường hợp.
- HikariCP 6.x cần Java 11+. Driver PostgreSQL 42.7.x hỗ trợ Java 8+.
:::

:::interview Vì sao cần connection pool? Pool nên lớn bao nhiêu?
Mở kết nối database tốn nhiều round trip (TCP, TLS, xác thực) và tài nguyên phía database (PostgreSQL tạo một process cho mỗi kết nối) — đo được hơn 10 ms so với dưới 0,3 ms khi lấy từ pool. Pool giữ sẵn một số kết nối đã mở, cho mượn và nhận lại. Kích thước pool không nên lớn: số truy vấn database chạy song song hiệu quả bị giới hạn bởi số CPU và đĩa của database; tài liệu HikariCP gợi ý bắt đầu quanh `số_core × 2 + số_đĩa`. Pool quá lớn chỉ dời hàng đợi từ ứng dụng sang database và làm mọi truy vấn chậm đi. Với nhiều instance ứng dụng, tổng pool của tất cả instance phải nhỏ hơn `max_connections` của database.
:::

:::quiz 10.000 insert vào PostgreSQL. Thay đổi nào giảm thời gian **nhiều nhất** so với "từng câu, autocommit" (2.714 ms)?
- [ ] Chỉ bỏ autocommit (một transaction): 631 ms
- [ ] Chỉ dùng `Statement` thay cho `PreparedStatement`
- [x] Một transaction + `addBatch` lô 1000 + `reWriteBatchedInserts=true`: 73 ms
- [ ] Tăng `fetchSize`

Đã đo trên JDK 21 + PostgreSQL 16. `fetchSize` chỉ ảnh hưởng tới việc **đọc**.
:::

:::quiz Log có `Connection is not available, request timed out after 30000ms (total=10, active=10, idle=0, waiting=25)`. Nguyên nhân hợp lý nhất?
- [ ] Database bị tắt
- [ ] Sai mật khẩu
- [x] Kết nối bị giữ lâu hoặc bị rò (không trả về pool) — mọi kết nối đang `active`, 25 request đang chờ
- [ ] `fetchSize` quá nhỏ

Database tắt hay sai mật khẩu sẽ có lỗi khác khi tạo kết nối. `active = total` kéo dài: tìm chỗ quên đóng (bật `leakDetectionThreshold`) hoặc transaction giữ kết nối trong lúc gọi I/O chậm.
:::

:::exercise Import CSV vào database
Có file CSV 2 triệu dòng `so,tien` (đã kiểm tra hợp lệ). Viết `static long nhap(DataSource ds, Path csv)` insert vào bảng `giao_dich(so, tien)`, không đọc cả file vào bộ nhớ, commit theo lô 5.000 dòng để không giữ một transaction khổng lồ, trả về số dòng đã nhập.
???
```java
static long nhap(DataSource ds, Path csv) throws IOException, SQLException {
    long dem = 0;
    try (Connection c = ds.getConnection();
         BufferedReader r = Files.newBufferedReader(csv, StandardCharsets.UTF_8);
         PreparedStatement ps = c.prepareStatement("INSERT INTO giao_dich (so, tien) VALUES (?, ?)")) {
        c.setAutoCommit(false);
        r.readLine();                                        // bỏ dòng tiêu đề
        String dong;
        try {
            while ((dong = r.readLine()) != null) {
                int phay = dong.indexOf(',');
                ps.setString(1, dong.substring(0, phay));
                ps.setBigDecimal(2, new BigDecimal(dong.substring(phay + 1)));
                ps.addBatch();
                if (++dem % 5000 == 0) { ps.executeBatch(); c.commit(); }
            }
            ps.executeBatch();
            c.commit();
        } catch (SQLException | RuntimeException e) {
            c.rollback();                                    // chỉ hoàn tác lô đang dở
            throw e;
        } finally {
            c.setAutoCommit(true);                           // trả kết nối về pool ở trạng thái chuẩn
        }
    }
    return dem;
}
```

Đã chạy thử trên JDK 21 + PostgreSQL 16 với 200.000 dòng (URL có `reWriteBatchedInserts=true`): 1.129 ms, `count(*)` = 200000.

- Đọc theo dòng bằng `BufferedReader`, không `readAllLines`.
- Commit mỗi 5.000 dòng: lỗi giữa chừng chỉ mất lô đang dở; muốn chạy lại an toàn thì cần biết đã nhập tới đâu (ghi số dòng đã commit, hoặc dùng bảng tạm rồi `INSERT … SELECT` trong một transaction cuối).
- Trả `autoCommit` về `true` trước khi trả kết nối: Hikari tự đặt lại, nhưng pool khác có thể không.
- PostgreSQL có `COPY` (qua `CopyManager` của driver) còn nhanh hơn batch nhiều lần cho import lớn.
:::
