---
title: "Decorator thực chiến — xếp chồng thử lại, cache, đo đếm, dự phòng và vì sao thứ tự quan trọng"
summary: "Bọc client tỷ giá của đối tác bằng các decorator thử lại, cache có hạn, đo đếm và dự phòng. Đo được: không bọc lỗi 4/100, thêm thử lại hết lỗi nhưng gọi đối tác 104 lần, thêm cache còn 8 lần; đặt bộ đếm trong hay ngoài thử lại cho ra hai con số khác nhau. Đã chạy trên JDK 25."
level: intermediate
version: 25
lastReviewed: 2026-11-19
tags: [design-patterns, decorator, proxy, retry, cache, resilience]
related: [design-patterns/review/structural/adapter-decorator-proxy-facade, design-patterns/deep-dive/structural/dynamic-proxy-va-gioi-han-cua-proxy]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

- Decorator cho phép thêm **mối quan tâm xuyên suốt** (cross-cutting concern: retry, cache, metric, log, fallback) mà không sửa class gọi đối tác và không sửa nghiệp vụ.
- Mỗi decorator làm **một việc**, cùng implement một interface, xếp chồng như búp bê Nga.
- **Thứ tự bọc quyết định hành vi**: bộ đếm đặt trong thử lại đếm *mỗi lần gọi đối tác*; đặt ngoài đếm *kết quả người dùng thấy*. Cache đặt ngoài thử lại thì một lần cache hit bỏ qua cả chuỗi.
- Spring làm đúng việc này bằng proxy (`@Retryable`, `@Cacheable`, `@Transactional`) — hiểu decorator tay giúp bạn đoán được thứ tự proxy của Spring.

## Cơ chế: một interface, nhiều lớp vỏ

```java title="Interface và cài đặt thật"
interface TyGia { BigDecimal layTyGia(String tien); }

class TyGiaDoiTac implements TyGia {     // gọi API đối tác; giả lập: mỗi mã lỗi 503 hai lần đầu
    public BigDecimal layTyGia(String tien) { ... }
}
```

```java good title="Các decorator"
record ThuLai(TyGia ben, int soLan) implements TyGia {
    public BigDecimal layTyGia(String tien) {
        for (int i = 1; ; i++) {
            try { return ben.layTyGia(tien); }
            catch (IllegalStateException e) { if (i == soLan) throw e; }    // chỉ thử lại lỗi tạm thời
        }
    }
}

final class CoCache implements TyGia {
    private record Muc(BigDecimal giaTri, Instant luc) {}
    private final Map<String, Muc> cache = new ConcurrentHashMap<>();
    // ben, song (Duration), dongHo (Clock) nhận qua constructor
    public BigDecimal layTyGia(String tien) {
        var m = cache.get(tien);
        if (m != null && m.luc().plus(song).isAfter(dongHo.instant())) return m.giaTri();
        var v = ben.layTyGia(tien);
        cache.put(tien, new Muc(v, dongHo.instant()));
        return v;
    }
}

final class DoDem implements TyGia {
    final AtomicInteger thanhCong = new AtomicInteger(), thatBai = new AtomicInteger();
    public BigDecimal layTyGia(String tien) {
        try { var v = ben.layTyGia(tien); thanhCong.incrementAndGet(); return v; }
        catch (RuntimeException e) { thatBai.incrementAndGet(); throw e; }
    }
}
```

Lắp ráp ở **một chỗ** (một `@Bean` trong Spring, hoặc factory):

```java
TyGia tyGia = new CoCache(new ThuLai(new TyGiaDoiTac(), 3), Duration.ofMinutes(5), Clock.systemUTC());
```

## Demo: 100 lần hỏi tỷ giá USD/EUR xen kẽ, sau lần 50 đồng hồ nhảy 6 phút

```text
không bọc: gọi đối tác 100 lần, lỗi trả cho người dùng 4/100
thử lại 3 lần: gọi đối tác 104 lần, lỗi trả cho người dùng 0/100
cache 5 phút + thử lại: gọi đối tác 8 lần, lỗi trả cho người dùng 0/100
```

- Thử lại xoá được lỗi tạm thời, nhưng **tăng tải** lên đối tác (104 lần).
- Cache 5 phút: mỗi mã gọi đối tác 1 lần thành công + 2 lần lỗi được thử lại = 3, hai mã = 6; sau 6 phút cache hết hạn, gọi lại mỗi mã 1 lần = **8**.

## Thứ tự: đo ở đâu?

```java
new ThuLai(new DoDem(doiTac), 3)    // bộ đếm BÊN TRONG thử lại; gửi 4 yêu cầu USD
new DoDem(new ThuLai(doiTac, 3))    // bộ đếm BÊN NGOÀI thử lại; gửi 4 yêu cầu USD
```

```text
đo bên trong thử lại: thành công=4, thất bại=2
đo bên ngoài thử lại: thành công=4, thất bại=0
```

Cả hai đều đúng, nhưng trả lời hai câu hỏi khác nhau: bên trong = "đối tác có khoẻ không" (tỷ lệ lỗi thật 2/6); bên ngoài = "người dùng có bị lỗi không" (0/4). Dashboard thường cần **cả hai**. Nhầm vị trí là bạn sẽ không bao giờ thấy đối tác đang lỗi 33% cho tới khi thử lại không cứu nổi nữa.

## Pitfalls

- **Thử lại mọi exception**: lỗi `400`/`IllegalArgumentException` ("không hỗ trợ VND") thử lại bao nhiêu lần cũng lỗi, chỉ tốn thời gian. Chỉ thử lại lỗi tạm thời (timeout, 503).
- **Thử lại thao tác không idempotent** (trừ tiền, gửi SMS) mà không có khoá idempotency → trừ hai lần.
- **Cache không hết hạn** hoặc không giới hạn số khoá: rò rỉ bộ nhớ và dữ liệu cũ. Dùng thư viện (Caffeine) cho cache thật.
- **Thời gian lấy từ `Instant.now()`** bên trong decorator: không test được hết hạn. Nhận `Clock` qua constructor như `CoCache`.
- **Lắp ráp rải rác**: mỗi nơi tự `new ThuLai(new CoCache(...))` theo thứ tự khác nhau. Lắp ở một factory/bean duy nhất.

:::senior Góc nhìn senior
Khi ứng dụng dùng Spring, đừng tự viết lại `ThuLai` hay `CoCache` — dùng `@Retryable` (Spring Framework 7), `@Cacheable` với Caffeine, Micrometer cho đo đếm. Nhưng cần biết chúng là proxy xếp chồng và **thứ tự** của chúng được quyết định bởi `order` của từng advisor; khi kết quả lạ (cache lưu cả lỗi, retry không chạy), hãy vẽ ra chuỗi decorator như bài này để tìm ra lớp nào bọc lớp nào.
:::

:::version Java 8 / 16 / 25
Trước Java 16, mỗi decorator là một class có field, constructor, method — 15–20 dòng. Từ Java 16, decorator không có state riêng (như `ThuLai`) là một `record` vài dòng. Decorator có state (`CoCache`, `DoDem`) vẫn nên là class `final` để kiểm soát field. Java 25 không thay đổi gì riêng cho pattern này.
:::

:::interview Bạn đặt metric "số lỗi khi gọi đối tác" ở đâu trong chuỗi retry và cache?
Tuỳ câu hỏi metric trả lời. Đặt **trong** retry (sát client thật) để đo sức khoẻ đối tác — mỗi lần thử là một mẫu. Đặt **ngoài** retry để đo trải nghiệm người dùng. Đặt ngoài cache thì cache hit cũng được đếm (tốt cho đo tỷ lệ hit). Thường cần ít nhất hai điểm đo. Đã thử: cùng 4 yêu cầu, đo bên trong thấy 2 lỗi, đo bên ngoài thấy 0.
:::

:::quiz Client tỷ giá được bọc bằng hai decorator cùng interface `TyGia`: `CoCache` (cache kết quả 5 phút) ở ngoài, `ThuLai` (thử lại tối đa 3 lần khi lỗi) ở trong. Một yêu cầu có cache hit thì gọi đối tác bao nhiêu lần?
```java
TyGia tyGia = new CoCache(new ThuLai(doiTac, 3), Duration.ofMinutes(5), clock);
```

- [x] 0
- [ ] 1
- [ ] 3
- [ ] Tuỳ đối tác có lỗi không

`CoCache` ở ngoài cùng trả kết quả trước khi tới `ThuLai`.
:::

:::quiz Đối tác thỉnh thoảng trả 503. Bạn bọc client bằng decorator thử lại tối đa 3 lần, và bộ đếm lỗi đặt **ngoài** decorator thử lại: `new DoDem(new ThuLai(doiTac, 3))`. Dashboard báo 0% lỗi. Rủi ro là gì?
- [ ] Không có rủi ro
- [x] Không thấy tỷ lệ lỗi thật của đối tác đang tăng, cho tới khi vượt quá khả năng thử lại
- [ ] Thử lại làm sai tỷ giá
- [ ] Cache không hoạt động

Đã đo: cùng một luồng, bộ đếm bên trong thử lại thấy 2 thất bại, bộ đếm bên ngoài thấy 0.
:::

:::exercise Decorator dự phòng
Khi đối tác sập hẳn (mọi lần thử đều 503), nghiệp vụ chấp nhận dùng **tỷ giá thành công gần nhất** thay vì báo lỗi, kèm log cảnh báo. Viết decorator `DuPhong` và cho biết nên đặt nó trong hay ngoài `ThuLai`.
???
```java
final class DuPhong implements TyGia {
    private final TyGia ben;
    private final Map<String, BigDecimal> ganNhat = new ConcurrentHashMap<>();
    DuPhong(TyGia ben) { this.ben = ben; }

    public BigDecimal layTyGia(String tien) {
        try {
            var v = ben.layTyGia(tien);
            ganNhat.put(tien, v);
            return v;
        } catch (IllegalStateException e) {            // chỉ lỗi tạm thời của đối tác
            var cu = ganNhat.get(tien);
            if (cu == null) throw e;                    // chưa từng có giá trị: không bịa
            log.warn("dùng tỷ giá gần nhất {} = {}", tien, cu);
            return cu;
        }
    }
}

TyGia tg = new DuPhong(new ThuLai(doiTac, 3));          // NGOÀI thử lại
```

Đặt **ngoài** `ThuLai`: chỉ dùng dự phòng khi đã thử lại hết mà vẫn lỗi. Đặt trong thì lần lỗi đầu tiên đã trả giá trị cũ, thử lại không bao giờ chạy.

Đã chạy: lần 1 trả `25350`; cho đối tác sập hẳn, lần 2 in `[dự phòng] dùng tỷ giá gần nhất USD = 25350` và trả `25350` sau 3 lần thử (tổng 4 lần gọi đối tác); `EUR` chưa từng thành công nên vẫn ném `503 từ đối tác`. Trong thực tế cần thêm giới hạn "gần nhất trong bao lâu" — tỷ giá cũ 3 ngày không nên dùng cho giao dịch.
:::
