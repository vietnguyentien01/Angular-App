---
title: Cold vs Hot Observable
summary: Ai tạo ra dữ liệu — trong hay ngoài Observable — quyết định mỗi subscriber có luồng riêng hay dùng chung.
type: card
level: core
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, cold, hot]
related: [rxjs/consolidate/subjects/sharereplay-va-multicasting]
---

## TL;DR

| | Cold | Hot |
|---|---|---|
| Producer | Tạo **bên trong** Observable, mỗi lần subscribe | Tồn tại **bên ngoài**, dùng chung |
| Subscriber đến muộn | Nhận lại từ đầu | Chỉ nhận giá trị từ lúc subscribe |
| Ví dụ | `HttpClient.get()`, `of()`, `interval()` | `fromEvent(document, 'click')`, `Subject`, WebSocket dùng chung |

```ts bad title="Gọi API 2 lần mà không biết"
const user$ = this.http.get<User>('/api/me');

// template: 2 async pipe → 2 HTTP request!
// {{ (user$ | async)?.name }}  {{ (user$ | async)?.email }}
```

```ts good
const user$ = this.http.get<User>('/api/me').pipe(shareReplay({ bufferSize: 1, refCount: true }));
// hoặc: subscribe một lần với @let / toSignal
```

:::warning Bẫy hay gặp
`HttpClient` trả về Observable **cold**: mỗi `subscribe` (kể cả mỗi `async` pipe) là **một request mới**. Muốn dùng chung → `shareReplay`, `toSignal`, hoặc `@let user = user$ | async;` trong template.
:::

:::quiz `interval(1000)` là cold hay hot?
- [x] Cold — mỗi subscriber có bộ đếm riêng bắt đầu từ 0
- [ ] Hot — mọi subscriber thấy cùng một số
- [ ] Hot nếu subscribe trong component
- [ ] Tuỳ trình duyệt

`interval` tạo `setInterval` mới cho mỗi subscription. Subscriber đến sau 3 giây vẫn nhận `0, 1, 2…` từ đầu.
:::

:::quiz Template có 3 lần `user$ | async` với `user$ = http.get(...)`. Có bao nhiêu request?
- [ ] 1
- [ ] 2
- [x] 3
- [ ] 0 cho đến khi click

Mỗi `async` pipe là một subscription độc lập vào Observable cold → 3 request. Đây là lỗi hiệu năng rất phổ biến trong dự án thực tế.
:::

:::interview Làm sao biến một cold Observable thành hot?
Dùng multicasting: `share()` (dùng chung khi đang có subscriber), `shareReplay({ bufferSize: 1, refCount: true })` (dùng chung + phát lại giá trị gần nhất cho subscriber mới), hoặc tự subscribe rồi đẩy vào một `Subject`/`BehaviorSubject`.
:::
