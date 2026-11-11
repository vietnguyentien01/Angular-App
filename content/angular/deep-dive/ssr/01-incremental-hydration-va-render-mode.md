---
title: Incremental hydration, event replay và render mode theo route
summary: Hydrate từng phần bằng @defer, bắt sự kiện trước khi hydrate xong, lỗi hydration mismatch, và chọn SSR/SSG/CSR cho từng route — các mặc định mới ở Angular 22.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [ssr, hydration, incremental-hydration, angular-22]
related: [angular/review/ssr/ssr-ssg-hydration-co-ban, angular/consolidate/performance/defer-thuc-chien]
---

## Mặc định của `provideClientHydration()` ở Angular 22

Đọc trong mã nguồn `@angular/platform-browser` 22:

- **HTTP transfer cache** — bật (tắt bằng `withNoHttpTransferCache()`).
- **Incremental hydration** — bật (tắt bằng `withNoIncrementalHydration()`; migration `ng update` tự thêm opt-out này cho app cũ chưa bật).
- **Event replay** — được bật kèm incremental hydration.

## Incremental hydration

```html
@defer (hydrate on viewport) {
  <app-comments [caseId]="id()" />
} @placeholder {
  <div class="h-96"></div>
}
```

- Server vẫn render HTML đầy đủ cho phần này (người dùng thấy ngay, SEO có nội dung).
- JS của `<app-comments>` **chưa tải**, phần này chưa tương tác được cho tới khi trigger xảy ra (`hydrate on viewport | interaction | hover | idle | timer(…) | immediate`, `hydrate when cond`, hoặc `hydrate never`).
- Giảm JS phải tải và chạy lúc đầu → INP và thời gian tương tác tốt hơn.

## Event replay

Người dùng click nút trước khi JS kịp hydrate → sự kiện được **ghi lại** và **phát lại** khi hydrate xong, thay vì bị mất.

## Hydration mismatch

Lỗi khi DOM do server render khác với những gì client mong đợi:

| Nguyên nhân | Cách sửa |
|---|---|
| Template phụ thuộc `Date.now()`, `Math.random()`, `window` | Tính trên server rồi chuyển qua `TransferState`, hoặc chỉ render phía client sau `afterNextRender` |
| Thao tác DOM trực tiếp (`innerHTML`, thư viện chèn DOM) | Dùng API của Angular; component không thể sửa → `ngSkipHydration` |
| HTML không hợp lệ (`<div>` trong `<p>`, `<table>` thiếu `<tbody>`) | Sửa markup — trình duyệt tự "sửa" HTML khác với server |

## Render mode theo route

Với `@angular/ssr`, mỗi route chọn cách render riêng (file `app.routes.server.ts`):

```ts
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender }, // trang chủ: build sẵn
  { path: 'news/:slug', renderMode: RenderMode.Server }, // tin tức: SSR mỗi request
  { path: 'dashboard/**', renderMode: RenderMode.Client }, // sau đăng nhập: CSR
];
```

:::quiz Với `@defer (hydrate on viewport)`, HTML của khối đó có trong response từ server không?
- [x] Có — server render đầy đủ; chỉ việc tải JS và hydrate được hoãn tới khi khối vào viewport
- [ ] Không, chỉ có placeholder
- [ ] Chỉ khi dùng SSG
- [ ] Tuỳ trình duyệt

Khác với `@defer (on viewport)` thường: ở CSR, nội dung chỉ xuất hiện khi trigger xảy ra.
:::

:::quiz Người dùng click "Thêm vào giỏ" trước khi trang hydrate xong. Ở Angular 22 với `provideClientHydration()` mặc định, chuyện gì xảy ra?
- [ ] Click bị mất
- [x] Click được ghi lại và phát lại sau khi hydrate (event replay)
- [ ] Trang reload
- [ ] Lỗi hydration

Event replay đi kèm incremental hydration, vốn bật mặc định ở v22.
:::

:::quiz Template hiển thị `{{ now }}` với `now = new Date().toLocaleTimeString()`. Khi SSR có vấn đề gì?
- [ ] Không vấn đề
- [x] Server và client tính ra thời điểm khác nhau → nội dung lệch, có thể gây lỗi hydration mismatch hoặc nhảy chữ
- [ ] Lỗi biên dịch
- [ ] Giờ luôn đúng múi giờ người dùng

Giá trị phụ thuộc thời gian/môi trường nên được tính một lần (server) và chuyển sang client, hoặc chỉ render phía client.
:::
