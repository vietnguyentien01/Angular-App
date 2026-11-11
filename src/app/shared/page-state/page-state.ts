import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Trạng thái chung khi đang tải hoặc không tìm thấy nội dung. */
@Component({
  selector: 'app-page-state',
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-xl py-16 text-center" role="status">
      @if (loading()) {
        <div
          class="mx-auto size-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500"
        ></div>
        <p class="mt-4 text-slate-500">Đang tải {{ what() }}…</p>
      } @else {
        <p class="text-5xl font-bold text-slate-300 dark:text-slate-700">404</p>
        <h1 class="mt-4 text-xl font-semibold">Không tìm thấy {{ what() }}</h1>
        <p class="mt-2 text-slate-500">Có thể nội dung đã được đổi tên hoặc chuyển chỗ.</p>
        <a routerLink="/" class="btn-primary mt-6 inline-flex">Về trang tổng quan</a>
      }
    </div>
  `,
})
export class PageState {
  readonly loading = input(false);
  readonly what = input('trang');
}
