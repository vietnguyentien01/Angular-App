---
title: Lệnh claude trên shell — khởi động, auth, cập nhật, phiên nền, mcp, plugin, auto-mode, purge…
summary: "Giải thích mọi lệnh con của claude chạy trên terminal: mở/tiếp tục phiên, hỏi một lần, cài và cập nhật, đăng nhập và token cho CI, chẩn đoán, quản lý phiên nền và daemon, MCP server, plugin và marketplace, auto mode, xoá dữ liệu cục bộ, Remote Control, ultrareview."
type: cheatsheet
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, cli, commands, reference]
related: [claude-code/commands/commands/flag-dong-lenh, claude-code/deep-dive/automation/headless-va-ci]
---

## Khởi động và tiếp tục

| Lệnh | Làm gì | Ví dụ |
|---|---|---|
| `claude` | Mở phiên tương tác trong thư mục hiện tại | `claude` |
| `claude "query"` | Mở phiên kèm prompt đầu tiên | `claude "giải thích kiến trúc src/app"` |
| `claude -p "query"` | Hỏi một lần, in kết quả, thoát (không tương tác) | `claude -p "liệt kê các route lazy"` |
| `cat file \| claude -p "query"` | Xử lý nội dung pipe vào | `cat error.log \| claude -p "nguyên nhân gốc?"` |
| `claude -c` | Tiếp tục hội thoại gần nhất trong thư mục này | `claude -c` |
| `claude -c -p "query"` | Tiếp tục hội thoại gần nhất ở chế độ không tương tác | `claude -c -p "kiểm tra lỗi type"` |
| `claude -r "<tên/ID>" "query"` | Mở lại phiên theo tên/ID kèm prompt | `claude -r "auth-refactor" "làm nốt PR"` |

Gõ sai lệnh con (vd `claude udpate`) → Claude Code gợi ý lệnh gần nhất và thoát.

## Cài đặt, cập nhật, chẩn đoán

| Lệnh | Làm gì |
|---|---|
| `claude update` | Cập nhật lên bản mới nhất |
| `claude install [version]` | Cài/cài lại bản native; `stable`, `latest` hoặc số phiên bản cụ thể: `claude install stable` |
| `claude doctor` | Chẩn đoán chỉ-đọc: tình trạng cài đặt, lỗi file settings, điều kiện Remote Control — không mở phiên |
| `claude --version` / `claude -v` | In phiên bản |

## Đăng nhập và token

| Lệnh | Làm gì |
|---|---|
| `claude auth login` | Đăng nhập; `--email` điền sẵn email, `--sso` bắt buộc SSO, `--console` đăng nhập Console (tính phí API) |
| `claude auth logout` | Đăng xuất |
| `claude auth status` | Trạng thái đăng nhập dạng JSON (`--text` cho dạng đọc); exit 0 nếu đã đăng nhập, 1 nếu chưa — dùng trong script |
| `claude setup-token` | Tạo OAuth token dài hạn cho CI/script (cần gói Claude); chỉ in ra, không lưu — cất vào secret ngay |

```bash title="Kiểm tra đăng nhập trong script"
claude auth status --text || { echo "Chưa đăng nhập Claude Code"; exit 1; }
```

## Phiên nền (background session)

| Lệnh | Làm gì |
|---|---|
| `claude agents` | Mở **agent view**: theo dõi và giao việc cho các phiên nền; `--cwd <dir>` lọc theo thư mục, `--json` (+ `--all`) in danh sách cho script |
| `claude --bg "task"` | Khởi chạy một phiên nền rồi trả lại terminal ngay (flag, xem bài Flag) |
| `claude attach <id>` | Gắn terminal vào một phiên nền |
| `claude logs <id>` | In output gần đây của phiên nền |
| `claude stop <id>` (hoặc `claude kill`) | Dừng phiên nền |
| `claude respawn <id>` | Khởi động lại phiên nền, giữ hội thoại; `--all` để khởi động lại tất cả (vd sau khi cập nhật) |
| `claude rm <id>` | Xoá phiên nền khỏi danh sách (bị từ chối nếu worktree còn commit chưa push — lệnh in ra flag cần thêm) |
| `claude daemon status` | Trạng thái supervisor quản lý phiên nền (exit 1 nếu không chạy) |
| `claude daemon logs` | Theo dõi `~/.claude/daemon.log` |
| `claude daemon run` | Chạy supervisor ở foreground, in log |
| `claude daemon stop --any` | Dừng supervisor và các phiên của nó (`--keep-workers` giữ phiên chạy) — dùng khi supervisor treo |

```bash
claude --bg "nâng @angular/* lên bản patch mới nhất, chạy ng build và test, báo kết quả"
claude agents            # theo dõi
claude logs 7c5dcf5d     # xem output
```

## MCP server: `claude mcp …`

| Lệnh | Làm gì |
|---|---|
| `claude mcp add --transport http <ten> <url>` | Thêm server từ xa; `--header "Authorization: Bearer …"` nếu cần |
| `claude mcp add <ten> -- <lệnh> [args]` | Thêm server cục bộ (stdio); `--env KEY=val` cho biến môi trường |
| `claude mcp add … --scope local\|project\|user` | Phạm vi: chỉ bạn ở dự án này (mặc định) / cả team qua `.mcp.json` / mọi dự án của bạn |
| `claude mcp add-json <ten> '<json>'` | Thêm từ cấu hình JSON (phần bên trong `mcpServers`) |
| `claude mcp add-from-claude-desktop` | Nhập server đã cấu hình trong Claude Desktop |
| `claude mcp list` | Liệt kê server |
| `claude mcp get <ten>` | Chi tiết và trạng thái một server |
| `claude mcp remove <ten>` | Gỡ server |
| `claude mcp login <ten>` | Chạy OAuth mà không mở `/mcp`; `--no-browser` khi qua SSH |
| `claude mcp logout <ten>` | Xoá OAuth credential đã lưu |
| `claude mcp reset-project-choices` | Đặt lại lựa chọn duyệt/từ chối server từ `.mcp.json` |
| `claude mcp serve` | Chạy chính Claude Code như một MCP server cho client khác |

```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp --scope user
claude mcp add playwright -- npx -y @playwright/mcp@latest
claude mcp list
```

## Plugin: `claude plugin …` (alias `claude plugins`)

| Lệnh | Làm gì |
|---|---|
| `claude plugin install <plugin>@<marketplace>` | Cài; `--scope user\|project\|local` (mặc định user) |
| `claude plugin uninstall <plugin>` | Gỡ; `--keep-data` giữ dữ liệu, `--prune` gỡ dependency không còn dùng |
| `claude plugin enable` / `disable <plugin>` | Bật/tắt; `disable --all` tắt mọi plugin |
| `claude plugin update <plugin>` | Cập nhật |
| `claude plugin list` | Liệt kê plugin đã cài |
| `claude plugin details <plugin>` | Xem một plugin thêm gì (skill, agent, hook, MCP) |
| `claude plugin configure <plugin>` | Đặt tuỳ chọn plugin khai báo |
| `claude plugin prune` | Dọn dependency tự cài không còn dùng (`--dry-run` xem trước) |
| `claude plugin init <ten> --with skills hooks` | Tạo khung plugin mới |
| `claude plugin validate <dir> [--strict]` | Kiểm tra plugin hợp lệ |
| `claude plugin test <dir>` | Thử một mod |
| `claude plugin eval` / `eval init` | Chạy / tạo bộ eval đo plugin hoạt động đúng |
| `claude plugin tag <path>` | Gắn tag phiên bản phát hành |
| `claude plugin marketplace add <nguồn>` | Thêm marketplace (`owner/repo`, URL git, thư mục, URL `marketplace.json`) |
| `claude plugin marketplace list` / `remove` / `update` | Liệt kê / gỡ / cập nhật marketplace |

## Auto mode, dữ liệu, nhập cấu hình

| Lệnh | Làm gì |
|---|---|
| `claude auto-mode defaults` | In rule mặc định của classifier dạng JSON; `--label 'Git Destructive'` lọc theo nhóm |
| `claude auto-mode config` | Xem cấu hình auto mode thực tế sau khi áp settings |
| `claude auto-mode reset [--yes]` | Xoá mục `autoMode` trong user settings, về mặc định |
| `claude purge [path]` | Xoá **toàn bộ** dữ liệu cục bộ của một dự án (transcript, task list, log, lịch sử sửa file…); `--dry-run` xem trước, `--all` mọi dự án |
| `claude import [codex\|gemini\|cursor]` | Mở phiên chạy `/import` để mang cấu hình từ công cụ khác sang |

```bash
claude purge ~/work/khach-hang-cu --dry-run
```

## Remote, review, hạ tầng

| Lệnh | Làm gì |
|---|---|
| `claude remote-control` (alias `claude rc`) | Chạy server Remote Control (không có phiên tương tác cục bộ); `--name "Dự án X"` |
| `claude ultrareview [target]` | Chạy ultrareview không tương tác; in kết quả, exit 0/1; `--json`, `--timeout`, `--post` để đăng lên PR |
| `claude gateway --config gateway.yaml` | (Admin) chạy Claude apps gateway tự host |
| `claude self-hosted-runner` | (Admin) đăng ký máy làm runner cho self-hosted environment |

:::quiz Script CI cần biết máy đã đăng nhập Claude Code chưa trước khi chạy job. Lệnh nào?
- [ ] `claude doctor`
- [x] `claude auth status` (exit 0 nếu đã đăng nhập, 1 nếu chưa)
- [ ] `/status`
- [ ] `claude -v`

`/status` là slash command trong phiên, không dùng trong script được.
:::

:::quiz Bạn kết thúc dự án với khách hàng và muốn xoá mọi transcript và lịch sử Claude Code của dự án đó trên máy. Lệnh nào, và nên chạy gì trước?
- [ ] `claude rm`
- [x] `claude purge <path>` — chạy `--dry-run` trước để xem sẽ xoá gì
- [ ] `/clear`
- [ ] `claude plugin prune`

`/clear` chỉ bắt đầu hội thoại mới; transcript cũ vẫn trên đĩa.
:::

:::exercise Luyện lệnh shell trong 20 phút
(1) `claude auth status --text`; (2) `claude doctor`; (3) `claude -p "đếm số file .ts trong src"` rồi `claude -c -p "trong đó bao nhiêu file là spec?"`; (4) thêm một MCP server phạm vi local rồi `claude mcp list` và `claude mcp remove` nó; (5) `claude plugin list`; (6) `claude purge <thư-mục-dự-án-thử> --dry-run` (chỉ xem, không xoá).
???
Ở (3), `-c -p` tiếp tục đúng hội thoại `-p` vừa rồi trong cùng thư mục — Claude biết "trong đó" là các file .ts. Ở (4) dùng server không cần đăng nhập, vd `claude mcp add playwright -- npx -y @playwright/mcp@latest`; `claude mcp get playwright` cho thấy trạng thái kết nối. Ở (6) đọc kỹ danh sách — `purge` không hoàn tác được.
:::

> Nguồn: *CLI reference* — code.claude.com/docs/en/cli-reference; *Connect Claude Code to tools via MCP*; *Plugin commands reference* (truy cập 11/11/2026).
