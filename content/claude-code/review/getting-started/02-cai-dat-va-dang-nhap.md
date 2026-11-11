---
title: Cài đặt, đăng nhập, cập nhật và kiểm tra Claude Code
summary: Yêu cầu hệ thống, lệnh cài cho macOS/Linux/WSL/Windows, đăng nhập bằng gói Claude hay Console, cơ chế tự cập nhật theo từng cách cài, và hai lệnh chẩn đoán claude doctor và /doctor.
type: lesson
level: core
lastReviewed: 2026-11-11
tags: [claude-code, beginner, install, login, update]
related: [claude-code/review/getting-started/phien-dau-tien, claude-code/consolidate/getting-started/khi-gap-su-co]
---

## TL;DR

- Cài **native** (khuyến nghị) bằng một lệnh; bản native **tự cập nhật** nền. Homebrew/WinGet thì **không** tự cập nhật.
- Kiểm tra bằng `claude --version`; chạy `claude` trong thư mục dự án → lần đầu được yêu cầu đăng nhập qua trình duyệt.
- Có vấn đề: `claude doctor` (trên shell, không mở phiên) hoặc `/doctor` (trong phiên).

## Cần chuẩn bị

- Một terminal và một dự án code.
- Tài khoản: gói **Claude** (Pro, Max, Ultra, Team, Enterprise — khuyến nghị), tài khoản **Claude Console** (API trả trước), hoặc qua nhà cung cấp cloud (Amazon Bedrock, Google Cloud, Microsoft Foundry).
- Hệ điều hành: macOS 13+, Windows 10 1809+ / Server 2019+, Ubuntu 20.04+, Debian 10+, Alpine 3.19+; RAM 4 GB+; x64 hoặc ARM64; cần internet.

## Cài đặt

```bash title="macOS, Linux, WSL"
curl -fsSL https://claude.ai/install.sh | bash
```

```powershell title="Windows PowerShell"
irm https://claude.ai/install.ps1 | iex
```

```bash title="Windows CMD"
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

Cách khác:

| Cách | Lệnh | Cập nhật |
|---|---|---|
| Native (ở trên) | — | **Tự động** chạy nền |
| Homebrew | `brew install --cask claude-code` (kênh stable, thường chậm ~1 tuần) hoặc `claude-code@latest` | Thủ công: `brew upgrade claude-code` |
| WinGet | `winget install Anthropic.ClaudeCode` | Thủ công: `winget upgrade Anthropic.ClaudeCode` |
| apt / dnf / apk | Xem trang *Advanced setup* | Theo trình quản lý gói |

:::tip Windows
Nên cài **Git for Windows** để Claude dùng được công cụ Bash; nếu không có, Claude dùng PowerShell. Nếu thấy `The token '&&' is not a valid statement separator` là bạn đang ở PowerShell chứ không phải CMD (và ngược lại với `'irm' is not recognized`).
:::

Sau khi cài, **mở terminal mới** rồi:

```bash
claude --version   # in ra số phiên bản kèm "(Claude Code)"
```

Báo `claude: command not found` → thư mục cài chưa nằm trong `PATH`; xem trang *Troubleshoot installation*.

## Đăng nhập

```bash
cd /duong-dan/toi/du-an
claude
```

- Lần đầu: làm theo hướng dẫn để xác thực trong trình duyệt. Thông tin đăng nhập được lưu lại (macOS dùng Keychain), lần sau không phải đăng nhập.
- Đổi tài khoản / đăng nhập lại: gõ `/login` trong phiên; đăng xuất: `/logout`.
- Đã đặt biến môi trường `ANTHROPIC_API_KEY` và bạn đồng ý dùng key đó khi được hỏi → bỏ qua bước đăng nhập trình duyệt.
- Đăng nhập lần đầu bằng Console sẽ tự tạo workspace "Claude Code" trong Console để theo dõi chi phí.

:::warning Gói subscription và API key là hai nguồn tính tiền khác nhau
Nếu shell có sẵn `ANTHROPIC_API_KEY` (vd do một dự án khác đặt), hãy để ý khi Claude Code hỏi có dùng key đó không — chọn nhầm, usage sẽ tính vào API thay vì gói Claude của bạn. `/status` cho biết bạn đang dùng tài khoản nào.
:::

## Cập nhật

- Native: tự cập nhật nền; khi bản mới cài xong, footer có thể gợi ý `/restart` để áp dụng ngay.
- Cập nhật thủ công: `claude update`.
- Xem có gì mới: `/release-notes`.

## Kiểm tra sức khoẻ cài đặt

| Lệnh | Chạy ở | Làm gì |
|---|---|---|
| `claude doctor` | Shell | Chẩn đoán chỉ-đọc: tình trạng cài đặt, lỗi file settings, kết quả lần cập nhật gần nhất, cảnh báo kèm gợi ý sửa |
| `/doctor` | Trong phiên | Kiểm tra cài đặt, settings, extension… và **có thể sửa** giúp bạn |
| `/status` | Trong phiên | Phiên bản, model, tài khoản, kết nối, các nguồn settings đang áp dụng |

:::quiz Bạn cài Claude Code bằng Homebrew trên Mac. Một tháng sau vẫn đang dùng bản cũ. Vì sao?
- [ ] Mac không hỗ trợ cập nhật
- [x] Bản cài qua Homebrew không tự cập nhật — phải chạy `brew upgrade claude-code`
- [ ] Phải đăng nhập lại mới cập nhật
- [ ] Claude Code chỉ cập nhật mỗi quý

Chỉ bản cài native tự cập nhật nền; Homebrew và WinGet phải nâng cấp thủ công.
:::

:::quiz Lệnh nào chẩn đoán cài đặt mà **không cần mở phiên** Claude Code?
- [x] `claude doctor`
- [ ] `/doctor`
- [ ] `/init`
- [ ] `claude -c`

`claude doctor` chạy trên shell và chỉ đọc; `/doctor` chạy trong phiên và có thể sửa giúp.
:::

:::interview Một đồng nghiệp đăng nhập bằng gói Max nhưng hoá đơn API của công ty vẫn tăng. Bạn kiểm tra gì đầu tiên?
Chạy `/status` để xem phiên đang xác thực bằng tài khoản nào. Nhiều khả năng shell có biến `ANTHROPIC_API_KEY` và họ đã đồng ý dùng key đó → usage tính vào API. Gỡ biến (hoặc không chấp nhận key), `/login` lại bằng tài khoản gói Claude.
:::

:::exercise Checklist cài đặt đầy đủ
Làm và đánh dấu: (1) cài native; (2) mở terminal mới, `claude --version`; (3) `claude doctor`; (4) `claude` trong một thư mục dự án, đăng nhập; (5) `/status` — ghi lại tài khoản và model; (6) `echo $ANTHROPIC_API_KEY` để chắc không có key "lạc" trong shell; (7) `claude auth status --text`; (8) `/release-notes` xem bản bạn đang dùng có gì mới.
???
Kết quả mong đợi: `--version` in số phiên bản kèm "(Claude Code)"; `claude doctor` không báo lỗi settings; `/status` hiện đúng tài khoản gói Claude của bạn. Nếu bước (6) in ra một key mà bạn không định dùng, gỡ nó khỏi file profile shell (`~/.zshrc`, `~/.bashrc`) để usage không bị tính nhầm vào API. Cài bằng Homebrew/WinGet thì thêm lịch nhắc tự cập nhật hằng tuần.
:::

> Nguồn: *Quickstart*, *Advanced setup*, *Authentication* — code.claude.com/docs/en/quickstart, /setup, /authentication (truy cập 11/11/2026).
