---
title: "Angular 22.3.0-rc.0: HttpClient.query() và router error boundaries"
date: 2026-11-12
summary: "Bản RC đầu tiên của Angular 22.3 thêm HttpClient.query() cho HTTP method QUERY và tính năng error boundary cho router (developer preview). Angular CLI 22.3.0-rc.0 deprecate builder ng-packagr và option testRunner."
importance: medium
tags: [angular, release, http, router, cli]
relatedTopics: [angular/http, angular/routing, angular/cli-project]
sources:
  - title: angular/angular — CHANGELOG (22.3.0-rc.0, 2026-11-12)
    url: https://github.com/angular/angular/blob/main/CHANGELOG.md
  - title: angular/angular-cli — CHANGELOG (22.3.0-rc.0, 2026-11-12)
    url: https://github.com/angular/angular-cli/blob/main/CHANGELOG.md
---

## Có gì mới

Ngày 2026-11-12, Angular phát hành `22.3.0-rc.0` (npm tag `next`; bản `latest` vẫn là 22.2.x). Hai tính năng mới đáng chú ý:

- **`HttpClient.query()`** (`@angular/common/http`): gửi request với method `QUERY`. Method này có body như `POST`, nhưng HttpClient đối xử với nó như một method "an toàn". Các overload giống `post()`: `query<T>(url, body, options?)` cùng các biến thể `observe` / `responseType`. Trong code của bản RC:
  - XSRF interceptor **không** gắn token cho `QUERY`, giống `GET` / `HEAD`.
  - `QUERY` nằm trong danh sách method được phép dùng HTTP transfer cache khi SSR, cùng `GET` và `HEAD`.
- **Router error boundaries** (`@developerPreview 22.3`):
  - Bật bằng `withErrorBoundaries()` trong `provideRouter`.
  - Khi bật, lỗi xảy ra trong routed component (lifecycle hook, template binding, resource loader, event handler) sẽ được `RouterOutlet` bắt lại.
  - Thay vào component bị lỗi, router render `errorComponent` khai báo trên route, hoặc `defaultErrorComponent` nếu route không khai báo. Lỗi được truyền vào qua input `error`.
  - Có callback `onError(error, details)`. Callback này chạy trong root injection context nên dùng được `inject()`.

Các thay đổi khác trong bản RC:

- Compiler báo lỗi khi bind property không tồn tại trên `<ng-template>` viết tường minh.
- Router chạy `loadComponent` song song với route resources.
- Nhiều bản sửa memory leak. Phần lớn đã được backport sang 22.2.6.

Angular CLI `22.3.0-rc.0` có hai deprecation:

- Builder `@angular/build:ng-packagr` và các API `executeNgPackagrBuilder` / `NgPackagrBuilderOptions` bị deprecate. Thay bằng `@angular/build:library`.
- Option `testRunner` của các schematic `application`, `library`, `ng-new` bị deprecate. Theo changelog, project mới sau này sẽ chỉ được cấu hình với Vitest.

## Vì sao quan trọng

- **Màn hình tìm kiếm phức tạp** (lọc hồ sơ bảo hiểm, tra cứu giao dịch ngân hàng) thường phải dùng `POST /search` vì bộ lọc quá dài để nhét vào query string. Có `query()`, frontend diễn đạt đúng ý "đọc dữ liệu có body". Tuy vậy, backend, reverse proxy, WAF và API gateway đều phải hỗ trợ method `QUERY` thì mới dùng được. Ở môi trường enterprise, đây thường là chỗ vướng nhất.
- **XSRF không được gắn cho `QUERY`.** Nếu backend chống CSRF bằng cách kiểm tra header XSRF với mọi request có body, cần cân nhắc lại chính sách. Chỉ nên cho phép `QUERY` khi endpoint thực sự chỉ đọc dữ liệu.
- **Error boundary** giúp một route lỗi không làm "trắng" cả trang hay kẹt ở trạng thái nửa vời. Đây là pattern quen thuộc ở các framework khác, nay Angular có sẵn trong router. Lưu ý tính năng đang ở **developer preview**, API còn có thể thay đổi.
- **Thư viện nội bộ** (design system, shared lib trong Nx monorepo) build bằng `@angular/build:ng-packagr` nên lên kế hoạch chuyển sang `@angular/build:library`. Angular CLI đã có migration `use-library-builder` để chuyển từ ng-packagr. Bản RC này sửa thêm cho migration đó và bổ sung schematic `entry-point`.

## Ví dụ

```ts title="policy-search.service.ts"
// Trước: dùng POST cho một thao tác thực chất chỉ đọc
search(filter: PolicyFilter) {
  return this.http.post<Policy[]>('/api/policies/search', filter);
}

// Từ 22.3 (hiện là RC): method QUERY — backend phải hỗ trợ
search(filter: PolicyFilter) {
  return this.http.query<Policy[]>('/api/policies/search', filter);
}
```

```ts title="app.config.ts"
import { provideRouter, withErrorBoundaries } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withErrorBoundaries({
        defaultErrorComponent: RouteErrorComponent,
        onError: (error) => inject(ErrorReporter).report(error),
      }),
    ),
  ],
};

// Route có thể tự khai báo component lỗi riêng
export const routes: Routes = [
  { path: 'claims', component: ClaimsPage, errorComponent: ClaimsErrorComponent },
];
```

```ts title="route-error.component.ts"
@Component({
  selector: 'app-route-error',
  template: `
    <h2>Không tải được trang này</h2>
    <p>{{ error()?.message }}</p>
  `,
})
export class RouteErrorComponent {
  readonly error = input<Error>();
}
```

## Việc nên làm

- **Theo dõi:** đây là bản RC. Chưa nâng cấp production cho tới khi 22.3.0 stable ra mắt.
- **Thử trên nhánh riêng:**
  - `withErrorBoundaries()` cho các route hay lỗi do dữ liệu (chi tiết hồ sơ, dashboard).
  - `query()` cho một endpoint tìm kiếm, sau khi đã xác nhận gateway / WAF cho phép method `QUERY`.
- **Lên kế hoạch:**
  - Thư viện còn build bằng `@angular/build:ng-packagr` thì chuyển sang `@angular/build:library`.
  - Project còn chạy Karma / Jasmine thì tính trước việc chuyển sang Vitest.
