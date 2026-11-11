---
title: Đặt catchError đúng chỗ để luồng không chết
summary: catchError ở ngoài hay trong switchMap quyết định ô tìm kiếm còn hoạt động sau lỗi đầu tiên hay không.
level: intermediate
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, error, catchError]
related: [rxjs/review/errors/catcherror-retry-co-ban, rxjs/consolidate/flattening/chon-dung-flattening]
---

## TL;DR

- Lỗi trong inner Observable **lan ra** outer → outer cũng chết.
- `catchError` ở **ngoài** `switchMap` → bắt được lỗi nhưng outer đã chết: ô tìm kiếm ngừng hoạt động.
- `catchError` ở **trong** `switchMap` → chỉ inner chết, outer tiếp tục nhận giá trị mới.

```ts bad title="Lỗi đầu tiên giết luôn ô tìm kiếm"
this.query$.pipe(
  switchMap((q) => this.api.search(q)),
  catchError(() => of([])),
);
```

```ts good
this.query$.pipe(
  switchMap((q) =>
    this.api.search(q).pipe(
      catchError(() => {
        this.error.set('Tìm kiếm lỗi, thử lại');
        return of([]);
      }),
    ),
  ),
);
```

## Retry có backoff

```ts
this.api.load().pipe(
  retry({
    count: 3,
    delay: (error, retryCount) => {
      if (error.status && error.status < 500) throw error; // 4xx: không retry
      return timer(2 ** retryCount * 500); // 1s, 2s, 4s
    },
  }),
);
```

:::quiz Với "bad example" ở trên, API lỗi ở lần tìm kiếm thứ 2. Lần gõ thứ 3 thì sao?
- [ ] Gọi API bình thường
- [x] Không gì xảy ra — luồng đã complete sau khi `catchError` thay bằng `of([])`
- [ ] Hiện lỗi lần nữa
- [ ] Retry tự động

`catchError` ở ngoài thay **toàn bộ** luồng bằng `of([])`, vốn complete ngay. `query$` không còn được lắng nghe.
:::

:::quiz Vì sao không nên retry lỗi 401/403/404?
- [ ] Vì RxJS không hỗ trợ
- [x] Vì gọi lại không thay đổi kết quả, chỉ tốn tài nguyên và làm chậm phản hồi lỗi cho người dùng
- [ ] Vì sẽ bị memory leak
- [ ] Vì server sẽ khoá IP ngay

Lỗi 4xx thường do request sai hoặc thiếu quyền — retry vô ích. Chỉ retry lỗi tạm thời (mạng, 5xx, 429 có `Retry-After`).
:::

:::quiz Trong Angular, đâu là nơi phù hợp để xử lý lỗi HTTP chung (401 → logout, hiển thị toast)?
- [ ] `catchError` trong mọi component
- [x] Một functional `HttpInterceptorFn`
- [ ] `ErrorHandler` toàn cục cho mọi lỗi HTTP
- [ ] `finalize`

Interceptor xử lý tập trung các lỗi xuyên suốt (auth, toast chung); component chỉ xử lý lỗi đặc thù của màn hình.
:::

:::exercise Viết interceptor retry lỗi mạng
Viết `HttpInterceptorFn` retry tối đa 2 lần cho request `GET` khi lỗi mạng (`status === 0`) hoặc 5xx, delay 1 giây. Không retry các method khác.
???
```ts title="retry.interceptor.ts"
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);
  return next(req).pipe(
    retry({
      count: 2,
      delay: (err: HttpErrorResponse) => {
        const transient = err.status === 0 || err.status >= 500;
        if (!transient) return throwError(() => err);
        return timer(1000);
      },
    }),
  );
};

// app.config.ts
provideHttpClient(withInterceptors([retryInterceptor]));
```
Chỉ retry `GET` vì nó **idempotent**. Retry `POST` có thể tạo bản ghi trùng.
:::
