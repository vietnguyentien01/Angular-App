---
title: Tuỳ biến môi trường làm việc — status line, output style tự viết, phím tắt, terminal
summary: "Biến terminal thành buồng lái: status line hiện model, nhánh git và % context; output style riêng cho cách bạn muốn Claude trả lời; đổi phím trong keybindings.json; Shift+Enter, theme, renderer fullscreen, Vim mode — mỗi phần có file cấu hình mẫu chạy được."
type: lesson
level: intermediate
lastReviewed: 2026-11-12
tags: [claude-code, statusline, output-styles, keybindings, terminal]
related: [claude-code/review/interface/phim-tat-va-cu-phap, claude-code/commands/commands/lenh-cau-hinh]
---

## TL;DR

| Muốn | Dùng | Ở đâu |
|---|---|---|
| Luôn thấy model, % context, nhánh git | Status line | `statusLine` trong `~/.claude/settings.json` |
| Claude trả lời theo phong cách riêng | Output style tự viết | `~/.claude/output-styles/*.md` hoặc `.claude/output-styles/` |
| Đổi/tắt phím tắt | Keybindings | `~/.claude/keybindings.json` (`/keybindings`) |
| `Shift+Enter` xuống dòng trong VS Code/Cursor | `/terminal-setup` | Một lần cho mỗi terminal |
| Giao diện không nháy, dùng chuột | `/tui fullscreen` | Lưu trong settings |

## Status line

### Cách nhanh

```text
/statusline hiện tên model, thư mục, nhánh git và % context kèm thanh tiến độ
```

Claude Code tạo script trong `~/.claude/` và cập nhật settings giúp bạn.

### Tự viết (để hiểu cơ chế)

Claude Code gửi **JSON qua stdin** cho script; dòng đầu tiên script in ra là status line.

```bash title="~/.claude/statusline.sh"
#!/bin/bash
input=$(cat)
MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
BRANCH=$(git -C "$DIR" branch --show-current 2>/dev/null)
echo "[$MODEL] 📁 ${DIR##*/} ${BRANCH:+⎇ $BRANCH} | ${PCT}% context"
```

```bash
chmod +x ~/.claude/statusline.sh
```

```json title="~/.claude/settings.json"
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 1
  }
}
```

Tuỳ chọn khác: `refreshInterval` (chạy lại mỗi N giây — cho đồng hồ hoặc việc nền), `hideVimModeIndicator`. Dữ liệu có sẵn gồm cả số token đọc/ghi prompt cache — hữu ích để thấy khi nào cache bị "vỡ" (xem bài *Bên trong Claude Code*). Gỡ: `/statusline delete`.

## Output style tự viết

Output style thay đổi **cách Claude giao tiếp** cho cả phiên (giọng, độ dài, định dạng) — khác CLAUDE.md (quy ước dự án) và skill (quy trình gọi khi cần).

```md title="~/.claude/output-styles/review-vi.md"
---
name: Review tiếng Việt
description: Trả lời ngắn bằng tiếng Việt, giữ thuật ngữ tiếng Anh, luôn kết thúc bằng rủi ro và cách kiểm tra
keep-coding-instructions: true
---
- Trả lời bằng tiếng Việt, giữ nguyên thuật ngữ kỹ thuật tiếng Anh (signal, change detection, interceptor…).
- Mở đầu bằng kết quả trong 1–2 câu, không dẫn dắt.
- Khi thay đổi code: liệt kê file đã sửa dạng `file:dòng — thay đổi`.
- Luôn kết thúc bằng hai mục: **Rủi ro** (tối đa 3 gạch đầu dòng) và **Cách kiểm tra** (lệnh cụ thể).
```

```text
/output-style review-vi
```

- `keep-coding-instructions: true` giữ nguyên hướng dẫn làm phần mềm của Claude Code — chỉ đổi cách nói. Bỏ trường này khi style dành cho việc **không** phải code.
- Vị trí: `~/.claude/output-styles/` (cá nhân), `.claude/output-styles/` (dự án, commit cho team), managed.
- Đổi style không làm vỡ prompt cache.

## Phím tắt tuỳ chỉnh

```json title="~/.claude/keybindings.json"
{
  "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "ctrl+e": "chat:externalEditor",
        "ctrl+s": null
      }
    }
  ]
}
```

- Mỗi khối có `context` (`Global`, `Chat`, `Autocomplete`, `Confirmation`, `Transcript`, `HistorySearch`…) và bảng phím → hành động; `null` để bỏ một phím.
- File được phát hiện và áp dụng **không cần khởi động lại**.
- `$schema` giúp editor gợi ý tên hành động.

## Terminal

| Việc | Cách |
|---|---|
| `Shift+Enter` xuống dòng ở VS Code, Cursor, Zed, Alacritty | `/terminal-setup` (VS Code/Cursor: còn tắt GPU acceleration của terminal để tránh chữ lỗi) |
| macOS: phím Option như Meta (`Alt+B`, `Alt+F`, `Option+Enter`) | Bật "Use Option as Meta" trong cài đặt terminal |
| Theme khớp nền terminal / thân thiện người mù màu | `/theme` → `auto` hoặc daltonized |
| Renderer không nháy, cuộn chuột, `/focus` | `/tui fullscreen` |
| Soạn thảo kiểu Vim | `/config` → Editor mode |
| Trình đọc màn hình | `claude --ax-screen-reader` |
| Màu thanh prompt để phân biệt nhiều terminal | `/color purple` |

:::senior Góc nhìn senior
Đầu tư 30 phút cho môi trường trả lại mỗi ngày: status line có % context giúp bạn `/compact` hoặc `/clear` **trước** khi chất lượng giảm; output style chuẩn cho team (commit vào `.claude/output-styles/`) làm câu trả lời của Claude nhất quán khi nhiều người cùng review.
:::

:::interview Output style khác CLAUDE.md và skill thế nào?
Output style đổi **cách Claude giao tiếp** cho cả phiên (giọng, độ dài, định dạng; có thể giữ nguyên hướng dẫn code bằng `keep-coding-instructions`). CLAUDE.md chứa **sự thật về dự án** nạp mỗi phiên. Skill là **quy trình/kiến thức** chỉ nạp khi gọi hoặc khi liên quan.
:::

:::quiz Bạn muốn mọi câu trả lời của Claude kết thúc bằng mục "Rủi ro" và "Cách kiểm tra", nhưng Claude vẫn code như bình thường. Dùng gì?
- [ ] Thêm vào CLAUDE.md
- [x] Output style tự viết với `keep-coding-instructions: true`
- [ ] Một hook Stop
- [ ] `--system-prompt`

Output style điều chỉnh cách giao tiếp cho cả phiên; `--system-prompt` thay toàn bộ hướng dẫn mặc định.
:::

:::quiz Status line script nhận dữ liệu từ đâu?
- [ ] Đọc file transcript
- [x] JSON gửi qua stdin mỗi lần cập nhật
- [ ] Biến môi trường `CLAUDE_MODEL`
- [ ] Gọi API của Anthropic

Dòng đầu tiên script in ra trở thành status line.
:::

:::exercise Dựng buồng lái của bạn
(1) Tạo status line hiện model, nhánh git và % context bằng script tự viết ở trên; (2) tạo output style `review-vi` và bật nó cho một phiên làm việc; (3) đổi `Ctrl+E` thành mở editor ngoài; (4) nếu dùng terminal VS Code, chạy `/terminal-setup`. Ghi lại một điều bạn thấy thay đổi trong cách làm việc sau một ngày.
???
Kiểm tra: status line đổi % ngay sau mỗi lượt; mở `/context` để so con số. Output style hiển thị trong `/output-style`; câu trả lời có hai mục cuối. Nếu status line trống: chạy tay `echo '{"model":{"display_name":"X"},"workspace":{"current_dir":"'$PWD'"},"context_window":{"used_percentage":12.5}}' | ~/.claude/statusline.sh` để gỡ lỗi script (thiếu `jq`, thiếu `chmod +x` là hai nguyên nhân phổ biến nhất).
:::

> Nguồn: *Customize your status line*, *Output styles*, *Customize keyboard shortcuts*, *Configure your terminal for Claude Code* — code.claude.com/docs (truy cập 12/11/2026).
