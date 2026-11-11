---
title: "Đoán output: đồng bộ hay bất đồng bộ?"
summary: Luyện đọc thứ tự log khi trộn of, from, Promise, setTimeout và Subject — kỹ năng hay bị hỏi khi phỏng vấn.
level: intermediate
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, event-loop, output]
related: [rxjs/review/observable/observable-observer-subscription]
---

## TL;DR

- `of(...)`, `from([...])`, `new Observable` gọi `next` ngay → **đồng bộ**, phát xong trước dòng code tiếp theo.
- `from(promise)` → **microtask** (sau code đồng bộ, trước `setTimeout`).
- `timer`, `interval`, `delay`, `debounceTime` → **macrotask** (`setTimeout`/`setInterval`).
- Subscriber nhận giá trị **ngay trong** lời gọi `subject.next()`.

:::tip Mẹo đọc nhanh
Chia code thành 3 tầng: (1) đồng bộ, (2) microtask (Promise), (3) macrotask (timer). Log tầng 1 theo thứ tự dòng, rồi tầng 2, rồi tầng 3.
:::

:::quiz In ra theo thứ tự nào?
```ts
console.log('A');
of(1, 2).subscribe((v) => console.log(v));
console.log('B');
```

- [x] `A, 1, 2, B`
- [ ] `A, B, 1, 2`
- [ ] `1, 2, A, B`
- [ ] `A, B` rồi `1, 2` sau 0ms

`of` phát đồng bộ ngay trong `subscribe()`.
:::

:::quiz In ra theo thứ tự nào?
```ts
console.log('A');
from(Promise.resolve(1)).subscribe((v) => console.log(v));
setTimeout(() => console.log('T'), 0);
console.log('B');
```

- [ ] `A, 1, B, T`
- [x] `A, B, 1, T`
- [ ] `A, B, T, 1`
- [ ] `A, T, B, 1`

Promise resolve chạy ở microtask (sau code đồng bộ), còn `setTimeout` là macrotask — chạy sau mọi microtask.
:::

:::quiz In ra theo thứ tự nào?
```ts
const s = new Subject<number>();
s.subscribe((v) => console.log('X' + v));
console.log('trước');
s.next(1);
console.log('sau');
```

- [ ] `trước, sau, X1`
- [x] `trước, X1, sau`
- [ ] `X1, trước, sau`
- [ ] `trước, sau`

`Subject.next` gọi callback của subscriber **đồng bộ**.
:::

:::quiz In ra theo thứ tự nào?
```ts
of(1, 2, 3)
  .pipe(
    tap((v) => console.log('tap', v)),
    filter((v) => v !== 2),
    map((v) => v * 10),
  )
  .subscribe((v) => console.log('sub', v));
```

- [ ] `tap 1, tap 2, tap 3, sub 10, sub 30`
- [x] `tap 1, sub 10, tap 2, tap 3, sub 30`
- [ ] `sub 10, sub 30, tap 1, tap 2, tap 3`
- [ ] `tap 1, sub 10, tap 2, sub 20, tap 3, sub 30`

Mỗi giá trị đi **hết** cả chuỗi operator rồi giá trị tiếp theo mới bắt đầu (push từng phần tử), không phải xử lý theo "lô" như `Array.map().filter()`. Giá trị `2` bị `filter` chặn nên không có `sub 20`.
:::

:::exercise Viết lại để log `B` trước `1, 2`
```ts
console.log('A');
of(1, 2).subscribe((v) => console.log(v));
console.log('B');
```
Gợi ý: có một operator đẩy việc phát giá trị sang sau (async scheduler).
???
```ts
import { asapScheduler, of, subscribeOn } from 'rxjs';

console.log('A');
of(1, 2).pipe(subscribeOn(asapScheduler)).subscribe((v) => console.log(v));
console.log('B');
// A, B, 1, 2
```
`subscribeOn(asapScheduler)` hoãn việc subscribe sang microtask. Dùng `asyncScheduler` thì hoãn sang macrotask (`setTimeout`). Cách khác: `of(1, 2).pipe(delay(0))`.
:::

:::interview Vì sao hiểu sync/async của Observable quan trọng trong Angular?
Vì nó quyết định **khi nào** state được cập nhật so với change detection. Ví dụ: `BehaviorSubject` phát đồng bộ khi subscribe nên giá trị có ngay trong lần render đầu; còn `toSignal(http.get(...))` sẽ là `undefined` cho tới khi response về — cần `initialValue` hoặc xử lý trạng thái loading.
:::
