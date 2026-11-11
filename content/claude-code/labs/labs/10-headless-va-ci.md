---
title: "Lab 10 — Claude trong script và CI: linter chính tả, cổng review có JSON Schema, job sửa lint khoá chặt, GitHub Actions"
summary: "Bốn tự động hoá chạy được ngay trên cc-lab: npm script soát chính tả diff bằng claude -p, script review trả JSON theo schema và chặn khi có lỗi high (đã chạy thử), job sửa lint với --bare + dontAsk + giới hạn lượt, và workflow GitHub Actions chạy review cho mỗi PR."
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, lab, headless, ci, github-actions]
related: [claude-code/deep-dive/automation/headless-va-ci, claude-code/labs/labs/worktree-goal-song-song]
---

## Mục tiêu

Biến Claude thành **một công cụ dòng lệnh có đầu vào/đầu ra rõ ràng**, quyền tối thiểu, có giới hạn — để ghép vào script và CI.

**Thời gian:** 60 phút · **Cần:** `jq`; Lab 09 nếu làm phần GitHub Actions.

## Bài 1 — Linter chính tả cho diff

```json title="package.json (thêm vào scripts)"
"lint:typos": "git diff main | claude -p \"you are a typo linter. for each typo in this diff, report filename:line on one line and the issue on the next. return nothing else.\""
```

Cố ý viết sai chính tả một comment (vd `// recieve tasks`), rồi:

```bash
npm run lint:typos
```

Diff được **pipe** vào → Claude không cần quyền Bash để đọc. Hỏi lại: lệnh này có chạy được trên máy đồng nghiệp chưa đăng nhập Claude Code không? (Không — cần `claude auth status` trước, xem bài 3.)

## Bài 2 — Cổng review có cấu trúc

```bash title="scripts/claude-review.sh"
#!/bin/bash
set -euo pipefail
SCHEMA='{"type":"object","properties":{"issues":{"type":"array","items":{"type":"object","properties":{"file":{"type":"string"},"line":{"type":"integer"},"severity":{"enum":["low","medium","high"]},"message":{"type":"string"}},"required":["file","severity","message"]}}},"required":["issues"]}'

git diff main...HEAD | claude --bare -p \
  "Review this Angular diff for correctness bugs and missing cleanup only. Skip style. Severity high = will break behavior or leak resources." \
  --output-format json --json-schema "$SCHEMA" --max-turns 5 > review.json
```

```bash title="scripts/review-gate.sh"
#!/bin/bash
set -euo pipefail
OUT=${1:-review.json}
if ! jq -e 'has("structured_output")' "$OUT" > /dev/null; then
  echo "Không có structured_output — xem $OUT"; exit 1
fi
jq -r '.structured_output.issues[] | "\(.severity)\t\(.file):\(.line // "-")\t\(.message)"' "$OUT"
HIGH=$(jq '[.structured_output.issues[] | select(.severity == "high")] | length' "$OUT")
if [ "$HIGH" -gt 0 ]; then
  echo "❌ Có $HIGH vấn đề mức high"; exit 1
fi
echo "✅ Không có vấn đề mức high"
```

```bash
chmod +x scripts/*.sh
git checkout -b lab10-gate
# Cài một lỗi high: trong TaskStore thêm setInterval không bao giờ clear
git commit -am "wip: leak"
./scripts/claude-review.sh && ./scripts/review-gate.sh
```

Kỳ vọng: gate in danh sách vấn đề và **exit 1**. Sửa lỗi, commit, chạy lại → **exit 0**. (Logic của `review-gate.sh` đã được chạy thử với ba trường hợp: có lỗi high, không lỗi, thiếu `structured_output`.)

## Bài 3 — Job sửa lint khoá chặt

Thêm ESLint cho dự án (`npx ng add @angular-eslint/schematics`), rồi:

```bash title="scripts/fix-lint.sh"
#!/bin/bash
set -euo pipefail
claude auth status > /dev/null || { echo "Claude Code chưa đăng nhập"; exit 1; }
claude --bare -p "Run npx ng lint. Fix only auto-fixable style issues and unused imports. Do not change behavior. Finish by running npx ng lint again and report remaining errors." \
  --allowedTools "Read,Edit,Bash(npx ng lint *),Bash(npx ng lint)" \
  --permission-mode dontAsk \
  --max-turns 15 \
  --output-format json | jq -r '.result, "cost: \(.total_cost_usd)"'
```

Quan sát: Claude **không** chạy được lệnh nào ngoài `ng lint` (thử thêm vào prompt "and run npm install" — sẽ bị từ chối vì `dontAsk`).

## Bài 4 — Review mỗi PR bằng GitHub Actions

Cần secret `ANTHROPIC_API_KEY` (hoặc `CLAUDE_CODE_OAUTH_TOKEN` từ `claude setup-token`) trong repo cc-lab.

```yaml title=".github/workflows/claude-review.yml (theo ví dụ chính thức)"
name: Code Review
on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]
jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          plugin_marketplaces: "https://github.com/anthropics/claude-plugins-official.git"
          plugins: "code-review@claude-plugins-official"
          prompt: "/code-review:code-review --comment ${{ github.repository }}/pull/${{ github.event.pull_request.number }}"
          claude_args: '--allowedTools "mcp__github_inline_comment__create_inline_comment"'
```

- `--comment`: Claude đăng review lên PR (comment inline cho từng vấn đề, hoặc một comment tóm tắt khi không thấy gì). Bỏ đi thì kết quả chỉ nằm trong log của workflow.
- Dòng `claude_args` phải giữ: action chỉ khởi động MCP server đăng comment inline khi `--allowedTools` liệt kê nó.
- Với prompt văn bản thường (không phải skill), Claude **không có** quyền shell hay GitHub API cho tới khi bạn cấp đúng công cụ qua `claude_args`.

Mở một PR nhỏ, xem tab Actions và comment Claude để lại. Cách cài nhanh hơn có workflow review dựng sẵn: `/install-github-app`.

## Checklist hoàn thành

- [ ] `npm run lint:typos` báo đúng lỗi chính tả cố ý
- [ ] Gate exit 1 khi có lỗi high, exit 0 sau khi sửa
- [ ] Job lint chỉ chạy được đúng lệnh cho phép; in kết quả và chi phí
- [ ] (Tuỳ chọn) Workflow review chạy trên một PR thật; secret nằm trong GitHub Secrets, **không** trong repo

## Lỗi thường gặp

| Hiện tượng | Xử lý |
|---|---|
| `review.json` không có `structured_output` | Claude không trả được output hợp lệ (từ chối, hết lượt) — đọc `.result`, tăng `--max-turns` hoặc làm prompt rõ hơn |
| Job bị dừng vì cần quyền | `-p` mặc định không ai duyệt — thêm đúng lệnh vào `--allowedTools` |
| Kết quả khác nhau giữa các máy | Thiếu `--bare`: hook/skill/CLAUDE.md cục bộ của từng máy đang ảnh hưởng |
| Workflow tốn nhiều | Giảm `--max-turns`, prompt cụ thể hơn, `CLAUDE.md` ngắn |

:::quiz Trong Bài 2, vì sao không cấp quyền Bash cho Claude?
- [ ] Vì `--bare` cấm Bash
- [x] Vì diff đã được pipe vào stdin — Claude không cần chạy lệnh nào để đọc nó; ít quyền hơn là an toàn hơn
- [ ] Vì Bash không chạy trong CI
- [ ] Vì JSON Schema yêu cầu

Nguyên tắc: đưa dữ liệu vào, đừng cấp quyền đi lấy dữ liệu nếu không cần.
:::

:::exercise Thử thách mở rộng — release note tự động
Viết `scripts/release-notes.sh`: lấy commit từ tag gần nhất tới HEAD, nhờ Claude viết release note tiếng Việt nhóm theo feat/fix, ghi ra `RELEASE_NOTES.md`. Không cấp công cụ nào.
???
```bash
#!/bin/bash
set -euo pipefail
FROM=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)
git log "$FROM"..HEAD --pretty='- %s (%h)' | claude --bare -p \
  "Viết release note tiếng Việt cho người dùng cuối từ danh sách commit này. Nhóm: Tính năng mới, Sửa lỗi. Bỏ commit chore/refactor/test. Chỉ trả về markdown." \
  --tools "" --max-turns 2 > RELEASE_NOTES.md
```
`--tools ""` tắt mọi công cụ — Claude chỉ biến đổi văn bản đầu vào. Kiểm tra: mỗi commit `feat`/`fix` xuất hiện đúng một lần.
:::

> Nguồn: *Run Claude Code programmatically* — code.claude.com/docs/en/headless; *CLI reference*; *Claude Code GitHub Actions* (truy cập 11/11/2026).
