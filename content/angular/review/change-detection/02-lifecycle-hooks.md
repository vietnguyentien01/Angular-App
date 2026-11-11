---
title: Lifecycle hooks — thứ tự và khi nào dùng
summary: Thứ tự chạy các hook, hook nào còn cần trong Angular hiện đại, và afterNextRender cho thao tác DOM.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [lifecycle, change-detection]
related: [angular/consolidate/change-detection/expression-changed]
---

## Thứ tự

1. `constructor` — DI, khởi tạo field (signal, computed, effect)
2. `ngOnChanges` — khi input thay đổi (trước `ngOnInit` nếu có input)
3. `ngOnInit` — một lần, sau khi input đầu tiên được gán
4. `ngDoCheck` — mỗi lượt CD đi qua component
5. `ngAfterContentInit` → `ngAfterContentChecked` — nội dung `<ng-content>`
6. `ngAfterViewInit` → `ngAfterViewChecked` — view và view con
7. `ngOnDestroy` — trước khi huỷ (hoặc `inject(DestroyRef).onDestroy(...)`)

## Hook nào còn cần?

| Nhu cầu | Cách hiện đại |
|---|---|
| Phản ứng khi input đổi | `computed` / `effect` trên signal input thay cho `ngOnChanges` |
| Dọn dẹp | `DestroyRef.onDestroy`, `takeUntilDestroyed` |
| Thao tác DOM / thư viện ngoài sau khi render | `afterNextRender` / `afterEveryRender` |
| Truy cập view child | `viewChild()` signal (đọc trong `computed`/`effect`) |

```ts title="chart.ts"
constructor() {
  // Chạy một lần sau lần render đầu — chỉ trên trình duyệt (không chạy khi SSR)
  afterNextRender(() => {
    this.chart = new Chart(this.canvas().nativeElement, this.config());
  });
}
```

:::quiz Input đầu tiên có giá trị sẵn ở hook nào sớm nhất?
- [ ] `constructor`
- [x] `ngOnChanges` (rồi `ngOnInit`)
- [ ] `ngAfterViewInit`
- [ ] `ngDoCheck`

Trong constructor input **chưa** được gán. Với signal input, đọc `this.x()` trong constructor sẽ lỗi nếu là `input.required` — hãy đọc trong `computed`/`effect`/template.
:::

:::quiz Thư viện chart cần phần tử `<canvas>` đã có trong DOM. Đặt code khởi tạo ở đâu là tốt nhất?
- [ ] `constructor`
- [ ] `ngOnInit`
- [x] `afterNextRender` (hoặc `ngAfterViewInit`)
- [ ] `ngOnChanges`

DOM của view chỉ sẵn sàng sau khi render. `afterNextRender` còn không chạy khi SSR — tránh lỗi truy cập `document`/`window` trên server.
:::

:::quiz Hook nào chạy NHIỀU lần nhất trong một component bình thường?
- [ ] `ngOnInit`
- [ ] `ngAfterViewInit`
- [x] `ngDoCheck` / `ngAfterViewChecked`
- [ ] `ngOnDestroy`

Các hook `*Checked` và `ngDoCheck` chạy mỗi lượt CD đi qua component. Đặt logic nặng ở đó làm chậm cả app.
:::
