---
title: "Chiến lược deploy — môi trường có duyệt, migration trong pipeline, rolling/blue-green/canary, rollback bằng tag"
summary: "Workflow deploy chạy sau khi CI xanh hoặc bấm tay với tag cũ để rollback, qua environment production có người duyệt, kéo image theo SHA, migrate rồi đổi phiên bản, smoke test. So sánh recreate, rolling, blue-green, canary, feature flag và quy tắc migration tương thích ngược."
level: advanced
version: 29
lastReviewed: 2026-11-13
tags: [cicd, deployment, rollback, migration, github-actions]
related: [docker/consolidate/cicd/pipeline-test-va-build-image, sql/deep-dive/design/chuan-hoa-jsonb-va-migration]
---

## TL;DR

- Deploy **image đã build** theo **SHA**, không build lại trên server. Rollback = deploy lại SHA trước.
- **Environment** của GitHub (`production`) cho phép yêu cầu người duyệt, giới hạn nhánh, và giữ secret riêng.
- Migration chạy **trước** khi đổi phiên bản app, và phải **tương thích ngược** — code cũ vẫn chạy được trên schema mới (expand/contract).
- Sau deploy luôn có **smoke test**; thất bại thì báo và rollback.

## Workflow deploy (đã qua actionlint)

```yaml title=".github/workflows/deploy.yml"
name: Deploy

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      image_tag:
        description: Tag (commit SHA) cần deploy — dùng để rollback
        required: true

permissions:
  contents: read

concurrency:
  group: deploy-production
  cancel-in-progress: false            # không huỷ một lần deploy đang chạy dở

jobs:
  deploy:
    if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    environment:
      name: production                 # Settings → Environments: thêm Required reviewers
      url: https://api.example.vn
    env:
      IMAGE_TAG: ${{ inputs.image_tag || github.event.workflow_run.head_sha }}
    steps:
      - name: Deploy qua SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: deploy
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          envs: IMAGE_TAG
          script: |
            set -euo pipefail
            cd /srv/product-api
            export IMAGE_TAG
            docker compose -f compose.yaml -f compose.prod.yaml pull api
            docker compose -f compose.yaml -f compose.prod.yaml run --rm api node src/migrate.js
            docker compose -f compose.yaml -f compose.prod.yaml up -d api
            echo "$IMAGE_TAG" > DEPLOYED_TAG
      - name: Smoke test
        run: |
          for _ in $(seq 1 30); do
            curl -fsS https://api.example.vn/health && exit 0
            sleep 2
          done
          echo "Smoke test thất bại" && exit 1
```

Khi soạn bài, actionlint (có shellcheck bên trong) bắt được biến vòng lặp `i` không dùng (`SC2034`) — đổi thành `_` thì sạch. Workflow này dành cho **một server** chạy compose; các bước (pull theo tag → migrate → đổi phiên bản → smoke test) giữ nguyên khi chuyển sang Kubernetes/ECS/Cloud Run, chỉ đổi lệnh.

**Rollback**: tab Actions → *Deploy* → *Run workflow* → nhập SHA đang chạy ổn trước đó (ghi trong `DEPLOYED_TAG` hoặc lịch sử deploy). Không cần build lại vì image vẫn nằm trên registry.

## Chiến lược

| Chiến lược | Cách làm | Downtime | Rollback | Chi phí |
|---|---|---|---|---|
| Recreate | Dừng bản cũ, chạy bản mới (như `compose up -d` một instance) | Vài giây | Deploy lại tag cũ | Thấp |
| Rolling | Thay từng instance sau load balancer | Không | Chậm (phải cuộn ngược) | Thấp |
| Blue-green | Chạy song song bản mới (green) cạnh bản cũ (blue), chuyển toàn bộ traffic một lần | Không | Tức thì: chuyển traffic về blue | Gấp đôi tài nguyên lúc deploy |
| Canary | Chuyển 5% → 25% → 100% traffic sang bản mới, theo dõi lỗi ở mỗi bước | Không | Nhanh: dồn traffic về bản cũ | Cần đo lường tốt |
| Feature flag | Deploy code tắt sẵn, bật tính năng bằng cấu hình | Không | Tắt flag | Code phức tạp hơn |

Mọi chiến lược "không downtime" đều có nghĩa là **hai phiên bản app chạy cùng lúc** trên **cùng một database** — vì vậy migration phải tương thích ngược.

## Migration trong pipeline

| Thay đổi | Làm một lần được? | Cách an toàn |
|---|---|---|
| Thêm bảng, thêm cột cho phép NULL/có default | ✓ | Migrate rồi deploy code |
| Thêm index trên bảng lớn | ✓ nếu `CONCURRENTLY` | Không bọc trong transaction |
| Đổi tên/xoá cột đang dùng | ✗ | Expand (thêm cột mới, ghi cả hai) → deploy → migrate dữ liệu → deploy đọc cột mới → contract (xoá cột cũ) ở lần deploy sau |
| Thêm `NOT NULL` | Cẩn thận | `CHECK … NOT VALID` rồi `VALIDATE` |

Rollback app về SHA cũ chỉ an toàn khi schema hiện tại **vẫn hợp với code cũ** — đó là lý do bước "contract" (xoá thứ cũ) luôn đi sau, ở một lần deploy riêng.

:::senior Góc nhìn senior
Tốc độ deploy và độ an toàn không đối nghịch: team deploy nhiều lần mỗi ngày thường an toàn hơn team deploy mỗi tháng, vì mỗi thay đổi nhỏ, dễ hiểu, dễ rollback. Đầu tư theo thứ tự: pipeline tự động hoàn toàn và lặp lại được → rollback một nút bấm → health check và smoke test → theo dõi lỗi sau deploy (error rate, latency) → mới tới blue-green/canary. Và luôn biết **chính xác SHA nào đang chạy** ở mỗi môi trường.
:::

:::quiz Deploy bản mới làm tăng lỗi 500. Cách rollback nhanh và an toàn nhất trong thiết kế ở trên?
- [ ] Sửa code nóng trên server
- [ ] `git revert` rồi chờ CI build image mới
- [x] Chạy workflow Deploy bằng tay với `image_tag` là SHA ổn định trước đó — image đã có sẵn trên registry
- [ ] Xoá database và chạy lại migration

`git revert` vẫn nên làm sau đó để `main` khớp với thứ đang chạy, nhưng rollback trước đã.
:::

:::quiz Bạn đổi tên cột `full_name` thành `name` trong một migration, rồi deploy kiểu rolling. Điều gì xảy ra trong lúc deploy?
- [ ] Không vấn đề gì
- [x] Các instance còn chạy code cũ truy vấn `full_name` sẽ lỗi — trong rolling, code cũ và mới chạy cùng lúc trên cùng schema
- [ ] PostgreSQL tự tạo alias
- [ ] Chỉ ảnh hưởng instance mới

Dùng expand/contract qua nhiều lần deploy.
:::

:::exercise Thiết kế quy trình deploy cho dự án của bạn
Viết một trang mô tả quy trình deploy cho API + frontend Angular của một team 5 người: các môi trường (dev, staging, production), cái gì kích hoạt deploy ở mỗi môi trường, ai duyệt production, migration chạy ở đâu, cách rollback (gồm cả trường hợp đã chạy migration), smoke test kiểm gì, và ba chỉ số theo dõi trong 30 phút sau deploy.
???
Gợi ý một đáp án tốt:

- **Môi trường**: dev (mỗi PR có thể có preview), staging (tự deploy khi merge `main`), production (deploy khi gắn tag release hoặc bấm tay, cần 1 người duyệt ngoài người viết code — GitHub Environments: Required reviewers).
- **Artifact**: image API và image/thư mục build frontend gắn tag SHA, build một lần ở CI, dùng lại cho staging và production.
- **Migration**: một bước riêng trong job deploy, chạy trước khi đổi phiên bản app, chỉ chứa thay đổi tương thích ngược; bước xoá/đổi tên tách sang lần deploy sau. Migration chạy trên staging trước với dữ liệu gần giống thật.
- **Rollback**: deploy lại SHA trước (workflow_dispatch); vì migration tương thích ngược nên không cần rollback schema; nếu migration hỏng dữ liệu → khôi phục từ backup/PITR theo runbook (đã diễn tập).
- **Smoke test**: `/health` (có kiểm DB), một request đọc thật (`GET /api/products?limit=1`), trang chủ frontend trả 200 và tải được file JS chính.
- **Theo dõi 30 phút**: tỉ lệ lỗi 5xx, độ trễ p95 của API, lỗi JavaScript phía client (Sentry hoặc tương đương); vượt ngưỡng → rollback trước, điều tra sau.
:::
