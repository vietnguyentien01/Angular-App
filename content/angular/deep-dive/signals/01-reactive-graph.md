---
title: Reactive graph bên trong Signals
summary: Producer, consumer, push-pull và vì sao computed vừa lazy vừa glitch-free.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [signals, internals]
related: [angular/consolidate/signals/effect-dung-cach]
---

## TL;DR

Signals tạo thành một **đồ thị có hướng**:

- **Producer**: nút tạo ra giá trị — `signal`, `computed`.
- **Consumer**: nút đọc giá trị — `computed`, `effect`, template của component.
- `computed` vừa là consumer (đọc nguồn) vừa là producer (cho nút khác đọc).

## Mô hình push–pull

1. **Push (thông báo)**: khi `signal.set()` được gọi, nó chỉ **đánh dấu dirty** các consumer phụ thuộc — chưa tính lại gì cả.
2. **Pull (tính toán)**: khi ai đó **đọc** một `computed` đang dirty, nó mới kiểm tra nguồn có thực sự đổi không (so sánh version) rồi mới tính lại.

```text
count (signal) ──► double (computed) ──► template
       │
       └────────► effect(log)
```

Kết quả:

- **Lazy**: `computed` không ai đọc thì không bao giờ tính.
- **Glitch-free**: không có trạng thái “nửa cũ nửa mới”, vì giá trị chỉ được tính khi đọc, sau khi mọi thay đổi đã được đánh dấu.
- **Memoize**: nếu nguồn đổi nhưng `computed` cho ra giá trị bằng (`Object.is`) giá trị cũ, các consumer phía sau **không bị tính lại**.

:::tip Thử nghĩ
`isEven = computed(() => count() % 2 === 0)`. Khi `count` đi từ 2 → 4, template đọc `isEven` có phải render lại không? → Không: `isEven` vẫn là `true`, nên consumer phía sau được bỏ qua.
:::

:::senior Góc nhìn Senior
Hiểu push–pull giúp giải thích tại sao signals kết hợp tốt với **zoneless**: Angular biết chính xác component nào đọc signal nào, nên chỉ cần lên lịch change detection cho đúng những view bị dirty thay vì dựa vào Zone.js “đoán” mọi lúc có sự kiện bất đồng bộ.
:::

> Phần 2 (giai đoạn tiếp theo) sẽ bổ sung: demo vẽ graph trực tiếp, đọc mã nguồn `@angular/core/primitives/signals`, và bài tập tự viết mini-signal.
