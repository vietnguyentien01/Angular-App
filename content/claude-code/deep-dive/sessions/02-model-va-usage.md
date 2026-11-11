---
title: Chọn model, fast mode và theo dõi usage — làm nhiều hơn với cùng ngân sách
summary: Các alias model (opus, sonnet, haiku, fable, opusplan, [1m]), cách đặt model mặc định, fast mode đổi chi phí lấy tốc độ, đọc /usage và /context, và danh sách biện pháp giảm token theo tài liệu — để chọn đúng công cụ cho đúng việc.
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, models, cost, usage, fast-mode]
related: [claude-code/deep-dive/sessions/chi-phi-va-subagent, claude-code/consolidate/sessions/context-window-va-checkpoint]
---

## TL;DR

- Alias thay vì số phiên bản: `opus` (suy luận mạnh), `sonnet` (việc code hằng ngày, rẻ hơn), `haiku` (nhanh, rẻ — hợp subagent đơn giản), `fable` (việc khó và dài nhất), `opusplan` (opus khi plan, sonnet khi làm).
- Chi phí token tăng theo **kích thước context** — quản lý context là cách tiết kiệm lớn nhất.
- `/usage` cho số liệu thật; gói subscription thì xem **hạn mức gói**, con số đô-la phiên chỉ có ý nghĩa với API.

## Alias model

| Alias | Hành vi |
|---|---|
| `default` | Xoá mọi ghi đè, về mặc định theo tài khoản |
| `opus` (`best`) | Opus mới nhất — suy luận phức tạp, quyết định kiến trúc |
| `sonnet` | Sonnet mới nhất — phần lớn việc code |
| `haiku` | Haiku — việc đơn giản, nhanh, rẻ |
| `fable` | Fable — việc khó nhất, chạy dài nhất |
| `opusplan` | `opus` trong plan mode, tự chuyển `sonnet` khi thực thi |
| `sonnet[1m]`, `opus[1m]` | Bản context 1 triệu token (không có tác dụng nếu model mới đã có sẵn 1M) |

Alias trỏ tới bản khuyến nghị của **nhà cung cấp** và thay đổi theo thời gian (trên Bedrock/Vertex/Foundry có thể là bản cũ hơn). Cần cố định: dùng ID đầy đủ hoặc biến `ANTHROPIC_DEFAULT_OPUS_MODEL`…

Đặt model:

- Trong phiên: `/model sonnet` (lưu làm mặc định cho phiên mới), `Option+P`/`Alt+P` để chuyển nhanh.
- Khởi động: `claude --model opus`.
- Settings: `"model": "sonnet"`; biến môi trường `ANTHROPIC_MODEL` thắng khoá `model` trong file.
- Tổ chức có thể giới hạn danh sách model được dùng.

## Effort (nhắc lại)

`low` → `medium` (mặc định trên các model mới) → `high` → `xhigh` → `max`. `max` dễ "nghĩ quá" và tốn hơn mà không chắc tốt hơn — thử trước khi dùng rộng. Một lượt cần nghĩ sâu: `ultrathink` trong prompt. Chi tiết ở bài *Effort, model, subagent và chi phí context*.

## Fast mode

- Cùng model, cấu hình API ưu tiên tốc độ: **nhanh tới ~2,5 lần**, **giá mỗi token cao hơn**; chất lượng không đổi.
- Bật/tắt: `/fast`, `Option+O`/`Alt+O`. Chỉ một số model hỗ trợ.
- Hợp: lặp nhanh tương tác, debug trực tiếp. Không hợp: job chạy nền dài, nơi tốc độ không quan trọng bằng chi phí.

## Đọc số liệu

| Công cụ | Cho biết |
|---|---|
| `/usage` | Phiên: chi phí ước tính (theo giá niêm yết), thời gian, dòng code; với gói Pro/Max/Team…: hạn mức gói và phần nào đang tiêu hạn mức |
| `/context` | Context hiện tại bị chiếm bởi gì + gợi ý |
| Token cạnh spinner | Lượng token của lượt đang chạy |
| Status line | Hiện usage/context liên tục (`/statusline`) |
| `--output-format json` (với `-p`) | `total_cost_usd` và chi phí theo model — cho script |

## Giảm token (theo tài liệu)

1. **`/clear` giữa các task** (đặt `/rename` trước để tìm lại).
2. **`/compact` có trọng tâm**, hoặc chỉ dẫn compact trong CLAUDE.md.
3. **Chọn model vừa đủ**: Sonnet cho việc thường, Haiku cho subagent đơn giản.
4. **Giảm overhead MCP**: tắt server không dùng; ưu tiên CLI khi có.
5. **Code intelligence plugin** cho ngôn ngữ có type → ít phải đọc file để tìm ký hiệu.
6. **Đẩy xử lý sang hook/skill**: vd hook lọc output test chỉ còn phần fail trước khi Claude đọc.
7. **Chuyển chỉ dẫn từ CLAUDE.md sang skill** nếu chỉ dùng thỉnh thoảng.
8. **Giao việc nhiều output cho subagent** — chỉ tóm tắt quay về.

:::senior Góc nhìn senior
Đo trước khi tối ưu: xem `/usage` và `/context` một tuần để biết tiền đi đâu (thường là context phình vì đọc file thừa, MCP server không dùng, phiên dài không `/clear`). Đổi model là đòn bẩy lớn nhưng thô — giữ model mạnh cho phần cần phán đoán (plan, review), dùng model rẻ cho phần cơ học (subagent tìm kiếm, sửa lint).
:::

:::quiz Bạn muốn kế hoạch được lập bởi model mạnh nhưng phần viết code dùng model rẻ hơn, tự động. Chọn gì?
- [ ] `haiku`
- [x] `opusplan`
- [ ] `sonnet[1m]`
- [ ] Bật fast mode

`opusplan` dùng opus trong plan mode và sonnet khi thực thi.
:::

:::quiz Fast mode đánh đổi điều gì?
- [ ] Chất lượng thấp hơn để nhanh hơn
- [x] Nhanh hơn (tới ~2,5 lần) với giá mỗi token cao hơn; chất lượng giữ nguyên
- [ ] Context nhỏ hơn
- [ ] Không dùng được công cụ

Cùng model, khác cấu hình API.
:::

:::exercise Lập "chế độ" cho ba loại việc
Đề xuất model + effort + fast mode cho: (1) debug trực tiếp một lỗi UI khi đang pair, (2) subagent tìm mọi chỗ dùng một API cũ, (3) thiết kế lại kiến trúc state của một feature lớn.
???
(1) `sonnet` hoặc `opus` mặc định, effort `medium`, **bật fast mode** vì cần phản hồi nhanh. (2) Subagent `model: haiku`, effort thấp, yêu cầu trả danh sách ngắn `file:line`. (3) `opus` (hoặc `opusplan`) trong plan mode, effort `high`/`xhigh`, không cần fast mode; review kế hoạch kỹ trước khi thực thi.
:::

> Nguồn: *Model configuration* — code.claude.com/docs/en/model-config; *Speed up responses with fast mode* — /fast-mode; *Manage costs effectively* — /costs (truy cập 11/11/2026).
