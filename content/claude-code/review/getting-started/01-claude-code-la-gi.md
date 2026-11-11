---
title: Claude Code là gì — agentic loop, công cụ và những gì Claude được truy cập
summary: Claude Code không phải chatbot dán code — nó là một agent đọc repo, chạy lệnh, sửa file và tự kiểm tra trong một vòng lặp. Hiểu vòng lặp, năm nhóm công cụ, Claude thấy gì trong máy bạn và hai cơ chế an toàn trước khi gõ lệnh đầu tiên.
type: lesson
level: core
lastReviewed: 2026-11-11
tags: [claude-code, beginner, agentic-loop, tools]
related: [claude-code/review/getting-started/cai-dat-va-dang-nhap, claude-code/review/principles/ai-la-cong-cu]
---

## TL;DR

- Claude Code là **agentic coding assistant**: bạn mô tả mục tiêu, Claude tự **thu thập bối cảnh → hành động → kiểm tra kết quả**, lặp lại cho tới khi xong. Bạn có thể ngắt và chỉnh hướng bất kỳ lúc nào.
- Sức mạnh đến từ **model** (suy luận) + **tool** (hành động). Claude Code là lớp bao quanh model: cung cấp công cụ và quản lý context.
- Nó làm được mọi thứ bạn làm được trên terminal — nên **quyền** và **checkpoint** là hai thứ phải hiểu ngay từ đầu.

## Khác gì so với chat với AI trên web?

| Chat thông thường | Claude Code |
|---|---|
| Bạn copy code vào, copy câu trả lời ra | Claude **tự đọc** file trong repo khi cần — bạn không phải dán context |
| Không chạy được gì | Chạy build, test, `git`, `npm`… rồi đọc output để quyết định bước tiếp |
| Bạn tự kiểm tra code có chạy không | Claude có thể tự chạy test và sửa tới khi pass (nếu bạn cho nó cách kiểm tra) |
| Một câu hỏi — một câu trả lời | Một **task** — nhiều bước, nhiều lần gọi công cụ |

## Vòng lặp agentic

Khi bạn nói "sửa các test đang fail", Claude có thể:

1. Chạy bộ test để xem cái nào fail
2. Đọc output lỗi
3. Tìm file nguồn liên quan
4. Đọc các file đó để hiểu code
5. Sửa file
6. Chạy lại test để xác minh

Mỗi lần dùng công cụ trả về thông tin mới, quyết định bước tiếp theo. Một câu hỏi về codebase có thể chỉ cần bước "thu thập"; một bug fix sẽ lặp cả ba pha nhiều lần.

:::tip Bạn cũng là một phần của vòng lặp
Nhấn `Esc` để dừng ngay; hoặc gõ thêm một câu sửa hướng rồi `Enter` **mà không dừng** — tin nhắn được xếp hàng và Claude đọc nó ngay sau khi các lệnh đang chạy xong.
:::

## Năm nhóm công cụ có sẵn

| Nhóm | Claude làm được |
|---|---|
| File operations | Đọc, sửa, tạo file, đổi tên, sắp xếp lại |
| Search | Tìm file theo pattern, tìm nội dung bằng regex, khám phá codebase |
| Execution | Chạy lệnh shell, start server, chạy test, dùng git |
| Web | Tìm kiếm web, đọc tài liệu, tra thông báo lỗi |
| Code intelligence | Thấy lỗi type sau khi sửa, nhảy tới định nghĩa, tìm reference (cần cài *code intelligence plugin*) |

Ngoài ra còn công cụ để gọi **subagent**, **hỏi lại bạn**, quản lý danh sách việc… Bạn mở rộng thêm bằng skill, MCP, hook, plugin (học ở phần Nâng cao).

## Claude thấy được gì khi bạn chạy `claude` trong một thư mục?

- **Project**: file trong thư mục và thư mục con; file ở chỗ khác thì phải được bạn cho phép.
- **Terminal**: mọi lệnh bạn chạy được.
- **Git state**: nhánh hiện tại, thay đổi chưa commit, lịch sử commit gần đây.
- **`CLAUDE.md`**: file hướng dẫn của dự án, nạp ở đầu mỗi phiên (repo chỉ có `AGENTS.md` thì Claude cũng đọc được).
- **Auto memory**: ghi chú Claude tự lưu qua các phiên — 200 dòng hoặc 25KB đầu của `MEMORY.md` được nạp mỗi phiên.
- **Extension bạn cấu hình**: MCP server, skill, subagent…

## Model nào đang làm việc?

Có nhiều model với trade-off khác nhau: **Sonnet** tốt cho phần lớn việc code, **Opus** suy luận mạnh hơn cho quyết định kiến trúc phức tạp, **Haiku** nhanh và rẻ cho việc đơn giản. Đổi bằng `/model` trong phiên hoặc `claude --model <tên>` khi khởi động.

## Hai cơ chế an toàn

1. **Checkpoint** — trước khi sửa file, Claude chụp lại nội dung cũ. Nhấn `Esc` hai lần (ô nhập trống) hoặc `/rewind` để quay lại. Checkpoint **chỉ** bao file sửa bằng công cụ sửa file — không thay thế git.
2. **Permission mode** — quyết định Claude được làm gì mà không hỏi bạn. Nhấn `Shift+Tab` để chuyển chế độ (học kỹ ở bài *Permission mode*).

## Phiên làm việc (session)

- Mỗi hội thoại được lưu cục bộ dưới dạng file JSONL trong `~/.claude/projects/` → cho phép rewind, resume, fork.
- **Mỗi phiên mới bắt đầu với context trống** — không nhớ hội thoại cũ (trừ những gì ở `CLAUDE.md` và auto memory).
- Phiên gắn với thư mục: đổi nhánh git thì Claude thấy file của nhánh mới, nhưng lịch sử hội thoại giữ nguyên.

## Chạy ở đâu?

| Môi trường | Code chạy ở | Dùng khi |
|---|---|---|
| Local | Máy bạn | Mặc định, đầy đủ quyền với file và công cụ của bạn |
| Cloud | VM do Anthropic quản lý (hoặc môi trường self-hosted của tổ chức) | Giao việc chạy nền, làm việc với repo không có trên máy |
| Remote Control | Máy bạn, điều khiển từ trình duyệt/điện thoại | Dùng giao diện web nhưng file vẫn ở máy bạn |

Giao diện: terminal (CLI), extension VS Code / JetBrains, desktop app, `claude.ai/code`, mobile. **Vòng lặp và công cụ giống nhau ở mọi nơi.**

## Lỗi hay gặp của người mới

:::warning Ra lệnh từng bước như với một script
Không cần chỉ định "đọc file A, chạy lệnh B". Hãy **giao việc như với một đồng nghiệp giỏi**: nêu mục tiêu, bối cảnh, nơi nên nhìn — rồi để Claude tự tìm đường. Ví dụ: *"Checkout bị lỗi với user có thẻ hết hạn. Code liên quan ở `src/payments/`. Điều tra và sửa giúp mình."*
:::

:::quiz Thứ tự ba pha của agentic loop là gì?
- [ ] Viết code → hỏi người dùng → commit
- [x] Thu thập bối cảnh → hành động → kiểm tra kết quả (lặp lại tới khi xong)
- [ ] Lập kế hoạch → viết toàn bộ code một lần → dừng
- [ ] Tìm web → copy đáp án → dán vào file

Ba pha đan xen và lặp lại; Claude quyết định mỗi bước cần gì dựa trên thông tin vừa nhận.
:::

:::quiz Bạn mở một phiên mới sau khi hôm qua đã giải thích cho Claude rất kỹ về module thanh toán. Claude có nhớ hội thoại hôm qua không?
- [ ] Có, Claude nhớ toàn bộ mọi phiên
- [x] Không — mỗi phiên bắt đầu với context trống; chỉ `CLAUDE.md`, auto memory được nạp lại (hoặc bạn `--resume` phiên cũ)
- [ ] Chỉ nhớ nếu bạn dùng Opus
- [ ] Có, nếu bạn không tắt máy

Điều gì phải "nhớ" lâu dài thì ghi vào `CLAUDE.md`; muốn tiếp tục đúng hội thoại cũ thì `claude --continue` / `--resume`.
:::

:::quiz Checkpoint của Claude Code có khôi phục được file bị thay đổi bởi lệnh `npm run format` (chạy qua Bash) không?
- [ ] Có, mọi thay đổi đều được ghi lại
- [x] Không chắc chắn — checkpoint chỉ theo dõi file Claude sửa bằng công cụ sửa file; file chỉ bị Bash thay đổi thì không được khôi phục
- [ ] Có, nếu bật auto mode
- [ ] Checkpoint chính là git commit

Vì vậy vẫn phải dùng git cho lịch sử lâu dài và commit thường xuyên.
:::

:::interview Giải thích ngắn gọn "agentic" trong "agentic coding tool" cho một đồng nghiệp chưa dùng?
Model chỉ sinh văn bản; "agentic" nghĩa là model được trao **công cụ** (đọc/sửa file, chạy lệnh, tìm kiếm) và chạy trong một **vòng lặp** — mỗi kết quả công cụ quay lại làm đầu vào cho bước tiếp theo — nên nó tự đi từ mục tiêu tới kết quả đã được kiểm tra, thay vì chỉ trả lời một lần. Người dùng vẫn ở trong vòng lặp: ngắt, chỉnh hướng, cấp/thu quyền.
:::

> Nguồn: *How Claude Code works* và *Overview* — code.claude.com/docs/en/how-claude-code-works, /overview (truy cập 11/11/2026).
