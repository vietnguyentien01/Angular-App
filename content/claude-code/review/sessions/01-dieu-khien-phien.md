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

## Phút đầu tiên: nhìn gì

Sau khi giao việc, đừng đi pha cà phê ngay. Trong 30–60 giây đầu, xem:

- Claude đang đọc **đúng thư mục** không? (vd bạn nói `features/orders` mà nó đi đọc `features/reports`)
- Kế hoạch ngắn nó nêu có khớp ý bạn không?
- Lệnh đầu tiên nó chạy có hợp lý không (chạy test trước, hay sửa luôn)?

Lệch hướng → `Esc` ngay. Mỗi phút để Claude đi sai là thêm diff phải đọc và thêm context "bẩn".

## `Esc` hay gõ thêm?

| Tình huống | Làm |
|---|---|
| Claude đi **sai hướng** (sửa nhầm file, hiểu sai yêu cầu) | `Esc`, nói rõ chỗ sai |
| Claude đi đúng nhưng bạn **nhớ thêm** một chi tiết | Gõ và `Enter` — tin nhắn được xếp hàng, Claude đọc sau lệnh hiện tại |
| Claude đã sửa vài file sai | `Esc`, rồi `Esc Esc` → Restore code (hoặc `/rewind`) |
| Hội thoại đã rối sau nhiều lần sửa | `/rename` rồi `/clear`, viết prompt mới |

## Ví dụ một buổi làm việc

1. `claude -n "orders-date-filter"` — đặt tên ngay từ đầu.
2. Giao việc có phép kiểm tra; theo dõi phút đầu.
3. Sai hướng ở lượt 2 → `Esc`, chỉnh: *"chỉ sửa order-filter.ts, không đụng component"*.
4. Xong → `/diff`, commit.
5. Việc tiếp theo không liên quan → `/clear`.
6. Hôm sau quay lại hỏi tiếp về bộ lọc → `claude --resume orders-date-filter`.

## Mỗi task một phiên

Mỗi request gửi lại **toàn bộ** hội thoại. Một phiên đã gom ba task không liên quan sẽ đọc lại cả ba ở mỗi lượt của task thứ tư → chậm hơn, tốn hơn, dễ lẫn. `/clear` giữa các task không liên quan.

:::quiz Bạn đã sửa Claude hai lần cho cùng một lỗi mà vẫn sai. Theo hướng dẫn nên làm gì?
- [ ] Sửa lần thứ ba, nhấn mạnh hơn
- [x] `/clear` rồi viết một prompt mới gộp những gì đã rút ra
- [ ] Tăng effort lên `max` và tiếp tục
- [ ] Mở thêm subagent

Hội thoại chứa hai lần thử thất bại sẽ kéo Claude về các hướng cũ.
:::

:::quiz Claude chạy `sed -i` qua Bash trên một file **chỉ** do Bash thay đổi (Claude chưa từng sửa nó bằng công cụ sửa file), sau đó bạn `/rewind` → Restore code. File đó có được khôi phục không?
- [ ] Có, mọi thay đổi đều có checkpoint
- [x] Không — file chỉ bị lệnh Bash thay đổi không được theo dõi; dùng git để khôi phục
- [ ] Chỉ khi dùng auto mode
- [ ] Chỉ khi file dưới 5.000 dòng

Nếu Claude **đã** sửa file đó bằng công cụ sửa file trong phiên, thay đổi Bash sau đó cũng được hoàn tác. Checkpoint hoạt động cùng git, không thay thế git.
:::

:::quiz Vì sao nên `/clear` giữa hai task không liên quan dù context còn nhiều chỗ?
- [ ] Vì context sẽ bị lỗi
- [x] Mỗi request gửi lại cả hội thoại — task sau phải "trả tiền" cho lịch sử của task trước, và context tập trung cho câu trả lời tốt hơn
- [ ] Vì Claude quên CLAUDE.md
- [ ] Không cần thiết

Với cửa sổ 1M token và tự động compact, hiếm khi hết context — nhưng vẫn tốn chi phí và giảm độ tập trung.
:::

:::exercise Luyện quy tắc "hai lần"
Trong cc-lab, cố ý giao một yêu cầu mơ hồ (vd *"sắp xếp task cho hợp lý"*), sửa hướng hai lần trong cùng hội thoại. Rồi `/clear` và viết một prompt mới gộp những gì bạn đã học từ hai lần sửa. So số lượt và chất lượng kết quả.
???
Prompt sau `/clear` nên nêu rõ điều bạn phát hiện qua hai lần sửa, vd *"Sắp xếp: task chưa xong trước, trong đó quá hạn lên đầu, rồi theo dueDate tăng dần; task xong xuống cuối. Viết test cho cả bốn nhóm."* Thường chỉ cần một lượt và không mang theo "dấu vết" của các lần thử sai. Dùng `/rename` trước `/clear` nếu muốn giữ phiên cũ để tham khảo.
:::

> Nguồn: *Best practices for Claude Code* — mục "Steer the session" và "Keep cost and context down", code.claude.com/docs (truy cập 11/11/2026).
