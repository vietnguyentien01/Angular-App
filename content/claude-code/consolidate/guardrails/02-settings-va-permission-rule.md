---
title: File settings và permission rule — ai bị áp dụng, cái gì thắng
summary: Bốn file settings (user, project, local, managed) và thứ tự ưu tiên; danh sách gộp thay vì ghi đè; cú pháp rule Bash(npm run *), Read(./.env), WebFetch(domain:…), mcp__server__*; thứ tự deny → ask → allow; và một bộ settings mẫu an toàn cho dự án Angular.
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, settings, permissions]
related: [claude-code/review/guardrails/che-do-quyen, claude-code/consolidate/guardrails/hook-permission-sandbox]
---

## TL;DR

- Ưu tiên cao → thấp: **managed → `--settings` (dòng lệnh) → `.claude/settings.local.json` → `.claude/settings.json` → `~/.claude/settings.json`**.
- Danh sách như `permissions.allow` được **gộp** từ mọi file, không ghi đè.
- Rule được xét theo **deny → ask → allow**; khớp đầu tiên quyết định. Allow **không** khoét ngoại lệ trong deny.

## Bốn file settings

| Phạm vi | File | Ảnh hưởng ai | Dùng cho |
|---|---|---|---|
| User | `~/.claude/settings.json` | Bạn, mọi dự án trên máy | Theme, model mặc định, rule cá nhân |
| Project | `.claude/settings.json` | Mọi người làm trong repo (khi commit) | Permission, hook, plugin, biến môi trường của team |
| Local | `.claude/settings.local.json` | Bạn, chỉ dự án này (Claude Code giữ ngoài git) | Ngoại lệ cá nhân, thử trước khi chia sẻ |
| Managed | `managed-settings.json`, MDM, hoặc server-managed từ admin console | Mọi người tổ chức triển khai | Chính sách bảo mật không ai ghi đè được |

- Cài Claude Code **không** tạo file settings nào; `/config` hoặc "Yes, don't ask again" sẽ tạo khi cần.
- `~/.claude.json` là file Claude Code tự ghi (tài khoản, MCP server phạm vi local/user…) — không cần sửa tay.
- Một số thứ trong file project (allow rule, hook) **chờ** mỗi người chấp nhận hộp thoại tin cậy thư mục; deny có hiệu lực ngay.
- `/status` → dòng *Setting sources* cho biết nguồn nào đang áp dụng.

## Đổi setting

- `/config` → tab Config: theme, editor mode, verbose… (hoặc `/config key=value`).
- Sửa file JSON trực tiếp.
- Một phiên: `claude --settings ./ci-settings.json`.
- Hoặc nhờ Claude: skill `/update-config` (vd *"/update-config cho phép chạy npm test không cần hỏi"*).

## Cú pháp permission rule

Dạng `Tool` hoặc `Tool(specifier)`.

| Rule | Khớp |
|---|---|
| `Bash` | Mọi lệnh Bash |
| `Bash(npm run build)` | Đúng lệnh `npm run build` (không khớp `npm run build --watch`) |
| `Bash(npm run *)` | `npm run build`, `npm run test --watch`… (không khớp `npm install`) |
| `Bash(git * main)` | `git merge main`, `git push origin main`… |
| `Read(./.env)` | Đọc `.env` ở thư mục hiện tại |
| `Read(./secrets/**)` | Đọc mọi thứ trong `secrets/` |
| `Edit(...)` | Áp cho mọi công cụ sửa file |
| `WebFetch(domain:angular.dev)` | Fetch tới angular.dev |
| `mcp__github__*` | Mọi tool của MCP server `github` |

:::warning Deny WebFetch không chặn được curl
Nếu Bash được phép, Claude vẫn có thể `curl`/`wget`. Muốn kiểm soát mạng thật: deny `curl`/`wget` trong Bash, chỉ allow WebFetch theo domain, hoặc dùng sandbox giới hạn mạng.
:::

## Thứ tự xét: deny → ask → allow

- `deny: ["Bash(aws *)"]` chặn cả `aws s3 ls` dù có `allow: ["Bash(aws s3 ls)"]`.
- Deny một **tên công cụ trần** (vd `"WebSearch"`) gỡ hẳn công cụ khỏi context của Claude.
- Rule do Claude Code thực thi, không phải model — lời dặn trong prompt không thay đổi được chúng.

## Bộ settings mẫu cho dự án Angular

```json title=".claude/settings.json (commit)"
{
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run build)",
      "Bash(npm test *)",
      "Bash(npx ng generate *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "WebFetch(domain:angular.dev)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(npm install *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Bash(npm publish *)"
    ]
  }
}
```

```json title=".claude/settings.local.json (cá nhân)"
{
  "permissions": {
    "allow": ["Bash(npm run e2e:local)"]
  }
}
```

Hai file gộp lại: team có allowlist chung, bạn thêm một lệnh riêng mà không cần commit.

:::senior Góc nhìn senior
Allowlist nên chứa lệnh **đọc** và lệnh **kiểm tra** (lint, test, build) — những thứ Claude cần chạy liên tục để tự xác minh. Lệnh có tác dụng ra bên ngoài (push, publish, deploy, cài package) để `ask` hoặc `deny`. Chính sách thật sự bắt buộc của tổ chức thì đưa lên managed settings, đừng trông vào file trong repo.
:::

:::quiz `.claude/settings.json` (team) đặt `"model": "sonnet"`, còn `.claude/settings.local.json` của bạn đặt `"model": "opus"`. Phiên của bạn dùng model nào?
- [ ] sonnet — file team thắng
- [x] opus — local có ưu tiên cao hơn project
- [ ] Tuỳ thứ tự đọc file
- [ ] Báo lỗi xung đột

Thứ tự: managed > dòng lệnh > local > project > user.
:::

:::quiz Có `deny: ["Bash(git push *)"]` và `allow: ["Bash(git push origin feature/*)"]`. Claude chạy `git push origin feature/x` thì sao?
- [ ] Được phép vì allow cụ thể hơn
- [x] Bị chặn — deny được xét trước, allow không khoét ngoại lệ trong deny
- [ ] Hỏi bạn
- [ ] Tuỳ permission mode

Độ cụ thể không đổi thứ tự deny → ask → allow.
:::

:::interview Team muốn mọi người tự động được chạy `npm test` nhưng không ai được đọc `.env`. Bạn cấu hình thế nào và ở đâu?
Trong `.claude/settings.json` commit vào repo: `allow: ["Bash(npm test *)"]`, `deny: ["Read(./.env)", "Read(./.env.*)"]`. Nhắc rằng allow chờ mỗi người tin cậy thư mục, deny có hiệu lực ngay. Nếu việc cấm đọc `.env` là chính sách bảo mật bắt buộc trên mọi máy → đưa vào managed settings; thêm sandbox để chặn cả lệnh Bash đọc file đó.
:::

:::exercise Viết settings cho repo của bạn
Liệt kê 5 lệnh Claude cần chạy thường xuyên để tự kiểm tra, 2 lệnh cần hỏi, 3 thứ phải chặn. Viết `.claude/settings.json` tương ứng và kiểm tra bằng `/permissions`.
???
Allow: lint, typecheck (`npx tsc --noEmit`), unit test, build, `git diff *`. Ask: `git push *`, `npm install *`. Deny: `Read(./.env*)`, `Read(./**/*.pem)`, `Bash(npm publish *)`. Mở `/permissions` để thấy từng rule và file nguồn; thử nhờ Claude đọc `.env` để xác nhận bị chặn.
:::

> Nguồn: *Settings files and precedence* — code.claude.com/docs/en/settings; *Configure permissions* — /permissions (truy cập 11/11/2026).
