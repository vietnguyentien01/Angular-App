---
title: HttpClient cơ bản và interceptor
summary: Gọi API có type, HttpParams, xử lý HttpErrorResponse, functional interceptor và HttpContext.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [http, httpclient, interceptor]
related: [rxjs/consolidate/errors/xu-ly-loi-dung-cho, angular/consolidate/security/token-va-xsrf]
---

## Gọi API

```ts title="case.api.ts"
@Service()
export class CaseApi {
  private readonly http = inject(HttpClient);

  search(q: string, page = 1) {
    return this.http.get<Page<Case>>('/api/cases', { params: { q, page } });
  }
  create(body: Omit<Case, 'id'>) {
    return this.http.post<Case>('/api/cases', body);
  }
  download(id: string) {
    return this.http.get(`/api/cases/${id}/pdf`, { responseType: 'blob' });
  }
}
```

- `get<T>` chỉ **khai báo** kiểu, không kiểm tra dữ liệu thật — server trả sai cấu trúc thì TS không biết.
- Observable của HttpClient là **cold**: không `subscribe` (hoặc `async`/`toSignal`) thì **không có request nào**.

## Xử lý lỗi

```ts
this.api.create(body).subscribe({
  error: (err: HttpErrorResponse) => {
    if (err.status === 0) toast('Mất kết nối mạng');
    else if (err.status === 422) this.serverErrors.set(err.error.errors);
    else toast('Có lỗi xảy ra');
  },
});
```

## Interceptor dạng hàm

```ts
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_LOADING)) return next(req);
  const loading = inject(LoadingService);
  loading.start();
  return next(req).pipe(finalize(() => loading.stop()));
};

export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

// app.config.ts
provideHttpClient(withInterceptors([authInterceptor, loadingInterceptor]));
// bỏ loading cho một request:
this.http.get('/api/ping', { context: new HttpContext().set(SKIP_LOADING, true) });
```

:::quiz `this.api.create(body);` (không subscribe). Request có được gửi không?
- [ ] Có
- [x] Không — Observable của HttpClient lazy, chỉ gửi khi được subscribe
- [ ] Gửi sau 1 giây
- [ ] Tuỳ method

Bug thường gặp: nút "Lưu" không làm gì vì quên `subscribe`.
:::

:::quiz `err.status === 0` thường nghĩa là gì?
- [ ] Server trả lỗi 500
- [x] Request không tới được server / không có response (mất mạng, CORS chặn, request bị huỷ)
- [ ] Thành công
- [ ] Token hết hạn

Không có HTTP status thật nên Angular đặt `status = 0`.
:::

:::quiz Thứ tự interceptor trong `withInterceptors([a, b])` khi gửi request?
- [x] `a` chạy trước rồi tới `b`; response đi ngược lại `b` rồi `a`
- [ ] `b` trước rồi `a`
- [ ] Song song
- [ ] Ngẫu nhiên

Giống chuỗi middleware: request đi xuôi, response đi ngược.
:::
