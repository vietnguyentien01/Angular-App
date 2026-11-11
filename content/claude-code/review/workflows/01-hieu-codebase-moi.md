---
title: Hiểu một codebase mới với Claude Code — từ tổng quan tới một luồng cụ thể
summary: Việc đầu tiên nên giao cho Claude khi vào dự án mới là hỏi, không phải sửa. Chuỗi câu hỏi đi từ kiến trúc tới domain, tìm code theo tính năng, lần theo một luồng, lập glossary — và cách tự kiểm tra lại câu trả lời để vẫn hiểu codebase bằng đầu của mình.
type: lesson
level: core
lastReviewed: 2026-11-11
tags: [claude-code, beginner, onboarding, codebase]
related: [claude-code/consolidate/workflows/explore-plan-code, claude-code/consolidate/principles/hoc-cung-ai-khong-phu-thuoc]
---

## TL;DR

Rộng → hẹp: **tổng quan → pattern kiến trúc → data model → một luồng end-to-end → thuật ngữ riêng**. Dùng ngôn ngữ domain của dự án khi hỏi. Mở bằng **plan mode** nếu muốn chắc chắn Claude không sửa gì.

## Chuỗi câu hỏi mẫu (dự án Angular enterprise)

```text
give me an overview of this codebase
```

```text
Ứng dụng chia feature thế nào? Có dùng standalone component, lazy route, NgRx/Signal store không? Liệt kê các pattern kiến trúc chính.
```

```text
Các data model chính là gì? Chúng được map từ API ở đâu?
```

```text
Authentication được xử lý thế nào? Token lưu ở đâu, refresh ra sao, guard nào chặn route?
```

```text
Lần theo luồng "nộp hồ sơ" từ lúc bấm nút Submit tới khi gọi API và hiển thị kết quả — liệt kê file theo thứ tự.
```

```text
Lập glossary các thuật ngữ riêng của dự án (tên domain, viết tắt) kèm file định nghĩa.
```

## Tìm code theo tính năng

```text
find the files that handle user authentication
```

```text
how do these authentication files work together?
```

Mẹo theo tài liệu: hỏi **cụ thể**, dùng **từ ngữ domain** của dự án; với TypeScript nên cài *code intelligence plugin* để Claude "go to definition / find references" chính xác thay vì grep.

## Dùng plan mode để chỉ đọc

```bash
claude --permission-mode plan
```

Claude đọc và trả lời, không sửa source. Rất hợp cho ngày đầu ở dự án của khách hàng.

## Đừng nhận câu trả lời mà không kiểm

:::warning Claude có thể nói nghe rất hợp lý mà sai
Với mỗi khẳng định quan trọng ("token refresh ở `AuthInterceptor`"), hãy yêu cầu **trích file và dòng**, rồi tự mở ra xem. Mục tiêu là *bạn* hiểu codebase — Claude chỉ rút ngắn thời gian tìm.
:::

Kỹ thuật học tốt hơn (chi tiết ở bài *Học cùng AI mà không phụ thuộc*):

1. **Đoán trước**: tự đoán luồng đi qua đâu, rồi mới hỏi Claude và so.
2. **Vẽ lại**: tự vẽ sơ đồ luồng, nhờ Claude chỉ chỗ sai.
3. **Nhờ hỏi ngược**: *"Hỏi mình 5 câu để kiểm tra mình đã hiểu module auth chưa."*

## Monorepo / repo rất lớn

Mở Claude ở thư mục của package bạn làm việc, đặt `CLAUDE.md` riêng cho từng package; xem trang *Set up Claude Code in a monorepo or large codebase* của tài liệu chính thức khi cần.

:::quiz Ngày đầu vào dự án, cách dùng Claude hợp lý nhất?
- [ ] Yêu cầu refactor toàn bộ module cũ cho "sạch"
- [x] Hỏi từ tổng quan tới chi tiết (có thể ở plan mode), đòi trích dẫn file, tự kiểm lại
- [ ] Copy toàn bộ repo vào prompt
- [ ] Bật bypassPermissions cho nhanh

Hiểu trước, sửa sau — và câu trả lời phải kiểm chứng được.
:::

:::quiz Theo tài liệu, điều gì giúp Claude tìm code chính xác hơn trong codebase TypeScript lớn?
- [ ] Viết prompt dài hơn
- [x] Cài code intelligence plugin để có go-to-definition / find-references
- [ ] Dùng IN HOA
- [ ] Tắt CLAUDE.md

Code intelligence cho Claude điều hướng theo ký hiệu thay vì tìm chuỗi.
:::

:::interview Bạn onboarding một dev mới bằng Claude Code. Bạn dặn họ điều gì?
Dùng Claude để **rút ngắn thời gian tìm**, không để thay việc hiểu: hỏi từ rộng tới hẹp bằng từ ngữ domain, đòi trích file/dòng, tự đọc lại code được trích, tự vẽ luồng rồi nhờ Claude soát; chỉ bắt đầu sửa khi giải thích lại được luồng đó cho người khác.
:::

> Nguồn: *Common workflows* — mục "Understand new codebases", code.claude.com/docs/en/common-workflows (truy cập 11/11/2026).
