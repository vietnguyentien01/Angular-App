---
title: "CI/CD và GitHub Actions — workflow, job, step, trigger"
summary: "CI chạy kiểm tra tự động trên mỗi lần đẩy code, CD đưa bản đã kiểm lên môi trường. Nhắc nhanh cấu trúc một workflow GitHub Actions (on, jobs, runs-on, steps, uses, run), needs, secrets và quyền, cache npm — lấy ví dụ từ chính pipeline deploy của Learning Hub đang chạy thật."
type: card
level: core
version: 29
lastReviewed: 2026-11-13
tags: [cicd, github-actions, devops]
related: [docker/consolidate/cicd/pipeline-test-va-build-image, docker/deep-dive/cicd/chien-luoc-deploy]
---

## TL;DR

- **CI (Continuous Integration)**: mỗi push/PR tự chạy cài đặt → lint → test → build. Đỏ thì không merge.
- **CD (Continuous Delivery/Deployment)**: bản đã qua CI được tự động đưa lên môi trường (staging, production).
- GitHub Actions: file YAML trong `.github/workflows/`. **Workflow** gồm nhiều **job** (chạy song song trên máy riêng, trừ khi có `needs`), mỗi job gồm nhiều **step** (`uses` một action có sẵn, hoặc `run` một lệnh shell).
- Secret để trong **Settings → Secrets** và đọc bằng `${{ secrets.TEN }}`; cấp **quyền tối thiểu** bằng `permissions:`.

## Ví dụ thật: pipeline của Learning Hub

App bạn đang dùng được deploy bằng workflow này (rút gọn) — mỗi lần đẩy lên `main`:

```yaml title=".github/workflows/deploy.yml"
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:            # cho phép bấm chạy tay

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm              # cache thư mục npm giữa các lần chạy
      - run: npm ci
      - run: npm run content:check
      - run: npm test -- --watch=false
      - run: npm run build -- --base-href /${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist/learning-hub/browser

  deploy:
    needs: build                  # chỉ chạy khi build xanh
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

## Bảng khái niệm

| Khái niệm | Ví dụ | Ghi chú |
|---|---|---|
| Trigger | `on: push`, `pull_request`, `schedule`, `workflow_dispatch` | PR từ fork không đọc được secret |
| Runner | `runs-on: ubuntu-latest` | Máy ảo mới cho mỗi job — không giữ file giữa các job |
| Action | `uses: actions/checkout@v5` | Ghim version (tag hoặc SHA) |
| Phụ thuộc giữa job | `needs: build` | Không có `needs` thì các job chạy song song |
| Truyền file giữa job | `upload-artifact` / `download-artifact` | |
| Ma trận | `strategy.matrix.node: [22, 24]` | Chạy cùng job với nhiều cấu hình |
| Môi trường | `environment: production` | Có thể yêu cầu người duyệt trước khi deploy |

## Lỗi hay gặp: dùng `npm install` trong CI

`npm install` có thể cập nhật lockfile và cài phiên bản khác với máy dev. Trong CI dùng **`npm ci`**: cài đúng theo `package-lock.json`, xoá `node_modules` cũ, báo lỗi nếu lockfile lệch với `package.json`.

:::version Phiên bản action
Pipeline của Learning Hub ở trên đang dùng `checkout@v5`, `setup-node@v5` và vẫn chạy; tại thời điểm viết đã có `checkout@v7`, `setup-node@v7` (kiểm bằng `git ls-remote --tags`). Action quá cũ chạy trên Node runtime đã hết hạn sẽ báo cảnh báo rồi ngừng hoạt động — actionlint báo lỗi ngay với `checkout@v1`. Repo nhạy cảm nên ghim theo **commit SHA** và để Dependabot cập nhật.
:::

:::interview CI và CD khác nhau thế nào? Một pipeline tốt cho web app gồm những bước nào?
CI là tích hợp liên tục: mỗi thay đổi được tự động build và kiểm (lint, type check, unit/integration test) để phát hiện lỗi sớm, giữ nhánh chính luôn xanh. CD là đưa bản đã qua CI lên môi trường một cách tự động — Delivery: sẵn sàng deploy, có bước duyệt; Deployment: tự deploy luôn. Pipeline tốt: cài đặt có cache (`npm ci`) → lint/type check → test (kèm DB thật trong container nếu cần) → build artifact/image **một lần** → deploy staging → kiểm tra smoke → deploy production (có duyệt) → có cách rollback nhanh.
:::

:::quiz Workflow có job `build` và job `deploy`, không khai `needs`. Điều gì xảy ra?
- [ ] `deploy` luôn chờ `build`
- [x] Hai job chạy song song — `deploy` có thể chạy dù `build` đỏ
- [ ] GitHub báo lỗi cú pháp
- [ ] Chỉ `build` chạy

Thêm `needs: build` để `deploy` chỉ chạy khi `build` thành công.
:::

:::quiz Vì sao CI nên dùng `npm ci` thay vì `npm install`?
- [ ] `npm ci` cài thêm devDependencies
- [x] `npm ci` cài đúng theo lockfile, không sửa lockfile, báo lỗi khi lockfile lệch — build lặp lại được
- [ ] `npm install` không chạy được trên Linux
- [ ] `npm ci` không cần mạng

Build CI phải giống nhau ở mọi lần chạy.
:::

:::quiz Một step cần token để đẩy image lên registry. Cách đúng là?
- [ ] Ghi token thẳng vào file YAML
- [ ] Đặt token trong biến `env` ở đầu workflow dạng văn bản
- [x] Lưu ở Settings → Secrets và dùng `${{ secrets.REGISTRY_TOKEN }}` (hoặc `GITHUB_TOKEN` với `permissions: packages: write`)
- [ ] Gửi token qua commit message

GitHub che giá trị secret trong log; không bao giờ commit secret.
:::
