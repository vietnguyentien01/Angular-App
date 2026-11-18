---
title: "Viết test với JUnit và AssertJ — test tham số, giá trị biên, Clock và fake"
summary: "Luyện viết test cho code nghiệp vụ: cấu trúc Arrange–Act–Assert, test tham số với @CsvSource cho giá trị biên, kiểm tra exception kèm cause, so sánh BigDecimal đúng cách, tiêm Clock và viết fake thay cho mock. Các test trong bài đã chạy bằng Maven trên JDK 21."
level: intermediate
version: 21
lastReviewed: 2026-11-18
tags: [java, junit, assertj, testing, parameterized-test]
related: [java/review/build-test/maven-va-junit-co-ban, java/consolidate/exceptions/xu-ly-loi-va-thoi-gian-dung-cach]
changelog:
  - date: 2026-11-18
    note: "Chuyển mốc của khóa sang Java 21 LTS: chạy lại các test trong bài bằng Maven trên JDK 21 (release 21)."
---

## Tóm tắt nhanh

- Mỗi test kiểm tra **một hành vi**, theo khung **Arrange – Act – Assert**, tên test nói rõ hành vi đó.
- Quy tắc có nhiều bộ số (phí, lãi, làm tròn) → **`@ParameterizedTest` + `@CsvSource`**, tập trung vào **giá trị biên**: ngay dưới, đúng bằng, ngay trên ngưỡng.
- `BigDecimal`: dùng `isEqualByComparingTo` (AssertJ) hoặc `compareTo`, **không** dùng `assertEquals` (so cả scale).
- Code đọc "bây giờ" → nhận `Clock`. Code gọi DB/API → nhận interface, trong test truyền **fake** viết tay.
- Test exception: kiểm tra cả **loại**, **thông điệp** và **cause**.

## Cơ chế: JUnit chạy test thế nào

Với mỗi method `@Test`, JUnit (mặc định) tạo **một instance mới** của class test, chạy `@BeforeEach`, chạy test, rồi `@AfterEach`. Vì vậy field trong class test không bị dùng lại giữa các test — field `static` thì có (bài chuyên sâu có số đo). Thứ tự giữa các test **không** theo thứ tự khai báo và không nên phụ thuộc vào nó.

Mọi test dưới đây nằm trong dự án Maven mẫu `so-chi-tieu`, đã chạy với `mvn test` trên JDK 21 (`maven.compiler.release` = 21). Riêng các test in trong bài (`PhiTest`, `ChiaHoaDonTest`, `HanMucServiceTest`) cho *Tests run: 16, Failures: 0*.

## So sánh BigDecimal

```java bad
assertEquals(new BigDecimal("2.0"), new BigDecimal("2.00"));
// AssertionFailedError: expected: <2.0> but was: <2.00>
```

```java good
assertThat(new BigDecimal("2.0")).isEqualByComparingTo("2.00");     // xanh
assertEquals(0, ketQua.compareTo(mongDoi), "…");                      // nếu không dùng AssertJ
```

## Test tham số với giá trị biên

Quy tắc phí liên ngân hàng (từ bài *Sealed, record pattern*): 0,02% (Napas 0,03%), tối thiểu 2.000 đ, tối đa 50.000 đ.

```java title="PhiTest.java"
@ParameterizedTest(name = "{0} đ, Napas={1} → phí {2}")
@CsvSource({
    "5000000,     false, 2000",    // 1.000 < tối thiểu
    "10000000,    false, 2000",    // đúng bằng tối thiểu
    "10000001,    false, 2000",    // 2.000,0002 → làm tròn 2.000
    "20000000,    false, 4000",
    "20000000,    true,  6000",
    "250000000,   false, 50000",   // đúng bằng tối đa
    "500000000,   true,  50000"    // vượt tối đa
})
void lienNganHang(BigDecimal tien, boolean napas, BigDecimal phi) {
    assertThat(Phi.phi(new Phi.LienNganHang(tien, napas))).isEqualByComparingTo(phi);
}
```

JUnit tự chuyển chuỗi trong CSV sang `BigDecimal`, `boolean`, `int`, enum, `LocalDate`… Mỗi dòng là một test riêng trong báo cáo, nên khi fail bạn biết ngay bộ số nào sai.

Kiểm tra **bất biến** (invariant) thay vì chỉ kiểm tra từng kết quả:

```java title="ChiaHoaDonTest.java"
@ParameterizedTest(name = "{0} đ cho {1} người")
@CsvSource({"100000, 3", "100001, 4", "0, 5", "7, 10", "999999999, 7"})
void tongLuonBangBanDau(BigDecimal tong, int soNguoi) {
    List<BigDecimal> kq = ChiaHoaDon.chiaDeu(tong, soNguoi);
    BigDecimal sum = kq.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    assertEquals(0, sum.compareTo(tong), "tổng các phần phải bằng tổng ban đầu");
    assertThat(kq).hasSize(soNguoi);
    BigDecimal max = kq.stream().max(BigDecimal::compareTo).orElseThrow();
    BigDecimal min = kq.stream().min(BigDecimal::compareTo).orElseThrow();
    assertThat(max.subtract(min)).isLessThanOrEqualTo(BigDecimal.ONE);   // chia "đều": lệch tối đa 1 đồng
}
```

## Clock và fake

```java title="HanMucService.java"
public class HanMucService {
    public interface LichSuChiTieu { BigDecimal tongTrongThang(String nguoiDung, YearMonth thang); }

    private final LichSuChiTieu lichSu;
    private final Clock clock;
    private final BigDecimal hanMucThang;
    // constructor nhận cả ba

    public BigDecimal conLai(String nguoiDung) {
        YearMonth thang = YearMonth.from(LocalDate.now(clock));
        return hanMucThang.subtract(lichSu.tongTrongThang(nguoiDung, thang)).max(BigDecimal.ZERO);
    }
}
```

```java title="HanMucServiceTest.java"
static class LichSuGia implements HanMucService.LichSuChiTieu {     // fake: 6 dòng, không cần thư viện
    final Map<YearMonth, BigDecimal> theoThang = new HashMap<>();
    YearMonth thangDuocHoi;
    @Override public BigDecimal tongTrongThang(String nguoiDung, YearMonth thang) {
        thangDuocHoi = thang;
        return theoThang.getOrDefault(thang, BigDecimal.ZERO);
    }
}

@Test
void khongTraVeSoAm() {
    // Arrange
    lichSu.theoThang.put(YearMonth.of(2026, 11), new BigDecimal("7000000"));
    var service = taoService("2026-11-16T03:00:00Z");      // hạn mức 5.000.000
    // Act
    BigDecimal conLai = service.conLai("an");
    // Assert
    assertThat(conLai).isEqualByComparingTo("0");
}

@Test
void thangTinhTheoGioVietNam() {
    // 30/11 lúc 17:30 UTC = 01/12 lúc 00:30 giờ VN → phải hỏi tháng 12
    taoService("2026-11-30T17:30:00Z").conLai("an");
    assertThat(lichSu.thangDuocHoi).isEqualTo(YearMonth.of(2026, 12));
}
```

Fake viết tay dễ đọc hơn mock khi interface nhỏ, và test không bị gắn vào việc "gọi method nào bao nhiêu lần". Dùng Mockito khi interface lớn, hoặc khi cần kiểm tra tương tác (đã gửi email đúng một lần).

## Code bad / good

```java bad
@Test
void test1() {                                  // tên vô nghĩa
    var kq = ChiaHoaDon.chiaDeu(new BigDecimal("100000"), 3);
    System.out.println(kq);                     // "kiểm tra" bằng mắt
    assertTrue(kq.size() == 3);                 // fail chỉ báo "expected true"
}
```

```java good
@Test
@DisplayName("100.000 cho 3 người: người đầu nhận phần dư")
void chiaCoDu() {
    assertThat(ChiaHoaDon.chiaDeu(new BigDecimal("100000"), 3))
        .containsExactly(new BigDecimal("33334"), new BigDecimal("33333"), new BigDecimal("33333"));
}
```

## Pitfalls

- `try { goi(); fail(); } catch (Exception e) { }` — bắt cả `AssertionError` của chính `fail()` nếu viết sai. Dùng `assertThrows`/`assertThatThrownBy`.
- Test phụ thuộc giờ thật, múi giờ máy, `Random` không seed, hay thứ tự chạy → test chập chờn (bài chuyên sâu).
- Đặt class test sai tên (`KiemTra…`) → Surefire bỏ qua.
- Chỉ test "đường thẳng" (dữ liệu đẹp). Lỗi nằm ở biên: 0, âm, rỗng, `null`, đúng bằng ngưỡng, cuối tháng, năm nhuận.
- Test lặp lại logic của code (tính `tien * 0.0002` trong test để so). Ghi **con số mong đợi** cụ thể.

:::senior Góc nhìn senior
Test tốt là **tài liệu sống** cho quy tắc nghiệp vụ: một bảng `@CsvSource` cho phí chuyển khoản dễ cho BA/QA đọc và đối chiếu với tài liệu hơn bất kỳ comment nào. Thiết kế code để dễ test ngay từ đầu — nhận `Clock`, interface cho I/O, hàm thuần cho tính toán — thay vì đợi viết test rồi mới phát hiện phải mock `LocalDate.now()` hay static method.
:::

:::version Java 17 / 21 / 25
JUnit 6 cần Java 17+. Trên dự án Java 8/11, mọi annotation trong bài có cùng tên ở JUnit 5.x. Tên hiển thị của test tham số trong JUnit 6 đặt giá trị trong dấu ngoặc kép. Đã chạy cùng một test `@ParameterizedTest(name = "ten {0} so {1}")` với `@CsvSource({"abc, 3"})`: JUnit 5.14.4 hiện `ten abc so 3`, JUnit 6.1.3 hiện `ten "abc" so "3"`.
:::

:::interview Mock và fake khác nhau thế nào? Khi nào dùng cái nào?
Fake là một cài đặt thật nhưng đơn giản của interface (vd repository dùng `HashMap` thay cho DB): test kiểm tra **trạng thái/kết quả**. Mock (Mockito) là object được lập trình sẵn câu trả lời và có thể **xác minh tương tác** (`verify(mailer).send(...)`). Fake bền hơn khi refactor vì không gắn với cách gọi bên trong; mock tiện khi interface lớn hoặc cần kiểm tra một lời gọi có xảy ra. Tránh mock những thứ mình không sở hữu một cách chi tiết (vd mock `HttpClient`) — bọc chúng sau interface của mình.
:::

:::quiz `assertEquals(new BigDecimal("2.0"), new BigDecimal("2.00"))` cho kết quả gì?
- [ ] Xanh
- [x] Fail: `expected: <2.0> but was: <2.00>`
- [ ] Lỗi biên dịch
- [ ] Xanh nhưng có cảnh báo

`assertEquals` dùng `equals`, mà `BigDecimal.equals` so cả scale. Đã chạy thử.
:::

:::quiz Chọn các bộ số **giá trị biên** đáng test nhất cho quy tắc "phí tối thiểu 2.000 đ, 0,02% số tiền" (chọn nhiều)
- [x] Số tiền làm phí đúng bằng 2.000 đ (10.000.000 đ)
- [x] Số tiền ngay trên ngưỡng (10.000.001 đ)
- [ ] Ba số tiền ngẫu nhiên lớn hơn 50.000.000 đ
- [x] Số tiền nhỏ hơn hẳn ngưỡng (5.000.000 đ)

Lỗi `>` thay cho `>=` hay làm tròn sai chỉ lộ ra ở quanh ngưỡng. Thêm biên của mức tối đa (250.000.000 đ).
:::

:::exercise Test cho hàm tính tuổi
Viết test tham số cho `Tuoi.tinhTuoi(String ngaySinh, Clock clock)` (bài *Xử lý lỗi và thời gian*): các trường hợp đúng (đúng ngày sinh nhật, ngày mai mới sinh nhật, năm nhuận, sinh hôm nay), các chuỗi không hợp lệ (kiểm tra cả cause), ngày ở tương lai, và trường hợp lúc 00:30 giờ VN nhưng UTC vẫn là hôm trước.
???
```java
class TuoiTest {
    static final Clock NGAY_16_11_2026 =
        Clock.fixed(Instant.parse("2026-11-16T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    @ParameterizedTest(name = "sinh {0} → {1} tuổi")
    @CsvSource({
        "20/05/1990, 36",
        "16/11/2008, 18",     // đúng sinh nhật
        "17/11/2008, 17",     // sinh nhật ngày mai
        "29/02/2008, 18",     // năm nhuận
        "16/11/2026, 0"
    })
    void tinhDung(String ngaySinh, int tuoi) {
        assertThat(Tuoi.tinhTuoi(ngaySinh, NGAY_16_11_2026)).isEqualTo(tuoi);
    }

    @ParameterizedTest
    @ValueSource(strings = {"30/02/2000", "2000-01-01", "", "31/13/2000"})
    void tuChoiNgayKhongHopLe(String ngaySinh) {
        assertThatThrownBy(() -> Tuoi.tinhTuoi(ngaySinh, NGAY_16_11_2026))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageStartingWith("Ngày sinh không hợp lệ")
            .hasCauseInstanceOf(DateTimeParseException.class);
    }

    @Test
    void tuChoiNgayTuongLai() {
        assertThatThrownBy(() -> Tuoi.tinhTuoi("17/11/2026", NGAY_16_11_2026)).hasMessageContaining("tương lai");
    }

    @Test
    void ngayTinhTheoGioVietNam() {
        Clock luc0030GioVn = Clock.fixed(Instant.parse("2026-11-15T17:30:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        assertThat(Tuoi.tinhTuoi("16/11/2008", luc0030GioVn)).isEqualTo(18);
    }
}
```

Đã chạy: 11 test xanh. Chuỗi rỗng `""` cũng ném `DateTimeParseException` nên được bọc đúng cách.
:::
