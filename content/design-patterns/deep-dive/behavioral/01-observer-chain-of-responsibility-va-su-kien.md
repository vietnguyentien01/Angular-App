---
title: "Observer và Chain of Responsibility bên trong — listener lỗi, đăng ký lúc đang phát, listener chậm, filter quên gọi tiếp"
summary: "Tự viết event bus và filter chain để thấy các lỗi thật: một listener ném exception làm người đặt hàng nhận lỗi và listener sau không chạy, đăng ký trong lúc phát gây ConcurrentModificationException, listener chậm 800 ms làm chậm người phát, filter quên gọi tiếp trả null. Đã chạy trên JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, observer, chain-of-responsibility, events, filter, concurrency]
related: [design-patterns/review/behavioral/strategy-observer-template-chain-state, design-patterns/deep-dive/frameworks/flow-va-backpressure-tu-observer-toi-rxjs]
---

## Tóm tắt nhanh

- Observer **đồng bộ** (cách mặc định của `ApplicationEventPublisher`, `EventEmitter` của Node, vòng `for` qua listener) chạy listener **trên thread của người phát**: exception, độ chậm và transaction của listener đều "lây" sang người phát.
- Bus an toàn tối thiểu: bắt lỗi **từng** listener, danh sách listener là `CopyOnWriteArrayList`, và quyết định rõ việc nào chạy đồng bộ, việc nào chạy nền.
- Việc phụ (email, tích điểm) không được làm hỏng việc chính (đặt hàng). Việc phải đảm bảo xảy ra sau khi commit → **outbox** (chủ đề Kiến trúc), không phải listener trong bộ nhớ.
- Chain of Responsibility: **thứ tự** bộ lọc là một phần của logic (xác thực trước hay sau rate limit), và bộ lọc quên gọi `tiep` làm request dừng lặng lẽ.

## Cơ chế: phát sự kiện đồng bộ

```java bad title="BusDonGian"
class BusDonGian {
    final List<Consumer<DonHangDaTao>> nguoiNghe = new ArrayList<>();
    void dangKy(Consumer<DonHangDaTao> c) { nguoiNghe.add(c); }
    void phat(DonHangDaTao e) { for (var c : nguoiNghe) c.accept(e); }
}
```

```text
caller (đặt hàng) ──► phat() ──► email ──► SMS ──► tích điểm ──► trả về caller
                     cùng một thread, cùng call stack, cùng transaction (nếu có)
```

### Lỗi 1: một listener lỗi, cả luồng lỗi

Đăng ký ba listener: email, SMS (ném `IllegalStateException("SMS gateway timeout")`), tích điểm.

```text
1) [email DH1, người đặt hàng nhận lỗi: SMS gateway timeout]
```

Tích điểm không chạy, và **người đặt hàng nhận lỗi** dù đơn đã tạo. Nếu `phat` nằm trong `@Transactional`, exception còn làm **rollback** cả đơn hàng — vì cổng SMS chậm.

### Lỗi 2: đăng ký listener trong lúc đang phát

```java
bus2.dangKy(e -> bus2.dangKy(x -> {}));   // listener đăng ký thêm listener khác (vd khởi tạo lười)
bus2.phat(...);
// 2) ArrayList: java.util.ConcurrentModificationException
```

Vòng `for` trên `ArrayList` không chịu được thay đổi danh sách giữa chừng. Trong ứng dụng thật, chuyện này xảy ra khi listener khởi tạo một module mà module đó tự đăng ký listener.

### Bản an toàn hơn

```java good title="BusAnToan"
class BusAnToan {
    final List<Consumer<DonHangDaTao>> nguoiNghe = new CopyOnWriteArrayList<>();
    List<String> phat(DonHangDaTao e) {
        var loi = new ArrayList<String>();
        for (var c : nguoiNghe) {
            try { c.accept(e); } catch (RuntimeException ex) { loi.add(ex.getMessage()); }   // cô lập từng listener
        }
        return loi;
    }
}
```

```text
3) [email DH3, tích điểm DH3], lỗi: [SMS gateway timeout], số listener sau khi phát: 5
```

`CopyOnWriteArrayList` duyệt trên **bản chụp** tại lúc bắt đầu vòng lặp: listener mới thêm không chạy ở lần phát này, nhưng không làm vỡ vòng lặp. Đổi lại, mỗi lần `add` sao chép cả mảng — hợp với danh sách ít thay đổi, đọc nhiều.

### Lỗi 3: listener chậm làm chậm người phát

```text
4) phát xong sau 800 ms
```

Một listener `sleep(800)` (giả lập gọi API) → API đặt hàng chậm thêm 800 ms. Cách xử lý: việc không cần kết quả ngay thì chạy nền (executor riêng, virtual thread) — nhưng khi đó bạn mất đảm bảo: process tắt giữa chừng là sự kiện mất. Việc **phải** xảy ra (gửi hoá đơn, đồng bộ sang kế toán) cần được ghi vào DB cùng transaction (outbox) rồi xử lý sau.

## Chain of Responsibility: thứ tự và "quên gọi tiếp"

```java title="Filter chain tối giản"
interface BoLoc { String xuLy(YeuCau yc, Chuoi tiep); }
interface Chuoi { String tiep(YeuCau yc); }

static Chuoi xayChuoi(List<BoLoc> boLoc, Chuoi cuoi) {
    Chuoi c = cuoi;
    for (int i = boLoc.size() - 1; i >= 0; i--) {          // bọc từ trong ra ngoài
        var b = boLoc.get(i); var sau = c;
        c = yc -> b.xuLy(yc, sau);
    }
    return c;
}

BoLoc GHI_LOG = (yc, t) -> { VET.add("log " + yc.duongDan()); var kq = t.tiep(yc); VET.add("log xong: " + kq); return kq; };
BoLoc XAC_THUC = (yc, t) -> yc.token() == null ? "401" : t.tiep(yc);
BoLoc GIOI_HAN = (yc, t) -> { VET.add("đếm rate limit"); return t.tiep(yc); };
BoLoc QUEN_GOI_TIEP = (yc, t) -> { VET.add("kiểm tra IP"); return null; };
```

```text
[GHI_LOG, XAC_THUC, GIOI_HAN], có token:  200 /don-hang [log /don-hang, đếm rate limit, log xong: 200 /don-hang]
[GHI_LOG, XAC_THUC, GIOI_HAN], không token: 401 [log /don-hang, log xong: 401]
[GIOI_HAN, XAC_THUC, GHI_LOG], không token: 401 [đếm rate limit]
[GHI_LOG, QUEN_GOI_TIEP, XAC_THUC], có token: null [log /don-hang, kiểm tra IP, log xong: null]
```

- Đặt rate limit **sau** xác thực: request không token không bị đếm — kẻ tấn công spam request không token không bao giờ chạm giới hạn. Đặt **trước**: mọi request bị đếm (thường là điều bạn muốn cho chống brute-force), nhưng log không ghi được request bị từ chối nếu `GHI_LOG` nằm sau.
- Bộ lọc không gọi `tiep` và cũng không trả lỗi → controller không chạy, client nhận phản hồi rỗng (`null`; trong servlet là `200` với body trống). Đây là lỗi kinh điển khi viết `Filter` của Servlet mà quên `chain.doFilter(request, response)` ở một nhánh `if`.

## So sánh phương án phát sự kiện

| Cách | Lỗi listener ảnh hưởng người phát | Mất sự kiện khi process chết | Thứ tự | Dùng cho |
|---|---|---|---|---|
| Đồng bộ, cùng transaction | Có (rollback) | Không (chưa commit thì cũng chưa có gì) | Theo thứ tự đăng ký | Cập nhật bắt buộc nhất quán với dữ liệu chính |
| Đồng bộ, sau commit (`@TransactionalEventListener(AFTER_COMMIT)`) | Không rollback, nhưng vẫn chậm người gọi | **Có** | Theo thứ tự | Việc phụ, chấp nhận mất hiếm hoi |
| Bất đồng bộ trong bộ nhớ (`@Async`, executor) | Không | **Có** | Không đảm bảo | Việc phụ, không quan trọng |
| Outbox + message broker | Không | Không | Theo khoá (partition) | Việc bắt buộc phải xảy ra, giữa các service |

## Tính năng mới theo phiên bản

- **Java 9**: `java.util.concurrent.Flow` — chuẩn Observer có backpressure (bài *Flow và backpressure*); `java.util.Observable` bị đánh dấu deprecated.
- **Java 21**: virtual thread — chạy mỗi listener nền trên một virtual thread rất rẻ, nhưng vẫn không giải quyết chuyện mất sự kiện.
- **Spring Framework**: `@TransactionalEventListener` cho phép chọn pha (`BEFORE_COMMIT`, `AFTER_COMMIT`, `AFTER_ROLLBACK`).

:::senior Góc nhìn senior
Observer làm code **lỏng** nhưng cũng làm luồng **khó nhìn**: đọc `datHang()` bạn không thấy nó kéo theo email, SMS, tích điểm và đồng bộ kế toán. Trước khi dùng sự kiện, trả lời: listener lỗi thì sao, chậm thì sao, process chết giữa chừng thì sao, chạy hai lần thì sao. Nếu câu trả lời là "không được phép mất", sự kiện trong bộ nhớ không phải công cụ đúng.
:::

:::quiz Trong `@Transactional datHang()`, bạn phát sự kiện đồng bộ và listener SMS ném exception. Hậu quả với cách phát đồng bộ ngây thơ?
- [ ] Chỉ SMS không gửi, đơn vẫn lưu
- [x] Exception đi ngược lên `datHang`, transaction rollback, đơn không được lưu
- [ ] Spring tự thử lại listener
- [ ] Listener chạy trên thread khác nên không ảnh hưởng

Listener đồng bộ chạy trong cùng call stack và cùng transaction. Đã tái hiện: người đặt hàng nhận "SMS gateway timeout".
:::

:::exercise Sắp xếp filter chain
Ứng dụng có các filter: ghi log truy cập, CORS, xác thực JWT, rate limit theo IP, rate limit theo người dùng, đo thời gian. Đề xuất thứ tự và giải thích.
???
Một thứ tự hợp lý:

1. **Đo thời gian** — ngoài cùng, để đo cả thời gian của các filter khác.
2. **Ghi log truy cập** — ghi được cả request bị chặn ở các bước sau (401, 429).
3. **CORS** — preflight `OPTIONS` không mang token; phải trả lời trước khi xác thực, nếu không trình duyệt nhận 401 và chặn mọi request.
4. **Rate limit theo IP** — trước xác thực, để chặn spam/brute-force không cần token (và không tốn CPU kiểm chữ ký JWT).
5. **Xác thực JWT** — từ đây biết người dùng là ai.
6. **Rate limit theo người dùng** — cần danh tính từ bước 5.
7. Controller.

Kiểm chứng bằng test cho từng tình huống: preflight không token → 200 có header CORS; quá giới hạn IP không token → 429 (không phải 401); token sai → 401 có trong log truy cập. Trong Spring Security, thứ tự filter được khai báo trong `SecurityFilterChain` (`addFilterBefore/After`), và bộ lọc CORS đã có sẵn vị trí trước xác thực.
:::
