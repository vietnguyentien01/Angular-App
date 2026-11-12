---
title: Khi gặp sự cố — chẩn đoán cấu hình, hook không chạy, skill không hiện, MCP không nạp
summary: Bộ lệnh chẩn đoán (/doctor, /status, /context, /permissions, /hooks, /mcp, /debug), bảng triệu chứng → nguyên nhân → cách sửa từ tài liệu chính thức, các sự cố hiển thị thường gặp, và kênh nhờ trợ giúp đúng chỗ.
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, troubleshooting, debugging, configuration]
related: [claude-code/review/getting-started/cai-dat-va-dang-nhap, claude-code/consolidate/guardrails/settings-va-permission-rule]
---

## TL;DR

Đừng đoán — **xem cái gì đã thật sự nạp**: `/context all` (memory files), `/permissions` (rule đang hiệu lực), `/hooks`, `/skills`, `/mcp`, `/status` (nguồn settings). Còn bí: `/doctor`, rồi `/debug <mô tả>`.

## Bộ lệnh chẩn đoán

| Lệnh | Cho biết |
|---|---|
| `/doctor` | Sức khoẻ cài đặt, file settings không hợp lệ, extension không dùng, subagent trùng tên… và có thể sửa |
| `claude doctor` | Như trên nhưng chạy trên shell, chỉ đọc |
| `/status` | Phiên bản, model, tài khoản, kết nối, **nguồn settings** (có managed không) |
| `/context all` | Context đang chứa gì, gồm danh sách memory files |
| `/memory` | Vị trí các file CLAUDE.md, auto memory |
| `/permissions` | Rule allow/ask/deny đã gộp và file nguồn; tab Recently blocked của auto mode |
| `/hooks` | Hook đang hoạt động |
| `/skills` | Skill từ project, user, plugin |
| `/mcp` | MCP server và trạng thái kết nối |
| `/debug [mô tả]` | Bật debug log, nhờ Claude chẩn đoán dựa trên log và đường dẫn settings |

## Triệu chứng → nguyên nhân → cách sửa

| Triệu chứng | Nguyên nhân hay gặp | Sửa |
|---|---|---|
| Hook không bao giờ chạy | `matcher` là mảng JSON | Dùng một chuỗi với `\|`: `"Edit\|Write"` |
| Hook không chạy | `matcher` viết thường (`"bash"`) | Phân biệt hoa thường: `Bash`, `Edit`, `Write`, `Read` |
| Hook không chạy | Viết hook trong file riêng | Hook nằm dưới khoá `"hooks"` trong `settings.json` |
| Permission/hook đặt "toàn cục" bị bỏ qua | Đặt nhầm vào `~/.claude.json` | Phải ở `~/.claude/settings.json` |
| Giá trị trong `settings.json` như bị bỏ qua | Cùng khoá trong `settings.local.json` | Local ghi đè project |
| Skill không hiện trong `/skills` | File ở `.claude/skills/ten.md` | Phải là thư mục: `.claude/skills/ten/SKILL.md` |
| Skill hiện nhưng Claude không tự gọi | `disable-model-invocation: true`, hoặc `description` không khớp cách bạn hỏi | Sửa description cho rõ "khi nào dùng" |
| `CLAUDE.md` thư mục con như bị bỏ qua | Nó chỉ nạp khi Claude làm việc với file trong thư mục đó | Nhờ Claude đọc một file trong thư mục đó |
| Subagent Explore/Plan không theo CLAUDE.md | Hai subagent có sẵn này bỏ qua CLAUDE.md lúc khởi động | Dùng subagent tự định nghĩa nếu cần |
| MCP server trong `.mcp.json` không nạp | File đặt trong `.claude/`, hoặc dùng khoá `servers` (kiểu VS Code) | `.mcp.json` ở gốc repo, khoá `mcpServers` |
| MCP server project không xuất hiện | Bỏ qua hộp thoại duyệt một lần | `/mcp` để xem và duyệt |
| Deny `Bash(rm *)` không chặn `/bin/rm` hay `find -delete` | Rule Bash khớp **chuỗi lệnh**, không phải chương trình thực thi | Dùng sandbox / hook cho ranh giới thật |

## Sự cố hiển thị và hiệu năng

| Triệu chứng | Thử |
|---|---|
| Màn hình rối, trống một phần | `Ctrl+L` vẽ lại |
| Chữ lỗi trong terminal tích hợp của editor | `/terminal-setup` (VS Code/Cursor: tắt GPU acceleration của terminal) |
| `Shift+Enter` không xuống dòng | `/terminal-setup`, hoặc dùng `\`+`Enter` / `Ctrl+J` |
| Auto-compact báo lỗi "thrashing" | Một file/output quá lớn — đọc từng phần, giao cho subagent |
| Tìm kiếm chậm/thiếu trên WSL | Xem mục *Search and discovery issues* của trang Troubleshooting |

## Thử với cấu hình sạch

Nghi một plugin/hook/CLAUDE.md gây lỗi? Chạy thử `claude --bare` (bỏ qua hook, skill, plugin, MCP, auto memory, CLAUDE.md). Hết lỗi → bật lại từng phần để khoanh vùng.

## Nhờ trợ giúp đúng chỗ

1. Hỏi chính Claude — nó có quyền tra tài liệu của mình: *"how do I…"*.
2. `/feedback` (hoặc `/bug`) để báo lỗi cho Anthropic (bạn chọn lượng lịch sử gửi kèm, có bước xác nhận).
3. Issue đã biết: repo GitHub `anthropics/claude-code`.
4. Tài khoản, thanh toán, gói: liên hệ support qua claude.ai (hoặc platform.claude.com với Console) → **Get help**.

:::senior Góc nhìn senior
Khi hỗ trợ đồng đội, đi theo dữ liệu thay vì đoán: `/status` (nguồn settings), `/context all` (file nào nạp), `/permissions`, `/hooks`, `/mcp`, rồi `claude --safe-mode` để khoanh vùng. Ghi lại các lỗi gặp nhiều nhất vào wiki của team — phần lớn sự cố cấu hình lặp lại theo vài mẫu quen thuộc.
:::

:::quiz Bạn thêm hook với `"matcher": ["Edit", "Write"]` nhưng hook không bao giờ chạy. Sửa thế nào?
- [ ] Đổi sang `"matcher": "edit,write"`
- [x] Dùng một chuỗi: `"matcher": "Edit|Write"`
- [ ] Chuyển hook sang `~/.claude.json`
- [ ] Viết hook vào CLAUDE.md

Matcher là một chuỗi, phân biệt hoa thường, nhiều tool nối bằng `|`.
:::

:::quiz Bạn tạo `.claude/skills/review.md` nhưng `/skills` không thấy. Vì sao?
- [ ] Skill phải viết bằng JSON
- [x] Skill phải là thư mục chứa `SKILL.md`: `.claude/skills/review/SKILL.md`
- [ ] Phải khởi động lại máy
- [ ] Skill chỉ dùng được trên cloud

`.claude/commands/*.md` là định dạng cũ vẫn chạy; skill mới là thư mục có `SKILL.md`.
:::

:::interview Một đồng nghiệp nói "Claude không theo CLAUDE.md". Bạn chẩn đoán theo thứ tự nào?
(1) `/context all` xem file có thật sự nạp không (đúng vị trí? thư mục con chỉ nạp khi cần?). (2) File có quá dài, mơ hồ, mâu thuẫn không — `/doctor prompt-audit`. (3) Có `CLAUDE.local.md` hay rule khác nói ngược không. (4) Chỉ dẫn có bị mất sau compact không. (5) Nếu là quy tắc không có ngoại lệ → chuyển sang hook/permission, vì CLAUDE.md chỉ là context.
:::

:::exercise Tự gây lỗi rồi tự chẩn đoán
Trong một repo thử: (a) tạo hook có matcher viết thường, (b) tạo skill dạng file `.md` lẻ, (c) đặt `.mcp.json` trong `.claude/`. Dùng bộ lệnh chẩn đoán để tìm từng lỗi.
???
(a) `/hooks` thấy hook nhưng nó không chạy khi Claude sửa file → matcher phải là `Edit|Write`. (b) `/skills` không liệt kê → chuyển thành `.claude/skills/<ten>/SKILL.md`. (c) `/mcp` không thấy server → chuyển `.mcp.json` ra gốc repo với khoá `mcpServers`, duyệt server ở `/mcp`. `/doctor` cũng báo một phần các lỗi này.
:::

> Nguồn: *Debug your configuration*, *Troubleshooting* — code.claude.com/docs/en/debug-your-config, /troubleshooting (truy cập 11/11/2026).
