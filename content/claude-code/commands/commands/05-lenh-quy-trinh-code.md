---
title: Lệnh cho quy trình code — /plan, /diff, /code-review, /security-review, /simplify, /verify, /batch, /schedule…
summary: "Giải thích từng lệnh dùng khi làm và giao code: lên kế hoạch, xem diff, review bug và bảo mật, dọn code, chạy app thật để xác minh, thay đổi lớn song song, tự sửa PR, GitHub/Slack, scheduled task, nghiên cứu sâu, debug — và các skill có sẵn khác."
type: cheatsheet
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, commands, workflow, code-review, reference]
related: [claude-code/consolidate/workflows/git-va-pull-request, claude-code/commands/commands/lenh-cau-hinh]
---

## Trước khi sửa

### `/plan [description]` — vào plan mode

```text
/plan thêm phân trang server-side cho bảng Orders, giữ nguyên API hiện có
```

Claude khám phá và đề xuất kế hoạch, không sửa source tới khi bạn duyệt. Không mô tả → chỉ chuyển chế độ.

## Xem và review thay đổi

### `/diff` — xem thay đổi trong working tree

Gồm cả các sửa đổi Claude vừa làm. Dùng trước mỗi commit.

### `/code-review` — tìm bug trong thay đổi

Cú pháp: `/code-review [low|medium|high|xhigh|max|ultra] [--fix] [--comment] [--max-findings n|all|default] [pr#|branch|path]`. Alias `/review`. Review diff hiện tại (hoặc PR, nhánh, đường dẫn) để tìm **bug về tính đúng đắn**.

```text
/code-review
/code-review high
/code-review high 1234
/code-review --fix
/code-review medium --comment 1234
/code-review ultra
```

| Tuỳ chọn | Ý nghĩa |
|---|---|
| `low` … `max` | Mức kỹ: từ ít phát hiện độ tin cậy cao tới nhiều phát hiện (có cái chưa chắc) |
| `ultra` | Review đa agent sâu trên cloud (như `/ultrareview`) |
| `--fix` | Áp dụng các sửa đổi sau review |
| `--comment` | Đăng kết quả thành comment trên PR GitHub / MR GitLab |
| `--max-findings n\|all\|default` | Số phát hiện tối đa được báo |
| `pr#`, nhánh, đường dẫn | Đối tượng review thay vì diff hiện tại |

Không ghi mức → dùng lại mức bạn gõ lần trước.

### `/security-review` — tìm lỗ hổng bảo mật

Review diff giữa nhánh hiện tại và nhánh mặc định trên `origin`: injection, lỗi xác thực/phân quyền, lộ dữ liệu… Cần remote `origin`.

### `/simplify [target]` — dọn code vừa đổi

Bốn agent chạy song song xét: tái sử dụng helper có sẵn, đơn giản hoá, hiệu năng, mức trừu tượng hợp lý — rồi áp dụng. **Không** săn bug (dùng `/code-review`).

### `/ultrareview [PR or branch]` — review sâu trên cloud sandbox

Cách gọi được khuyến nghị là `/code-review ultra`. Có số lượt miễn phí giới hạn trên một số gói, sau đó cần usage credits.

## Xác minh bằng app thật

### `/verify` — xác nhận thay đổi hoạt động

Build, chạy app, quan sát kết quả thật — không chỉ dựa vào test/typecheck. Chỉ chạy khi bạn gọi.

### `/run` — khởi động và điều khiển app

Để xem một thay đổi chạy thật (vd mở trang, bấm nút).

### `/run-skill-generator` — dạy `/run` và `/verify` cách chạy dự án của bạn

Viết một skill riêng cho dự án mô tả cách build, khởi động và điều khiển app từ môi trường sạch.

## Thay đổi lớn và song song

### `/batch <instruction>` — thay đổi cơ học trên toàn codebase

```text
/batch chuyển mọi component trong src/app/features sang signal input/output
```

Nghiên cứu, chia thành 5–30 đơn vị độc lập, cho xem kế hoạch; duyệt xong mỗi đơn vị chạy ở subagent nền trong worktree riêng, chạy test, mở PR hoặc báo kết quả.

### `/autofix-pr [prompt]` — cloud session tự sửa PR

Theo dõi PR của nhánh hiện tại (phát hiện bằng `gh pr view`), tự push sửa khi CI fail hoặc có review comment.

```text
/autofix-pr chỉ sửa lỗi lint và lỗi type, không đụng logic
```

### `/workflows` — theo dõi dynamic workflow

Xem, tạm dừng, tiếp tục hoặc lưu các workflow đang/đã chạy. `/workflow-authoring` nạp tài liệu viết script workflow.

### `/deep-research <question>` — nghiên cứu nhiều nguồn

Workflow có sẵn: tìm web song song, đọc và đối chiếu nguồn, tổng hợp báo cáo có trích dẫn.

```text
/deep-research so sánh Signal Forms và Reactive Forms trong Angular 22: API, hiệu năng, cách migrate
```

## Tích hợp GitHub, Slack, lịch

### `/install-github-app` — cài Claude GitHub App + workflow

Chỉ với repo github.com, cần `gh` đã đăng nhập. Sau khi merge PR workflow, `@claude` hoạt động trong issue/PR.

### `/schedule [description]` — scheduled task trên cloud

Alias `/routines`. Tạo, sửa, liệt kê, chạy scheduled task bằng hội thoại; hỏi được về các lần chạy gần đây.

```text
/schedule mỗi thứ Hai 8h sáng chạy npm audit, có lỗ hổng high thì mở PR nâng version
```

## Chẩn đoán và skill chuyên dụng

| Lệnh | Làm gì |
|---|---|
| `/debug [description]` | Bật debug log từ thời điểm này và nhờ Claude đọc log để chẩn đoán sự cố |
| `/claude-api [...]` | Nạp tài liệu Claude API / Managed Agents theo ngôn ngữ dự án (tự kích hoạt khi code import SDK của Anthropic) |
| `/dataviz [request]` | Hướng dẫn thiết kế biểu đồ, dashboard: chọn dạng biểu đồ, màu theo vai trò, kiểm tra màu cho người mù màu |
| `/design [brief]` | Phác mockup UI, flow màn hình thành artifact Claude Design (khi tài khoản hỗ trợ) |
| `/design-sync`, `/design-login`, `/design consent` | Đồng bộ design system React lên Claude Design và cấp quyền |
| `/slides [brief]` | Tạo bài trình chiếu dạng artifact |
| `/artifacts` | Liệt kê artifact của bạn, gắn vào phiên, mở hoặc copy link |
| `/artifact-capabilities` | Nạp tài liệu về các khả năng runtime một artifact dùng được (gọi connector, cho tải file…) — Claude thường tự nạp |
| `/artifact-diagramming` | Nạp hướng dẫn vẽ sơ đồ SVG rõ ở cả theme sáng và tối cho artifact |
| `/claude-in-chrome [task]` | Nhờ Claude làm việc trong trình duyệt (test trang, điền form, đọc console) khi bật tích hợp Chrome |

:::quiz Bạn muốn **tìm bug** trong PR #87 ở mức kỹ cao và đăng kết quả lên PR. Lệnh nào?
- [ ] `/simplify 87`
- [x] `/code-review high --comment 87`
- [ ] `/security-review 87`
- [ ] `/diff 87`

`/simplify` không săn bug; `/security-review` chỉ xét bảo mật của nhánh hiện tại.
:::

:::quiz Test đều xanh nhưng bạn muốn chắc nút "Lưu" trên trang thật hoạt động. Lệnh có sẵn nào hợp nhất?
- [ ] `/diff`
- [x] `/verify`
- [ ] `/recap`
- [ ] `/plan`

`/verify` build và chạy app để quan sát kết quả thật.
:::

:::exercise Một vòng "trước khi ship" trên thay đổi thật
Trên một nhánh có thay đổi chưa push: chạy lần lượt `/diff`, `/code-review`, `/security-review`, `/simplify`. Với mỗi lệnh ghi lại: số phát hiện, bao nhiêu cái bạn đồng ý, bao nhiêu cái sai. Sửa những cái đúng rồi chạy lại `/code-review`.
???
Kỳ vọng thường gặp: `/code-review` bắt lỗi logic thật (null, điều kiện biên, unsubscribe thiếu); `/security-review` có thể báo các mục "nên xem" (vd `innerHTML`, thiếu kiểm tra quyền) — đánh giá theo ngữ cảnh; `/simplify` đề xuất dùng helper có sẵn. Ghi lại các phát hiện **sai** để cải thiện CLAUDE.md (vd thêm "API X đã được validate ở interceptor"). Không bao giờ áp dụng `--fix` mà không đọc diff.
:::

> Nguồn: *Commands*, *Review locally with /code-review*, *Find bugs with ultrareview*, *Claude Code GitHub Actions*, *Automate work with scheduled tasks* — code.claude.com/docs (truy cập 11/11/2026).
