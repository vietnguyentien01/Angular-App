---
title: "Từ code smell đến refactor an toàn — viết test đặc tả trước, đổi cấu trúc sau"
summary: "Hàm tính phí chuyển khoản dài với if-else lồng nhau được refactor thành bảng biểu phí và Strategy. Trước khi sửa, viết test đặc tả so sánh code cũ và mới trên 126 tổ hợp đầu vào; một lỗi lệch biên cố ý bị bắt ngay. Đã chạy trên JDK 25."
level: intermediate
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, refactoring, code-smell, strategy, testing]
related: [design-patterns/review/principles/solid-va-composition, design-patterns/consolidate/behavioral/strategy-va-state-thay-if-else]
---

## Tóm tắt nhanh

- **Code smell** là dấu hiệu thiết kế có vấn đề, chưa phải bug: hàm dài, if-else theo "loại", tham số kiểu `String` mang nghĩa enum, sửa một tính năng phải đụng nhiều file.
- **Refactor** = đổi cấu trúc, **giữ nguyên hành vi**. Không có test chứng minh "giữ nguyên" thì đó là viết lại, không phải refactor.
- Với code cũ chưa có test: viết **characterization test** (test đặc tả) — ghi lại hành vi *hiện tại*, kể cả chỗ có vẻ sai, rồi so sánh code mới với code cũ trên nhiều tổ hợp đầu vào.
- Refactor từng bước nhỏ, chạy test sau mỗi bước. Sửa bug là một commit **riêng**.

## Cơ chế: vì sao if-else theo loại là smell

```java bad title="phiCu — code đang chạy production"
static long phiCu(String loai, String hang, long soTien, boolean cuoiTuan) {
    long phi = 0;
    if (loai.equals("NOI_BO")) {
        phi = 0;
    } else if (loai.equals("LIEN_NGAN_HANG")) {
        if (soTien < 500_000) phi = 0;
        else if (soTien < 2_000_000) phi = 2_200;
        else phi = 3_300;
        if (hang.equals("VIP")) phi = 0;
        else if (hang.equals("VANG")) phi = phi / 2;
    } else if (loai.equals("QUOC_TE")) {
        phi = Math.max(50_000, soTien * 3 / 1000);
        if (hang.equals("VIP")) phi = phi * 7 / 10;
        if (cuoiTuan) phi += 10_000;
    } else {
        throw new IllegalArgumentException("loại? " + loai);
    }
    return phi;
}
```

Các smell:

| Smell | Hậu quả |
|---|---|
| Một hàm chứa quy tắc của mọi loại giao dịch | Sửa phí quốc tế có thể làm hỏng phí liên ngân hàng; review khó |
| `String loai`, `String hang` | Gõ sai `"VANG "` chỉ lộ ra lúc chạy |
| Thêm loại mới = sửa hàm này (và thường cả 3–4 hàm `switch` khác theo loại) | Vi phạm Open/Closed |
| Biến `phi` bị ghi đè nhiều lần | Phải đọc từ trên xuống mới biết giá trị cuối |

## Bước 1: lưới an toàn trước khi sửa

Giữ nguyên `phiCu`, viết code mới song song, rồi so sánh trên **mọi tổ hợp** đầu vào quan trọng — đặc biệt các **giá trị biên** (499.999, 500.000, 1.999.999, 2.000.000):

```java title="So sánh cũ và mới"
String[] loai = {"NOI_BO", "LIEN_NGAN_HANG", "QUOC_TE"};
long[] tien = {0, 499_999, 500_000, 1_999_999, 2_000_000, 10_000_000, 100_000_000};
int soCa = 0, khac = 0;
for (var l : loai) for (var h : Hang.values()) for (var t : tien) for (var ct : new boolean[]{false, true}) {
    soCa++;
    long a = phiCu(l, h.name(), t, ct), b = phiMoi(new GiaoDich(l, h, t, ct));
    if (a != b) { khac++; IO.println("KHÁC: " + l + " " + h + " " + t + " " + ct + " cũ=" + a + " mới=" + b); }
}
IO.println(soCa + " trường hợp, " + khac + " khác biệt");
```

Trong dự án thật, đây là một test JUnit (`@ParameterizedTest` với `@MethodSource` sinh tổ hợp). Khi refactor xong và đã chạy ổn định, xoá `phiCu` và chuyển các ca biên thành test bình thường với giá trị mong đợi viết cứng.

## Bước 2: code mới

```java good title="Biểu phí theo loại"
enum Hang { THUONG, VANG, VIP }
record GiaoDich(String loai, Hang hang, long soTien, boolean cuoiTuan) {}

interface BieuPhi { long tinh(GiaoDich gd); }

static final BieuPhi NOI_BO = gd -> 0;

static final BieuPhi LIEN_NGAN_HANG = gd -> {
    long goc = gd.soTien() < 500_000 ? 0 : gd.soTien() < 2_000_000 ? 2_200 : 3_300;
    return switch (gd.hang()) {
        case VIP -> 0;
        case VANG -> goc / 2;
        case THUONG -> goc;
    };
};

static final BieuPhi QUOC_TE = gd -> {
    long phi = Math.max(50_000, gd.soTien() * 3 / 1000);
    if (gd.hang() == Hang.VIP) phi = phi * 7 / 10;
    return gd.cuoiTuan() ? phi + 10_000 : phi;
};

static final Map<String, BieuPhi> BIEU_PHI = Map.of(
    "NOI_BO", NOI_BO, "LIEN_NGAN_HANG", LIEN_NGAN_HANG, "QUOC_TE", QUOC_TE);

static long phiMoi(GiaoDich gd) {
    var bp = BIEU_PHI.get(gd.loai());
    if (bp == null) throw new IllegalArgumentException("loại? " + gd.loai());
    return bp.tinh(gd);
}
```

`hang` đã thành `enum`: `switch` trên enum không cần `default`, và nếu thêm hạng `KIM_CUONG` thì compiler báo lỗi *the switch expression does not cover all possible input values* ở đúng chỗ cần sửa.

## Demo: lưới an toàn bắt lỗi thật

```text
126 trường hợp, 0 khác biệt
```

Giờ cố ý gõ nhầm `<` thành `<=` ở mốc 500.000 — lỗi rất dễ lọt khi chép quy tắc:

```text
KHÁC: LIEN_NGAN_HANG THUONG 500000 false cũ=2200 mới=0
KHÁC: LIEN_NGAN_HANG THUONG 500000 true cũ=2200 mới=0
KHÁC: LIEN_NGAN_HANG VANG 500000 false cũ=1100 mới=0
KHÁC: LIEN_NGAN_HANG VANG 500000 true cũ=1100 mới=0
126 trường hợp, 4 khác biệt
```

Nếu chỉ test vài giá trị "đẹp" (100.000, 1.000.000), lỗi này đi thẳng lên production và ngân hàng mất 2.200 đ trên mỗi giao dịch đúng 500.000 đ.

## Pitfalls

- **Vừa refactor vừa "sửa luôn" quy tắc trông sai.** Ví dụ hạng VIP chuyển quốc tế cuối tuần bị cộng 10.000 sau khi giảm 30% — có thể là cố ý. Ghi lại, hỏi nghiệp vụ, sửa ở commit riêng.
- **Refactor một lần cả module.** Review không nổi, revert mất cả tuần công. Mỗi bước nhỏ nên giữ được test xanh và merge được.
- **Tách quá nhỏ.** Mười class một dòng cho ba loại phí là over-engineering (chủ đề Anti-pattern). Ba lambda trong một `Map` là đủ ở đây.
- **Tin vào code coverage.** 100% coverage với giá trị không chạm biên vẫn bỏ sót lỗi `<=`.

:::senior Góc nhìn senior
Refactor là việc **liên tục**, không phải một dự án riêng xin sprint. Quy tắc "để lại code sạch hơn lúc bạn đến": mỗi lần sửa tính năng trong vùng code xấu, dọn một chút trong phạm vi đó, có test đi kèm. Với vùng code quan trọng mà không ai dám đụng (tính phí, tính lãi), đầu tư test đặc tả trước tiên — nó vừa là lưới an toàn, vừa là tài liệu sống về quy tắc nghiệp vụ hiện tại.
:::

:::version Java 8 / 17 / 21 / 25
Java 8: lambda giúp Strategy gọn như trên. Java 14: switch expression (`case X -> ...`). Java 16: `record` cho `GiaoDich`. Java 21: switch pattern matching trên sealed interface — nếu các loại giao dịch mang dữ liệu khác nhau, thay `Map<String, BieuPhi>` bằng `sealed interface GiaoDich` (chủ đề Pattern với Java hiện đại).
:::

:::interview Refactor khác viết lại thế nào? Làm sao refactor code cũ không có test?
Refactor đổi cấu trúc mà **không đổi hành vi quan sát được**, theo từng bước nhỏ có test xanh sau mỗi bước. Viết lại là thay cả khối, hành vi có thể khác. Với code cũ không có test: viết characterization test ghi lại hành vi hiện tại (kể cả phần có vẻ sai), tập trung vào giá trị biên và tổ hợp đầu vào; giữ code cũ song song để so sánh tự động; refactor; xoá code cũ khi đã ổn định; sửa bug ở commit riêng sau khi hỏi nghiệp vụ.
:::

:::quiz Bạn đang refactor `phiCu` và thấy khách VIP chuyển quốc tế cuối tuần bị cộng 10.000 đ *sau* khi giảm 30%, có vẻ sai. Nên làm gì?
- [ ] Sửa luôn trong commit refactor cho gọn
- [x] Giữ nguyên hành vi trong refactor, ghi lại và hỏi nghiệp vụ, nếu cần sửa thì làm ở commit riêng có test
- [ ] Xoá điều kiện cuối tuần
- [ ] Bỏ qua, không cần ghi lại

Trộn sửa hành vi vào refactor làm test đặc tả mất ý nghĩa và khiến review không phân biệt được thay đổi nào là cố ý.
:::

:::quiz Bộ test chỉ dùng số tiền 100.000 và 1.000.000. Lỗi nào có khả năng lọt nhất?
- [ ] Sai tên biến
- [x] Lệch biên `<` thành `<=` ở mốc 500.000 hoặc 2.000.000
- [ ] Thiếu loại `NOI_BO`
- [ ] Ném exception với loại không hợp lệ

Đã chạy: lỗi `<=` chỉ lộ ở đúng giá trị 500.000 — 4/126 trường hợp khác.
:::

:::exercise Thêm loại giao dịch NAPAS_247
Nghiệp vụ thêm loại `NAPAS_247`: phí cố định 1.100 đ; hạng VIP miễn phí; số tiền từ 50.000.000 đ trở lên bị từ chối (ném `IllegalArgumentException`). Thêm vào code mới mà **không sửa** `NOI_BO`, `LIEN_NGAN_HANG`, `QUOC_TE`, và viết các ca biên cần test.
???
```java
static final BieuPhi NAPAS_247 = gd -> {
    if (gd.soTien() >= 50_000_000) throw new IllegalArgumentException("vượt hạn mức 247: " + gd.soTien());
    return gd.hang() == Hang.VIP ? 0 : 1_100;
};

static final Map<String, BieuPhi> BIEU_PHI = Map.of(
    "NOI_BO", NOI_BO, "LIEN_NGAN_HANG", LIEN_NGAN_HANG, "QUOC_TE", QUOC_TE, "NAPAS_247", NAPAS_247);
```

Đã chạy: `THUONG 49.999.999 → 1100`, `VIP 1.000 → 0`, `THUONG 50.000.000 → IllegalArgumentException: vượt hạn mức 247: 50000000`.

Ca biên cần test: 49.999.999 (được), 50.000.000 (bị từ chối), mỗi hạng một ca, số tiền 0. Chỉ có **thêm** code (một lambda và một dòng trong map) — đó là Open/Closed. Loại mới không có trong `phiCu`, nên vòng so sánh cũ/mới không áp dụng cho nó: viết test với giá trị mong đợi cứng.
:::
