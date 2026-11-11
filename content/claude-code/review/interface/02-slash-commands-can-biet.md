---
title: Slash command cần biết — nhóm theo việc bạn muốn làm
summary: Gõ / để thấy mọi lệnh, skill và lệnh từ plugin/MCP. Bảng này chọn ra những lệnh người mới cần trước, nhóm theo mục đích — phiên, context và chi phí, cấu hình, quy trình code, trợ giúp — kèm lệnh đã bị gỡ để tránh làm theo hướng dẫn cũ.
type: cheatsheet
level: core
lastReviewed: 2026-11-11
tags: [claude-code, beginner, slash-commands]
related: [claude-code/review/interface/phim-tat-va-cu-phap, claude-code/consolidate/sessions/context-window-va-checkpoint]
---

## TL;DR

Gõ `/` rồi vài chữ để lọc. Menu gồm **lệnh có sẵn**, **skill** (có sẵn và tự viết), và lệnh do **plugin / MCP server** thêm vào. Lệnh chỉ chạy khi nằm **đầu** tin nhắn; giữa câu, `/` + `Tab` chỉ giúp hoàn thành tên.

## Phiên làm việc

| Lệnh | Dùng khi |
|---|---|
| `/clear [tên]` | Chuyển sang task khác — hội thoại mới, context trống (phiên cũ vẫn mở lại được bằng `/resume`) |
| `/compact [trọng tâm]` | Hội thoại dài, muốn tóm tắt nhưng giữ phần quan trọng: `/compact giữ lại các thay đổi API` |
| `/rewind` | Quay code và/hoặc hội thoại về một prompt trước |
| `/resume [tên/ID]` | Mở lại hội thoại cũ |
| `/rename [tên]` | Đặt tên phiên để tìm lại |
| `/branch [tên]` | Rẽ nhánh hội thoại để thử hướng khác, giữ nguyên bản gốc |
| `/btw <câu hỏi>` | Hỏi ngoài lề không ghi vào lịch sử |
| `/export [file]` | Xuất hội thoại ra văn bản |
| `/copy [N]` | Copy câu trả lời gần nhất (hoặc thứ N) |
| `/exit` | Thoát |

## Context, model và chi phí

| Lệnh | Dùng khi |
|---|---|
| `/context [all]` | Xem context đang bị chiếm bởi gì (lưới màu + gợi ý tối ưu); `all` liệt kê cả memory files |
| `/usage` (alias `/cost`, `/stats`) | Chi phí phiên, hạn mức gói, thống kê |
| `/model [model]` | Đổi model (và lưu làm mặc định); mũi tên trái/phải chỉnh effort với model hỗ trợ |
| `/effort [low…xhigh]` | Đổi mức effort |
| `/fast [on\|off]` | Bật/tắt fast mode |

## Cấu hình

| Lệnh | Dùng khi |
|---|---|
| `/config` | Giao diện settings: theme, model, output style, editor mode (vim)… |
| `/permissions` | Xem/thêm/xoá rule allow, ask, deny |
| `/memory` | Sửa các file `CLAUDE.md`, bật/tắt và xem auto memory |
| `/hooks` | Xem hook đang cấu hình |
| `/mcp` | Quản lý MCP server và đăng nhập OAuth |
| `/plugin` | Cài, bật/tắt, cập nhật plugin |
| `/agents`, `/skills` | Subagent và skill hiện có |
| `/output-style [style]` | Đổi phong cách trả lời (vd `Explanatory`, `Learning`) |
| `/statusline`, `/theme`, `/keybindings` | Tuỳ biến giao diện |
| `/terminal-setup` | Cài `Shift+Enter` xuống dòng cho VS Code, Cursor… |
| `/sandbox` | Bật/tắt sandbox cho lệnh shell |
| `/add-dir <path>` | Cho phép truy cập thêm một thư mục trong phiên |

## Quy trình code

| Lệnh | Dùng khi |
|---|---|
| `/init` | Tạo (hoặc gợi ý cải thiện) `CLAUDE.md` |
| `/plan [mô tả]` | Vào plan mode ngay từ prompt |
| `/diff` | Xem thay đổi trong working tree, gồm các sửa đổi của Claude |
| `/code-review` (alias `/review`) | Review diff hiện tại hoặc một PR/nhánh; `--fix` để áp dụng |
| `/security-review` | Tìm lỗ hổng bảo mật trong thay đổi của nhánh |
| `/simplify` | Dọn code vừa đổi (tái sử dụng, đơn giản hoá) |
| `/verify`, `/run` | Build, chạy app thật để xác nhận thay đổi hoạt động |
| `/goal <điều kiện>` | Claude làm tiếp qua nhiều lượt tới khi điều kiện đạt |
| `/loop [interval] <prompt>` | Lặp một prompt khi phiên còn mở |
| `/schedule` | Tạo scheduled task chạy trên cloud |
| `/batch` | Chia thay đổi lớn thành nhiều phần chạy song song |
| `/install-github-app` | Cài GitHub App + workflow để `@claude` trong issue/PR |

## Trợ giúp và chẩn đoán

| Lệnh | Dùng khi |
|---|---|
| `/help` | Danh sách lệnh |
| `/doctor` | Kiểm tra cài đặt/cấu hình và sửa giúp; `/doctor prompt-audit` soát file hướng dẫn lỗi thời/mâu thuẫn |
| `/status` | Phiên bản, model, tài khoản, nguồn settings |
| `/debug` | Bật debug log để tìm nguyên nhân sự cố |
| `/release-notes` | Xem changelog |
| `/powerup` | Bài học tương tác ngắn về tính năng |
| `/feedback` (hoặc `/bug`) | Gửi phản hồi/báo lỗi (có bước xác nhận trước khi gửi) |
| `/login`, `/logout` | Đăng nhập/đăng xuất |

:::warning Lệnh đã bị gỡ — đừng làm theo hướng dẫn cũ
`/vim` (đã gỡ, dùng `/config` → Editor mode), `/pr-comments` (đã gỡ, hỏi Claude trực tiếp), `/ultraplan` (đã gỡ, dùng plan mode). Khi một blog cũ nhắc lệnh lạ, gõ `/` để kiểm tra, hoặc xem `/release-notes`.
:::

:::quiz Bạn vừa xong task A và sắp làm task B không liên quan. Lệnh nào?
- [ ] `/compact`
- [x] `/clear`
- [ ] `/rewind`
- [ ] `/export`

`/clear` cho context sạch; bối cảnh của task A chỉ gây nhiễu cho task B. `/compact` dùng khi vẫn đang làm cùng task.
:::

:::quiz Bạn muốn biết `CLAUDE.md` của dự án có thật sự được nạp không. Cách kiểm tra theo tài liệu?
- [ ] `/init`
- [ ] `/status`
- [x] `/context all` rồi xem danh sách **Memory files**
- [ ] Hỏi Claude "bạn có đọc CLAUDE.md không?"

Hỏi model chỉ cho câu trả lời "có vẻ đúng"; `/context all` cho dữ liệu thật.
:::

:::interview Phân biệt `/clear`, `/compact` và `/rewind`?
`/clear`: bỏ toàn bộ context, bắt đầu hội thoại mới (dùng khi đổi task). `/compact`: tóm tắt hội thoại hiện tại để giải phóng context nhưng vẫn tiếp tục task, có thể chỉ định trọng tâm. `/rewind`: quay **code và/hoặc hội thoại** về một prompt trước — dùng khi Claude đi sai hướng; ngoài ra có "Summarize from here" để nén một đoạn hội thoại.
:::

> Nguồn: *Commands* — code.claude.com/docs/en/commands; *Interactive mode* — mục "Commands" (truy cập 11/11/2026).
