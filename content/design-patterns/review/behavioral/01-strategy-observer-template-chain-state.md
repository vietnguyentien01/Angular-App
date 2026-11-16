---
title: "Strategy, Template Method, Observer, Command, Chain, State — sáu behavioral pattern trong một trang"
summary: "Behavioral pattern quyết định object phối hợp và chia việc thế nào. Nhắc nhanh sáu pattern hay gặp nhất, mỗi cái kèm ví dụ ngắn đã chạy: xuất báo cáo CSV/Markdown bằng Template Method, giỏ hàng hoàn tác bằng Command, phát sự kiện đơn hàng bằng Observer. Đã chạy trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, strategy, observer, template-method, command, state, chain-of-responsibility]
related: [design-patterns/consolidate/behavioral/strategy-va-state-thay-if-else, design-patterns/deep-dive/behavioral/observer-chain-of-responsibility-va-su-kien]
---

## TL;DR

| Pattern | Một câu | Nhận ra khi |
|---|---|---|
| **Strategy** | Thuật toán thay được, chọn lúc chạy | `if (loai == ...)` chọn cách tính |
| **Template Method** | Khung cố định ở lớp cha, các bước do lớp con điền | Nhiều class lặp cùng trình tự, chỉ khác vài bước |
| **Observer** | Một nơi phát sự kiện, nhiều nơi nghe, bên phát không biết bên nghe | "Khi đơn hàng tạo xong thì gửi email, tích điểm, ..." |
| **Command** | Hành động thành object: xếp hàng, ghi lại, hoàn tác | Undo/redo, hàng đợi việc, ghi nhật ký thao tác |
| **Chain of Responsibility** | Chuỗi bộ xử lý, mỗi cái quyết định xử lý hay chuyển tiếp | Filter, interceptor, middleware |
| **State** | Hành vi phụ thuộc trạng thái, chuyển trạng thái có kiểm soát | Nhiều cờ `boolean` mô tả "đang ở bước nào" |

## Ví dụ nhanh (đã chạy trên JDK 25)

```java title="Template Method"
abstract class XuatBaoCao {
    final String xuat(List<long[]> dong) {               // final: khung không đổi được
        var sb = new StringBuilder(dauTrang());
        for (var d : dong) sb.append(dinhDang(d));
        return sb.append(cuoiTrang(dong.size())).toString();
    }
    abstract String dauTrang();
    abstract String dinhDang(long[] d);
    String cuoiTrang(int n) { return ""; }               // hook: tuỳ chọn ghi đè
}
class Csv extends XuatBaoCao { /* "ma,tong\n", "1,500000\n" */ }
class Markdown extends XuatBaoCao { /* bảng | mã | tổng |, ghi đè cuoiTrang → "2 dòng" */ }
```

```text
ma,tong
1,500000
2,1250000
| mã | tổng |
|---|---|
| 1 | 500000 |
| 2 | 1250000 |

2 dòng
```

```java title="Command + hoàn tác"
interface LenhGioHang { void lam(Map<String, Integer> gio); void hoanTac(Map<String, Integer> gio); }
record Them(String sp, int sl) implements LenhGioHang {
    public void lam(Map<String, Integer> g) { g.merge(sp, sl, Integer::sum); }
    public void hoanTac(Map<String, Integer> g) { g.computeIfPresent(sp, (k, v) -> v - sl == 0 ? null : v - sl); }
}
// làm: Them(áo,2), Them(mũ,1), Them(áo,1), mỗi lệnh push vào một ArrayDeque
// giỏ: {mũ=1, áo=3}
// hoàn tác 1 bước: {mũ=1, áo=2}
// hoàn tác 2 bước: {áo=2}
```

```java title="Observer"
List<Consumer<String>> nghe = new ArrayList<>();
nghe.add(ma -> IO.println("  email: đơn " + ma + " đã tạo"));
nghe.add(ma -> IO.println("  tích điểm cho đơn " + ma));
nghe.forEach(n -> n.accept("DH9"));
// email: đơn DH9 đã tạo
// tích điểm cho đơn DH9
```

Strategy và State có ví dụ đầy đủ ở bài *Strategy và State thay if-else*; Chain of Responsibility ở bài *Observer, Chain of Responsibility và sự kiện*.

## Chúng có mặt ở đâu

| Pattern | JDK | Spring / Angular / RxJS |
|---|---|---|
| Strategy | `Comparator`, `RejectedExecutionHandler` | `PasswordEncoder`, `HttpMessageConverter` |
| Template Method | `AbstractList` (bạn viết `get`/`size`) | `JdbcTemplate` (dạng callback), `OncePerRequestFilter` |
| Observer | `Flow.Subscriber`, `PropertyChangeListener` | `ApplicationEventPublisher`, `Observable` của RxJS, signals |
| Command | `Runnable`, `Callable` | `@Scheduled` task, Angular `Router` navigation |
| Chain | `java.util.logging.Handler` | `SecurityFilterChain`, `HttpInterceptorFn` của Angular |
| State | `Thread.State` (chỉ mô tả) | Spring Statemachine, NgRx reducer |

## Một lỗi hay gặp: Template Method không `final`

Nếu `xuat(...)` không `final`, lớp con có thể ghi đè cả khung và bỏ qua bước bắt buộc (vd ghi log kiểm toán, kiểm tra quyền). Đánh dấu method khung là `final`, chỉ để `abstract`/hook cho phần được phép thay đổi. Khi có nhiều chiều biến đổi (định dạng × kênh gửi × ngôn ngữ), Template Method tạo bùng nổ lớp con — chuyển sang Strategy (composition).

:::version Java 8 / 17 / 25
Java 8 làm Strategy, Command, Observer gọn còn một lambda (`Comparator.comparing(...)`, `Runnable`, `Consumer`). Java 9 thêm `java.util.concurrent.Flow` — interface Observer có backpressure. Java 17 `sealed` + Java 21 switch pattern matching cho phép viết State dạng dữ liệu (mỗi trạng thái là một record mang dữ liệu riêng).
:::

:::interview Strategy khác Template Method thế nào?
Cả hai cho phép thay một phần thuật toán. Template Method dùng **kế thừa**: lớp cha giữ khung, lớp con ghi đè bước — cố định lúc biên dịch, mỗi tổ hợp một lớp con. Strategy dùng **composition**: object nhận một strategy qua constructor/tham số, đổi được lúc chạy, kết hợp nhiều strategy độc lập. Ưu tiên Strategy; dùng Template Method khi khung thật sự cố định và muốn **ép** thứ tự các bước (như `OncePerRequestFilter` của Spring).
:::

:::quiz Đơn hàng có các cờ `daThanhToan`, `daGiao`, `daHuy` và nhiều `if` kiểm tra tổ hợp cờ. Pattern phù hợp nhất?
- [ ] Observer
- [ ] Command
- [x] State
- [ ] Facade

Ba cờ boolean cho 8 tổ hợp, nhiều tổ hợp vô nghĩa (vừa giao vừa huỷ). State mô hình hoá một trạng thái duy nhất và các bước chuyển hợp lệ.
:::

:::quiz `SecurityFilterChain` của Spring và `HttpInterceptorFn` của Angular là ví dụ của pattern nào?
- [ ] Template Method
- [x] Chain of Responsibility
- [ ] Strategy
- [ ] Adapter

Mỗi bộ lọc xử lý rồi quyết định có gọi tiếp (`chain.doFilter`, `next(req)`) hay dừng (trả 401).
:::
