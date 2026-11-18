---
title: "Anthropic ra mắt Claude Fable 5.2 và Mythos 5.2: cùng một model, hai mức safeguard"
date: 2026-11-18
summary: "Ngày 9/11/2026, Anthropic công bố Fable 5.2 (dùng được trên mọi nền tảng, API claude-fable-5-2) và Mythos 5.2 (chỉ cho tổ chức đã xác minh). Nhanh hơn bản 5.1 tới 30%, giá 8/40 USD mỗi triệu token. Trong Claude Code, alias fable giờ trỏ tới Fable 5.2, cần v2.1.321+."
importance: high
category: ai
tags: [anthropic, claude, fable, mythos, model, claude-code]
relatedTopics: [claude-code/sessions, ai-agents/nang-cao]
sources:
  - title: Anthropic — Introducing Claude Fable 5.2 and Claude Mythos 5.2
    url: https://www.anthropic.com/news/claude-fable-and-mythos-5-2
  - title: Claude Code Docs — Model configuration (Work with Fable)
    url: https://code.claude.com/docs/en/model-config
---

## Có gì mới

Ngày **9/11/2026**, Anthropic công bố **Claude Fable 5.2** và **Claude Mythos 5.2**. Theo bài công bố, đây là **cùng một model nền**:

| | Fable 5.2 | Mythos 5.2 |
|---|---|---|
| Safeguard | Có thêm safeguard về an ninh mạng và sinh học | Bỏ bớt một số safeguard đó |
| Ai dùng được | Mọi người: Claude Platform (`claude-fable-5-2`), AWS, Google Cloud, Microsoft Azure | Chỉ tổ chức qua **Cyber Verification Program** hoặc **Life Sciences Verification Program**; khách Enterprise dùng gián tiếp qua Claude Security |
| Giá (mỗi triệu token) | 8 USD input / 40 USD output; fast mode 16 / 80 USD | Cùng model |

Các điểm khác trong bài công bố:

- **Tốc độ:** output nhanh hơn Fable/Mythos 5.1 **tới 30%**; fast mode tăng tốc sinh token **tới 2,5 lần**.
- **Effort mặc định:** *medium* trong ứng dụng Claude và Claude Code.
- **Lời khuyên của chính Anthropic:** với phần lớn việc code và việc văn phòng, nên **bắt đầu bằng Claude Opus 5.5**; Fable dành cho việc kỹ thuật khó, chạy dài.
- **Benchmark do hãng tự công bố:**
  - FrontierCode 2.0 (effort xhigh): 49,1%, so với Opus 5.5 là 45,5% và Fable 5.1 là 32,4%;
  - ở effort *high*, Fable 5.2 đạt 45,3%, ngang Opus 5.5, với chi phí mỗi task khoảng một nửa.
- **An toàn:**
  - bị chặn ít hơn Fable 5.1 khoảng 55%;
  - câu hỏi an ninh mạng bị chặn sẽ chuyển sang Opus 4.8, câu sinh học bị chặn chuyển sang Opus 5;
  - đánh giá độc lập bởi UK AI Security Institute và METR.

Trong **Claude Code** (theo trang Model configuration):
- alias `fable` trỏ tới Fable 5.2, cần **v2.1.321 trở lên**;
- không gói nào lấy Fable làm mặc định;
- tuỳ gói, dùng Fable có thể **tính vào usage credits**.

## Vì sao quan trọng

- **Chọn model theo việc, không theo "mạnh nhất":** chính hãng khuyên dùng Opus 5.5 cho việc thường ngày. Fable đáng tiền khi task dài nhiều giờ, cần tự điều tra rồi tự kiểm chứng (refactor lớn, điều tra bug khó, migration).
- **Chi phí:** giá output 40 USD mỗi triệu token. Một phiên agent dài có thể tốn đáng kể; ở chế độ `claude -p` trong CI, Claude Code **không hỏi** trước khi tính usage credits.
- **"Cùng model, khác safeguard"** là mô hình phát hành đáng chú ý: năng lực nhạy cảm (khai thác lỗ hổng, sinh học) chỉ mở cho tổ chức đã xác minh.

## Ví dụ

```bash
claude update                 # cần v2.1.321+ cho Fable 5.2
claude --model fable          # hoặc /model fable trong phiên
/effort high                  # Fable 5.2 ở high ≈ Opus 5.5 ở mức tốt nhất, theo hãng
```

```bash
# Gọi API trực tiếp
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
  -d '{"model": "claude-fable-5-2", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
```

## Việc nên làm

- **Áp dụng ngay:** cập nhật Claude Code nếu muốn thử Fable 5.2; xem bài [Chọn model, fast mode và theo dõi usage](/claude-code/deep-dive/sessions/model-va-usage).
- **Theo dõi:** chi phí khi chạy Fable trong CI hoặc job nền; đặt `--model` rõ ràng thay vì dựa vào alias.
- **Chưa cần quan tâm:** Mythos 5.2, trừ khi tổ chức của bạn làm bảo mật hay khoa học sự sống và đã qua chương trình xác minh.

:::quiz Theo Anthropic, Fable 5.2 và Mythos 5.2 khác nhau ở điểm nào?
- [ ] Mythos 5.2 là model lớn hơn, được huấn luyện riêng
- [x] Cùng model nền; Fable 5.2 có thêm safeguard an ninh mạng và sinh học nên mở cho mọi người, Mythos 5.2 chỉ dành cho tổ chức đã xác minh
- [ ] Fable 5.2 chỉ có trong Claude Code
- [ ] Mythos 5.2 rẻ hơn Fable 5.2

Bài công bố ghi rõ hai bản là "the same underlying model"; khác biệt nằm ở safeguard và đối tượng được dùng.
:::
