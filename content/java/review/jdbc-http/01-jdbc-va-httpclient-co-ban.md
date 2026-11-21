---
title: "JDBC và HttpClient cơ bản — Connection, PreparedStatement, transaction; gọi API bằng java.net.http"
summary: "Nhắc nhanh JDBC thuần: lấy Connection, PreparedStatement với tham số, đọc ResultSet thành record, khoá sinh tự động, transaction commit/rollback, BigDecimal và NULL; rồi java.net.http.HttpClient: GET, POST JSON, timeout, mã lỗi HTTP không ném exception, sendAsync. Chạy trên JDK 21 với PostgreSQL 16."
type: card
level: core
version: 21
lastReviewed: 2026-11-21
tags: [java, jdbc, httpclient, database, api]
related: [java/consolidate/jdbc-http/goi-database-va-api-dung-cach, java/deep-dive/jdbc-http/connection-pool-lost-update-va-http-song-song]
---

## Tóm tắt nhanh

- **JDBC** là API chuẩn để gọi database: `Connection` → `PreparedStatement` (câu SQL có `?`) → `ResultSet`. Spring `JdbcTemplate`, JPA/Hibernate, MyBatis đều chạy trên JDBC.
- Luôn dùng **`PreparedStatement`** với tham số `?`, không nối chuỗi SQL — chống SQL injection.
- Mọi `Connection`, `Statement`, `ResultSet` đều phải đóng: **try-with-resources**.
- Nhiều câu lệnh phải cùng thành công hoặc cùng thất bại → **transaction**: `setAutoCommit(false)`, `commit()`, lỗi thì `rollback()`.
- Tiền: `getBigDecimal`/`setBigDecimal` với cột `NUMERIC`. Cột có thể `NULL`: `getObject(i, Integer.class)` thay vì `getInt`.
- **`HttpClient`** (Java 11): tạo một lần, dùng chung; mỗi request đặt **timeout**. Mã 4xx/5xx **không** ném exception — tự kiểm tra `statusCode()`.

## Ví dụ nhanh: JDBC (đã chạy trên JDK 21, PostgreSQL 16, driver 42.7.4)

```java title="Đọc một dòng thành record"
record TaiKhoan(long id, String so, String chuTk, BigDecimal soDu) {}

static Optional<TaiKhoan> tim(Connection c, String so) throws SQLException {
    try (PreparedStatement ps = c.prepareStatement("SELECT id, so, chu_tk, so_du FROM tai_khoan WHERE so = ?")) {
        ps.setString(1, so);                                    // tham số bắt đầu từ 1
        try (ResultSet rs = ps.executeQuery()) {
            return rs.next()
                ? Optional.of(new TaiKhoan(rs.getLong("id"), rs.getString("so"), rs.getString("chu_tk"), rs.getBigDecimal("so_du")))
                : Optional.empty();
        }
    }
}

try (Connection c = DriverManager.getConnection("jdbc:postgresql://localhost:5432/hoc", "hoc", "hoc")) {
    tim(c, "001");   // Optional[TaiKhoan[id=1, so=001, chuTk=Nguyễn An, soDu=1000000.00]]
    tim(c, "999");   // Optional.empty
}
```

```java title="Insert và lấy khoá sinh tự động"
try (PreparedStatement ps = c.prepareStatement(
        "INSERT INTO tai_khoan (so, chu_tk, so_du) VALUES (?, ?, ?)", Statement.RETURN_GENERATED_KEYS)) {
    ps.setString(1, "002"); ps.setString(2, "Trần Bình"); ps.setBigDecimal(3, new BigDecimal("500000"));
    ps.executeUpdate();                         // trả số dòng bị ảnh hưởng: 1
    try (ResultSet k = ps.getGeneratedKeys()) { k.next(); k.getLong(1); }   // id mới: 2
}
```

```java title="Transaction: chuyển tiền"
static void chuyen(Connection c, String tu, String den, BigDecimal tien) throws SQLException {
    boolean ac = c.getAutoCommit();
    c.setAutoCommit(false);
    try (PreparedStatement tru = c.prepareStatement("UPDATE tai_khoan SET so_du = so_du - ? WHERE so = ? AND so_du >= ?");
         PreparedStatement cong = c.prepareStatement("UPDATE tai_khoan SET so_du = so_du + ? WHERE so = ?")) {
        tru.setBigDecimal(1, tien); tru.setString(2, tu); tru.setBigDecimal(3, tien);
        if (tru.executeUpdate() != 1) throw new SQLException("không đủ số dư hoặc sai tài khoản " + tu);
        cong.setBigDecimal(1, tien); cong.setString(2, den);
        if (cong.executeUpdate() != 1) throw new SQLException("không có tài khoản " + den);
        c.commit();
    } catch (SQLException e) {
        c.rollback();                           // hoàn tác cả bước trừ tiền
        throw e;
    } finally {
        c.setAutoCommit(ac);
    }
}
// chuyen(001 → 002, 300.000): 700000.00 / 800000.00
// chuyen(001 → XXX, 100.000): lỗi "không có tài khoản XXX" → rollback, 001 vẫn 700000.00
```

```java title="Kiểu dữ liệu"
rs.getBigDecimal("so_du");          // 700000.00 — giữ đúng scale của NUMERIC(19,2)
rs.getDouble("so_du");              // 700000.0  — mất độ chính xác với số lẻ, không dùng cho tiền
rs.getInt(1);                       // 0 khi cột là NULL! phải gọi rs.wasNull() ngay sau đó → true
rs.getObject(1, Integer.class);     // null — cách rõ ràng hơn
```

## Ví dụ nhanh: HttpClient (đã chạy trên JDK 21)

```java
HttpClient client = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(2))           // thời gian tối đa để mở kết nối
    .build();                                        // tạo MỘT lần, dùng chung cả ứng dụng (thread-safe)

HttpRequest req = HttpRequest.newBuilder(URI.create(goc + "/ty-gia"))
    .timeout(Duration.ofSeconds(1))                  // thời gian tối đa chờ phản hồi
    .header("Accept", "application/json")
    .GET().build();
HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
res.statusCode();   // 200
res.body();         // {"cap":"USD/VND","gia":25400}

var post = HttpRequest.newBuilder(URI.create(goc + "/don"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString("{\"ma\":\"D1\",\"ten\":\"Nồi chiên\"}"))   // UTF-8 mặc định
    .build();
client.send(post, HttpResponse.BodyHandlers.ofString()).statusCode();   // 201

client.send(yeuCau404, BodyHandlers.ofString()).statusCode();   // 404 — không có exception nào
// request tới endpoint chậm 5 s với .timeout(500 ms) → HttpTimeoutException: request timed out (sau 504 ms)

client.sendAsync(req, BodyHandlers.ofString())   // CompletableFuture<HttpResponse<String>>
      .thenApply(HttpResponse::body);
```

## Bảng chọn nhanh

| Cần | JDBC | Ghi chú |
|---|---|---|
| Truy vấn có tham số | `prepareStatement("… WHERE so = ?")` + `setXxx` | Không nối chuỗi |
| Đọc nhiều dòng | `while (rs.next()) …` | Cột theo tên (`"so_du"`) dễ đọc hơn theo số |
| Lệnh thay đổi dữ liệu | `executeUpdate()` → số dòng | Kiểm tra số dòng như ví dụ chuyển tiền |
| Insert nhiều dòng | `addBatch()` + `executeBatch()` | Bài củng cố: nhanh hơn ~37 lần |
| Nhiều câu cùng thành công/thất bại | `setAutoCommit(false)` … `commit()`/`rollback()` | |
| Lấy Connection trong ứng dụng | `DataSource` có pool (HikariCP) | `DriverManager` chỉ cho script/test |

| Cần | HttpClient |
|---|---|
| Body dạng chuỗi / byte / file | `BodyHandlers.ofString()` / `ofByteArray()` / `ofFile(path)` |
| Response lớn, đọc dần | `BodyHandlers.ofInputStream()` hoặc `ofLines()` |
| Gửi JSON | `BodyPublishers.ofString(json)` + header `Content-Type` |
| Gọi song song nhiều API | `sendAsync` hoặc `send` trên virtual thread |
| JSON ↔ object | Jackson (`ObjectMapper`) — JDK không có sẵn thư viện JSON |

## Lỗi hay gặp: nối chuỗi vào SQL

```java bad
String nhap = "' OR '1'='1";                     // người dùng gõ vào ô "số tài khoản"
st.executeQuery("SELECT count(*) FROM tai_khoan WHERE so = '" + nhap + "'");
// trả về 2 dòng — MỌI tài khoản, vì câu SQL thành: WHERE so = '' OR '1'='1'
```

```java good
tim(c, nhap);   // PreparedStatement với cùng chuỗi: Optional.empty
```

Đã chạy cả hai trên PostgreSQL 16. Với `PreparedStatement`, giá trị tham số được gửi **tách khỏi** câu SQL, database không bao giờ hiểu nó là code. Tên bảng/cột không truyền bằng `?` được — nếu phải ghép động (vd cột sắp xếp), chọn từ một danh sách cố định trong code.

:::version 21 Java 8 / 11 / 17 / 21
- JDBC 4.0 (Java 6): driver tự đăng ký, không cần `Class.forName(...)`. try-with-resources cho `Connection`: Java 7. `getObject(i, Class)`: Java 7.
- `java.net.http.HttpClient`: chính thức từ **Java 11** (trước đó dùng `HttpURLConnection` hoặc Apache HttpClient). Hỗ trợ HTTP/1.1, HTTP/2, WebSocket.
- Java 21: `HttpClient` là `AutoCloseable` (`close()`, `shutdown()`); virtual thread giúp gọi `send` chặn mà không tốn thread hệ điều hành (bài *Virtual thread*).
:::

:::interview Vì sao `PreparedStatement` chống được SQL injection?
Với `Statement` và nối chuỗi, giá trị người dùng trở thành một phần của **văn bản SQL** — database phân tích cú pháp cả chuỗi, nên `' OR '1'='1` biến thành điều kiện luôn đúng. Với `PreparedStatement`, câu SQL chứa chỗ trống `?` được gửi và phân tích trước (hoặc cùng lúc nhưng tách biệt), còn giá trị được gửi riêng như **dữ liệu**; database không bao giờ phân tích lại chúng thành cú pháp SQL. Thêm lợi ích: database có thể dùng lại kế hoạch thực thi, và driver lo việc chuyển kiểu (ngày, số, BigDecimal) đúng chuẩn. Phần không tham số hoá được (tên bảng, tên cột, `ORDER BY`) phải lấy từ danh sách cho phép trong code.
:::

:::quiz Cột `so_luong` có giá trị `NULL`. `rs.getInt("so_luong")` trả về gì?
- [ ] `null`
- [x] `0` — phải gọi `rs.wasNull()` để biết đó là NULL
- [ ] Ném `SQLException`
- [ ] Ném `NullPointerException`

Đã chạy thử với PostgreSQL: `getInt` trả 0, `wasNull()` trả `true`, còn `getObject(1, Integer.class)` trả `null`. Nhầm NULL thành 0 là lỗi nghiệp vụ khó thấy (vd "số lượng tồn = 0" thay vì "chưa kiểm kê").
:::

:::quiz `client.send(req, BodyHandlers.ofString())` gọi tới một endpoint trả về HTTP 500. Điều gì xảy ra?
- [ ] Ném `IOException`
- [ ] Ném `HttpTimeoutException`
- [x] Trả về `HttpResponse` bình thường với `statusCode()` = 500
- [ ] Tự động thử lại 3 lần

`HttpClient` chỉ ném exception khi không có phản hồi (lỗi mạng, timeout). Mã 4xx/5xx là phản hồi hợp lệ về mặt HTTP — code phải tự kiểm tra. Đã chạy thử với endpoint trả 404.
:::

:::quiz Trong ví dụ chuyển tiền, vì sao kiểm tra `tru.executeUpdate() != 1`?
- [ ] Vì `executeUpdate` ném exception nếu không có dòng nào khớp
- [x] Vì câu UPDATE không khớp dòng nào (sai số tài khoản, hoặc `so_du >= ?` sai) vẫn chạy thành công và trả về 0
- [ ] Vì PostgreSQL trả -1 khi thành công
- [ ] Không cần, chỉ để in log

UPDATE ảnh hưởng 0 dòng không phải lỗi SQL. Không kiểm tra thì bước cộng tiền vẫn chạy và commit — tiền "sinh ra" từ hư không. Đã chạy: chuyển 99.000.000 từ tài khoản chỉ có 800.000 → `executeUpdate` trả 0, code ném lỗi và rollback.
:::
