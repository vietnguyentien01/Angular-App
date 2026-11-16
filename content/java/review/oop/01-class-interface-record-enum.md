---
title: "Class, interface, record và enum — OOP trong Java hiện đại"
summary: "Nhắc nhanh đóng gói bằng private + constructor kiểm tra dữ liệu, abstract class vs interface (default method), record cho dữ liệu bất biến, enum có field, sealed interface và switch pattern matching. Mọi output đã chạy trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-16
tags: [java, oop, record, enum, sealed]
related: [java/consolidate/oop/equals-hashcode-va-ke-thua, java/deep-dive/oop/sealed-record-pattern-va-mo-hinh-domain]
---

## TL;DR

- **Đóng gói**: field `private`, kiểm tra dữ liệu trong constructor/method, chỉ lộ ra hành vi (`napTien`) chứ không lộ setter tuỳ tiện.
- **interface** = hợp đồng (một class implement nhiều interface, có `default` method). **abstract class** = khung dùng chung có state (một class chỉ `extends` một class).
- **record** = class dữ liệu bất biến: tự có constructor, accessor, `equals`, `hashCode`, `toString`.
- **enum** = tập giá trị cố định, có thể có field và method.
- **sealed interface** + `switch` pattern matching = compiler kiểm tra bạn đã xử lý **đủ mọi trường hợp**.

## Ví dụ nhanh (đã chạy trên JDK 25)

```java title="TaiKhoan.java"
interface CoTen {
    String ten();
    default String chao() { return "Xin chào " + ten(); }
}

abstract class TaiKhoan implements CoTen {
    private final String so;
    protected BigDecimal soDu = BigDecimal.ZERO;

    TaiKhoan(String so) { this.so = Objects.requireNonNull(so); }
    public String ten() { return "TK " + so; }

    void napTien(BigDecimal tien) {
        if (tien.signum() <= 0) throw new IllegalArgumentException("số tiền phải > 0");
        soDu = soDu.add(tien);
    }
    abstract BigDecimal laiThang();      // lớp con bắt buộc cài đặt
}

class TietKiem extends TaiKhoan {
    TietKiem(String so) { super(so); }
    @Override BigDecimal laiThang() { return soDu.multiply(new BigDecimal("0.004")); }
}

class ThanhToan extends TaiKhoan {
    ThanhToan(String so) { super(so); }
    @Override BigDecimal laiThang() { return BigDecimal.ZERO; }
    @Override public String ten() { return "Thanh toán " + super.ten(); }
}
// Nạp 10.000.000 vào mỗi tài khoản rồi in chao() và laiThang():
// Xin chào TK 001 — lãi tháng 40000.000
// Xin chào Thanh toán TK 002 — lãi tháng 0
```

```java title="record và enum"
record KhachHang(String cccd, String hoTen) {
    KhachHang {                                   // compact constructor: kiểm tra + chuẩn hoá
        if (cccd == null || !cccd.matches("\\d{12}"))
            throw new IllegalArgumentException("CCCD phải 12 chữ số");
        hoTen = hoTen.strip();
    }
}
new KhachHang("001203004567", "  Nguyễn An ").equals(new KhachHang("001203004567", "Nguyễn An"));  // true
// toString: KhachHang[cccd=001203004567, hoTen=Nguyễn An]

enum TrangThai {
    CHO_DUYET("Chờ duyệt"), DA_DUYET("Đã duyệt"), TU_CHOI("Từ chối");
    private final String nhan;
    TrangThai(String nhan) { this.nhan = nhan; }
    String nhan() { return nhan; }
    boolean ketThuc() { return this != CHO_DUYET; }
}
TrangThai.valueOf("DA_DUYET").nhan();   // "Đã duyệt"
TrangThai.valueOf("da_duyet");          // IllegalArgumentException: No enum constant … — phân biệt hoa thường
```

```java title="sealed + switch"
sealed interface PhuongThuc permits TheNganHang, ViDienTu, TienMat {}
record TheNganHang(String soThe) implements PhuongThuc {}
record ViDienTu(String nhaCungCap, String sdt) implements PhuongThuc {}
record TienMat() implements PhuongThuc {}

static String moTa(PhuongThuc t) {
    return switch (t) {                      // không cần default: compiler biết đã đủ 3 loại
        case TheNganHang(String soThe) -> "Thẻ ****" + soThe.substring(soThe.length() - 4);
        case ViDienTu v when v.nhaCungCap().equals("MoMo") -> "MoMo " + v.sdt();
        case ViDienTu v -> "Ví " + v.nhaCungCap();
        case TienMat() -> "Tiền mặt";
    };
}
```

## Bảng chọn nhanh

| Cần | Dùng |
|---|---|
| Dữ liệu bất biến (DTO, value object, kết quả trả về) | `record` |
| Tập giá trị cố định (trạng thái, loại) | `enum` (map: `EnumMap`, set: `EnumSet`) |
| Một trong vài dạng, mỗi dạng có dữ liệu riêng | `sealed interface` + các `record` |
| Hợp đồng nhiều class khác nhau cùng thực hiện | `interface` |
| Chia sẻ state và code giữa các lớp con gần nhau | `abstract class` |
| Tái sử dụng hành vi của class khác | **composition** (giữ một field) trước khi nghĩ tới kế thừa |
| Kiểm tra kiểu rồi dùng luôn | `if (o instanceof Integer n && n > 40)` |

## Lỗi hay gặp: record chứa collection mutable

```java bad
record Nhom(String ten, List<String> thanhVien) {}
var ds = new ArrayList<>(List.of("An"));
var n = new Nhom("A", ds);
ds.add("Bình");
n;   // Nhom[ten=A, thanhVien=[An, Bình]] — record "bất biến" nhưng nội dung vẫn đổi
```

```java good
record Nhom(String ten, List<String> thanhVien) {
    Nhom { thanhVien = List.copyOf(thanhVien); }   // sao chép + bất biến
}
// sửa ds sau đó không ảnh hưởng; n.thanhVien().add(…) → UnsupportedOperationException
```

:::version Java 17 / 21 / 25
- `record`: Java 16. `sealed`: Java 17. `instanceof` có biến: Java 16. Dự án Java 17 dùng được ba thứ này.
- `switch` với pattern (`case TheNganHang t`) và record pattern (`case TheNganHang(String soThe)`): **Java 21**. Đã thử `--release 17`: lỗi *patterns in switch statements are not supported*.
:::

:::interview Khi nào dùng abstract class, khi nào dùng interface?
Interface mô tả **khả năng/hợp đồng**: một class có thể implement nhiều interface, interface không giữ state của instance (chỉ có hằng số), `default` method cho phép thêm hành vi mà không phá các class cũ. Abstract class dùng khi các lớp con **thật sự cùng loại** và cần chia sẻ state, constructor, method `protected`; mỗi class chỉ kế thừa một lớp. Trong code hiện đại: interface cho ranh giới (service, repository), record/sealed cho dữ liệu, và composition thay cho cây kế thừa sâu.
:::

:::quiz Class `C implements A, B`, cả `A` và `B` đều có `default String hi()`. Chuyện gì xảy ra?
- [ ] Dùng method của interface viết trước (`A`)
- [x] Lỗi biên dịch — `C` phải tự override `hi()` (có thể gọi `A.super.hi()`)
- [ ] Lỗi lúc chạy
- [ ] Dùng method của `B`

Đã chạy thử: *types A and B are incompatible*. Override `public String hi() { return A.super.hi() + B.super.hi(); }` thì in `AB`.
:::

:::quiz `sealed interface Hinh permits Tron, Vuong`. `switch (h)` chỉ có `case Tron t -> …`. Kết quả?
- [ ] Chạy được, gặp `Vuong` thì trả `null`
- [ ] Chạy được, gặp `Vuong` thì ném `MatchException`
- [x] Lỗi biên dịch: switch chưa phủ hết giá trị
- [ ] Cảnh báo, vẫn biên dịch

Đã chạy thử: *the switch expression does not cover all possible input values*. Đây chính là lợi ích của sealed: thêm loại mới thì compiler chỉ ra mọi chỗ cần sửa.
:::

:::quiz Record khác class thường ở điểm nào? (chọn nhiều)
- [x] Field là `private final`, không có setter
- [x] Tự sinh `equals`, `hashCode`, `toString` theo các thành phần
- [ ] Không có method tự viết
- [ ] Có thể `extends` một class khác

Record có thể có method, static field, compact constructor và implement interface, nhưng không kế thừa class (nó đã ngầm `extends java.lang.Record`).
:::
