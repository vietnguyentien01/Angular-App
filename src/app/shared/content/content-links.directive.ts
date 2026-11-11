import { DOCUMENT, Directive, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Xử lý click vào link bên trong HTML nội dung:
 * - `#id`        → cuộn tới heading (không đổi route, tránh lỗi base href trên GitHub Pages)
 * - `/duong-dan` → điều hướng bằng Router thay vì tải lại trang
 * - link ngoài   → giữ nguyên (đã có target="_blank")
 */
@Directive({
  selector: '[appContentLinks]',
  host: { '(click)': 'onClick($event)' },
})
export class ContentLinksDirective {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected onClick(event: MouseEvent): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey
    )
      return;
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    const href = anchor?.getAttribute('href');
    if (!anchor || !href || anchor.target === '_blank') return;

    if (href.startsWith('#')) {
      event.preventDefault();
      this.document
        .getElementById(decodeURIComponent(href.slice(1)))
        ?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (href.startsWith('/')) {
      event.preventDefault();
      void this.router.navigateByUrl(href);
    }
  }
}
