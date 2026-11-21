---
title: "Pattern với Java hiện đại — lambda thay Strategy/Command, record thay Value Object, sealed thay Visitor"
summary: "Nhiều pattern GoF ra đời để bù cho Java 1.x thiếu hàm bậc cao và kiểu dữ liệu đại số. Trên Java 25: Strategy, Command, Factory còn một lambda hay method reference; Decorator là andThen; Value Object là record; Visitor là sealed + switch. Ví dụ đã chạy trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-19
tags: [design-patterns, java-25, lambda, record, sealed, functional]
related: [design-patterns/consolidate/modern-java/visitor-va-sealed-pattern-matching, design-patterns/deep-dive/modern-java/lambda-ben-trong-jvm]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

| Pattern cổ điển | Trên Java 25 | Ghi chú |
|---|---|---|
| Strategy | lambda / method reference (`Comparator.comparing(...)`) | Vẫn đặt tên interface khi strategy có nghĩa nghiệp vụ |
| Command | `Runnable`, `Callable`, `Consumer<T>` | Cần hoàn tác → vẫn cần interface riêng |
| Factory | `Supplier<T>`, `ArrayList::new` | |
| Decorator (hàm) | `Function.andThen`, `compose` | Cho hàm thuần; decorator có state vẫn là class |
| Value Object | `record` + compact constructor | `equals`/`hashCode`/`toString` có sẵn |
| Visitor | `sealed interface` + `switch` pattern matching | Compiler kiểm tra đủ trường hợp |
| Template Method | Truyền hàm vào (callback) | Như `JdbcTemplate.query(sql, rowMapper)` |

Pattern không biến mất — **ý tưởng** vẫn vậy, chỉ là cú pháp đã gọn tới mức không cần class riêng.

## Ví dụ nhanh (đã chạy trên JDK 25)

```java title="Strategy và Decorator bằng hàm"
Comparator<KhachHang> theoThuNhap = Comparator.comparingLong(KhachHang::thuNhap).reversed()
                                              .thenComparing(KhachHang::ten);
ds.sort(theoThuNhap);                     // [Chi, An, Bình]

UnaryOperator<String> chuanHoa = String::strip;
Function<String, String> xuLy = chuanHoa.andThen(s -> s.replaceAll("\\s+", " ")).andThen(String::toUpperCase);
xuLy.apply("  nguyễn   văn  an ");        // [NGUYỄN VĂN AN]
```

```java title="Value Object bằng record"
record Tien(BigDecimal soTien, Currency tienTe) {
    Tien {
        Objects.requireNonNull(tienTe);
        soTien = soTien.setScale(tienTe.getDefaultFractionDigits(), RoundingMode.HALF_UP);   // VND: 0 chữ số lẻ
    }
    static Tien vnd(long so) { return new Tien(BigDecimal.valueOf(so), Currency.getInstance("VND")); }
    Tien cong(Tien khac) {
        if (!tienTe.equals(khac.tienTe)) throw new IllegalArgumentException("khác loại tiền: " + tienTe + " + " + khac.tienTe);
        return new Tien(soTien.add(khac.soTien), tienTe);
    }
}

Tien.vnd(150_000).cong(Tien.vnd(50_000));     // Tien[soTien=200000, tienTe=VND]
Tien.vnd(100).equals(new Tien(new BigDecimal("100.4"), Currency.getInstance("VND")));   // true (đã làm tròn)
Tien.vnd(1).cong(new Tien(BigDecimal.ONE, Currency.getInstance("USD")));   // khác loại tiền: VND + USD
```

```java title="Factory và Command"
Supplier<List<String>> taoDs = ArrayList::new;
Deque<Runnable> hangDoi = new ArrayDeque<>();
hangDoi.add(() -> IO.println("gửi email DH1"));
hangDoi.add(() -> IO.println("cập nhật kho DH1"));
while (!hangDoi.isEmpty()) hangDoi.poll().run();
```

```java title="Visitor → sealed + switch"
sealed interface SanPham permits TienGui, Vay, The {}
record TienGui(long soDu, int laiSuatBp) implements SanPham {}
record Vay(long duNo, int laiSuatBp) implements SanPham {}
record The(long duNo, long hanMuc) implements SanPham {}

static long laiThang(SanPham sp) {
    return switch (sp) {                                  // không cần default
        case TienGui(long soDu, int ls) -> soDu * ls / 10_000 / 12;
        case Vay(long duNo, int ls) -> -(duNo * ls / 10_000 / 12);
        case The(long duNo, long hm) when duNo == 0 -> 0;
        case The(long duNo, long hm) -> -(duNo * 2_800 / 10_000 / 12);
    };
}
```

## Bảng chọn nhanh: lambda hay interface có tên?

| Dùng lambda khi | Dùng interface/class có tên khi |
|---|---|
| Logic 1–3 dòng, dùng tại chỗ | Strategy là khái niệm nghiệp vụ (`BieuPhi`, `ChinhSachDuyetVay`) |
| Interface chuẩn đủ nghĩa (`Comparator`, `Predicate`) | Cần nhiều method (vd `lam` + `hoanTac`) |
| Không cần test riêng | Cần test riêng, cần inject qua DI, cần log tên |

## Một lỗi hay gặp: `Function<A, B>` ở khắp nơi

`Function<DonHang, Long>` không nói gì về ý nghĩa: tính phí? tính thuế? điểm thưởng? Chữ ký method `tinh(Function<DonHang, Long> f)` buộc người đọc lần theo nơi gọi. Khi hàm là **khái niệm** của domain, khai báo interface riêng: `interface BieuPhi { long tinh(GiaoDich gd); }` — vẫn viết được bằng lambda, nhưng có tên, có tài liệu, IDE tìm được mọi cài đặt.

:::version Java 8 / 16 / 17 / 21 / 25
Java 8: lambda, method reference, `java.util.function`. Java 16: `record`. Java 17: `sealed`. Java 21: record pattern và switch pattern matching chính thức. Java 22: biến không dùng `_` (JEP 456) — `case The(long duNo, _) ->`. Java 25: compact source file và `void main()` (JEP 512), `IO.println`.
:::

:::interview Design pattern có còn cần thiết khi Java đã có lambda, record, sealed?
Cần, vì pattern là **ý tưởng** giải quyết vấn đề thiết kế: tách thuật toán thay đổi được (Strategy), bọc thêm hành vi (Decorator), xử lý một tập kiểu đóng (Visitor). Java hiện đại chỉ làm phần **cài đặt** ngắn đi: Strategy còn một lambda, Visitor thành sealed + switch có kiểm tra đủ trường hợp. Biết tên pattern vẫn giúp trao đổi trong đội ("chỗ này dùng decorator cho cache") và nhận ra nó trong framework.
:::

:::quiz Cách nào thay Visitor tốt nhất trên Java 21+ khi tập loại sản phẩm cố định do bạn kiểm soát?
- [ ] `instanceof` trong chuỗi `if-else`
- [x] `sealed interface` + `switch` pattern matching không có `default`
- [ ] `Map<Class<?>, Function<...>>`
- [ ] Reflection

Compiler biết đủ các lớp con của sealed interface, nên báo lỗi khi thiếu `case`. Chuỗi `instanceof` và `Map` không được kiểm tra như vậy.
:::

:::quiz Với record `Tien` dưới đây, `Tien.vnd(100).equals(new Tien(new BigDecimal("100.4"), Currency.getInstance("VND")))` cho kết quả gì?
```java
record Tien(BigDecimal soTien, Currency tienTe) {
    Tien {
        Objects.requireNonNull(tienTe);
        soTien = soTien.setScale(tienTe.getDefaultFractionDigits(), RoundingMode.HALF_UP);   // VND: 0 chữ số lẻ
    }
    static Tien vnd(long so) { return new Tien(BigDecimal.valueOf(so), Currency.getInstance("VND")); }
}
```

- [ ] `false` vì 100 khác 100.4
- [x] `true` vì compact constructor làm tròn về 0 chữ số lẻ cho VND trước khi lưu
- [ ] Ném exception
- [ ] Lỗi biên dịch

Đã chạy: `true`. Compact constructor được phép gán lại tham số (`soTien = ...`) trước khi field được ghi.
:::
