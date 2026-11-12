---
title: "Lab 08 — Subagent reviewer chỉ đọc cho cc-lab, so sánh với /code-review"
summary: "Cài sẵn ba lỗi vào một nhánh của cc-lab, tạo subagent angular-reviewer chỉ có công cụ đọc, gọi nó bằng @-mention, đo xem nó bắt được lỗi nào, so với /code-review, rồi cải thiện system prompt — và kiểm chứng rằng subagent thật sự không sửa được file."
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, lab, subagents, code-review]
related: [claude-code/deep-dive/extending/subagent, claude-code/labs/labs/git-pr-va-review]
---

## Mục tiêu

Một reviewer **độc lập** (chưa thấy cách code được viết), **ít quyền** (chỉ đọc), bám **checklist của team** — và số liệu về việc nó bắt được gì.

**Thời gian:** 45 phút.

## Bước 1 — Tạo nhánh có ba lỗi cài sẵn

```bash
git checkout -b lab08-review
```

Tự tay (không dùng Claude) sửa `task-list.ts` để có ba vấn đề:

1. Thay `@for` bằng `*ngFor` (thêm `NgFor` vào `imports`) — vi phạm quy ước.
2. Thêm một `<input>` mới **không có label**, vd ô chọn ngày không nhãn.
3. Trong `TaskStore`, thêm method `subscribeClock()` dùng `setInterval` cập nhật một signal mà **không bao giờ** `clearInterval`.

```bash
git commit -am "wip: changes for review lab"
```

## Bước 2 — Tạo subagent

```md title=".claude/agents/angular-reviewer.md"
---
name: angular-reviewer
description: Reviews Angular changes in this repo against team conventions and accessibility. Use after code changes in src/app, or when the user asks for a review.
tools: Read, Glob, Grep, Bash
model: sonnet
---
You are a senior Angular reviewer for this repository.
Review the diff of the current branch against main: run `git diff main...HEAD`.

Checklist:
1. Control flow: @if/@for/@switch, not *ngIf/*ngFor.
2. State: signal/computed; no BehaviorSubject for new state.
3. Resource cleanup: every interval, timeout, subscription or listener has cleanup (DestroyRef/takeUntilDestroyed).
4. Accessibility: every input/select/button has an accessible name; keyboard usable.
5. No logic calling new Date() inside pure filter functions.

Report only real problems, one per line: `file:line — problem — suggested fix`.
Do not report style nits. Do not edit files. If nothing is wrong, say so.
```

## Bước 3 — Gọi reviewer

```bash
claude -n "lab08"
```

Gõ `@` rồi chọn `angular-reviewer (agent)`:

```text
@"angular-reviewer (agent)" review nhánh hiện tại
```

Ghi lại kết quả vào bảng:

| Lỗi cài sẵn | angular-reviewer | /code-review |
|---|---|---|
| `*ngFor` thay `@for` | ☐ | ☐ |
| Input không label | ☐ | ☐ |
| `setInterval` không cleanup | ☐ | ☐ |
| Phát hiện sai (false positive) | | |

```text
/code-review
```

Điền cột thứ hai. Thường thấy: `/code-review` mạnh về **bug đúng đắn** (rò rỉ interval), reviewer theo checklist mạnh về **quy ước team** và **a11y**.

## Bước 4 — Kiểm chứng "chỉ đọc"

```text
@"angular-reviewer (agent)" sửa luôn lỗi *ngFor giúp mình
```

Subagent không có `Edit`/`Write` → nó không sửa được và sẽ báo lại. Lưu ý: nó **có** `Bash` (để chạy `git diff`) — muốn chặt hơn, thay `Bash` bằng allow rule cụ thể hoặc để Claude chính pipe diff vào lời giao việc.

## Bước 5 — Cải thiện

Nếu reviewer bỏ sót một lỗi: thêm câu cụ thể hơn vào checklist (vd *"search for setInterval/setTimeout/addEventListener and verify each has cleanup"*), gọi lại và cập nhật bảng.

## Checklist hoàn thành

- [ ] Bảng so sánh điền đủ hai cột
- [ ] Reviewer bắt được ≥ 2/3 lỗi sau tối đa một lần cải thiện prompt
- [ ] Đã chứng minh reviewer không sửa được file
- [ ] Commit `.claude/agents/angular-reviewer.md`; xoá nhánh lab bằng `git checkout main && git branch -D lab08-review`

:::quiz Reviewer có `tools: Read, Glob, Grep, Bash`. Nó có sửa file được không?
- [ ] Có, qua Edit
- [x] Không qua công cụ sửa file (không có Edit/Write); nhưng vẫn có Bash — muốn chặt hơn thì bỏ Bash và đưa diff vào lời giao việc
- [ ] Có, mọi subagent sửa được file
- [ ] Chỉ sửa được file test

Bash vẫn có thể ghi file bằng lệnh shell, nên cân nhắc khi cần reviewer thật sự chỉ đọc.
:::

:::quiz Cách nào **chắc chắn** gọi đúng subagent `angular-reviewer`?
- [ ] Viết "hãy review"
- [x] @-mention: `@"angular-reviewer (agent)" …`
- [ ] Đặt tên file đặc biệt
- [ ] Dùng `/agents`

Gọi bằng lời thì Claude quyết định có giao việc hay không.
:::

:::quiz Vì sao subagent reviewer không thấy lịch sử hội thoại của bạn lại là **ưu điểm** ở đây?
- [ ] Vì tiết kiệm token tuyệt đối
- [x] Vì nó review như một người chưa thấy cách code được viết — không bị "thuyết phục" bởi lời giải thích trong hội thoại
- [ ] Vì subagent luôn dùng model mạnh hơn
- [ ] Không phải ưu điểm

Đó là lý do tài liệu khuyên dùng reviewer "fresh" cho review độc lập.
:::

:::exercise Thử thách mở rộng — reviewer chạy model rẻ
Đổi `model: haiku`, gọi lại trên cùng nhánh. So chất lượng phát hiện và `/usage` với bản `sonnet`. Khi nào bạn sẽ chọn haiku?
???
Thường thấy: haiku bắt tốt các mục cơ học trong checklist (`*ngFor`, input không label) và rẻ hơn, nhưng có thể bỏ sót lỗi cần suy luận (interval không cleanup qua nhiều dòng). Chọn haiku cho bước "soát quy ước" chạy thường xuyên; giữ sonnet/opus cho review trước merge hoặc vùng code rủi ro.
:::

> Nguồn: *Create custom subagents* — code.claude.com/docs/en/sub-agents; *Best practices* — "Review against your spec" (truy cập 11/11/2026).
