---
title: Chọn nơi làm việc — terminal, VS Code/JetBrains, desktop, cloud, Remote Control
summary: Cùng một Claude Code chạy ở nhiều giao diện; cái khác là code chạy ở đâu và bạn tương tác thế nào. So sánh terminal, extension IDE, desktop app, cloud session, Remote Control và mobile — khi nào dùng cái nào cho dự án Angular, và cách chuyển phiên giữa chúng.
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, vs-code, jetbrains, desktop, cloud, remote-control]
related: [claude-code/review/getting-started/claude-code-la-gi, claude-code/deep-dive/automation/lam-viec-song-song]
---

## TL;DR

- **Vòng lặp, công cụ, CLAUDE.md, settings giống nhau** ở mọi giao diện chạy trên máy bạn.
- Hằng ngày: **VS Code extension** (diff trực quan, @-mention theo dòng) hoặc **terminal** (đầy đủ nhất, scriptable).
- Giao việc chạy nền / không có repo trên máy: **cloud session**. Muốn điều khiển phiên **trên máy bạn** từ điện thoại: **Remote Control**.

## So sánh nhanh

| Giao diện | Code chạy ở | Điểm mạnh | Hợp khi |
|---|---|---|---|
| Terminal (CLI) | Máy bạn | Đầy đủ tính năng, `-p` cho script/CI, phím tắt | Làm việc chính, tự động hoá |
| VS Code extension | Máy bạn | Diff inline, duyệt/sửa plan, @-mention file kèm dải dòng, tự thấy đoạn code đang chọn | Code hằng ngày trong editor |
| JetBrains plugin | Máy bạn | Diff trong IDE, chia sẻ selection (IntelliJ, WebStorm, PyCharm…) | Team dùng WebStorm/IntelliJ |
| Desktop app (tab Code) | Máy bạn | Nhiều phiên song song cách ly bằng git, review diff trực quan, preview app, theo dõi PR | Chạy nhiều task cùng lúc có giao diện |
| Cloud (claude.ai/code, mobile, `claude --cloud`) | VM do Anthropic quản lý | Chạy nền khi bạn tắt máy, làm với repo GitHub không có trên máy, tự sửa PR | Giao việc rồi đi làm việc khác |
| Remote Control | **Máy bạn**, điều khiển từ trình duyệt/điện thoại | Dùng môi trường cục bộ đầy đủ (MCP, file) từ xa | Tiếp tục phiên ở nhà/đi đường |

## VS Code: những điều nên biết

- Mở bằng biểu tượng Spark trên thanh editor, Activity Bar, hoặc Command Palette ("Claude Code").
- Claude **tự thấy đoạn bạn đang chọn**; `Option+K` / `Alt+K` chèn tham chiếu dạng `@file.ts#5-10`.
- Duyệt và sửa kế hoạch trước khi chấp nhận; checkpoint/rewind ngay trong panel.
- Nếu đã đặt `ANTHROPIC_API_KEY` trong shell mà extension vẫn đòi đăng nhập: mở VS Code từ terminal bằng `code .` để kế thừa biến môi trường.
- Dùng CLI trong terminal tích hợp của VS Code: chạy `/terminal-setup` một lần để `Shift+Enter` xuống dòng; `/ide` để kết nối CLI với IDE.

## Cloud session

```bash
claude --cloud "Sửa lỗi lazy route trong src/app/app.routes.ts và chạy ng test"
```

- Cần kết nối GitHub để cloud clone repo và push nhánh. Một repo mỗi lần với `--cloud`.
- Chiều chuyển phiên từ CLI là **một chiều**: kéo phiên cloud về terminal bằng `--teleport` / `/teleport`; không đẩy phiên terminal đang chạy lên cloud được.
- Có gói Pro, Max, Ultra, Team (và Enterprise với seat phù hợp).
- Mạng và biến môi trường của cloud do **environment** quyết định (allowlist host, setup script) — giống cách app Learning Hub này được cập nhật tự động.

:::warning Cloud không có máy bạn
Phiên cloud không thấy file chưa push, `.env` cục bộ, hay MCP server chạy trên laptop. Nếu task cần những thứ đó → chạy local, hoặc Remote Control.
:::

## Remote Control

Chạy `/remote-control` (hoặc khởi động với `--remote-control`) → mở phiên từ claude.ai/code hoặc app Claude trên điện thoại. Claude **vẫn chạy trên máy bạn**: file, MCP server, công cụ cục bộ đều dùng được; máy ngủ hoặc rớt mạng thì tự kết nối lại khi máy online.

:::tip Đừng nhầm
`--cloud` = tạo phiên **chạy trên cloud**. `--remote-control` = điều khiển phiên **chạy trên máy bạn** từ xa.
:::

## Chuyển qua lại

- `/desktop` — chuyển phiên terminal sang desktop app (macOS/Windows x64).
- `/teleport` — kéo phiên cloud về terminal.
- `/mobile` — mã QR tải app Claude.

:::senior Góc nhìn senior
Chọn giao diện theo **nơi dữ liệu và công cụ nằm**, không theo sở thích: cần DB local, VPN công ty, secret cục bộ → chạy local (hoặc Remote Control). Repo public/GitHub và việc tự chứa (fix lint, nâng dependency, viết test) → cloud để chạy song song và không chiếm máy. Dự án khách hàng nhạy cảm: kiểm tra chính sách trước khi cho code rời máy.
:::

:::quiz Bạn muốn ngồi ngoài quán cà phê dùng điện thoại tiếp tục một phiên đang dùng MCP server kết nối DB nội bộ trên laptop ở nhà. Chọn gì?
- [ ] `claude --cloud`
- [x] Remote Control — phiên vẫn chạy trên laptop, điện thoại chỉ là cửa sổ điều khiển
- [ ] Desktop app
- [ ] `claude -p`

Cloud session không truy cập được MCP server và mạng nội bộ trên laptop.
:::

:::quiz Trong VS Code, cách nhanh để chỉ Claude đúng dòng 40–60 của một file?
- [ ] Copy đoạn code dán vào chat
- [x] Chọn đoạn code (Claude tự thấy selection) hoặc `Alt+K`/`Option+K` để chèn `@file.ts#40-60`
- [ ] Đổi tên file
- [ ] Mở terminal riêng

Extension đưa selection và tham chiếu dòng vào prompt.
:::

:::interview Khi nào bạn giao việc cho cloud session thay vì chạy local?
Khi task tự chứa trong repo trên GitHub, kiểm tra được bằng test/build trong môi trường cloud, và không cần tài nguyên chỉ có trên máy (secret, VPN, DB local). Lợi ích: chạy song song, không chiếm máy, chạy cả khi tắt máy, có thể tự theo dõi và sửa PR. Ngược lại, task cần môi trường cục bộ thì chạy local hoặc Remote Control.
:::

:::exercise Chọn giao diện cho ba tình huống
(1) Fix 20 lỗi lint trong repo GitHub công khai trong lúc bạn họp. (2) Debug lỗi chỉ tái hiện với backend chạy local qua VPN. (3) Review diff một refactor lớn trước khi commit.
???
(1) Cloud session (`claude --cloud "fix lint errors, run npm run lint until clean, open a PR"`). (2) Local (terminal/VS Code) — cần VPN và backend local; đi xa thì Remote Control. (3) VS Code extension hoặc desktop app để xem diff trực quan, kết hợp `/code-review`.
:::

> Nguồn: *How Claude Code works* — mục "Environments and interfaces"; *Use Claude Code in VS Code*; *JetBrains IDEs*; *Use Claude Code in the cloud*; *Remote Control*; *Desktop application* — code.claude.com/docs (truy cập 11/11/2026).
