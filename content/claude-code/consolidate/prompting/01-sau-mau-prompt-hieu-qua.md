---
title: Sáu mẫu prompt hiệu quả và 15 prompt mẫu cho công việc Angular hằng ngày
summary: "Sáu mẫu rút từ Prompt library chính thức — mô tả kết quả, kèm cách tự kiểm tra, trỏ tới file mẫu, nêu chỉ số đo được, đưa thẳng tài liệu gốc, nói rõ định dạng trả lời — áp dụng cho 15 tình huống thực tế từ đọc code, viết test, hiệu năng, a11y tới viết mô tả PR, mỗi prompt kèm lý do nó hiệu quả."
type: lesson
level: intermediate
lastReviewed: 2026-11-12
tags: [claude-code, prompting, prompt-library, angular]
related: [claude-code/review/prompting/viet-prompt-cu-the, claude-code/consolidate/memory/quy-trinh-task-angular]
---

## TL;DR — sáu mẫu

| Mẫu | Ví dụ ngắn |
|---|---|
| **1. Mô tả kết quả, không mô tả từng bước** | "thêm rate limit cho API public và bảo đảm test hiện có vẫn pass" |
| **2. Kèm cách tự kiểm tra** | "viết migration, chạy trên DB dev, xác nhận schema khớp" |
| **3. Trỏ tới mẫu có sẵn** | "trang settings theo đúng layout của trang profile" |
| **4. Nêu chỉ số đo được** | "đưa bundle dưới 200KB và cho mình xem đã bỏ gì" |
| **5. Đưa thẳng tài liệu gốc** | "vì sao build fail? @build.log" |
| **6. Nói rõ định dạng câu trả lời** | "giải thích logic retry thanh toán thành trang HTML có sơ đồ" |

Prompt tốt thường kết hợp 2–4 mẫu. Prompt dùng lại nhiều lần → lưu thành **skill**; quy ước Claude học được → ghi vào **CLAUDE.md**.

## Viết lại: trước và sau

```text bad
làm trang orders nhanh hơn
```

```text good
Trang /orders (src/app/features/orders) mất ~2,5s mới hiển thị với 2.000 dòng.  ← tài liệu gốc + chỉ số
Mục tiêu: dưới 800ms trên máy dev, giữ nguyên hành vi lọc và sắp xếp.           ← chỉ số + ràng buộc
Đo trước bằng Performance profile, đề xuất 2–3 hướng kèm trade-off, chưa sửa.   ← tự kiểm tra
Trả lời dạng bảng: hướng | lợi ích ước tính | rủi ro | file đụng tới.             ← định dạng
```

## 15 prompt mẫu cho dự án Angular

### Đọc và hiểu

```text
Giải thích luồng dữ liệu từ OrderFacade tới OrderTableComponent: signal/observable nào, ai subscribe, khi nào huỷ.
Trả lời bằng danh sách đánh số, mỗi bước kèm file:dòng.
```
*Vì sao hiệu quả:* đối tượng cụ thể + định dạng có trích dẫn → bạn kiểm lại được.

```text
Có những cách gọi API nào khác nhau trong codebase (HttpClient trực tiếp, service riêng, httpResource)? Đếm số chỗ mỗi kiểu và đề xuất một kiểu chuẩn.
```
*Vì sao:* nêu kết quả cần (thống kê + đề xuất), Claude tự tìm file.

### Viết code mới

```text
Thêm trang /settings/notifications theo đúng cấu trúc của /settings/profile (component, facade, route lazy, test).
Form dùng Signal Forms. Kiểm tra: ng build và npm test -- --watch=false.
```
*Vì sao:* trỏ tới mẫu có sẵn → code mới nhất quán; có phép kiểm tra.

```text
Tạo pipe relativeTime ("3 phút trước") dùng Intl.RelativeTimeFormat locale vi, có test cho giây/phút/giờ/ngày và tương lai.
```
*Vì sao:* đặc tả hành vi bằng các case test.

### Test

```text
Tìm các nhánh logic chưa có test trong src/app/core/auth và viết test cho chúng theo style các spec hiện có.
Không sửa code nguồn; nếu test lộ ra bug thì báo, đừng sửa.
```
*Vì sao:* tách rõ "viết test" và "sửa bug" — tránh Claude sửa code cho test xanh.

```text
Test flaky: user-list.component.spec.ts lúc pass lúc fail khi chạy cả bộ. Chạy riêng 10 lần và chạy cả bộ 3 lần, tìm nguyên nhân (thứ tự, timer, state dùng chung), đề xuất cách sửa.
```
*Vì sao:* đưa cách tái hiện cụ thể; Claude tự thu thập bằng chứng.

### Debug

```text
@error.log là log khi mở /reports trên staging. Tìm nguyên nhân gốc, chỉ file gây lỗi, đề xuất fix kèm test tái hiện.
```
*Vì sao:* tài liệu gốc thay cho mô tả của bạn.

```text
NG0100 ExpressionChangedAfterItHasBeenChecked ở DashboardComponent sau khi chuyển sang zoneless. Giải thích vì sao xảy ra trong trường hợp này và 2 cách sửa đúng (không dùng setTimeout).
```
*Vì sao:* ràng buộc loại bỏ cách "chữa cháy".

### Hiệu năng

```text
Đưa initial bundle của app dưới 500KB. Chạy ng build --stats-json, liệt kê 10 module lớn nhất, đề xuất lazy-load/defer, áp dụng từng bước và cho xem kích thước sau mỗi bước.
```
*Vì sao:* chỉ số rõ ràng → biết lúc nào xong.

### Accessibility

```text
Rà soát a11y của form đăng ký: label, thông báo lỗi liên kết bằng aria-describedby, thứ tự tab, focus sau submit lỗi, tương phản màu AA.
Báo bảng: tiêu chí | đạt/không | file:dòng | cách sửa. Sửa các mục không đạt.
```

### Refactor và migration

```text
Chuyển các component trong src/app/shared sang input()/output() bằng schematic chính thức trước (ng generate @angular/core:signal-input-migration), rồi mới sửa tay phần còn lại. Liệt kê chỗ sửa tay và lý do.
```
*Vì sao:* ưu tiên công cụ tất định, Claude xử lý phần còn lại.

```text
Gom 4 cách xử lý lỗi HTTP khác nhau về một errorInterceptor. Trước khi sửa, viết characterization test cho hành vi hiện tại của từng chỗ.
```

### Review và giao tiếp

```text
Đóng vai reviewer khó tính cho diff hiện tại: chỉ báo vấn đề về tính đúng đắn, rò rỉ subscription, a11y. Mỗi vấn đề một dòng file:dòng — vấn đề — đề xuất. Bỏ qua style.
```

```text
Viết mô tả PR cho thay đổi hiện tại: Vấn đề, Giải pháp, Cách test thủ công (bước cụ thể), Rủi ro, Ảnh chụp cần thêm. Tiếng Việt, ngắn gọn.
```

```text
Giải thích thay đổi này cho PM không biết code trong 5 câu: người dùng thấy gì khác, rủi ro gì, cần test gì.
```
*Vì sao:* nêu rõ người đọc → đúng mức chi tiết.

## Lỗi hay gặp khi viết prompt

| Lỗi | Sửa |
|---|---|
| Liệt kê từng bước như script | Nêu kết quả + ràng buộc, để Claude chọn bước |
| Không có tiêu chí xong | Thêm lệnh kiểm tra hoặc chỉ số |
| Mô tả lỗi bằng lời thay vì đưa log | `@file.log`, dán stack trace, ảnh chụp |
| "Sửa cho đẹp/nhanh/sạch" | Định nghĩa đẹp/nhanh/sạch bằng tiêu chí đo được |
| Một prompt làm 5 việc khác nhau | Tách thành các bước hoặc các phiên |

:::senior Góc nhìn senior
Prompt tốt chính là **ticket tốt**: bối cảnh, mục tiêu, phạm vi, tiêu chí chấp nhận. Nếu bạn viết được ticket rõ cho junior thì cũng viết được prompt rõ cho Claude — và ngược lại, luyện prompt là luyện kỹ năng giao việc của một senior.
:::

:::interview Prompt tốt có những thành phần nào?
Kết quả mong muốn (không phải từng bước), cách tự kiểm tra (lệnh/chỉ số), mẫu tham chiếu có sẵn trong repo, tài liệu gốc (log, ảnh, file) thay cho mô tả, và định dạng câu trả lời. Giống một ticket tốt: bối cảnh, mục tiêu, phạm vi, tiêu chí chấp nhận.
:::

:::quiz Prompt "đưa bundle dưới 200KB và cho mình xem đã bỏ gì" dùng những mẫu nào?
- [ ] Trỏ tới mẫu có sẵn
- [x] Nêu chỉ số đo được và nói rõ định dạng câu trả lời
- [ ] Đưa thẳng tài liệu gốc
- [ ] Không mẫu nào

Chỉ số cho biết khi nào xong; "cho mình xem đã bỏ gì" định nghĩa đầu ra.
:::

:::quiz Vì sao prompt viết test nên ghi "nếu test lộ ra bug thì báo, đừng sửa"?
- [ ] Để Claude chạy nhanh hơn
- [x] Để tách việc viết test khỏi việc sửa code — tránh Claude sửa code (hoặc test) cho xanh mà không ai biết có bug
- [ ] Vì Claude không sửa được code khi viết test
- [ ] Không cần thiết

Bug được lộ ra là kết quả có giá trị — bạn muốn thấy nó.
:::

:::exercise Viết lại 5 prompt của chính bạn
Mở lịch sử phiên gần đây (`/resume`, hoặc `Ctrl+R` để tìm prompt cũ). Chọn 5 prompt cho kết quả không như ý, viết lại mỗi cái bằng ít nhất 3 trong 6 mẫu, chạy lại một cái trên cc-lab hoặc dự án thật và so kết quả.
???
Thường gặp: prompt cũ thiếu mẫu 2 (cách tự kiểm tra) — thêm lệnh test/build hoặc "chạy lại và cho xem kết quả" thường cải thiện nhiều nhất. Thứ hai là mẫu 5 (đưa log/ảnh thay vì mô tả). Prompt nào bạn viết lại lần thứ ba → biến thành skill (Lab 07).
:::

> Nguồn: *Prompt library* — mục "What makes these prompts work"; *Common workflows*; *Best practices* — code.claude.com/docs (truy cập 12/11/2026).
