---
title: Đặt provider ở đâu? root, route, component hay viewProviders
summary: Chọn đúng phạm vi để state được chia sẻ hoặc tách biệt như mong muốn — và các bug do khai báo nhầm chỗ.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [di, providers, scope, state]
related: [angular/review/dependency-injection/injector-hierarchy]
---

## TL;DR

| Đặt ở | Một instance cho | Dùng khi |
|---|---|---|
| `@Service()` / root | Toàn app | Auth, config, cache dùng chung |
| `providers` của route | Nhánh route đó (giữ lại khi rời route) | Service chỉ dùng trong một feature lazy |
| `providers` của component | **Mỗi instance component** + con của nó (cả nội dung `ng-content`) | State của một dialog, một wizard, một dòng bảng |
| `viewProviders` | Mỗi instance component + view của nó, **không** cho nội dung chiếu vào (`ng-content`) | Component thư viện muốn giấu service nội bộ |

## Ví dụ: state riêng cho mỗi wizard

```ts title="order-wizard.ts"
@Injectable() // không providedIn — chỉ tồn tại khi có component cung cấp
export class WizardState {
  readonly step = signal(1);
  readonly data = signal<Partial<Order>>({});
}

@Component({
  selector: 'app-order-wizard',
  providers: [WizardState], // mỗi wizard một state, tự huỷ cùng component
  template: `<app-step-customer /><app-step-items /><app-step-confirm />`,
})
export class OrderWizard {}
```

Mở hai wizard cạnh nhau → hai `WizardState` độc lập. Đóng wizard → state bị huỷ (`ngOnDestroy` của service được gọi).

:::warning Bug hay gặp
Thêm `providers: [UserService]` vào một component "cho chắc" khiến component đó và con của nó dùng **instance khác** với phần còn lại của app → dữ liệu không đồng bộ. Service đã `@Service()` thì **không** liệt kê lại trong `providers` trừ khi bạn thật sự muốn instance riêng.
:::

:::quiz Service khai báo trong `providers` của component có bị huỷ khi component bị huỷ không?
- [x] Có — `ngOnDestroy` của service được gọi
- [ ] Không, service luôn là singleton
- [ ] Chỉ khi dùng `viewProviders`
- [ ] Chỉ khi service có `@Service()`

Vòng đời của service gắn với element injector tạo ra nó.
:::

:::quiz Component thư viện `<lib-tabs>` dùng `TabsRegistry` nội bộ. Muốn nội dung người dùng đặt vào `<ng-content>` KHÔNG inject được `TabsRegistry` này. Dùng gì?
- [ ] `providers`
- [x] `viewProviders`
- [ ] `@Service()`
- [ ] Route providers

`viewProviders` chỉ hiển thị cho view của chính component, không cho nội dung được chiếu vào.
:::

:::quiz Trang danh sách đơn hàng (lazy route) dùng `OrderFilterState` đặt trong route `providers`. Người dùng rời trang rồi quay lại. Bộ lọc thế nào?
- [ ] Reset về mặc định
- [x] Vẫn giữ bộ lọc cũ vì route injector được giữ lại
- [ ] Lỗi
- [ ] Tuỳ trình duyệt

Đôi khi đây là tính năng (giữ bộ lọc). Nếu muốn reset mỗi lần vào, chuyển sang `providers` của component trang.
:::

:::exercise Chọn phạm vi
Chọn nơi đặt provider cho: (a) `AuthService`, (b) state chỉnh sửa của mỗi dòng trong bảng có chế độ sửa inline, (c) `ReportApi` chỉ dùng trong module báo cáo lazy, (d) state nội bộ của một component date-picker trong design system.
???
(a) root — `@Service()`. (b) `providers` của component dòng (mỗi dòng một state, tự huỷ khi dòng bị xoá). (c) `@Service()` vẫn tốt (tree-shake và chỉ được tải trong chunk lazy nếu chỉ chunk đó dùng); dùng route `providers` khi cần cấu hình riêng cho nhánh. (d) `viewProviders` để không lộ ra nội dung người dùng chiếu vào.
:::
