---
title: Custom operator cho codebase enterprise
summary: Đóng gói các chuỗi operator lặp lại (loading state, retry chuẩn, log) thành operator dùng chung có type rõ ràng.
level: advanced
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, custom-operator, architecture]
related: [rxjs/deep-dive/observable/tu-viet-mini-observable]
---

## TL;DR

Hai cách viết custom operator:

1. **Ghép operator có sẵn** (hay dùng nhất) — trả về `pipe(...)`.
2. **Từ đầu** với `new Observable` — khi cần logic subscribe/teardown đặc biệt.

## Cách 1 — ghép operator

```ts title="operators/with-request-state.ts"
export type RequestState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown };

export function withRequestState<T>(): OperatorFunction<T, RequestState<T>> {
  return pipe(
    map((data) => ({ status: 'success', data }) as const),
    catchError((error) => of({ status: 'error', error } as const)),
    startWith({ status: 'loading' } as const),
  );
}

// dùng:
readonly orders = toSignal(this.api.orders().pipe(withRequestState()), {
  initialValue: { status: 'loading' },
});
```

## Cách 2 — từ đầu

```ts title="operators/log-lifecycle.ts"
export function logLifecycle<T>(tag: string): MonoTypeOperatorFunction<T> {
  return (source) =>
    new Observable<T>((subscriber) => {
      console.debug(`[${tag}] subscribe`);
      const sub = source.subscribe({
        next: (v) => subscriber.next(v),
        error: (e) => subscriber.error(e),
        complete: () => subscriber.complete(),
      });
      return () => {
        console.debug(`[${tag}] unsubscribe`);
        sub.unsubscribe();
      };
    });
}
```

:::senior Góc nhìn Senior
Custom operator là cách **chuẩn hoá hành vi** trong team lớn: một `retryTransient()` chung thay vì mỗi người viết `retry` một kiểu, một `withRequestState()` để mọi màn hình xử lý loading/error giống nhau. Đặt chúng trong một lib dùng chung (vd `libs/shared/rxjs`) và viết marble test cho từng operator.
:::

:::quiz `MonoTypeOperatorFunction<T>` khác `OperatorFunction<T, R>` thế nào?
- [x] MonoType giữ nguyên kiểu giá trị (`T → T`), OperatorFunction có thể đổi kiểu (`T → R`)
- [ ] MonoType chỉ dùng cho Subject
- [ ] Không khác gì
- [ ] MonoType là operator đồng bộ

`MonoTypeOperatorFunction<T>` = `OperatorFunction<T, T>` — hợp với operator như `tap`, `filter`, `logLifecycle`.
:::

:::quiz Trong `withRequestState`, vì sao `startWith` đứng CUỐI?
- [ ] Không quan trọng
- [x] Để giá trị `loading` được phát trước tiên, và không bị `map` biến đổi
- [ ] Vì `startWith` phải luôn đứng cuối mọi pipe
- [ ] Để bắt lỗi

`startWith` chèn giá trị vào **đầu** luồng output của nó. Nếu đặt trước `map`, `{status:'loading'}` sẽ bị `map` bọc thành `{status:'success', data: {status:'loading'}}`.
:::

:::exercise Viết operator `retryTransient`
Retry tối đa `count` lần (mặc định 2) với exponential backoff (500ms, 1s, 2s…) chỉ khi lỗi là `HttpErrorResponse` có `status === 0` hoặc `>= 500`.
???
```ts
export function retryTransient<T>(count = 2): MonoTypeOperatorFunction<T> {
  return retry({
    count,
    delay: (error, attempt) => {
      const transient =
        error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
      return transient ? timer(500 * 2 ** (attempt - 1)) : throwError(() => error);
    },
  });
}
```
`retry` với config object đã là một `MonoTypeOperatorFunction`, nên chỉ cần trả về nó.
:::
