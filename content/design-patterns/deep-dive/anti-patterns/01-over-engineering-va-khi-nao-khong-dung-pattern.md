---
title: "Over-engineering và khi nào không dùng pattern — chi phí của mỗi lớp trừu tượng"
summary: "Cùng một quy tắc phí ship viết hai cách: hàm 4 dòng, và 9 kiểu gồm strategy, factory, template method, decorator. Kết quả giống hệt, nhưng stack trace từ 1 thành 4 tầng code của bạn. Khi nào abstraction đáng giá: rule of three, điểm hay thay đổi, ranh giới hệ thống. Đã chạy trên JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, over-engineering, yagni, kiss, abstraction, code-review]
related: [design-patterns/review/anti-patterns/anti-pattern-thuong-gap, design-patterns/consolidate/principles/tu-code-smell-den-refactor]
---

## TL;DR

- Mỗi lớp trừu tượng (interface, factory, decorator) có **chi phí**: thêm file, thêm bước khi đọc, thêm tầng khi debug, thêm thứ phải giữ đồng bộ. Nó chỉ đáng khi trả lại nhiều hơn.
- **YAGNI** (You Aren't Gonna Need It): không thêm điểm mở rộng cho yêu cầu chưa có. **Rule of three**: lần thứ ba gặp cùng một dạng mới trừu tượng hoá.
- Abstraction đáng giá ở **điểm hay thay đổi** (biểu phí, đối tác), **ranh giới hệ thống** (DB, HTTP, message), và nơi cần **thay khi test**.
- Interface chỉ có một cài đặt và không cần thay khi test thường là thừa — Java/IDE cho phép tách interface sau vài giây khi thật sự cần.
- Pattern là **từ vựng** để trao đổi, không phải danh sách phải dùng cho đủ.

## Cơ chế: cùng một quy tắc, hai cách viết

Quy tắc: đơn từ 500.000 đ miễn phí ship, còn lại 15.000 đ; số tiền âm là lỗi.

```java good title="4 dòng"
static long phiDonGian(long tien) {
    if (tien < 0) throw new IllegalArgumentException("số tiền âm");
    return tien >= 500_000 ? 0 : 15_000;
}
```

```java bad title="9 kiểu"
interface ChienLuocPhi { long tinh(long tien); }
interface NhaMayChienLuoc { ChienLuocPhi tao(String loai); }
interface BoKiemTra { void kiem(long tien); }
abstract class ChienLuocCoSo implements ChienLuocPhi {            // template method
    public final long tinh(long tien) { kiem.kiem(tien); return tinhThat(tien); }
    protected abstract long tinhThat(long tien);
}
final class ChienLuocMienPhiTu500 extends ChienLuocCoSo { ... }
final class BoKiemTraSoAm implements BoKiemTra { ... }
final class NhaMayMacDinh implements NhaMayChienLuoc { ... }       // factory luôn trả một loại
record ChienLuocCoLog(ChienLuocPhi ben) implements ChienLuocPhi { ... }   // decorator không làm gì
final class DichVuPhi { long phi(long tien) { return new ChienLuocCoLog(nm.tao("mac-dinh")).tinh(tien); } }
```

```text
kết quả giống nhau: true true
```

Stack trace khi truyền số âm (phần code của bạn):

```text
đơn giản:
  at X3.phiDonGian(X3.java:6)

"enterprise":
  at X3$BoKiemTraSoAm.kiem(X3.java:25)
  at X3$ChienLuocCoSo.tinh(X3.java:17)
  at X3$ChienLuocCoLog.tinh(X3.java:30)
  at X3$DichVuPhi.phi(X3.java:33)
```

Một tầng so với bốn tầng — và đây mới là code thuần, chưa có proxy của Spring chen vào giữa mỗi tầng. Người mới vào đội phải mở 9 kiểu để trả lời "phí ship tính thế nào?". Không yêu cầu nào hiện tại cần `NhaMayChienLuoc` (chỉ có một loại) hay `ChienLuocCoLog` (không ghi log gì).

## Khi nào abstraction đáng giá

| Tín hiệu | Ví dụ | Làm gì |
|---|---|---|
| Đã có ≥ 3 biến thể thật | 3 hãng vận chuyển với công thức khác nhau | Strategy (bài *Strategy và State*) |
| Ranh giới với hệ thống ngoài | DB, CIC, cổng thanh toán | Port + adapter |
| Cần thay khi test, không thay được bằng cách khác | Đồng hồ (`Clock`), sinh mã ngẫu nhiên | Tiêm interface/`Clock` |
| Quy tắc đổi thường xuyên theo nghiệp vụ | Biểu phí theo quý | Dữ liệu/cấu hình, hoặc Strategy |
| "Có thể sau này cần" | Hỗ trợ nhiều DB "phòng khi" | **Chưa làm** |
| Chỉ một cài đặt, không bao giờ mock | `DinhDangTien` | Class thường, không interface |

Chi phí bỏ lỡ một abstraction thường **thấp**: IDE tách interface, đổi `new` thành tham số constructor trong vài phút, có test bảo vệ. Chi phí abstraction sai thì **cao**: mọi người phải tuân theo một khung không khớp với yêu cầu thật đến sau, và gỡ nó ra khó hơn thêm vào.

## So sánh: hai kiểu sai

| | Under-engineering | Over-engineering |
|---|---|---|
| Biểu hiện | Copy-paste, if-else theo loại ở 5 chỗ, God class | Interface một cài đặt, factory của factory, 6 tầng cho CRUD |
| Hậu quả | Sửa một quy tắc phải sửa nhiều chỗ, dễ sót | Đọc chậm, debug sâu, khung cứng không khớp yêu cầu mới |
| Cách sửa | Gom lại, trích hàm, Strategy khi đủ biến thể | Inline: gộp các tầng không mang thông tin |
| Phát hiện khi review | "Chỗ này đã thấy ở đâu rồi" | "Tại sao cần class này?" mà không ai trả lời được |

## Tính năng mới theo phiên bản

Java hiện đại làm giảm nhu cầu "abstraction phòng xa": record thay class dữ liệu + builder; lambda thay interface + class cho strategy nhỏ; sealed + switch thay visitor; `var` bớt kiểu dài dòng. Java 25 với compact source file (`void main()`) còn cho phép viết một script kiểm chứng ý tưởng trước khi dựng cả khung. Viết đơn giản trước rồi tách sau giờ rẻ hơn bao giờ hết.

:::senior Góc nhìn senior
Trong code review, hỏi với mỗi abstraction mới: (1) hiện có bao nhiêu cài đặt **thật**? (2) yêu cầu nào **hiện tại** cần nó? (3) nếu bỏ đi, code xấu đi ở đâu? Nếu câu trả lời là "1", "chưa có" và "không đâu" — đề nghị inline. Ngược lại, khi thấy cùng một khối `if` lần thứ ba, đề nghị gom lại. Kiến trúc tốt không phải kiến trúc có nhiều pattern nhất, mà là kiến trúc **dễ thay đổi theo đúng hướng nghiệp vụ hay thay đổi**.
:::

:::quiz Đội đề xuất interface `TinhThue` với một cài đặt `TinhThueVat`, kèm `TinhThueFactory`. Hiện chỉ có thuế VAT 8%/10%, không có kế hoạch thêm loại thuế. Phản hồi hợp lý nhất?
- [ ] Đồng ý, vì Open/Closed
- [x] Dùng một class (hoặc hàm) `tinhVat` có test; tách interface khi có loại thuế thứ hai
- [ ] Thêm cả Abstract Factory cho chắc
- [ ] Dùng Service Locator

YAGNI: một cài đặt, không cần thay khi test. Tách interface sau là việc vài phút khi yêu cầu thật xuất hiện.
:::

:::exercise Inline một lớp trừu tượng thừa
Từ bản "9 kiểu" ở trên, hãy rút gọn còn tối thiểu mà vẫn giữ được: (a) test được quy tắc phí, (b) sẵn sàng thêm hãng vận chuyển thứ hai khi nghiệp vụ yêu cầu. Bạn giữ lại gì, bỏ gì?
???
Bỏ `NhaMayChienLuoc`/`NhaMayMacDinh` (factory luôn trả một loại), `ChienLuocCoLog` (decorator không làm gì), `BoKiemTra`/`BoKiemTraSoAm` và `ChienLuocCoSo` (template method chỉ để gọi một kiểm tra). Còn lại:

```java
final class PhiShip {
    long tinh(long tien) {
        if (tien < 0) throw new IllegalArgumentException("số tiền âm");
        return tien >= 500_000 ? 0 : 15_000;
    }
}
```

(a) Test trực tiếp `new PhiShip().tinh(499_999)`, `tinh(500_000)`, `tinh(-1)`. (b) Khi có hãng thứ hai, lúc đó mới tách `interface TinhPhiShip { long phi(long tongTien, int canNangGram); }` và đưa các cài đặt vào `Map<String, TinhPhiShip>` như bài *Strategy và State thay if-else* — với hai cài đặt thật, ta biết interface cần những tham số gì (cân nặng!), điều mà bản "phòng xa" không đoán đúng: `ChienLuocPhi.tinh(long tien)` thiếu tham số cân nặng, nên đằng nào cũng phải sửa.

Đã chạy bản "9 kiểu" và bản đơn giản với cùng đầu vào: kết quả giống nhau (`true true`), stack trace từ 4 tầng xuống 1.
:::
