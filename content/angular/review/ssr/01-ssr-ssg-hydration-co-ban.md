---
title: CSR, SSR, SSG và hydration — nhắc nhanh
summary: Khác biệt giữa render phía client, server và prerender; hydration là gì; code nào không chạy được trên server.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [ssr, ssg, hydration]
related: [angular/deep-dive/ssr/incremental-hydration-va-render-mode]
---

## So sánh

| | CSR | SSR | SSG (prerender) |
|---|---|---|---|
| HTML ban đầu | Gần như trống | Render trên server mỗi request | Render sẵn lúc build |
| Thấy nội dung sớm (LCP) | Chậm | Nhanh | Nhanh nhất |
| SEO / chia sẻ link | Kém | Tốt | Tốt |
| Cần server Node | Không | Có | Không (file tĩnh) |
| Hợp với | App nội bộ sau đăng nhập | Trang công khai, dữ liệu theo request | Trang ít đổi: giới thiệu, hướng dẫn |

Thêm SSR vào project: `ng add @angular/ssr`.

## Hydration

Trình duyệt nhận HTML từ server → Angular **tái sử dụng DOM có sẵn** và gắn event listener, thay vì xoá đi render lại. Bật bằng `provideClientHydration()`.

## Code không chạy được trên server

```ts bad
ngOnInit() {
  this.width = window.innerWidth; // server không có window
  localStorage.getItem('x'); // server không có localStorage
}
```

```ts good
constructor() {
  afterNextRender(() => {
    this.width.set(window.innerWidth); // chỉ chạy trên trình duyệt
  });
}
// hoặc kiểm tra isPlatformBrowser(inject(PLATFORM_ID))
```

:::quiz Hydration khác "render lại phía client" ở chỗ nào?
- [ ] Không khác
- [x] Angular dùng lại DOM do server render, chỉ gắn listener/state — tránh nháy trang và tránh làm lại việc render
- [ ] Hydration tải lại toàn bộ trang
- [ ] Hydration chỉ chạy trên server

Không có hydration, app sẽ xoá HTML server và render lại từ đầu — gây nháy và mất lợi ích của SSR.
:::

:::quiz App nội bộ cho cán bộ, phải đăng nhập mới dùng được. SSR có cần thiết không?
- [ ] Bắt buộc
- [x] Thường không — không cần SEO, dữ liệu theo người dùng; CSR + tối ưu bundle thường đủ
- [ ] Có, để bảo mật hơn
- [ ] Có, vì Angular 22 yêu cầu

SSR thêm chi phí vận hành server Node; chỉ chọn khi lợi ích (LCP, SEO) rõ ràng.
:::

:::quiz Vì sao `afterNextRender` an toàn cho SSR?
- [ ] Nó chạy trên server nhanh hơn
- [x] Nó không chạy khi render trên server, chỉ chạy trên trình duyệt sau khi render
- [ ] Nó tự tạo `window` giả
- [ ] Nó tắt SSR

Đây là nơi chuẩn cho mọi thao tác DOM / API trình duyệt.
:::
