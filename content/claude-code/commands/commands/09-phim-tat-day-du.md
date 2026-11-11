---
title: Phím tắt đầy đủ — điều khiển, soạn thảo, nhiều dòng, transcript, Vim mode, tuỳ biến
summary: "Bảng tra cứu toàn bộ phím tắt trong terminal của Claude Code: điều khiển phiên, chuyển model/chế độ, soạn thảo văn bản kiểu readline, gõ nhiều dòng, ký tự đầu dòng, transcript viewer, Vim mode, giọng nói — và cách đổi phím bằng /keybindings."
type: cheatsheet
level: core
lastReviewed: 2026-11-11
tags: [claude-code, keyboard, shortcuts, reference]
related: [claude-code/review/interface/phim-tat-va-cu-phap, claude-code/commands/commands/cach-dung-lenh]
---

## Điều khiển chung

| Phím | Làm gì |
|---|---|
| `Esc` | Dừng Claude giữa lượt (huỷ lệnh đang chạy, giữ phần đã làm) hoặc đóng hộp thoại |
| `Esc` `Esc` | Ô nhập có chữ: xoá bản nháp (lưu vào lịch sử). Ô nhập trống: mở menu rewind |
| `Ctrl+C` | Ngắt; khi không có gì chạy: lần 1 xoá ô nhập, lần 2 thoát |
| `Ctrl+D` | Thoát (nhấn hai lần trong 800ms); khi ô nhập có chữ: xoá ký tự sau con trỏ |
| `Shift+Tab` (Windows có thể là `Alt+M`) | Xoay vòng permission mode |
| `Option+P` / `Alt+P` | Đổi model, không mất prompt đang gõ |
| `Option+T` / `Alt+T` | Bật/tắt extended thinking (không có tác dụng với các model luôn tự suy luận như Opus 5.5, Sonnet 5.5) |
| `Option+O` / `Alt+O` | Bật/tắt fast mode |
| `Ctrl+G` hoặc `Ctrl+X Ctrl+E` | Mở prompt (hoặc plan) trong editor mặc định |
| `Ctrl+L` | Vẽ lại màn hình (giữ hội thoại) |
| `Ctrl+O` | Bật/tắt transcript viewer (chi tiết từng lần gọi công cụ, model, thời gian) |
| `Ctrl+R` | Tìm ngược trong lịch sử lệnh |
| `Ctrl+V` / `Cmd+V` (iTerm2) / `Alt+V` (Windows, WSL) | Dán ảnh từ clipboard → chip `[Image #N]` |
| `Ctrl+B` | Đưa lệnh Bash/agent đang chạy xuống nền (tmux: nhấn hai lần) |
| `Ctrl+T` | Bật/tắt danh sách việc (to-do) của Claude |
| `Ctrl+S` | Cất bản nháp; nhấn lại ở ô trống để lấy ra |
| `Ctrl+Enter` hoặc `Ctrl+X Ctrl+S` | Gửi ngay các tin nhắn đang xếp hàng |
| `Ctrl+X Ctrl+K` | Dừng mọi subagent nền của phiên |
| `Ctrl+Z` | (Unix) tạm treo Claude Code về shell; `fg` để quay lại |
| `↑` / `↓` (hoặc `Ctrl+P` / `Ctrl+N`) | Di chuyển trong ô nhập nhiều dòng, hoặc duyệt lịch sử |
| `←` / `→` | Chuyển tab trong hộp thoại |
| `Tab` | Chấp nhận gợi ý autocomplete; trên hộp thoại quyền: mở ô **ghi chú** cho lựa chọn Yes/No |

## Soạn thảo văn bản

| Phím | Làm gì |
|---|---|
| `Ctrl+A` / `Ctrl+E` | Về đầu / cuối dòng |
| `Ctrl+K` | Xoá tới cuối dòng |
| `Ctrl+U` | Xoá từ con trỏ về đầu dòng |
| `Ctrl+W` | Xoá lùi tới khoảng trắng trước (cả một đường dẫn hay `--flag=value`) |
| `Ctrl+Y` | Dán lại đoạn vừa xoá; sau đó `Alt+Y` xoay vòng các đoạn đã xoá |
| `Alt+B` / `Alt+F` | Lùi / tiến một từ (macOS cần bật Option as Meta) |
| `Alt+D` | Xoá tới cuối từ |
| `Ctrl+_` hoặc `Ctrl+Shift+-` | Hoàn tác lần sửa ô nhập gần nhất |

## Gõ nhiều dòng

| Cách | Ghi chú |
|---|---|
| `\` + `Enter` | Mọi terminal |
| `Ctrl+J` | Mọi terminal, không cần cấu hình |
| `Shift+Enter` | Sẵn ở iTerm2, WezTerm, Ghostty, Kitty, Warp, Apple Terminal, Windows Terminal; nơi khác chạy `/terminal-setup` |
| `Option+Enter` | macOS sau khi bật Option as Meta |
| Dán | Code block, log dài |

## Ký tự đầu dòng

| Gõ | Làm gì |
|---|---|
| `/` | Lệnh hoặc skill |
| `!` | Shell mode — chạy lệnh, output vào phiên |
| `@` | Gợi ý file/thư mục (và `@server:resource` của MCP, `@"tên (agent)"` cho subagent) |
| `:` | Emoji shortcode, vd `:rocket:` |
| `?` (ô trống) | Bảng phím tắt |

## Transcript viewer (`Ctrl+O`)

| Phím | Làm gì |
|---|---|
| `?` | Bảng phím tắt (fullscreen) |
| `{` / `}` | Nhảy tới prompt trước / sau (fullscreen) |
| `Ctrl+E` | Hiện toàn bộ nội dung (renderer cổ điển) |
| `[` | Ghi cả hội thoại ra scrollback của terminal để tìm bằng `Cmd+F`/tmux (fullscreen) |
| `v` | Mở hội thoại trong `$VISUAL`/`$EDITOR` (fullscreen) |
| `q`, `Ctrl+C`, `Esc` | Thoát transcript viewer |

## Vim mode

Bật: `/config` → **Editor mode** → Vim. Sau đó:

| Nhóm | Phím chính |
|---|---|
| Chuyển chế độ | `Esc` → NORMAL; `i` `I` `a` `A` `o` `O` → INSERT; `v` / `V` → VISUAL |
| Di chuyển | `h j k l`, `w e b`, `0 $ ^`, `gg G`, `f{c} F{c} t{c} T{c}`, `;` `,`, `%` (ngoặc khớp) |
| Sửa | `x`, `r{c}`, `dd`, `D`, `dw de db`, `cc`, `C`, `cw`, `s`, `S`, `yy`, `p P`, `>>` `<<`, `J`, `u`, `.` |
| Text object | `iw aw`, `iW aW`, `i" a"`, `i' a'`, `i( a(`, `i[ a[`, `i{ a{` |
| Trong NORMAL | `/` mở tìm lịch sử (như `Ctrl+R`) |

## Giọng nói

Giữ hoặc chạm `Space` để đọc chính tả (sau khi bật bằng `/voice`; `/voice tap` cho chế độ chạm để bật/tắt).

## Đổi phím

`/keybindings` mở file phím tắt tuỳ chỉnh (`~/.claude/keybindings.json`). Ví dụ đổi phím thoát transcript viewer qua hành động `transcript:exit`. Xem trang *Customize keyboard shortcuts* để biết tên các hành động.

:::quiz Bạn đang gõ một prompt dài thì cần chèn đường dẫn của một file. Cách nhanh nhất?
- [ ] Thoát ra shell để `ls`
- [x] Gõ `@` rồi vài chữ để autocomplete đường dẫn, `Tab` để chọn
- [ ] `Ctrl+R`
- [ ] `/add-dir`

`@` mở gợi ý đường dẫn ngay trong ô nhập.
:::

:::quiz Bạn lỡ `Ctrl+W` xoá mất một đường dẫn dài vừa gõ. Lấy lại thế nào?
- [ ] Không lấy lại được
- [x] `Ctrl+Y` dán lại đoạn vừa xoá (hoặc `Ctrl+_` hoàn tác)
- [ ] `Esc Esc`
- [ ] `/rewind`

`/rewind` dành cho code và hội thoại, không phải ô nhập.
:::

:::exercise Một ngày không dùng chuột
Trong một ngày làm việc, tự đặt luật: chỉ dùng bàn phím. Luyện: `Ctrl+R` tìm lại prompt cũ, `Ctrl+G` soạn prompt dài trong editor, `Ctrl+S` cất nháp khi cần hỏi việc khác, `Ctrl+O` xem chi tiết công cụ, `Ctrl+B` đưa `ng test --watch` xuống nền, `Tab` trên hộp thoại quyền để ghi chú lý do khi chọn No.
???
Mẹo: dán bảng "Điều khiển chung" cạnh màn hình trong tuần đầu. Hai phím đem lại nhiều nhất cho người mới thường là `Ctrl+G` (prompt dài, có cấu trúc, ít lỗi Enter gửi nhầm) và `Tab` ghi chú trên hộp thoại quyền (Claude nhận lý do và tự điều chỉnh thay vì dừng lượt).
:::

> Nguồn: *Interactive mode* — code.claude.com/docs/en/interactive-mode; *Customize keyboard shortcuts* (truy cập 11/11/2026).
