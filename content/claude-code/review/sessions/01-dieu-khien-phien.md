---
title: Điều khiển phiên làm việc — Esc, /rewind, /clear, /compact
summary: Theo dõi phút đầu tiên, dừng ngay khi Claude đi lệch, và sau hai lần sửa không thành thì /clear với prompt tốt hơn thay vì sửa lần thứ ba.
type: card
level: core
lastReviewed: 2026-11-11
tags: [claude-code, session, context]
related: [claude-code/deep-dive/sessions/chi-phi-va-subagent]
---

## Bộ điều khiển cần thuộc lòng

| Lệnh | Tác dụng |
|---|---|
| `Esc` | Dừng Claude giữa chừng, giữ lại mọi thứ đã làm tới lúc đó để bạn chỉnh hướng |
| `/rewind` (hoặc `Esc` hai lần khi ô nhập trống) | Quay code, hội thoại, hoặc cả hai về một prompt trước đó |
| `/clear` | Bắt đầu lại với context sạch — không tốn gì |
| `/compact <trọng tâm>` | Tóm tắt hội thoại, giữ phần bạn chỉ định |
| `/btw` | Hỏi nhanh mà không thêm vào lịch sử |
| `/rename <tên>` rồi `claude --resume <tên>` | Đặt tên phiên để quay lại sau; `claude --continue` mở phiên gần nhất |
| `/usage` | Xem token/chi phí đi đâu |

## Quy tắc "hai lần"

Nếu đã sửa cùng một điều **hai lần** mà vẫn sai, lần sửa thứ ba chỉ thêm vào một hội thoại đã chứa hai lần thử thất bại để Claude đọc lại. `/clear` + một prompt mới gộp những gì bạn đã học được gần như luôn tốt hơn.

:::warning Checkpoint không thay git
Checkpoint chỉ phục hồi file Claude sửa bằng **công cụ sửa file** của nó. File chỉ bị thay đổi qua lệnh Bash **không** được khôi phục. Hãy commit thường xuyên.
:::

## Mỗi task một phiên

Mỗi request gửi lại **toàn bộ** hội thoại. Một phiên đã gom ba task không liên quan sẽ đọc lại cả ba ở mỗi lượt của task thứ tư → chậm hơn, tốn hơn, dễ lẫn. `/clear` giữa các task không liên quan.

:::quiz Bạn đã sửa Claude hai lần cho cùng một lỗi mà vẫn sai. Theo hướng dẫn nên làm gì?
- [ ] Sửa lần thứ ba, nhấn mạnh hơn
- [x] `/clear` rồi viết một prompt mới gộp những gì đã rút ra
- [ ] Tăng effort lên `max` và tiếp tục
- [ ] Mở thêm subagent

Hội thoại chứa hai lần thử thất bại sẽ kéo Claude về các hướng cũ.
:::

:::quiz Claude chạy `sed -i` qua Bash để sửa file, sau đó bạn `/rewind`. File đó có được khôi phục không?
- [ ] Có
- [x] Không — checkpoint không theo dõi thay đổi do lệnh Bash tạo ra
- [ ] Chỉ khi file nằm trong git
- [ ] Chỉ khi dùng auto mode

Checkpoint hoạt động cùng git, không thay thế git.
:::

:::quiz Vì sao nên `/clear` giữa hai task không liên quan dù context còn nhiều chỗ?
- [ ] Vì context sẽ bị lỗi
- [x] Mỗi request gửi lại cả hội thoại — task sau phải "trả tiền" cho lịch sử của task trước, và context tập trung cho câu trả lời tốt hơn
- [ ] Vì Claude quên CLAUDE.md
- [ ] Không cần thiết

Với cửa sổ 1M token và tự động compact, hiếm khi hết context — nhưng vẫn tốn chi phí và giảm độ tập trung.
:::

> Nguồn: *Best practices for Claude Code* — mục "Steer the session" và "Keep cost and context down", code.claude.com/docs (truy cập 11/11/2026).
