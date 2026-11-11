---
title: "@defer thực chiến: trigger, prefetch và tránh layout shift"
summary: Chọn trigger phù hợp, tải trước bằng prefetch, dùng placeholder/loading đúng cách và các điều kiện để @defer thật sự tách chunk.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [performance, defer, lazy-loading]
related: [angular/review/performance/checklist-hieu-nang]
---

## TL;DR

```html
@defer (on viewport; prefetch on idle) {
  <app-audit-history [caseId]="caseId()" />
} @placeholder (minimum 300ms) {
  <div class="h-64 rounded bg-slate-100"></div>
} @loading (after 150ms; minimum 500ms) {
  <app-spinner />
} @error {
  <p>Không tải được lịch sử.</p>
}
```

| Trigger | Tải khi | Hợp với |
|---|---|---|
| `on idle` (mặc định) | Trình duyệt rảnh | Phần phụ không cần ngay |
| `on viewport` | Placeholder lọt vào màn hình | Nội dung dưới màn hình |
| `on interaction` | Người dùng click/focus vào placeholder | Tab, panel "xem thêm" |
| `on hover` | Rê chuột vào placeholder | Preview, tooltip lớn |
| `on timer(2s)` | Sau thời gian | Banner, gợi ý |
| `when cond()` | Biểu thức thành `true` | Theo quyền, theo state |

## Điều kiện để @defer thật sự tách chunk

- Component/directive/pipe bên trong phải **standalone**.
- **Không** được tham chiếu ở chỗ khác trong cùng file (vd `viewChild(AuditHistory)` hoặc dùng ngoài khối `@defer`) — nếu không, nó bị import tĩnh và không tách chunk.

:::tip Kiểm tra
Chạy `ng build` và xem phần **Lazy chunk files**: component trong `@defer` phải xuất hiện thành chunk riêng.
:::

:::quiz Placeholder cho `@defer (on viewport)` nên thế nào?
- [ ] Để trống
- [x] Có kích thước gần đúng với nội dung thật, để tránh layout shift (CLS) và để có phần tử cho trình duyệt quan sát
- [ ] Một spinner xoay liên tục
- [ ] Không cần, `on viewport` tự xử lý

`on viewport` quan sát phần tử placeholder. Placeholder 0px vừa gây CLS vừa có thể làm trigger kích hoạt sai thời điểm.
:::

:::quiz Vì sao có `@loading (after 150ms; minimum 500ms)`?
- [ ] Để làm chậm trang
- [x] Không hiện spinner nếu tải nhanh hơn 150ms; nếu đã hiện thì giữ ít nhất 500ms để tránh nhấp nháy
- [ ] Để retry khi lỗi
- [ ] Bắt buộc theo cú pháp

Spinner chớp nháy 50ms còn tệ hơn không có spinner.
:::

:::quiz Component `ChartPanel` nằm trong `@defer`, nhưng class cha có `readonly chart = viewChild(ChartPanel)`. Kết quả?
- [ ] Vẫn tách chunk bình thường
- [x] `ChartPanel` bị tham chiếu tĩnh nên không được tách thành chunk riêng
- [ ] Lỗi biên dịch
- [ ] `viewChild` luôn là `undefined`

Mọi tham chiếu tới class ngoài khối `@defer` trong cùng file đều khiến nó bị import tĩnh.
:::

:::exercise Tối ưu màn hình chi tiết hồ sơ
Màn hình chi tiết hồ sơ có: thông tin chính (trên cùng), tab "Lịch sử xử lý" (bảng lớn, thư viện nặng), khung bình luận (cuối trang), nút "Xuất PDF" (thư viện PDF nặng). Đề xuất cách dùng `@defer` / lazy-load cho từng phần.
???
- Thông tin chính: render ngay, không defer (đây là nội dung LCP).
- Tab "Lịch sử xử lý": `@defer (on interaction; prefetch on idle)` gắn vào tab — chỉ tải khi mở tab, nhưng tải trước khi rảnh để mở tab nhanh.
- Bình luận cuối trang: `@defer (on viewport)` với placeholder có chiều cao cố định.
- Xuất PDF: không phải UI nên không dùng `@defer`; lazy-load service bằng `injectAsync(() => import(...), { prefetch: onIdle })` (Angular 22) hoặc dynamic `import()` khi bấm nút.
:::
