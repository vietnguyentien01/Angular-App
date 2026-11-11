---
title: markForCheck, detectChanges, detach — khi nào dùng cái nào
summary: Điều khiển change detection thủ công cho tích hợp thư viện ngoài, bảng dữ liệu lớn và code cũ chưa dùng signals.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [change-detection, ChangeDetectorRef, performance]
related: [angular/review/change-detection/default-vs-onpush, angular/deep-dive/change-detection/zoneless-ben-trong]
---

## TL;DR

| API | Làm gì | Đồng bộ? |
|---|---|---|
| `markForCheck()` | Đánh dấu view này **và mọi tổ tiên** là dirty → được kiểm tra ở lượt CD tới (zoneless: lên lịch lượt đó) | Không |
| `detectChanges()` | Chạy CD **ngay** cho view này và con của nó | Có |
| `detach()` / `reattach()` | Tách view khỏi cây CD — Angular bỏ qua cho tới khi reattach | — |

:::demo onpush-tree

## Khi nào cần trong Angular hiện đại?

Với **signals** gần như không cần — đọc signal trong template là đủ để Angular biết khi nào render. Các trường hợp còn lại:

- Tích hợp thư viện ngoài gọi callback (map, chart, WebSocket SDK) cập nhật **field thường**.
- Code cũ dùng field thường + OnPush.
- Màn hình cập nhật cực nhanh (ticker giá) cần **giới hạn** tần suất render: `detach()` rồi `detectChanges()` theo nhịp riêng.

```ts title="price-ticker.ts"
export class PriceTicker {
  private readonly cdr = inject(ChangeDetectorRef);
  protected prices: Price[] = [];

  constructor() {
    this.cdr.detach(); // không để mỗi tick làm render
    const sdk = inject(PriceSdk);
    sdk.onTick((p) => (this.prices = p)); // cập nhật dữ liệu liên tục
    interval(500)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cdr.detectChanges()); // render 2 lần/giây
  }
}
```

:::quiz Một SDK ngoài gọi callback cập nhật `this.status = 'online'` (field thường) trong component OnPush. Cách sửa gọn nhất trong Angular 22?
- [ ] Gọi `detectChanges()` trong mọi callback
- [x] Đổi `status` thành signal và `set` trong callback
- [ ] Đổi component sang Eager
- [ ] Dùng `setTimeout`

Signal tự báo cho Angular. `markForCheck()` cũng được nhưng dễ quên; Eager làm mất lợi ích OnPush.
:::

:::quiz `markForCheck()` đánh dấu những view nào?
- [ ] Chỉ view hiện tại
- [ ] View hiện tại và toàn bộ con
- [x] View hiện tại và các tổ tiên lên tới root
- [ ] Toàn bộ app

Tổ tiên OnPush cũng phải được kiểm tra thì CD mới đi xuống được tới view này.
:::

:::quiz Sau `detach()`, điều gì KHÔNG xảy ra?
- [x] Template tự cập nhật khi event hoặc signal thay đổi
- [ ] `detectChanges()` thủ công vẫn render được
- [ ] Component vẫn nhận input
- [ ] `ngOnDestroy` vẫn chạy

View đã detach bị Angular bỏ qua trong các lượt CD tự động; chỉ `detectChanges()` gọi tay mới render.
:::

:::exercise Đánh giá đoạn code
```ts
ngOnInit() {
  this.api.load().subscribe((data) => {
    this.data = data;
    this.cdr.detectChanges();
  });
}
```
Có vấn đề gì và viết lại theo Angular 22?
???
- Gọi `detectChanges()` đồng bộ trong callback — chạy được nhưng thừa, và callback vẫn chạy (trên view đã huỷ) nếu response về sau khi component bị destroy.
- Subscribe không huỷ.

Viết lại:
```ts
readonly data = toSignal(this.api.load());
// hoặc
readonly data = httpResource<Data>(() => '/api/data');
```
:::
