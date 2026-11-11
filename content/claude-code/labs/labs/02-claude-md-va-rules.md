---
title: "Lab 02 — Viết CLAUDE.md, rules theo đường dẫn và kiểm tra Claude có tuân thủ không"
summary: "Tạo CLAUDE.md bằng /init rồi rút gọn còn những gì Claude không tự thấy, thêm .claude/rules có paths cho module tasks, xác minh bằng /context all, rồi giao một task để kiểm tra Claude theo đúng quy ước — và phân biệt CLAUDE.md với auto memory."
type: lesson
level: core
lastReviewed: 2026-11-11
tags: [claude-code, lab, claude-md, rules, memory]
related: [claude-code/consolidate/memory/cau-truc-bo-nho, claude-code/labs/labs/tinh-nang-voi-plan-mode]
---

## Mục tiêu

- Một `CLAUDE.md` **ngắn, cụ thể, kiểm chứng được** cho cc-lab.
- Một rule chỉ nạp khi Claude làm việc trong `src/app/tasks/`.
- Bằng chứng (không phải cảm giác) rằng Claude đã đọc và làm theo.

**Thời gian:** 30 phút · **Tiền đề:** đã xong Lab 01.

## Bước 1 — Sinh CLAUDE.md

```bash
cd cc-lab && claude -n "lab02"
```

```text
/init
```

Đọc file vừa tạo. Đánh dấu từng dòng: **(G)** giữ — Claude không tự suy ra được; **(X)** xoá — Claude tự đọc được từ code (mô tả cấu trúc thư mục, "dự án dùng Angular"…).

## Bước 2 — Rút gọn còn dưới 30 dòng

Thay bằng nội dung này (chỉnh theo ý bạn), hoặc nhờ Claude sửa theo đúng nội dung:

```md title="CLAUDE.md"
# cc-lab

## Lệnh
- Test: `npm test -- --watch=false` (Vitest). Build: `npx ng build`.
- Chạy cả hai trước khi báo "xong".

## Quy ước
- State dùng `signal`/`computed`; không dùng BehaviorSubject cho state mới.
- Component standalone, `inject()` thay cho constructor injection, control flow `@if/@for`.
- Ngày luôn là chuỗi `YYYY-MM-DD`; so sánh ngày bằng so sánh chuỗi, không dùng `Date` trong logic lọc.
- Không thêm thư viện npm mới khi chưa hỏi.

## Gotcha
- `today` trong logic nghiệp vụ phải được truyền vào (tham số), không gọi `new Date()` bên trong hàm lọc — để test cố định được.
```

## Bước 3 — Rule cho module tasks

```md title=".claude/rules/tasks.md"
---
paths:
  - "src/app/tasks/**"
---
# Module tasks
- Hàm thuần trong `task-filter.ts` phải có test trong `task-filter.spec.ts` cho mỗi nhánh logic.
- Mọi field mới của `Task` phải có giá trị mặc định khi tạo task trong `TaskStore.add`.
- Text hiển thị cho người dùng viết tiếng Việt.
```

## Bước 4 — Xác minh đã nạp

```text
/clear
```

```text
/context all
```

Trong **Memory files** phải thấy `CLAUDE.md`. Rule `tasks.md` **chưa** có — nó có `paths` nên chỉ nạp khi Claude đọc/sửa file trong `src/app/tasks/`.

```text
Đọc src/app/tasks/task-store.ts và tóm tắt trong 2 câu.
```

```text
/context all
```

Lần này rule đã xuất hiện.

## Bước 5 — Kiểm tra mức tuân thủ

```text
Thêm field priority ('low' | 'normal' | 'high') cho Task và hiển thị nó trong TaskList. Làm xong thì báo.
```

Không nhắc gì thêm. Khi Claude báo xong, chấm theo bảng:

| Quy ước | Claude có làm? |
|---|---|
| Có giá trị mặc định trong `TaskStore.add` (rule) | ☐ |
| Text hiển thị tiếng Việt (rule) | ☐ |
| Chạy `npm test -- --watch=false` và `npx ng build` trước khi báo xong (CLAUDE.md) | ☐ |
| Không thêm thư viện mới | ☐ |

Mục nào trượt → sửa câu chữ trong CLAUDE.md/rule cho **cụ thể hơn**, `/clear`, `git checkout .`, chạy lại Bước 5.

## Bước 6 — CLAUDE.md, CLAUDE.local.md và auto memory

```text
Nhớ giúp mình: mình thích commit message tiếng Anh theo Conventional Commits.
```

Thấy *Saved … memory* → điều này vào **auto memory** (chỉ máy bạn). Mở `/memory` xem file vừa được ghi. Muốn cả team theo: *"thêm quy ước commit message vào CLAUDE.md"*. Tạo thêm `CLAUDE.local.md` (thêm vào `.gitignore`) với một dòng riêng của bạn, ví dụ URL API giả lập bạn hay dùng.

## Checklist hoàn thành

- [ ] `CLAUDE.md` dưới 30 dòng, mỗi dòng kiểm chứng được
- [ ] `.claude/rules/tasks.md` có `paths`, đã thấy nó nạp sau khi Claude đọc file tasks
- [ ] Bảng chấm ở Bước 5 đạt 4/4 (sau tối đa 2 lần chỉnh câu chữ)
- [ ] Phân biệt được ghi chú nào vào auto memory, cái nào vào CLAUDE.md
- [ ] Commit `CLAUDE.md` và `.claude/rules/`, không commit `CLAUDE.local.md`

:::quiz Sau `/clear`, `/context all` chưa liệt kê `.claude/rules/tasks.md`. Lý do?
- [ ] File sai định dạng
- [x] Rule có `paths` chỉ nạp khi Claude đọc/sửa file khớp `src/app/tasks/**`
- [ ] Rule chỉ nạp ở plan mode
- [ ] Phải chạy `/reload-skills`

Rule không có `paths` mới nạp ngay khi khởi động.
:::

:::exercise Thử thách mở rộng — viết chỉ dẫn "chịu được compact"
Thêm vào CLAUDE.md một mục `## Compact Instructions` nói rõ khi compact phải giữ lại gì (vd danh sách file đã đổi và test còn fail). Làm một task dài, chạy `/compact`, rồi hỏi Claude "những file nào đã đổi và test nào còn fail?" để kiểm tra.
???
Ví dụ: `## Compact Instructions` → `- Khi compact, giữ: danh sách file đã sửa, lệnh kiểm tra cuối cùng và kết quả, quyết định thiết kế đã chốt, việc còn dang dở.` Sau `/compact`, Claude trả lời đúng danh sách nếu chỉ dẫn được áp dụng. Kết hợp thêm: CLAUDE.md ở gốc dự án được nạp lại từ đĩa sau compact, nên các quy ước ở Bước 2 vẫn còn hiệu lực.
:::

> Nguồn: *How Claude remembers your project*, *Explore the context window* — code.claude.com/docs/en/memory, /context-window (truy cập 11/11/2026).
