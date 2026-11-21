---
title: "I/O cổ điển và Serializable — InputStream, Reader, buffer, try-with-resources, transient"
summary: "Nhắc nhanh hai họ InputStream/OutputStream (byte) và Reader/Writer (ký tự), cách lồng stream theo kiểu decorator, buffer và charset, đọc đủ byte bằng readNBytes, transferTo, GZIP, và Serializable cơ bản với transient, serialVersionUID. Mọi output đã chạy trên JDK 21."
type: card
level: core
version: 21
lastReviewed: 2026-11-21
tags: [java, io, stream, reader, serialization]
related: [java/consolidate/io/doc-ghi-file-dung-cach-va-bay-serialization, java/review/exceptions/exception-file-va-java-time]
---

## Tóm tắt nhanh

- **Byte** đi qua `InputStream`/`OutputStream` (file nhị phân, mạng, ảnh, nén). **Ký tự** đi qua `Reader`/`Writer` — luôn có một **charset** ở giữa (`InputStreamReader(in, UTF_8)`).
- Stream được **lồng nhau** (decorator): `new BufferedReader(new InputStreamReader(new FileInputStream(f), UTF_8))`. Đóng stream ngoài cùng là đóng cả chuỗi.
- Luôn mở trong **try-with-resources**. Luôn có **buffer** (đọc theo mảng hoặc dùng `Buffered…`).
- `read(buf)` có thể trả về **ít hơn** độ dài mảng. Cần đúng n byte thì `readNBytes(n)`; đọc hết thì `readAllBytes()`; chép sang stream khác thì `transferTo(out)`.
- `Serializable` biến object thành byte và ngược lại. Field `transient` không được ghi. Luôn khai báo `serialVersionUID`. Dữ liệu trao đổi giữa hệ thống thì dùng **JSON**, không dùng Java serialization.

## Ví dụ nhanh (đã chạy trên JDK 21)

```java title="Byte và ký tự"
Path csv = Path.of("kh.csv");
try (Writer w = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(csv.toFile()), StandardCharsets.UTF_8))) {
    w.write("ma,ten\nK1,Nguyễn An\n");
}
Files.size(csv);      // 22 byte cho 20 ký tự — "ễ" chiếm 3 byte trong UTF-8

try (BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(csv.toFile()), StandardCharsets.UTF_8))) {
    String dong;
    while ((dong = r.readLine()) != null) xuLy(dong);   // "ma,ten", "K1,Nguyễn An"
}
// gọn hơn với NIO.2 — cùng kết quả, mặc định UTF-8:
try (BufferedReader r = Files.newBufferedReader(csv)) { r.lines().count(); }   // 2
```

```java title="Đọc đủ, chép, nén"
InputStream in = new SequenceInputStream(new ByteArrayInputStream(new byte[100]), new ByteArrayInputStream(new byte[100]));
in.read(new byte[200]);          // 100 — chỉ là "đọc được bao nhiêu thì trả bấy nhiêu"
// tạo lại một stream giống hệt rồi:
in.readNBytes(200).length;       // 200 — đọc tới khi đủ (hoặc hết dữ liệu)

try (var src = Files.newInputStream(f); var dst = Files.newOutputStream(Path.of("copy.bin"))) {
    src.transferTo(dst);         // 20000000 — chép toàn bộ, không tự viết vòng lặp
}

try (var out = new GZIPOutputStream(Files.newOutputStream(Path.of("kh.csv.gz")))) {
    out.write(duLieu);           // 71.000 byte → file nén 1.271 byte
}
try (var gin = new GZIPInputStream(Files.newInputStream(Path.of("kh.csv.gz")))) {
    gin.readAllBytes().length;   // 71000
}
```

```java title="Serializable"
class TaiKhoan implements Serializable {
    private static final long serialVersionUID = 1L;
    final String so;
    long soDu;
    transient String matKhau = "bí mật";      // không được ghi
}

byte[] du;
try (var out = new ObjectOutputStream(baos)) { out.writeObject(new TaiKhoan("001", 1_000_000)); }   // 79 byte
TaiKhoan doc = (TaiKhoan) new ObjectInputStream(new ByteArrayInputStream(du)).readObject();
doc.so;        // "001"
doc.soDu;      // 1000000
doc.matKhau;   // null — field transient nhận giá trị mặc định, KHÔNG chạy lại "= bí mật"
```

## Bảng chọn nhanh

| Cần | Dùng |
|---|---|
| Đọc/ghi file nhỏ | `Files.readString`, `Files.writeString`, `Files.readAllBytes` |
| Đọc file văn bản lớn theo dòng | `Files.newBufferedReader(path)` hoặc `Files.lines(path)` |
| Ghi file văn bản lớn | `Files.newBufferedWriter(path)` |
| Đọc/ghi nhị phân | `Files.newInputStream` / `newOutputStream` + mảng buffer 8–64 KB |
| Chép stream sang stream | `in.transferTo(out)` |
| Đọc đúng n byte (header file, giao thức mạng) | `readNBytes(n)` hoặc `DataInputStream.readFully` |
| Nén / giải nén | `GZIPOutputStream` / `GZIPInputStream`, `ZipOutputStream` |
| Ghi số, chuỗi dạng nhị phân có cấu trúc | `DataOutputStream` (`writeInt`, `writeUTF`) |
| Giữ dữ liệu trong bộ nhớ như một stream | `ByteArrayInputStream`/`OutputStream`, `StringReader`/`Writer` |
| Lưu/gửi object giữa hệ thống | JSON (Jackson), Protobuf — không dùng `Serializable` |

| Họ | Đơn vị | Lớp gốc | Ví dụ |
|---|---|---|---|
| Stream | byte | `InputStream`, `OutputStream` | `FileInputStream`, `BufferedInputStream`, `GZIPInputStream`, `ObjectInputStream` |
| Reader/Writer | ký tự (`char`) | `Reader`, `Writer` | `InputStreamReader`, `BufferedReader`, `StringWriter`, `PrintWriter` |
| Cầu nối | byte ↔ ký tự | `InputStreamReader`, `OutputStreamWriter` | luôn truyền charset |

## Lỗi hay gặp: quên đóng hoặc flush

```java bad
var bw = new BufferedWriter(new FileWriter("quen-flush.txt"));
bw.write("dữ liệu");
// chương trình kết thúc ở đây — file có 0 byte
```

```java good
try (var bw = Files.newBufferedWriter(Path.of("quen-flush.txt"))) {
    bw.write("dữ liệu");
}                                    // close() gọi flush() trước, rồi đóng file: 11 byte
```

Đã chạy thử: trước `close()` file có **0 byte**, sau `close()` có 11 byte. Buffer chỉ được đẩy xuống đĩa khi đầy, khi `flush()` hoặc khi `close()`. Quên đóng còn rò file descriptor (bài *Thiết kế exception và đọc file lớn*).

:::version 21 Java 8 / 11 / 17 / 21
- try-with-resources: Java 7; từ Java 9 dùng được biến effectively final có sẵn: `try (in) { … }`.
- `InputStream.transferTo`, `readAllBytes`, `readNBytes`: Java 9. `InputStream.nullInputStream()`: Java 11. `Files.readString`/`writeString`: Java 11.
- `FileReader`/`FileWriter` nhận charset: Java 11 (`new FileReader(f, UTF_8)`). Charset mặc định là UTF-8 trên mọi hệ điều hành: Java 18 (JEP 400) — trên Java 17/Windows, `new FileReader(f)` dùng charset của hệ điều hành.
- `ObjectInputFilter` chặn class khi deserialize: Java 9; filter theo ngữ cảnh: Java 17 (JEP 415).
:::

:::interview `InputStream` và `Reader` khác nhau thế nào? Vì sao cần `InputStreamReader`?
`InputStream` đọc **byte** thô — dùng cho mọi dữ liệu nhị phân và là thứ hệ điều hành thật sự cung cấp (file, socket). `Reader` đọc **ký tự** Unicode. Muốn biến byte thành ký tự phải biết **charset** (UTF-8, windows-1258…), và `InputStreamReader` là cầu nối thực hiện việc giải mã đó. Không chỉ rõ charset thì dùng charset mặc định của JVM — UTF-8 từ Java 18, nhưng trước đó phụ thuộc hệ điều hành, là nguồn lỗi "chữ tiếng Việt thành ký tự lạ" kinh điển. Cả hai họ đều dùng mẫu decorator: bọc thêm `Buffered…` để có buffer, `GZIP…` để nén, `Object…` để serialize.
:::

:::quiz `in.read(buf)` với `buf` dài 200 byte, stream còn 200 byte dữ liệu. Giá trị trả về là gì?
- [ ] Luôn là 200
- [x] Bất kỳ số nào từ 1 tới 200 — read chỉ đảm bảo đọc ít nhất 1 byte nếu còn dữ liệu
- [ ] 0 nếu dữ liệu chưa sẵn sàng
- [ ] -1 vì mảng đã đầy

Đã chạy thử với `SequenceInputStream` gồm hai stream 100 byte: `read(buf)` trả 100. Cần đủ 200 byte thì dùng `readNBytes(200)` hoặc lặp tới khi đủ. Đây là lỗi hay gặp khi đọc từ socket.
:::

:::quiz Class `Serializable` có field `transient String matKhau = "bí mật"`. Sau khi ghi rồi đọc lại, `matKhau` là gì?
- [ ] `"bí mật"` — giá trị khởi tạo chạy lại
- [x] `null`
- [ ] Chuỗi rỗng `""`
- [ ] Ném `NotSerializableException`

Khi deserialize, constructor và khởi tạo field của class `Serializable` **không** chạy; field `transient` nhận giá trị mặc định (`null`, `0`, `false`). Đã chạy thử trên JDK 21.
:::
