---
title: "Lab 04 — Sửa bug test-first, tìm bug ẩn thứ hai, và luyện /rewind"
summary: "Tái hiện bug tìm kiếm phân biệt hoa thường trong cc-lab bằng test fail, nhờ Claude sửa nguyên nhân gốc, rồi tự tìm bug ẩn thứ hai ở dueWithin; cố ý để Claude đi sai và quay lại bằng /rewind, so sánh với git."
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, lab, debugging, testing, checkpoint]
related: [claude-code/consolidate/workflows/bug-test-refactor, claude-code/consolidate/sessions/context-window-va-checkpoint]
---

## Bối cảnh

Người dùng báo: *"Gõ 'angular' vào ô tìm kiếm không ra task 'Học Angular signals'."* Docstring của `filterTasks` nói rõ "không phân biệt hoa thường" — đây là bug so với spec.

**Thời gian:** 40 phút · **Tiền đề:** Lab 01 (seed nguyên vẹn ở `task-filter.ts`).

## Bước 1 — Tự tái hiện (không dùng Claude)

```bash
npx ng serve
```

Gõ `angular` → danh sách rỗng; gõ `Angular` → có kết quả. Ghi lại bước tái hiện.

## Bước 2 — Giao bug cho Claude, test trước

```bash
claude -n "lab04-search-bug"
```

```text
Bug: gõ "angular" vào ô Tìm task không ra "Học Angular signals"; gõ "Angular" thì ra. Lỗi ổn định.
Docstring filterTasks nói không phân biệt hoa thường.
1. Viết test fail tái hiện bug trong task-filter.spec.ts, chạy npm test -- --watch=false và cho mình xem nó FAIL.
2. Chưa sửa code cho tới khi mình xác nhận test fail đúng lý do.
```

Kiểm tra: test fail **vì đúng lý do** (kỳ vọng `[1]`, nhận `[]`), không phải lỗi import hay cú pháp.

```text
Đúng rồi. Giờ sửa nguyên nhân gốc trong filterTasks; xét cả khoảng trắng hai đầu từ khoá. Chạy lại toàn bộ test.
```

Kết quả hợp lý (đã kiểm chứng trên cc-lab):

```ts good title="task-filter.ts (phần sửa)"
const q = query.trim().toLocaleLowerCase();
return tasks.filter(
  (t) => t.title.toLocaleLowerCase().includes(q) && (status === 'all' || t.status === status),
);
```

## Bước 3 — Tự tìm bug ẩn thứ hai

`dueWithin` có một bug khác. **Đừng hỏi Claude ngay.** Đọc docstring và code, tự viết một test fail. Sau 10 phút mới được nhờ gợi ý: *"Chỉ cho mình một gợi ý (không đưa đáp án) về chỗ dueWithin lệch với docstring."*

## Bước 4 — Luyện `/rewind`

1. Commit fix của Bước 2.
2. Cố ý giao một việc mơ hồ: *"Refactor toàn bộ module tasks cho gọn hơn."*
3. Khi Claude đã sửa vài file, nhấn `Esc`.
4. `Esc Esc` (ô nhập trống) → chọn prompt "Refactor…" → **Restore code and conversation**.
5. `git status` — sạch như trước? Ghi lại.
6. Thử lại nhưng lần này nhờ Claude chạy một lệnh Bash đổi file (vd `npx prettier --write src/app/tasks`), rồi `/rewind` → Restore code. File bị prettier đổi có quay lại không? Dùng `git diff` để kiểm. Theo tài liệu: file mà Claude **đã từng sửa bằng công cụ sửa file** trong phiên thì thay đổi Bash sau đó cũng được hoàn tác; file **chỉ** bị Bash đổi thì không — kết quả của bạn nên khớp quy tắc này.

## Checklist hoàn thành

- [ ] Có test fail tái hiện bug tìm kiếm **trước** khi sửa; sau khi sửa toàn bộ test xanh
- [ ] Tự tìm và viết test fail cho bug `dueWithin`, sửa được (có thể nhờ Claude sửa sau khi bạn đã có test)
- [ ] Đã dùng `/rewind` khôi phục được thay đổi của công cụ sửa file
- [ ] Quan sát được giới hạn: file chỉ do lệnh Bash thay đổi thì checkpoint không khôi phục → dùng `git checkout`

## Lỗi thường gặp

| Hiện tượng | Xử lý |
|---|---|
| Claude sửa luôn code khi viết test | Nhắc lại: "chỉ test, chưa sửa" — hoặc `/rewind` → Restore code |
| Test mới pass ngay | Test không tái hiện đúng bug — đọc lại input/kỳ vọng |
| Claude đổi kỳ vọng của test cũ cho xanh | Từ chối: test cũ đúng spec thì sửa code |

:::quiz Test tái hiện bug fail với lỗi `Cannot find module`. Bạn kết luận gì?
- [ ] Test đã tái hiện bug
- [x] Test fail **sai lý do** (lỗi import) — chưa chứng minh được bug; sửa test cho tới khi nó fail vì đúng kỳ vọng
- [ ] Bug đã được sửa
- [ ] Phải xoá test

Test phải fail vì kỳ vọng `[1]` nhận `[]`, không phải vì lỗi setup.
:::

:::quiz Sau khi `/rewind` → Restore code and conversation, `git status` cho thấy còn file bị đổi. Nguyên nhân khả dĩ?
- [ ] Checkpoint bị lỗi
- [x] File đó chỉ bị lệnh Bash thay đổi (vd prettier) và Claude chưa từng sửa nó bằng công cụ sửa file — checkpoint không theo dõi
- [ ] Git bị hỏng
- [ ] Rewind chỉ chạy ở plan mode

Dùng `git checkout` cho những file đó.
:::

:::quiz Vì sao bắt test phải FAIL trước khi sửa?
- [ ] Để tốn ít token hơn
- [x] Để chứng minh test thật sự bắt được bug — test pass ngay từ đầu không chứng minh fix có tác dụng
- [ ] Vì Vitest yêu cầu
- [ ] Để Claude không sửa code

Test fail → pass là bằng chứng fix đúng chỗ.
:::

:::exercise Lời giải bug thứ hai (chỉ mở sau khi đã tự làm)
Bug ở `dueWithin` là gì, test nào tái hiện, sửa thế nào?
???
Docstring: khoảng [hôm nay, hôm nay + days] **tính cả hai đầu**, nhưng code dùng `t.dueDate < end` nên loại mất ngày cuối. Test (đã kiểm chứng): với dữ liệu mẫu, `dueWithin(tasks, '2026-11-11', 9)` phải trả `[2]` (task hạn 2026-11-20 = 11 + 9) nhưng code cũ trả `[]`. Sửa: `t.dueDate <= end`. Thêm test biên: `days = 0` chỉ trả task hạn đúng hôm nay; task hạn hôm qua không xuất hiện.
:::

> Nguồn: quy trình theo *Common workflows* — "Fix bugs efficiently"; *Checkpointing* — giới hạn với lệnh Bash, code.claude.com/docs (truy cập 11/11/2026). Bug và lời giải đã chạy thử trên dự án cc-lab (Angular 22.2.5, Vitest).
