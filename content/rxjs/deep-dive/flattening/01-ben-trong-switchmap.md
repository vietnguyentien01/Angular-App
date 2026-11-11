---
title: Bên trong switchMap — tự cài đặt để hiểu huỷ, complete và concurrency
summary: Viết switchMap và mergeMap có giới hạn concurrency từ new Observable, để hiểu chính xác khi nào inner bị huỷ và khi nào kết quả complete.
level: advanced
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, flattening, internals]
related: [rxjs/review/flattening/bon-toan-tu-flattening, rxjs/deep-dive/observable/tu-viet-mini-observable]
---

## Tự viết `switchMap`

```ts title="my-switch-map.ts"
export function mySwitchMap<T, R>(project: (v: T) => Observable<R>): OperatorFunction<T, R> {
  return (source) =>
    new Observable<R>((subscriber) => {
      let innerSub: Subscription | null = null;
      let outerDone = false;

      const outerSub = source.subscribe({
        next: (value) => {
          innerSub?.unsubscribe(); // ← "switch": huỷ inner cũ
          innerSub = project(value).subscribe({
            next: (r) => subscriber.next(r),
            error: (e) => subscriber.error(e), // lỗi inner = lỗi toàn luồng
            complete: () => {
              innerSub = null;
              if (outerDone) subscriber.complete(); // chỉ complete khi cả hai xong
            },
          });
        },
        error: (e) => subscriber.error(e),
        complete: () => {
          outerDone = true;
          if (!innerSub) subscriber.complete();
        },
      });

      return () => {
        outerSub.unsubscribe();
        innerSub?.unsubscribe();
      };
    });
}
```

Ba quy tắc rút ra:

1. Giá trị outer mới → **unsubscribe** inner hiện tại (đây là lúc `HttpClient` abort request).
2. Kết quả chỉ **complete** khi outer complete **và** không còn inner đang chạy.
3. Lỗi của inner **giết** cả luồng — vì vậy `catchError` phải đặt bên trong `project`.

## `mergeMap` có giới hạn concurrency

```ts
export function myMergeMap<T, R>(project: (v: T) => Observable<R>, concurrent = Infinity): OperatorFunction<T, R> {
  return (source) =>
    new Observable<R>((subscriber) => {
      const buffer: T[] = [];
      let active = 0;
      let outerDone = false;
      const subs = new Subscription();

      const run = (value: T) => {
        active++;
        subs.add(
          project(value).subscribe({
            next: (r) => subscriber.next(r),
            error: (e) => subscriber.error(e),
            complete: () => {
              active--;
              if (buffer.length) run(buffer.shift()!); // còn hàng đợi → chạy tiếp
              else if (outerDone && active === 0) subscriber.complete();
            },
          }),
        );
      };

      subs.add(
        source.subscribe({
          next: (v) => (active < concurrent ? run(v) : buffer.push(v)),
          error: (e) => subscriber.error(e),
          complete: () => {
            outerDone = true;
            if (active === 0 && !buffer.length) subscriber.complete();
          },
        }),
      );
      return subs;
    });
}
```

`concatMap(fn)` chính là `mergeMap(fn, 1)`.

:::quiz Với `switchMap`, outer complete trong khi inner vẫn đang chạy. Kết quả complete khi nào?
- [ ] Ngay lập tức
- [x] Khi inner hiện tại complete
- [ ] Không bao giờ
- [ ] Khi có giá trị outer mới

Đây cũng là lý do "Mẫu leak #3" (takeUntil đặt trước switchMap) vẫn leak: outer complete nhưng inner không bị huỷ.
:::

:::quiz Trong `myMergeMap(fn, 2)`, outer phát 5 giá trị liên tiếp. Ngay lúc đó có bao nhiêu inner đang chạy?
- [ ] 5
- [x] 2 — 3 giá trị còn lại nằm trong hàng đợi
- [ ] 1
- [ ] 0

Mỗi khi một inner complete, một giá trị trong hàng đợi được chạy.
:::

:::exercise Viết `myExhaustMap`
Dựa trên `mySwitchMap`, viết `exhaustMap`: bỏ qua giá trị outer khi inner đang chạy.
???
```ts
export function myExhaustMap<T, R>(project: (v: T) => Observable<R>): OperatorFunction<T, R> {
  return (source) =>
    new Observable<R>((subscriber) => {
      let innerSub: Subscription | null = null;
      let outerDone = false;
      const outerSub = source.subscribe({
        next: (value) => {
          if (innerSub) return; // đang bận → bỏ qua
          innerSub = project(value).subscribe({
            next: (r) => subscriber.next(r),
            error: (e) => subscriber.error(e),
            complete: () => {
              innerSub = null;
              if (outerDone) subscriber.complete();
            },
          });
        },
        error: (e) => subscriber.error(e),
        complete: () => {
          outerDone = true;
          if (!innerSub) subscriber.complete();
        },
      });
      return () => {
        outerSub.unsubscribe();
        innerSub?.unsubscribe();
      };
    });
}
```
Khác biệt duy nhất so với `switchMap`: thay `innerSub?.unsubscribe()` bằng `if (innerSub) return`.
:::
