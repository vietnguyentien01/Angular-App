---
title: Tự viết attribute directive và host binding
summary: Directive thêm hành vi cho phần tử có sẵn — host object thay cho @HostBinding/@HostListener, input của directive và hostDirectives.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [directive, host-binding]
related: [angular/review/directives-pipes/pipe-co-san-va-pure]
---

## Attribute directive

```ts title="autofocus.directive.ts"
@Directive({ selector: '[appAutofocus]' })
export class AutofocusDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  constructor() {
    afterNextRender(() => this.el.nativeElement.focus());
  }
}
```

```ts title="copy-to-clipboard.directive.ts"
@Directive({
  selector: '[appCopy]',
  host: {
    '(click)': 'copy()',
    '[attr.title]': '"Bấm để sao chép"',
    '[class.cursor-copy]': 'true',
  },
})
export class CopyDirective {
  readonly appCopy = input.required<string>(); // <span [appCopy]="code">…</span>
  protected copy() {
    void navigator.clipboard.writeText(this.appCopy());
  }
}
```

- `host: { '(event)': ..., '[prop]': ... }` thay cho `@HostListener` / `@HostBinding` (cách được khuyến nghị).
- Input trùng tên selector cho phép viết `[appCopy]="value"`.

## `hostDirectives` — ghép hành vi vào component

```ts
@Component({
  selector: 'app-icon-button',
  hostDirectives: [{ directive: TooltipDirective, inputs: ['appTooltip: tooltip'] }],
  template: `<ng-content />`,
})
export class IconButton {}
```

:::quiz Directive và component khác nhau cơ bản ở đâu?
- [ ] Directive không có input
- [x] Component = directive **có template**; directive thuần chỉ thêm hành vi cho phần tử chủ (host)
- [ ] Directive chỉ dùng với `@for`
- [ ] Component không có host binding

Component kế thừa mọi khả năng của directive và thêm view riêng.
:::

:::quiz Vì sao dùng `afterNextRender` thay vì gọi `focus()` ngay trong constructor?
- [ ] Vì constructor không được gọi `inject`
- [x] Lúc constructor chạy, phần tử có thể chưa được gắn vào DOM nên `focus()` không có tác dụng; `afterNextRender` chạy sau khi render (và không chạy khi SSR)
- [ ] Vì `focus` là bất đồng bộ
- [ ] Không có lý do

Thao tác DOM nên chờ sau render.
:::
