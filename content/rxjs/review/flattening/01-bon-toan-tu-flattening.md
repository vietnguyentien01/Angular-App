---
title: switchMap, mergeMap, concatMap, exhaustMap
summary: Bốn cách xử lý "Observable bên trong Observable" — nhìn trực quan trên dòng thời gian.
type: card
level: core
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, flattening, switchMap]
related: [rxjs/consolidate/flattening/chon-dung-flattening]
---

## TL;DR

Khi mỗi giá trị nguồn tạo ra **một Observable mới** (vd: mỗi lần gõ phím → một HTTP request), bạn cần quyết định làm gì khi inner cũ **chưa xong** mà giá trị mới đã tới:

| Operator | Khi có giá trị mới mà inner cũ chưa xong | Một câu để nhớ |
|---|---|---|
| `switchMap` | **Huỷ** inner cũ, chạy inner mới | "Chỉ quan tâm cái mới nhất" |
| `mergeMap` | Chạy **song song** cả hai | "Làm hết, cùng lúc" |
| `concatMap` | **Xếp hàng**, chờ inner cũ xong mới chạy | "Làm lần lượt, đúng thứ tự" |
| `exhaustMap` | **Bỏ qua** giá trị mới | "Đang bận, đừng làm phiền" |

:::demo rxjs-flattening

## Chọn nhanh theo tình huống

| Tình huống | Operator |
|---|---|
| Autocomplete / tìm kiếm | `switchMap` |
| Đọc chi tiết theo route param | `switchMap` |
| Lưu từng thay đổi theo đúng thứ tự (auto-save, queue) | `concatMap` |
| Nút "Đăng nhập", "Thanh toán" (chống double-click) | `exhaustMap` |
| Upload nhiều file độc lập | `mergeMap` (có thể giới hạn `mergeMap(fn, 3)`) |

:::quiz Ô tìm kiếm gọi API mỗi lần gõ. Muốn kết quả hiển thị luôn khớp với từ khoá mới nhất, chọn?
- [x] `switchMap`
- [ ] `mergeMap`
- [ ] `concatMap`
- [ ] `exhaustMap`

`switchMap` huỷ request cũ (HttpClient sẽ abort) nên response của từ khoá cũ về muộn không thể ghi đè kết quả mới — tránh race condition.
:::

:::quiz Nút "Thanh toán" bị người dùng bấm 3 lần liên tiếp. Muốn chỉ gửi 1 request cho đến khi nó xong, chọn?
- [ ] `switchMap`
- [ ] `mergeMap`
- [ ] `concatMap`
- [x] `exhaustMap`

`exhaustMap` bỏ qua mọi click trong lúc inner (request) đang chạy. `switchMap` sẽ huỷ request đầu ở phía client — nhưng server có thể **đã nhận** nó rồi, rất nguy hiểm với thanh toán.
:::

:::quiz Với `concatMap`, nếu người dùng click 3 lần nhanh và mỗi inner mất 1 giây, kết quả là?
- [ ] Chỉ inner thứ 3 chạy
- [ ] Cả 3 chạy song song, xong sau ~1 giây
- [x] Cả 3 chạy lần lượt, xong sau ~3 giây
- [ ] Chỉ inner thứ 1 chạy

`concatMap` giữ hàng đợi; inner sau chỉ bắt đầu khi inner trước **complete**. Cẩn thận: nếu inner không bao giờ complete, hàng đợi bị kẹt mãi.
:::

:::interview Vì sao dùng `mergeMap` cho autocomplete là bug?
Các request chạy song song và có thể trả về **không theo thứ tự**. Response của "an" về sau response của "angular" sẽ ghi đè kết quả mới bằng kết quả cũ (race condition). `switchMap` giải quyết bằng cách huỷ request cũ.
:::
