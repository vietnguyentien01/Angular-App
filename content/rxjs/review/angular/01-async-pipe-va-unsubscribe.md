---
title: async pipe, takeUntilDestroyed, toSignal
summary: Ba cách dùng Observable trong component mà không phải tự unsubscribe.
type: card
level: core
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, angular, unsubscribe]
related: [rxjs/consolidate/angular/memory-leak-va-takeuntildestroyed]
---

## TL;DR

| Cách | Unsubscribe khi | Hợp với |
|---|---|---|
| `obs$ \| async` trong template | Component bị huỷ | Hiển thị dữ liệu |
| `takeUntilDestroyed()` | Component/service bị huỷ (`DestroyRef`) | `subscribe()` để làm side effect |
| `toSignal(obs$)` | Injection context bị huỷ | Dùng giá trị như signal (computed, template) |

```ts title="user-page.ts"
export class UserPage {
  private readonly api = inject(UserApi);
  private readonly route = inject(ActivatedRoute);

  // 1. toSignal: dùng như signal trong template / computed
  readonly user = toSignal(
    this.route.paramMap.pipe(switchMap((p) => this.api.get(p.get('id')!))),
  );

  constructor() {
    // 2. takeUntilDestroyed: phải gọi trong injection context (constructor / field)
    this.api.notifications$.pipe(takeUntilDestroyed()).subscribe((n) => this.toast(n));
  }
}
```

:::warning Bẫy
`takeUntilDestroyed()` **không tham số** chỉ chạy trong injection context. Gọi trong `ngOnInit` hoặc một method sẽ lỗi — khi đó truyền `DestroyRef`: `takeUntilDestroyed(this.destroyRef)`.
:::

:::quiz HTTP request (`http.get`) có cần unsubscribe không?
- [ ] Không bao giờ, vì nó tự complete
- [x] Thường không gây leak vì complete sau 1 response, nhưng vẫn nên huỷ nếu component bị huỷ trước khi response về
- [ ] Luôn luôn phải gọi `unsubscribe()` thủ công
- [ ] Chỉ khi dùng `POST`

Request complete sau response nên không leak lâu dài. Nhưng nếu người dùng rời trang trước khi response về, callback vẫn chạy trên component đã huỷ. `async` pipe / `takeUntilDestroyed` / `toSignal` huỷ request đúng lúc.
:::

:::quiz Đặt `takeUntilDestroyed()` ở đâu trong pipe?
- [ ] Đầu tiên
- [x] Thường là operator cuối cùng, ngay trước `subscribe`
- [ ] Không quan trọng
- [ ] Bên trong `switchMap`

Nếu đặt trước một operator như `switchMap`, inner Observable tạo ra **sau** điểm đó sẽ không bị huỷ theo. Quy tắc an toàn: để cuối cùng.
:::
