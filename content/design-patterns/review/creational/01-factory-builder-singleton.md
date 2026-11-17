---
title: "Factory, Builder, Singleton — ba cách tạo object và khi nào dùng"
summary: "Factory giấu class cụ thể sau một method, Builder tạo object nhiều tham số mà không nhầm thứ tự, Singleton đảm bảo chỉ một instance — và vì sao trong ứng dụng Spring bạn gần như không tự viết Singleton. Mọi output đã chạy trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, factory, builder, singleton, creational]
related: [design-patterns/consolidate/creational/builder-va-static-factory-dung-cach, design-patterns/deep-dive/creational/singleton-va-khoi-tao-luoi-thread-safe]
---

## Tóm tắt nhanh

- **Creational pattern** trả lời câu hỏi: *ai* tạo object, *khi nào*, và người dùng cần biết *bao nhiêu* về class cụ thể.
- **Factory** (static factory / factory method): một method trả về interface, chọn class cụ thể bên trong. Người gọi không `new` trực tiếp.
- **Builder**: tạo object có nhiều tham số (nhất là tham số tuỳ chọn) bằng các method có tên, kiểm tra hợp lệ một lần ở `build()`.
- **Singleton**: đúng một instance cho cả ứng dụng. Trong ứng dụng có DI container (Spring, Angular), để **container** quản lý vòng đời thay vì tự viết `getInstance()`.

## Ví dụ nhanh (đã chạy trên JDK 25)

```java title="Factory"
sealed interface KenhThongBao permits Sms, Email {
    void gui(String toi, String noiDung);
    static KenhThongBao tu(String cauHinh) {            // người gọi không biết class cụ thể
        return switch (cauHinh) {
            case "sms" -> new Sms("VNPT");
            case "email" -> new Email("smtp.congty.vn");
            default -> throw new IllegalArgumentException("kênh không hỗ trợ: " + cauHinh);
        };
    }
}
record Sms(String nhaMang) implements KenhThongBao { /* gui(...) in ra [SMS ...] */ }
record Email(String may) implements KenhThongBao { /* gui(...) in ra [Email ...] */ }

KenhThongBao.tu("sms").gui("0901234567", "Mã OTP 123456");
KenhThongBao.tu("email").gui("an@vidu.vn", "Sao kê tháng 10");
// [SMS VNPT] 0901234567: Mã OTP 123456
// [Email smtp.congty.vn] an@vidu.vn: Sao kê tháng 10
KenhThongBao.tu("zalo");   // IllegalArgumentException: kênh không hỗ trợ: zalo
```

```java title="Builder trong JDK"
var req = HttpRequest.newBuilder(URI.create("https://doitac.vidu.vn/tra-cuu"))
    .timeout(Duration.ofSeconds(3))
    .header("Accept", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString("{\"cccd\":\"001203004567\"}"))
    .build();
// POST https://doitac.vidu.vn/tra-cuu timeout=PT3S {Accept=[application/json]}
```

```java title="Singleton gọn nhất: enum"
enum BoDemMa {
    INSTANCE;
    private final AtomicLong so = new AtomicLong();
    long tiepTheo() { return so.incrementAndGet(); }
}
```

Static factory có sẵn khắp JDK: `List.of`, `Optional.of`, `Integer.valueOf`, `Duration.ofSeconds`, `Path.of`. Ưu điểm so với constructor: có **tên** nói lên ý định, có thể trả về object có sẵn (cache) hoặc lớp con.

## Bảng chọn nhanh

| Tình huống | Chọn |
|---|---|
| Chọn cài đặt theo cấu hình/đầu vào | Factory (static method trên interface, hoặc bean `@Configuration` trong Spring) |
| ≥ 4 tham số, nhiều tham số tuỳ chọn, cùng kiểu dễ nhầm | Builder |
| 1–3 tham số, đều bắt buộc | Constructor hoặc `record` |
| Cần một instance dùng chung (cấu hình, client HTTP, pool) | Bean singleton của DI container |
| Không có DI container (thư viện nhỏ, CLI) | `enum` Singleton hoặc holder idiom |

## Một lỗi hay gặp: so sánh object từ factory có cache bằng `==`

```java
Integer.valueOf(127) == Integer.valueOf(127);   // true
Integer.valueOf(128) == Integer.valueOf(128);   // false
```

`Integer.valueOf` trả object có sẵn cho -128..127, ngoài khoảng đó tạo mới. Factory **được phép** cache, nên đừng bao giờ dựa vào `==` với object do factory trả về — dùng `equals`.

:::version Java 8 / 17 / 25
Java 9 thêm `List.of`, `Set.of`, `Map.of` (static factory bất biến). Java 11 có `HttpClient`/`HttpRequest` theo kiểu builder. Java 16 có `record` — bớt cần builder cho object ít trường. Java 17 có `sealed`, giúp factory trả về một tập con đóng và `switch` kiểm tra đủ trường hợp. Java 25 có `StableValue` (preview) cho khởi tạo lười một lần, thread-safe (bài *Singleton và khởi tạo lười*).
:::

:::interview Vì sao trong Spring hiếm khi phải tự viết Singleton?
Bean mặc định có scope **singleton**: container tạo một instance, quản lý vòng đời (khởi tạo, `@PreDestroy`) và tiêm vào nơi cần. Bạn được lợi ích của Singleton (một instance dùng chung) mà không có nhược điểm của Singleton tự viết: trạng thái toàn cục truy cập qua `getInstance()` ở bất cứ đâu, phụ thuộc ẩn, không thay được bằng mock khi test. Lưu ý: "singleton" của Spring là một instance **trong một ApplicationContext**, không phải trong cả JVM.
:::

:::quiz Lợi ích chính của `KenhThongBao.tu("sms")` so với `new Sms("VNPT")` ở mọi nơi?
- [ ] Chạy nhanh hơn
- [x] Người gọi chỉ phụ thuộc interface; đổi cách chọn hay thêm kênh mới chỉ sửa một chỗ
- [ ] Tiết kiệm bộ nhớ
- [ ] Không cần record

Factory gom quyết định "dùng class nào" về một nơi. Người gọi không import `Sms` hay `Email`.
:::

:::quiz Constructor `KhoanVay(long soTien, int kyHan, int anHan, BigDecimal lai, String taiSan)`. Rủi ro lớn nhất khi gọi nó?
- [ ] Không tạo được object bất biến
- [x] Gọi nhầm thứ tự hai tham số `int` (kỳ hạn và ân hạn) mà compiler không báo
- [ ] `BigDecimal` không dùng được trong constructor
- [ ] Phải dùng `new`

Đã chạy: `new KhoanVayCu(500_000_000, 6, 24, ...)` với ý định kỳ hạn 24, ân hạn 6 tạo ra "kỳ hạn 6 tháng, ân hạn 24 tháng". Builder với method có tên tránh được lỗi này.
:::
