---
title: Nx monorepo cho nhiều ứng dụng Angular
summary: Phân loại library, tag và ràng buộc phụ thuộc, chỉ build/test phần bị ảnh hưởng (affected) và cache — khi nào monorepo đáng giá.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [architecture, nx, monorepo]
related: [angular/consolidate/architecture/facade-va-ranh-gioi, angular/deep-dive/architecture/micro-frontend]
---

## Cấu trúc

```text
apps/
  portal/              # app công dân
  backoffice/          # app cán bộ
libs/
  cases/feature-list/  # type:feature  scope:cases
  cases/data-access/   # type:data-access
  cases/ui/            # type:ui
  shared/ui/           # design system — type:ui scope:shared
  shared/util-format/  # type:util
```

| Loại lib | Chứa | Được phụ thuộc vào |
|---|---|---|
| `feature` | Page, route, smart component | data-access, ui, util |
| `data-access` | API, store, facade | util |
| `ui` | Presentational component | ui, util |
| `util` | Hàm thuần, kiểu | util |

## Affected và cache

```bash
npx nx affected -t lint test build   # chỉ chạy cho project bị ảnh hưởng bởi thay đổi
npx nx graph                          # xem đồ thị phụ thuộc
```

Nx biết lib nào phụ thuộc lib nào, nên một PR sửa `cases/ui` chỉ test lại `cases/*` và các app dùng nó — không phải toàn bộ monorepo. Kết quả task được **cache** (local hoặc remote) — chạy lại cùng input là lấy kết quả ngay.

## Khi nào đáng?

- Nhiều app dùng chung design system / data-access → sửa một chỗ, mọi app thấy ngay, refactor xuyên project trong một PR.
- Không đáng khi các app hoàn toàn độc lập, khác team, khác nhịp phát hành — khi đó package có version (hoặc polyrepo) có thể phù hợp hơn.

:::quiz `nx affected -t test` làm gì?
- [ ] Test toàn bộ repo
- [x] Chỉ chạy test cho các project bị ảnh hưởng (trực tiếp hoặc gián tiếp) bởi thay đổi so với nhánh base
- [ ] Chỉ test file vừa sửa
- [ ] Bỏ qua test đã fail

Đây là cách giữ CI nhanh khi monorepo lớn dần.
:::

:::quiz Lib `type:ui` import một `data-access` lib. Rule nào bị vi phạm?
- [x] UI chỉ được phụ thuộc ui/util — component trình bày không được gọi API/store
- [ ] Không vi phạm
- [ ] Vi phạm scope
- [ ] Vi phạm quy tắc đặt tên

Ràng buộc này giữ component UI thuần, dễ tái sử dụng và test.
:::
