---
title: RxJS hay Signals? Ranh giới ở góc nhìn kiến trúc
summary: Phân vai rõ ràng giữa event stream, server state và UI state để codebase lớn không bị trộn lẫn hai mô hình.
level: advanced
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, signals, architecture]
related: [rxjs/consolidate/angular/tosignal-toobservable, angular/deep-dive/signals/reactive-graph]
---

## TL;DR

| Loại dữ liệu | Công cụ phù hợp | Ví dụ |
|---|---|---|
| **UI state** đồng bộ | `signal`, `computed`, `linkedSignal` | tab đang chọn, form tạm, filter |
| **Server state** (fetch, cache, refetch) | `httpResource` / `resource`, TanStack Query, hoặc RxJS + `shareReplay` | danh sách đơn hàng |
| **Event stream** theo thời gian | RxJS | gõ phím, WebSocket, drag, polling |
| **Điều phối bất đồng bộ** phức tạp | RxJS | race, huỷ, retry, chuỗi bước phụ thuộc |

## Push vs pull

- **RxJS là push**: nguồn đẩy giá trị xuống ngay khi có, mỗi giá trị là một **sự kiện** (không được bỏ sót).
- **Signals là pull + glitch-free**: chỉ quan tâm **giá trị hiện tại**; nhiều thay đổi liên tiếp có thể gộp lại.

Vì vậy dùng signal cho "chuỗi sự kiện" (mọi lần click đều quan trọng) là sai mô hình — nhưng dùng `BehaviorSubject` cho state UI đơn giản thì thừa phức tạp.

## Mẫu kiến trúc khuyến nghị

```text
Component (template đọc signal)
   ▲ toSignal / computed
Facade / Store (signals cho state, RxJS cho effect bất đồng bộ)
   ▲ Observable
Data access (HttpClient, WebSocket — RxJS)
```

:::senior Góc nhìn Senior
Trong code review, mỗi khi thấy `toObservable` → `pipe` → `toSignal` cho một phép biến đổi **đồng bộ**, hãy đề nghị thay bằng `computed`. Ngược lại, khi thấy `effect` tự cài debounce bằng `setTimeout`, đề nghị dùng RxJS. Viết điều này thành **ADR** để cả team thống nhất.
:::

:::quiz Một màn hình cần: (1) lưu tab đang chọn, (2) tìm kiếm có debounce + huỷ request cũ. Phân vai hợp lý?
- [ ] Cả hai dùng BehaviorSubject
- [ ] Cả hai dùng signal + effect
- [x] (1) signal, (2) RxJS (`debounceTime` + `switchMap`) rồi `toSignal` kết quả
- [ ] (1) RxJS, (2) signal

Tab là UI state đồng bộ → signal. Tìm kiếm là event stream cần điều phối thời gian và huỷ → RxJS.
:::

:::quiz Vì sao không nên mô hình hoá "mỗi tin nhắn WebSocket đến" bằng một signal?
- [ ] Signal không lưu được object
- [x] Signal chỉ giữ giá trị mới nhất và có thể gộp thay đổi — các tin nhắn đến dồn dập có thể bị "nuốt" nếu chỉ đọc giá trị hiện tại
- [ ] Signal không dùng được trong service
- [ ] WebSocket không tương thích Angular

Event stream cần xử lý **mọi** giá trị. Hãy xử lý bằng RxJS (vd `scan` để tích luỹ vào danh sách), rồi mới đưa **kết quả tích luỹ** ra signal.
:::
