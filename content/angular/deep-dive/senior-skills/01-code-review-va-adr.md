---
title: Code review hiệu quả và viết ADR
summary: Review theo thứ tự ưu tiên, cách viết comment mang tính xây dựng, và ghi lại quyết định kiến trúc bằng ADR ngắn gọn.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [senior, code-review, adr, leadership]
related: [angular/review/senior-skills/thuat-ngu-va-mau-cau-tieng-anh, angular/deep-dive/senior-skills/phong-van-senior]
---

## Review theo thứ tự ưu tiên

1. **Đúng nghiệp vụ** — có giải quyết đúng yêu cầu/bug không? Trường hợp biên?
2. **An toàn** — bảo mật (XSS, quyền), mất dữ liệu, race condition, memory leak.
3. **Thiết kế** — đặt đúng tầng (facade/ui), ranh giới module, API dễ dùng sai không?
4. **Test** — có test cho hành vi mới / bug vừa sửa không?
5. **Dễ đọc** — đặt tên, độ dài hàm, comment cần thiết.
6. **Style** — để cho lint/prettier, đừng tốn công review tay.

## Viết comment

| Thay vì | Viết |
|---|---|
| "Sai rồi." | "Ở đây `mergeMap` có thể trả kết quả không theo thứ tự khi gõ nhanh. Dùng `switchMap` được không?" |
| "Code này khó hiểu." | "Mình mất một lúc mới hiểu khối này — tách thành hàm `calculatePremium()` có tên rõ nghĩa được không?" |
| (im lặng khi thấy code tốt) | "Cách dùng `linkedSignal` ở đây gọn quá 👍" |

Phân biệt rõ **bắt buộc** (blocking) và **gợi ý** (nit / optional) để người nhận ưu tiên đúng.

## ADR — Architecture Decision Record

Một file Markdown ngắn trong repo (`docs/adr/0007-server-state.md`):

```md
# 0007 — Dùng httpResource cho server state đơn giản, TanStack Query cho màn hình nhiều cache

Trạng thái: Đã chấp nhận (2026-11-11)

## Bối cảnh
Nhiều màn hình gọi lại cùng API; tự viết shareReplay ở mỗi service không nhất quán, khó invalidate.

## Quyết định
- Màn hình đơn lẻ: `httpResource` trong facade.
- Dữ liệu dùng chung nhiều màn hình, cần invalidate sau khi ghi: TanStack Query.

## Hệ quả
+ Thống nhất cách tải dữ liệu, loading/error có sẵn.
− Thêm một thư viện; team cần buổi hướng dẫn. Cần quy ước query key.

## Phương án đã cân nhắc
NgRx Store (quá nặng cho nhu cầu hiện tại), tự viết cache interceptor (mù nghiệp vụ khi invalidate).
```

:::senior Góc nhìn Senior
ADR không để "chứng minh mình đúng" mà để 6 tháng sau người mới (hoặc chính bạn) hiểu **vì sao** codebase như hiện tại. Quyết định thay đổi thì viết ADR mới đánh dấu "thay thế ADR 0007" — không sửa lịch sử.
:::

:::quiz Thứ gì KHÔNG nên tốn thời gian review tay?
- [ ] Race condition trong luồng RxJS
- [ ] Thiếu kiểm tra quyền
- [x] Dấu chấm phẩy, thụt lề, thứ tự import
- [ ] Thiếu test cho bug vừa sửa

Tự động hoá bằng Prettier/ESLint trong CI, dành thời gian review cho logic và thiết kế.
:::

:::quiz Phần nào của ADR giúp người đọc sau này hiểu vì sao KHÔNG chọn cách khác?
- [ ] Tiêu đề
- [ ] Trạng thái
- [x] Phương án đã cân nhắc
- [ ] Ngày tháng

Thiếu phần này, team dễ "phát minh lại" cuộc thảo luận cũ.
:::

:::exercise Viết ADR
Viết một ADR ngắn (bối cảnh, quyết định, hệ quả, phương án) cho quyết định: "Component mới trong dự án dùng Signal Forms thay vì Reactive Forms".
???
Gợi ý:
- **Bối cảnh**: Angular 22 đã ổn định Signal Forms; dự án đang chuyển sang signals/zoneless; form động từ JSON Schema cần validation phụ thuộc chéo nhiều.
- **Quyết định**: form **mới** dùng Signal Forms; form cũ giữ Reactive Forms, chỉ chuyển khi sửa lớn. Custom control trong design system hỗ trợ cả CVA và `FormValueControl` trong giai đoạn chuyển tiếp.
- **Hệ quả**: + validation khai báo, cross-field tự cập nhật, ít `valueChanges` thủ công; − hai mô hình form song song một thời gian, team cần học API mới, một số thư viện bên thứ ba chưa hỗ trợ.
- **Phương án**: giữ Reactive Forms toàn bộ (ổn định nhưng không tận dụng signals), chuyển toàn bộ một lần (rủi ro cao).
:::
