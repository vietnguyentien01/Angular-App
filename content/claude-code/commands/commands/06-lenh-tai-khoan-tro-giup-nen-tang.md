---
title: Lệnh tài khoản, trợ giúp và nền tảng — /help, /doctor, /status, /login, /feedback, /desktop, /teleport, /remote-control…
summary: "Giải thích các lệnh đăng nhập, chẩn đoán, báo lỗi, cập nhật, chuyển phiên sang desktop/điện thoại/cloud, cấu hình nhà cung cấp cloud, các lệnh vui, và danh sách lệnh đã bị gỡ để không làm theo hướng dẫn cũ."
type: cheatsheet
level: core
lastReviewed: 2026-11-11
tags: [claude-code, commands, account, troubleshooting, reference]
related: [claude-code/consolidate/getting-started/khi-gap-su-co, claude-code/consolidate/getting-started/chon-noi-lam-viec]
---

## Trợ giúp và chẩn đoán

### `/help` — xem trợ giúp và các lệnh có sẵn

### `/doctor [prompt-audit [path]]` — kiểm tra thiết lập

Alias `/checkup`. Chẩn đoán cài đặt, settings, extension, `CLAUDE.md`, đề xuất sửa và **áp dụng sau khi bạn xác nhận**.

```text
/doctor
/doctor prompt-audit
/doctor prompt-audit .claude/rules
```

`prompt-audit` soát file chỉ dẫn (CLAUDE.md, rules, skills, subagents, output styles) tìm chỉ dẫn lỗi thời, mâu thuẫn, trỏ tới file/lệnh không tồn tại.

### `/status` — trạng thái phiên

Mở Settings ở tab Status: phiên bản, model, tài khoản, kết nối, **nguồn settings** (có managed settings không), loại phiên (interactive hay background). Chạy được khi Claude đang làm.

### `/powerup` — học tính năng qua bài tương tác ngắn có hoạt ảnh

### `/release-notes` — xem changelog

Chọn phiên bản để xem ghi chú; nội dung hiện trong transcript nhưng **không** đưa vào hội thoại Claude thấy.

### `/heapdump` — chẩn đoán dùng nhiều RAM (lệnh ẩn)

Ghi heap snapshot và bảng phân tích bộ nhớ. Khi báo lỗi chỉ gửi file `-diagnostics.json`; file `.heapsnapshot` chứa **toàn bộ hội thoại và credential** — không chia sẻ.

## Tài khoản và cập nhật

| Lệnh | Làm gì |
|---|---|
| `/login` | Đăng nhập tài khoản Anthropic (đổi tài khoản) |
| `/logout` | Đăng xuất |
| `/restart` (alias `/update`) | Khởi động lại và resume phiên để áp dụng bản cập nhật đã cài (khi footer gợi ý; gói Pro/Max/Ultra, cài native macOS/Linux) |
| `/upgrade` | Mở trang nâng gói |
| `/privacy-settings` | Cài đặt quyền riêng tư (Pro, Max, Ultra) |

## Phản hồi và báo lỗi

### `/feedback [report]` và `/bug [report]`

Mở hộp thoại gửi phản hồi/báo lỗi: bạn chọn lượng lịch sử phiên gửi kèm và **xác nhận** trước khi gửi. Đăng nhập Anthropic trực tiếp → gửi cho Anthropic; qua nhà cung cấp bên thứ ba → ghi thành archive cục bộ trong `~/.claude/feedback-bundles/` để bạn tự chuyển.

```text
/bug Edit tool báo thành công nhưng file không đổi khi đường dẫn có dấu cách
```

## Chuyển phiên giữa các nơi

| Lệnh | Làm gì |
|---|---|
| `/desktop` (alias `/app`) | Tiếp tục phiên hiện tại trong Claude Desktop (macOS, Windows x64, cần gói Claude) |
| `/mobile` (alias `/ios`, `/android`) | Hiện mã QR tải app Claude cho điện thoại |
| `/remote-control` (alias `/rc`) | Cho phép điều khiển phiên **đang chạy trên máy bạn** từ claude.ai hoặc app điện thoại |
| `/teleport` (alias `/tp`) | Kéo một **cloud session** về terminal này (lấy cả nhánh và hội thoại) |

## Nhà cung cấp cloud (lệnh ẩn)

| Lệnh | Làm gì |
|---|---|
| `/setup-bedrock` | Trình hướng dẫn cấu hình Amazon Bedrock (hiện khi đặt `CLAUDE_CODE_USE_BEDROCK=1`) |
| `/setup-vertex` | Trình hướng dẫn cấu hình Google Cloud's Agent Platform (hiện khi đặt `CLAUDE_CODE_USE_VERTEX=1`) |

## Cho vui

| Lệnh | Làm gì |
|---|---|
| `/radio` | Mở Claude FM lo-fi radio trên trình duyệt |
| `/stickers` | Đặt sticker Claude Code |

## Lệnh đã bị gỡ

| Lệnh cũ | Thay bằng |
|---|---|
| `/vim` | `/config` → Editor mode |
| `/pr-comments` | Hỏi Claude trực tiếp: "đọc các review comment của PR này" (cần `gh`) |
| `/ultraplan` | Plan mode (`Shift+Tab` hoặc `/plan`) |
| `--enable-auto-mode` (flag) | `--permission-mode auto`; auto mode đã có sẵn trong vòng `Shift+Tab` |

:::quiz Bạn cần gửi thông tin chẩn đoán bộ nhớ cho Anthropic sau khi chạy `/heapdump`. Gửi file nào?
- [ ] File `.heapsnapshot`
- [x] Chỉ file `-diagnostics.json`
- [ ] Cả hai
- [ ] Toàn bộ thư mục `~/.claude`

`.heapsnapshot` chứa toàn bộ hội thoại và credential.
:::

:::quiz Một hướng dẫn cũ bảo gõ `/vim` để bật chế độ Vim nhưng báo Unknown command. Làm gì?
- [ ] Cài lại Claude Code
- [x] Dùng `/config` → Editor mode
- [ ] `/plugin install vim`
- [ ] Không còn hỗ trợ Vim

`/vim` đã bị gỡ; tính năng chuyển vào Settings.
:::

:::exercise Kiểm tra sức khoẻ thiết lập của bạn
Chạy lần lượt: `claude doctor` (trên shell), `/status`, `/doctor`, `/doctor prompt-audit`. Ghi lại mọi cảnh báo và sửa ít nhất một vấn đề được chỉ ra.
???
Các vấn đề thường gặp: file settings có khoá sai/JSON lỗi; CLAUDE.md có chỉ dẫn trỏ tới script không còn tồn tại; hai rule mâu thuẫn; skill/subagent trùng tên; cài đặt npm global không tự cập nhật được. Sau khi sửa, chạy lại `/doctor` để xác nhận hết cảnh báo; nếu đã sửa CLAUDE.md, dùng `/context all` xem file đã nạp lại đúng.
:::

> Nguồn: *Commands*, *Troubleshooting*, *Remote Control*, *Use Claude Code in the cloud* — code.claude.com/docs (truy cập 11/11/2026).
