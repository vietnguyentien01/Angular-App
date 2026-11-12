---
title: Bên trong Claude Code — model không nhớ gì, context được gửi lại mỗi lượt, và prompt caching
summary: "Mô hình tư duy để dùng Claude Code như người hiểu nghề: mỗi lượt gửi lại toàn bộ context theo ba lớp, system reminder, prompt caching theo tiền tố và thao tác làm vỡ cache, TTL 5 phút/1 giờ, tool search, và vì sao sửa CLAUDE.md giữa phiên không có tác dụng ngay."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, internals, prompt-caching, context-window]
related: [claude-code/consolidate/sessions/context-window-va-checkpoint, claude-code/deep-dive/sessions/model-va-usage]
---

## TL;DR

- Model **không nhớ** giữa các request. Mỗi lượt, Claude Code gửi lại **toàn bộ**: system prompt, bối cảnh dự án, toàn bộ hội thoại và kết quả công cụ, cộng tin nhắn mới.
- **Prompt caching** tái dùng phần đầu (tiền tố) không đổi → nhanh và rẻ hơn. Một thay đổi ở đầu làm tính lại **mọi thứ phía sau**.
- Chọn model + effort **ở đầu phiên**, để dành `/compact` cho lúc chuyển việc; đổi giữa chừng làm vỡ cache.

## Ba lớp của mỗi request

| Lớp | Nội dung | Đổi khi |
|---|---|---|
| System prompt | Chỉ dẫn lõi, định nghĩa công cụ | Bộ công cụ được nạp thay đổi |
| Bối cảnh dự án | CLAUDE.md, auto memory, rule không có `paths` | Bắt đầu phiên, sau `/clear` hoặc `/compact` |
| Hội thoại | Tin nhắn của bạn, câu trả lời, kết quả công cụ | Mỗi lượt |

Lớp càng ít đổi càng đứng trước. Thay đổi ở lớp hội thoại giữ nguyên cache của hai lớp trên; thay đổi system prompt làm vỡ **tất cả**.

## System reminder: chỉ dẫn bạn không viết

Trong lúc làm, Claude Code tự chèn ngữ cảnh vào hội thoại, ví dụ:

- Nội dung CLAUDE.md, chỉ dẫn của output style.
- Thông báo một file Claude đã đọc vừa bị đổi trên đĩa.
- Dòng ghi công (attribution) cho commit/PR — đổi bằng setting `attribution`; bỏ hướng dẫn git có sẵn bằng `includeGitInstructions`.

Nếu Claude làm theo một quy tắc bạn không hề viết (vd thêm `Co-Authored-By`), nguồn thường là system reminder.

## Prompt caching hoạt động thế nào

API so khớp **chính xác phần đầu** của request với nội dung vừa xử lý gần đây. Lượt bình thường: tiền tố là toàn bộ request trước, chỉ phần trao đổi mới phải xử lý; phần đọc lại từ cache tính giá rẻ hơn.

### Làm vỡ cache

| Thao tác | Vì sao |
|---|---|
| Đổi model | Mỗi model có cache riêng |
| Đổi effort | Trên nhiều model, mỗi mức effort có cache riêng (một số model mới giữ được cache khi đổi effort) |
| Bật fast mode | Cấu hình API khác |
| Thêm/gỡ MCP server, bật/tắt plugin có MCP | Đổi bộ định nghĩa công cụ trong system prompt |
| Deny cả một công cụ | Công cụ bị gỡ khỏi system prompt |
| Compact hội thoại | Hội thoại được thay bằng bản tóm tắt |
| Tích luỹ rất nhiều ảnh | — |
| Nâng cấp Claude Code | System prompt có thể đổi |

### Giữ nguyên cache

Sửa file trong repo · sửa CLAUDE.md giữa phiên · đổi permission mode · đổi output style · gọi skill và lệnh · `/recap` · `/rewind`.

:::warning Sửa CLAUDE.md giữa phiên không áp dụng ngay
CLAUDE.md ở gốc dự án và của user được đọc **một lần** lúc bắt đầu phiên. Sửa giữa chừng không làm vỡ cache nhưng cũng **không có tác dụng** — Claude vẫn dùng bản đã nạp. Bản mới nạp ở lần `/clear`, `/compact` hoặc phiên sau. (CLAUDE.md thư mục con và rule có `paths` thì nạp lúc cần, nên sửa trước khi chúng được nạp vẫn có tác dụng.)
:::

## Cache sống bao lâu (TTL)

| Loại request | Gói Claude, trong hạn mức | API key, usage credits, cloud provider |
|---|---|---|
| Hội thoại chính | 1 giờ | 5 phút |
| Còn lại (subagent, compact…) | 5 phút | 5 phút |

Hết hạn mức gói và chuyển sang usage credits → hội thoại chính về 5 phút. Tự chọn: setting `promptCacheTtl` (hội thoại chính) và `subagentPromptCacheTtl` (`5m` hoặc `1h`). Đó là lý do lượt đầu tiên sau khi bạn đi uống cà phê thường chậm hơn.

## Đo cache

- `/usage` → dòng **Prompt cache (main)**: tỉ lệ hit, số lần miss, cache còn "ấm" không.
- Status line đọc được `cache_read_input_tokens` (đọc từ cache — rẻ) và `cache_creation_input_tokens` (ghi cache). Tỉ lệ đọc/ghi cao = cache hoạt động tốt; ghi cao liên tục = có thứ gì đó đổi ở tiền tố.

## Tool search: vì sao nhiều MCP không làm nổ context

Định nghĩa công cụ MCP mặc định được **hoãn nạp**: chỉ tên tool và instructions của server chiếm context; Claude tìm và nạp định nghĩa đầy đủ khi cần. Mô tả skill cũng vậy — nội dung đầy đủ chỉ nạp khi dùng.

## Hệ quả thực hành

1. Chọn model/effort đầu phiên; dùng `opusplan` thay vì đổi tay giữa plan và code.
2. Cài/gỡ MCP và plugin **giữa** các task, không phải giữa một task.
3. Quy tắc phải sống suốt phiên → CLAUDE.md (đọc lại sau compact), không chỉ nói trong chat.
4. Đổi CLAUDE.md xong muốn áp dụng ngay → `/clear` (hoặc phiên mới).
5. Nghỉ dài → lượt đầu tiên sau đó tốn hơn; với API key cân nhắc `promptCacheTtl: "1h"` cho phiên làm việc dài.

:::senior Góc nhìn senior
Hiểu "model không trạng thái + context gửi lại mỗi lượt" giải thích gần hết hành vi khó hiểu: vì sao chỉ dẫn đầu phiên phai dần, vì sao `/clear` làm Claude "thông minh lại", vì sao subagent rẻ cho context chính nhưng không rẻ tổng thể, vì sao đổi model giữa chừng làm lượt sau chậm. Giải thích được những điều này cho team là dấu hiệu bạn dùng công cụ ở mức kỹ sư, không phải người dùng.
:::

:::quiz Bạn vừa thêm một dòng vào CLAUDE.md giữa phiên nhưng Claude không làm theo. Cách nhanh nhất để áp dụng?
- [ ] Đợi vài lượt
- [x] `/clear` (hoặc `/compact`, hoặc mở phiên mới) để CLAUDE.md được nạp lại
- [ ] Đổi model
- [ ] Viết IN HOA

CLAUDE.md gốc được đọc một lần lúc bắt đầu phiên.
:::

:::quiz Thao tác nào **không** làm vỡ prompt cache?
- [ ] Đổi model giữa task
- [ ] Thêm một MCP server
- [x] Đổi permission mode bằng Shift+Tab
- [ ] Compact hội thoại

Đổi permission mode, output style, gọi skill và sửa file đều giữ cache.
:::

:::exercise Quan sát cache bằng số liệu
Trong cc-lab: (1) làm 3 lượt hỏi đáp rồi xem `/usage` (dòng Prompt cache); (2) đổi model bằng `/model` rồi hỏi tiếp một câu, xem lại `/usage`; (3) thêm một MCP server giữa phiên, hỏi tiếp, xem lại. Giải thích con số bằng bảng "Làm vỡ cache".
???
(1) Tỉ lệ hit tăng dần sau lượt đầu vì tiền tố lặp lại. (2) Sau khi đổi model, lượt kế tiếp là miss (model mới có cache riêng) → tốn và chậm hơn. (3) Thêm MCP đổi bộ công cụ → system prompt đổi → miss toàn bộ. Rút ra: sắp xếp các thao tác đổi cấu hình vào lúc chuyển task. Muốn thấy theo thời gian thực: thêm `cache_read_input_tokens` vào status line.
:::

> Nguồn: *How Claude Code uses prompt caching*, *How Claude Code works*, *Explore the context window* — code.claude.com/docs (truy cập 12/11/2026).
