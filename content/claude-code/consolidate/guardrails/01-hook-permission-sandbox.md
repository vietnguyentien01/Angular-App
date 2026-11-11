---
title: Hook, permission và sandbox — cho những quy tắc không có ngoại lệ
summary: Stop hook bắt buộc typecheck, PostToolUse chạy formatter, deny rule chặn đọc .env, phạm vi áp dụng của từng file settings, và vì sao auto mode không phải hàng rào cứng.
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, hooks, permissions, sandbox]
related: [claude-code/consolidate/verification/cho-claude-phep-kiem-tra, claude-code/deep-dive/automation/bao-mat-va-quy-dinh-team]
---

## Khi nào dùng cơ chế bắt buộc?

> Nếu điều gì đó phải xảy ra **mọi lần**, hãy biến nó thành hook, deny rule hoặc managed setting. `CLAUDE.md` dành cho nguyên tắc, và Claude được phép quyết định một nguyên tắc không áp dụng.

Nhưng **đừng lạm dụng**: hook cho quy tắc *không có ngoại lệ nào*. "Ưu tiên named export" có nhiều ngoại lệ → để trong `CLAUDE.md`.

## Stop hook: không xong khi typecheck chưa pass

```json title=".claude/settings.json"
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "npx tsc --noEmit -p tsconfig.app.json 1>&2 || exit 2" }
        ]
      }
    ]
  }
}
```

Exit code `2` chặn việc kết thúc lượt; những gì in ra stderr được gửi lại cho Claude làm lý do. (Theo tài liệu, nếu hook chặn liên tiếp nhiều lần mà không có tool call nào ở giữa, Claude Code sẽ cho kết thúc để tránh vòng lặp.)

## PostToolUse: format sau mỗi lần sửa file

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "npx prettier --write --ignore-unknown \"$(jq -r '.tool_input.file_path')\"" }
        ]
      }
    ]
  }
}
```

## Permission: deny luôn thắng

```json
{
  "permissions": {
    "allow": ["Bash(npx tsc --noEmit *)"],
    "ask": ["Bash(git push *)"],
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
  }
}
```

- `deny` có hiệu lực ở **mọi** chế độ quyền, kể cả auto và `bypassPermissions`.
- Rule `Read` chặn cả `cat .env` (Claude Code nhận diện các lệnh đọc file phổ biến), nhưng **không** chặn một script tự mở file. Muốn giới hạn ở mức hệ điều hành: bật sandbox (`/sandbox`).

## Ai bị áp dụng?

| File | Phạm vi |
|---|---|
| `~/.claude/settings.json`, `.claude/settings.local.json` | Chỉ bạn |
| `.claude/settings.json` (commit vào repo) | Mọi người làm việc trong repo |
| Managed settings | Cả tổ chức — không file cá nhân nào ghi đè được; nơi duy nhất cho chính sách bảo mật của tổ chức |

:::warning Auto mode không phải hàng rào cứng
Auto mode dùng một model phân loại để đánh giá từng hành động — tốt, nhưng là phán đoán nên có thể sai. Các quy tắc "không bao giờ" phải nằm trong deny rule hoặc hook. Deny/ask rule và `PreToolUse` hook được áp dụng **trước** bộ phân loại.
:::

:::quiz Hook `Stop` trả exit code nào để buộc Claude làm tiếp?
- [ ] 0
- [ ] 1
- [x] 2
- [ ] 127

Stderr của lệnh được gửi lại cho Claude làm lý do chưa thể kết thúc.
:::

:::quiz Có `deny: ["Read(./.env)"]` nhưng Claude chạy một script Node tự đọc `.env`. Rule có chặn được không?
- [ ] Có, luôn luôn
- [x] Không — rule khớp tool call chứ không khớp ý định; cần sandbox để giới hạn ở mức hệ điều hành
- [ ] Có nếu bật auto mode
- [ ] Có nếu file nằm trong .gitignore

Với bảo mật, dùng cả deny rule lẫn sandbox.
:::

:::exercise Chuyển quy định team thành cấu hình
Team bạn có quy định: (1) bắt buộc pass unit test trước khi xong, (2) không bao giờ đọc file cấu hình chứa secret `src/environments/environment.prod.ts`, (3) ưu tiên Signal Forms cho form mới. Mỗi quy định đặt ở đâu?
???
1. Bắt buộc → `Stop` hook chạy test nhanh của phần bị ảnh hưởng (hoặc typecheck + test), exit 2 nếu fail; CI vẫn là chốt chặn cuối.
2. Không có ngoại lệ, liên quan bảo mật → `deny: ["Read(./src/environments/environment.prod.ts)"]` trong `.claude/settings.json` (commit cho cả team) + bật sandbox. Tốt hơn nữa: secret không nên nằm trong file của repo.
3. Có ngoại lệ (form cũ, thư viện chưa hỗ trợ) → một dòng trong `CLAUDE.md` hoặc `.claude/rules/forms.md`.
:::

> Nguồn: *Best practices for Claude Code* — mục "Enforce the rules that can't have exceptions" và "Change the permission mode", code.claude.com/docs (truy cập 11/11/2026).
