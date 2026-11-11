---
title: share, shareReplay và bẫy refCount
summary: Dùng chung một luồng cho nhiều subscriber, cache kết quả HTTP, và vì sao shareReplay có thể gây leak.
level: intermediate
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, shareReplay, multicasting]
related: [rxjs/review/observable/cold-vs-hot, rxjs/review/subjects/cac-loai-subject]
---

## TL;DR

| | `share()` | `shareReplay({ bufferSize: 1, refCount: true })` | `shareReplay(1)` |
|---|---|---|---|
| Dùng chung nguồn | ✓ | ✓ | ✓ |
| Subscriber đến muộn nhận giá trị cũ | ✗ | ✓ | ✓ |
| Hết subscriber thì huỷ nguồn | ✓ | ✓ | ✗ (nguồn sống mãi) |

```ts good title="config.service.ts"
@Service()
export class ConfigService {
  /** Gọi API một lần, mọi nơi dùng chung kết quả */
  readonly config$ = inject(HttpClient).get<Config>('/api/config').pipe(shareReplay({ bufferSize: 1, refCount: true }));
}
```

:::warning Bẫy refCount
`shareReplay(1)` (cú pháp ngắn) có `refCount: false`: khi mọi subscriber đã unsubscribe, **nguồn bên trong vẫn chạy**. Với HTTP (complete ngay) thì vô hại; với `interval`, WebSocket, `valueChanges` → **memory leak**. Khi nguồn không complete, dùng `{ bufferSize: 1, refCount: true }`.
:::

:::quiz Hai component subscribe `user$ = http.get(...).pipe(share())`, nhưng component thứ hai subscribe SAU khi response đã về. Có bao nhiêu request?
- [ ] 1, component 2 nhận giá trị cũ
- [x] 2 — `share` không lưu giá trị, nguồn đã complete nên subscribe mới tạo request mới
- [ ] 1, component 2 không nhận gì
- [ ] 0

`share()` chỉ dùng chung khi subscription **chồng lên nhau**. Sau khi nguồn complete, subscriber mới khởi động lại nguồn. Muốn cache kết quả → `shareReplay`.
:::

:::quiz `interval(1000).pipe(shareReplay(1))` được subscribe trong component rồi component bị huỷ. Chuyện gì xảy ra?
- [ ] `interval` dừng
- [x] `interval` vẫn chạy mãi vì `refCount` mặc định là `false`
- [ ] Lỗi
- [ ] `interval` dừng sau 1 giá trị

Đây là leak kinh điển. Dùng `shareReplay({ bufferSize: 1, refCount: true })`.
:::

:::quiz Muốn cache response và retry khi lỗi, nhưng nếu lỗi thì lần subscribe sau phải gọi lại API (không cache lỗi). `shareReplay` xử lý lỗi thế nào?
- [x] Lỗi không được cache — subscriber sau sẽ subscribe lại nguồn
- [ ] Lỗi được replay cho mọi subscriber mãi mãi
- [ ] `shareReplay` nuốt lỗi
- [ ] Không xác định

Khi nguồn lỗi, `shareReplay` reset trạng thái nội bộ, nên lần subscribe tiếp theo sẽ chạy lại nguồn.
:::

:::senior Góc nhìn Senior
Với dữ liệu server cần cache, invalidate, refetch khi focus… việc tự ráp `shareReplay` nhanh chóng trở nên phức tạp. Đó là lý do có các thư viện **server state** (TanStack Query) hoặc `resource()`/`httpResource()` của Angular. Hãy dùng `shareReplay` cho case đơn giản (config, danh mục ít đổi).
:::
