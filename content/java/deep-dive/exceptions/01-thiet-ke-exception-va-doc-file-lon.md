---
title: "Thiết kế exception và xử lý file lớn — chi phí của stack trace, kết quả thay cho exception, charset"
summary: "Đo chi phí ném exception có và không có stack trace, khi nào trả kết quả (sealed result) thay vì ném, import CSV gom đủ lỗi từng dòng, vì sao readAllLines làm hết heap còn Files.lines thì không, và file không phải UTF-8 bị hỏng lặng lẽ thế nào. Đo trên JDK 21."
level: advanced
version: 21
lastReviewed: 2026-11-18
tags: [java, exception, design, file-io, charset, performance]
related: [java/consolidate/exceptions/xu-ly-loi-va-thoi-gian-dung-cach, java/deep-dive/oop/sealed-record-pattern-va-mo-hinh-domain]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS; đo lại chi phí exception và đọc file lớn trên JDK 21; Gatherers chuyển thành ghi chú Java 24+."
---

## Tóm tắt nhanh

- Phần tốn kém của exception là **chụp stack trace** (`fillInStackTrace`), không phải `throw`/`catch`. Đo được: chậm hơn ~2,3 lần so với exception không stack trace, và chậm hơn **~50 lần** so với không dùng exception.
- Exception dành cho tình huống **ngoại lệ**. Kết quả "bình thường nhưng không thành công" (dòng CSV sai, form không hợp lệ) nên là **giá trị trả về** — sealed interface `KetQua`.
- Mỗi tầng chuyển exception sang ngôn ngữ của tầng đó (*exception translation*) và giữ `cause`.
- File lớn: `Files.lines`/`BufferedReader` xử lý từng dòng. `readAllLines` với file 93 MB giữ lại ~251 MB heap.
- Luôn chỉ rõ charset khi đọc file từ bên ngoài. Sai charset: `Files.readAllLines` ném `MalformedInputException`, còn `InputStreamReader` âm thầm thay bằng `�`.

## Cơ chế: exception tốn gì

Khi tạo `Throwable`, constructor gọi `fillInStackTrace()` để duyệt và ghi lại toàn bộ stack của thread. Stack càng sâu (framework web thường 100–200 tầng) càng tốn. `throw` rồi `catch` thì JIT xử lý tương đối rẻ.

Đo trên JDK 21: 200.000 lần ném qua 50 tầng gọi (số đo thô bằng `System.nanoTime`):

```text
lần 0: có stack trace 926 ms, không stack trace 367 ms, không exception 16 ms
lần 1: có stack trace 789 ms, không stack trace 415 ms, không exception 16 ms
lần 2: có stack trace 821 ms, không stack trace 353 ms, không exception 17 ms
```

Exception không stack trace dùng constructor 4 tham số:

```java
class LoiNhanh extends RuntimeException {
    LoiNhanh(String m) { super(m, null, false, false); }   // enableSuppression=false, writableStackTrace=false
}
```

Đừng dùng cách này cho lỗi thật — không có stack trace thì không debug được. Nó chỉ hợp lý cho exception dùng làm tín hiệu điều khiển trong thư viện (hiếm). Cách đúng là **không dùng exception cho luồng thông thường**.

JIT còn có tối ưu `OmitStackTraceInFastThrow`: một số exception nội bộ (`NullPointerException`, `ArithmeticException`…) ném lặp lại rất nhiều lần ở cùng một chỗ có thể bị bỏ stack trace. Nếu log production thấy NPE **không có stack trace**, tìm lần xuất hiện đầu tiên trong log, hoặc chạy với `-XX:-OmitStackTraceInFastThrow`.

## Kết quả thay cho exception: import CSV

Import file khách hàng: người dùng cần biết **mọi** dòng lỗi, không chỉ dòng đầu tiên.

```java
sealed interface KetQua permits ThanhCong, Loi {}
record ThanhCong(String ma, String ten) implements KetQua {}
record Loi(int dong, String lyDo) implements KetQua {}

KetQua phanTich(int so, String dong) {
    String[] c = dong.split(",", -1);
    if (c.length != 3) return new Loi(so, "cần 3 cột, có " + c.length);
    if (!c[2].matches("\\d{12}")) return new Loi(so, "CCCD không hợp lệ: " + c[2]);
    return new ThanhCong(c[0].strip(), c[1].strip());
}
```

```text
ma,ten,cccd
K1,Nguyễn An,001203004567
K2,Trần Bình
K3,Lê Chi,12345
K4,Phạm Dũng,079088001234
```

```text
thành công 2, lỗi: [Loi[dong=3, lyDo=cần 3 cột, có 2], Loi[dong=4, lyDo=CCCD không hợp lệ: 12345]]
```

Ném exception ở dòng 3 thì dòng 4 không được kiểm tra, người dùng phải sửa và tải lên nhiều lần. Kết quả dạng giá trị cũng dễ test và dễ chuyển thành JSON trả cho frontend.

Exception vẫn đúng cho: file không đọc được, mất kết nối DB, bug (`NullPointerException`) — những thứ phía gọi không xử lý từng cái được mà chỉ dừng, log và báo lỗi chung.

## Exception translation giữa các tầng

```text
Controller  ←  KhachHangKhongTonTai (→ HTTP 404), DuLieuKhongHopLe (→ 400)
Service     ←  chuyển lỗi kỹ thuật thành lỗi nghiệp vụ, giữ cause
Repository  ←  SQLException / DataAccessException (Spring)
```

Quy tắc:

- Tầng dưới không ném exception "của tầng trên" (repository không ném exception HTTP).
- Tầng trên không phải bắt `SQLException` — nếu phải, abstraction đang bị rò rỉ.
- Log **một lần**, ở nơi xử lý cuối cùng (exception handler chung). Log ở mọi tầng rồi ném lại → mỗi lỗi in ra 3–4 lần trong log.

## File lớn

File 2 triệu dòng tiếng Việt (`K1,Nguyễn Văn An,Hà Nội,0912345678`), 93 MB, đo trên JDK 21 (lượng heap còn giữ lại sau `System.gc()`):

```text
lines(): giữ lại ~0 MB;  readAllLines: giữ lại ~251 MB (2000000 dòng)
```

Với `-Xmx240m`, `readAllLines` ném `OutOfMemoryError: Java heap space`. Dòng có dấu tiếng Việt nên mỗi `String` lưu UTF-16 (2 byte/ký tự). Mỗi dòng thành một `String` (header object, mảng `byte[]`, phần tử trong `ArrayList`), nên dữ liệu trên heap lớn hơn kích thước file vài lần.

```java bad
List<String> all = Files.readAllLines(path);         // cả file nằm trong heap
for (String l : all) xuLy(l);
```

```java good
try (Stream<String> s = Files.lines(path, StandardCharsets.UTF_8)) {
    s.skip(1).map(this::phanTich).forEach(this::luu);   // từng dòng
}
// gom theo lô để insert DB trên Java 21: xem bài *Bên trong Stream* (Java 24+ có Gatherers.windowFixed)
```

Quên đóng `Files.lines` → rò file descriptor. Trên Linux, process mặc định có giới hạn số file mở (`ulimit -n`); hết giới hạn thì mọi thao tác mở file/socket đều lỗi `Too many open files`.

## Charset

File CSV xuất từ phần mềm cũ hoặc Excel trên Windows thường không phải UTF-8. Đã thử với file `K3,Lê Chi,Hà Nam` lưu bằng windows-1258:

```text
Files.readAllLines(f)                                      → MalformedInputException: Input length = 1
new InputStreamReader(in, UTF_8).readLine()                → K3,L� Chi,H� Nam     ← hỏng lặng lẽ
Files.readAllLines(f, Charset.forName("windows-1258"))     → [K3,Lê Chi,Hà Nam]
```

`Files.readAllLines`/`readString` báo lỗi ngay — đó là hành vi tốt. `InputStreamReader`, `Scanner` và nhiều thư viện CSV mặc định **thay thế** byte lỗi, dữ liệu sai đi thẳng vào DB. Cách làm: quy định file đầu vào là UTF-8 (có thể kèm BOM từ Excel — cần bỏ BOM ở dòng đầu), kiểm tra bằng decoder báo lỗi (`CodingErrorAction.REPORT`), và trả lỗi rõ ràng cho người dùng.

## So sánh phương án

| Tình huống | Chọn |
|---|---|
| Dữ liệu đầu vào sai, cần báo nhiều lỗi | Trả `KetQua`/danh sách lỗi |
| Không đọc được file, mất kết nối | Exception (checked hoặc bọc thành unchecked) |
| Lỗi nghiệp vụ dừng cả thao tác (không đủ số dư) | Exception nghiệp vụ, controller chuyển thành mã lỗi |
| Đọc file vài MB | `Files.readString`/`readAllLines` |
| Đọc file lớn hoặc không biết kích thước | `Files.lines` / `BufferedReader` |
| File từ người dùng | Charset rõ ràng + decoder báo lỗi |

## Tính năng mới theo phiên bản

- **Java 7**: try-with-resources, multi-catch, suppressed exception, NIO.2 (`Files`, `Path`).
- **Java 14**: helpful NullPointerException (JEP 358) — thông báo chỉ rõ biến nào `null`.
- **Java 18**: UTF-8 là charset mặc định (JEP 400).
- **Java 21**: chưa có Gatherers; gom lô bằng vòng lặp hoặc `Iterator`.
- **Khi nâng lên Java 24+**: `Gatherers.windowFixed` giúp xử lý file theo lô ngay trong Stream.

:::senior Góc nhìn senior
Trong code review, hỏi ba câu với mỗi `catch`: (1) có xử lý thật hay chỉ chuyển lỗi đi? (2) cause có được giữ không? (3) lỗi có bị log nhiều lần không? Với import file, thiết kế từ đầu theo luồng (stream từng dòng, gom lô, báo đủ lỗi) — file thử 100 dòng chạy tốt rồi production nhận file 2 triệu dòng là kịch bản rất hay gặp ở dự án ngân hàng, bảo hiểm.
:::

:::quiz Phần nào của exception tốn kém nhất?
- [ ] Từ khoá `throw`
- [ ] Khối `catch`
- [x] Chụp stack trace khi tạo object exception
- [ ] Gọi `getMessage()`

Đo được: tắt `writableStackTrace` nhanh hơn ~2,5 lần, nhưng vẫn chậm hơn ~100 lần so với không dùng exception.
:::

:::quiz Đọc file windows-1258 bằng `new InputStreamReader(in, StandardCharsets.UTF_8)`. Điều gì xảy ra?
- [ ] Ném `MalformedInputException`
- [x] Đọc được, nhưng ký tự có dấu bị thay bằng `�`
- [ ] Tự nhận ra charset và đọc đúng
- [ ] Ném `UnsupportedEncodingException`

Decoder của `InputStreamReader` mặc định dùng `CodingErrorAction.REPLACE`. Đã chạy thử: `K3,L� Chi,H� Nam`.
:::

:::exercise Báo lỗi CSV có số dòng
Mở rộng `phanTich` để kiểm tra thêm: mã khách hàng phải bắt đầu bằng `K` và không trùng trong file. Viết hàm `List<Loi> kiemTra(Path file)` đọc bằng `Files.lines` (UTF-8, bỏ dòng tiêu đề) và trả mọi lỗi.
???
```java
List<Loi> kiemTra(Path file) throws IOException {
    var daThay = new HashSet<String>();
    var loi = new ArrayList<Loi>();
    try (var lines = Files.lines(file, StandardCharsets.UTF_8)) {
        var it = lines.iterator();
        int so = 0;
        while (it.hasNext()) {
            String dong = it.next();
            if (++so == 1) continue;                           // tiêu đề
            switch (phanTich(so, dong)) {
                case Loi l -> loi.add(l);
                case ThanhCong(var ma, var ten) when !ma.startsWith("K") -> loi.add(new Loi(so, "mã phải bắt đầu bằng K: " + ma));
                case ThanhCong(var ma, var ten) when !daThay.add(ma) -> loi.add(new Loi(so, "mã trùng: " + ma));
                case ThanhCong ok -> { }
            }
        }
    }
    return loi;
}
```

Đã chạy thử với file có dòng thiếu cột, mã `X3` và mã `K1` lặp lại: `Loi[dong=3, lyDo=cần 3 cột, có 2]`, `Loi[dong=4, lyDo=mã phải bắt đầu bằng K: X3]`, `Loi[dong=5, lyDo=mã trùng: K1]`.

Dùng `iterator()` của stream để có số dòng, mà vẫn đọc từng dòng. `daThay.add(ma)` trả `false` khi đã có — gọn cho kiểm tra trùng. Với file rất lớn, set `daThay` cũng lớn dần: nếu không chấp nhận được thì kiểm tra trùng bằng ràng buộc `UNIQUE` của DB khi insert.
:::
