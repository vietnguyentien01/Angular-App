---
title: Accessibility cơ bản — WCAG AA cho dev Angular
summary: HTML ngữ nghĩa, nhãn cho form, ARIA đúng chỗ, bàn phím, focus và độ tương phản — những lỗi hay gặp ở cổng dịch vụ công.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [a11y, wcag, aria]
related: [angular/consolidate/a11y-i18n/focus-va-cdk-a11y]
---

## Checklist nhanh

| Yêu cầu | Làm đúng |
|---|---|
| Dùng thẻ đúng nghĩa | `<button>` để bấm, `<a href>` để điều hướng, `<nav>`, `<main>`, heading theo cấp |
| Form có nhãn | `<label for>` hoặc bọc `<label>`; lỗi liên kết bằng `aria-describedby` |
| Ảnh | `alt` mô tả; ảnh trang trí `alt=""` |
| Bàn phím | Mọi thao tác làm được bằng Tab/Enter/Space/Esc; không bẫy focus |
| Focus nhìn thấy được | Không `outline: none` mà không có thay thế (`:focus-visible`) |
| Tương phản | Chữ thường ≥ **4.5:1**, chữ lớn ≥ 3:1 (WCAG AA) |
| Không chỉ dùng màu | Lỗi đỏ kèm icon/chữ "Lỗi" |

```html bad
<div class="btn" (click)="save()">Lưu</div>
<span class="icon-trash" (click)="remove()"></span>
```

```html good
<button type="button" (click)="save()">Lưu</button>
<button type="button" (click)="remove()" aria-label="Xoá hồ sơ"><span class="icon-trash" aria-hidden="true"></span></button>
```

:::tip Quy tắc đầu tiên của ARIA
Không dùng ARIA nếu có thẻ HTML gốc làm được việc đó. `<button>` đã có sẵn role, focus và xử lý phím — `<div role="button">` phải tự làm lại tất cả.
:::

:::quiz Vì sao `<div (click)="save()">` có vấn đề với người dùng bàn phím?
- [ ] Không vấn đề gì
- [x] `div` không nhận focus bằng Tab và không phản hồi Enter/Space; trình đọc màn hình không biết đó là nút
- [ ] Vì `div` không có sự kiện click
- [ ] Chỉ ảnh hưởng mobile

Dùng `<button type="button">` là sửa được cả ba vấn đề.
:::

:::quiz Nút chỉ có icon thùng rác. Cần thêm gì?
- [ ] `title` là đủ
- [x] `aria-label="Xoá …"` cho nút, và `aria-hidden="true"` cho icon trang trí
- [ ] `role="img"`
- [ ] Không cần gì

Trình đọc màn hình cần tên có nghĩa cho nút; icon chỉ là trang trí.
:::

:::quiz Tỷ lệ tương phản tối thiểu cho chữ thường theo WCAG AA là?
- [ ] 2:1
- [ ] 3:1
- [x] 4.5:1
- [ ] 7:1

3:1 cho chữ lớn (≥ 24px, hoặc ≥ ~18.5px đậm). 7:1 là mức AAA.
:::
