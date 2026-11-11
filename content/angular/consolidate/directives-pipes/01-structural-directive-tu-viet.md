---
title: Tự viết structural directive — *appHasRole
summary: TemplateRef + ViewContainerRef, cú pháp * và microsyntax, phản ứng theo signal, và khi nào nên dùng control flow thay vì directive.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [directive, structural, templateref]
related: [angular/review/directives-pipes/tu-viet-directive, angular/deep-dive/directives-pipes/host-directives-composition]
---

## Ý tưởng

Structural directive quyết định **có render template hay không** (hoặc render bao nhiêu lần). Dấu `*` chỉ là cú pháp rút gọn:

```html
<button *appHasRole="'approver'">Duyệt</button>
<!-- tương đương -->
<ng-template [appHasRole]="'approver'"><button>Duyệt</button></ng-template>
```

## Cài đặt

```ts title="has-role.directive.ts"
@Directive({ selector: '[appHasRole]' })
export class HasRoleDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly auth = inject(AuthService); // roles = signal<string[]>([])

  readonly appHasRole = input.required<string | string[]>();
  readonly appHasRoleElse = input<TemplateRef<unknown>>(); // *appHasRole="'admin'; else noAccess"

  constructor() {
    effect(() => {
      const needed = [this.appHasRole()].flat();
      const ok = needed.some((r) => this.auth.roles().includes(r));
      this.vcr.clear();
      const tpl = ok ? this.tpl : this.appHasRoleElse();
      if (tpl) this.vcr.createEmbeddedView(tpl);
    });
  }
}
```

```html
<button *appHasRole="['approver', 'admin']; else readonly">Duyệt</button>
<ng-template #readonly><span>Chỉ xem</span></ng-template>
```

Microsyntax: `; else x` được dịch thành input `appHasRoleElse` (tiền tố = tên selector).

:::warning Đây là UX, không phải bảo mật
Ẩn nút trên giao diện không ngăn người dùng gọi API. Server vẫn phải kiểm tra quyền.
:::

:::tip Có cần directive không?
Nhiều trường hợp chỉ cần `@if (auth.hasRole('approver')) { … }`. Viết directive khi logic lặp lại ở nhiều nơi và muốn cú pháp gọn, nhất quán cho cả team.
:::

:::quiz Trong structural directive, `TemplateRef` đại diện cho gì?
- [ ] Phần tử DOM đã render
- [x] Bản thiết kế (template) của phần tử gắn `*appHasRole`, chưa được render
- [ ] Component cha
- [ ] ViewContainer

`ViewContainerRef.createEmbeddedView(tpl)` mới thực sự tạo DOM từ template đó.
:::

:::quiz Vì sao gọi `this.vcr.clear()` trước khi tạo view mới trong effect?
- [ ] Không cần
- [x] Mỗi lần roles đổi, effect chạy lại; không clear sẽ render chồng thêm bản sao
- [ ] Để giải phóng TemplateRef
- [ ] Bắt buộc của Angular

(Tối ưu hơn: chỉ tạo lại khi kết quả `ok` thực sự đổi.)
:::

:::exercise Tối ưu
Effect hiện tại xoá và tạo lại view mỗi khi `roles` đổi, kể cả khi kết quả vẫn là "được xem" → mất state của nội dung bên trong. Sửa để chỉ render lại khi kết quả thay đổi.
???
```ts
private readonly allowed = computed(() => {
  const needed = [this.appHasRole()].flat();
  return needed.some((r) => this.auth.roles().includes(r));
});

constructor() {
  effect(() => {
    const ok = this.allowed(); // computed memoize: chỉ báo khi true ↔ false
    const elseTpl = this.appHasRoleElse();
    untracked(() => {
      this.vcr.clear();
      const tpl = ok ? this.tpl : elseTpl;
      if (tpl) this.vcr.createEmbeddedView(tpl);
    });
  });
}
```
`computed` chỉ thông báo khi giá trị boolean đổi, nên view không bị tạo lại vô ích.
:::
