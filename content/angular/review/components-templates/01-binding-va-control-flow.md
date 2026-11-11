---
title: Binding và control flow (@if, @for, @switch, @let)
summary: Bốn kiểu binding, cú pháp control flow mới và các biến ngữ cảnh của @for.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [template, binding, control-flow]
related: [angular/review/components-templates/projection-va-template-ref, angular/review/performance/checklist-hieu-nang]
---

## Bốn kiểu binding

| Cú pháp | Hướng | Ví dụ |
|---|---|---|
| `{{ expr }}` | component → DOM (text) | `{{ user().name }}` |
| `[prop]="expr"` | component → DOM/con (property) | `[disabled]="saving()"`, `[class.active]="isActive()"` |
| `(event)="handler($event)"` | DOM/con → component | `(click)="save()"` |
| `[(prop)]="value"` | hai chiều | `[(value)]="rating"` với `model()` |

`[attr.aria-label]`, `[style.width.px]`, `[class.x]` là các dạng property binding đặc biệt.

## Control flow

```html
@if (user(); as u) {
  <p>Xin chào {{ u.name }}</p>
} @else if (loading()) {
  <app-spinner />
} @else {
  <a routerLink="/login">Đăng nhập</a>
}

@for (item of items(); track item.id; let i = $index, last = $last) {
  <li [class.border-b]="!last">{{ i + 1 }}. {{ item.name }}</li>
} @empty {
  <li>Chưa có dữ liệu</li>
}

@switch (status()) {
  @case ('draft') { <span>Nháp</span> }
  @case ('approved') { <span>Đã duyệt</span> }
  @default { <span>Khác</span> }
}

@let total = subtotal() + shipping();
<p>Tổng: {{ total | number }}</p>
```

Biến ngữ cảnh của `@for`: `$index`, `$first`, `$last`, `$even`, `$odd`, `$count`.

:::version v16 Ở Angular 16 / 19
v16 dùng `*ngIf`, `*ngFor` (với `trackBy`), `[ngSwitch]` — cần import `NgIf`, `NgFor`… Control flow `@if/@for/@switch` có từ **v17**, `@let` từ **v18.1**. Chuyển đổi tự động: `ng generate @angular/core:control-flow`.
:::

:::quiz `@for` khác `*ngFor` ở điểm bắt buộc nào?
- [ ] Phải có `@empty`
- [x] Phải có `track`
- [ ] Phải có `let i = $index`
- [ ] Không được lồng nhau

`track` bắt buộc để Angular nhận diện phần tử khi danh sách thay đổi — tránh quên `trackBy` như thời `*ngFor`.
:::

:::quiz `[class.active]="isActive()"` làm gì?
- [ ] Ghi đè toàn bộ thuộc tính `class`
- [x] Thêm hoặc bỏ đúng class `active` tuỳ giá trị, giữ nguyên các class khác
- [ ] Tạo biến `active` trong component
- [ ] Chỉ chạy một lần

Đây là cách được khuyến nghị thay cho `ngClass`.
:::

:::quiz `@let` có phạm vi thế nào?
- [ ] Toàn component, dùng được trong TypeScript
- [x] Chỉ trong template, từ chỗ khai báo trở xuống trong cùng khối (và các khối con)
- [ ] Toàn app
- [ ] Chỉ trong `@for`

`@let` giúp tránh lặp biểu thức và tránh nhiều `async` pipe trên cùng một Observable.
:::
