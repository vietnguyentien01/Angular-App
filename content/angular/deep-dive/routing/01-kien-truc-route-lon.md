---
title: Kiến trúc routing cho ứng dụng lớn
summary: Chia feature theo route lazy, route providers, preloading có chọn lọc, TitleStrategy, view transitions — và liên hệ với micro frontend.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [routing, architecture, lazy-loading, preloading]
related: [angular/consolidate/routing/loi-thuong-gap-routing, angular/consolidate/dependency-injection/providers-o-dau]
---

## Mỗi feature một file route

```ts title="app.routes.ts"
export const routes: Routes = [
  { path: 'cases', loadChildren: () => import('./features/cases/cases.routes') },
  { path: 'reports', canMatch: [hasRole('report')], loadChildren: () => import('./features/reports/reports.routes') },
];
```

```ts title="features/cases/cases.routes.ts"
export default [
  {
    path: '',
    providers: [CaseFilterState, provideCaseApi()], // chỉ tồn tại trong nhánh này
    children: [
      { path: '', loadComponent: () => import('./case-list') },
      { path: 'new', loadComponent: () => import('./case-create') },
      { path: ':id', loadComponent: () => import('./case-detail'), title: caseTitleResolver },
    ],
  },
] satisfies Routes;
```

`loadChildren`/`loadComponent` chấp nhận **default export** — bỏ được `.then((m) => m.X)`.

## Preloading có chọn lọc

```ts
@Service()
export class FlagPreloading implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>) {
    return route.data?.['preload'] ? load() : of(null);
  }
}
// provideRouter(routes, withPreloading(FlagPreloading))
// { path: 'cases', data: { preload: true }, loadChildren: … }
```

`PreloadAllModules` tải hết sau khi app khởi động — đơn giản nhưng lãng phí với app có hàng chục module mà mỗi người dùng chỉ dùng vài cái.

## Tiêu đề trang

```ts
export const caseTitleResolver: ResolveFn<string> = (route) => `Hồ sơ ${route.paramMap.get('id')} · Hệ thống`;
```

Hoặc một `TitleStrategy` tuỳ biến để thêm hậu tố chung cho mọi route.

## Liên hệ micro frontend

Với single-spa / Module Federation, mỗi micro frontend thường sở hữu **một nhánh URL** (`/cases/**`, `/reports/**`). Nguyên tắc giống route lazy: ranh giới rõ, không import chéo, chia sẻ qua contract (URL, event, shared lib có version).

:::senior Góc nhìn Senior
Cấu trúc route chính là **bản đồ ranh giới module** của ứng dụng. Khi review, kiểm tra: feature A có import trực tiếp component của feature B không? Nếu có, đó là dấu hiệu ranh giới bị phá — nên đưa phần dùng chung vào `shared` hoặc giao tiếp qua URL/service contract.
:::

:::quiz Service đặt trong `providers` của route `cases` (lazy) được tạo khi nào?
- [ ] Khi app khởi động
- [x] Khi lần đầu cần tới trong nhánh route đó, trong environment injector riêng của nhánh
- [ ] Mỗi lần vào `/cases`
- [ ] Không bao giờ

Và nó được giữ lại khi rời route (xem bài Đặt provider ở đâu).
:::

:::quiz Khi nào preloading có chọn lọc tốt hơn `PreloadAllModules`?
- [ ] Không bao giờ
- [x] App có nhiều module lớn mà phần lớn người dùng chỉ dùng vài module — tải hết sẽ tốn băng thông, nhất là trên mobile
- [ ] Khi không dùng lazy loading
- [ ] Khi dùng SSR

Preload chỉ các module có xác suất dùng cao (vd màn hình chính của vai trò người dùng).
:::
