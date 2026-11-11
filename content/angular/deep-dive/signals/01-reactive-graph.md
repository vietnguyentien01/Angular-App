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

## Đọc mã nguồn

Phần lõi nằm ở `@angular/core/primitives/signals` (dùng chung với đề xuất TC39 Signals). Các khái niệm chính:

- `ReactiveNode` — mỗi signal/computed/effect là một node, có `version`, danh sách `producers` và `consumers`.
- `producerAccessed()` — gọi khi một signal được đọc: ghi nhận cạnh producer → consumer đang hoạt động.
- `producerNotifyConsumers()` — gọi khi signal đổi: đánh dấu dirty lan xuống (bước *push*).
- `consumerPollProducersForChange()` — khi đọc lại một consumer dirty: so `version` của producer để biết có thực sự cần tính lại (bước *pull*).

:::quiz `a = signal(1)`, `b = computed(() => a() > 0)`, `c = computed(() => b() ? 'dương' : 'âm')`. Đổi `a` từ 1 sang 5 rồi đọc `c()`. Hàm của `c` có chạy lại không?
- [ ] Có, vì `a` đã đổi
- [x] Không — `b` được tính lại nhưng vẫn là `true`, version của `b` không tăng nên `c` dùng giá trị cũ
- [ ] Có, vì computed không có memoize
- [ ] Lỗi vì vòng phụ thuộc

Đây là sức mạnh của push–pull: thay đổi chỉ lan tới đúng những node có giá trị thực sự khác.
:::

:::quiz Đọc một signal bên trong `untracked(() => ...)` trong một `computed` có tác dụng gì?
- [ ] Signal đó bị khoá không cho ghi
- [x] Không tạo cạnh phụ thuộc — `computed` sẽ không tính lại khi signal đó đổi
- [ ] Đọc giá trị cũ
- [ ] Tăng tốc đọc

`untracked` tạm tắt "consumer đang hoạt động", nên `producerAccessed` không ghi nhận cạnh mới.
:::

:::exercise Tự viết mini signal + computed (push–pull)
Viết `signal(v)` (đọc bằng gọi hàm, có `.set`) và `computed(fn)` lười, có memoize, tự theo dõi dependency. Không cần effect.
???
```ts
type Node = { dirty: boolean; consumers: Set<Node>; recompute?: () => void };
let active: Node | undefined;

function signal<T>(value: T) {
  const node: Node = { dirty: false, consumers: new Set() };
  const read = () => {
    if (active) node.consumers.add(active); // ghi nhận phụ thuộc
    return value;
  };
  read.set = (next: T) => {
    if (Object.is(next, value)) return;
    value = next;
    markDirty(node);
  };
  return read;
}

function markDirty(node: Node) {
  for (const c of node.consumers) {
    if (!c.dirty) {
      c.dirty = true; // push: chỉ đánh dấu
      markDirty(c);
    }
  }
}

function computed<T>(fn: () => T) {
  let value: T;
  const node: Node = { dirty: true, consumers: new Set() };
  return () => {
    if (active) node.consumers.add(active);
    if (node.dirty) {
      // pull: tính lại khi được đọc
      const prev = active;
      active = node;
      try {
        value = fn();
      } finally {
        active = prev;
      }
      node.dirty = false;
    }
    return value;
  };
}
```
Bản này chưa có so sánh version (nên chưa bỏ qua được trường hợp "giá trị trung gian không đổi") và chưa dọn dependency cũ — chính là những gì `ReactiveNode` của Angular xử lý thêm.
:::
