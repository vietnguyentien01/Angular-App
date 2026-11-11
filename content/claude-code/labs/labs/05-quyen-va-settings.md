---
title: "Lab 05 — Quyền và settings: allowlist cho lệnh kiểm tra, chặn file bí mật, thử từng permission mode"
summary: "Tạo .env giả trong cc-lab, viết .claude/settings.json với allow/ask/deny, chứng minh deny chặn được còn lời dặn trong CLAUDE.md thì không, dùng /permissions để đọc rule và nguồn, rồi chạy cùng một task ở Manual, acceptEdits, plan và auto để cảm nhận khác biệt."
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, lab, permissions, settings]
related: [claude-code/consolidate/guardrails/settings-va-permission-rule, claude-code/review/guardrails/che-do-quyen]
---

## Mục tiêu

- Claude chạy test/build **không phải hỏi**; push và cài package **phải hỏi**; đọc `.env` **bị chặn**.
- Hiểu bằng trải nghiệm: rule do Claude Code thực thi, lời dặn chỉ là gợi ý.

**Thời gian:** 40 phút.

## Bước 1 — Tạo "bí mật" giả

```bash
cd cc-lab
echo "API_TOKEN=fake-token-for-lab-only" > .env
echo ".env" >> .gitignore
```

## Bước 2 — Lời dặn mềm không phải hàng rào

Thêm vào `CLAUDE.md`: `- Không đọc file .env.` Mở phiên **Manual mode**:

```bash
claude --permission-mode default -n "lab05"
```

```text
Đọc file .env và cho mình biết có biến gì.
```

Quan sát: Claude có thể từ chối vì lời dặn, hoặc vẫn xin quyền/đọc. Dù thế nào, đây **không** phải đảm bảo. Xoá dòng vừa thêm khỏi CLAUDE.md.

## Bước 3 — Viết settings của team

```json title=".claude/settings.json"
{
  "permissions": {
    "allow": [
      "Bash(npm test *)",
      "Bash(npx ng build *)",
      "Bash(npx ng build)",
      "Bash(git status)",
      "Bash(git diff *)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(npm install *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)"
    ]
  }
}
```

Thoát và mở lại phiên (hoặc tiếp tục — đổi rule có hiệu lực từ lần gọi công cụ kế tiếp), rồi:

```text
/permissions
```

Tìm 3 nhóm rule và cột **nguồn** (`.claude/settings.json`).

## Bước 4 — Kiểm chứng từng rule

| Thử | Kỳ vọng |
|---|---|
| *"Chạy npm test -- --watch=false"* | Chạy luôn, không hỏi |
| *"Đọc .env"* | Bị chặn bởi deny |
| *"Cài thư viện date-fns"* | Hỏi bạn (ask) — chọn **No** kèm ghi chú "không thêm thư viện" bằng `Tab` |
| *"Chạy npx ng lint"* (không có trong allow) | Hỏi bạn — thử chọn **Yes, and don't ask again** rồi mở `.claude/settings.local.json` xem rule mới |

:::warning Bash vẫn có thể đọc .env
Deny `Read(./.env)` chặn **công cụ Read**. Một lệnh như `cat .env` qua Bash vẫn cần được kiểm soát riêng — ở Manual mode nó sẽ hỏi bạn; muốn chặn cả đường shell thì thêm deny cho Bash hoặc bật sandbox với `denyRead` (Lab nâng cao).
:::

## Bước 5 — Cùng một task, bốn chế độ

Task (sau mỗi lần: `git checkout . && git clean -fd src`):

```text
Thêm hàm countByStatus(tasks) vào task-filter.ts trả về { todo, doing, done }, có test, chạy test.
```

| Chế độ | Khởi động | Bạn phải bấm duyệt bao nhiêu lần? | Cảm nhận |
|---|---|---|---|
| Manual | `claude --permission-mode default` | | |
| acceptEdits | `claude --permission-mode acceptEdits` | | |
| plan | `claude --permission-mode plan` | | Kế hoạch trước, duyệt rồi mới sửa |
| auto | `claude --permission-mode auto` | | Thường gần như không hỏi; xem `/permissions` → Recently blocked |

## Bước 6 — Commit settings của team

Commit `.claude/settings.json`. **Không** commit `.claude/settings.local.json` (Claude Code tự đưa nó ra ngoài git) và `.env`.

## Checklist hoàn thành

- [ ] Test/build chạy không hỏi; `npm install` và `git push` luôn hỏi; Read `.env` bị chặn
- [ ] Đã thấy rule "don't ask again" được ghi vào `.claude/settings.local.json`
- [ ] Điền đủ bảng bốn chế độ ở Bước 5
- [ ] Giải thích được vì sao deny Read chưa đủ để bảo vệ `.env` tuyệt đối

:::quiz Bạn thêm `allow: ["Bash(git push origin feature/*)"]` vào local settings, còn file team có `ask: ["Bash(git push *)"]`. `git push origin feature/x` sẽ thế nào?
- [ ] Chạy luôn vì allow cụ thể hơn
- [x] Vẫn hỏi — thứ tự xét là deny → ask → allow, ask khớp trước
- [ ] Bị chặn
- [ ] Báo lỗi cấu hình

Độ cụ thể không đổi thứ tự xét rule.
:::

:::exercise Thử thách mở rộng — chặn cả đường shell
Làm cho cả `cat .env` qua Bash cũng không đọc được, bằng một trong hai cách: deny rule cho Bash hoặc sandbox. Kiểm chứng bằng cách nhờ Claude `cat .env`.
???
Cách 1 (đơn giản, không tuyệt đối): thêm deny `"Bash(cat .env*)"` — nhưng rule Bash khớp **chuỗi lệnh**, `head .env` hay `less .env` vẫn lọt. Cách 2 (chắc hơn): bật sandbox và thêm `"sandbox": { "enabled": true, "filesystem": { "denyRead": ["./.env"] } }` (hoặc dùng `sandbox.credentials.files`) — lệnh shell chạy trong sandbox không đọc được file đó dù dùng lệnh gì. Sandbox chạy trên macOS, Linux, WSL2. Kiểm chứng xong, xoá `.env` giả.
:::

> Nguồn: *Configure permissions*, *Choose a permission mode*, *Settings files and precedence*, *Configure the sandboxed Bash tool* — code.claude.com/docs (truy cập 11/11/2026).
