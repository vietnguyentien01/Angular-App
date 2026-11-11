---
title: Angular CLI, angular.json và cấu hình môi trường
summary: Các lệnh CLI hay dùng, cấu trúc project standalone, budgets, fileReplacements và ng update.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [cli, build, config]
related: [angular/deep-dive/change-detection/angular-22-thay-doi-mac-dinh]
---

## Lệnh hay dùng

| Lệnh | Làm gì |
|---|---|
| `ng new app --style=tailwind` | Tạo project (standalone, zoneless, Vitest mặc định ở bản mới) |
| `ng g c features/case-list` | Tạo component (`g` = generate; còn có `s` service, `p` pipe, `d` directive, `guard`, `interceptor`) |
| `ng serve` | Dev server |
| `ng build` | Build production vào `dist/` |
| `ng test` | Unit test |
| `ng update @angular/core @angular/cli` | Nâng cấp kèm migration tự động |
| `ng generate @angular/core:control-flow` | Migration có sẵn (control flow, signal input, inject…) |

## Cấu trúc project standalone

```text
src/
  main.ts            bootstrapApplication(App, appConfig)
  app/app.config.ts  providers: provideRouter, provideHttpClient…
  app/app.routes.ts
  app/app.ts         component gốc
public/              file tĩnh (favicon, ảnh)
angular.json         cấu hình build/serve/test
```

## Budgets và môi trường

```json title="angular.json (trích)"
"configurations": {
  "production": {
    "budgets": [
      { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
      { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
    ],
    "fileReplacements": [
      { "replace": "src/environments/environment.ts", "with": "src/environments/environment.prod.ts" }
    ]
  }
}
```

:::tip Cấu hình runtime
`fileReplacements` gắn cấu hình vào lúc **build** — mỗi môi trường một bản build. Muốn một bản build chạy nhiều môi trường (dev/UAT/prod), tải `config.json` lúc khởi động bằng `provideAppInitializer`.
:::

:::quiz Build vượt `maximumError` của budget `initial` thì sao?
- [ ] Chỉ cảnh báo
- [x] `ng build` thất bại — CI sẽ chặn
- [ ] Tự nén thêm
- [ ] Bỏ qua ở production

`maximumWarning` chỉ cảnh báo; `maximumError` làm build fail.
:::

:::quiz `ng update` khác `npm install @angular/core@latest` ở điểm nào?
- [ ] Không khác
- [x] `ng update` chạy thêm các migration (schematic) sửa code cho tương thích bản mới
- [ ] `ng update` không cập nhật package.json
- [ ] `npm install` chạy migration nhanh hơn

Chỉ cài package mới sẽ bỏ lỡ các migration như `change-detection-eager` ở v22.
:::
