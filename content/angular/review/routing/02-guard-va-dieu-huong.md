---
title: Functional guard và resolver
summary: canActivate, canMatch, canDeactivate kiểu hàm, trả về UrlTree để chuyển hướng, và resolver.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [routing, guard, resolver]
related: [angular/review/routing/route-co-ban, angular/consolidate/security/token-va-xsrf]
---

## Guard dạng hàm

```ts title="auth.guard.ts"
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const unsavedChangesGuard: CanDeactivateFn<{ hasUnsavedChanges(): boolean }> = (component) =>
  !component.hasUnsavedChanges() || confirm('Bạn có thay đổi chưa lưu. Rời trang?');
```

```ts
{
  path: 'admin',
  canMatch: [adminGuard], // không khớp → không tải chunk lazy
  loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
},
{ path: 'cases/:id/edit', canActivate: [authGuard], canDeactivate: [unsavedChangesGuard], loadComponent: … },
```

| Guard | Chạy khi | Dùng cho |
|---|---|---|
| `canMatch` | Trước khi chọn route (trước khi tải lazy) | Ẩn hẳn route theo quyền / feature flag |
| `canActivate` | Trước khi vào route | Yêu cầu đăng nhập |
| `canActivateChild` | Trước khi vào route con | Bảo vệ cả nhánh |
| `canDeactivate` | Trước khi rời route | Cảnh báo dữ liệu chưa lưu |

## Resolver

```ts
export const caseResolver: ResolveFn<Case> = (route) => inject(CaseApi).get(route.paramMap.get('id')!);
// { path: 'cases/:id', resolve: { case: caseResolver }, ... } → input `case` (với withComponentInputBinding)
```

:::tip Resolver hay resource?
Resolver chặn điều hướng cho tới khi có dữ liệu (trang trắng lâu nếu API chậm). Nhiều trường hợp nên vào trang ngay và hiển thị loading bằng `httpResource`.
:::

:::quiz Guard trả về `UrlTree` có ý nghĩa gì?
- [ ] Lỗi
- [x] Huỷ điều hướng hiện tại và chuyển sang URL trong `UrlTree`
- [ ] Cho phép điều hướng
- [ ] Reload trang

Trả `UrlTree` tốt hơn gọi `router.navigate()` trong guard rồi trả `false` — router xử lý gọn trong một lần điều hướng.
:::

:::quiz Muốn người không có quyền thậm chí không tải được JS của module admin. Dùng guard nào?
- [ ] `canActivate`
- [x] `canMatch`
- [ ] `canDeactivate`
- [ ] Resolver

`canMatch` chạy trước khi route được chọn, nên `loadChildren` không được gọi. (Nhưng nhớ: bảo mật thật vẫn phải ở server.)
:::
