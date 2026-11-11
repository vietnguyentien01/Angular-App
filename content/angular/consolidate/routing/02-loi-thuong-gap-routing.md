---
title: Lỗi routing hay gặp trong dự án thật
summary: Đọc snapshot một lần, guard gọi navigate, quên pathMatch, đường dẫn tương đối sai, và mất dữ liệu khi rời trang.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [routing, bugs, guard]
related: [angular/review/routing/guard-va-dieu-huong, angular/consolidate/routing/trang-thai-tren-url]
---

## 1. Đọc param một lần

```ts bad
ngOnInit() {
  const id = this.route.snapshot.paramMap.get('id')!;
  this.api.get(id).subscribe((c) => (this.case = c));
}
// /cases/1 → /cases/2: component được tái sử dụng, ngOnInit không chạy lại → vẫn hiện hồ sơ 1
```

```ts good
readonly id = input.required<string>();
readonly detail = httpResource<Case>(() => `/api/cases/${this.id()}`);
```

## 2. Guard tự điều hướng

```ts bad
export const authGuard: CanActivateFn = () => {
  if (!inject(Auth).isLoggedIn()) {
    inject(Router).navigate(['/login']); // điều hướng thứ hai chen vào điều hướng đang chạy
    return false;
  }
  return true;
};
```

```ts good
export const authGuard: CanActivateFn = (_, state) =>
  inject(Auth).isLoggedIn() || inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
```

## 3. Đường dẫn tương đối

```html
<!-- Đang ở /cases/42 -->
<a routerLink="edit">Sửa</a>          <!-- /cases/42/edit -->
<a routerLink="../43">Hồ sơ sau</a>   <!-- /cases/43 -->
<a routerLink="/reports">Báo cáo</a>  <!-- tuyệt đối -->
```

Trong code: `router.navigate(['edit'], { relativeTo: this.route })` — thiếu `relativeTo` thì đường dẫn được tính từ **root**.

## 4. Mất dữ liệu khi rời trang

Dùng `canDeactivate` cho điều hướng trong app **và** sự kiện `beforeunload` cho đóng tab / F5:

```ts
constructor() {
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.form.dirty) e.preventDefault();
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', onBeforeUnload));
}
```

:::quiz Đang ở `/cases/42`, gọi `router.navigate(['edit'])` (không có `relativeTo`). URL mới?
- [ ] `/cases/42/edit`
- [x] `/edit`
- [ ] `/cases/edit`
- [ ] Lỗi

`Router.navigate` mặc định tính từ root. `routerLink` trong template thì tự tương đối với route hiện tại.
:::

:::quiz Vì sao guard nên trả `UrlTree` thay vì gọi `navigate()` rồi trả `false`?
- [ ] Vì `navigate` không dùng được trong guard
- [x] Router xử lý chuyển hướng trong cùng một lần điều hướng, tránh hai điều hướng chồng nhau và giữ đúng các sự kiện router
- [ ] Vì `UrlTree` nhanh hơn
- [ ] Không khác gì

Đây cũng là cách được tài liệu Angular khuyến nghị.
:::

:::quiz `canDeactivate` có bảo vệ khi người dùng đóng tab trình duyệt không?
- [ ] Có
- [x] Không — đóng tab / F5 không đi qua router; cần `beforeunload`
- [ ] Chỉ trên Chrome
- [ ] Chỉ khi dùng lazy loading

Hai cơ chế bổ sung cho nhau.
:::

:::exercise Tìm bug
```ts
{ path: 'cases', component: CaseList },
{ path: 'cases/:id', component: CaseDetail },
{ path: 'cases/new', component: CaseCreate },
```
Mở `/cases/new` hiện màn hình chi tiết với id `"new"`. Vì sao và sửa thế nào?
???
Router chọn route **đầu tiên** khớp: `cases/:id` khớp `cases/new` trước khi tới `cases/new`. Sửa: đặt `cases/new` **trước** `cases/:id` (route cụ thể trước route có param).
:::
