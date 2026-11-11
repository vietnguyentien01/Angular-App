---
title: Interceptor thực chiến — chuẩn hoá lỗi, loading, retry, thứ tự
summary: Bộ interceptor điển hình cho app enterprise, HttpContext để tắt/bật theo request, và vì sao thứ tự khai báo quan trọng.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [http, interceptor, error-handling]
related: [angular/review/http/httpclient-co-ban, angular/consolidate/security/token-va-xsrf, rxjs/consolidate/errors/xu-ly-loi-dung-cho]
---

## Bộ interceptor điển hình

```ts title="app.config.ts"
provideHttpClient(
  withInterceptors([
    baseUrlInterceptor, // '/api/...' → 'https://api.../api/...'
    authInterceptor, //    gắn token (chỉ cho API của mình)
    loadingInterceptor, // đếm request đang chạy
    errorInterceptor, //   chuẩn hoá lỗi + toast chung
    retryInterceptor, //   retry GET khi lỗi tạm thời — đứng SAU errorInterceptor
  ]),
);
```

Request đi **xuôi** danh sách, response/lỗi đi **ngược** lại (interceptor cuối cùng thấy lỗi đầu tiên).

Vì sao `retryInterceptor` đứng **sau** `errorInterceptor`?

- Lỗi từ server đi qua `retryInterceptor` **trước** → nó retry lặng lẽ. Chỉ khi hết lượt retry, lỗi mới lên tới `errorInterceptor` → **một** toast, một `AppError`.
- Nếu đảo ngược (`retry` trước `error`), mỗi lần thử thất bại đều đi qua `errorInterceptor` trước → **mỗi lần thử một toast**, và `retryInterceptor` nhận `AppError` thay vì `HttpErrorResponse` nên điều kiện `status >= 500` có thể không còn đúng.

## Chuẩn hoá lỗi

```ts title="error.interceptor.ts"
export interface AppError {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export const SILENT_ERROR = new HttpContextToken(() => false);

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const appError: AppError = {
        status: err.status,
        code: err.error?.code ?? (err.status === 0 ? 'NETWORK' : 'UNKNOWN'),
        message: err.status === 0 ? 'Mất kết nối mạng' : (err.error?.message ?? 'Có lỗi xảy ra'),
        fieldErrors: err.status === 422 ? err.error?.errors : undefined,
      };
      if (!req.context.get(SILENT_ERROR) && err.status !== 422) inject(Toast).error(appError.message);
      return throwError(() => appError);
    }),
  );
```

Component chỉ còn xử lý `AppError` thống nhất, không phải biết cấu trúc lỗi của từng backend.

## Loading toàn cục bằng bộ đếm

```ts
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService); // pending = signal(0); isLoading = computed(() => pending() > 0)
  loading.pending.update((n) => n + 1);
  return next(req).pipe(finalize(() => loading.pending.update((n) => n - 1)));
};
```

Dùng **bộ đếm** chứ không phải boolean — 3 request song song, request đầu xong không được tắt loading.

:::quiz Vì sao dùng `inject(Toast)` được bên trong interceptor dạng hàm?
- [ ] Không dùng được
- [x] Functional interceptor chạy trong injection context của environment injector
- [ ] Vì Toast là singleton
- [ ] Chỉ được dùng khi có `@Injectable`

Đây là ưu điểm lớn so với class interceptor cũ: không cần constructor.
:::

:::quiz `loadingInterceptor` dùng `finalize` thay vì `tap({ complete })` vì?
- [ ] `tap` không có `complete`
- [x] `finalize` chạy cả khi thành công, lỗi **và khi request bị huỷ** (unsubscribe) — bộ đếm không bị kẹt
- [ ] `finalize` nhanh hơn
- [ ] Bắt buộc với HttpClient

Request bị `switchMap` huỷ không complete cũng không error — chỉ `finalize` bắt được.
:::

:::quiz Một request không muốn hiện toast lỗi chung. Cách gọn nhất?
- [ ] Viết interceptor riêng
- [x] Truyền `context: new HttpContext().set(SILENT_ERROR, true)` cho request đó
- [ ] Thêm header tuỳ chỉnh
- [ ] Bỏ `errorInterceptor`

`HttpContext` truyền "cờ" từ nơi gọi xuống interceptor mà không gửi gì lên server.
:::

:::exercise Base URL theo môi trường
Viết `baseUrlInterceptor` thêm `API_BASE_URL` (InjectionToken) vào request có URL bắt đầu bằng `/api/`, giữ nguyên request khác (asset, URL tuyệt đối).
???
```ts
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  const base = inject(API_BASE_URL).replace(/\/$/, '');
  return next(req.clone({ url: `${base}${req.url}` }));
};
```
`HttpRequest` là immutable — luôn `clone()` để thay đổi.
:::
