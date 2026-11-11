---
title: Thuật ngữ và mẫu câu tiếng Anh cho dev frontend
summary: Từ vựng hay gặp khi đọc tài liệu, viết PR, code review và phỏng vấn — kèm mẫu câu dùng được ngay.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [english, glossary, communication]
related: [angular/deep-dive/senior-skills/code-review-va-adr, angular/deep-dive/senior-skills/phong-van-senior]
---

## Thuật ngữ hay gặp

| Tiếng Anh | Nghĩa | Ví dụ ngữ cảnh |
|---|---|---|
| trade-off | sự đánh đổi | *The trade-off is more boilerplate for better type safety.* |
| regression | lỗi tái phát (cái đang chạy bị hỏng) | *This PR introduces a regression in the export flow.* |
| race condition | điều kiện tranh chấp | *Using mergeMap here causes a race condition.* |
| backward compatible | tương thích ngược | *The new API is backward compatible.* |
| deprecated | không còn khuyến khích, sẽ bị bỏ | *`withFetch()` is deprecated in v22.* |
| root cause | nguyên nhân gốc | *The root cause was a missing `track` expression.* |
| workaround | cách tạm vượt qua | *As a workaround, we disabled caching for this endpoint.* |
| edge case | trường hợp biên | *We need to handle the empty-list edge case.* |
| scope / out of scope | phạm vi / ngoài phạm vi | *Mobile support is out of scope for this sprint.* |
| bottleneck | nút thắt cổ chai | *Rendering the table is the bottleneck.* |
| maintainability | khả năng bảo trì | *This improves maintainability.* |
| technical debt | nợ kỹ thuật | *We'll track this as technical debt.* |

## Mẫu câu code review

- *Could we extract this into a pure function so it's easier to test?*
- *Nit: consider renaming `data` to `cases` for clarity.* (nit = góp ý nhỏ, không bắt buộc)
- *What happens if the request fails here?*
- *I'd suggest `switchMap` instead of `mergeMap` to avoid out-of-order responses.*
- *LGTM once the test is added.* (Looks good to me)

## Mẫu câu phỏng vấn

- *In my previous project, I was responsible for…* — Ở dự án trước, tôi phụ trách…
- *The main challenge was… so I decided to… because…* — Thách thức chính là… nên tôi quyết định… vì…
- *As a result, we reduced … by about 40%.* — Kết quả là chúng tôi giảm … khoảng 40%.
- *Could you clarify what you mean by…?* — Anh/chị có thể làm rõ … không?
- *I'm not 100% sure, but my approach would be…* — Tôi không chắc chắn hoàn toàn, nhưng cách tôi tiếp cận sẽ là…

:::quiz Trong code review, comment bắt đầu bằng "Nit:" nghĩa là gì?
- [ ] Lỗi nghiêm trọng, phải sửa
- [x] Góp ý nhỏ (thường về style/đặt tên), không chặn việc merge
- [ ] Yêu cầu viết lại toàn bộ
- [ ] Câu hỏi về nghiệp vụ

"Nit" (nitpick) giúp người nhận biết mức độ ưu tiên của góp ý.
:::

:::quiz "This change is not backward compatible" nghĩa là?
- [ ] Thay đổi chạy nhanh hơn bản cũ
- [x] Code/hệ thống đang dùng bản cũ có thể bị hỏng khi áp dụng thay đổi này
- [ ] Thay đổi đã bị deprecated
- [ ] Thay đổi chưa được test

Hay gặp trong release notes (breaking change) và khi thiết kế API cho thư viện dùng chung.
:::

:::quiz Câu nào phù hợp nhất để mô tả kết quả trong phỏng vấn?
- [ ] *I did many things to make it faster.*
- [x] *As a result, Excel import time dropped from 8 seconds to about 1 second.*
- [ ] *It was very good.*
- [ ] *Everyone was happy.*

Người phỏng vấn tìm **tác động đo được**. Chuẩn bị sẵn 3–4 câu như vậy từ dự án thật.
:::
