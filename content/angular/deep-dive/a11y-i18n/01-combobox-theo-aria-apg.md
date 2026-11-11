---
title: Xây combobox/autocomplete đạt chuẩn WAI-ARIA
summary: Vai trò và thuộc tính ARIA của combobox, aria-activedescendant vs roving tabindex, điều khiển bàn phím đầy đủ — và khi nào nên dùng CDK thay vì tự viết.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [a11y, aria, combobox, keyboard]
related: [angular/consolidate/a11y-i18n/focus-va-cdk-a11y, angular/deep-dive/system-design/khung-tra-loi-system-design]
---

## Cấu trúc ARIA (theo WAI-ARIA Authoring Practices)

```html
<label for="q">Tìm cơ quan</label>
<input
  id="q"
  role="combobox"
  aria-autocomplete="list"
  [attr.aria-expanded]="open()"
  aria-controls="q-listbox"
  [attr.aria-activedescendant]="activeId()"
  (keydown)="onKey($event)"
/>
<ul id="q-listbox" role="listbox" [hidden]="!open()">
  @for (opt of options(); track opt.id; let i = $index) {
    <li
      [id]="'q-opt-' + opt.id"
      role="option"
      [attr.aria-selected]="i === active()"
      (mousedown)="$event.preventDefault()"
      (click)="choose(opt)"
    >
      {{ opt.label }}
    </li>
  }
</ul>
```

## Bàn phím

| Phím | Hành vi |
|---|---|
| ↓ / ↑ | Mở danh sách (nếu đang đóng), di chuyển option đang chọn |
| Enter | Chọn option đang active |
| Esc | Đóng danh sách (lần nữa: xoá nội dung) |
| Home / End | Về đầu / cuối danh sách (tuỳ chọn) |
| Tab | Đóng danh sách, focus sang phần tử tiếp theo |

```ts
onKey(e: KeyboardEvent) {
  const n = this.options().length;
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); this.open.set(true); this.active.update((i) => (i + 1) % n); break;
    case 'ArrowUp': e.preventDefault(); this.active.update((i) => (i - 1 + n) % n); break;
    case 'Enter': if (this.open() && n) { e.preventDefault(); this.choose(this.options()[this.active()]); } break;
    case 'Escape': this.open.set(false); break;
  }
}
readonly activeId = computed(() => (this.open() && this.options().length ? 'q-opt-' + this.options()[this.active()].id : null));
```

## `aria-activedescendant` hay roving tabindex?

| | `aria-activedescendant` | Roving tabindex |
|---|---|---|
| Focus thật nằm ở | Ô input (vẫn gõ được) | Từng option |
| Hợp với | Combobox, autocomplete | Toolbar, menu, tab list, grid |

CDK cung cấp `ActiveDescendantKeyManager` và `FocusKeyManager` cho hai mô hình này — dùng chúng thay vì tự viết logic phím cho mọi component.

:::quiz Vì sao option dùng `(mousedown)="$event.preventDefault()"`?
- [ ] Để chặn click
- [x] Để input không bị mất focus (blur) khi bấm chuột vào option — nếu không, danh sách có thể đóng trước khi sự kiện click kịp xảy ra
- [ ] Để tăng tốc render
- [ ] Bắt buộc theo ARIA

Đây là lỗi kinh điển: bấm vào gợi ý nhưng không chọn được.
:::

:::quiz Với `aria-activedescendant`, focus bàn phím thực sự nằm ở đâu?
- [x] Ở ô input; trình đọc màn hình đọc option được trỏ tới bởi id
- [ ] Ở option đang active
- [ ] Ở listbox
- [ ] Không ở đâu cả

Nhờ vậy người dùng vẫn gõ tiếp được trong lúc di chuyển giữa các gợi ý.
:::

:::exercise Thông báo số kết quả
Người dùng trình đọc màn hình không biết có bao nhiêu gợi ý xuất hiện. Bổ sung thế nào?
???
Thêm một vùng live region ẩn, cập nhật khi kết quả đổi (có debounce để không đọc liên tục):

```html
<div class="sr-only" aria-live="polite">{{ resultMessage() }}</div>
```
```ts
readonly resultMessage = computed(() =>
  !this.open() ? '' : this.options().length ? `${this.options().length} gợi ý, dùng phím mũi tên để chọn` : 'Không có gợi ý',
);
```
Hoặc dùng `LiveAnnouncer.announce(...)` của CDK.
:::
