---
title: Viết skill — SKILL.md, frontmatter, đối số, context động, file hỗ trợ
summary: "Skill là quy trình hoặc kiến thức đóng gói, chỉ nạp khi được gọi hay khi liên quan. Tạo skill đầu tiên, chọn nơi lưu, frontmatter quan trọng, đối số và context động bằng lệnh shell, file hỗ trợ, context: fork — kèm skill mẫu cho dự án Angular."
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, skills, extending]
related: [claude-code/deep-dive/guardrails/mo-rong-claude-code, claude-code/deep-dive/extending/subagent]
---

## TL;DR

- Skill = thư mục có `SKILL.md`: **frontmatter** (khi nào dùng) + **nội dung** (Claude làm gì).
- Claude chỉ thấy **mô tả** của skill ở đầu phiên; nội dung đầy đủ nạp khi skill được dùng → rẻ hơn nhiều so với nhồi vào CLAUDE.md.
- Gọi bằng `/ten-skill` hoặc để Claude tự gọi khi câu hỏi khớp `description`. Skill có tác dụng phụ (deploy, commit) → `disable-model-invocation: true`.

## Khi nào nên viết skill?

- Bạn gõ cùng một prompt mở đầu task lần thứ ba.
- Bạn dán cùng một playbook/quy trình nhiều bước vào chat.
- Một phần chỉ dẫn chỉ cần cho một loại việc (tạo component, viết migration) — không nên ở CLAUDE.md mọi phiên.

## Skill đầu tiên

```bash
mkdir -p ~/.claude/skills/summarize-changes
```

```md title="~/.claude/skills/summarize-changes/SKILL.md"
---
description: Summarizes uncommitted changes and flags anything risky. Use when the user asks what changed, wants a commit message, or asks to review their diff.
---

## Current changes

!`git diff HEAD`

## Instructions

Summarize the changes above in two or three bullet points, then list any risks you notice such as missing error handling, hardcoded values, or tests that need updating. If the diff is empty, say there are no uncommitted changes.
```

Dòng `` !`git diff HEAD` `` là **dynamic context injection**: Claude Code chạy lệnh và thay dòng đó bằng output **trước khi** Claude đọc skill. Thử: sửa một file, hỏi *"What did I change?"* (Claude tự gọi) hoặc gõ `/summarize-changes`.

## Lưu ở đâu?

| Vị trí | Đường dẫn | Có hiệu lực |
|---|---|---|
| Cá nhân | `~/.claude/skills/<ten>/SKILL.md` | Mọi dự án trên máy bạn |
| Dự án | `.claude/skills/<ten>/SKILL.md` | Repo này — commit để team dùng chung |
| Lồng trong thư mục | `<thu-muc>/.claude/skills/<ten>/SKILL.md` | Khi làm việc trong thư mục đó (monorepo) |
| Plugin | `<plugin>/skills/<ten>/SKILL.md` | Nơi bật plugin, gọi bằng `/plugin:ten` |
| Tổ chức | Thư mục managed settings | Mọi người được triển khai |

Định dạng cũ `.claude/commands/<ten>.md` vẫn chạy.

## Frontmatter quan trọng

| Trường | Ý nghĩa |
|---|---|
| `description` | **Quan trọng nhất**: skill làm gì và *khi nào dùng* — Claude dựa vào đây để tự gọi. Đặt từ khoá ở đầu |
| `when_to_use` | Bổ sung cụm từ kích hoạt (cùng description bị giới hạn 1.536 ký tự trong danh sách) |
| `name` | Tên lệnh trong menu `/`; mặc định là tên thư mục |
| `argument-hint` | Gợi ý đối số khi autocomplete, vd `[component-name]` |
| `disable-model-invocation: true` | Chỉ bạn gọi được — cho việc có tác dụng phụ |
| `user-invocable: false` | Chỉ Claude gọi — kiến thức nền, không phải lệnh |
| `allowed-tools` | Công cụ được dùng không cần hỏi **trong lượt gọi skill** |
| `model`, `effort` | Đổi model/effort cho phần còn lại của lượt |
| `context: fork` (+ `agent`) | Chạy skill trong subagent riêng |
| `paths` | Chỉ tự kích hoạt khi làm việc với file khớp glob |

## Đối số

| Biến | Giá trị |
|---|---|
| `$ARGUMENTS` | Toàn bộ đối số sau tên skill |
| `$0`, `$1`… (= `$ARGUMENTS[0]`…) | Đối số theo vị trí, bắt đầu từ 0 |
| `$ten` | Đối số có tên khai báo trong `arguments` |
| `${CLAUDE_SKILL_DIR}` | Thư mục chứa `SKILL.md` — dùng để gọi script đi kèm |
| `${CLAUDE_PROJECT_DIR}` | Gốc dự án |

## Skill mẫu cho dự án Angular

```md title=".claude/skills/ng-feature/SKILL.md"
---
description: Scaffold a new lazy-loaded Angular feature following this repo's conventions. Use when the user asks to create a new feature, page or route.
argument-hint: [feature-name]
arguments: [feature]
allowed-tools: Bash(npx ng generate *) Bash(npm test *)
---

## Current routes

!`cat src/app/app.routes.ts`

## Steps

1. Generate `src/app/features/$feature/` with `npx ng generate component features/$feature/$feature-page`.
2. Follow the structure in [conventions.md](conventions.md): page component + facade + data-access service.
3. Add a lazy route `loadComponent` for `$feature` to `app.routes.ts`.
4. Write a test for the page's loading / empty / error states.
5. Run `npm test -- --watch=false` and report the result.
```

`conventions.md` nằm cùng thư mục và chỉ được đọc khi cần — giữ `SKILL.md` ngắn, chi tiết để ở file hỗ trợ.

## Chạy trong subagent: `context: fork`

Thêm `context: fork` (và `agent: Explore` chẳng hạn) để skill chạy trong subagent cách ly: subagent nhận nội dung skill làm prompt, không thấy hội thoại của bạn, chạy nền và trả kết quả về khi xong. Hợp với skill nghiên cứu/đọc nhiều file.

## Quản lý và chi phí

- `/skills` liệt kê (phím `t` sắp theo token); `/skill-doctor` cho biết mỗi skill tốn bao nhiêu context và dùng thường xuyên không.
- Sửa skill trên đĩa khi đang chạy: `/reload-skills`.
- Mô tả của mọi skill Claude có thể tự gọi luôn nằm trong context — đừng cài skill không dùng.

:::senior Góc nhìn senior
Skill tốt giống một runbook tốt: mục tiêu rõ, bước kiểm tra cuối cùng, dữ liệu sống bơm vào bằng `` !`lệnh` `` thay vì để Claude đoán. Viết `description` theo cách **người dùng sẽ hỏi**, không theo tên nội bộ — skill không được gọi thường do description không khớp cách hỏi. Version hoá skill trong repo và review như code.
:::

:::quiz Skill `/deploy-staging` có tác dụng phụ. Bạn muốn chỉ người dùng mới gọi được. Trường nào?
- [ ] `user-invocable: false`
- [x] `disable-model-invocation: true`
- [ ] `context: fork`
- [ ] `paths: ["deploy/**"]`

`user-invocable: false` làm ngược lại — chỉ Claude gọi được.
:::

:::quiz Dòng `` !`git log --oneline -5` `` trong SKILL.md làm gì?
- [ ] Claude được gợi ý nên chạy lệnh này
- [x] Claude Code chạy lệnh trước và thay dòng đó bằng output, nên skill đến tay Claude đã kèm dữ liệu thật
- [ ] Lệnh chạy sau khi skill xong
- [ ] Chỉ là comment

Dynamic context injection giúp câu trả lời dựa trên trạng thái thật của repo.
:::

:::exercise Viết skill cho một việc bạn làm mỗi tuần
Chọn một việc lặp lại (tạo component theo chuẩn team, viết release note từ commit, chuẩn bị PR). Viết `SKILL.md` có description theo cách bạn sẽ hỏi, một dòng `` !`lệnh` `` bơm dữ liệu, các bước và bước kiểm tra cuối.
???
Ví dụ release note: `description: Draft release notes from commits since the last tag. Use when the user asks for release notes or a changelog.` + `` !`git log $(git describe --tags --abbrev=0)..HEAD --oneline` `` + bước: nhóm theo feat/fix/chore, bỏ commit nội bộ, viết tiếng Việt cho người dùng cuối, liệt kê breaking change đầu tiên; kiểm tra: mỗi commit feat/fix xuất hiện đúng một lần. Đặt `disable-model-invocation: true` nếu bạn chỉ muốn gọi thủ công.
:::

> Nguồn: *Extend Claude with skills* — code.claude.com/docs/en/skills; *Extend Claude Code* — /features-overview (truy cập 11/11/2026).
