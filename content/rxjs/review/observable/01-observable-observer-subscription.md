---
title: Observable, Observer, Subscription
summary: Ba khái niệm nền của RxJS, vòng đời next/error/complete và vì sao Observable "lười".
type: card
level: core
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, observable]
related: [rxjs/consolidate/observable/thu-tu-thuc-thi]
---

## TL;DR

- **Observable** — một *hàm* mô tả cách phát ra nhiều giá trị theo thời gian. Chưa ai `subscribe` thì **không chạy gì cả** (lazy).
- **Observer** — object có 3 callback: `next(value)`, `error(err)`, `complete()`.
- **Subscription** — kết quả của `subscribe()`, gọi `unsubscribe()` để dừng nhận và chạy logic dọn dẹp.

```ts title="basic.ts"
import { Observable } from 'rxjs';

const numbers$ = new Observable<number>((subscriber) => {
  subscriber.next(1);
  subscriber.next(2);
  const id = setTimeout(() => {
    subscriber.next(3);
    subscriber.complete();
  }, 1000);

  // Teardown: chạy khi complete, error hoặc unsubscribe
  return () => clearTimeout(id);
});

const sub = numbers$.subscribe({
  next: (v) => console.log('next', v),
  error: (e) => console.error('error', e),
  complete: () => console.log('complete'),
});
```

## Hợp đồng (Observable contract)

1. Phát **0..n** lần `next`.
2. Kết thúc bằng **tối đa một** `error` **hoặc** `complete`.
3. Sau `error`/`complete` → **không** có gì được phát nữa và teardown chạy.

:::tip Quy ước đặt tên
Hậu tố `$` (`user$`, `clicks$`) cho biết biến là Observable — không bắt buộc nhưng rất phổ biến trong code Angular.
:::

:::quiz Đoạn code sau in ra gì?
```ts
const source$ = new Observable<string>((s) => {
  console.log('chạy producer');
  s.next('A');
});
console.log('trước');
```

- [ ] `chạy producer` rồi `trước`
- [x] Chỉ `trước`
- [ ] `trước` rồi `chạy producer`
- [ ] `A`

Observable **lười**: hàm producer chỉ chạy khi có `subscribe()`. Ở đây chưa ai subscribe nên chỉ in `trước`.
:::

:::quiz Sau khi `subscriber.error(err)` được gọi, điều nào ĐÚNG?
- [ ] Vẫn có thể gọi `next()` tiếp, observer sẽ nhận bình thường
- [x] Không giá trị nào được phát thêm và teardown được chạy
- [ ] `complete()` vẫn sẽ được gọi sau đó
- [ ] Observable tự subscribe lại

Theo hợp đồng Observable, `error` và `complete` là trạng thái kết thúc. Mọi `next` sau đó bị bỏ qua, và hàm teardown (giá trị `return` trong producer) được gọi.
:::

:::quiz Mỗi lần gọi `numbers$.subscribe()` trong ví dụ trên thì sao?
- [x] Producer chạy lại từ đầu, mỗi subscriber có `setTimeout` riêng
- [ ] Các subscriber dùng chung một `setTimeout`
- [ ] Subscriber thứ hai chỉ nhận giá trị `3`
- [ ] Lỗi vì Observable chỉ được subscribe một lần

Observable tạo bằng `new Observable` là **unicast / cold**: mỗi subscription gọi lại hàm producer, tạo ra nguồn dữ liệu riêng.
:::

:::interview Observable khác Promise ở những điểm nào?
- Promise **eager** (chạy ngay khi tạo), Observable **lazy** (chạy khi subscribe).
- Promise trả **một** giá trị; Observable có thể phát **nhiều** giá trị theo thời gian.
- Promise không huỷ được; Observable huỷ bằng `unsubscribe()` (vd `HttpClient` sẽ abort request).
- Observable có bộ operator phong phú để biến đổi / kết hợp luồng.
:::
