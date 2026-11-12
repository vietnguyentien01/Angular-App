---
title: Mở rộng Claude Code — CLAUDE.md, skill, subagent, hook, MCP, plugin
summary: Mỗi cơ chế mở rộng giải bài toán gì, nạp vào context lúc nào và tốn bao nhiêu, và thứ tự thêm dần theo "tín hiệu" thực tế thay vì cấu hình mọi thứ từ đầu.
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, skills, subagents, hooks, mcp, plugins]
related: [claude-code/review/memory/claude-md-ngan-gon, claude-code/consolidate/guardrails/hook-permission-sandbox]
---

## TL;DR

- Sáu cơ chế: CLAUDE.md (luôn nạp), skill (nạp khi cần), subagent (context riêng), hook (luôn chạy), MCP (công cụ ngoài), plugin (đóng gói).
- Thêm dần theo **tín hiệu** thực tế, không cấu hình mọi thứ từ đầu.
- Mỗi thứ có chi phí context khác nhau; các cơ chế ghép được với nhau.

## Mỗi thứ để làm gì

| Tính năng | Làm gì | Ví dụ |
|---|---|---|
| `CLAUDE.md` | Context nạp vào mọi phiên | "Dùng npm ci. Chạy test trước khi xong." |
| Skill | Kiến thức, quy trình dùng lại được; gọi bằng `/<tên>` hoặc Claude tự nạp khi phù hợp | `/release`, hướng dẫn viết API |
| Subagent | Một vòng làm việc tách biệt, chỉ trả về tóm tắt | Nghiên cứu đọc nhiều file, reviewer chỉ có quyền đọc |
| Hook | Script/HTTP/MCP tool chạy tại sự kiện vòng đời | Chạy ESLint sau mỗi lần sửa file |
| MCP | Kết nối dịch vụ bên ngoài | Issue tracker, database, trình duyệt |
| Plugin | Đóng gói skill + hook + subagent + MCP để dùng lại/chia sẻ | Bộ cấu hình chuẩn cho mọi repo Angular của team |

## Thêm dần theo tín hiệu

| Khi… | Thêm |
|---|---|
| Claude sai một quy ước/lệnh **hai lần** | Một dòng `CLAUDE.md` |
| Bạn gõ đi gõ lại cùng một prompt để bắt đầu task | Skill gọi bằng `/<tên>` |
| Dán cùng một quy trình nhiều bước lần thứ ba | Skill |
| Cứ phải chép dữ liệu từ hệ thống Claude không thấy | MCP server (hoặc CLI có sẵn như `gh`) |
| Một việc phụ làm ngập hội thoại bằng output không dùng lại | Subagent |
| Muốn điều gì đó xảy ra **mọi lần** mà không phải nhắc | Hook |
| Repo thứ hai cần đúng bộ cấu hình đó | Plugin |

## Chi phí context

| Tính năng | Nạp khi | Chi phí |
|---|---|---|
| `CLAUDE.md` | Đầu phiên, toàn bộ nội dung | Mọi request |
| Skill | Mô tả ở đầu phiên, nội dung khi dùng | Thấp (mô tả mọi request); `disable-model-invocation: true` → 0 cho tới khi gọi |
| MCP | Tên tool ở đầu phiên, schema khi cần | Thấp cho tới khi dùng |
| Subagent | Khi được tạo | Context riêng, tách khỏi phiên chính |
| Hook | Khi sự kiện xảy ra | 0, trừ khi hook trả output |

## Kết hợp các cơ chế

Các cơ chế không loại trừ nhau — chúng ghép được:

| Kết hợp | Cách | Dùng khi |
|---|---|---|
| Subagent nạp sẵn skill | Trường `skills:` trong frontmatter của subagent | Reviewer cần checklist chi tiết mà không nhồi vào system prompt |
| Skill chạy trong subagent | `context: fork` (+ `agent:`) trong SKILL.md | Skill đọc nhiều file — giữ hội thoại chính gọn |
| Hook gắn với skill/subagent | Trường `hooks:` trong frontmatter | Kiểm tra chỉ cần khi skill/agent đó chạy (vd chặn lệnh ghi khi chạy reviewer) |
| Subagent có MCP riêng | Trường `mcpServers:` | Chỉ agent tra cứu ticket mới cần MCP của Jira |
| Đóng gói tất cả | Plugin | Repo thứ hai cần cùng bộ |

## Một hệ thống hoàn chỉnh cho dự án Angular (ví dụ)

```text
CLAUDE.md                         ← lệnh test/build, 5–10 quy ước khác mặc định
.claude/rules/forms.md            ← paths: **/*.form.ts — quy ước Signal Forms
.claude/rules/testing.md          ← quy ước viết spec
.claude/skills/new-feature/       ← /new-feature: scaffold feature theo chuẩn
.claude/skills/verify/            ← công thức chạy app (do /verify ghi lại)
.claude/agents/angular-reviewer.md← reviewer chỉ đọc, checklist team
.claude/settings.json             ← allow lệnh kiểm tra; deny .env, file sinh ra; hooks:
                                     PostToolUse → Prettier; PreToolUse → bảo vệ file;
                                     Stop → test phải xanh
.mcp.json                         ← (nếu cần) issue tracker, chỉ quyền đọc mặc định
REVIEW.md                         ← chỉ dẫn cho Code Review trên PR
```

Thứ tự xây: CLAUDE.md → settings (permission) → hook format/bảo vệ → skill khi có prompt lặp lại → subagent reviewer → MCP khi cần → plugin khi có repo thứ hai. Thực hành từng bước ở Lab 02, 05–08, 12.

## Ví dụ: reviewer chỉ được đọc

```markdown title=".claude/agents/reviewer.md"
---
name: reviewer
description: Review file đã thay đổi so với spec. Dùng sau khi làm xong tính năng, trước khi mở PR.
tools: Read, Grep, Glob
---
Bạn review code mình không viết. So các file thay đổi với spec được đưa,
kiểm tra mọi yêu cầu đã được làm và các trường hợp biên có test,
chỉ báo lỗ hổng ảnh hưởng tính đúng đắn. Bỏ qua style.
```

Giới hạn `tools` được Claude Code thực thi — reviewer này **không thể** sửa file, kể cả khi bị yêu cầu.

:::senior Góc nhìn senior
Kiến trúc cấu hình Claude Code giống kiến trúc phần mềm: tách theo trách nhiệm (chỉ dẫn, quy trình, thực thi, tích hợp), giữ phần luôn-nạp nhỏ, đẩy chi tiết về nơi chỉ nạp khi cần, và đo chi phí bằng `/context`, `/skill-doctor`. Review cấu hình trong PR như review code.
:::

:::quiz Một quy trình release dài 40 bước nên đặt ở `CLAUDE.md` hay skill?
- [ ] `CLAUDE.md`, để Claude luôn nhớ
- [x] Skill — chỉ nạp khi cần, không đè nặng lên mọi task không liên quan; thêm `disable-model-invocation: true` vì có tác dụng phụ
- [ ] Hook
- [ ] MCP

Skill nhẹ hơn `CLAUDE.md` cho loại nội dung chỉ thỉnh thoảng mới cần.
:::

:::quiz Khác biệt cốt lõi giữa hook và skill?
- [ ] Không khác
- [x] Hook do Claude Code chạy khi sự kiện xảy ra (xác định); skill là chỉ dẫn Claude đọc và quyết định cách áp dụng
- [ ] Skill chạy nhanh hơn
- [ ] Hook chỉ dùng cho MCP

Rào chắn → hook; quy trình cần suy luận → skill.
:::

:::quiz Giao cùng một task cho subagent có cho câu trả lời "thông minh hơn" không?
- [ ] Có
- [x] Không — mặc định là cùng model (hoặc nhỏ hơn) làm cùng việc; lợi ích là song song, tách output ồn, hoặc có reviewer chưa thấy lập luận ban đầu
- [ ] Có nếu dùng Haiku
- [ ] Chỉ khi effort là `max`

Và subagent tốn thêm token vì có context riêng.
:::

:::exercise Chọn đúng cơ chế cho năm tín hiệu
Với mỗi tình huống, chọn cơ chế và viết phác thảo cấu hình: (1) Claude quên lệnh test lần thứ hai; (2) bạn dán cùng checklist release lần thứ ba; (3) tìm kiếm rộng làm ngập hội thoại; (4) cần format sau mỗi lần sửa; (5) cứ phải copy nội dung ticket Jira vào chat.
???
(1) Một dòng trong CLAUDE.md. (2) Skill `/release-check` (`disable-model-invocation: true`) — Lab 07. (3) Subagent (Explore có sẵn hoặc subagent chỉ đọc riêng) — Lab 08. (4) Hook PostToolUse — Lab 06. (5) MCP server của Jira (hoặc CLI nếu có) — Lab 12 cho cách thêm server và giới hạn quyền.
:::

> Nguồn: *Extend Claude Code* và *Best practices for Claude Code* — code.claude.com/docs (truy cập 11/11/2026).
