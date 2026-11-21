---
title: "Angular CLI 22.3.0: Vite đã được vá lỗ hổng RCE, library builder thay ng-packagr"
date: 2026-11-20
summary: "@angular/build và @angular/cli 22.3.0 lên npm ngày 19/11/2026 (tag latest). Bản này ghim vite 8.3.8, đã vá lỗ hổng RCE của dev server, nên có thể gỡ overrides. Kèm theo: library builder mới thay ng-packagr (deprecated), option prerender.format và polyfills cho unit-test. Nhánh LTS 20/21 vẫn ghim vite 7.3.7."
importance: high
tags: [angular-cli, vite, security, release, library]
relatedTopics: [angular/cli-project, angular/security]
sources:
  - title: angular/angular-cli — CHANGELOG (22.3.0)
    url: https://github.com/angular/angular-cli/blob/main/CHANGELOG.md
  - title: npm — @angular/build
    url: https://www.npmjs.com/package/@angular/build
  - title: Vite Security Advisory GHSA-p4f5-76q4-ffq7
    url: https://github.com/vitejs/vite/security/advisories/GHSA-p4f5-76q4-ffq7
---

## Có gì mới

`@angular/build` và `@angular/cli` bản `22.3.0` được đưa lên npm lúc 2026-11-19 00:41 UTC; changelog ghi ngày 2026-11-18. Bản này thành tag `latest` và đi cùng `@angular/core@22.3.0` ra trước đó một ngày. Kiểm tra bằng `npm view` ngày 2026-11-20:

| Gói | `vite` được ghim | Trạng thái với advisory GHSA-p4f5-76q4-ffq7 |
|---|---|---|
| `@angular/build@22.3.0` (`latest`) | `8.3.8` | Đã vá (bản vá nhánh 8.3 là 8.3.7) |
| `@angular/build@22.2.8` | `8.3.5` | Bị ảnh hưởng |
| `@angular/build@21.2.30` (`v21-lts`) | `7.3.7` | Bị ảnh hưởng (bản vá nhánh 7 là 7.3.8) |
| `@angular/build@20.3.43` (`v20-lts`) | `7.3.7` | Bị ảnh hưởng |

Những thay đổi khác trong changelog 22.3.0:

- **Library builder** `@angular/build:library` (mới), cùng migration `use-library-builder` để chuyển từ ng-packagr và schematic `entry-point`. Builder `@angular/build:ng-packagr` và các API `executeNgPackagrBuilder` / `NgPackagrBuilderOptions` bị **deprecate**.
- Option `testRunner` của các schematic `application`, `library`, `ng-new` bị deprecate. Theo changelog, project mới sau này sẽ chỉ được cấu hình với Vitest.
- `prerender.format` cho builder application (đã xem trong `schema.json` của gói):
  - `'directory'`: `/foo` được ghi thành `foo/index.html`.
  - `'file'`: `/foo` được ghi thành `foo.html`. Một số hosting phục vụ được `/foo` mà không phải redirect sang `/foo/`.
  - Route gốc luôn là `index.html`, và option chỉ có tác dụng khi build không sinh server.
- Option `polyfills` cho builder `unit-test`. Nếu không khai báo thì lấy theo build target.
- Changelog còn ghi: CLI hỗ trợ **Oxfmt** để tự format file, cùng nhiều bản sửa và cải thiện hiệu năng cho watch mode, Vitest runner và Rolldown.

## Vì sao quan trọng

- Bản tin ngày 2026-11-16 khuyên dùng `overrides` ép `vite@8.3.8` vì CLI chưa nâng Vite. Lên CLI 22.3.0 thì **không cần override nữa**. Override để lại lâu sẽ lệch khỏi phiên bản Vite mà Angular đã kiểm thử ở các bản sau.
- Dự án còn ở **Angular 20/21 LTS** — phổ biến ở cơ quan nhà nước, ngân hàng — vẫn kéo `vite@7.3.7`. Nếu dev server có mở ra mạng (`--host`, dev container, môi trường demo), vẫn cần `overrides: { "vite": "7.3.8" }` hoặc chờ bản LTS tiếp theo.
- **Thư viện nội bộ** (design system, shared lib) đang build bằng ng-packagr giờ có lộ trình chính thức: builder mới và migration tự động. API cũ mới chỉ deprecated, chưa bị xoá, nên có thể lên kế hoạch chuyển dần.

## Ví dụ

```bash
# Nâng core và CLI cùng lúc
ng update @angular/core@22.3 @angular/cli@22.3

# Gỡ override tạm thời rồi cài lại
npm pkg delete overrides.vite
npm install
npm ls vite
# `-- vite@8.3.8   ← không còn chữ "overridden"
```

```json title="angular.json — xuất file phẳng khi prerender (SSG)"
"prerender": {
  "format": "file"
}
```

## Việc nên làm

- **Áp dụng ngay:**
  - Dự án Angular 22: nâng lên `@angular/build`/`@angular/cli` 22.3.0 và gỡ `overrides.vite` nếu đã thêm theo bản tin trước.
  - Dự án 20/21 LTS có dev server mở ra mạng: giữ hoặc thêm override `vite@7.3.8`.
- **Lên kế hoạch:** chuyển thư viện từ `@angular/build:ng-packagr` sang `@angular/build:library` bằng migration `use-library-builder`; thử trên một thư viện nhỏ trước, so sánh gói xuất ra.
- **Theo dõi:**
  - Các bản LTS tiếp theo của `@angular/build` 20.3.x / 21.2.x có nâng Vite hay không.
  - Oxfmt: tính năng mới, nên thử trên nhánh riêng trước khi đưa vào quy trình chung.

:::quiz Dự án Angular 21 LTS (`@angular/build@21.2.30`) chạy dev server trong dev container, lắng nghe `0.0.0.0`. Sau khi Angular CLI 22.3.0 ra mắt, bạn nên làm gì?
- [ ] Không cần làm gì — CLI 22.3.0 đã vá cho mọi phiên bản
- [x] Vẫn cần ép `vite@7.3.8` bằng `overrides`, vì `@angular/build@21.2.30` vẫn ghim `vite@7.3.7` nằm trong dải bị ảnh hưởng
- [ ] Gỡ `overrides` ngay
- [ ] Chuyển sang `ng-packagr`

Bản vá chỉ có trong `@angular/build@22.3.0` (`vite@8.3.8`). Nhánh `v21-lts` (21.2.30) và `v20-lts` (20.3.43) vẫn ghim `vite@7.3.7`, theo `npm view` ngày 2026-11-20.
:::
