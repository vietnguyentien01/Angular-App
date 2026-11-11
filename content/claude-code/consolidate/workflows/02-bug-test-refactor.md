---
title: Sửa bug, viết test, refactor và viết tài liệu cùng Claude Code
summary: Công thức chính thức cho bốn việc hằng ngày — chia sẻ lỗi kèm lệnh tái hiện, tìm code chưa có test và thêm case biên, refactor từng bước nhỏ có kiểm tra, cập nhật tài liệu — áp vào dự án Angular, kèm cách dùng ảnh chụp cho bug giao diện.
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, debugging, testing, refactoring, workflow]
related: [claude-code/consolidate/verification/cho-claude-phep-kiem-tra, claude-code/consolidate/memory/quy-trinh-task-angular]
---

## TL;DR

- **Bug**: đưa lệnh tái hiện + stack trace + bước tái hiện + "lỗi lúc có lúc không?". Đòi test fail trước, sửa nguyên nhân gốc sau.
- **Test**: nhờ tìm code chưa có test → khung test theo đúng style dự án → case biên → chạy và sửa.
- **Refactor**: tìm chỗ cũ → đề xuất → áp dụng **giữ nguyên hành vi** → chạy test; chia thành bước nhỏ.
- **Docs**: Claude viết nháp, bạn kiểm tra đúng sự thật.

## Sửa bug

Công thức trong tài liệu: chia sẻ lỗi → xin vài phương án → áp dụng phương án đã chọn.

```text
Mình thấy lỗi khi chạy `ng test --watch=false`:
<dán stack trace hoặc dùng `! ng test --watch=false`>
Lỗi xảy ra ổn định (không chập chờn). Bước tái hiện: mở /orders, lọc theo ngày, bấm trang 2.
```

```text
Đề xuất 2–3 cách sửa nguyên nhân gốc, kèm trade-off. Chưa sửa vội.
```

```text
Áp dụng cách 2. Viết test tái hiện trước (phải fail), rồi sửa, rồi chạy lại toàn bộ test của feature orders.
```

Mẹo theo tài liệu: cho Claude **lệnh tái hiện** để nó tự lấy stack trace; nói rõ lỗi **ổn định hay chập chờn**.

### Bug giao diện: dùng ảnh

Kéo thả ảnh chụp hoặc `Ctrl+V`:

```text
[Image #1] là màn hình trên mobile 375px: nút Submit bị đẩy ra ngoài card. Tìm nguyên nhân trong CSS của OrderFormComponent và sửa; mô tả cách bạn kiểm tra trên viewport 375px.
```

## Viết test

```text
Tìm các hàm/nhánh trong src/app/features/orders/order-filter.ts chưa được test bao phủ.
```

```text
Thêm test cho order-filter theo đúng style các file .spec.ts hiện có (Vitest, TestBed).
```

```text
Thêm case biên: khoảng ngày rỗng, ngày bắt đầu sau ngày kết thúc, timezone lệch ngày, danh sách 0 phần tử.
```

```text
Chạy các test mới và sửa các test fail — nếu test fail vì code sai thì báo mình, đừng sửa test cho pass.
```

:::warning Claude "sửa test cho xanh"
Khi một test fail, cách nhanh nhất để "xong" là sửa kỳ vọng của test. Luôn nói rõ: test fail vì **code** sai thì sửa code và báo lại; chỉ sửa test khi test sai so với spec.
:::

## Refactor

```text
Tìm mọi chỗ còn dùng *ngIf/*ngFor và constructor injection trong src/app/features/reports.
```

```text
Đề xuất cách chuyển report-table.component sang control flow (@if/@for) và inject(); giải thích lợi ích.
```

```text
Áp dụng, giữ nguyên hành vi. Ưu tiên schematic chính thức (ng generate @angular/core:control-flow) rồi mới sửa tay phần còn lại. Chạy test của reports sau khi xong.
```

Mẹo: refactor theo **bước nhỏ, kiểm tra được**; yêu cầu giữ tương thích ngược khi cần; hỏi Claude lợi ích của cách mới để bạn học được lý do, không chỉ kết quả.

## Tài liệu

```text
Cập nhật README phần "Chạy dự án" theo scripts hiện có trong package.json; không bịa lệnh không tồn tại.
```

```text
Thêm JSDoc cho các hàm public trong order-filter.ts, mô tả input/output và case biên.
```

:::senior Góc nhìn senior
Ba câu hỏi trước khi chấp nhận một bug fix từ Claude: (1) Nguyên nhân gốc là gì, có bằng chứng (test fail → pass) không? (2) Có chỗ nào khác cùng nguyên nhân không? (3) Fix có đổi hành vi nào ngoài bug không? Bạn trả lời được cả ba thì mới merge.
:::

:::quiz Theo tài liệu, thông tin nào giúp Claude sửa bug hiệu quả nhất?
- [ ] Chỉ nói "fix the bug"
- [x] Lệnh tái hiện để lấy stack trace, các bước tái hiện, và lỗi ổn định hay chập chờn
- [ ] Ảnh logo dự án
- [ ] Toàn bộ lịch sử git

Càng nhiều tín hiệu tái hiện được, Claude càng tự kiểm chứng được fix.
:::

:::quiz Claude báo "đã sửa xong, test pass" nhưng diff cho thấy nó đổi giá trị expected trong test. Bạn làm gì?
- [ ] Chấp nhận vì test đã xanh
- [x] Kiểm tra spec: nếu test đúng spec thì yêu cầu sửa code, không sửa test
- [ ] Xoá test đó
- [ ] Bật bypassPermissions

Test là phép kiểm tra — sửa kỳ vọng cho khớp code sai làm mất ý nghĩa kiểm tra.
:::

:::interview Bạn refactor một service lớn bằng Claude. Làm sao biết hành vi không đổi?
Trước khi refactor: bảo đảm có test bao phủ hành vi hiện tại (nếu thiếu, nhờ Claude viết **characterization test** trên code cũ và chạy xanh). Refactor từng bước nhỏ, chạy test sau mỗi bước, commit từng bước để dễ revert. Cuối cùng review diff tìm thay đổi hành vi ngầm (thứ tự gọi, xử lý lỗi, giá trị mặc định).
:::

:::exercise Viết bộ prompt sửa một bug thật
Lấy một bug gần đây trong dự án của bạn. Viết chuỗi 3 prompt: (1) chia sẻ lỗi + tái hiện, (2) xin phương án, (3) áp dụng với test-first và lệnh kiểm tra.
???
Mẫu: (1) *"Khi chọn lại cùng một bộ lọc, danh sách không reload. Tái hiện: /orders → chọn 'Đã giao' → chọn lại 'Đã giao'. Ổn định. Code ở `features/orders/`."* (2) *"Đề xuất 2 cách sửa nguyên nhân gốc, nêu trade-off; chưa sửa."* (3) *"Áp dụng cách 1: viết test fail tái hiện (chọn lại cùng filter phải gọi API lần 2), rồi sửa; chạy `ng test --watch=false --include='**/orders/**'`; giải thích nguyên nhân gốc trong 3 câu."* Nguyên nhân hay gặp: `distinctUntilChanged()` hoặc signal so sánh bằng giá trị nên không phát lại khi giá trị không đổi.
:::

> Nguồn: *Common workflows* — mục "Fix bugs efficiently", "Refactor code", "Work with tests", "Handle documentation", "Work with images", code.claude.com/docs/en/common-workflows (truy cập 11/11/2026).
