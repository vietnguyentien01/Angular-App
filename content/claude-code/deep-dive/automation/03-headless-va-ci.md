---
title: Headless (claude -p) và CI — pipe dữ liệu, output JSON, GitHub Actions với @claude
summary: "Chạy Claude Code không tương tác: pipe dữ liệu vào, output JSON và JSON Schema cho script, --bare để tái lập, cấp quyền bằng --allowedTools và --permission-mode, giới hạn lượt và chi phí — rồi đưa vào GitHub Actions để @claude trả lời issue/PR hoặc chạy theo lịch."
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, headless, ci, github-actions, automation]
related: [claude-code/deep-dive/automation/chay-khong-can-giam-sat, claude-code/deep-dive/guardrails/sandbox-va-prompt-injection]
---

## TL;DR

- `claude -p "<prompt>"` chạy một lần, in kết quả, thoát — dùng như mọi công cụ dòng lệnh (đọc stdin, ghi stdout).
- Trong script/CI: thêm **`--bare`** (bỏ qua hook, skill, plugin, MCP, auto memory, CLAUDE.md tự phát hiện) và truyền cấu hình tường minh.
- `-p` mặc định là chế độ Manual: lệnh cần duyệt sẽ **bị từ chối** — cấp quyền bằng `--allowedTools` hoặc `--permission-mode`.
- GitHub: `/install-github-app` để `@claude` trong issue/PR; `anthropics/claude-code-action@v1` cho workflow tuỳ chỉnh.

## Các mẫu cơ bản

```bash title="Pipe dữ liệu vào, ghi ra file"
cat build-error.txt | claude -p 'concisely explain the root cause of this build error' > output.txt
```

```json title="package.json — Claude như một linter"
{
  "scripts": {
    "lint:claude": "git diff main | claude -p \"you are a typo linter. for each typo in this diff, report filename:line on one line and the issue on the next. return nothing else.\""
  }
}
```

Pipe diff vào nghĩa là Claude **không cần quyền Bash** để đọc nó. Stdin tối đa 10MB; lớn hơn thì ghi ra file và nhắc đường dẫn.

## Output cho script

```bash
claude -p "Summarize this project" --output-format json | jq -r '.result'
```

```bash title="Ép đúng cấu trúc bằng JSON Schema"
claude -p "List the exported functions in src/app/core/auth" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}'
```

| `--output-format` | Dùng khi |
|---|---|
| `text` (mặc định) | Đọc bằng mắt, ghi file |
| `json` | Script cần `result`, `session_id`, `total_cost_usd`, usage; với `--json-schema` kết quả nằm ở `structured_output` |
| `stream-json` (+ `--verbose`, `--include-partial-messages`) | Theo dõi từng sự kiện khi chạy dài |

## Quyền trong lần chạy không có người

```bash title="Chỉ cho đúng những gì cần"
claude --bare -p "Run the test suite and fix any failures" \
  --allowedTools "Read,Edit,Bash(npm test *)" \
  --permission-mode dontAsk \
  --max-turns 20
```

| Cách | Hành vi |
|---|---|
| `--allowedTools "..."` | Công cụ/lệnh được chạy không cần hỏi |
| `--permission-mode dontAsk` | Mọi thứ lẽ ra phải hỏi → **từ chối**; hợp CI khoá chặt |
| `--permission-mode acceptEdits` | Sửa file và lệnh filesystem thông dụng không hỏi |
| `--permission-mode auto` | Classifier xét thay bạn |
| `--permission-prompts none` | Không ai trả lời được → từ chối mọi thứ cần hỏi, gỡ công cụ hỏi người dùng |
| `--max-turns N`, `--max-budget-usd X` | Giới hạn số lượt / chi phí (chỉ ở print mode) |

Tuỳ chỉnh thêm: `--append-system-prompt` (hoặc `-file`), `--mcp-config`, `--settings`, `--model`.

Cần điều khiển bằng code thay vì shell (ứng dụng riêng, xử lý approval, stream sự kiện)? Dùng **Agent SDK** (TypeScript/Python) — cùng vòng lặp agent và công cụ của Claude Code, xem mục *Agent SDK* trong tài liệu.

## Tiếp tục hội thoại

```bash
claude -p "Review this codebase for performance issues"
claude -p "Now focus on the change detection hot paths" --continue
```

```bash title="Nhiều hội thoại song song: giữ session_id"
session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id')
claude -p "Continue that review" --resume "$session_id"
```

## GitHub Actions

**Cài nhanh**: trong repo, chạy `claude` rồi `/install-github-app` (cần `gh` đã đăng nhập). Lệnh cài GitHub App, lưu secret (`ANTHROPIC_API_KEY` hoặc `CLAUDE_CODE_OAUTH_TOKEN` cho subscription), đẩy nhánh chứa workflow và mở trang tạo PR. Merge PR đó là `@claude` hoạt động.

```yaml title=".github/workflows/claude.yml — trả lời @claude"
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write
      actions: read
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

Với input `prompt`, action chạy ở **automation mode** trên mọi sự kiện GitHub, kể cả `schedule` (cron); truyền flag CLI qua `claude_args`, vd:

```yaml
          prompt: "Generate a summary of yesterday's commits and open issues"
          claude_args: |
            --max-turns 10
            --allowedTools "mcp__github__list_commits,mcp__github__list_issues"
```

Thực hành tốt theo tài liệu:

- **Không bao giờ** commit API key/token — dùng GitHub Secrets.
- Cấp cho workflow **quyền tối thiểu**; review thay đổi của Claude trước khi merge.
- Giảm chi phí (phút Actions + token): yêu cầu `@claude` cụ thể, issue template cung cấp bối cảnh, `CLAUDE.md` ngắn (đọc mỗi lần chạy), `--max-turns`.
- GitLab có trang hướng dẫn GitLab CI/CD riêng; Bedrock/Vertex/Foundry có trang riêng cho Actions.

:::senior Góc nhìn senior
Đối xử với lần chạy headless như một hàm: đầu vào tường minh (`--bare`, settings/MCP truyền vào), quyền tối thiểu (`--allowedTools`, `dontAsk`), giới hạn (`--max-turns`, budget), đầu ra có cấu trúc (`--json-schema`) để bước sau kiểm tra được. Thử trên 2–3 mẫu, sửa prompt, rồi mới chạy hàng loạt.
:::

:::quiz Lần chạy `claude -p "fix lint"` trong CI dừng lại vì Claude không được chạy `npm run lint`. Vì sao?
- [ ] `-p` không chạy được lệnh shell
- [x] `-p` mặc định là Manual: lệnh cần duyệt bị từ chối khi không có ai duyệt — cần `--allowedTools "Bash(npm run lint)"` hoặc một permission mode phù hợp
- [ ] Phải dùng `--continue`
- [ ] Do thiếu CLAUDE.md

Không có người trả lời hộp thoại, nên quyền phải cấp trước.
:::

:::quiz Vì sao nên dùng `--bare` cho script chạy trên nhiều máy/CI?
- [ ] Để chạy model rẻ hơn
- [x] Để lần chạy không phụ thuộc hook, skill, plugin, MCP, CLAUDE.md có sẵn trên từng máy — kết quả tái lập được, khởi động nhanh hơn
- [ ] Để tắt permission
- [ ] Để bật auto mode

Thứ lần chạy cần thì truyền tường minh bằng flag.
:::

:::exercise Viết script review PR nhỏ
Viết một lệnh shell nhận diff của nhánh so với `main`, nhờ Claude trả về JSON gồm danh sách vấn đề `{file, line, severity, message}`, rồi fail (exit 1) nếu có vấn đề `high`.
???
```bash
git diff main...HEAD | claude --bare -p "Review this Angular diff for correctness bugs only. Skip style." \
  --output-format json \
  --json-schema '{"type":"object","properties":{"issues":{"type":"array","items":{"type":"object","properties":{"file":{"type":"string"},"line":{"type":"integer"},"severity":{"enum":["low","medium","high"]},"message":{"type":"string"}},"required":["file","severity","message"]}}},"required":["issues"]}' \
  --max-turns 5 > review.json
jq -e 'has("structured_output")' review.json > /dev/null || { echo "No structured output"; exit 1; }
jq -e '[.structured_output.issues[] | select(.severity=="high")] | length == 0' review.json
```
Kết quả theo schema nằm ở trường `structured_output`; nếu Claude không trả được output hợp lệ thì trường này **không có**, nên kiểm tra trước. Không cấp quyền Bash vì diff đã được pipe vào.
:::

> Nguồn: *Run Claude Code programmatically* — code.claude.com/docs/en/headless; *Claude Code GitHub Actions* — /github-actions; *CLI reference* (truy cập 11/11/2026).
