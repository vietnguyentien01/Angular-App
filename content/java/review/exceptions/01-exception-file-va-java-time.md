---
title: "Exception, đọc ghi file và java.time — những gì dùng hằng ngày"
summary: "Nhắc nhanh checked và unchecked exception, try-with-resources, exception tự định nghĩa, đọc ghi file bằng Files/Path, và java.time: LocalDate, Instant, ZonedDateTime, Period, Duration, DateTimeFormatter. Mọi output đã chạy trên JDK 21."
type: card
level: core
version: 21
lastReviewed: 2026-11-18
tags: [java, exception, file, java-time]
related: [java/consolidate/exceptions/xu-ly-loi-va-thoi-gian-dung-cach, java/deep-dive/exceptions/thiet-ke-exception-va-doc-file-lon]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS; chạy lại mọi ví dụ trên JDK 21."
---

## Tóm tắt nhanh

- **Checked** exception (`IOException`, `SQLException`) phải `catch` hoặc khai báo `throws`. **Unchecked** (`RuntimeException` và lớp con: `IllegalArgumentException`, `NullPointerException`…) thì không bắt buộc.
- Mọi thứ cần đóng (file, kết nối, stream file) → **try-with-resources**: tự đóng theo thứ tự ngược, kể cả khi có exception.
- File: `Path.of(...)`, `Files.readString`, `Files.readAllLines`, `Files.writeString`, `Files.lines` (stream, phải đóng). Charset mặc định là **UTF-8** từ Java 18.
- Thời gian: **`Instant`** cho thời điểm (log, DB), **`LocalDate`** cho ngày không giờ (ngày sinh), **`ZonedDateTime`** khi hiển thị theo múi giờ. Không dùng `java.util.Date`/`Calendar` trong code mới.

## Ví dụ nhanh (đã chạy trên JDK 21)

```java title="Exception"
class KhongDuSoDuException extends RuntimeException {
    KhongDuSoDuException(String soTk, long can, long co) {
        super("TK " + soTk + " cần " + can + " nhưng chỉ có " + co);
    }
}

try {
    Integer.parseInt("12a");
} catch (NumberFormatException e) {
    // e.getMessage(): For input string: "12a"
}

try (var a = new TaiNguyen("A"); var b = new TaiNguyen("B")) {
    // dùng A, B
}
// in ra: mở A, mở B, dùng A, B, đóng B, đóng A — đóng theo thứ tự ngược

try { … } catch (ClassCastException | NullPointerException e) { … }   // multi-catch
```

```java title="File"
Path p = Path.of("khach-hang.csv");
Files.writeString(p, "ma,ten\nK1,Nguyễn An\nK2,Trần Bình\n");
List<String> lines = Files.readAllLines(p);        // 3 dòng
try (Stream<String> s = Files.lines(p)) {           // đọc dần, PHẢI đóng
    long n = s.skip(1).count();                     // 2
}
Files.readString(Path.of("/khong/ton/tai.txt"));    // NoSuchFileException: /khong/ton/tai.txt
```

```java title="java.time"
LocalDate.of(2026, 1, 31).plusMonths(1);             // 2026-02-28 — tự lùi về cuối tháng
LocalDate.of(2024, 2, 29).plusYears(1);              // 2025-02-28
Period.between(LocalDate.of(1990, 5, 20), LocalDate.of(2026, 11, 16));   // P36Y5M27D → 36 tuổi
ChronoUnit.DAYS.between(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));   // 364

Instant t = Instant.parse("2026-11-16T03:30:00Z");
t.atZone(ZoneId.of("Asia/Ho_Chi_Minh"));             // 2026-11-16T10:30+07:00[Asia/Ho_Chi_Minh]

var fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
LocalDateTime.parse("16/11/2026 10:30", fmt);        // 2026-11-16T10:30
Duration.between(LocalTime.of(8, 0), LocalTime.of(17, 30));   // PT9H30M
LocalDate.of(2026, 11, 16).with(TemporalAdjusters.lastDayOfMonth());   // 2026-11-30
```

## Bảng chọn nhanh

| Cần | Dùng |
|---|---|
| Tham số sai (lỗi của người gọi) | `IllegalArgumentException` |
| Gọi method khi object chưa sẵn sàng | `IllegalStateException` |
| Lỗi nghiệp vụ có ý nghĩa riêng | exception tự định nghĩa (thường extends `RuntimeException`) |
| Đọc file nhỏ | `Files.readString` / `Files.readAllLines` |
| Đọc file lớn | `Files.lines` (trong try-with-resources) hoặc `BufferedReader` |
| Lưu thời điểm xảy ra (log, DB) | `Instant` (cột `timestamptz`) |
| Ngày sinh, ngày hiệu lực hợp đồng | `LocalDate` |
| Hiển thị giờ cho người dùng VN | `instant.atZone(ZoneId.of("Asia/Ho_Chi_Minh"))` |
| Khoảng theo lịch (tháng, năm) / theo giờ phút | `Period` / `Duration` |

## Lỗi hay gặp: `return` trong `finally`

```java bad
static int g() {
    try { throw new IllegalStateException("lỗi thật"); }
    finally { return 2; }          // exception bị nuốt mất, g() trả 2
}
```

```java good
// finally chỉ dọn dẹp, không return, không throw. Dọn tài nguyên thì dùng try-with-resources.
```

Đã chạy thử: `g()` trả `2`, exception biến mất không dấu vết. `finally` luôn chạy trước khi `try` trả về, nên một `return` trong đó đè lên mọi kết quả và exception.

:::version Java 17 / 21 / 25
- `Files.readString`/`writeString`: Java 11. `Path.of`: Java 11 (trước đó `Paths.get`).
- Charset mặc định **UTF-8** cho mọi nền tảng: Java 18 (JEP 400). Trên Java 17 chạy trên Windows, `Files.readAllLines` vẫn dùng UTF-8, nhưng `new FileReader(f)` dùng charset hệ điều hành (vd windows-1252).
- java.time: Java 8.
:::

:::interview Checked và unchecked exception khác nhau thế nào? Khi nào dùng loại nào?
Checked exception (lớp con của `Exception` nhưng không phải `RuntimeException`) bị compiler bắt buộc xử lý hoặc khai báo `throws`; dùng cho lỗi bên ngoài mà người gọi có thể khôi phục (file không có, mạng lỗi). Unchecked (`RuntimeException`) dùng cho lỗi lập trình (tham số sai, trạng thái sai) và ngày càng được dùng cho lỗi nghiệp vụ, vì checked exception không đi được qua lambda/Stream và làm chữ ký method lan rộng. Các framework như Spring cũng chuyển lỗi truy cập dữ liệu thành unchecked (`DataAccessException`).
:::

:::quiz Hai resource `A`, `B` mở trong `try (var a = …; var b = …)`. Thứ tự đóng là gì?
- [ ] A rồi B
- [x] B rồi A
- [ ] Không xác định
- [ ] Chỉ đóng khi có exception

Đóng theo thứ tự ngược với lúc mở, giống stack. Đã chạy thử.
:::

:::quiz `LocalDate.of(2026, 1, 31).plusMonths(1).plusMonths(1)` và `LocalDate.of(2026, 1, 31).plusMonths(2)` cho gì?
- [ ] Cả hai là 2026-03-31
- [x] 2026-03-28 và 2026-03-31
- [ ] Cả hai là 2026-03-28
- [ ] Ném exception vì 31/02 không tồn tại

Lần cộng đầu lùi về 28/02, lần sau giữ ngày 28. Cộng 2 tháng một lần thì giữ được ngày 31. Đã chạy thử. Tính kỳ thanh toán hằng tháng nên luôn cộng từ ngày gốc.
:::

:::quiz Một giao dịch lúc `2026-11-16T17:30:00Z`. Nó thuộc ngày nào theo giờ Việt Nam?
- [ ] 2026-11-16
- [x] 2026-11-17
- [ ] 2026-11-15
- [ ] Tuỳ cấu hình máy chủ

17:30 UTC + 7 giờ = 00:30 ngày 17. Đã chạy thử. Báo cáo "giao dịch trong ngày" mà cắt ngày theo UTC sẽ lệch 7 tiếng.
:::
