---
title: Thiết kế API cho component tái sử dụng
summary: Chọn giữa input và content projection, tránh "god component" hàng chục input, model() cho two-way, và slot bằng ng-template — áp dụng cho thư viện UI dùng chung.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [components, api-design, design-system]
related: [angular/review/components-templates/projection-va-template-ref, angular/deep-dive/components-templates/dynamic-component]
---

## Dấu hiệu component bị thiết kế sai

```html bad
<app-card
  [title]="t" [subtitle]="s" [showIcon]="true" [iconName]="'case'" [iconColor]="'red'"
  [showFooter]="true" [footerText]="f" [primaryButtonText]="'Duyệt'" [secondaryButtonText]="'Từ chối'"
  (primaryClick)="approve()" (secondaryClick)="reject()" [loading]="l" [compact]="true" …
/>
```

Mỗi yêu cầu mới → thêm một input. Sau một năm có 30 input, kết hợp vô số trường hợp, không ai dám sửa.

## Nguyên tắc

| Nhu cầu | Dùng |
|---|---|
| Dữ liệu đơn giản (chuỗi, số, trạng thái) | `input()` |
| Nội dung tự do (nút, icon, HTML tuỳ ý) | `<ng-content select>` |
| Nội dung lặp lại / cần dữ liệu từ component con | `ng-template` + `contentChild` |
| Giá trị người dùng sửa và cha cần biết | `model()` |
| Biến thể giao diện | Một input `variant` dạng union thay vì nhiều boolean |

```html good
<app-card variant="compact">
  <app-icon card-icon name="case" />
  <h3 card-title>Hồ sơ #123</h3>
  <p>Nội dung…</p>
  <ng-container card-actions>
    <button (click)="approve()">Duyệt</button>
    <button (click)="reject()">Từ chối</button>
  </ng-container>
</app-card>
```

## Boolean → union

```ts bad
readonly small = input(false);
readonly large = input(false); // small && large = ???
```

```ts good
readonly size = input<'sm' | 'md' | 'lg'>('md');
```

:::senior Góc nhìn Senior
Một component thư viện tốt có **ít input, nhiều chỗ mở rộng**. Khi review PR thêm input thứ 10 cho một component dùng chung, hãy hỏi: "nhu cầu này có thể giải quyết bằng projection để người dùng tự đặt nội dung không?"
:::

:::quiz Component `<app-button>` cần hỗ trợ icon trái, icon phải, chỉ icon, có/không có badge. Cách thiết kế bền vững nhất?
- [ ] Thêm `leftIcon`, `rightIcon`, `iconOnly`, `badge`, `badgeColor`… làm input
- [x] Chiếu nội dung (`<ng-content>`) để người dùng đặt icon/badge, input chỉ cho `variant`, `size`, `disabled`
- [ ] Tạo 4 component khác nhau
- [ ] Dùng `[innerHTML]`

Projection cho phép tổ hợp tự do mà API không phình ra.
:::

:::quiz Vì sao `size: 'sm' | 'md' | 'lg'` tốt hơn hai boolean `small`, `large`?
- [ ] Nhanh hơn
- [x] Loại bỏ tổ hợp vô nghĩa (`small && large`) ngay từ kiểu dữ liệu
- [ ] Boolean không dùng được làm input
- [ ] Để tương thích SSR

"Make invalid states unrepresentable" — để type system ngăn trạng thái sai.
:::

:::exercise Thiết kế `<app-data-list>`
Component hiển thị danh sách có trạng thái loading/empty/error, mỗi dòng do người dùng tự định nghĩa giao diện. Phác thảo API (input, output, slot).
???
```html
<app-data-list [items]="cases()" [status]="status()" (retry)="reload()">
  <ng-template #row let-c>
    <app-case-row [case]="c" />
  </ng-template>
  <p data-list-empty>Chưa có hồ sơ nào</p>
</app-data-list>
```
- `items = input.required<T[]>()`, `status = input<'loading' | 'success' | 'error'>('success')`
- `retry = output<void>()` cho nút "Thử lại" ở trạng thái lỗi
- `row = contentChild.required<TemplateRef<{ $implicit: T }>>('row')` — giao diện dòng do người dùng quyết định
- `<ng-content select="[data-list-empty]">` cho nội dung rỗng tuỳ biến, có nội dung mặc định nếu không truyền
- Component tự lo skeleton loading, a11y (`aria-busy`), và track theo id.
:::
