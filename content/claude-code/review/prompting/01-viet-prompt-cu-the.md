---
title: Viết prompt cụ thể và đưa đúng bối cảnh
summary: Nêu file, triệu chứng và thế nào là "đã sửa"; đưa thẳng file/ảnh/log; nhờ Claude phỏng vấn để viết SPEC.md; effort thay cho "think harder".
type: card
level: core
lastReviewed: 2026-11-11
tags: [claude-code, prompting]
related: [claude-code/review/principles/ai-la-cong-cu, claude-code/consolidate/memory/quy-trinh-task-angular]
---

## TL;DR

- Prompt cụ thể = cho Claude thông tin nó **chưa có**: file, triệu chứng, thế nào là xong.
- Có sẵn file/ảnh/log thì **đưa thẳng** (`@file`, dán ảnh, pipe output) thay vì mô tả.
- Chưa rõ yêu cầu → nhờ Claude phỏng vấn rồi viết `SPEC.md`; độ sâu suy nghĩ điều chỉnh bằng effort, không bằng câu thần chú.

## Cụ thể hoá yêu cầu

Prompt cụ thể giúp vì nó **cho Claude thông tin chưa có**: nêu file, mô tả triệu chứng, nói rõ thế nào là đã sửa.

| Thay vì | Thử |
|---|---|
| *"sửa lỗi lọc hồ sơ"* | *"Đổi trạng thái ở bộ lọc danh sách hồ sơ thì danh sách không cập nhật khi đang ở trang 2. Xem `features/cases/data-access/case-list.facade.ts`, viết test tái hiện lỗi trước, rồi sửa. Chạy `npm test -- --watch=false` tới khi pass."* |
| *"thêm ô nhập tiền"* | *"Làm theo mẫu `shared/ui/date-input`, tạo `money-input` hỗ trợ cả Reactive Forms (CVA) và Signal Forms, định dạng vi-VN. Không thêm thư viện mới."* |

Nếu có hai cách hợp lý và bạn quan tâm cách nào — **nói trước**, Claude không đọc được ý đó từ code.

## Đưa thẳng thứ Claude cần

- File: gõ `@` và đường dẫn để đính kèm nội dung.
- Ảnh: dán ảnh thiết kế hoặc ảnh lỗi vào prompt.
- Output lệnh: `cat error.log | claude -p "chuyện gì đang xảy ra"`.

## Chưa rõ mình muốn gì? Nhờ Claude phỏng vấn

```text
Tôi muốn thêm tính năng lưu nháp tự động cho form hồ sơ nhưng chưa nghĩ kỹ.
Hãy phỏng vấn tôi cho tới khi đủ để viết spec, rồi ghi vào SPEC.md.
```

Có `SPEC.md` rồi thì **mở phiên mới** để làm, bắt đầu với context sạch và một định nghĩa "xong" bằng văn bản.

## Khung 4 phần cho người mới

Khi không biết bắt đầu thế nào, viết đủ bốn dòng:

```text
Bối cảnh:  <ở đâu, triệu chứng hoặc mục tiêu, cái gì đã thử>
Việc:      <kết quả mong muốn, không cần liệt kê từng bước>
Ràng buộc: <không được đụng gì, không thêm gì, theo mẫu nào>
Xong khi:  <lệnh kiểm tra pass / chỉ số đạt / điều quan sát được>
```

Ví dụ:

```text
Bối cảnh:  Trang /cases, đổi bộ lọc trạng thái khi đang ở trang 2 thì danh sách không tải lại.
Việc:      Sửa để đổi bộ lọc luôn về trang 1 và tải lại.
Ràng buộc: Chỉ sửa trong features/cases; không đổi API của CaseApi; không thêm thư viện.
Xong khi:  Có test tái hiện (fail trước, pass sau); npm test -- --watch=false và ng build pass.
```

## Ảnh và log: những thứ nên dán

| Thay vì mô tả | Dán thẳng |
|---|---|
| "layout bị vỡ trên mobile" | Ảnh chụp màn hình 375px (`Ctrl+V`) |
| "build lỗi gì đó về type" | Output lỗi (`! ng build` hoặc `@build.log`) |
| "giống thiết kế" | Ảnh mockup + tên component mẫu |
| "API trả về sai" | Một response JSON mẫu (đã xoá dữ liệu thật) |

:::warning Đừng dán dữ liệu thật của khách hàng
Log và response có thể chứa thông tin cá nhân. Ẩn danh trước khi dán — mọi thứ trong prompt đều được gửi lên model.
:::

## Effort, không phải câu thần chú

- `think step by step`, `be thorough` chỉ là chữ thường, **không** nâng mức suy nghĩ vượt quá effort hiện tại.
- Điều chỉnh bằng `/effort` (`low` / `medium` mặc định / `high` / `xhigh` / `max`), hoặc `ultrathink` cho riêng một tin nhắn.
- `be ambitious` có ích khi bạn muốn bản đầy đủ (trạng thái rỗng/lỗi, bàn phím…), vì Claude có xu hướng làm phiên bản nhỏ nhất thoả yêu cầu.

:::interview Đưa một prompt bạn hay dùng và giải thích vì sao nó hiệu quả.
Ví dụ: "Bug: đổi bộ lọc khi ở trang 2 không tải lại. Xem features/cases/case-list.facade.ts. Viết test fail tái hiện trước, rồi sửa nguyên nhân gốc. Xong khi npm test -- --watch=false và ng build pass." Hiệu quả vì có bối cảnh cụ thể (triệu chứng, nơi bắt đầu), quy trình an toàn (test-first), và tiêu chí xong chạy được — Claude tự lặp tới khi đạt thay vì dừng ở lần thử đầu.
:::

:::quiz Theo hướng dẫn của Anthropic, viết "think harder" trong prompt có tác dụng gì?
- [ ] Nâng effort lên `high`
- [x] Chỉ là chữ thường, có thể "đẩy nhẹ" trong phạm vi effort hiện tại nhưng không vượt qua nó
- [ ] Bật chế độ plan
- [ ] Không có tác dụng gì và gây lỗi

Muốn Claude suy nghĩ sâu hơn: `/effort high` / `xhigh`, hoặc `ultrathink` cho một tin nhắn.
:::

:::quiz Sau khi Claude phỏng vấn và viết xong `SPEC.md`, nên làm gì tiếp?
- [ ] Bảo Claude làm luôn trong cùng phiên
- [x] Mở phiên mới để bắt đầu triển khai từ `SPEC.md`, với context sạch và định nghĩa "xong" bằng văn bản
- [ ] Xoá `SPEC.md`
- [ ] Gửi `SPEC.md` cho subagent đọc lại

`SPEC.md` cũng là thứ bạn đưa cho reviewer so sánh sau này.
:::

:::quiz Khi nào prompt mơ hồ như "bạn sẽ cải thiện gì ở file này?" là chấp nhận được?
- [ ] Không bao giờ
- [x] Khi bạn đang khám phá chứ không sửa một việc cụ thể — đánh đổi là sẽ phải chỉnh nhiều hơn
- [ ] Khi effort là `max`
- [ ] Khi dùng subagent

Prompt cụ thể cho việc cụ thể; prompt mở cho việc khám phá.
:::

:::exercise Viết lại ba prompt mơ hồ
Viết lại cho cụ thể (file, triệu chứng/mục tiêu, ràng buộc, cách kiểm tra): (1) "sửa lỗi tìm kiếm"; (2) "thêm test"; (3) "tối ưu danh sách". Thử bản đã viết lại trong cc-lab và so với bản gốc.
???
(1) *"Gõ 'angular' vào ô Tìm task (src/app/tasks) không ra 'Học Angular signals'; docstring nói không phân biệt hoa thường. Viết test fail trước, sửa filterTasks, chạy npm test -- --watch=false."* (2) *"Thêm test cho isOverdue trong task-filter.spec.ts: task hạn hôm nay (không quá hạn), hạn hôm qua chưa xong (quá hạn), hạn hôm qua đã xong (không). Theo style describe/it hiện có."* (3) *"Danh sách 5.000 task giật khi gõ tìm kiếm. Đo trước bằng DevTools Performance, đề xuất 2 cách (debounce query, virtual scroll) kèm trade-off, chưa sửa."*
:::

> Nguồn: *Best practices for Claude Code* — code.claude.com/docs/en/best-practices (truy cập 11/11/2026). Ví dụ được chuyển sang ngữ cảnh dự án Angular.
