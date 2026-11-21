---
title: "Angular 22.3.0 ổn định: view transitions thành stable, ++/-- trong event binding, scroll và focus cho từng điều hướng"
date: 2026-11-18
summary: "Angular 22.3.0 lên tag latest ngày 18/11/2026. Ngoài HttpClient.query() và router error boundaries đã có ở bản RC: withViewTransitions() thành API stable, template cho phép ++/-- trong event binding, RouterLink có input scroll, @defer viewport nhận scrollMargin. Angular CLI 22.3.0 chưa phát hành."
importance: medium
tags: [angular, release, router, templates, defer]
relatedTopics: [angular/routing, angular/components-templates, angular/performance]
sources:
  - title: angular/angular — CHANGELOG (22.3.0, 2026-11-18)
    url: https://github.com/angular/angular/blob/main/CHANGELOG.md
  - title: angular/angular — Releases
    url: https://github.com/angular/angular/releases
  - title: angular/angular-cli — Releases
    url: https://github.com/angular/angular-cli/releases
---

## Có gì mới

Ngày 2026-11-18, `@angular/core@22.3.0` được phát hành và gắn tag `latest`. `HttpClient.query()` và router error boundaries (developer preview) đã giới thiệu ở bản tin *Angular 22.3.0-rc.0*. Bản tin này chỉ nói những thay đổi bản RC chưa nêu. Mỗi điểm dưới đây đã kiểm tra trực tiếp trên gói npm `22.3.0`, so với `22.2.5`.

- **View transitions của router thành stable.** Theo changelog: *"Mark view transitions as stable"*. Trong file `.d.ts`, `withViewTransitions()`, `ViewTransitionsFeatureOptions` và `ViewTransitionInfo` chuyển từ `@developerPreview` (19.0 / 20.0) sang `@publicApi 22.3`. API không đổi: vẫn có `skipInitialTransition` và `onViewTransitionCreated`.
- **`++` / `--` trong template expression.** Changelog: *"support increment/decrement operators in expressions"*. Thử bằng `parseTemplate` của `@angular/compiler`:

  | Template | 22.2.5 | 22.3.0 |
  |---|---|---|
  | `(click)="dem++"` | Lỗi *Unexpected end of expression* | OK |
  | `(click)="dem--"` | Lỗi | OK |
  | `{{ dem++ }}` | Lỗi | Lỗi *Bindings cannot contain assignments* |

  Toán tử này chỉ dùng được ở **event binding**. Property binding và interpolation vẫn không được gán giá trị.
- **Input `scroll` của `RouterLink`.** Changelog: *"add scroll input to RouterLink"*. Input có kiểu `'manual' | 'after-transition'` và được truyền vào `NavigationBehaviorOptions.scroll`. Giá trị `'manual'` yêu cầu router **không** cuộn trang sau một điều hướng cụ thể, kể cả khi đã bật scroll restoration (`withInMemoryScrolling`).
- **`focusReset` trong `NavigationBehaviorOptions`** (`@experimental 22.3`): `'after-transition'` (mặc định) hoặc `'manual'`. Option này **chỉ có tác dụng** khi router dùng Navigation API của trình duyệt (`withExperimentalPlatformNavigation`). Tài liệu trong code mô tả tính năng đó là *highly experimental*, chưa dùng cho production.
- **`@defer` viewport nhận `scrollMargin`.** Changelog: *"add `scrollMargin` to `@defer` viewport options"*. Ở runtime, `scrollMargin` được tính vào khoá của `IntersectionObserver` dùng chung (22.2.5 chỉ tính `rootMargin` và `threshold`).
- Các thay đổi khác theo changelog:
  - Compiler-cli thêm kiểm tra cho thuộc tính CSS dạng số bị thiếu đơn vị.
  - Language service có *smart selection range* cho template.
  - Route resources thành reactive và hỗ trợ tải song song các resource phụ thuộc nhau.
  - `RouterTestingHarness` có method `navigate`.

**Angular CLI:** tới ngày 2026-11-18, `@angular/build` mới có `22.2.8` (`latest`) và `22.3.0-rc.0` (`next`), chưa có `22.3.0`. Kiểm tra bằng `npm view`: `@angular/build@22.2.8` vẫn ghim `vite@8.3.5`, tức vẫn nằm trong dải bị ảnh hưởng của advisory Vite trong bản tin ngày 2026-11-16.

## Vì sao quan trọng

- **View transitions stable** là tín hiệu có thể dùng trong dự án có chính sách "không dùng API developer preview", vốn phổ biến ở ngân hàng và cơ quan nhà nước. Vẫn cần tôn trọng `prefers-reduced-motion` và kiểm tra trên trình duyệt mà khách hàng thực sự dùng.
- **`++`/`--` trong event binding** bớt được method nhỏ kiểu `tang()`. Tuy vậy, với signal phải dùng `dem.update(v => v + 1)`: `++` chỉ áp dụng cho field thường, và field thường thì không kích hoạt change detection trong ứng dụng zoneless theo cách signal làm.
- **`scroll: 'manual'` cho từng link** giải quyết một lỗi UX hay gặp ở màn hình danh sách có bộ lọc trên URL (tra cứu hồ sơ, sao kê): mỗi lần đổi tab hay bộ lọc, trang lại nhảy lên đầu. Trước đây phải tự lọc sự kiện `Scroll` của router.
- **`focusReset`** liên quan trực tiếp tới **accessibility** (WCAG: quản lý focus sau điều hướng), nhưng hiện chỉ chạy với Navigation API thử nghiệm. Hiện tại vẫn phải tự quản lý focus sau điều hướng.

## Ví dụ

```html title="danh-sach-ho-so.html"
<!-- đổi tab lọc mà không bị cuộn lên đầu trang -->
<a routerLink="." [queryParams]="{ trangThai: 'cho-duyet' }" scroll="manual">Chờ duyệt</a>
<a routerLink="." [queryParams]="{ trangThai: 'da-duyet' }" scroll="manual">Đã duyệt</a>

<!-- 22.3: ++ trong event binding (field thường) -->
<button (click)="soLanThu++">Thử lại</button>

<!-- với signal: vẫn dùng update -->
<button (click)="dem.update(v => v + 1)">+1</button>
```

```ts title="app.config.ts"
// View transitions giờ là API stable
provideRouter(routes, withViewTransitions({ skipInitialTransition: true }));
```

## Việc nên làm

- **Áp dụng khi nâng cấp:** nên chờ `@angular/build@22.3.0` rồi nâng core và CLI cùng lúc (`ng update @angular/core @angular/cli`). Về kỹ thuật, peerDependencies của `@angular/build@22.2.8` chấp nhận `@angular/compiler-cli` `^22.0.0`, nên ghép core 22.3 với CLI 22.2 vẫn cài được. Nhưng nâng đồng bộ thì dễ truy vết lỗi hơn.
- **Dùng được ngay:**
  - `withViewTransitions()` cho các luồng phù hợp.
  - `scroll="manual"` cho link chỉ đổi query param.
- **Chưa cần quan tâm:** `focusReset` (phụ thuộc Navigation API thử nghiệm). Error boundaries và `HttpClient.query()` xem bản tin RC; error boundaries vẫn là developer preview.
- **Vẫn theo dõi:** bản `@angular/build` nâng Vite lên bản đã vá. Trong lúc chờ, dùng `overrides` như bản tin ngày 2026-11-16 nếu dev server có mở ra mạng.

:::quiz Trên Angular 22.3, template nào biên dịch được?
- [x] `<button (click)="soLanThu++">`
- [ ] `<span>{{ soLanThu++ }}</span>`
- [ ] `<input [value]="soLanThu++">`
- [ ] `<button (click)="dem()++">` với `dem` là signal

Đã thử với `@angular/compiler@22.3.0`: chỉ event binding chấp nhận `++`. Interpolation báo *Bindings cannot contain assignments*. Signal phải dùng `update`/`set`.
:::
