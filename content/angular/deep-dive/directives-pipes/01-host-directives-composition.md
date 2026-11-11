---
title: Composition bằng hostDirectives — xây hành vi cho design system
summary: Ghép các hành vi nhỏ (focus ring, tooltip, disabled, ripple) vào component bằng hostDirectives thay vì kế thừa class, và cách thiết kế directive dễ tái sử dụng.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [directive, host-directives, composition, design-system]
related: [angular/consolidate/directives-pipes/structural-directive-tu-viet, angular/consolidate/components-templates/thiet-ke-component-tai-su-dung]
---

## Vấn đề với kế thừa

```ts bad
class BaseButton { /* disabled, focus, tooltip… */ }
class IconButton extends BaseButton {}
class MenuButton extends BaseButton {}
// Muốn "tooltip" cho một <app-chip> không phải button → không kế thừa được
```

## Composition

```ts title="behaviors.ts"
@Directive({
  selector: '[appDisabled]',
  host: { '[attr.aria-disabled]': 'disabled() || null', '[class.opacity-50]': 'disabled()', '(click)': 'guard($event)' },
})
export class DisabledBehavior {
  readonly disabled = input(false, { alias: 'appDisabled', transform: booleanAttribute });
  protected guard(e: Event) {
    if (this.disabled()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
}

@Directive({ selector: '[appTooltip]', host: { '(mouseenter)': 'show()', '(mouseleave)': 'hide()', '(focus)': 'show()', '(blur)': 'hide()' } })
export class TooltipBehavior {
  readonly text = input('', { alias: 'appTooltip' });
  protected show() { /* CDK Overlay… */ }
  protected hide() {}
}
```

```ts title="icon-button.ts"
@Component({
  selector: 'app-icon-button',
  hostDirectives: [
    { directive: DisabledBehavior, inputs: ['appDisabled: disabled'] },
    { directive: TooltipBehavior, inputs: ['appTooltip: label'] },
  ],
  host: { role: 'button', tabindex: '0', '[attr.aria-label]': 'label()' },
  template: `<ng-content />`,
})
export class IconButton {
  readonly label = input.required<string>();
}
```

```html
<app-icon-button label="Xoá hồ sơ" [disabled]="!canDelete()"><app-icon name="trash" /></app-icon-button>
```

- Hành vi được **tái sử dụng** cho bất kỳ component nào.
- `inputs: ['appDisabled: disabled']` đổi tên input khi lộ ra ngoài — API của component vẫn gọn.
- Component có thể `inject(DisabledBehavior)` để đọc trạng thái của behavior.

:::quiz Input của host directive có tự động lộ ra trên component không?
- [ ] Có, mọi input đều lộ ra
- [x] Không — phải khai báo trong `inputs: [...]` của `hostDirectives` thì mới dùng được từ bên ngoài
- [ ] Chỉ input bắt buộc
- [ ] Chỉ khi directive là standalone

Điều này giúp component kiểm soát chính xác API công khai.
:::

:::quiz Component `IconButton` muốn biết `disabled` hiện tại để đổi icon. Cách đúng?
- [ ] Khai báo lại input `disabled` trong component
- [x] `inject(DisabledBehavior).disabled()` — host directive nằm cùng injector của element
- [ ] Đọc DOM `aria-disabled`
- [ ] Dùng `@ViewChild`

Host directive và component dùng chung element injector nên inject được lẫn nhau.
:::
