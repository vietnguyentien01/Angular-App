---
title: Hook thực chiến — sự kiện, matcher, exit code, và các hook nên có
summary: Hook là lệnh Claude Code chạy tại các thời điểm trong vòng đời phiên, nên luôn chạy — không phụ thuộc model có nhớ hay không. Các sự kiện chính, cấu trúc cấu hình, matcher và trường if, ý nghĩa exit 0/2, các loại hook (command, prompt, agent, http) và bộ hook mẫu cho dự án Angular.
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, hooks, automation, extending]
related: [claude-code/consolidate/guardrails/hook-permission-sandbox, claude-code/consolidate/getting-started/khi-gap-su-co]
---

## TL;DR

- Hook = **deterministic**: luôn chạy ở sự kiện đã đăng ký. Dùng cho thứ "lần nào cũng phải xảy ra" — format, chặn file nhạy cảm, bắt buộc test pass, thông báo.
- Cấu hình dưới khoá `"hooks"` trong file settings: **sự kiện → matcher → danh sách hook**.
- Script đọc JSON từ **stdin**; **exit 0** = không quyết định gì (luồng quyền bình thường), **exit 2** = chặn, stderr thành phản hồi cho Claude.

## Sự kiện hay dùng

| Sự kiện | Khi nào | Ví dụ dùng |
|---|---|---|
| `SessionStart` | Phiên bắt đầu/resume (matcher: `startup`, `resume`, `clear`, `compact`) | Bơm lại bối cảnh sau compact |
| `UserPromptSubmit` | Bạn gửi prompt, trước khi Claude xử lý | Thêm ngữ cảnh, chặn prompt chứa secret |
| `PreToolUse` | Trước khi chạy một công cụ — **chặn được** | Chặn sửa `.env`, chặn lệnh nguy hiểm |
| `PermissionRequest` | Khi cần quyết định quyền | Tự duyệt một số lệnh an toàn |
| `PostToolUse` | Sau khi công cụ chạy thành công | Chạy Prettier/ESLint sau khi sửa file |
| `Notification` | Claude Code gửi thông báo (chờ quyền, đang rảnh…) | Thông báo desktop khi Claude cần bạn |
| `Stop` | Claude trả lời xong | Bắt buộc typecheck/test pass mới được dừng |
| `SubagentStart` / `SubagentStop` | Subagent bắt đầu/kết thúc | Ghi log |
| `PreCompact` / `PostCompact` | Quanh lúc compact | Lưu trạng thái |
| `ConfigChange` | File cấu hình thay đổi trong phiên | Audit thay đổi settings |
| `SessionEnd` | Phiên kết thúc | Dọn dẹp (ngân sách thời gian rất ngắn) |

Còn nhiều sự kiện khác (`FileChanged`, `CwdChanged`, `WorktreeCreate`, `PostToolUseFailure`…) — xem trang *Hooks reference*.

## Cấu trúc cấu hình

```json title=".claude/settings.json"
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write" }
        ]
      }
    ]
  }
}
```

- `matcher`: **một chuỗi**, phân biệt hoa thường; nhiều tool nối bằng `|`; `mcp__.*` cho mọi tool MCP.
- `if`: lọc theo cú pháp permission rule để hook chỉ chạy khi khớp cả tool **và** đối số, vd `"if": "Bash(git *)"`.
- Script đặt trong repo: dùng `"$CLAUDE_PROJECT_DIR"/.claude/hooks/ten.sh` và `chmod +x`.
- Nơi đặt: `~/.claude/settings.json` (mọi dự án), `.claude/settings.json` (team), `.claude/settings.local.json` (cá nhân), managed, plugin, hoặc frontmatter của skill/subagent.

## Input và output

Hook nhận JSON qua stdin, gồm các trường chung (session, `cwd`…) và trường theo sự kiện, vd `tool_name`, `tool_input.file_path`, `tool_input.command`.

| Exit | Ý nghĩa |
|---|---|
| `0` | Không có quyết định. Với `PreToolUse`, lệnh **vẫn đi qua luồng quyền bình thường** (exit 0 không phải "duyệt") |
| `2` | Chặn (với sự kiện chặn được). Ghi lý do ra **stderr** → Claude nhận làm phản hồi để điều chỉnh |
| Khác | Thường là lỗi không chặn: hành động vẫn chạy, transcript hiện thông báo hook error |

Muốn điều khiển chi tiết hơn: in **JSON có cấu trúc** ra stdout (vd quyết định allow/deny/ask, `additionalContext`).

## Bộ hook mẫu cho dự án Angular

**1. Chặn sửa file nhạy cảm (PreToolUse)**

```bash title=".claude/hooks/protect-files.sh"
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
PROTECTED=(".env" "package-lock.json" ".git/" "src/environments/environment.prod.ts")
for p in "${PROTECTED[@]}"; do
  if [[ "$FILE_PATH" == *"$p"* ]]; then
    echo "Blocked: $FILE_PATH is protected ($p). Ask the user instead." >&2
    exit 2
  fi
done
exit 0
```

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh" }] }
    ]
  }
}
```

**2. Format sau mỗi lần sửa (PostToolUse)** — như ví dụ Prettier ở trên. `PostToolUse` **không hoàn tác** được hành động đã chạy.

**3. Bơm lại quy ước sau compact (SessionStart + `compact`)**

```json
{
  "hooks": {
    "SessionStart": [
      { "matcher": "compact",
        "hooks": [{ "type": "command", "command": "echo 'Reminder: Angular 22 zoneless, signals; run npm test -- --watch=false before finishing.'; git log --oneline -5" }] }
    ]
  }
}
```

Stdout của hook `SessionStart` được thêm vào context của Claude.

**4. Không được dừng khi test còn đỏ (Stop)** — xem bài *Hook, permission và sandbox* (Stop hook exit 2 khi typecheck/test fail).

## Các loại hook

| `type` | Làm gì | Timeout mặc định |
|---|---|---|
| `command` | Chạy lệnh shell | 10 phút |
| `http` | Gửi request tới một endpoint | 10 phút |
| `prompt` | Gửi prompt + input cho một model, nhận `{"ok": true/false, "reason"}` — cho quyết định cần phán đoán | 30 giây |
| `agent` | Một subagent kiểm tra (thử nghiệm) | 60 giây |

## Giới hạn và an toàn

- Hook chỉ giao tiếp qua stdout/stderr/exit code; không gọi được slash command hay tool.
- Hook chạy **với quyền của bạn** — review hook trong repo lạ trước khi tin cậy thư mục.
- Stdout của shell profile (`.zshrc` in ra chữ) có thể làm hỏng JSON output của hook.
- Mỗi hook là một thứ cần bảo trì và thỉnh thoảng chặn nhầm — giữ tập hook **nhỏ**.

:::senior Góc nhìn senior
Phân loại quy định team: cái gì "không có ngoại lệ" (không sửa file prod config, test phải xanh, format chuẩn) → hook; cái gì cần phán đoán (đặt tên, pattern kiến trúc) → CLAUDE.md/skill. Đừng biến hook thành nơi chứa sở thích — một hook chặn nhầm mỗi ngày làm cả team mất niềm tin vào công cụ.
:::

:::quiz Hook `PreToolUse` của bạn `exit 0` cho lệnh `git push`. Lệnh có chạy ngay không cần hỏi không?
- [ ] Có, exit 0 nghĩa là duyệt
- [x] Không nhất thiết — exit 0 là "không quyết định", lệnh vẫn đi qua luồng permission bình thường
- [ ] Không, exit 0 là chặn
- [ ] Tuỳ model

Muốn duyệt thì trả JSON quyết định allow, hoặc thêm allow rule.
:::

:::quiz Bạn muốn sau mỗi lần Claude sửa file `.ts`, ESLint tự chạy. Sự kiện và matcher nào?
- [ ] `Stop` với matcher `"*.ts"`
- [x] `PostToolUse` với matcher `"Edit|Write"` (lọc đuôi `.ts` trong script)
- [ ] `SessionStart` với matcher `"startup"`
- [ ] `PreToolUse` với matcher `"eslint"`

Matcher của sự kiện công cụ khớp **tên công cụ**, không khớp tên file.
:::

:::exercise Viết hook thông báo khi Claude cần bạn
Bạn hay chuyển sang việc khác và không biết Claude đang chờ duyệt quyền. Viết hook gửi thông báo desktop.
???
Dùng sự kiện `Notification` (matcher có thể là `permission_prompt` hoặc `idle_prompt`, hoặc bỏ trống để nhận mọi loại). macOS: `"command": "osascript -e 'display notification \"Claude Code cần bạn\" with title \"Claude Code\"'"`; Linux: `notify-send 'Claude Code' 'Claude Code cần bạn'`. Đặt trong `~/.claude/settings.json` vì đây là sở thích cá nhân, không phải quy định team. Kiểm tra bằng `/hooks`.
:::

> Nguồn: *Automate actions with hooks* — code.claude.com/docs/en/hooks-guide; *Hooks reference* — /hooks; *Debug your configuration* (truy cập 11/11/2026).
