---
title: Ước lượng, chia nhỏ công việc và quản lý technical debt
summary: Chia task để ước lượng sát hơn, nói về rủi ro thay vì một con số, và đưa technical debt vào kế hoạch theo cách PM/BA hiểu được.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [senior, estimation, technical-debt, communication]
related: [angular/deep-dive/senior-skills/code-review-va-adr, angular/deep-dive/senior-skills/phong-van-senior]
---

## Chia nhỏ trước khi ước lượng

"Làm màn hình nộp hồ sơ" → không ước lượng được. Chia ra:

| Việc | Ước lượng | Rủi ro / giả định |
|---|---|---|
| Form 3 bước + validation | 2 ngày | Schema field đã chốt |
| Upload file có tiến độ | 1 ngày | Cần `withXhr()` (v22) |
| Lưu nháp tự động | 1 ngày | Backend có API version |
| Tích hợp thanh toán | **? (spike 0,5 ngày)** | Chưa có tài liệu cổng thanh toán |
| Test + a11y + review | 1,5 ngày | |

Trả lời PM: *"Khoảng 6–7 ngày nếu tài liệu thanh toán có trong tuần này; phần thanh toán cần 0,5 ngày tìm hiểu trước khi chốt."* — một **khoảng + giả định + rủi ro**, không phải một con số mơ hồ.

## Technical debt nói bằng ngôn ngữ nghiệp vụ

```text
bad:  "Cần refactor module hồ sơ vì code xấu."
good: "Mỗi lần thêm loại hồ sơ mới mất ~3 ngày và thường gây 1–2 lỗi hồi quy, vì logic
       nằm rải rác ở 6 component. Dành 4 ngày gom về một facade + bộ test sẽ giảm việc
       thêm loại hồ sơ xuống ~1 ngày. Có 5 loại hồ sơ mới trong quý này."
```

Cách đưa vào kế hoạch: ghi nhận debt thành ticket có **chi phí hiện tại** và **lợi ích**, dành một tỷ lệ cố định mỗi sprint (vd 15–20%), hoặc gắn việc trả nợ vào feature đụng tới phần code đó.

:::quiz PM hỏi "bao lâu xong?" cho một tính năng có phần chưa rõ. Câu trả lời nào tốt nhất?
- [ ] "2 tuần" (cho an toàn)
- [ ] "Không biết được"
- [x] Đưa khoảng thời gian cho phần đã rõ, tách phần chưa rõ thành một spike ngắn và hẹn thời điểm chốt
- [ ] "Tuỳ backend"

Minh bạch về rủi ro giúp team ra quyết định, thay vì bị bất ngờ ở cuối sprint.
:::

:::quiz Cách thuyết phục PM ưu tiên trả technical debt hiệu quả nhất?
- [ ] Nói code hiện tại rất xấu
- [x] Định lượng chi phí đang phải trả (thời gian, số lỗi) và lợi ích sau khi trả, gắn với kế hoạch sắp tới
- [ ] Tự refactor ngoài giờ
- [ ] Đề xuất viết lại toàn bộ

PM ra quyết định dựa trên chi phí – lợi ích, không dựa trên chất lượng code trừu tượng.
:::

:::exercise Tập viết
Viết đoạn 3–4 câu đề xuất chuyển các component bảng dữ liệu cũ sang OnPush + signals, cho người đọc là PM.
???
Gợi ý: *"Màn hình danh sách hồ sơ hiện mất ~2–3 giây để phản hồi khi lọc với 2.000 dòng (đo trên máy văn phòng), người dùng đã phản ánh 4 lần trong tháng. Nguyên nhân chính là cả bảng được kiểm tra lại mỗi khi có thay đổi nhỏ. Chuyển 3 component bảng sang OnPush + signals ước tính 3 ngày, kỳ vọng giảm thời gian phản hồi xuống dưới 0,5 giây. Có thể làm cùng đợt sửa tính năng lọc nâng cao đã lên kế hoạch sprint tới."*
:::
