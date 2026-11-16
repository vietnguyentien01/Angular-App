---
title: "Strategy và State thay if-else — máy trạng thái đơn hàng và phí ship chọn lúc chạy"
summary: "Ba cờ boolean cho phép đơn hàng vừa giao vừa huỷ. Thay bằng State dùng enum với tập chuyển hợp lệ: chuyển sai bị chặn kèm thông báo rõ, có lịch sử. Phí ship nhiều hãng thành Strategy trong một Map, thêm hãng không sửa code cũ. Đã chạy trên JDK 25."
level: intermediate
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, state, strategy, state-machine, enum, refactoring]
related: [design-patterns/review/behavioral/strategy-observer-template-chain-state, design-patterns/consolidate/principles/tu-code-smell-den-refactor]
---

## TL;DR

- Nhiều cờ `boolean` mô tả tiến trình = **trạng thái không hợp lệ biểu diễn được**. 3 cờ = 8 tổ hợp, chỉ vài tổ hợp có nghĩa.
- **State**: một field trạng thái duy nhất + bảng **chuyển hợp lệ**. Mọi thay đổi đi qua một method (`chuyen`) — chỗ duy nhất kiểm tra, ghi lịch sử, phát sự kiện.
- Với Java, `enum` có method riêng cho từng hằng là cách viết State gọn nhất cho máy trạng thái vừa phải.
- **Strategy**: các cách tính thay thế nhau (phí ship theo hãng) → `Map<String, Strategy>` hoặc bean theo tên. Thêm cách mới = thêm một mục.
- State và Strategy giống nhau về cấu trúc; khác ở **ai đổi**: State tự đổi theo vòng đời object, Strategy do người dùng/cấu hình chọn.

## Cơ chế: vì sao cờ boolean hỏng

```java bad title="DonHangCu"
class DonHangCu {
    boolean daThanhToan, daGiao, daHuy;
    void thanhToan() { daThanhToan = true; }
    void giao() { if (daThanhToan) daGiao = true; }
    void huy() { daHuy = true; }               // quên kiểm tra đã giao
}

cu.thanhToan(); cu.giao(); cu.huy();
// cũ: thanhToán=true giao=true huỷ=true  ← vừa giao vừa huỷ?
```

Mỗi method phải tự nhớ kiểm tra **mọi** cờ liên quan; thêm cờ `daHoanTien` là phải rà lại tất cả. Báo cáo đếm "đơn đã giao" và "đơn đã huỷ" giờ đếm trùng.

## Code tốt: State bằng enum

```java good title="TrangThai.java"
enum TrangThai {
    MOI           { Set<TrangThai> tiepTheo() { return EnumSet.of(DA_THANH_TOAN, DA_HUY); } },
    DA_THANH_TOAN { Set<TrangThai> tiepTheo() { return EnumSet.of(DANG_GIAO, DA_HUY); } },
    DANG_GIAO     { Set<TrangThai> tiepTheo() { return EnumSet.of(DA_GIAO, GIAO_THAT_BAI); } },
    GIAO_THAT_BAI { Set<TrangThai> tiepTheo() { return EnumSet.of(DANG_GIAO, DA_HUY); } },
    DA_GIAO       { Set<TrangThai> tiepTheo() { return EnumSet.noneOf(TrangThai.class); } },
    DA_HUY        { Set<TrangThai> tiepTheo() { return EnumSet.noneOf(TrangThai.class); } };

    abstract Set<TrangThai> tiepTheo();
    boolean coTheChuyen(TrangThai moi) { return tiepTheo().contains(moi); }
}
```

```java good title="DonHang.java"
final class DonHang {
    private final String ma;
    private TrangThai trangThai = TrangThai.MOI;
    private final List<String> lichSu = new ArrayList<>();

    void chuyen(TrangThai moi) {                  // cửa duy nhất để đổi trạng thái
        if (!trangThai.coTheChuyen(moi))
            throw new IllegalStateException(ma + ": không thể chuyển " + trangThai + " → " + moi
                                            + ", cho phép " + trangThai.tiepTheo());
        lichSu.add(trangThai + "→" + moi);
        trangThai = moi;
    }
}
```

```text
mới: DA_GIAO [MOI→DA_THANH_TOAN, DA_THANH_TOAN→DANG_GIAO, DANG_GIAO→DA_GIAO]
DH1: không thể chuyển DA_GIAO → DA_HUY, cho phép []
DH2: không thể chuyển MOI → DANG_GIAO, cho phép [DA_THANH_TOAN, DA_HUY]
```

Thông báo lỗi chứa sẵn "cho phép những gì" — đọc log production là biết ngay luồng nào gọi sai. Bảng chuyển nằm ở một chỗ, đọc như sơ đồ trạng thái; có thể sinh sơ đồ từ chính `enum` này cho tài liệu.

## Strategy: phí ship theo hãng

```java good title="Strategy trong Map"
interface TinhPhiShip { long phi(long tongTien, int canNangGram); }

static final Map<String, TinhPhiShip> HANG_SHIP = Map.of(
    "tiet-kiem", (t, g) -> t >= 500_000 ? 0 : 15_000 + (g / 500) * 3_000,
    "nhanh",     (t, g) -> 30_000 + (g / 500) * 5_000,
    "hoa-toc",   (t, g) -> Math.max(60_000, t / 100));
```

```text
tiet-kiem: đơn 350.000đ/1,2kg → 21000, đơn 8.000.000đ/1,2kg → 0
nhanh: đơn 350.000đ/1,2kg → 40000, đơn 8.000.000đ/1,2kg → 40000
hoa-toc: đơn 350.000đ/1,2kg → 60000, đơn 8.000.000đ/1,2kg → 80000
```

Trong Spring, mỗi strategy là một bean `@Component("nhanh")` implement `TinhPhiShip`; tiêm `Map<String, TinhPhiShip>` thì Spring tự gom mọi bean theo tên. Thêm hãng mới = thêm một class, không sửa class nào.

## Pitfalls

- **Đổi trạng thái bằng setter** (`setTrangThai`) từ khắp nơi: bỏ qua mọi kiểm tra. Chỉ để `chuyen(...)`; JPA cần setter thì để `protected`/package-private.
- **Lưu trạng thái bằng `ordinal()`** trong DB: chèn hằng mới vào giữa enum là dữ liệu cũ đổi nghĩa. Lưu `name()` (`@Enumerated(EnumType.STRING)`).
- **Hai request cùng chuyển trạng thái**: kiểm tra trong bộ nhớ không đủ, cần khoá lạc quan (`@Version`) hoặc `UPDATE ... WHERE trang_thai = 'DANG_GIAO'` (môn Spring Boot, chủ đề Transaction).
- **Strategy không tìm thấy** (`HANG_SHIP.get("grab")` trả `null`) → NPE ở xa. Kiểm tra khi lấy, báo lỗi có tên hãng.
- **Máy trạng thái rất phức tạp** (song song, trạng thái lồng, hẹn giờ): enum không đủ — cân nhắc workflow engine, nhưng chỉ khi thật cần.

:::senior Góc nhìn senior
Trạng thái là **dữ liệu nghiệp vụ quan trọng nhất** của nhiều hệ thống (đơn hàng, hồ sơ vay, yêu cầu bồi thường). Thiết kế tốt gồm: bảng chuyển rõ ràng (code + sơ đồ), một cửa duy nhất để chuyển, lịch sử chuyển lưu DB (ai, lúc nào, từ đâu sang đâu, lý do), sự kiện phát ra sau mỗi lần chuyển, và khoá đồng thời. Lịch sử này là thứ bộ phận kiểm toán và chăm sóc khách hàng sẽ hỏi đầu tiên.
:::

:::version Java 8 / 17 / 21 / 25
Enum có method riêng cho từng hằng có từ Java 5. Khi mỗi trạng thái mang **dữ liệu riêng** (DA_HUY có `lyDo`, DANG_GIAO có `maVanDon`), dùng `sealed interface TrangThai permits Moi, DangGiao, DaHuy` với các `record` (Java 17) và `switch` pattern matching (Java 21) — compiler kiểm tra bạn đã xử lý đủ trạng thái. Xem bài *Visitor và sealed pattern matching*.
:::

:::interview Bạn thiết kế trạng thái của hồ sơ vay thế nào để tránh trạng thái sai?
Một field trạng thái (enum hoặc sealed interface), không dùng nhiều cờ boolean. Bảng chuyển hợp lệ khai báo ở một chỗ; đổi trạng thái chỉ qua một method kiểm tra chuyển hợp lệ, ghi lịch sử, phát sự kiện. Trong DB lưu tên trạng thái (không lưu ordinal), có `@Version` hoặc điều kiện trạng thái trong câu `UPDATE` để chặn hai người duyệt cùng lúc. Test: mỗi chuyển hợp lệ và một vài chuyển không hợp lệ quan trọng.
:::

:::quiz Đơn `DA_GIAO` và khách gọi API huỷ đơn. Với thiết kế enum ở trên, chuyện gì xảy ra?
- [ ] Đơn chuyển sang `DA_HUY`
- [x] `IllegalStateException`: không thể chuyển DA_GIAO → DA_HUY, cho phép []
- [ ] Không có gì xảy ra
- [ ] Đơn chuyển sang `GIAO_THAT_BAI`

Đã chạy: `DA_GIAO` không có bước chuyển nào. Muốn trả hàng sau giao, thêm trạng thái mới (`YEU_CAU_TRA_HANG`) chứ không cho huỷ.
:::

:::quiz Vì sao không nên lưu trạng thái đơn hàng bằng `ordinal()` xuống DB?
- [ ] `ordinal()` chậm
- [x] Chèn hoặc đổi thứ tự hằng enum làm giá trị cũ trong DB đổi nghĩa
- [ ] `ordinal()` không phải số nguyên
- [ ] DB không lưu được số

Thêm `CHO_XAC_NHAN` vào giữa `MOI` và `DA_THANH_TOAN` là mọi đơn "đã thanh toán" cũ thành "chờ xác nhận". Lưu `name()`.
:::

:::exercise Thêm trả hàng
Nghiệp vụ: sau `DA_GIAO`, khách được yêu cầu trả hàng trong 7 ngày → `YEU_CAU_TRA_HANG`; kho duyệt → `DA_TRA_HANG` hoặc từ chối → quay về `DA_GIAO`. Sửa enum, và chỉ ra điều kiện "trong 7 ngày" nên đặt ở đâu.
???
```java
enum TrangThai {
    MOI               { Set<TrangThai> tiepTheo() { return EnumSet.of(DA_THANH_TOAN, DA_HUY); } },
    DA_THANH_TOAN     { Set<TrangThai> tiepTheo() { return EnumSet.of(DANG_GIAO, DA_HUY); } },
    DANG_GIAO         { Set<TrangThai> tiepTheo() { return EnumSet.of(DA_GIAO, GIAO_THAT_BAI); } },
    GIAO_THAT_BAI     { Set<TrangThai> tiepTheo() { return EnumSet.of(DANG_GIAO, DA_HUY); } },
    DA_GIAO           { Set<TrangThai> tiepTheo() { return EnumSet.of(YEU_CAU_TRA_HANG); } },
    YEU_CAU_TRA_HANG  { Set<TrangThai> tiepTheo() { return EnumSet.of(DA_TRA_HANG, DA_GIAO); } },
    DA_TRA_HANG       { Set<TrangThai> tiepTheo() { return EnumSet.noneOf(TrangThai.class); } },
    DA_HUY            { Set<TrangThai> tiepTheo() { return EnumSet.noneOf(TrangThai.class); } };
    ...
}
```

Đã chạy: `MOI → DA_THANH_TOAN → DANG_GIAO → DA_GIAO → YEU_CAU_TRA_HANG → DA_GIAO` hợp lệ; `DA_GIAO → DA_HUY` vẫn bị chặn với "cho phép [YEU_CAU_TRA_HANG]".

Điều kiện "trong 7 ngày" phụ thuộc **dữ liệu của đơn** (ngày giao) và thời gian hiện tại, không phải chỉ cặp trạng thái — nên đặt trong method nghiệp vụ của `DonHang`, ví dụ `yeuCauTraHang(Clock dongHo)`: kiểm tra `ngayGiao.plusDays(7)` so với `LocalDate.now(dongHo)`, rồi gọi `chuyen(YEU_CAU_TRA_HANG)`. Bảng trong enum trả lời "có được chuyển không về mặt quy trình", method nghiệp vụ trả lời "đơn này có đủ điều kiện không".
:::
