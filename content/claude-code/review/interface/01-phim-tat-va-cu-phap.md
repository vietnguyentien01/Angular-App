---
title: Phím tắt và cú pháp trong ô nhập — @, !, /, Esc, Shift+Tab
summary: Những phím và ký tự bạn dùng hằng ngày trong terminal của Claude Code — tham chiếu file bằng @, chạy lệnh shell bằng !, gõ nhiều dòng, dán ảnh, xếp hàng tin nhắn khi Claude đang làm, hỏi ngoài lề bằng /btw.
type: cheatsheet
level: core
lastReviewed: 2026-11-11
tags: [claude-code, beginner, keyboard, interactive-mode]
related: [claude-code/review/interface/slash-commands-can-biet, claude-code/review/sessions/dieu-khien-phien]
---

## TL;DR

`@` gắn file · `!` chạy lệnh shell · `/` lệnh và skill · `Esc` dừng · `Esc Esc` rewind · `Shift+Tab` đổi permission mode · `\` + `Enter` xuống dòng · `Ctrl+V` dán ảnh · `?` xem phím tắt.

## Ký tự đầu dòng

| Gõ | Tác dụng |
|---|---|
| `/` ở đầu | Lệnh hoặc skill (gõ tiếp để lọc; `Tab` để hoàn thành) |
| `!` ở đầu | **Shell mode**: chạy lệnh trực tiếp, output được đưa vào phiên để Claude phản hồi. Vd `! npm test` |
| `@` | Gợi ý đường dẫn file/thư mục để tham chiếu |
| `?` khi ô nhập trống | Bật/tắt bảng phím tắt |

### `@` — đưa file vào ngay

```text
Giải thích logic trong @src/app/core/auth/auth.interceptor.ts
```

```text
Cấu trúc của @src/app/features là gì?
```

- File được đưa thẳng vào hội thoại (nếu vừa giới hạn của công cụ Read, mặc định 25.000 token) → Claude không phải tự đi tìm.
- `@thư-mục` để hỏi về cấu trúc thư mục; `@server:resource` lấy dữ liệu từ MCP server đã kết nối.
- Tham chiếu `@` còn nạp kèm các `CLAUDE.md` ở thư mục của file và thư mục cha.

## Điều khiển phiên

| Phím | Tác dụng |
|---|---|
| `Esc` | Dừng Claude giữa chừng (huỷ lệnh đang chạy), giữ lại phần đã làm để bạn chỉnh hướng |
| `Esc` `Esc` | Ô nhập có chữ: xoá bản nháp (lưu vào lịch sử, `↑` để lấy lại). Ô nhập trống: mở menu **rewind** |
| `Shift+Tab` | Xoay vòng permission mode (Windows có thể là `Alt+M`) |
| `Ctrl+C` | Ngắt; khi không có gì chạy: lần 1 xoá ô nhập, lần 2 thoát |
| `Ctrl+D` (hai lần) | Thoát phiên |
| `Ctrl+L` | Vẽ lại màn hình khi bị lỗi hiển thị (giữ nguyên hội thoại) |
| `Ctrl+O` | Bật/tắt transcript chi tiết (từng lần gọi công cụ) |
| `Ctrl+T` | Bật/tắt danh sách việc (to-do) Claude đang theo |
| `Ctrl+B` | Đưa lệnh Bash/agent đang chạy xuống nền (tmux: nhấn hai lần) |
| `Ctrl+R` | Tìm ngược trong lịch sử lệnh |
| `Ctrl+G` | Mở prompt (hoặc plan) trong editor mặc định để soạn dài |
| `Ctrl+S` | Cất tạm bản nháp; nhấn lại ở ô trống để lấy ra |
| `Option+P` / `Alt+P` | Đổi model mà không mất prompt đang gõ |

## Gõ nhiều dòng

| Cách | Ghi chú |
|---|---|
| `\` rồi `Enter` | Chạy ở mọi terminal |
| `Ctrl+J` | Chạy ở mọi terminal, không cần cấu hình |
| `Shift+Enter` | Có sẵn ở iTerm2, WezTerm, Ghostty, Kitty, Warp, Apple Terminal, Windows Terminal; terminal khác (vd terminal tích hợp của VS Code) chạy `/terminal-setup` |
| Dán trực tiếp | Cho code block, log dài |

## Ảnh

- Kéo thả ảnh vào cửa sổ, hoặc copy rồi `Ctrl+V` (Windows/WSL: `Alt+V`; iTerm2: `Cmd+V`) → chèn chip `[Image #1]`.
- Hoặc đưa đường dẫn: *"Phân tích ảnh /tmp/loi-layout.png"*.
- Dùng cho: ảnh chụp lỗi, mockup cần dựng lại, sơ đồ kiến trúc.

## Xếp hàng tin nhắn khi Claude đang làm

Gõ tin nhắn và `Enter` trong lúc Claude đang chạy → tin nhắn được **xếp hàng** (hiện màu xám), Claude đọc ngay khi các lệnh hiện tại xong, **trong cùng lượt**, rồi điều chỉnh. Không cần `Esc` nếu chỉ muốn bổ sung thông tin. `Ctrl+Enter` gửi các tin đang chờ ngay lập tức.

## Hỏi ngoài lề: `/btw`

```text
/btw cái file config môi trường lúc nãy tên gì nhỉ?
```

Claude trả lời từ những gì **đã có** trong hội thoại, và câu hỏi **không** được thêm vào lịch sử → không làm bẩn context của task chính.

## Lỗi hay gặp

:::warning Nhấn Enter để xuống dòng
Ở nhiều terminal, `Enter` sẽ **gửi** prompt dở dang. Tập dùng `\`+`Enter` hoặc `Ctrl+J`, hoặc soạn prompt dài trong editor với `Ctrl+G`.
:::

:::quiz Claude đang chạy test và bạn chợt nhớ ra "nhớ bỏ qua thư mục e2e". Cách ít gián đoạn nhất?
- [ ] Nhấn `Ctrl+C` hai lần rồi mở phiên mới
- [x] Gõ câu đó và `Enter` — tin nhắn được xếp hàng, Claude đọc ngay sau khi lệnh hiện tại xong
- [ ] Đợi Claude làm xong rồi `/clear`
- [ ] Sửa `CLAUDE.md` rồi khởi động lại

Xếp hàng tin nhắn cho phép chỉnh hướng mà không dừng công việc; `Esc` khi cần dừng hẳn.
:::

:::quiz Bạn muốn Claude xem output của `ng build` do chính bạn chạy, ngay trong phiên. Cách nhanh nhất?
- [ ] Copy output rồi dán
- [x] Gõ `! ng build` — shell mode chạy lệnh và đưa output vào phiên
- [ ] `/build`
- [ ] `@ng build`

`!` ở đầu dòng chạy lệnh trực tiếp; output thành bối cảnh để Claude phản hồi.
:::

:::quiz `Esc` nhấn hai lần khi ô nhập đang **trống** làm gì?
- [ ] Thoát Claude Code
- [ ] Xoá toàn bộ hội thoại không thể khôi phục
- [x] Mở menu rewind để quay code và/hoặc hội thoại về một prompt trước
- [ ] Đổi model

Khi ô nhập có chữ, `Esc Esc` chỉ xoá bản nháp.
:::

:::interview Vì sao `/btw` hữu ích hơn hỏi bình thường khi đang giữa một task dài?
Câu hỏi bình thường thêm vào lịch sử hội thoại — chiếm context và có thể làm Claude lệch khỏi task. `/btw` trả lời từ những gì đã có trong phiên mà **không** ghi vào lịch sử, nên context của task chính vẫn sạch.
:::

:::exercise Năm thao tác bàn phím trong cc-lab
(1) Gõ `@src/app/tasks/` và dùng `Tab` để chọn `task-store.ts`, hỏi "giải thích file này"; (2) `! npm test -- --watch=false` rồi hỏi "test nào chậm nhất?"; (3) trong lúc Claude đang trả lời, gõ "trả lời ngắn thôi" + `Enter` (xếp hàng); (4) soạn một prompt 5 dòng bằng `Ctrl+G`; (5) `/btw` hỏi "file nào định nghĩa Task?".
???
Kỳ vọng: (1) nội dung file được đưa thẳng vào, Claude không cần tự tìm; (2) output test thành bối cảnh, Claude trả lời dựa trên đó; (3) tin nhắn hiện màu xám rồi được Claude đọc ngay sau khi lệnh đang chạy xong; (4) editor mở, lưu và đóng thì nội dung về ô nhập; (5) câu trả lời không xuất hiện trong lịch sử khi bạn `/export`.
:::

> Nguồn: *Interactive mode* — code.claude.com/docs/en/interactive-mode; *Common workflows* — mục "Work with images", "Reference files and directories" (truy cập 11/11/2026).
