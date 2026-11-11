---
title: Checklist câu hỏi làm rõ yêu cầu (system design)
summary: Những câu nên hỏi trong 5 phút đầu của buổi phỏng vấn system design frontend — chức năng, phi chức năng và phạm vi.
type: cheatsheet
level: core
version: 22
lastReviewed: 2026-11-11
tags: [system-design, interview, requirements]
related: [angular/deep-dive/system-design/khung-tra-loi-system-design]
---

## Chức năng

- Người dùng là ai, có bao nhiêu vai trò? Ai được làm gì?
- Luồng chính (happy path) là gì? Những thao tác nào **bắt buộc** có trong phạm vi buổi này?
- Dữ liệu đến từ đâu, có realtime không?

## Phi chức năng

| Nhóm | Câu hỏi |
|---|---|
| Quy mô | Bao nhiêu bản ghi? Bao nhiêu người dùng đồng thời? Kích thước file? |
| Hiệu năng | Mục tiêu tải trang / độ trễ tương tác? Thiết bị và mạng của người dùng? |
| Thiết bị | Desktop, mobile, màn hình nhỏ? Trình duyệt cần hỗ trợ? |
| Offline | Có cần dùng khi mất mạng / mạng chập chờn? |
| A11y | Có yêu cầu WCAG (cổng dịch vụ công thường có)? |
| i18n | Mấy ngôn ngữ, định dạng ngày/tiền? |
| Bảo mật | Dữ liệu nhạy cảm? Phân quyền đến mức nào? Audit log? |
| SEO | Trang công khai cần SEO không (→ SSR/SSG)? |

## Phạm vi

- "Tôi sẽ tập trung vào X và Y, phần Z mình chỉ nói ở mức tổng quan — được không?"

:::quiz Tại sao nên hỏi "bao nhiêu bản ghi" ngay từ đầu?
- [ ] Để kéo dài thời gian
- [x] Quy mô quyết định kiến trúc: 100 bản ghi lọc phía client được, 1 triệu bản ghi bắt buộc phân trang/lọc phía server và virtual scroll
- [ ] Vì người phỏng vấn yêu cầu
- [ ] Không quan trọng

Một con số thay đổi cả thiết kế data layer và UI.
:::

:::quiz Đề bài: "Thiết kế trang tra cứu thủ tục hành chính cho người dân". Câu hỏi phi chức năng nào quan trọng nhất nên hỏi?
- [ ] Màu chủ đạo
- [x] SEO, thiết bị di động/mạng yếu, và yêu cầu accessibility
- [ ] Dùng Angular hay React
- [ ] Số lượng component

Trang công khai cho người dân → cần tìm thấy trên Google, chạy tốt trên điện thoại cũ, và đáp ứng người khuyết tật.
:::
