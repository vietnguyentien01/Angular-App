---
title: "Adapter, Decorator, Proxy, Facade — bốn cách bọc object và điểm khác nhau"
summary: "Bốn structural pattern đều bọc một object khác, nhưng mục đích khác nhau: Adapter đổi interface, Decorator thêm hành vi giữ nguyên interface, Proxy kiểm soát truy cập, Facade gom nhiều hệ thống con sau một method. Một ví dụ đặt hàng chạy được trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, adapter, decorator, proxy, facade, structural]
related: [design-patterns/consolidate/structural/decorator-va-proxy-trong-thuc-te, design-patterns/deep-dive/structural/dynamic-proxy-va-gioi-han-cua-proxy]
---

## TL;DR

- **Adapter**: có sẵn một API **không khớp** interface bạn cần (thư viện cũ, đối tác) → viết lớp chuyển đổi. Interface **thay đổi**.
- **Decorator**: bọc object cùng interface để **thêm hành vi** (log, cache, retry, metric). Interface **giữ nguyên**, có thể bọc nhiều lớp.
- **Proxy**: cũng cùng interface, nhưng mục đích là **kiểm soát truy cập** — khởi tạo lười, phân quyền, transaction, gọi từ xa. Spring dùng proxy cho `@Transactional`, `@Cacheable`, `@Async`.
- **Facade**: một interface **đơn giản** đứng trước nhiều hệ thống con phức tạp.
- Về code, Decorator và Proxy gần như giống hệt nhau — khác ở **ý định**.

## Ví dụ nhanh (đã chạy trên JDK 25)

```java title="Adapter + Decorator"
interface TyGia { BigDecimal layTyGia(String tien); }

class CoreBankingCu {                                     // thư viện cũ, không sửa được
    String getRate(String ccy) { return "<rate ccy='" + ccy + "' value='25.350,00'/>"; }
}

record CoreBankingAdapter(CoreBankingCu cu) implements TyGia {        // Adapter
    public BigDecimal layTyGia(String tien) {
        String so = cu.getRate(tien).replaceAll(".*value='([^']+)'.*", "$1");   // "25.350,00"
        return new BigDecimal(so.replace(".", "").replace(",", "."));
    }
}

record GhiLog(TyGia ben) implements TyGia {                            // Decorator
    public BigDecimal layTyGia(String tien) {
        var v = ben.layTyGia(tien);
        IO.println("[log] tỷ giá " + tien + " = " + v.toPlainString());
        return v;
    }
}
```

```java title="Facade"
record DatHangFacade(KhoHang kho, ThanhToan tt, ThongBao tb, TyGia tyGia) {
    String datHangUsd(String tk, String sp, int sl, BigDecimal giaUsd) {
        if (!kho.giu(sp, sl)) throw new IllegalStateException("hết hàng");
        var vnd = giaUsd.multiply(BigDecimal.valueOf(sl)).multiply(tyGia.layTyGia("USD"))
                        .setScale(0, RoundingMode.HALF_UP);
        var ma = tt.tru(tk, vnd);
        tb.gui(tk, "Đơn " + sp + " đã thanh toán, mã " + ma);
        return ma;
    }
}

TyGia tg = new GhiLog(new CoreBankingAdapter(new CoreBankingCu()));
new DatHangFacade(new KhoHang(), new ThanhToan(), new ThongBao(), tg)
    .datHangUsd("TK-001", "tai nghe", 2, new BigDecimal("19.99"));
```

```text
kho: giữ 2 tai nghe
[log] tỷ giá USD = 25350.00
thanh toán: trừ 1013493 từ TK-001
thông báo TK-001: Đơn tai nghe đã thanh toán, mã GD-001
```

Nghiệp vụ chỉ biết `TyGia`. Ngày core banking đổi sang REST, chỉ thay `CoreBankingAdapter`; ngày cần cache, thêm một decorator — không sửa `DatHangFacade`.

## Bảng chọn nhanh

| Bạn cần | Pattern | Ví dụ trong JDK / framework |
|---|---|---|
| Dùng API có sẵn với interface khác | Adapter | `Arrays.asList`, `InputStreamReader` (byte → ký tự) |
| Thêm hành vi, giữ interface, xếp chồng được | Decorator | `BufferedInputStream`, `Collections.unmodifiableList` |
| Chặn/kiểm soát lời gọi | Proxy | `@Transactional` của Spring, `java.lang.reflect.Proxy` |
| Che độ phức tạp của nhiều thành phần | Facade | `JdbcTemplate` (che `Connection`, `Statement`, `ResultSet`) |
| Cây phần–tổng thể xử lý như nhau | Composite | Menu nhiều cấp, `Container` của Swing |

## Một lỗi hay gặp: Facade thành God class

Facade nên **điều phối**, không chứa quy tắc nghiệp vụ. Khi `DatHangFacade` bắt đầu có tính khuyến mãi, kiểm tra hạn mức, sinh mã giao dịch và định dạng email, nó đã thành một God class (chủ đề Anti-pattern). Mỗi quy tắc nên nằm ở thành phần sở hữu nó; Facade chỉ gọi theo thứ tự.

:::version Java 8 / 16 / 25
Java 16 có `record` — decorator và adapter chỉ còn vài dòng như trên (`record GhiLog(TyGia ben) implements TyGia`). Với interface một method, decorator còn có thể là lambda: `TyGia log = t -> { var v = ben.layTyGia(t); ...; return v; }`. Java 25: không có thay đổi riêng cho các pattern này.
:::

:::interview Decorator và Proxy khác nhau thế nào khi code gần như giống hệt?
Cả hai implement cùng interface và giữ tham chiếu tới object thật. Khác ở **ý định** và **ai quyết định**: Decorator được người dùng chủ động xếp chồng để **thêm tính năng** (log, cache), thường nhiều lớp; Proxy **thay mặt** object thật để kiểm soát truy cập (khởi tạo lười, phân quyền, mở transaction, gọi qua mạng), người dùng thường không biết mình đang cầm proxy — như bean `@Transactional` trong Spring.
:::

:::quiz Đối tác trả tỷ giá dạng chuỗi `<rate value='25.350,00'/>`, ứng dụng cần `BigDecimal layTyGia(String)`. Pattern phù hợp?
- [x] Adapter
- [ ] Decorator
- [ ] Facade
- [ ] Singleton

API có sẵn không khớp interface cần dùng → Adapter chuyển đổi. Decorator giữ nguyên interface.
:::

:::quiz `new BufferedInputStream(new FileInputStream(f))` là ví dụ của pattern nào?
- [ ] Adapter
- [x] Decorator
- [ ] Facade
- [ ] Factory

Cùng kiểu `InputStream`, lớp ngoài thêm bộ đệm. Còn `InputStreamReader` mới là Adapter (đổi từ byte sang ký tự).
:::
