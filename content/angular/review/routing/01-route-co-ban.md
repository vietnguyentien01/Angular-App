---
title: Định nghĩa route, lazy loading và route params
summary: provideRouter, loadComponent, nhận param bằng input, routerLink, redirect và wildcard.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [routing, lazy-loading]
related: [angular/review/routing/guard-va-dieu-huong]
---

## Cấu hình

```ts title="app.routes.ts"
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'cases' },
  { path: 'cases', loadComponent: () => import('./cases/case-list').then((m) => m.CaseList) },
  { path: 'cases/:id', loadComponent: () => import('./cases/case-detail').then((m) => m.CaseDetail) },
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
  { path: '**', loadComponent: () => import('./not-found').then((m) => m.NotFound) },
];

// app.config.ts
provideRouter(routes, withComponentInputBinding());
```

## Nhận param bằng input

Với `withComponentInputBinding()`, path param, query param và route `data` được gán thẳng vào input cùng tên:

```ts title="case-detail.ts"
export class CaseDetail {
  readonly id = input.required<string>(); // từ /cases/:id
  readonly tab = input<string>(); // từ ?tab=history
  readonly detail = httpResource<Case>(() => `/api/cases/${this.id()}`);
}
```

## Điều hướng

```html
<a [routerLink]="['/cases', c.id]" [queryParams]="{ tab: 'history' }" routerLinkActive="active">{{ c.code }}</a>
```

```ts
inject(Router).navigate(['/cases', id], { queryParams: { tab: 'history' } });
```

App này dùng đúng các kỹ thuật trên: route `/:subject/:section/:topic/:slug` với `withComponentInputBinding()`.

:::quiz Thứ tự route có quan trọng không?
- [ ] Không, Angular tự chọn route khớp nhất
- [x] Có — router dùng route **đầu tiên** khớp, nên route cụ thể đặt trước route có param/wildcard
- [ ] Chỉ quan trọng với lazy route
- [ ] Chỉ quan trọng với `redirectTo`

Ví dụ trong app này: `:subject/practice` phải đứng trước `:subject/:section`, nếu không "practice" bị hiểu là một section.
:::

:::quiz `{ path: '', redirectTo: 'cases' }` thiếu `pathMatch: 'full'` thì sao?
- [ ] Không sao
- [x] Lỗi cấu hình — redirect từ path rỗng mặc định khớp tiền tố, sẽ khớp mọi URL
- [ ] Chỉ redirect lần đầu
- [ ] Redirect về trang 404

Với `pathMatch: 'prefix'` (mặc định), path rỗng là tiền tố của mọi URL. Angular báo lỗi `NG04014: Invalid configuration of route … please provide 'pathMatch'` ngay khi khởi tạo router.
:::

:::quiz Người dùng chuyển từ `/cases/1` sang `/cases/2` (cùng component). Component có bị tạo lại không?
- [ ] Có, luôn luôn
- [x] Mặc định không — component được tái sử dụng, chỉ input/param đổi; vì vậy phải phản ứng theo signal/Observable, không đọc param một lần trong `ngOnInit`
- [ ] Có nếu dùng lazy loading
- [ ] Lỗi

Đây là bug kinh điển: đọc `snapshot.params` một lần → chuyển hồ sơ khác vẫn hiện dữ liệu cũ.
:::
