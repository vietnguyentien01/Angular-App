---
title: Lưu token ở đâu, gắn token cho ai, và XSRF trong HttpClient
summary: localStorage hay cookie httpOnly, interceptor gắn token đúng domain, cơ chế XSRF tích hợp của Angular và vì sao guard không phải là bảo mật.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [security, auth, token, xsrf, interceptor]
related: [angular/consolidate/security/bypass-csp-trusted-types, angular/deep-dive/security/oidc-pkce-spa]
---

## Lưu token ở đâu?

| Nơi lưu | XSS đọc được? | CSRF? | Ghi chú |
|---|---|---|---|
| `localStorage` / `sessionStorage` | **Có** | Không | Đơn giản, nhưng một lỗ XSS là mất token |
| Bộ nhớ JS (biến trong service) | Có (khó hơn) | Không | Mất khi reload → cần refresh token |
| Cookie `HttpOnly; Secure; SameSite` | **Không** | Cần chống CSRF | Thường kết hợp mô hình BFF |

Không có lựa chọn "an toàn tuyệt đối" — chống XSS (sanitize, CSP) quan trọng hơn chọn nơi lưu.

## Interceptor: chỉ gắn token cho API của mình

```ts bad
export const authInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { Authorization: `Bearer ${inject(Auth).token()}` } }));
// Gắn token cho MỌI request — kể cả request tới CDN, API bên thứ ba → lộ token
```

```ts good
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(API_BASE_URL); // vd 'https://api.example.gov.vn'
  if (!req.url.startsWith(api)) return next(req);
  const token = inject(Auth).token();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};
```

## XSRF tích hợp sẵn

Khi dùng cookie, server đặt cookie `XSRF-TOKEN`; `HttpClient` tự đọc và gửi header `X-XSRF-TOKEN`:

- Chỉ với request **không phải GET/HEAD**.
- Chỉ khi request đi tới **cùng origin** với trang (không gửi token sang domain khác).
- Đổi tên cookie/header bằng `provideHttpClient(withXsrfConfiguration({ cookieName, headerName }))`.

## Guard không phải là bảo mật

`canActivate` chỉ ẩn màn hình — người dùng vẫn gọi API trực tiếp được. **Mọi kiểm tra quyền phải ở server**; guard chỉ để UX tốt hơn.

:::quiz Vì sao interceptor "bad" ở trên nguy hiểm?
- [ ] Vì chậm
- [x] Token bị gửi kèm cả request tới domain bên thứ ba (CDN, analytics, API ngoài) — họ có thể thu được token
- [ ] Vì không chạy với GET
- [ ] Vì Angular cấm sửa header

Luôn giới hạn interceptor theo domain/đường dẫn của API mình.
:::

:::quiz HttpClient tự gắn header `X-XSRF-TOKEN` cho request nào?
- [ ] Mọi request
- [ ] Chỉ GET
- [x] Request không phải GET/HEAD, tới cùng origin với trang
- [ ] Chỉ request tới domain khác

Đọc trong mã nguồn `xsrfInterceptorFn` của `@angular/common/http`: bỏ qua GET/HEAD và request khác origin.
:::

:::quiz Route admin có `canActivate: [adminGuard]`. Điều nào ĐÚNG?
- [ ] Người không phải admin không thể lấy dữ liệu admin
- [x] Guard chỉ chặn điều hướng phía client; API admin vẫn phải tự kiểm tra quyền
- [ ] Guard mã hoá dữ liệu
- [ ] Guard thay thế được kiểm tra ở server

Mọi thứ chạy trên trình duyệt đều có thể bị bỏ qua.
:::

:::exercise Refresh token khi 401
Viết ý tưởng cho interceptor: khi API trả 401, gọi refresh **một lần** (kể cả khi nhiều request cùng 401), rồi gửi lại các request đó với token mới; nếu refresh lỗi → logout.
???
```ts
let refreshing$: Observable<string> | null = null;

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || req.url.endsWith('/auth/refresh')) return throwError(() => err);
      refreshing$ ??= auth.refresh().pipe(
        finalize(() => (refreshing$ = null)),
        shareReplay({ bufferSize: 1, refCount: true }), // mọi request 401 dùng chung một lần refresh
      );
      return refreshing$.pipe(
        switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
        catchError((e) => {
          auth.logout();
          return throwError(() => e);
        }),
      );
    }),
  );
};
```
Điểm mấu chốt: `shareReplay` để nhiều request cùng 401 chỉ kích hoạt **một** lần refresh; bỏ qua chính request refresh để tránh vòng lặp vô hạn.
:::
