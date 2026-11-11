---
title: "Chịu lỗi nâng cao: backoff có jitter, timeout và circuit breaker"
summary: Retry đúng cách khi nhiều client cùng lỗi, giới hạn thời gian chờ, và ngừng gọi một dịch vụ đang sập để bảo vệ cả hệ thống.
level: advanced
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, retry, resilience, timeout, circuit-breaker]
related: [rxjs/consolidate/errors/xu-ly-loi-dung-cho, rxjs/deep-dive/operators/tu-viet-custom-operator]
---

## 1. Backoff + jitter

Khi server sập rồi sống lại, hàng nghìn client retry **cùng một nhịp** (1s, 2s, 4s…) sẽ dồn tải đúng lúc đó (thundering herd). Thêm **jitter** (ngẫu nhiên) để dàn đều:

```ts
export function retryWithJitter<T>(count = 3, baseMs = 500, maxMs = 10_000): MonoTypeOperatorFunction<T> {
  return retry({
    count,
    delay: (error, attempt) => {
      if (error?.status && error.status < 500 && error.status !== 429) return throwError(() => error);
      const exp = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
      return timer(Math.random() * exp); // "full jitter": ngẫu nhiên trong [0, exp)
    },
  });
}
```

## 2. Timeout

```ts
this.api.report(params).pipe(
  timeout({ first: 15_000, with: () => throwError(() => new Error('Báo cáo quá 15 giây, vui lòng thu hẹp điều kiện')) }),
);
```

`timeout({ first })` chỉ áp cho giá trị **đầu tiên** — hợp với HTTP. `each` áp cho khoảng cách giữa mọi giá trị — hợp với stream (WebSocket heartbeat).

## 3. Circuit breaker

Nếu một dịch vụ liên tục lỗi, tiếp tục gọi chỉ làm chậm UI và dồn tải lên dịch vụ đang sập. Circuit breaker "ngắt mạch":

```text
CLOSED ──(N lỗi liên tiếp)──► OPEN ──(sau cooldown)──► HALF_OPEN ──(1 request thử)──► CLOSED / OPEN
```

```ts title="circuit-breaker.ts"
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  constructor(private readonly threshold = 5, private readonly cooldownMs = 30_000) {}

  wrap<T>(source$: Observable<T>): Observable<T> {
    return defer(() => {
      const open = this.failures >= this.threshold;
      if (open && Date.now() - this.openedAt < this.cooldownMs) {
        return throwError(() => new Error('Dịch vụ tạm thời không khả dụng'));
      }
      // CLOSED, hoặc HALF_OPEN (hết cooldown) → cho request đi qua
      return source$.pipe(
        tap({ next: () => (this.failures = 0) }),
        catchError((e) => {
          if (++this.failures >= this.threshold) this.openedAt = Date.now();
          return throwError(() => e);
        }),
      );
    });
  }
}
```

`defer` đảm bảo trạng thái được kiểm tra **mỗi lần subscribe**, không phải lúc tạo Observable.

:::quiz Vì sao cần jitter khi retry?
- [ ] Để retry nhanh hơn
- [x] Để các client không retry đồng loạt cùng thời điểm, tránh dồn tải lên server vừa hồi phục
- [ ] Để giảm số lần retry
- [ ] RxJS yêu cầu

Backoff giảm tần suất, jitter dàn đều thời điểm.
:::

:::quiz Vì sao `CircuitBreaker.wrap` dùng `defer`?
- [ ] Để lazy-load code
- [x] Để kiểm tra trạng thái mạch tại thời điểm **subscribe** (mỗi lần gọi), không phải một lần lúc tạo Observable
- [ ] Để retry
- [ ] Để tránh memory leak

Không có `defer`, nhánh `if (open…)` chỉ chạy một lần khi `wrap()` được gọi.
:::

:::exercise Kết hợp
Viết pipeline cho request báo cáo: timeout 15s, retry tối đa 2 lần với jitter cho lỗi 5xx/timeout, đi qua circuit breaker, và cuối cùng hiển thị thông báo lỗi thân thiện (không làm chết luồng refresh bên ngoài).
???
```ts
refresh$.pipe(
  switchMap(() =>
    breaker
      .wrap(this.api.report(params).pipe(timeout({ first: 15_000 }), retryWithJitter(2)))
      .pipe(
        map((data) => ({ status: 'ok' as const, data })),
        catchError((e) => of({ status: 'error' as const, message: toFriendlyMessage(e) })),
      ),
  ),
);
```
Thứ tự: timeout bên trong retry (mỗi lần thử có giới hạn riêng); breaker bọc ngoài cùng để tính cả các lần thử thất bại; `catchError` bên trong `switchMap` để luồng `refresh$` sống tiếp. Lưu ý `retryWithJitter` cần coi `TimeoutError` (không có `status`) là lỗi tạm thời và retry.
:::
