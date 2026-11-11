---
title: signal, computed, effect — 3 viên gạch nền
summary: Ôn nhanh 3 API cốt lõi của Signals, khi nào dùng cái nào và một lỗi hay gặp nhất.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [signals, reactivity]
related: [angular/consolidate/signals/effect-dung-cach]
---

## TL;DR

- `signal(v)` — **giá trị có thể thay đổi**, đọc bằng cách gọi hàm `count()`, ghi bằng `set` / `update`.
- `computed(() => ...)` — **giá trị dẫn xuất**, chỉ đọc, tự tính lại khi signal phụ thuộc đổi. Lazy & có memoize.
- `effect(() => ...)` — **tác dụng phụ** (side effect) chạy lại khi signal bên trong đổi: log, đồng bộ localStorage, gọi API ngoài Angular...

```ts title="counter.ts"
import { Component, computed, effect, signal } from '@angular/core';

@Component({
  selector: 'app-counter',
  template: `
    <button (click)="inc()">+1</button>
    <p>{{ count() }} × 2 = {{ double() }}</p>
  `,
})
export class Counter {
  readonly count = signal(0);
  readonly double = computed(() => this.count() * 2);

  constructor() {
    effect(() => console.log('count =', this.count()));
  }

  inc() {
    this.count.update((c) => c + 1);
  }
}
```

:::demo signals-counter

## Chọn API nào?

| Bạn cần… | Dùng |
|---|---|
| Lưu state có thể thay đổi | `signal` |
| Tính ra từ state khác | `computed` |
| Đồng bộ ra **bên ngoài** reactive graph (DOM thủ công, storage, log) | `effect` |
| State phụ thuộc nguồn khác nhưng vẫn ghi được | `linkedSignal` |

:::warning Lỗi hay gặp nhất
Dùng `effect` để **set signal khác** nhằm tính giá trị dẫn xuất. Hãy dùng `computed` (hoặc `linkedSignal`) — nhanh hơn, không bị chạy thừa và không tạo vòng lặp.
:::

```ts bad
effect(() => this.double.set(this.count() * 2));
```

```ts good
readonly double = computed(() => this.count() * 2);
```

:::version v16 Ở Angular 16 / 19
Signals ra mắt ở **v16 (developer preview)**; `signal`, `computed`, `effect` ổn định dần qua v17–v20. Trên v16 chưa có `input()`, `model()`, `linkedSignal` — dự án v16 thường kết hợp signals với `@Input()` và RxJS.
:::

:::interview `computed` khác gì một getter thông thường?
Getter chạy lại **mỗi lần** được đọc (mỗi lần change detection). `computed` **memoize**: chỉ tính lại khi một signal mà nó đã đọc thay đổi, và chỉ tính khi có nơi đọc nó (lazy). Ngoài ra `computed` là một nút trong reactive graph, nên template/`effect` đọc nó sẽ được thông báo chính xác khi nó đổi.
:::

:::quiz `count = signal(1)`. Gọi `count.set(1)` (cùng giá trị) thì `computed` và template phụ thuộc vào nó có chạy lại không?
- [ ] Có, mỗi lần `set` đều thông báo
- [x] Không — signal so sánh bằng `Object.is`, giá trị không đổi thì không thông báo
- [ ] Chỉ template chạy lại
- [ ] Lỗi

Thử nút "set(cùng giá trị)" trong demo phía trên: không có gì chạy lại. Có thể đổi cách so sánh bằng option `equal`.
:::

:::quiz `items = signal<string[]>([])`. Đoạn nào làm UI cập nhật đúng?
- [ ] `this.items().push('a')`
- [x] `this.items.update((list) => [...list, 'a'])`
- [ ] `this.items().length++`
- [ ] `this.items.set(this.items())`

Mutate mảng bên trong không đổi tham chiếu → signal không biết có thay đổi. Luôn tạo giá trị mới.
:::

:::quiz Code này log mấy lần ngay sau khi chạy (trước khi Angular render)?
```ts
const a = signal(1);
const b = computed(() => {
  console.log('tính b');
  return a() * 2;
});
a.set(2);
a.set(3);
```

- [x] 0 lần
- [ ] 1 lần
- [ ] 2 lần
- [ ] 3 lần

`computed` **lười**: chưa ai đọc `b()` nên nó chưa bao giờ được tính.
:::
