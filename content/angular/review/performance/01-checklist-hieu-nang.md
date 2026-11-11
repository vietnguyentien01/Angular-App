---
title: Checklist hiệu năng Angular
summary: Những việc nên làm mặc định cho mọi màn hình — nhắc nhanh kèm câu hỏi kiểm tra.
type: cheatsheet
level: core
version: 22
lastReviewed: 2026-11-11
tags: [performance, checklist]
related: [angular/consolidate/performance/defer-thuc-chien, angular/consolidate/performance/bang-du-lieu-lon]
---

## Render

| Việc | Vì sao |
|---|---|
| OnPush (mặc định từ v22) + signals | Bỏ qua nhánh component không đổi |
| `@for (x of list; track x.id)` | Giữ DOM khi danh sách đổi, không render lại toàn bộ |
| Không gọi hàm nặng trong template | Hàm chạy lại mỗi lượt CD — dùng `computed` |
| `@defer` cho phần dưới màn hình / ít dùng | Giảm JS ban đầu |

## Tải trang

| Việc | Vì sao |
|---|---|
| Lazy route (`loadComponent` / `loadChildren`) | Mỗi màn hình một chunk |
| `NgOptimizedImage` (`ngSrc`, `width`/`height`, `priority` cho ảnh LCP) | Tránh layout shift, ưu tiên ảnh quan trọng |
| Bundle budget trong `angular.json` | CI báo khi bundle phình |
| Tránh import cả thư viện (`import * as _ from 'lodash'`) | Tree-shaking |

## Dữ liệu

| Việc | Vì sao |
|---|---|
| `switchMap` / resource cho request theo input | Huỷ request thừa |
| Phân trang / virtual scroll cho danh sách dài | DOM nhỏ |
| Cache dữ liệu ít đổi (`shareReplay`, service) | Giảm request |

:::quiz `@for (item of items(); track $index)` có vấn đề gì khi xoá phần tử ĐẦU danh sách?
- [ ] Không vấn đề gì
- [x] Mọi phần tử phía sau bị coi là "đổi" vì index dịch chuyển → render lại nhiều DOM, có thể mất state của input/animation
- [ ] Lỗi biên dịch
- [ ] Phần tử bị xoá vẫn hiển thị

Track theo index chỉ ổn với danh sách tĩnh. Với dữ liệu có id, luôn `track item.id`.
:::

:::quiz `{{ formatTotal(order) }}` trong template của một bảng 500 dòng. Vấn đề?
- [ ] Không có vấn đề
- [x] Hàm chạy lại cho mọi dòng mỗi khi component được kiểm tra, kể cả khi `order` không đổi
- [ ] Lỗi ExpressionChanged
- [ ] Không hiển thị

Dùng pure pipe (`{{ order | total }}`) hoặc tính sẵn bằng `computed` cho cả danh sách.
:::

:::quiz Ảnh banner lớn ở đầu trang (ảnh LCP) nên khai báo thế nào?
- [ ] `<img src="banner.jpg">`
- [ ] `<img ngSrc="banner.jpg" loading="lazy">`
- [x] `<img ngSrc="banner.jpg" width="1200" height="400" priority>`
- [ ] Đặt trong `@defer (on viewport)`

Ảnh LCP phải tải **sớm**, không lazy. `priority` thêm `fetchpriority="high"` và cảnh báo nếu ảnh LCP thiếu nó; `width/height` tránh layout shift.
:::
