# Learning Hub

App học tập cá nhân, bắt đầu với **Angular từ Middle lên Senior**, thiết kế để thêm nhiều môn học khác.

- **3 phần cho mỗi môn**: Ôn lại Core → Củng cố → Chuyên sâu & Cập nhật
- **Frontend mới**: bản tin kiến thức frontend cập nhật tự động mỗi 2 ngày
- Không backend: nội dung là Markdown build thành JSON tĩnh, tiến độ lưu trong IndexedDB
- Deploy GitHub Pages: https://vietnguyentien01.github.io/Angular-App/

Kế hoạch chi tiết: [PLAN.md](PLAN.md) · Quy ước viết nội dung: [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md)

## Chạy local

```bash
npm ci
npm start          # build nội dung + ng serve → http://localhost:4200
```

## Lệnh

| Lệnh | Mô tả |
|---|---|
| `npm run content` | Build `content/**` → `public/data/**` |
| `npm run content:check` | Chỉ validate nội dung |
| `npm test` | Unit test (Vitest) |
| `npm run test:scripts` | Test cho content pipeline |
| `npm run build` | Build production |

## Kiến trúc

```
content/                    Nội dung (Markdown + JSON) — nguồn sự thật
scripts/build-content.ts    Validate (Zod) + render Markdown (marked + shiki) → JSON
src/app/
  core/                     content, storage (IndexedDB), progress, theme, backup, updates
  layout/                   shell, sidebar
  features/                 dashboard, subject, section, lesson, updates, settings
  plugins/demos/            demo tương tác (lazy-load, đăng ký theo tên)
  shared/                   component dùng chung
```

Route: `/:subject/:section/:topic/:slug` — thêm môn học mới không cần sửa code.

## Deploy

Push lên `main` → GitHub Actions validate nội dung, chạy test, build và deploy GitHub Pages
(`.github/workflows/deploy.yml`). Lần đầu cần bật **Settings → Pages → Source: GitHub Actions**.
