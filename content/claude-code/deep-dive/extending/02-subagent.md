---
title: Subagent — giao việc cho "đồng nghiệp" có context riêng
summary: Subagent chạy trong context window riêng và chỉ trả về tóm tắt. Ba subagent có sẵn Explore, Plan, general-purpose; tạo subagent của bạn trong .claude/agents; frontmatter tools, model, permissionMode, isolation; gọi tự động, bằng tên hay @-mention; chạy nền; và khi nào subagent không đáng tiền.
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, subagents, extending]
related: [claude-code/deep-dive/sessions/chi-phi-va-subagent, claude-code/deep-dive/extending/viet-skill]
---

## TL;DR

- Subagent = worker có **context riêng**, system prompt riêng, bộ công cụ riêng. Đọc 50 file trong đó không làm đầy hội thoại của bạn — chỉ tóm tắt quay về.
- Dùng khi: việc phụ sinh nhiều output, việc song song độc lập, cần reviewer **chưa thấy** cách code được viết, hoặc cần giao việc với **ít quyền** hơn.
- Không dùng để "có câu trả lời thông minh hơn" — cùng model, cùng việc thì không tốt hơn, chỉ tốn token hơn.

## Subagent có sẵn

| Tên | Công cụ | Dùng cho |
|---|---|---|
| **Explore** | Chỉ đọc (Write/Edit bị chặn) | Tìm file, tìm code, khám phá codebase; Claude chọn độ kỹ *quick / medium / very thorough* |
| **Plan** | Chỉ đọc | Nghiên cứu codebase trong plan mode |
| **general-purpose** | Mọi công cụ được phép | Việc nhiều bước cần cả khám phá lẫn sửa |

Explore và Plan **không nạp CLAUDE.md** lúc khởi động để nhanh và rẻ. Muốn Explore chạy model rẻ hơn: định nghĩa một subagent tên `Explore` của riêng bạn với `model: haiku` — nó ghi đè bản có sẵn.

## Tạo subagent

```md title=".claude/agents/angular-reviewer.md"
---
name: angular-reviewer
description: Reviews Angular changes against this repo's conventions. Use proactively after code changes in src/app.
tools: Read, Glob, Grep, Bash
model: sonnet
---
You are a senior Angular reviewer. Review the current diff (`git diff main...HEAD`).
Check: signal inputs/outputs instead of decorators, no subscriptions without cleanup,
no business logic in components (use facades), accessible templates (labels, roles).
Report only real problems as `file:line — problem — suggested fix`. Skip style nits.
```

- **Phần thân** là system prompt của subagent. Subagent chỉ nhận prompt này + thông tin môi trường cơ bản — **không** nhận lịch sử hội thoại của bạn, nên lời giao việc phải đủ ngữ cảnh.
- Hoặc nhờ Claude tạo: *"tạo subagent reviewer chỉ đọc cho dự án này"*; `/agents` nhắc cách quản lý.

### Phạm vi (trùng tên thì cao hơn thắng)

| Vị trí | Phạm vi | Ưu tiên |
|---|---|---|
| Managed settings | Tổ chức | 1 |
| `--agents '<json>'` | Phiên hiện tại | 2 |
| `.claude/agents/` | Dự án (commit cho team) | 3 |
| `~/.claude/agents/` | Mọi dự án của bạn | 4 |
| Plugin `agents/` | Nơi bật plugin | 5 |

### Frontmatter thường dùng

| Trường | Ý nghĩa |
|---|---|
| `name`, `description` | Bắt buộc. Description quyết định khi nào Claude tự giao việc — thêm "use proactively" để khuyến khích |
| `tools` / `disallowedTools` | Giới hạn công cụ (vd reviewer chỉ đọc). Bỏ `Agent` khỏi `tools` → không gọi được subagent lồng |
| `model` | `sonnet`, `opus`, `haiku`, `fable`, ID đầy đủ, hoặc `inherit` |
| `effort` | Effort riêng cho subagent |
| `permissionMode` | Chế độ quyền riêng |
| `maxTurns` | Giới hạn số lượt; hết lượt trả kết quả đánh dấu partial |
| `isolation: worktree` | Chạy trong git worktree tạm — bản sao riêng của repo |
| `skills` | Nạp sẵn skill vào context của subagent |
| `memory` | Bộ nhớ lâu dài riêng (`user`, `project`, `local`) |
| `background: true` | Luôn chạy nền |

## Gọi subagent

- **Tự động**: Claude giao việc dựa trên yêu cầu + `description`.
- **Bằng lời**: *"Dùng subagent angular-reviewer xem thay đổi của mình."*
- **@-mention** (chắc chắn chạy): gõ `@` rồi chọn, vd `@"angular-reviewer (agent)" xem phần auth`.
- **Cả phiên**: `claude --agent angular-reviewer` hoặc setting `agent`.

Subagent chạy nền thì bạn làm việc khác trong lúc chờ; `/tasks` xem việc nền, `Ctrl+X Ctrl+K` dừng mọi subagent nền.

## Khi nào **không** dùng

| Tình huống | Vì sao |
|---|---|
| Việc nhỏ cần context bạn vừa thảo luận | Subagent phải tự thu thập lại → tốn token và thời gian |
| Muốn "câu trả lời tốt hơn" | Cùng model, cùng việc → không tốt hơn |
| Các bước phụ thuộc chặt vào nhau | Song song không giúp gì; làm tuần tự trong hội thoại chính |

:::warning Sửa đổi của subagent và /rewind
Sửa đổi file do subagent thực hiện thường **không** được checkpoint của phiên chính khôi phục. Commit trước khi giao việc sửa hàng loạt, hoặc dùng `isolation: worktree`.
:::

:::senior Góc nhìn senior
Giá trị lớn nhất của subagent trong team là **review độc lập có giới hạn quyền**: một reviewer chỉ đọc, prompt bám spec và checklist của team, model vừa đủ. Viết lời giao việc như viết ticket cho người mới: mục tiêu, phạm vi, định dạng kết quả, tiêu chí xong — vì subagent không thấy hội thoại của bạn.
:::

:::quiz Bạn muốn một reviewer không thể sửa file. Cách chắc chắn nhất?
- [ ] Viết "đừng sửa file" trong system prompt
- [x] Giới hạn `tools: Read, Glob, Grep` (không có Edit/Write)
- [ ] Dùng model haiku
- [ ] Đặt `background: true`

Giới hạn công cụ là cơ chế cứng; lời dặn trong prompt là chỉ dẫn mềm.
:::

:::quiz Subagent tự định nghĩa của bạn trả lời như thể không biết gì về cuộc thảo luận 30 phút vừa rồi. Vì sao?
- [ ] Lỗi cấu hình
- [x] Subagent không nhận lịch sử hội thoại của phiên chính — chỉ nhận system prompt của nó và lời giao việc
- [ ] Do dùng model khác
- [ ] Do CLAUDE.md quá dài

Lời giao việc phải tự chứa đủ bối cảnh (fork mới là trường hợp kế thừa hội thoại).
:::

:::exercise Thiết kế subagent cho team
Thiết kế một subagent `test-writer` cho dự án Angular: description, tools, model, và system prompt ngắn. Nêu lý do cho từng lựa chọn.
???
`description: Writes and runs unit tests for Angular components/services. Use when the user asks for tests or after a feature is implemented.` `tools: Read, Glob, Grep, Edit, Write, Bash` (cần viết file test và chạy test). `model: sonnet` (việc có khuôn mẫu, không cần model lớn nhất). `maxTurns: 30` để chặn vòng lặp. System prompt: theo style các `.spec.ts` hiện có (Vitest/TestBed), test hành vi qua template/public API, không sửa code nguồn — nếu test fail vì code sai thì báo lại; chạy `npm test -- --watch=false` và trả về danh sách test + kết quả.
:::

> Nguồn: *Create custom subagents* — code.claude.com/docs/en/sub-agents; *Best practices* — mục "Know what subagents cost" (truy cập 11/11/2026).
