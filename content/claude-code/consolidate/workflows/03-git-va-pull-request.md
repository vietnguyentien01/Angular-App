---
title: Git và pull request với Claude Code — commit, PR, review trước khi push
summary: Làm git bằng lời một cách an toàn — xem thay đổi, commit có message mô tả rõ, tạo PR qua gh CLI, tự review bằng /code-review và /security-review trước khi đẩy lên, tìm lại phiên theo PR — và những thao tác git mà auto mode chặn theo mặc định.
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, git, pull-request, code-review]
related: [claude-code/consolidate/workflows/bug-test-refactor, claude-code/deep-dive/automation/headless-va-ci]
---

## TL;DR

- Claude biết nhánh hiện tại, thay đổi chưa commit, lịch sử gần đây — nên hỏi/commit/tạo nhánh bằng lời là tự nhiên.
- Cài và đăng nhập **`gh` CLI** → Claude tự mở PR và đọc review comment mà không cần giải thích thêm.
- Trước khi push: **`/code-review`** (bug) và **`/security-review`** (lỗ hổng) — rồi **bạn** review diff.
- Thao tác phá huỷ (force push, `reset --hard`, merge PR chưa duyệt) bị auto mode chặn mặc định — đừng tìm cách lách.

## Git hằng ngày

```text
what files have I changed?
```

```text
Tách thay đổi hiện tại thành 2 commit: một cho refactor đặt tên, một cho fix bug filter. Message theo Conventional Commits.
```

```text
Tạo nhánh fix/order-filter-reload từ main mới nhất.
```

```text
help me resolve merge conflicts — giải thích từng conflict trước khi chọn cách gộp.
```

:::tip Message commit theo quy ước của team
Ghi quy ước (vd Conventional Commits, prefix mã ticket) vào `CLAUDE.md` một dòng — Claude sẽ theo ở mọi phiên.
:::

## Tạo pull request

Cách nhanh: *"create a pr for my changes"*. Hoặc từng bước:

```text
summarize the changes I've made to the orders module
```

```text
create a pr
```

```text
enhance the PR description with more context about the performance impact and how to test
```

Tài liệu khuyên: **review PR Claude tạo trước khi submit** và nhờ Claude nêu rủi ro cần lưu ý.

Tìm lại phiên đã tạo PR: `claude --from-pr 1234` mở danh sách phiên gắn với PR đó.

## Review trước khi push

| Lệnh | Tìm gì |
|---|---|
| `/code-review [low…max]` (alias `/review`) | Bug về tính đúng đắn trong diff hiện tại, hoặc một PR/nhánh; `--fix` áp dụng sửa, `--comment` đăng comment lên PR |
| `/security-review` | Lỗ hổng bảo mật trong diff giữa nhánh của bạn và nhánh mặc định trên origin |
| `/simplify` | Cơ hội dọn code (tái sử dụng, đơn giản hoá) — không săn bug |
| `/diff` | Xem toàn bộ thay đổi trong working tree |

Muốn review **theo spec** thay vì săn bug chung chung, tự viết prompt cho subagent review (xem bài *Cho Claude một phép kiểm tra*).

## Dòng attribution

Claude Code mặc định thêm dòng ghi công (vd `Co-Authored-By`) vào commit và PR. Muốn đổi hoặc bỏ: setting `attribution`; muốn bỏ hẳn hướng dẫn git có sẵn của Claude Code: `includeGitInstructions`. Tuân theo chính sách của công ty/khách hàng về việc ghi công AI.

## Auto mode chặn gì với git?

Theo mặc định, classifier chặn: **force push**; `git reset --hard`, `git checkout -- .`, `git restore .`, `git clean -fd`, `git stash drop/clear`; `git commit --amend` lên commit không tạo trong phiên (hoặc đã push); merge PR chưa ai duyệt; tự approve PR của chính Claude; tắt CI checks.

:::warning Đừng xin "cho phép force push" một cách chung chung
Lời cho phép phải nêu đúng hành động và đối tượng (vd nhánh nào) mới gỡ được chặn, và thường chỉ cho một lần. Nếu bạn thấy mình hay phải gỡ chặn, xem lại quy trình — thường là thiếu bước tạo nhánh riêng.
:::

:::senior Góc nhìn senior
Claude giúp bạn tạo PR nhanh hơn, không làm PR **nhỏ** hơn. Giữ PR nhỏ, một mục đích, có mô tả "vì sao" và "cách test" — đó là thứ người review cần. Người merge cuối cùng là con người, và branch protection là nơi đảm bảo điều đó.
:::

:::quiz Bạn muốn Claude tự tạo PR và đọc review comment trên GitHub. Theo hướng dẫn, cách dễ nhất?
- [ ] Copy URL PR vào prompt mỗi lần
- [x] Cài và đăng nhập `gh` CLI — Claude dùng nó mà không cần giải thích
- [ ] Viết một MCP server riêng
- [ ] Không làm được

Với hệ thống có CLI, cho Claude dùng CLI thường là đường ngắn nhất.
:::

:::quiz Lệnh nào chuyên tìm **lỗ hổng bảo mật** trong thay đổi của nhánh hiện tại?
- [ ] `/simplify`
- [ ] `/diff`
- [x] `/security-review`
- [ ] `/init`

`/code-review` tập trung bug đúng đắn; `/security-review` tập trung lỗ hổng.
:::

:::interview Một đồng nghiệp để Claude tự commit và push thẳng lên `develop`. Bạn góp ý gì?
Đặt quy ước: Claude làm trên **nhánh riêng**, mở PR; `develop`/`main` có branch protection yêu cầu review + CI xanh. Deny rule cho `git push` vào nhánh được bảo vệ (hoặc dựa vào branch protection phía server — chắc chắn hơn). Chạy `/code-review` trước khi mở PR, và người review là con người.
:::

:::exercise Quy trình PR cho một fix nhỏ
Viết chuỗi prompt từ lúc có thay đổi tới lúc mở PR: tách commit, review, tạo PR với mô tả chuẩn.
???
1. *"Xem thay đổi hiện tại, tách thành commit hợp lý theo Conventional Commits."* 2. *"/code-review"* → đọc kết quả, sửa những gì đúng. 3. *"/security-review"* nếu đụng auth/input người dùng. 4. *"Tạo nhánh fix/…, push, tạo PR: mô tả vấn đề, nguyên nhân gốc, cách sửa, cách test thủ công, rủi ro."* 5. Tự đọc diff trên GitHub trước khi request review.
:::

> Nguồn: *Quickstart* — mục "Use Git with Claude Code"; *Common workflows* — mục "Create pull requests"; *Commands*; *Choose a permission mode* — mục "What the classifier blocks by default"; *Best practices* — mục "Connect the tools Claude needs", code.claude.com/docs (truy cập 11/11/2026).
