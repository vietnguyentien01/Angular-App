---
title: Cấu trúc project theo feature, smart vs presentational
summary: Tổ chức thư mục theo nghiệp vụ, phân loại component, public API của mỗi feature và hướng phụ thuộc một chiều.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [architecture, folder-structure]
related: [angular/consolidate/architecture/facade-va-ranh-gioi]
---

## Theo feature, không theo loại file

```text
src/app/
  core/            # dùng toàn app, khởi tạo một lần: auth, http interceptors, layout shell
  shared/          # UI và tiện ích dùng chung, KHÔNG phụ thuộc feature nào
    ui/            # button, dialog, money-input…
    util/          # format, validators thuần
  features/
    cases/         # một nghiệp vụ = một thư mục
      data-access/ # api, store/facade
      ui/          # component trình bày của feature
      pages/       # component gắn route (smart)
      cases.routes.ts
      index.ts     # public API — những gì feature khác được dùng
    reports/
```

## Smart vs presentational

| | Smart (container / page) | Presentational (UI) |
|---|---|---|
| Biết về | Service, store, router, API | Chỉ `input()` / `output()` |
| Test bằng | Mock service | Truyền input, kiểm tra output |
| Tái sử dụng | Thấp | Cao |
| Ví dụ | `CaseListPage` | `CaseTable`, `StatusBadge` |

## Hướng phụ thuộc

```text
pages → ui (của feature) → shared/ui
pages → data-access → core (http)
shared  ✗→ features        (shared không được import feature)
feature A ✗→ feature B     (chỉ qua index.ts / URL / contract)
```

:::quiz Component `CaseTable` nhận `cases` qua input và phát `(select)`. Nó nên thuộc loại nào?
- [ ] Smart
- [x] Presentational
- [ ] Core
- [ ] Service

Không biết dữ liệu đến từ đâu → dễ test, dễ tái sử dụng, dễ đưa vào Storybook.
:::

:::quiz `shared/ui/money-input` import một service trong `features/cases`. Vấn đề?
- [ ] Không sao
- [x] Phá hướng phụ thuộc: `shared` giờ phụ thuộc feature → không tái sử dụng được và dễ tạo vòng import
- [ ] Chậm build
- [ ] Lỗi runtime ngay lập tức

Nếu cần dữ liệu từ ngoài, truyền qua input hoặc InjectionToken do nơi dùng cung cấp.
:::

:::quiz Vì sao mỗi feature có `index.ts` (public API)?
- [ ] Bắt buộc của Angular
- [x] Quy định rõ phần nào feature khác được dùng; phần còn lại là chi tiết nội bộ, tự do thay đổi
- [ ] Để tăng tốc lazy loading
- [ ] Để tree-shaking hoạt động

Kết hợp rule lint (xem bài củng cố) để chặn import "xuyên" vào bên trong feature khác.
:::
