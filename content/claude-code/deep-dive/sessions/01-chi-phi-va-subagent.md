---
title: Effort, model, subagent và chi phí context
summary: Khi nào tăng/giảm effort, subagent đáng giá ở đâu và tốn gì, cách giảm chi phí — và những lời khuyên cũ không còn cần thiết với model hiện tại.
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, effort, subagents, cost]
related: [claude-code/review/sessions/dieu-khien-phien, claude-code/deep-dive/guardrails/mo-rong-claude-code]
---

## Effort

| Mức | Khi nào |
|---|---|
| `low` | Trao đổi nhanh, bạn review từng bước: brainstorm, phác thảo, đổi tên vài file |
| `medium` (mặc định) | Phần lớn công việc có phạm vi rõ ràng |
| `high` / `xhigh` | Đúng hay sai phụ thuộc vào các trường hợp dễ bỏ sót: bug trong code mình không viết, test chập chờn, đổi schema cần tìm mọi chỗ đọc |
| `max` | Vấn đề khó để Claude tự làm lâu (vd săn lỗ hổng bảo mật); việc thường dễ "nghĩ quá" mà không tốt hơn `high` |

Chỉ một tin nhắn cần suy nghĩ sâu → `ultrathink` trong tin đó thay vì đổi cài đặt.

## Subagent: đáng giá khi…

- Làm song song các phần **độc lập**.
- Giữ output dài (chạy toàn bộ test, tìm kiếm rộng) ra khỏi hội thoại chính.
- Cần một reviewer **chưa thấy** cách code được viết.
- Giao việc với ít quyền hơn (reviewer chỉ đọc).

Chi phí: chủ yếu là token (mỗi subagent gửi request riêng), đôi khi cả thời gian (phải tự thu thập context mà phiên chính đã có). Giảm chi phí: `model: haiku` cho việc đơn giản, yêu cầu trả tóm tắt ngắn, xem `/usage` để biết subagent nào đáng tiền.

## Những lời khuyên cũ có thể bỏ

| Lời khuyên cũ | Vì sao không còn cần |
|---|---|
| Quản lý context cực kỳ chặt | Cửa sổ 1M token và tự động compact — hiếm khi hết. Vẫn nên `/clear` giữa các task |
| Viết IMPORTANT / IN HOA | Model hiện tại làm theo câu bình thường; quy tắc cứng → hook |
| Dùng subagent để có câu trả lời tốt hơn | Cùng model, cùng việc → không tốt hơn; reviewer mới thì có ích |
| "think hard", "be thorough" | Effort mới là nút điều khiển; `ultrathink` vẫn dùng cho một lượt |
| "Đừng lười, làm tới khi xong" | Dễ gây làm quá tay; thay bằng một phép kiểm tra cần pass |
| Mô tả kiến trúc trong `CLAUDE.md` | Claude tự đọc repo |

:::quiz Bạn cần Claude tìm bug trong một module legacy không ai trong team viết. Nên chỉnh gì?
- [ ] Giữ `low` cho nhanh
- [x] Tăng lên `high`/`xhigh` — đây là loại việc đúng/sai phụ thuộc vào các trường hợp dễ bỏ sót
- [ ] Dùng `max` cho mọi việc
- [ ] Viết "think harder" ba lần

`max` dành cho bài toán khó để Claude tự làm lâu; việc thường thì dễ tốn thêm mà không tốt hơn.
:::

:::quiz Subagent chỉ đi tìm các file import một module. Cách tiết kiệm hợp lý?
- [ ] Dùng model lớn nhất
- [x] Đặt `model: haiku` trong định nghĩa subagent và yêu cầu trả danh sách ngắn gọn
- [ ] Không dùng subagent bao giờ
- [ ] Tăng effort

Việc đơn giản không cần model lớn; output ngắn giữ context chính gọn.
:::

:::exercise Đo chi phí của một subagent
Trong cc-lab, hỏi cùng một câu hai cách và so `/usage` sau mỗi lần (mở phiên mới cho mỗi cách): (A) *"Tìm mọi chỗ dùng TaskStore và giải thích vai trò"* trực tiếp; (B) *"Dùng subagent Explore tìm mọi chỗ dùng TaskStore, chỉ trả về danh sách file:dòng"*.
???
Với repo nhỏ như cc-lab, (B) có thể tốn **nhiều** hơn tổng cộng vì subagent phải tự thu thập bối cảnh và có request riêng — nhưng context của hội thoại chính gọn hơn (xem `/context`). Lợi ích của subagent rõ hơn khi tìm kiếm rộng trên repo lớn hoặc output dài. Kết luận đúng: subagent để giữ context chính gọn và làm việc độc lập, không phải để rẻ hơn hay thông minh hơn.
:::

> Nguồn: *Best practices for Claude Code* — mục "Change the model and effort", "Know what subagents cost", "What you can stop doing", code.claude.com/docs (truy cập 11/11/2026).
