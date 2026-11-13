---
title: "Pipeline CI cho API — test với PostgreSQL trong service container, audit, build và đẩy image lên GHCR"
summary: "Workflow GitHub Actions hai job: test chạy npm ci, npm audit và bộ test với PostgreSQL dạng service container; image chỉ chạy trên main, build bằng Buildx có cache và đẩy lên GHCR với tag theo commit. Đã qua actionlint và chạy lại các bước test ở local (10/10 xanh)."
level: intermediate
version: 29
lastReviewed: 2026-11-13
tags: [cicd, github-actions, docker, postgresql, testing]
related: [docker/review/cicd/ci-cd-va-github-actions, docker/consolidate/dockerfile/dockerfile-cho-node-api]
---

## TL;DR

- Job `test` chạy cho **mọi PR và push**; job `image` chỉ chạy khi `test` xanh **và** là push lên `main`.
- PostgreSQL trong CI: `services:` với healthcheck — job chờ DB healthy rồi mới chạy step.
- Tag image theo **commit SHA** (bất biến) + tag `main` (trỏ bản mới nhất). Không deploy bằng `latest`.
- Quyền tối thiểu: workflow `contents: read`; chỉ job đẩy image có `packages: write`, dùng `GITHUB_TOKEN` — không tạo token cá nhân.

## Workflow

```yaml title=".github/workflows/ci.yml"
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true        # push mới thì huỷ lần chạy cũ của cùng nhánh

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: shop
          POSTGRES_PASSWORD: test
          POSTGRES_DB: shop_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U shop -d shop_test"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10
    env:
      DATABASE_URL: postgres://shop:test@localhost:5432/shop_test
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm audit --audit-level=high --omit=dev
      - run: npm test

  image:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v7
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:main
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

Job chạy **trên runner** (không trong container) nên kết nối service qua `localhost:5432` nhờ `ports`. Nếu job chạy trong `container:`, dùng tên service (`postgres:5432`) như trong compose.

## Đã kiểm thế nào

| Kiểm | Kết quả |
|---|---|
| `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint .github/workflows/ci.yml` | Không lỗi (exit 0) |
| Chạy lại các bước của job `test` ở local: PostgreSQL 16 trong container có healthcheck, `npm ci`, `npm audit --audit-level=high --omit=dev`, `npm test` với `DATABASE_URL` trỏ vào container | `found 0 vulnerabilities`; `Test Files 2 passed`, `Tests 10 passed` (8 test repo bộ nhớ + 2 test PostgreSQL thật) |
| Job `image` | Không chạy được ngoài GitHub — **tự kiểm** theo mục dưới |

## Tự chạy trên repo của bạn

1. Đưa dự án API (Dockerfile, test) lên một repo GitHub, thêm file workflow ở trên, mở một PR.
2. Tab **Actions** → chỉ job `test` chạy; job `image` hiện *skipped* (vì là PR). Trong log, phần *Initialize containers* phải có PostgreSQL `healthy`.
3. Cố ý làm đỏ một test, push → PR báo đỏ; bật **branch protection** cho `main` (Settings → Branches → yêu cầu check `test`) để không merge được.
4. Merge vào `main` → job `image` chạy; tab **Packages** của repo có image với tag là SHA của commit.
5. `docker pull ghcr.io/<owner>/<repo>:<sha>` rồi chạy bằng compose. Image riêng tư thì `docker login ghcr.io` bằng token có quyền `read:packages`.

Nếu khác: job `image` báo `denied: permission_denied` → thiếu `permissions: packages: write`; DB chưa sẵn sàng → thiếu `options` healthcheck; `npm ci` lỗi lockfile → commit `package-lock.json` đồng bộ với `package.json`.

## Pitfalls

```yaml bad
- run: echo "Tiêu đề PR: ${{ github.event.pull_request.title }}"
# actionlint: "potentially untrusted… avoid using it directly in inline scripts" — tiêu đề PR có thể chứa lệnh shell
```

```yaml good
- run: echo "Tiêu đề PR: $TITLE"
  env:
    TITLE: ${{ github.event.pull_request.title }}
```

```yaml bad
- uses: actions/checkout@v1     # actionlint: runner của action quá cũ, không chạy được trên GitHub Actions
```

Chạy `actionlint` trong pre-commit hoặc như một job CI đầu tiên để bắt lỗi cú pháp, biểu thức sai, và lỗ hổng script injection trước khi push.

:::senior Góc nhìn senior
Pipeline là **code sản xuất**: review như code, giữ nhanh (mục tiêu dưới 10 phút cho PR — cache npm, cache layer Docker, chạy song song), và đáng tin (test chập chờn phải sửa hoặc cách ly ngay, nếu không team sẽ quen bấm "re-run"). Build image **một lần** ở `main`, mọi môi trường dùng lại đúng image đó theo SHA — đó là cách đảm bảo thứ được test chính là thứ được deploy.
:::

:::version Action và runner
Ví dụ dùng `actions/checkout@v7`, `setup-node@v5`, `docker/build-push-action@v7`. `cache-from/to: type=gha` dùng cache của GitHub Actions cho layer Docker. Repo cần chuỗi cung ứng chặt có thể ghim action theo SHA và bật `attestations` (provenance) khi build image.
:::

:::interview Bạn thiết kế pipeline CI/CD cho một REST API Node.js có PostgreSQL thế nào?
PR: cài `npm ci` có cache → lint/type check → `npm audit` mức high → unit test và integration test với PostgreSQL chạy dạng service container cùng phiên bản production → (tuỳ chọn) build image để kiểm Dockerfile. Merge vào `main`: build image một lần, tag theo commit SHA, quét lỗ hổng, đẩy lên registry → deploy staging (chạy migration, smoke test) → deploy production có duyệt (environment protection) → theo dõi lỗi và sẵn sàng rollback về SHA trước. Secret nằm trong secret store của CI/hệ thống deploy; quyền token tối thiểu.
:::

:::quiz Với workflow ở trên, mở một PR thì job nào chạy?
- [x] Chỉ `test`; `image` bị bỏ qua vì điều kiện `if` yêu cầu push lên `main`
- [ ] Cả `test` và `image`
- [ ] Chỉ `image`
- [ ] Không job nào

PR không nên đẩy image lên registry — và PR từ fork không có quyền ghi.
:::

:::quiz Vì sao tag image theo `github.sha` thay vì chỉ `latest`?
- [ ] SHA ngắn hơn
- [x] Tag SHA bất biến và truy được về đúng commit — deploy, rollback và điều tra lỗi đều chính xác; `latest` đổi mỗi lần build
- [ ] Registry không cho dùng `latest`
- [ ] Để build nhanh hơn

Có thể thêm tag dễ đọc (`main`, `v1.4.0`) bên cạnh tag SHA.
:::

:::exercise Thêm job lint và quét image
Mở rộng workflow: (1) job `lint` chạy `npx actionlint` (hoặc image `rhysd/actionlint`) và `npm run lint` song song với `test`; (2) job `image` chỉ chạy khi **cả** `lint` và `test` xanh; (3) sau khi build, quét image bằng Trivy và làm job fail nếu có lỗ hổng mức CRITICAL. Viết phần YAML thay đổi.
???
```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest

  test:
    # … như trước …

  image:
    needs: [lint, test]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    # … login, setup-buildx như trước …
    steps:
      # …
      - uses: docker/build-push-action@v7
        with:
          context: .
          load: true                                   # nạp vào docker local để quét trước khi đẩy
          tags: product-api:${{ github.sha }}
      - uses: aquasecurity/trivy-action@v0.36.0
        with:
          image-ref: product-api:${{ github.sha }}
          severity: CRITICAL
          exit-code: '1'
          ignore-unfixed: true
      - run: |
          docker tag product-api:${{ github.sha }} ghcr.io/${{ github.repository }}:${{ github.sha }}
          docker push ghcr.io/${{ github.repository }}:${{ github.sha }}
```

`needs: [lint, test]` chờ cả hai; `lint` và `test` không phụ thuộc nhau nên chạy song song. Quét **trước** khi đẩy để image có lỗ hổng nghiêm trọng không lên registry. Ghim phiên bản `trivy-action` (kiểm tag mới nhất trên trang của action trước khi dùng). `ignore-unfixed` tránh fail vì lỗ hổng chưa có bản vá — cân nhắc theo chính sách của team.
:::
