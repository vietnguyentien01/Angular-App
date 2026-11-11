---
title: Focus management, CDK a11y và kiểm thử tự động bằng axe
summary: Quản lý focus khi đổi route và mở dialog, thông báo cho trình đọc màn hình bằng LiveAnnouncer, và chạy axe trong Playwright.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [a11y, focus, cdk, axe, playwright]
related: [angular/review/a11y-i18n/a11y-co-ban, angular/consolidate/testing/chien-luoc-test]
---

## 1. Focus khi đổi route (SPA)

Trong SPA, đổi trang không tải lại → focus vẫn ở link cũ, người dùng trình đọc màn hình không biết trang đã đổi. App này xử lý bằng **skip link** và đưa focus về vùng nội dung:

```html
<a href="#main" class="sr-only focus:not-sr-only" (click)="skipToMain($event)">Bỏ qua tới nội dung</a>
<main id="main" tabindex="-1">…</main>
```

```ts
// Trong constructor của shell: sau mỗi lần điều hướng xong, đưa focus về <main> (hoặc heading h1)
const injector = inject(Injector);
inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
  .subscribe(() => afterNextRender(() => document.getElementById('main')?.focus(), { injector }));
```

## 2. Dialog: bẫy focus và trả focus

```html
<div cdkTrapFocus [cdkTrapFocusAutoCapture]="true" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
  <h2 id="dlg-title">Xác nhận duyệt hồ sơ</h2>
  …
</div>
```

`cdkTrapFocus` giữ Tab trong dialog; `AutoCapture` đưa focus vào khi mở và **trả về** phần tử trước đó khi đóng. (Dùng `Dialog` của CDK thì có sẵn hành vi này.)

## 3. Thông báo thay đổi động

```ts
private readonly announcer = inject(LiveAnnouncer);

async save() {
  await this.api.save(…);
  this.announcer.announce('Đã lưu hồ sơ', 'polite');
}
```

Toast chỉ hiện bằng hình ảnh thì người dùng trình đọc màn hình không biết thao tác đã thành công.

## 4. Kiểm thử tự động

```ts title="e2e/a11y.spec.ts"
import AxeBuilder from '@axe-core/playwright';

test('trang danh sách hồ sơ không có lỗi a11y nghiêm trọng', async ({ page }) => {
  await page.goto('/cases');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
```

axe bắt được khoảng một phần lỗi (thiếu nhãn, tương phản, ARIA sai); vẫn cần thử thủ công bằng bàn phím và trình đọc màn hình (NVDA, VoiceOver).

:::quiz Vì sao `<main>` có `tabindex="-1"`?
- [ ] Để Tab đi qua nó
- [x] Để có thể `focus()` bằng code mà không đưa nó vào thứ tự Tab
- [ ] Để ẩn nó với trình đọc màn hình
- [ ] Bắt buộc với mọi thẻ main

`tabindex="0"` thêm vào thứ tự Tab; `-1` chỉ cho phép focus bằng script.
:::

:::quiz Đóng dialog xong, focus nên ở đâu?
- [ ] Đầu trang
- [x] Phần tử đã mở dialog (vd nút "Duyệt")
- [ ] Không quan trọng
- [ ] Ô input đầu tiên của trang

Trả focus giúp người dùng bàn phím tiếp tục đúng chỗ họ đang làm.
:::

:::exercise Sửa form cho người dùng trình đọc màn hình
```html
<span>Email</span>
<input formControlName="email" />
@if (invalid) { <div class="text-red-600">Sai định dạng</div> }
```
???
```html
<label for="email">Email</label>
<input
  id="email"
  formControlName="email"
  [attr.aria-invalid]="invalid"
  [attr.aria-describedby]="invalid ? 'email-error' : null"
/>
@if (invalid) {
  <p id="email-error" class="text-red-600">Email sai định dạng, ví dụ: ten@coquan.gov.vn</p>
}
```
Nhãn gắn với input, trạng thái lỗi được thông báo qua `aria-invalid`, nội dung lỗi liên kết bằng `aria-describedby`, và thông điệp nói rõ cách sửa.
:::
