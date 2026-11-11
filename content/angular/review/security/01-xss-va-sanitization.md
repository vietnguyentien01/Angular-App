---
title: XSS và cơ chế sanitization của Angular
summary: Angular chặn XSS mặc định thế nào, những binding nào được sanitize, và vì sao bypassSecurityTrust* nguy hiểm.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [security, xss, sanitization]
related: [angular/consolidate/security/bypass-csp-trusted-types]
---

## TL;DR

- `{{ value }}` — luôn được **escape** thành text, không bao giờ thành HTML.
- `[innerHTML]` — được **sanitize**: giữ thẻ an toàn, bỏ `<script>`, thuộc tính `on*`, `style`, URL `javascript:`…
- `[href]`, `[src]` — URL nguy hiểm (`javascript:`) bị đổi thành `unsafe:…`.
- `DomSanitizer.bypassSecurityTrustHtml/Url/...` — **tắt** bảo vệ cho giá trị đó. Chỉ dùng cho dữ liệu bạn kiểm soát 100%.

```ts bad
// HTML từ người dùng / API bên ngoài
this.safe = this.sanitizer.bypassSecurityTrustHtml(comment.body); // XSS!
```

```html good
<div [innerHTML]="comment.body"></div>
<!-- Angular sanitize, in cảnh báo trong console nếu có nội dung bị loại bỏ -->
```

:::warning Những thứ Angular KHÔNG bảo vệ
- Gán DOM trực tiếp: `el.nativeElement.innerHTML = html`, `Renderer2.setProperty(el, 'innerHTML', html)` với dữ liệu không tin cậy.
- `eval`, `new Function`, template tạo động từ chuỗi người dùng.
- Thư viện bên thứ ba tự chèn HTML (rich text editor, chart tooltip) — cần sanitize theo hướng dẫn của thư viện.
:::

:::quiz `<p>{{ '<b>Xin chào</b>' }}</p>` hiển thị gì?
- [ ] **Xin chào** (in đậm)
- [x] Chuỗi `<b>Xin chào</b>` dạng text
- [ ] Trống
- [ ] Lỗi

Interpolation luôn escape — đây là lớp bảo vệ XSS đầu tiên.
:::

:::quiz `<a [href]="url">` với `url = 'javascript:alert(1)'`. Angular làm gì?
- [ ] Chạy alert khi click
- [x] Đổi thành `unsafe:javascript:alert(1)` nên trình duyệt không thực thi
- [ ] Xoá thẻ `<a>`
- [ ] Lỗi biên dịch

URL sanitizer chỉ cho phép các scheme an toàn (http, https, mailto, …).
:::

:::quiz Dùng `[innerHTML]` hiển thị HTML có `style="color:red"`. Kết quả?
- [ ] Chữ đỏ
- [x] Thuộc tính `style` bị loại bỏ, có cảnh báo trong console ở dev mode
- [ ] Lỗi runtime
- [ ] Toàn bộ HTML bị bỏ

Angular xoá `style` khi sanitize HTML. App này gặp đúng vấn đề đó với code highlight — xem bài củng cố để biết cách xử lý an toàn.
:::
