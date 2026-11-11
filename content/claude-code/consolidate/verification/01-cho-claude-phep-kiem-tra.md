---
title: Cho Claude một phép kiểm tra — và đòi bằng chứng
summary: Test, build, lint hay ảnh chụp đều được, miễn trả về pass/fail; review độc lập theo spec với "skip style"; case study những lỗi AI đã mắc khi xây chính app này và bị bắt nhờ kiểm chứng.
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, verification, testing, case-study]
related: [claude-code/review/principles/ai-la-cong-cu, claude-code/consolidate/guardrails/hook-permission-sandbox]
---

## Nguyên tắc

> Claude dừng khi công việc **trông như** đã xong. Nếu không có gì để chạy cho biết nó **thật sự** xong chưa, thì "trông như xong" là tất cả những gì nó có — và bạn trở thành bộ test.

Phép kiểm tra có thể là bất cứ thứ gì trả về pass/fail mà Claude đọc được: file test, exit code của build, linter, script so output với fixture, ảnh chụp trình duyệt cạnh mockup.

Các mức độ chặt, từ mềm tới bắt buộc:

| Cách | Ai quyết định "xong" |
|---|---|
| Trong prompt: *"chạy test auth sau khi sửa, tiếp tục tới khi pass"* | Claude tự đánh giá |
| `/goal tất cả test trong tests/auth pass và lint sạch` | Một model khác kiểm tra sau mỗi lượt |
| `Stop` hook chạy typecheck | Claude Code — không xong cho tới khi pass |
| `/code-review` — review trong subagent chưa từng thấy hội thoại | Người (hoặc agent) không viết code |

Dù dùng cách nào: **đòi bằng chứng** — lệnh đã chạy và output của nó. "Mọi test đều pass" không kèm output gần như không nói lên gì.

## Review theo spec, bỏ qua style

```text
dùng một subagent review diff của tính năng lưu nháp so với SPEC.md: kiểm tra mọi yêu cầu
đã được làm và các trường hợp biên có test, chỉ báo lỗ hổng ảnh hưởng tính đúng đắn, bỏ qua style
```

Đừng bỏ `bỏ qua style`: reviewer được yêu cầu tìm lỗi thì **luôn** tìm ra gì đó, sửa hết sẽ sinh thêm lớp trừu tượng và test cho trường hợp không thể xảy ra.

## Case study: xây Learning Hub bằng Claude

App này được viết bằng Claude. Mọi phát biểu kỹ thuật đều phải qua một phép kiểm tra trước khi đưa lên — và chính các phép kiểm tra đó đã bắt được lỗi của AI:

| Lỗi AI viết ra lúc đầu | Bị bắt nhờ |
|---|---|
| Gọi `inject(Toast)` bên trong `catchError` của interceptor | Test tạm chạy thật → lỗi `NG0203` |
| Khẳng định `input(1, { transform: numberAttribute })` cho `1` khi URL thiếu param | Test router thật → kết quả là `NaN` |
| Ba chuỗi marble test sai thời điểm | Chạy `TestScheduler` thật |
| Trích "tsconfig của Angular 22" có `strict` và `strictTemplates` | So với file CLI thật sinh ra |
| Ví dụ `toObservable`, câu hỏi về DI, sanitizer… | Đều được chạy lại và khớp |

Bài học: **AI cũng sai một cách rất tự tin**. Thứ bảo vệ chất lượng không phải là "AI giỏi", mà là phép kiểm tra + người review hiểu kiến thức nền.

:::quiz Claude báo "Đã sửa xong, tất cả test pass". Bạn nên làm gì trước khi tin?
- [ ] Tin, vì Claude đã nói vậy
- [x] Xem lệnh Claude đã chạy và output thật (hoặc yêu cầu Claude dán ra) — đọc output nhanh hơn tự chạy lại
- [ ] Hỏi lại "bạn chắc chứ?"
- [ ] Chạy `/clear`

Với phiên chạy khi bạn vắng mặt, output là bằng chứng duy nhất bạn có.
:::

:::quiz Vì sao `/code-review` chạy trong subagent mới, chưa từng thấy hội thoại?
- [ ] Để tiết kiệm token
- [x] Để reviewer không bị ảnh hưởng bởi lập luận đã tạo ra đoạn code đó
- [ ] Vì subagent thông minh hơn
- [ ] Để chạy song song

Hướng dẫn nhấn mạnh: giao cùng việc cho subagent không cho câu trả lời tốt hơn — nhưng một **reviewer mới** thì có ích.
:::

:::exercise Viết prompt có phép kiểm tra cho task thật
Task: "Chuyển `CaseListComponent` từ `*ngFor`/`*ngIf` sang control flow mới và từ `@Input()` sang signal input." Viết prompt cho Claude Code có đủ: phạm vi, phép kiểm tra, bằng chứng cần trả về.
???
```text
Chuyển src/app/features/cases/case-list/ sang control flow mới (@if/@for có track theo id)
và signal input. Dùng schematic chính thức trước:
  ng generate @angular/core:control-flow --path src/app/features/cases/case-list
  ng generate @angular/core:signal-input-migration --path src/app/features/cases/case-list
rồi chỉ sửa tay phần schematic không xử lý được.
Kiểm tra: npx tsc --noEmit -p tsconfig.app.json và
npx ng test --watch=false --include src/app/features/cases/case-list
phải pass. Không đổi hành vi, không đụng file ngoài thư mục này.
Khi xong: dán output của hai lệnh kiểm tra và liệt kê các chỗ phải sửa tay kèm lý do.
```
Trước khi merge, **chính bạn** đọc diff: `track` có đúng theo id không, chỗ nào từng dùng `ngOnChanges` đã được chuyển sang `computed`/`effect` hợp lý chưa (kiến thức từ bài Signals).
:::

> Nguồn: *Best practices for Claude Code* — mục "Give Claude a check to run", code.claude.com/docs (truy cập 11/11/2026). Case study từ quá trình xây app này.
