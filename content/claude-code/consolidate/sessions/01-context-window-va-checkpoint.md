---
title: Context window, compact, checkpoint và quản lý phiên
summary: Context window chứa những gì, xem bằng /context, điều gì còn lại sau khi compact; menu /rewind với năm lựa chọn và giới hạn của checkpoint; resume, đặt tên, branch phiên — đủ để làm việc nhiều ngày trên một task mà không lạc hướng.
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, context-window, compaction, checkpoint, sessions]
related: [claude-code/review/sessions/dieu-khien-phien, claude-code/deep-dive/sessions/chi-phi-va-subagent]
---

## TL;DR

- Context window chứa: hội thoại, nội dung file đã đọc, output lệnh, `CLAUDE.md`, auto memory, mô tả skill, system instructions. Càng đầy càng tốn token và dễ "quên" chỉ dẫn đầu phiên.
- Gần đầy → Claude Code **tự compact** (tóm tắt). Chủ động: `/compact <trọng tâm>`.
- **Checkpoint** trước mỗi prompt → `/rewind` quay code/hội thoại. Không thay git.
- Phiên lưu liên tục → `claude --continue`, `--resume <tên>`, `/branch` để thử hướng khác.

## Nhìn vào context

```text
/context
```

Lưới màu cho thấy phần nào chiếm chỗ (memory files, MCP tools, skill, hội thoại…) kèm gợi ý tối ưu. MCP tool mặc định được **hoãn nạp** (tool search) nên chỉ tên tool chiếm context tới khi Claude cần dùng.

Trước khi bạn gõ gì: `CLAUDE.md`, auto memory, tên MCP tool, mô tả skill đã nạp. Trong lúc làm: mỗi lần đọc file cộng thêm; rule có `paths` nạp kèm file khớp; subagent làm việc trong context **riêng** và chỉ trả về tóm tắt.

## Compact: cái gì còn, cái gì mất

| Thứ | Sau compact |
|---|---|
| System prompt, output style | Vẫn áp dụng |
| `CLAUDE.md` ở gốc dự án, rule không có `paths` | Nạp lại từ đĩa |
| Auto memory | Nạp lại từ đĩa |
| Kế hoạch viết trong plan mode | Nạp lại từ đĩa |
| Rule có `paths`, `CLAUDE.md` thư mục con | Nạp lại **khi** Claude đụng file khớp |
| File đã đọc/sửa | Đọc lại tối đa 5 file sửa gần nhất (file > 5.000 token chỉ còn đường dẫn) |
| Nội dung skill đã gọi | Nạp lại, giới hạn 5.000 token/skill, 25.000 tổng |
| Chỉ dẫn bạn gõ đầu hội thoại | **Có thể mất chi tiết** — chỉ còn trong bản tóm tắt |

Hệ quả: quy tắc phải giữ suốt phiên → đưa vào `CLAUDE.md`, không chỉ nói trong chat. Muốn điều khiển nội dung tóm tắt: thêm mục "Compact Instructions" trong `CLAUDE.md`, hoặc `/compact tập trung vào thay đổi API và các test còn fail`.

:::note Lỗi "thrashing"
Nếu một file hay output quá lớn khiến context đầy lại ngay sau mỗi lần tóm tắt, Claude Code dừng tự compact sau vài lần và báo lỗi thay vì lặp vô tận. Cách xử lý: đừng đọc nguyên file khổng lồ — đọc từng phần, hoặc giao cho subagent.
:::

## Checkpoint và `/rewind`

Mỗi prompt bạn gửi (bắt đầu một lượt) tạo một checkpoint. Mở menu: `/rewind` hoặc `Esc Esc` khi ô nhập trống. Chọn một prompt, rồi:

| Lựa chọn | Tác dụng |
|---|---|
| Restore code and conversation | Quay cả hai về thời điểm đó |
| Restore conversation | Quay hội thoại, giữ code hiện tại |
| Restore code | Quay file, giữ hội thoại |
| Summarize from here | Nén phần hội thoại từ đây trở đi thành tóm tắt |
| Summarize up to here | Nén phần trước điểm này, giữ nguyên phần sau |

Giới hạn cần nhớ:

- File **chỉ** bị thay đổi bằng lệnh Bash (vd `rm`, `mv`, codemod) không được theo dõi.
- Sửa đổi của **subagent** thường không được khôi phục (trừ file Claude đã sửa trong hội thoại).
- Sửa tay ngoài Claude Code, hoặc từ phiên khác, không được ghi lại.
- Giữ snapshot cho 100 checkpoint gần nhất; dọn sau khoảng 30 ngày.

→ **Commit thường xuyên.** Checkpoint để "undo nhanh trong phiên", git để lịch sử thật.

## Quản lý phiên

| Lệnh | Tác dụng |
|---|---|
| `claude --continue` (`-c`) | Mở lại phiên gần nhất trong thư mục này |
| `claude --resume` (`-r`) | Mở danh sách phiên để chọn |
| `claude --resume <tên>` | Mở thẳng phiên đã đặt tên |
| `claude --from-pr <số>` | Lọc phiên gắn với một PR |
| `/rename <tên>` | Đặt tên phiên (hiện trên thanh prompt) |
| `/branch [tên]` | Sao chép hội thoại tới điểm này sang phiên mới để thử hướng khác; bản gốc giữ nguyên |
| `claude --continue --fork-session` | Rẽ nhánh từ dòng lệnh |

:::warning Mở cùng một phiên ở hai terminal
Resume cùng một phiên ở hai terminal mà không fork → tin nhắn hai bên xen kẽ vào **một** transcript. Muốn làm song song: `/branch`, `--fork-session`, hoặc worktree.
:::

:::senior Góc nhìn senior
Context là ngân sách. Thói quen tốt: một task một phiên; đọc file có mục đích (đưa `@file` cụ thể thay vì "đọc hết thư mục"); giao tìm kiếm rộng cho subagent; `/compact` có trọng tâm trước khi chuyển sang pha mới của cùng task; và mọi thứ phải "sống" qua compact thì nằm trong CLAUDE.md hoặc file spec trên đĩa.
:::

:::quiz Bạn dặn ở prompt đầu tiên "không đổi public API của service". Hai giờ sau, sau một lần auto-compact, Claude đổi signature một method public. Nguyên nhân khả dĩ nhất và cách phòng?
- [ ] Claude cố tình phớt lờ; không làm gì được
- [x] Chi tiết dặn dò đầu hội thoại có thể mất khi compact; quy tắc cần giữ suốt phiên nên nằm trong CLAUDE.md hoặc file spec
- [ ] Do dùng plan mode
- [ ] Do auto memory bị tắt

CLAUDE.md ở gốc dự án được nạp lại từ đĩa sau compact; lời dặn trong chat thì không.
:::

:::quiz Claude chạy một codemod qua Bash làm hỏng 30 file Claude chưa từng sửa bằng công cụ sửa file. `/rewind` → Restore code có cứu được không?
- [ ] Có, mọi thay đổi đều có checkpoint
- [x] Không — file chỉ bị Bash thay đổi không được theo dõi; dùng git để khôi phục
- [ ] Có, nếu bật auto mode
- [ ] Chỉ cứu được 5 file

Đây là lý do commit trước khi chạy thay đổi hàng loạt.
:::

:::interview Phân biệt `/branch` và `/rewind`?
`/rewind` quay **trong cùng phiên** về một điểm trước (code, hội thoại, hoặc cả hai) — phần sau bị bỏ. `/branch` **sao chép** hội thoại hiện tại sang một phiên mới và chuyển bạn sang đó; phiên gốc giữ nguyên để quay lại — dùng khi muốn thử hướng khác mà không mất hướng đang đi.
:::

:::exercise Quản lý một task kéo dài hai ngày
Bạn làm một migration lớn trong hai ngày. Viết ra: cách đặt tên phiên, khi nào compact, cách giữ "những điều không được đổi", cách quay lại hôm sau.
???
Ngày 1: `/rename migrate-signal-forms`; viết `MIGRATION.md` (phạm vi, quy tắc không đổi, checklist) và nhắc trong CLAUDE.md; commit sau mỗi nhóm file; `/compact tập trung vào checklist còn lại và lỗi đang mở` khi chuyển pha. Ngày 2: `claude --resume migrate-signal-forms` (hoặc phiên mới: "Đọc MIGRATION.md, tiếp tục từ mục chưa tick"). Thử hướng rủi ro bằng `/branch`.
:::

> Nguồn: *Explore the context window*, *Checkpointing*, *Manage sessions*, *How Claude Code works* — code.claude.com/docs/en/context-window, /checkpointing, /sessions (truy cập 11/11/2026).
