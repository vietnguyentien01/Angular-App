---
title: Lệnh cấu hình — /config, /permissions, /memory, /init, /hooks, /mcp, /plugin, /skills, giao diện…
summary: "Giải thích từng lệnh thiết lập Claude Code: settings, quyền, bộ nhớ, hook, MCP, plugin, skill, subagent, output style, giao diện terminal, sandbox, IDE và Chrome, nhập cấu hình từ công cụ khác — kèm ví dụ cụ thể."
type: cheatsheet
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, commands, configuration, reference]
related: [claude-code/consolidate/guardrails/settings-va-permission-rule, claude-code/commands/commands/lenh-quy-trinh-code]
---

## Settings và quyền

### `/config [key=value ...]` — giao diện Settings

Alias `/settings`. Chỉnh theme, model, output style, editor mode (Vim)… Đặt trực tiếp không mở giao diện:

```text
/config theme=dark
/config model=sonnet
/config verbose=true
```

`/config --help` liệt kê các khoá dùng được. Dạng `key=value` không bật được setting cần xác nhận trong giao diện.

### `/permissions` — rule allow / ask / deny

Alias `/allowed-tools`. Xem rule theo phạm vi và file nguồn, thêm/xoá rule, quản lý thư mục làm việc, tab **Recently blocked** (hành động auto mode đã chặn) và tab **Auto mode** (rule của classifier). Đổi rule trong lúc Claude đang làm có hiệu lực từ lần gọi công cụ kế tiếp.

### `/update-config [request]` — nhờ Claude sửa settings.json

Skill có sẵn: mô tả bằng lời, Claude sửa đúng file settings.

```text
/update-config cho phép chạy npm test và npm run lint không cần hỏi, chặn đọc file .env
```

### `/fewer-permission-prompts` — giảm số lần bị hỏi

Skill quét transcript tìm lệnh Bash/MCP chỉ-đọc bạn hay duyệt, rồi thêm allowlist ưu tiên vào `.claude/settings.json` của dự án. Đọc kỹ danh sách trước khi đồng ý.

### `/auto-mode-setup` — chuẩn bị môi trường cho auto mode

Soạn mục `autoMode.environment` (hạ tầng "đáng tin" như repo, bucket, domain của bạn) từ dự án và phiên gần đây, cho bạn duyệt rồi lưu vào user settings — để classifier không chặn nhầm hạ tầng của chính bạn.

### `/sandbox` — bật/tắt sandbox cho lệnh shell

Chỉ trên nền tảng hỗ trợ (macOS, Linux, WSL2). Chọn chế độ auto-allow hoặc regular.

## Bộ nhớ và chỉ dẫn

### `/init` — tạo `CLAUDE.md`

Phân tích codebase, tạo file với lệnh build/test và quy ước; đã có thì gợi ý cải thiện. Đặt `CLAUDE_CODE_NEW_INIT=1` để có luồng tương tác nhiều bước (gồm cả skill, hook, memory cá nhân). Nếu thấy cấu hình Codex/Gemini CLI, đề nghị mang sang bằng `/import`.

### `/memory` — sửa CLAUDE.md, quản lý auto memory

Liệt kê các file CLAUDE.md/CLAUDE.local.md theo phạm vi (kể cả file chưa tồn tại), mở bằng editor, bật/tắt auto memory, xem thư mục auto memory.

### `/output-style [style]` — đổi phong cách trả lời

```text
/output-style
/output-style learning
/output-style concise
```

Có sẵn: Default, Proactive, Concise, Explanatory, Learning.

## Mở rộng

### `/hooks` — xem hook đang hoạt động

Dùng để xác nhận hook đã được nạp đúng sự kiện và matcher.

### `/mcp [reconnect|enable|disable] [<server>|all]` — quản lý MCP server

Không đối số → danh sách tương tác (trạng thái, OAuth, duyệt server từ `.mcp.json`).

```text
/mcp
/mcp reconnect all
/mcp disable figma
```

### `/plugin [subcommand]` — quản lý plugin

Menu có các tab Discover, Installed, Marketplaces; hoặc dùng subcommand:

```text
/plugin install commit-commands@claude-plugins-official
/plugin marketplace add your-org/plugins
/plugin list
```

### `/reload-plugins [--force]` — nạp lại plugin không cần khởi động lại

Nếu việc nạp lại làm đổi bộ MCP tool (mất prompt cache), lệnh cảnh báo và bỏ qua trừ khi có `--force`.

### `/plugin-authoring` — nạp tài liệu để Claude viết một *mod* (plugin có hooks module)

### `/skills` — danh sách skill

Gõ để lọc; `t` sắp theo số token; `Space`/`Enter` đổi trạng thái hiển thị của skill với Claude và menu `/`; `Esc` lưu và đóng.

### `/reload-skills` — quét lại thư mục skill

Dùng sau khi bạn thêm/sửa skill trên đĩa giữa phiên.

### `/skill-doctor` — skill nào tốn context mà ít dùng

### `/agents` — nhắc cách tạo/quản lý subagent

Ở bản hiện tại chỉ in lời nhắc: nhờ Claude tạo subagent hoặc sửa trực tiếp `.claude/agents/`, `~/.claude/agents/`.

### `/list-agents` — liệt kê subagent, teammate và phiên khác Claude nhắn tin được

Alias `/peers`. Chỉ có khi bật cross-session messaging.

### `/import [codex|gemini|cursor] [--dry-run] [--yes]` — mang cấu hình từ công cụ khác

Nhập file chỉ dẫn, MCP server, command, subagent, skill từ OpenAI Codex, Gemini CLI hoặc Cursor trên máy. `--dry-run` để xem trước.

```text
/import cursor --dry-run
```

## Giao diện terminal

| Lệnh | Làm gì |
|---|---|
| `/theme` | Đổi theme: `auto` theo nền terminal, sáng/tối, theme cho người mù màu (daltonized), ANSI, theme tự tạo |
| `/color [color\|default]` | Màu thanh prompt của phiên (`red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`) — tiện phân biệt nhiều terminal |
| `/statusline` | Cấu hình status line; mô tả bằng lời hoặc để tự cấu hình theo prompt shell |
| `/keybindings` | Mở file phím tắt tuỳ chỉnh |
| `/terminal-setup` | Cài `Shift+Enter` xuống dòng cho VS Code, Cursor, Devin Desktop, Alacritty, Zed; Apple Terminal: bật `Option+Enter`; iTerm2: bật quyền clipboard cho `/copy` |
| `/tui [default\|fullscreen]` | Chọn renderer và khởi động lại với hội thoại giữ nguyên; `fullscreen` là renderer không nháy |
| `/focus` | (Fullscreen) chỉ hiện prompt cuối, tóm tắt một dòng các lần gọi công cụ, và câu trả lời cuối |
| `/scroll-speed` | (Fullscreen) chỉnh tốc độ cuộn chuột |
| `/voice [hold\|tap\|off]` | Nhập bằng giọng nói (cần tài khoản Claude.ai) |

## Tích hợp và môi trường

| Lệnh | Làm gì |
|---|---|
| `/ide` | Quản lý kết nối với IDE (VS Code, JetBrains) và xem trạng thái |
| `/chrome` | Cấu hình Claude in Chrome |
| `/remote-env` | Chọn cloud environment mặc định cho phiên cloud tạo từ CLI |
| `/web-setup` | Kết nối GitHub cho cloud session bằng thông tin đăng nhập `gh` cục bộ |
| `/install-slack-app` | Cài Claude Slack app (OAuth trên trình duyệt) |

:::quiz Bạn vừa tạo skill mới trong `.claude/skills/` giữa phiên nhưng `/` chưa thấy. Lệnh nào?
- [ ] `/reload-plugins`
- [x] `/reload-skills`
- [ ] `/init`
- [ ] `/hooks`

`/reload-plugins` dành cho plugin.
:::

:::quiz Bạn muốn Claude sửa `settings.json` để cho phép `npm test` mà không phải tự viết JSON. Lệnh nào?
- [ ] `/config npm=allow`
- [x] `/update-config cho phép chạy npm test không cần hỏi`
- [ ] `/memory`
- [ ] `/output-style`

`/config` dành cho các tuỳ chọn như theme, model; `/update-config` dành cho permission, env, hook.
:::

:::exercise Thiết lập môi trường làm việc của bạn
Trong 20 phút: (1) `/config` đổi theme hợp terminal; (2) `/terminal-setup` nếu bạn dùng terminal VS Code; (3) `/statusline hiện model, thư mục và % context`; (4) `/color green` cho terminal dự án chính; (5) `/permissions` thêm allow cho lệnh test của dự án; (6) `/output-style` thử Explanatory với một câu hỏi.
???
Kiểm tra sau khi làm: status line hiển thị đúng ba thông tin; mở terminal thứ hai với `/color purple` để phân biệt; `/permissions` hiện rule mới với file nguồn (thường `.claude/settings.local.json` nếu thêm từ hộp thoại cá nhân, hoặc file bạn chọn); với Explanatory, câu trả lời có thêm các khối Insight. Về lại bằng `/output-style default`.
:::

> Nguồn: *Commands*, *Settings*, *Configure permissions*, *Output styles*, *Customize your status line*, *Configure your terminal* — code.claude.com/docs (truy cập 11/11/2026).
