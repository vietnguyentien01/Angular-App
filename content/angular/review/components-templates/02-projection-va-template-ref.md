---
title: Content projection, ng-template và template reference
summary: ng-content có select, ng-template với ngTemplateOutlet, biến #ref và viewChild — xây component tái sử dụng.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [template, ng-content, ng-template]
related: [angular/review/components-templates/binding-va-control-flow]
---

## `ng-content` — chiếu nội dung từ ngoài vào

```ts title="card.ts"
@Component({
  selector: 'app-card',
  template: `
    <header><ng-content select="[card-title]" /></header>
    <section><ng-content /></section>
    <footer><ng-content select="app-card-actions" /></footer>
  `,
})
export class Card {}
```

```html
<app-card>
  <h2 card-title>Hồ sơ #123</h2>
  <p>Nội dung chính…</p>
  <app-card-actions><button>Duyệt</button></app-card-actions>
</app-card>
```

## `ng-template` — template để render sau / truyền đi

```ts title="data-table.ts"
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet],
  template: `
    @for (row of rows(); track row.id) {
      <tr>
        <ng-container *ngTemplateOutlet="rowTpl() ?? defaultRow; context: { $implicit: row }" />
      </tr>
    }
    <ng-template #defaultRow let-row><td>{{ row.id }}</td></ng-template>
  `,
})
export class DataTable<T extends { id: string }> {
  readonly rows = input.required<T[]>();
  readonly rowTpl = contentChild<TemplateRef<{ $implicit: T }>>('row');
}
```

## Template reference `#ref`

```html
<input #search (keyup.enter)="find(search.value)" />
<app-player #player /> <button (click)="player.play()">▶</button>
```

Trong class: `readonly input = viewChild.required<ElementRef<HTMLInputElement>>('search');`

:::quiz `<ng-content>` có được render nhiều lần (vd trong `@for`) không?
- [ ] Có, mỗi vòng lặp một bản
- [x] Không — nội dung được chiếu chỉ xuất hiện một lần; muốn lặp lại phải dùng `ng-template`
- [ ] Có nếu dùng `select`
- [ ] Tuỳ trình duyệt

Nội dung chiếu được khởi tạo bởi component cha **một lần**. Để render nhiều lần, cha truyền `TemplateRef`.
:::

:::quiz `contentChild('row')` khác `viewChild('row')` ở đâu?
- [ ] Không khác
- [x] `contentChild` tìm trong nội dung được chiếu vào (`<ng-content>`), `viewChild` tìm trong template của chính component
- [ ] `contentChild` chỉ dùng cho directive
- [ ] `viewChild` chạy trước constructor

Content = do cha truyền vào; view = do chính component khai báo.
:::

:::quiz `let-row` trong `<ng-template let-row>` lấy giá trị từ đâu?
- [ ] Biến toàn cục `row`
- [x] Thuộc tính `$implicit` của object `context` truyền vào khi render template
- [ ] Từ input của component
- [ ] Từ `@for`

`let-x="name"` lấy `context.name`; `let-x` không gán thì lấy `$implicit`.
:::
