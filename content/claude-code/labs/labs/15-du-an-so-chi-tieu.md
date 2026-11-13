---
title: "Lab 15 — Dự án xuyên suốt: app Sổ chi tiêu, dùng toàn bộ kiến thức Claude Code từ cài đặt tới tự động hoá"
summary: "Kế hoạch 12 giai đoạn tự làm app Sổ chi tiêu (Angular + API Express), dùng lần lượt mọi kỹ năng của môn: CLAUDE.md, quyền, plan mode, test-first, hook, skill, subagent, MCP, PR, worktree, CI, scheduled task, plugin, Agent SDK — mỗi bước có prompt mẫu, dấu hiệu xong và link về bài lý thuyết."
type: lesson
level: advanced
lastReviewed: 2026-11-13
tags: [claude-code, lab, du-an, capstone, ke-hoach]
related: [claude-code/labs/labs/du-an-tong-hop, claude-code/labs/labs/workflow-nhieu-agent]
---

## Mục tiêu

Làm từ đầu một ứng dụng **đơn giản về nghiệp vụ** để toàn bộ sức chú ý dành cho **cách làm việc với Claude Code**. Mỗi giai đoạn luyện một nhóm kỹ năng; bên dưới mỗi bước có **📖 Xem lại** dẫn về đúng bài lý thuyết.

**Ứng dụng: Sổ chi tiêu cá nhân** (`expense-lab`)

- Ghi một khoản chi: số tiền (VND), danh mục (Ăn uống, Đi lại, Nhà cửa, Sức khoẻ, Khác), ngày, ghi chú.
- Xem danh sách theo **tháng**, lọc theo danh mục, tổng chi tháng và tổng theo danh mục.
- Đặt **ngân sách tháng**; vượt 80% thì cảnh báo, vượt 100% thì báo đỏ.
- Xuất CSV theo tháng.

**Cấu trúc**: một repo, hai phần — `web/` (Angular 22, signals, Vitest) và `api/` (Node + Express 5 + Zod, dữ liệu lưu file JSON để khỏi cần DB). Hai phần giúp luyện được CLAUDE.md theo tầng, rule theo đường dẫn và làm song song bằng worktree.

**Thời gian**: 2–3 tuần, mỗi ngày 1–2 giờ. Làm theo thứ tự — giai đoạn sau dùng thành quả của giai đoạn trước. Đây là kế hoạch để **bạn tự chạy**; câu chữ Claude trả lời mỗi lần một khác, hãy kiểm theo mục *Xong khi* của từng giai đoạn.

## Bản đồ giai đoạn

| # | Giai đoạn | Kỹ năng Claude Code | Lab đã làm liên quan |
|---|---|---|---|
| 0 | Chuẩn bị | Cài đặt, chọn nơi làm việc, dữ liệu và quyền riêng tư | [Lab 01](/claude-code/labs/labs/chuan-bi-du-an-va-phien-dau-tien) |
| 1 | Khởi tạo và bộ nhớ | `/init`, CLAUDE.md theo tầng, rules theo đường dẫn, `@`, `!` | [Lab 02](/claude-code/labs/labs/claude-md-va-rules) |
| 2 | Quyền và an toàn | Permission mode, settings, deny secret, sandbox, auto mode | [Lab 05](/claude-code/labs/labs/quyen-va-settings) |
| 3 | Tính năng đầu tiên | Spec bằng phỏng vấn, plan mode, đòi bằng chứng | [Lab 03](/claude-code/labs/labs/tinh-nang-voi-plan-mode) |
| 4 | Bug và quản lý phiên | Test-first, `/rewind`, `/compact`, `/context`, model và effort | [Lab 04](/claude-code/labs/labs/sua-bug-test-first-va-rewind) |
| 5 | Hook | Format tự động, bảo vệ file, chặn dừng khi test đỏ | [Lab 06](/claude-code/labs/labs/hooks-format-bao-ve-cong-test) |
| 6 | Skill và subagent | Skill quy trình, skill kiến thức, reviewer chỉ đọc | [Lab 07](/claude-code/labs/labs/viet-skill-cho-du-an), [Lab 08](/claude-code/labs/labs/subagent-reviewer) |
| 7 | Kiểm chứng giao diện | MCP Playwright, `/verify`, Claude in Chrome | [Lab 12](/claude-code/labs/labs/mcp-playwright-kiem-tra-giao-dien) |
| 8 | Git, PR, review | Commit tách nhỏ, PR, `/code-review`, `/security-review`, `@claude` | [Lab 09](/claude-code/labs/labs/git-pr-va-review) |
| 9 | Song song và nhiều agent | Worktree, `/goal`, phiên nền, agent team | [Lab 11](/claude-code/labs/labs/worktree-goal-song-song), [Lab 14](/claude-code/labs/labs/workflow-nhieu-agent) |
| 10 | Tự động hoá | `claude -p`, CI GitHub Actions, scheduled task, cloud environment | [Lab 10](/claude-code/labs/labs/headless-va-ci) |
| 11 | Đóng gói và mở rộng | Plugin, Agent SDK, artifact, status line | — |
| 12 | Tổng kết | Tự chấm, rút kinh nghiệm | [Lab 13](/claude-code/labs/labs/du-an-tong-hop) |

## Trước khi bắt đầu

- [ ] Đã học (hoặc đọc lướt) phần **Cơ bản** và **Thực hành hằng ngày**; các phần Nâng cao đọc khi tới giai đoạn tương ứng.
- [ ] Node 22+, Git, tài khoản GitHub; Claude Code bản mới (`claude update`, `claude doctor` không báo lỗi).
- [ ] Chỉ dùng **dữ liệu giả** — đây là dự án công khai trên GitHub.
- [ ] Mở sẵn file `NHAT-KY.md` (không commit) để ghi: prompt đã dùng, chỗ Claude làm sai, chỗ bạn phải sửa tay. Giai đoạn 12 sẽ dùng nhật ký này.

---

## Giai đoạn 0 — Chuẩn bị (30 phút)

1. Kiểm tra cài đặt và tài khoản: `claude --version`, `claude doctor`, trong phiên gõ `/status`.
2. Chọn nơi làm: terminal + VS Code (khuyến nghị cho dự án này) — cài extension Claude Code để xem diff trong editor.
3. Đọc lại phần dữ liệu đi đâu, và tắt chia sẻ dữ liệu nếu chưa chắc.

**Xong khi**: `/status` hiện đúng tài khoản và model; bạn trả lời được "Claude đọc được những gì trên máy mình".

📖 Xem lại: [Claude Code là gì](/claude-code/review/getting-started/claude-code-la-gi) · [Cài đặt và đăng nhập](/claude-code/review/getting-started/cai-dat-va-dang-nhap) · [Chọn nơi làm việc](/claude-code/consolidate/getting-started/chon-noi-lam-viec) · [Dữ liệu và quyền riêng tư](/claude-code/deep-dive/getting-started/du-lieu-va-quyen-rieng-tu) · [Nguyên tắc nền](/claude-code/review/principles/ai-la-cong-cu) · [Học cùng AI mà không phụ thuộc](/claude-code/consolidate/principles/hoc-cung-ai-khong-phu-thuoc) · [Lệnh tài khoản, trợ giúp, /doctor, /status](/claude-code/commands/commands/lenh-tai-khoan-tro-giup-nen-tang)

## Giai đoạn 1 — Khởi tạo dự án và bộ nhớ (1–2 giờ)

1. **Tự tay** tạo khung (để biết rõ từng file từ đâu ra):

```bash
mkdir expense-lab && cd expense-lab && git init
npx -y @angular/cli@22 new web --style=css --ssr=false --defaults --skip-git
mkdir api && cd api && npm init -y && npm pkg set type=module && npm i express@5 zod && npm i -D vitest supertest && cd ..
git add -A && git commit -m "chore: khung dự án web + api"
```

2. Mở phiên `claude -n "expense-setup"`, hỏi để hiểu khung vừa tạo:

```text
Dự án có hai phần web/ và api/. Liệt kê các file chính của mỗi phần và lệnh chạy, test, build của từng phần. Chưa sửa gì.
```

3. Chạy `/init`, rồi **cắt gọn** CLAUDE.md gốc còn những điều Claude không tự đoán được: cấu trúc 2 phần, lệnh kiểm tra, quy ước (tiền là số nguyên VND, ngày dạng `YYYY-MM-DD`, tiếng Việt cho giao diện).
4. Tạo `web/CLAUDE.md` (Angular: signals, `@if/@for`, a11y) và `api/CLAUDE.md` (Express 5, Zod, định dạng lỗi `{ error, message, details }`).
5. Tạo rule theo đường dẫn `.claude/rules/tests.md` với `paths: ["**/*.spec.ts", "**/*.test.js"]`: test đặt tên tiếng Việt, mỗi bug có test tái hiện.
6. Kiểm tra Claude **có đọc** các file trên: hỏi *"Quy ước định dạng lỗi của API là gì?"* — trả lời phải khớp `api/CLAUDE.md`. Gõ `/memory` để xem file nào đang được nạp.

**Xong khi**: ba file CLAUDE.md, mỗi file dưới 40 dòng; Claude trả lời đúng quy ước mà không cần bạn nhắc; commit `docs: CLAUDE.md và rules`.

📖 Xem lại: [Phiên đầu tiên](/claude-code/review/getting-started/phien-dau-tien) · [Phím tắt và cú pháp `@`, `!`](/claude-code/review/interface/phim-tat-va-cu-phap) · [Slash command cần biết](/claude-code/review/interface/slash-commands-can-biet) · [Cách lệnh hoạt động](/claude-code/commands/commands/cach-dung-lenh) · [Phím tắt đầy đủ](/claude-code/commands/commands/phim-tat-day-du) · [CLAUDE.md ngắn gọn](/claude-code/review/memory/claude-md-ngan-gon) · [Cấu trúc bộ nhớ](/claude-code/consolidate/memory/cau-truc-bo-nho) · [Monorepo và codebase lớn](/claude-code/deep-dive/memory/monorepo-va-codebase-lon) · [Hiểu codebase mới](/claude-code/review/workflows/hieu-codebase-moi)

## Giai đoạn 2 — Quyền và an toàn (1 giờ)

1. Tạo `api/.env` chứa `BUDGET_ALERT_WEBHOOK=https://example.invalid/fake` (giả) và thêm vào `.gitignore`.
2. `.claude/settings.json` (commit) — cho phép sẵn lệnh kiểm tra, chặn đọc secret, hỏi trước khi push:

```json
{
  "permissions": {
    "allow": ["Bash(npm test *)", "Bash(npm run test*)", "Bash(npx ng build*)", "Bash(git status*)", "Bash(git diff *)"],
    "ask": ["Bash(git push *)", "Bash(gh pr create *)"],
    "deny": ["Read(./**/.env)", "Read(./**/.env.*)"]
  }
}
```

3. Thử từng chế độ bằng `Shift+Tab`: Manual (hỏi mọi lần sửa) → accept edits → plan. Nhờ Claude *"đọc api/.env"* → phải bị chặn.
4. Nếu tài khoản có auto mode: khai báo `autoMode.environment` trong `~/.claude/settings.json` (không phải file của repo) và thử nhờ Claude force push → bị chặn.
5. Ghi vào nhật ký: lệnh nào bạn cho phép, vì sao.

**Xong khi**: đọc `.env` bị từ chối; `npm test` chạy không cần hỏi; `git push` luôn hỏi; `/permissions` liệt kê đúng các rule.

📖 Xem lại: [Permission mode](/claude-code/review/guardrails/che-do-quyen) · [Settings và permission rule](/claude-code/consolidate/guardrails/settings-va-permission-rule) · [Hook, permission và sandbox](/claude-code/consolidate/guardrails/hook-permission-sandbox) · [Sandbox và prompt injection](/claude-code/deep-dive/guardrails/sandbox-va-prompt-injection) · [Cấu hình auto mode](/claude-code/deep-dive/guardrails/cau-hinh-auto-mode) · [Lệnh cấu hình](/claude-code/commands/commands/lenh-cau-hinh)

## Giai đoạn 3 — Tính năng đầu tiên: ghi và xem khoản chi (2–3 giờ)

1. **Spec bằng phỏng vấn** — để Claude hỏi bạn trước khi viết gì:

```text
Mình muốn làm tính năng "ghi và xem khoản chi" cho cả api/ và web/. Hãy phỏng vấn mình từng câu một
(dữ liệu, validation, trường hợp biên, giao diện) cho tới khi đủ để viết docs/spec-khoan-chi.md. Chưa code.
```

2. Đọc và sửa `docs/spec-khoan-chi.md`. Tiêu chí tối thiểu: `POST/GET /api/expenses?month=2026-11`, số tiền nguyên dương, danh mục trong danh sách cố định, ngày hợp lệ; web có form có label, danh sách theo tháng, tổng tháng.
3. Vào **plan mode**, yêu cầu kế hoạch có test cho từng bước; mở bằng `Ctrl+G` để sửa trước khi duyệt.

```text
Lập kế hoạch thực hiện docs/spec-khoan-chi.md: API trước (test supertest), rồi web (test Vitest cho service và component).
Mỗi bước ghi file đổi và test. Chưa code.
```

4. Duyệt, theo dõi phút đầu, rồi để Claude làm. Cuối cùng **đòi bằng chứng**:

```text
Chạy npm test ở api/ và web/, npx ng build ở web/, và dán phần kết quả cuối của từng lệnh.
```

**Xong khi**: test hai phần xanh, build thành công; chạy thử `npm start` trong `api/` + `ng serve` trong `web/` và tự thêm 3 khoản chi trên trình duyệt; commit theo từng bước của kế hoạch.

📖 Xem lại: [Viết prompt cụ thể](/claude-code/review/prompting/viet-prompt-cu-the) · [Sáu mẫu prompt hiệu quả](/claude-code/consolidate/prompting/sau-mau-prompt-hieu-qua) · [Prompt cho việc dài, spec bằng phỏng vấn](/claude-code/deep-dive/prompting/prompt-cho-viec-dai-va-tu-chu) · [Explore → Plan → Code](/claude-code/consolidate/workflows/explore-plan-code) · [Quy trình một task Angular](/claude-code/consolidate/memory/quy-trinh-task-angular) · [Cho Claude một phép kiểm tra](/claude-code/consolidate/verification/cho-claude-phep-kiem-tra) · [Đừng tin chữ "xong"](/claude-code/review/verification/dung-tin-chu-xong)

## Giai đoạn 4 — Sửa bug test-first và quản lý phiên (1–2 giờ)

1. **Tự tay** cài một bug: hàm lọc theo tháng dùng `new Date(date).getMonth()` (dính múi giờ — khoản chi ngày `2026-11-01` có thể rơi sang tháng 10 tuỳ múi giờ máy chạy).
2. Mở phiên mới, mô tả **triệu chứng**, không nói nguyên nhân:

```text
Khoản chi ngày 2026-11-01 không hiện trong danh sách tháng 11. Viết test tái hiện trước, cho mình xem test đỏ, rồi mới sửa.
```

3. Luyện **`/rewind`**: để Claude sửa thử một cách bạn không thích → `Esc Esc` / `/rewind` quay về checkpoint trước khi sửa, yêu cầu cách khác (so sánh chuỗi `YYYY-MM` thay vì dùng `Date`).
4. Quản lý context: xem `/context`; khi phiên dài thì `/compact giữ lại spec và các quyết định về ngày tháng`; việc mới không liên quan → `/clear`.
5. Thử đổi `/model` và `/effort` cho một việc nhỏ (đổi màu nút) rồi so `/usage`.

**Xong khi**: có test tái hiện bug (đỏ trước, xanh sau); bạn đã dùng `/rewind` ít nhất một lần; ghi vào nhật ký mức context trước/sau `/compact`.

📖 Xem lại: [Sửa bug, test, refactor](/claude-code/consolidate/workflows/bug-test-refactor) · [Điều khiển phiên](/claude-code/review/sessions/dieu-khien-phien) · [Context window và checkpoint](/claude-code/consolidate/sessions/context-window-va-checkpoint) · [Bên trong Claude Code](/claude-code/deep-dive/principles/ben-trong-claude-code) · [Chọn model và usage](/claude-code/deep-dive/sessions/model-va-usage) · [Lệnh phiên và hội thoại](/claude-code/commands/commands/lenh-phien-va-hoi-thoai) · [Lệnh model, context, chi phí](/claude-code/commands/commands/lenh-model-context-chi-phi)

## Giai đoạn 5 — Hook (1–2 giờ)

Thêm ba hook vào `.claude/settings.json` (cách viết chi tiết ở Lab 06):

| Hook | Sự kiện | Việc |
|---|---|---|
| Format | `PostToolUse` matcher `Edit\|Write` | Chạy Prettier cho file vừa sửa |
| Bảo vệ file | `PreToolUse` matcher `Edit\|Write` | Chặn (exit 2) sửa `package-lock.json`, `.env`, `angular.json` |
| Cổng test | `Stop` | Test đỏ thì không cho Claude kết thúc (nhớ kiểm `stop_hook_active` để không lặp vô hạn) |

Thử: nhờ Claude *"sửa angular.json để đổi cổng dev"* → bị chặn với lý do của bạn; cố ý làm đỏ một test rồi giao việc nhỏ → Claude không dừng được tới khi test xanh. Hook không chạy → `/hooks`, `claude --debug`.

**Xong khi**: ba hook hoạt động đúng như bảng; script hook có trong repo (`.claude/hooks/`) và chạy được trên máy người khác.

📖 Xem lại: [Hook thực chiến](/claude-code/deep-dive/extending/hooks-thuc-chien) · [Hook nâng cao: JSON, prompt, http](/claude-code/deep-dive/extending/hook-prompt-http-agent) · [Khi gặp sự cố](/claude-code/consolidate/getting-started/khi-gap-su-co)

## Giai đoạn 6 — Skill và subagent (2 giờ)

1. **Skill quy trình** `/new-endpoint <tên>`: tạo route + schema Zod + test supertest theo đúng quy ước của `api/`. Thử: `/new-endpoint budgets` → dùng nó để làm API ngân sách tháng (`GET/PUT /api/budgets/:month`).
2. **Skill kiến thức** `expense-domain`: quy tắc nghiệp vụ (tiền nguyên VND, danh mục cố định, ngưỡng cảnh báo 80%/100%) — để Claude tự nạp khi làm việc liên quan.
3. **Subagent** `expense-reviewer` chỉ đọc (`tools: Read, Glob, Grep, Bash`): review diff theo checklist — validation ở API, a11y ở form, không dùng `new Date()` để so tháng, test cho mỗi thay đổi.
4. Dùng skill có sẵn: `/simplify` sau khi làm xong API ngân sách; `/verify` nếu có.
5. Làm phần web cho ngân sách (thanh tiến độ, cảnh báo 80%/100% bằng **chữ**, không chỉ bằng màu), rồi gọi `@"expense-reviewer (agent)" review nhánh hiện tại`.

**Xong khi**: `/new-endpoint` sinh được endpoint chạy và có test; reviewer bắt được ít nhất một vấn đề thật (nếu không, tự cài một lỗi a11y để thử); commit `.claude/skills/` và `.claude/agents/`.

📖 Xem lại: [Bản đồ mở rộng](/claude-code/review/extending/ban-do-mo-rong) · [Mở rộng Claude Code](/claude-code/deep-dive/guardrails/mo-rong-claude-code) · [Viết skill](/claude-code/deep-dive/extending/viet-skill) · [Skill và plugin có sẵn](/claude-code/consolidate/extending/skill-va-plugin-co-san) · [Subagent](/claude-code/deep-dive/extending/subagent) · [Chi phí context của subagent](/claude-code/deep-dive/sessions/chi-phi-va-subagent)

## Giai đoạn 7 — Kiểm chứng giao diện (1–2 giờ)

1. Thêm MCP server Playwright cho dự án (`.mcp.json`), kiểm bằng `/mcp`.
2. Giao việc có phép kiểm tra trên trình duyệt thật:

```text
Mở http://localhost:4200, thêm khoản chi 250000 "Ăn uống" ngày hôm nay, kiểm tra tổng tháng tăng đúng 250.000 ₫.
Đặt ngân sách 300000 rồi kiểm tra cảnh báo 80% hiện bằng chữ. Chụp ảnh màn hình từng bước và báo lỗi console nếu có.
```

3. Thử kiểm bàn phím: chỉ dùng Tab/Enter để thêm một khoản chi — Claude báo phần tử nào không tới được bằng bàn phím.
4. (Tuỳ chọn) Claude in Chrome để debug console và so giao diện với một mockup.

**Xong khi**: có ảnh chụp các bước; ít nhất một lỗi giao diện/a11y được tìm và sửa có test.

📖 Xem lại: [MCP server và plugin](/claude-code/deep-dive/extending/mcp-va-plugin) · [Kiểm chứng ở mức hệ thống](/claude-code/deep-dive/verification/kiem-chung-giao-dien) · [Claude in Chrome cho frontend](/claude-code/deep-dive/interface/claude-in-chrome-cho-frontend)

## Giai đoạn 8 — Git, PR và review (1–2 giờ)

1. Đẩy repo lên GitHub (công khai hoặc riêng tư). Làm tính năng "lọc theo danh mục" trên nhánh `feat/loc-danh-muc`.
2. Nhờ Claude tách commit nhỏ theo ý nghĩa, viết mô tả PR có mục *Cách kiểm tra*.
3. Trước khi push: `/code-review` và `/security-review` (API nhận input từ người dùng — kiểm validation, kích thước body).
4. Tạo PR (`git push` sẽ hỏi bạn — đúng như rule ở giai đoạn 2). Cài GitHub app (`/install-github-app`) rồi comment `@claude` trên PR để thử.
5. Viết `REVIEW.md` ngắn: những gì reviewer (người hay máy) phải kiểm ở dự án này.

**Xong khi**: PR có commit gọn, mô tả rõ, đã qua hai lần review; bạn tự merge sau khi đọc diff.

📖 Xem lại: [Git và pull request](/claude-code/consolidate/workflows/git-va-pull-request) · [Review và bảo mật quy mô team](/claude-code/deep-dive/workflows/review-va-bao-mat-quy-mo-team) · [Lệnh cho quy trình code](/claude-code/commands/commands/lenh-quy-trinh-code)

## Giai đoạn 9 — Làm song song và nhiều agent (2–3 giờ)

1. Hai tính năng độc lập, hai **worktree**:
   - `api`: `GET /api/expenses/export.csv?month=…` (có BOM để Excel đọc đúng tiếng Việt).
   - `web`: biểu đồ tổng theo danh mục bằng CSS thuần (thanh ngang), có bảng số liệu thay thế cho trình đọc màn hình.

```bash
claude -w csv-export -n "csv"      # terminal 1
claude -w category-chart -n "chart" # terminal 2
```

2. Ở một phiên, dùng `/goal` với điều kiện kiểm chứng được: *"npm test ở api/ xanh và endpoint export trả đúng 3 dòng cho dữ liệu mẫu"*.
3. Giao một việc **nền** (`--bg` hoặc agent view): *"rà toàn bộ web/ tìm input thiếu label, báo cáo, chưa sửa"*; theo dõi bằng `claude agents`.
4. Gộp hai nhánh, giải quyết conflict (nếu có) cùng Claude.
5. (Nâng cao) Bật agent teams và cho 3 teammate review PR gộp theo ba góc: bảo mật API, a11y giao diện, độ phủ test.

**Xong khi**: hai tính năng vào `main`, test xanh; bạn ghi vào nhật ký thời gian tiết kiệm được (hoặc mất thêm) so với làm tuần tự.

📖 Xem lại: [Làm song song và chạy dài](/claude-code/deep-dive/automation/lam-viec-song-song) · [Phiên nền và agent view](/claude-code/consolidate/automation/phien-nen-va-agent-view) · [Phối hợp nhiều agent](/claude-code/deep-dive/automation/agent-teams-workflows-channels) · [Lab 14 — Workflow nhiều agent](/claude-code/labs/labs/workflow-nhieu-agent)

## Giai đoạn 10 — Tự động hoá (2–3 giờ)

1. **Headless trong script**: `scripts/release-notes.sh` dùng `git log` của tuần qua | `claude -p` với quyền tối thiểu (`--allowedTools ""`, `--max-turns 1`) để viết ghi chú phát hành tiếng Việt.
2. **CI**: workflow GitHub Actions chạy test và build cho mỗi PR; thêm một bước **cổng review** gọi `claude -p --output-format json` với JSON Schema, fail khi có vấn đề mức `high`. Key để trong GitHub Secrets.
3. **Scheduled task** (trên cloud, nếu gói hỗ trợ): mỗi thứ Hai kiểm tra dependency lỗi thời của `api/` và `web/`, mở **PR** (không push vào `main`) kèm kết quả test.
4. Tạo **cloud environment** riêng cho repo: mạng Limited, setup script cài dependency, biến môi trường không chứa secret.
5. Trả lời "năm câu hỏi trước khi để Claude chạy một mình" cho scheduled task ở bước 3 và ghi vào README.

**Xong khi**: PR mới có check CI (test + cổng review); scheduled task chạy ít nhất một lần và tạo PR đọc được; không có secret nào trong repo.

📖 Xem lại: [Ba mức tự động hoá](/claude-code/review/automation/ba-muc-tu-dong-hoa) · [Headless và CI](/claude-code/deep-dive/automation/headless-va-ci) · [Để Claude chạy một mình](/claude-code/deep-dive/automation/chay-khong-can-giam-sat) · [Cloud environment](/claude-code/deep-dive/automation/cloud-environment) · [Lệnh claude trên shell](/claude-code/commands/commands/lenh-claude-tren-shell) · [Flag dòng lệnh](/claude-code/commands/commands/flag-dong-lenh) · [Biến môi trường](/claude-code/commands/commands/bien-moi-truong)

## Giai đoạn 11 — Đóng gói và mở rộng (2–3 giờ)

1. **Plugin**: gom skill `new-endpoint`, `expense-domain`, subagent `expense-reviewer` và ba hook thành plugin `expense-kit`; tạo marketplace trong một repo riêng, cài vào một repo thử bằng một lệnh; `claude plugin validate` không lỗi.
2. **Agent SDK**: viết `scripts/monthly-report.ts` — agent chỉ đọc (`allowedTools: ['Read','Glob','Grep']`, `permissionMode: 'dontAsk'`, `maxTurns` giới hạn) đọc file dữ liệu tháng và viết `bao-cao-thang.md` (tổng, top danh mục, so với ngân sách).
3. **Artifact**: nhờ Claude dựng một artifact "Tổng kết dự án" — sơ đồ kiến trúc, bảng các giai đoạn, số test — để chia sẻ (không chứa dữ liệu thật).
4. **Tuỳ biến**: status line hiện nhánh git + mức context; một output style ngắn gọn cho phiên review.
5. (Tuỳ chọn) Đọc bài bảo mật và quy định team, viết 5 quy tắc nếu dự án này là của công ty.

**Xong khi**: repo thứ hai cài `expense-kit` và có ngay skill/agent/hook; `monthly-report.ts` chạy ra báo cáo đúng với dữ liệu mẫu.

📖 Xem lại: [Tạo plugin cho team](/claude-code/deep-dive/extending/tao-plugin-cho-team) · [Agent SDK nhập môn](/claude-code/deep-dive/automation/agent-sdk-nhap-mon) · [Artifacts, Projects và theo dõi team](/claude-code/deep-dive/getting-started/artifacts-projects-va-theo-doi-team) · [Tuỳ biến môi trường làm việc](/claude-code/consolidate/interface/tuy-bien-moi-truong-lam-viec) · [Bảo mật và quy định team](/claude-code/deep-dive/automation/bao-mat-va-quy-dinh-team) · [Mạng doanh nghiệp và dev container](/claude-code/consolidate/getting-started/mang-doanh-nghiep-va-dev-container)

## Giai đoạn 12 — Tổng kết (1 giờ)

1. Đọc lại `NHAT-KY.md`, viết `docs/rut-kinh-nghiem.md`: 3 prompt hiệu quả nhất, 3 lần Claude sai và bạn phát hiện bằng cách nào, cấu hình nào sẽ mang sang dự án thật.
2. Tự chấm bằng bảng dưới; mục nào dưới 2 điểm → mở lại bài trong cột "Xem lại".
3. Viết README cho repo (kiến trúc, cách chạy, cách Claude Code được dùng trong dự án) — repo này có thể đưa vào mục **Dự án** trong CV.

| Kỹ năng | 0 — chưa làm · 1 — làm theo hướng dẫn · 2 — tự làm được · 3 — giải thích và áp dụng sang dự án khác | Xem lại |
|---|---|---|
| Bộ nhớ (CLAUDE.md, rules) | | [Cấu trúc bộ nhớ](/claude-code/consolidate/memory/cau-truc-bo-nho) |
| Quyền và an toàn | | [Settings và permission rule](/claude-code/consolidate/guardrails/settings-va-permission-rule) |
| Plan mode và spec | | [Explore → Plan → Code](/claude-code/consolidate/workflows/explore-plan-code) |
| Test-first và kiểm chứng | | [Cho Claude một phép kiểm tra](/claude-code/consolidate/verification/cho-claude-phep-kiem-tra) |
| Quản lý phiên và chi phí | | [Context window và checkpoint](/claude-code/consolidate/sessions/context-window-va-checkpoint) |
| Hook | | [Hook thực chiến](/claude-code/deep-dive/extending/hooks-thuc-chien) |
| Skill và subagent | | [Viết skill](/claude-code/deep-dive/extending/viet-skill) |
| MCP và kiểm tra giao diện | | [MCP server và plugin](/claude-code/deep-dive/extending/mcp-va-plugin) |
| Git, PR, review | | [Git và pull request](/claude-code/consolidate/workflows/git-va-pull-request) |
| Song song và nhiều agent | | [Làm song song](/claude-code/deep-dive/automation/lam-viec-song-song) |
| Headless, CI, scheduled task | | [Headless và CI](/claude-code/deep-dive/automation/headless-va-ci) |
| Plugin và Agent SDK | | [Tạo plugin](/claude-code/deep-dive/extending/tao-plugin-cho-team) |

**Xong khi**: tổng ≥ 24/36 điểm, README và rút kinh nghiệm đã commit.

## Kết quả bạn nên thấy

> Câu chữ Claude trả lời mỗi lần một khác — điều cần kiểm là **kết quả** trong bảng dưới, không phải câu chữ.

| Giai đoạn | Dấu hiệu đúng | Nếu khác |
|---|---|---|
| 1 | `/memory` liệt kê CLAUDE.md gốc và của thư mục đang làm; Claude nói đúng quy ước API | CLAUDE.md con chỉ nạp khi Claude làm việc trong thư mục đó — hỏi một câu về file trong `api/` |
| 2 | Đọc `.env` bị từ chối; `git push` luôn có hộp thoại | Rule đặt sai file hoặc sai cú pháp → `/permissions` xem rule đang có hiệu lực |
| 3 | Kế hoạch có test cho từng bước; Claude dán kết quả lệnh test thật | Claude nói "đã xong" mà không có output → yêu cầu chạy lại và dán kết quả |
| 4 | Test tái hiện **đỏ** trước khi sửa | Test xanh ngay → test chưa chạm đúng ngày biên `2026-11-01`; thử với `TZ=Asia/Ho_Chi_Minh` và `TZ=America/Los_Angeles` |
| 5 | Sửa `angular.json` bị chặn kèm lý do của bạn | Hook không chạy → `/hooks`, quyền thực thi của script, đường dẫn `$CLAUDE_PROJECT_DIR` |
| 6 | `/new-endpoint` xuất hiện trong danh sách lệnh | Thư mục skill phải là `.claude/skills/<tên>/SKILL.md`; khởi động lại phiên |
| 7 | `/mcp` báo Playwright *connected*; có ảnh chụp | Server chưa được duyệt → `/mcp` để bật; kiểm `npx` chạy được |
| 9 | Hai worktree chạy độc lập, không giẫm file | Hai phiên sửa cùng file → chia việc lại theo thư mục |
| 10 | Check CI xuất hiện trên PR; scheduled task mở PR | Secret chưa đặt hoặc tên khác → xem log job |
| 11 | Repo thử có skill/agent/hook sau một lệnh cài plugin | `claude plugin validate` chỉ ra lỗi manifest |

## Checklist hoàn thành

- [ ] 12 giai đoạn, mỗi giai đoạn có ít nhất một commit
- [ ] Có ít nhất: 3 file CLAUDE.md, 1 rule, 3 hook, 2 skill, 1 subagent, 1 MCP server, 1 workflow CI, 1 plugin, 1 script Agent SDK
- [ ] Mọi tính năng có test; không có secret hay dữ liệu thật trong repo
- [ ] `docs/rut-kinh-nghiem.md` và README hoàn chỉnh; tự chấm ≥ 24/36

## Lỗi thường gặp

- **Giao cả giai đoạn trong một prompt.** Chia nhỏ theo bước, kiểm xong mới sang bước sau.
- **Để Claude tự viết CLAUDE.md dài.** Cắt còn những gì Claude không tự đoán được; dài quá thì quy tắc quan trọng bị chìm.
- **Bỏ qua phép kiểm tra.** Không có lệnh test/build/ảnh chụp thì "xong" chỉ là lời nói.
- **Cấp quyền rộng cho nhanh.** `Bash(*)` hay `bypassPermissions` trên repo có `.env` là thói quen nguy hiểm khi sang dự án thật.
- **Không ghi nhật ký.** Giai đoạn 12 sẽ không có gì để rút kinh nghiệm.

:::quiz Ở giai đoạn 4, vì sao mô tả **triệu chứng** ("khoản chi ngày 01/11 không hiện") thay vì nói luôn nguyên nhân bạn đã cài?
- [ ] Để Claude làm lâu hơn
- [x] Để luyện quy trình thật — Claude phải tìm nguyên nhân và viết test tái hiện, giống khi bạn chưa biết bug nằm đâu
- [ ] Vì Claude không hiểu khi được nói nguyên nhân
- [ ] Vì `/rewind` chỉ dùng được với bug chưa biết

Bạn đánh giá được Claude điều tra có đúng hướng không, và test có thực sự tái hiện bug không.
:::

:::quiz Bạn muốn rule "không bao giờ sửa `package-lock.json`" **luôn** được tuân thủ. Đặt ở đâu là chắc chắn nhất?
- [ ] Một dòng trong CLAUDE.md
- [ ] Nhắc trong mỗi prompt
- [x] Hook `PreToolUse` chặn bằng exit 2 (hoặc rule `deny` cho Edit trên file đó)
- [ ] Skill `expense-domain`

CLAUDE.md là hướng dẫn Claude **nên** theo; hook và permission là hàng rào **bắt buộc**.
:::

:::quiz Scheduled task ở giai đoạn 10 nên đưa kết quả vào đâu?
- [ ] Push thẳng vào `main` cho nhanh
- [x] Mở PR riêng để bạn đọc diff và kết quả test rồi mới merge
- [ ] Ghi đè file trên máy bạn
- [ ] Không cần đầu ra, chỉ cần chạy

Việc chạy không giám sát nên có điểm dừng cho người duyệt.
:::

:::exercise Thêm giai đoạn 13 cho riêng bạn
Chọn một tính năng mới cho Sổ chi tiêu (vd chi tiêu định kỳ hằng tháng, nhiều ví, nhập từ file CSV ngân hàng). Viết kế hoạch giai đoạn 13 theo đúng khuôn của bài này: mục tiêu, các bước có prompt mẫu, *Xong khi*, và ít nhất 4 link **Xem lại** tới bài lý thuyết phù hợp. Kế hoạch phải dùng lại ít nhất 3 thứ bạn đã tạo ở các giai đoạn trước (skill, subagent, hook, CI…).
???
Ví dụ — **Giai đoạn 13: Chi tiêu định kỳ**

1. Spec bằng phỏng vấn: kỳ lặp (tháng/tuần), ngày bắt đầu/kết thúc, khoản đã sinh có sửa riêng được không, xử lý tháng không có ngày 31.
2. `/new-endpoint recurring` (dùng lại skill) cho `POST/GET /api/recurring`; plan mode cho phần sinh khoản chi theo tháng, test-first với các ngày biên (31/01 → 28/02, năm nhuận).
3. Hook cổng test (dùng lại) giữ Claude tới khi xanh; `expense-reviewer` (dùng lại) review diff.
4. MCP Playwright: tạo khoản định kỳ, chuyển sang tháng sau, kiểm khoản tự xuất hiện.
5. PR qua CI có cổng review (dùng lại).

*Xong khi*: test các ngày biên xanh, PR đã merge, nhật ký ghi lại một chỗ Claude xử lý sai ngày cuối tháng.

📖 Xem lại: [Prompt cho việc dài, spec bằng phỏng vấn](/claude-code/deep-dive/prompting/prompt-cho-viec-dai-va-tu-chu) · [Explore → Plan → Code](/claude-code/consolidate/workflows/explore-plan-code) · [Viết skill](/claude-code/deep-dive/extending/viet-skill) · [Hook thực chiến](/claude-code/deep-dive/extending/hooks-thuc-chien) · [Headless và CI](/claude-code/deep-dive/automation/headless-va-ci)
:::

> Kế hoạch này tổng hợp từ các bài trong môn (đã đối chiếu tài liệu chính thức tại code.claude.com/docs khi soạn từng bài). Lệnh và tên tính năng có thể đổi theo phiên bản — khi một bước không khớp, mở bài lý thuyết được link để xem cách làm hiện hành.
