---
title: Cách lệnh hoạt động — cú pháp, đối số, alias, xếp hàng, và bản đồ lệnh theo quy trình
summary: "Trước khi tra từng lệnh: lệnh chỉ chạy khi nằm đầu tin nhắn, [arg] và <arg> nghĩa là gì, alias, lệnh ẩn, lệnh gửi khi Claude đang làm sẽ đi đâu, xâu chuỗi nhiều skill, và bản đồ dùng lệnh nào ở giai đoạn nào của một task."
type: lesson
level: core
lastReviewed: 2026-11-11
tags: [claude-code, commands, reference]
related: [claude-code/commands/commands/lenh-phien-va-hoi-thoai, claude-code/review/interface/slash-commands-can-biet]
---

## Ba loại "lệnh" trong Claude Code

| Loại | Gõ ở đâu | Ví dụ | Bài tra cứu |
|---|---|---|---|
| **Slash command** | Ô nhập **trong** phiên | `/clear`, `/model sonnet` | Bài 2–6 của phần này |
| **Lệnh `claude`** | **Shell** (terminal thường) | `claude -c`, `claude mcp list` | Bài 7 |
| **Flag dòng lệnh** | Shell, khi khởi động | `claude --permission-mode plan` | Bài 8 |
| **Phím tắt** | Trong phiên | `Esc`, `Shift+Tab` | Bài 9 |

## Đọc cú pháp

Trong bảng tra cứu và tài liệu chính thức:

- `<arg>` — đối số **bắt buộc**: `/add-dir <path>`.
- `[arg]` — đối số **tuỳ chọn**: `/clear [name]`.
- `a|b|c` — chọn một: `/fast [on|off]`.
- Mọi chữ sau tên lệnh trở thành đối số: `/compact giữ lại các thay đổi API` → đối số là "giữ lại các thay đổi API".

## Quy tắc chạy lệnh

1. **Chỉ nhận ở đầu tin nhắn.** `/clear` đầu dòng thì chạy; `hãy /clear giúp mình` thì không — đó là văn bản gửi cho Claude.
2. **Giữa câu**: gõ `/` sau dấu cách + vài chữ để được gợi ý hoàn thành tên (vd `chạy test rồi /com`), nhưng lệnh **không tự chạy**.
3. **Xâu chuỗi skill**: `/skill-a /skill-b làm XYZ` nạp cả hai skill, đoạn chữ cuối là đối số của mỗi skill — tối đa **6** skill.
4. **Gửi khi Claude đang làm**: lệnh được **xếp hàng**, chạy sau khi lượt hiện tại xong. Một số lệnh chạy **ngay** mà không ngắt: `/status`, `/tasks`, `/usage`.
5. **Không có trong menu?** Lệnh phụ thuộc nền tảng, gói, môi trường (vd `/desktop` chỉ có trên macOS/Windows x64 với gói Claude). Lệnh không dùng được trả về *Unknown command*.
6. **Lệnh ẩn** (như `/heapdump`, `/setup-bedrock`) không hiện trong menu — phải gõ đủ tên.

## Menu `/` lọc thế nào

- Gõ `/` + chữ: menu lọc theo tên và alias, bỏ qua `:`, `_`, `-` — gõ `/adddir` vẫn ra `/add-dir`, `/new` ra `/clear` (qua alias).
- Gõ sai chính tả: không có gợi ý nào được chọn sẵn; chọn bằng `Tab`/mũi tên, còn `Enter` sẽ gửi đúng chữ bạn gõ → *Unknown command*.
- Skill của plugin khớp cả tên ngắn: `/deploy` tìm thấy `myplugin:deploy-app`.

## Alias hay gặp

| Lệnh | Alias |
|---|---|
| `/clear` | `/reset`, `/new` |
| `/rewind` | `/checkpoint`, `/undo` |
| `/usage` | `/cost`, `/stats` |
| `/config` | `/settings` |
| `/permissions` | `/allowed-tools` |
| `/code-review` | `/review` |
| `/doctor` | `/checkup` |
| `/exit` | `/quit` |
| `/background` | `/bg` |
| `/tasks` | `/bashes` |
| `/loop` | `/proactive` |
| `/schedule` | `/routines` |
| `/remote-control` | `/rc` |
| `/teleport` | `/tp` |
| `/desktop` | `/app` |
| `/mobile` | `/ios`, `/android` |
| `/restart` | `/update` |
| `/list-agents` | `/peers` |

## Ba nguồn lệnh trong menu

- **Built-in**: hành vi viết sẵn trong CLI (`/clear`, `/model`…).
- **Skill có sẵn (bundled)**: thực chất là prompt giao cho Claude (`/code-review`, `/simplify`, `/loop`, `/doctor`…). Bạn cũng tự viết skill thành lệnh riêng.
- **Plugin / MCP**: plugin thêm skill dạng `/plugin:ten`; MCP server có thể thêm *prompt* xuất hiện như lệnh.

## Bản đồ lệnh theo quy trình

| Giai đoạn | Lệnh |
|---|---|
| Phiên đầu tiên trong repo | `/init` → `/memory` → `/mcp` → `/permissions` |
| Trong lúc làm task | `/plan`, `/model`, `/effort`, `/context`, `/compact`, `/btw` |
| Làm song song | `/tasks`, `/background`, `/fork`, `/subtask`, `/batch` |
| Trước khi ship | `/diff`, `/code-review`, `/security-review`, `/simplify` |
| Giữa các phiên | `/clear`, `/resume`, `/branch`, `/rename`, `/teleport`, `/remote-control` |
| Khi có sự cố | `/rewind`, `/doctor`, `/debug`, `/status`, `/feedback` |

:::quiz Bạn gõ: `nhớ chạy test rồi /compact`. Điều gì xảy ra?
- [ ] Claude Code chạy `/compact`
- [x] Không lệnh nào chạy — lệnh chỉ được nhận ở đầu tin nhắn; cả câu được gửi cho Claude
- [ ] Báo Unknown command
- [ ] Chạy `/compact` sau khi test xong

Muốn compact thì gửi `/compact` thành một tin nhắn riêng.
:::

:::quiz Claude đang chạy một lượt dài, bạn gõ `/usage`. Kết quả?
- [ ] Lượt bị huỷ
- [x] `/usage` chạy ngay mà không ngắt lượt (cùng nhóm với `/status`, `/tasks`)
- [ ] Bị xếp hàng tới cuối phiên
- [ ] Báo lỗi

Phần lớn lệnh khác thì được xếp hàng chạy sau lượt hiện tại.
:::

:::exercise Khám phá menu lệnh trong 10 phút
Mở một phiên trong dự án bất kỳ và làm: (1) gõ `/` và cuộn xem toàn bộ menu, đếm xem có bao nhiêu lệnh do skill/plugin thêm vào; (2) gõ `/adddir` xem menu chọn gì; (3) gõ `/new` và xem nó trỏ tới lệnh nào; (4) gõ `/heapdum` (thiếu chữ) và quan sát; (5) gõ `?` khi ô nhập trống.
???
(1) Mục đánh dấu Skill/Workflow là bundled skill; lệnh có dấu `:` thường là của plugin. (2) Menu chọn `/add-dir` vì bỏ qua dấu `-`. (3) `/new` là alias của `/clear`. (4) Lệnh ẩn không hiện khi gõ thiếu — chỉ chạy khi gõ đủ `/heapdump` (đừng chạy nếu không cần: nó ghi heap snapshot chứa cả hội thoại). (5) `?` mở bảng phím tắt.
:::

> Nguồn: *Commands* — code.claude.com/docs/en/commands; *Interactive mode* (truy cập 11/11/2026).
