---
title: Tìm và sửa memory leak do subscription
summary: Các mẫu code gây leak hay gặp trong dự án Angular và cách sửa bằng takeUntilDestroyed, async pipe, toSignal.
level: intermediate
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, memory-leak, angular]
related: [rxjs/review/angular/async-pipe-va-unsubscribe]
---

## TL;DR

Subscription **không tự huỷ** khi component bị huỷ nếu nguồn không complete. Nguồn "sống lâu" hay gây leak:

- Observable từ service singleton (`store.select`, `Subject` trong service)
- `interval`, `fromEvent(window, ...)`, WebSocket
- `form.valueChanges`, `router.events`

## Mẫu leak #1 — subscribe trong ngOnInit

```ts bad
ngOnInit() {
  this.store.user$.subscribe((u) => (this.user = u));
}
```

```ts good
readonly user = toSignal(this.store.user$);
```

## Mẫu leak #2 — subscribe lồng nhau

```ts bad
this.route.params.subscribe((p) => {
  this.api.get(p['id']).subscribe((data) => (this.data = data));
});
```

```ts good
this.route.params
  .pipe(
    switchMap((p) => this.api.get(p['id'])),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe((data) => this.data.set(data));
```

## Mẫu leak #3 — takeUntil đặt sai chỗ

```ts bad
this.source$.pipe(
  takeUntil(this.destroy$),
  switchMap(() => interval(1000)), // inner interval không bị huỷ!
).subscribe();
```

:::tip Cách phát hiện leak
Chrome DevTools → **Memory** → chụp Heap snapshot trước và sau khi vào/ra trang vài lần, lọc theo tên component. Nếu số instance tăng dần → có leak. Có thể thêm `finalize(() => console.log('unsubscribed'))` để kiểm tra subscription có kết thúc không.
:::

:::quiz Đoạn nào KHÔNG gây leak khi component bị huỷ?
- [ ] `interval(1000).subscribe(...)` trong constructor
- [ ] `this.store.select(x).subscribe(...)` trong `ngOnInit`
- [x] `this.http.get('/a').subscribe(...)` (response về trước khi huỷ)
- [ ] `fromEvent(window, 'resize').subscribe(...)`

HTTP complete sau khi có response, subscription tự kết thúc. Ba lựa chọn còn lại là nguồn không complete.
:::

:::quiz Vì sao đoạn code "Mẫu leak #3" vẫn leak?
- [ ] `takeUntil` không hoạt động với Subject
- [x] `takeUntil` đứng trước `switchMap` nên chỉ huỷ nguồn ngoài; inner `interval` đã được subscribe vẫn chạy
- [ ] `destroy$` chưa được complete
- [ ] `interval` không thể huỷ

Thực tế khi `takeUntil` complete nguồn ngoài, `switchMap` vẫn giữ inner đang chạy cho tới khi inner complete. Đặt `takeUntil`/`takeUntilDestroyed` **cuối cùng**. ESLint có rule `rxjs/no-unsafe-takeuntil` để bắt lỗi này.
:::

:::quiz `takeUntilDestroyed()` gọi trong `ngOnInit()` (không truyền tham số) sẽ?
- [ ] Hoạt động bình thường
- [x] Ném lỗi vì không ở trong injection context
- [ ] Không bao giờ huỷ
- [ ] Huỷ ngay lập tức

Không tham số thì nó gọi `inject(DestroyRef)`, chỉ hợp lệ trong constructor / field initializer. Trong lifecycle hook, truyền `this.destroyRef` vào.
:::

:::exercise Refactor component sau cho không leak và gọn hơn
```ts
export class Dashboard implements OnInit, OnDestroy {
  stats: Stats | undefined;
  private sub = new Subscription();

  constructor(private store: StatsStore) {}

  ngOnInit() {
    this.sub.add(interval(30_000).pipe(startWith(0)).subscribe(() => this.store.refresh()));
    this.sub.add(this.store.stats$.subscribe((s) => (this.stats = s)));
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
```
???
```ts
export class Dashboard {
  private readonly store = inject(StatsStore);
  readonly stats = toSignal(this.store.stats$);

  constructor() {
    interval(30_000)
      .pipe(startWith(0), takeUntilDestroyed())
      .subscribe(() => this.store.refresh());
  }
}
```
Bỏ `OnInit`/`OnDestroy` và `Subscription` thủ công. `toSignal` tự huỷ subscription, còn `stats()` dùng được trực tiếp trong template và tương thích với OnPush/zoneless.
:::
