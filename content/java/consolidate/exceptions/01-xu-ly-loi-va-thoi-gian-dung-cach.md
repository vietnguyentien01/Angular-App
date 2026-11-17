---
title: "Xử lý lỗi và thời gian đúng cách — mất cause, suppressed exception, YYYY, giờ mùa hè và Clock"
summary: "Chạy thử các lỗi tốn nhiều giờ debug: bọc exception làm mất cause, try/finally che lỗi gốc, YYYY thay vì yyyy, mm thay vì MM, parse 30/02 thành 28/02, cắt ngày theo UTC, giờ mùa hè ở múi giờ khác; rồi viết hàm tính tuổi test được nhờ Clock."
level: intermediate
version: 25
lastReviewed: 2026-11-16
tags: [java, exception, java-time, timezone, pitfalls]
related: [java/review/exceptions/exception-file-va-java-time, java/consolidate/build-test/viet-test-voi-junit]
---

## Tóm tắt nhanh

- Bọc exception thì **luôn truyền cause**: `new DichVuException("…", e)`. Mất cause = mất stack trace gốc trong log.
- Đừng `catch (Exception e) {}` hay chỉ `e.printStackTrace()`. Hoặc xử lý thật, hoặc ném lại kèm ngữ cảnh.
- `try/finally` tự đóng resource có thể **che** exception gốc. try-with-resources giữ lỗi gốc và gắn lỗi khi đóng vào `getSuppressed()`.
- Pattern ngày: **`yyyy`** (hoặc `uuuu`), không phải `YYYY`. **`MM`** là tháng, `mm` là phút.
- Đọc "bây giờ" qua **`Clock`** được tiêm vào, để test được và không phụ thuộc múi giờ của máy chủ.

## Cơ chế

**Exception chaining:** mỗi `Throwable` có thể có `cause`. Log framework in cả chuỗi (`Caused by: …`). Truyền cause vào constructor là cách duy nhất giữ được thông tin gốc khi chuyển lỗi giữa các tầng (repository → service → controller).

**Thời gian:** `Instant` là một điểm trên trục thời gian (UTC). "Ngày", "giờ" chỉ có nghĩa **khi gắn với múi giờ**. `ZoneId` chứa luật múi giờ (từ dữ liệu tzdb trong JDK), kể cả giờ mùa hè; `ZoneOffset` chỉ là một độ lệch cố định.

Mọi kết quả dưới đây đã chạy trên JDK 25.

## Exception

### Mất cause

```java bad
try { Integer.parseInt(id); }
catch (NumberFormatException e) {
    throw new DichVuException("Không tải được khách hàng " + id);     // lỗi gốc biến mất
}
```

```java good
catch (NumberFormatException e) {
    throw new DichVuException("Không tải được khách hàng " + id, e);
}
// getMessage(): Không tải được khách hàng K-01
// getCause():   java.lang.NumberFormatException: For input string: "K-01"
```

### Nuốt lỗi

```java bad
try { guiEmail(kh); } catch (Exception e) { }                 // không ai biết email không gửi được
try { guiEmail(kh); } catch (Exception e) { e.printStackTrace(); }   // ra stderr, không vào hệ thống log
```

```java good
try { guiEmail(kh); }
catch (MailException e) {
    log.warn("Không gửi được email cho {}", kh.id(), e);      // SLF4J: tham số cuối là exception
    hangDoiGuiLai.them(kh.id());                              // xử lý thật
}
```

Bắt **đúng loại** exception mình xử lý được. `catch (Exception e)` cũng bắt luôn `NullPointerException` của bug và giấu nó đi.

### try/finally che lỗi gốc

```java bad
LoiDong r = new LoiDong();                  // close() ném IllegalStateException
try { throw new IOException("lỗi khi đọc"); }
finally { r.close(); }
// caller nhận: "lỗi khi đóng", suppressed = 0 → lỗi đọc (lỗi thật) đã mất
```

```java good
try (LoiDong r = new LoiDong()) { throw new IOException("lỗi khi đọc"); }
// caller nhận: "lỗi khi đọc", getSuppressed()[0] = "lỗi khi đóng"
```

## Thời gian

### Pattern sai chữ

```java bad
LocalDate.of(2026, 12, 28).format(ofPattern("dd/MM/YYYY"));   // 28/12/2027 !
LocalDate.of(2024, 12, 30).format(ofPattern("dd/MM/YYYY"));   // 30/12/2025 !
LocalDateTime.of(2026, 11, 16, 10, 5).format(ofPattern("dd/mm/yyyy"));   // 16/05/2026 — 05 là phút
```

`YYYY` là **năm theo tuần** (week-based year): những ngày cuối tháng 12 thuộc tuần 1 của năm sau thì `YYYY` cho năm sau. Lỗi chỉ lộ ra vài ngày mỗi năm — đúng dịp chốt sổ cuối năm.

```java good
ofPattern("dd/MM/yyyy")      // 28/12/2026
```

### Parse "30/02" thành công

```java bad
LocalDate.parse("30/02/2026", ofPattern("dd/MM/uuuu"));   // 2026-02-28 — chế độ SMART tự sửa
```

```java good
var NGAY = ofPattern("dd/MM/uuuu").withResolverStyle(ResolverStyle.STRICT);
LocalDate.parse("30/02/2026", NGAY);    // DateTimeParseException
```

Ở chế độ `STRICT` phải dùng **`uuuu`**: `yyyy` là "năm của kỷ nguyên" và cần thêm `G` (kỷ nguyên). Đã thử: `dd/MM/yyyy` + `STRICT` báo lỗi cả với ngày hợp lệ `15/02/2026`. `LocalDate.parse("2026-02-30")` (định dạng ISO) thì luôn báo lỗi *Invalid date 'FEBRUARY 30'*.

### Cắt ngày theo UTC

```java bad
Instant giaoDich = Instant.parse("2026-11-16T17:30:00Z");
giaoDich.atZone(ZoneOffset.UTC).toLocalDate();                    // 2026-11-16
```

```java good
giaoDich.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();      // 2026-11-17
```

Báo cáo "doanh thu ngày 16/11" phải cắt theo múi giờ nghiệp vụ, không theo múi giờ của máy chủ (container thường chạy UTC) hay của DB.

### Giờ mùa hè

Việt Nam không có giờ mùa hè (đã kiểm tra: offset `+07:00` cả tháng 6 lẫn tháng 12). Nhưng hệ thống làm việc với đối tác nước ngoài thì gặp. Ngày 08/03/2026, New York chuyển từ 02:00 sang 03:00:

```java
var t = ZonedDateTime.of(2026, 3, 8, 1, 30, 0, 0, ZoneId.of("America/New_York"));
t.plusHours(1).toLocalTime();                 // 03:30 — 02:30 không tồn tại
t.plusDays(1).toLocalTime();                  // 01:30 — cộng theo lịch, giữ giờ địa phương
t.plus(Duration.ofDays(1)).toLocalTime();     // 02:30 — cộng đúng 24 giờ
ZonedDateTime.of(2026, 3, 8, 2, 30, 0, 0, ny).toLocalTime();   // 03:30 — tự dời
```

`Period` (ngày, tháng) cộng theo lịch; `Duration` cộng theo giờ thực. Lịch hẹn "9 giờ sáng mỗi ngày" dùng `plusDays`; timeout "24 giờ" dùng `Duration`.

### `LocalDate.now()` trong code nghiệp vụ

```java bad
int tinhTuoi(LocalDate ns) { return Period.between(ns, LocalDate.now()).getYears(); }
// test phụ thuộc ngày chạy; kết quả phụ thuộc múi giờ của máy chủ
```

```java good
class KhachHangService {
    private final Clock clock;                    // tiêm vào: production dùng Clock.system(VN), test dùng Clock.fixed
    KhachHangService(Clock clock) { this.clock = clock; }
    int tinhTuoi(LocalDate ns) { return Period.between(ns, LocalDate.now(clock)).getYears(); }
}
Clock co = Clock.fixed(Instant.parse("2026-11-16T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
LocalDate.now(co);   // 2026-11-16
LocalTime.now(co);   // 10:00
```

## Pitfalls

- `DateTimeFormatter` thread-safe và nên khai báo `static final`. `SimpleDateFormat` (API cũ) thì **không** thread-safe.
- Lưu `LocalDateTime` vào DB cho thời điểm giao dịch → mất thông tin múi giờ. Dùng `Instant`/`OffsetDateTime` với cột `timestamptz`.
- Cộng tháng dồn (`plusMonths(1)` nhiều lần) từ ngày 31 → trôi về 28. Tính kỳ thứ n bằng `ngayGoc.plusMonths(n)`.
- `catch (InterruptedException e) {}` — phải khôi phục cờ interrupt (bài *Concurrency*).

:::senior Góc nhìn senior
Xây quy ước cho cả team thay vì sửa từng chỗ: (1) một `@ControllerAdvice`/exception handler chung chuyển exception thành mã lỗi API, log một lần ở đó — các tầng dưới chỉ ném kèm ngữ cảnh; (2) mọi thời điểm lưu dạng `Instant` (UTC), chỉ chuyển sang `Asia/Ho_Chi_Minh` ở tầng hiển thị/báo cáo; (3) `Clock` là bean được tiêm, cấm `LocalDate.now()` không tham số trong code nghiệp vụ (có thể chặn bằng ArchUnit hoặc Error Prone).
:::

:::version Java 17 / 21 / 25
Mọi API trong bài có từ Java 8, trừ `Locale.of`. Dữ liệu múi giờ (tzdb) đi kèm JDK — cập nhật JDK định kỳ để có luật múi giờ mới, hoặc dùng công cụ `tzupdater` của Oracle với bản JDK cũ.
:::

:::interview Bạn lưu thời điểm tạo đơn hàng thế nào để hiển thị đúng cho người dùng ở nhiều múi giờ?
Lưu một **thời điểm tuyệt đối**: `Instant` trong Java, `timestamptz` trong PostgreSQL (hoặc `DATETIMEOFFSET`/UTC ở hệ khác). Không lưu `LocalDateTime` vì không biết nó thuộc múi giờ nào. Khi hiển thị hoặc làm báo cáo theo ngày, chuyển sang `ZonedDateTime` với múi giờ của người dùng hoặc của nghiệp vụ (`Asia/Ho_Chi_Minh`). API trả về chuỗi ISO-8601 có offset (`2026-11-16T10:30:00+07:00`) hoặc UTC (`…Z`) để frontend tự định dạng.
:::

:::quiz `LocalDate.of(2026, 12, 28).format(DateTimeFormatter.ofPattern("dd/MM/YYYY"))` cho gì?
- [ ] 28/12/2026
- [x] 28/12/2027
- [ ] Ném exception
- [ ] 28/12/YYYY

`YYYY` là năm theo tuần, và ngày 28/12/2026 thuộc tuần 1 của năm 2027. Đã chạy thử.
:::

:::quiz `try (r) { throw new IOException("đọc"); }` và `r.close()` ném `IllegalStateException("đóng")`. Caller bắt được gì?
- [ ] `IllegalStateException("đóng")`
- [x] `IOException("đọc")`, với `getSuppressed()` chứa `IllegalStateException("đóng")`
- [ ] Cả hai được ném lần lượt
- [ ] Không có gì

try-with-resources giữ lỗi gốc. Với try/finally tự viết thì ngược lại: lỗi khi đóng đè lên lỗi gốc. Đã chạy thử cả hai.
:::

:::quiz `ZonedDateTime` lúc 01:30 ngày 08/03/2026 ở `America/New_York`. `plusDays(1)` và `plus(Duration.ofDays(1))` cho giờ nào?
- [ ] 01:30 và 01:30
- [x] 01:30 và 02:30
- [ ] 02:30 và 01:30
- [ ] 02:30 và 02:30

Ngày đó chỉ dài 23 giờ. `plusDays` giữ giờ địa phương, `Duration` cộng đúng 24 giờ thực. Đã chạy thử.
:::

:::exercise Tính tuổi từ ngày sinh trên form
Viết `static int tinhTuoi(String ngaySinh, Clock clock)`: nhận chuỗi `dd/MM/uuuu`, từ chối ngày không tồn tại (30/02) và ngày ở tương lai bằng `IllegalArgumentException` (giữ cause khi parse lỗi). Với `Clock` cố định ngày 16/11/2026 giờ VN, kiểm tra: `20/05/1990` → 36, `16/11/2008` → 18, `17/11/2008` → 17, `29/02/2008` → 18.
???
```java
static final DateTimeFormatter NGAY =
    DateTimeFormatter.ofPattern("dd/MM/uuuu").withResolverStyle(ResolverStyle.STRICT);

static int tinhTuoi(String ngaySinh, Clock clock) {
    LocalDate ns;
    try {
        ns = LocalDate.parse(ngaySinh, NGAY);
    } catch (DateTimeParseException e) {
        throw new IllegalArgumentException("Ngày sinh không hợp lệ: " + ngaySinh, e);
    }
    LocalDate homNay = LocalDate.now(clock);
    if (ns.isAfter(homNay)) throw new IllegalArgumentException("Ngày sinh ở tương lai: " + ngaySinh);
    return Period.between(ns, homNay).getYears();
}
```

Đã chạy thử với `Clock.fixed(Instant.parse("2026-11-16T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"))`: 36, 18, 17, 18. `30/02/2000` và `2000-01-01` → "Ngày sinh không hợp lệ" (cause `DateTimeParseException`), `01/01/2030` → "ở tương lai". Thử thêm với `Instant` `2026-11-15T17:30:00Z`: ở VN đã là ngày 16, nên người sinh 16/11/2008 vừa tròn 18 — nếu tính theo UTC sẽ ra 17.
:::
