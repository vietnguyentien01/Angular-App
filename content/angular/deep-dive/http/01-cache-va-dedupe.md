---
title: Cache và gộp request trùng ở tầng HTTP
summary: Interceptor cache có TTL, gộp các request GET giống nhau đang bay, invalidate sau khi ghi, và transfer cache khi SSR.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [http, cache, dedupe, interceptor, ssr]
related: [angular/consolidate/http/interceptor-thuc-chien, rxjs/consolidate/subjects/sharereplay-va-multicasting]
---

## Vấn đề

Màn hình có 5 widget, mỗi widget tự gọi `/api/me` và `/api/catalog/provinces`. Kết quả: 10 request cho 2 dữ liệu giống nhau — mỗi lần chuyển trang lại gọi tiếp.

## Interceptor: gộp request đang bay + cache TTL

```ts title="cache.interceptor.ts"
export const CACHE_TTL = new HttpContextToken<number>(() => 0); // 0 = không cache

const inFlight = new Map<string, Observable<HttpEvent<unknown>>>();
const store = new Map<string, { at: number; res: HttpResponse<unknown> }>();

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  const ttl = req.context.get(CACHE_TTL);
  if (req.method !== 'GET' || ttl <= 0) return next(req);

  const key = req.urlWithParams;
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) return of(hit.res.clone());

  let shared = inFlight.get(key);
  if (!shared) {
    shared = next(req).pipe(
      tap((e) => e instanceof HttpResponse && store.set(key, { at: Date.now(), res: e })),
      finalize(() => inFlight.delete(key)),
      share(), // các subscriber trùng dùng chung một request
    );
    inFlight.set(key, shared);
  }
  return shared;
};

// dùng:
this.http.get<Province[]>('/api/catalog/provinces', { context: new HttpContext().set(CACHE_TTL, 10 * 60_000) });
```

## Invalidate sau khi ghi

```ts
export function invalidate(prefix: string) {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}
// sau khi POST/PUT /api/cases thành công: invalidate('/api/cases')
```

## SSR: không gọi lại API khi hydrate

Với SSR, `provideClientHydration()` mặc định bật **HTTP transfer cache**: response của các request GET/HEAD trên server được nhúng vào HTML, trình duyệt dùng lại thay vì gọi lại khi hydrate. Tuỳ chỉnh bằng `withHttpTransferCacheOptions(...)`.

:::senior Góc nhìn Senior
Cache ở tầng HTTP đơn giản nhưng **mù nghiệp vụ**: nó không biết `POST /api/cases` làm cũ `GET /api/cases?page=2`. Khi logic invalidate bắt đầu phức tạp, đó là tín hiệu nên chuyển sang một lớp server state có khái niệm query key / invalidation rõ ràng (TanStack Query, hoặc store tự viết quanh `resource`).
:::

:::quiz Vì sao cần `inFlight` ngoài `store`?
- [ ] Không cần
- [x] `store` chỉ có dữ liệu sau khi response về; nếu 5 widget gọi cùng lúc, chưa có cache → vẫn 5 request. `inFlight` gộp chúng thành 1
- [ ] Để lưu lỗi
- [ ] Để retry

Đây là "request deduplication" — tách biệt với caching.
:::

:::quiz Vì sao trả về `hit.res.clone()` thay vì `hit.res`?
- [ ] Bắt buộc theo cú pháp
- [x] Tránh để nơi nhận vô tình sửa object trong cache dùng chung (vd mutate body) ảnh hưởng tới lần đọc sau
- [ ] Để HttpClient chấp nhận response
- [ ] Để tăng TTL

`HttpResponse.clone()` tạo object response mới. Body là object JS dùng chung — nếu cần an toàn tuyệt đối, deep-freeze hoặc clone body.
:::

:::exercise Cache theo người dùng
App cho phép đăng xuất rồi đăng nhập tài khoản khác trên cùng tab. Cache ở trên có rủi ro gì và sửa thế nào?
???
Rủi ro: `store` là biến module, sống suốt vòng đời tab → người dùng B có thể thấy dữ liệu của người dùng A (`/api/me`, danh sách hồ sơ được phân quyền). Sửa: xoá toàn bộ `store` và `inFlight` khi logout / đổi tài khoản (vd `AuthService.logout()` gọi `clearHttpCache()`), hoặc đưa user id vào cache key. Với dữ liệu nhạy cảm, chỉ cache dữ liệu công khai (danh mục tỉnh/thành…).
:::
