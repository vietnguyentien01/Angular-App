---
title: Học cùng AI mà không phụ thuộc vào AI
summary: Cách dùng Claude để hiểu sâu hơn thay vì chỉ lấy đáp án — đoán trước rồi so, tự viết rồi nhờ review, nhờ đặt câu hỏi kiểm tra — và giữ khả năng làm việc khi không có AI.
level: intermediate
lastReviewed: 2026-11-11
tags: [learning, claude-code, career]
related: [claude-code/review/principles/ai-la-cong-cu, angular/deep-dive/senior-skills/phong-van-senior]
---

> Bài này là **khuyến nghị học tập** của Learning Hub, không phải hướng dẫn chính thức của Anthropic.

## Hai cách dùng AI rất khác nhau

| Dùng để thay thế suy nghĩ | Dùng để suy nghĩ tốt hơn |
|---|---|
| "Viết cho tôi hàm X" → copy | "Tôi định viết X theo cách A vì… Bạn thấy rủi ro gì?" |
| Hỏi đáp án bài tập | Tự làm trước, rồi nhờ review và chỉ ra chỗ sai |
| Nhận giải thích, gật gù | Tự giải thích lại bằng lời của mình, nhờ Claude chỉ chỗ hiểu sai |
| Sửa lỗi bằng cách dán log và chờ | Đặt giả thuyết trước, rồi nhờ Claude kiểm chứng |

## Các kỹ thuật cụ thể

1. **Đoán trước, kiểm sau**: trước khi hỏi "đoạn RxJS này log gì", tự viết đáp án ra giấy. Chỗ đoán sai chính là chỗ cần học.
2. **Feynman với AI**: *"Tôi sẽ giải thích change detection OnPush, hãy chỉ ra chỗ tôi sai hoặc thiếu, đừng giải thích lại từ đầu."*
3. **Nhờ ra đề**: *"Đặt cho tôi 5 câu hỏi đoán output về linkedSignal, chưa đưa đáp án."* — hoặc dùng trang Luyện tập của app này.
4. **Đọc diff như người review**: mỗi thay đổi Claude làm, tự hỏi "vì sao chỗ này như vậy?" — không trả lời được thì hỏi, hoặc tra bài tương ứng trong app.
5. **Giữ "cơ bắp"**: định kỳ làm một task nhỏ không dùng AI (vd một bài tập `:::exercise`), vì phỏng vấn live coding thường không cho dùng AI.

:::quiz Cách nào giúp hiểu sâu nhất khi học một khái niệm mới với Claude?
- [ ] Đọc thật nhiều giải thích của Claude
- [x] Tự giải thích lại bằng lời của mình và nhờ Claude chỉ ra chỗ sai hoặc thiếu
- [ ] Copy code mẫu và chạy thử
- [ ] Hỏi cùng một câu nhiều lần

Chủ động truy xuất và tự giải thích giúp nhớ lâu hơn nhiều so với đọc thụ động.
:::

:::quiz Khi Claude sửa một bug cho bạn, điều gì cho thấy bạn đang "phụ thuộc" chứ không "tận dụng"?
- [ ] Bạn dùng Claude mỗi ngày
- [x] Bạn merge mà không giải thích được nguyên nhân gốc và vì sao cách sửa đúng
- [ ] Bạn viết prompt cụ thể
- [ ] Bạn yêu cầu Claude chạy test

Câu hỏi để tự kiểm tra: nếu đồng nghiệp hỏi "vì sao lỗi xảy ra?", bạn có trả lời được không cần nhìn lại hội thoại?
:::

:::exercise Kế hoạch học một tuần
Viết kế hoạch 5 buổi (30–45 phút/buổi) để học chặng "Change Detection & Performance" trong lộ trình, trong đó Claude chỉ được dùng theo cách "suy nghĩ tốt hơn".
???
Gợi ý:
- Buổi 1: đọc bài OnPush/Eager, tự làm trắc nghiệm, ghi lại câu sai; nhờ Claude đặt thêm 5 câu đoán output khác (chưa đưa đáp án).
- Buổi 2: tự giải thích zoneless bằng lời trong 5 câu, nhờ Claude chỉ chỗ sai; đọc bài Chuyên sâu tương ứng.
- Buổi 3: không dùng AI — đo một màn hình chậm trong dự án bằng DevTools, ghi baseline.
- Buổi 4: tự đề xuất 2 hướng tối ưu kèm lý do, rồi nhờ Claude phản biện; triển khai một hướng với phép kiểm tra rõ ràng.
- Buổi 5: đo lại, viết một dòng thành tích có số liệu cho CV; tick bài thực hành trong lộ trình.
:::
