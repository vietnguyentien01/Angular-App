---
title: Tự viết mini Observable trong 40 dòng
summary: Hiểu Observable chỉ là "hàm nhận observer", cách pipe và operator hoạt động, bằng cách tự cài đặt.
level: advanced
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, internals]
related: [rxjs/deep-dive/operators/tu-viet-custom-operator]
---

## TL;DR

Một Observable về bản chất là: **một hàm nhận observer, gọi `next/error/complete`, và trả về hàm dọn dẹp**. Mọi thứ khác (operator, pipe, Subject) xây trên ý tưởng này.

```ts title="mini-observable.ts"
type Observer<T> = { next: (v: T) => void; error: (e: unknown) => void; complete: () => void };
type Teardown = () => void;

class MiniObservable<T> {
  constructor(private readonly producer: (o: Observer<T>) => Teardown | void) {}

  subscribe(partial: Partial<Observer<T>>): { unsubscribe: () => void } {
    let closed = false;
    let teardown: Teardown | void;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      teardown?.();
    };
    const safe: Observer<T> = {
      next: (v) => !closed && partial.next?.(v),
      error: (e) => { if (!closed) { partial.error?.(e); cleanup(); } },
      complete: () => { if (!closed) { partial.complete?.(); cleanup(); } },
    };
    teardown = this.producer(safe);
    if (closed) teardown?.(); // producer đã complete đồng bộ
    return { unsubscribe: cleanup };
  }

  pipe<R>(...ops: ((src: MiniObservable<any>) => MiniObservable<any>)[]): MiniObservable<R> {
    return ops.reduce((src, op) => op(src), this as MiniObservable<any>);
  }
}
```

## Operator = hàm nhận Observable, trả Observable

```ts
const map =
  <T, R>(fn: (v: T) => R) =>
  (src: MiniObservable<T>) =>
    new MiniObservable<R>((o) => {
      const sub = src.subscribe({ next: (v) => o.next(fn(v)), error: o.error, complete: o.complete });
      return () => sub.unsubscribe();
    });
```

Điểm quan trọng: operator **subscribe vào nguồn khi chính nó được subscribe** — vì vậy cả chuỗi `pipe` vẫn lười, và `unsubscribe` lan ngược lên tận nguồn.

:::quiz Vì sao cần cờ `closed` trong `subscribe`?
- [ ] Để tăng tốc
- [x] Để đảm bảo hợp đồng: không phát gì sau error/complete và teardown chỉ chạy một lần
- [ ] Vì TypeScript yêu cầu
- [ ] Để hỗ trợ nhiều subscriber

Producer có thể vô tình gọi `next` sau `complete`. Lớp "safe subscriber" bảo vệ observer — RxJS thật làm việc này trong class `Subscriber`.
:::

:::quiz Với chuỗi `src.pipe(map(a), filter(b))`, khi gọi `subscribe()`, nguồn `src` được subscribe lúc nào?
- [ ] Khi gọi `pipe()`
- [x] Khi gọi `subscribe()` trên kết quả cuối, lan ngược qua từng operator
- [ ] Ngay khi import
- [ ] Không bao giờ

`pipe` chỉ ghép hàm. Subscribe ở cuối chuỗi kích hoạt `filter` subscribe vào `map`, `map` subscribe vào `src`.
:::

:::exercise Viết operator `filter` và hàm `fromArray`
Dùng `MiniObservable` ở trên, viết `filter(predicate)` và `fromArray(arr)` (phát từng phần tử rồi complete). Kiểm tra: `fromArray([1,2,3,4]).pipe(filter(x => x % 2 === 0), map(x => x * 10))` phát `20, 40`.
???
```ts
const fromArray = <T>(arr: T[]) =>
  new MiniObservable<T>((o) => {
    for (const v of arr) o.next(v);
    o.complete();
  });

const filter =
  <T>(pred: (v: T) => boolean) =>
  (src: MiniObservable<T>) =>
    new MiniObservable<T>((o) => {
      const sub = src.subscribe({ next: (v) => pred(v) && o.next(v), error: o.error, complete: o.complete });
      return () => sub.unsubscribe();
    });

fromArray([1, 2, 3, 4])
  .pipe<number>(filter((x: number) => x % 2 === 0), map((x: number) => x * 10))
  .subscribe({ next: console.log }); // 20, 40
```
:::

:::interview Vì sao operator của RxJS là "pipeable function" thay vì method trên prototype (như RxJS 5)?
Hàm độc lập giúp **tree-shaking** (không dùng thì không vào bundle), dễ viết operator tuỳ chỉnh, và tránh "patch prototype" toàn cục. `pipe()` chỉ là compose các hàm `Observable → Observable`.
:::
