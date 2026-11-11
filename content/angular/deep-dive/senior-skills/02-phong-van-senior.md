---
title: Chuẩn bị phỏng vấn Frontend Senior
summary: Các vòng thường gặp, câu chuyện STAR từ dự án thật, danh sách câu hỏi kỹ thuật phải trả lời trôi chảy, và cách viết lại CV có số liệu.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [interview, senior, star, cv]
related: [angular/review/senior-skills/thuat-ngu-va-mau-cau-tieng-anh, angular/deep-dive/system-design/khung-tra-loi-system-design]
---

## Các vòng thường gặp

| Vòng | Kiểm tra | Chuẩn bị trong app này |
|---|---|---|
| Kỹ thuật Angular/RxJS | Hiểu sâu cơ chế, trade-off | Phần Củng cố & Chuyên sâu + trang Luyện tập |
| Live coding | Viết component/hàm sạch, có test | Bài tập `:::exercise` |
| System design | Tư duy kiến trúc frontend | Khung RADIO + case study |
| Hành vi (behavioral) | Làm việc nhóm, xử lý xung đột, dẫn dắt | Câu chuyện STAR bên dưới |

## STAR — kể chuyện có cấu trúc

**S**ituation (bối cảnh) → **T**ask (nhiệm vụ của bạn) → **A**ction (bạn đã làm gì — trọng tâm) → **R**esult (kết quả đo được + bài học).

Ví dụ khung từ dự án low-code:

> **S**: Hệ thống quy trình nghiệp vụ cũ được viết lại trên Angular 21, yêu cầu kết quả các nút nghiệp vụ phải giống hệ thống cũ.
> **T**: Tôi phụ trách migrate nhóm action tính phí và đảm bảo không lệch.
> **A**: Tôi dựng bộ characterization test từ dữ liệu thật đã ẩn danh, tách logic tính toán thành hàm thuần, phát hiện N khác biệt, cùng BA quyết định giữ/sửa từng trường hợp và ghi lại.
> **R**: Lên production không phát sinh lỗi lệch số liệu ở các luồng đã migrate; bộ test được tái sử dụng cho các nhóm action sau.

Chuẩn bị 5–6 câu chuyện: một thành công kỹ thuật, một sự cố production, một lần bất đồng ý kiến, một lần hướng dẫn người khác, một quyết định có trade-off, một thất bại và bài học.

## Câu hỏi kỹ thuật phải trả lời trôi chảy

- Change detection hoạt động thế nào; OnPush; zoneless; vì sao Angular 22 đổi mặc định.
- Signals push–pull, `computed` vs `effect` vs `linkedSignal`; khi nào vẫn dùng RxJS.
- Chọn `switchMap/mergeMap/concatMap/exhaustMap` cho từng tình huống.
- Cây injector, provider ở root/route/component.
- Memory leak: nguyên nhân và cách phát hiện.
- Tối ưu một trang chậm: đo gì, công cụ nào, đã làm gì.
- XSS và sanitization; lưu token ở đâu.
- Micro frontend: khi nào nên/không nên.

## Viết lại CV kiểu Senior

| Trước | Sau |
|---|---|
| Participated in testing and performance optimization. | Reduced initial bundle by X% via lazy routes and `@defer`; cut Excel import time from Xs to Ys with a Web Worker. |
| Built shared UI components reused across micro frontends. | Designed a shared component library used by N micro frontends; introduced versioning and harness tests, reducing duplicated UI code. |
| Resolved production issues. | Led root-cause analysis for N production incidents in insurance workflows; added regression tests and a debugging guide for the team. |

Chỉ ghi số liệu **có thật** — hãy bắt đầu đo từ dự án hiện tại (xem bài *Đo trước khi tối ưu*).

:::quiz Trong STAR, phần nào nên chiếm nhiều thời gian nhất?
- [ ] Situation
- [ ] Task
- [x] Action — những gì chính bạn đã làm và vì sao
- [ ] Result

Người phỏng vấn muốn hiểu cách **bạn** suy nghĩ và hành động, không chỉ bối cảnh của dự án.
:::

:::quiz Khi được hỏi điều bạn không biết chắc, cách phản hồi tốt nhất?
- [ ] Đoán đại một đáp án chắc nịch
- [x] Nói rõ phần mình chắc và chưa chắc, rồi trình bày cách mình sẽ suy luận / kiểm chứng
- [ ] Bỏ qua câu hỏi
- [ ] Đổi sang chủ đề khác

Thể hiện tư duy và sự trung thực được đánh giá cao hơn một đáp án đoán mò.
:::

:::exercise Viết câu chuyện STAR của bạn
Chọn một vấn đề bạn từng xử lý (vd: shared component cho micro frontend, import Excel, migrate form legacy). Viết STAR trong 6–8 câu, phần Result có ít nhất một con số (thời gian, số lỗi, số màn hình, % giảm).
???
Tự kiểm tra:
- Situation và Task gộp lại ≤ 2 câu.
- Action dùng chủ ngữ **"tôi"** (không phải "chúng tôi") cho phần đóng góp của bạn, có ít nhất một quyết định kèm lý do ("tôi chọn X thay vì Y vì…").
- Result có số liệu thật và một bài học/điều sẽ làm khác đi.
- Luyện nói bằng tiếng Anh với các mẫu câu trong thẻ *Thuật ngữ và mẫu câu*.
:::
