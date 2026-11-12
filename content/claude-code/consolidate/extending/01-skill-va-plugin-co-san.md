---
title: Skill và plugin có sẵn nên dùng ngay — /simplify, /verify, /loop, /batch, /debug, typescript-lsp, security-guidance…
summary: "Trước khi tự viết, dùng đồ Anthropic làm sẵn: skill đi kèm (review, dọn code, chạy và xác minh app, lặp, thay đổi hàng loạt, chẩn đoán) và plugin chính thức (typescript-lsp, commit-commands, security-guidance, claude-security) — cách cài, khi nào dùng, chi phí context."
type: lesson
level: intermediate
lastReviewed: 2026-11-12
tags: [claude-code, skills, plugins, typescript-lsp, bundled-skills]
related: [claude-code/review/extending/ban-do-mo-rong, claude-code/deep-dive/extending/viet-skill]
---

## TL;DR

- **Bundled skill** là prompt có sẵn được giao cho Claude — gọi bằng `/ten`, nhiều cái Claude cũng tự gọi khi phù hợp.
- Plugin đáng cài sớm nhất cho dev Angular: **`typescript-lsp`** (Claude thấy lỗi type ngay sau khi sửa, tìm định nghĩa theo ký hiệu).
- Mỗi plugin bật là một phần của mọi phiên — cài cái bạn dùng, tắt cái không dùng.

## Skill có sẵn theo việc

| Việc | Skill | Gợi ý dùng |
|---|---|---|
| Tìm bug trong thay đổi | `/code-review` | Trước mỗi push; `--fix` khi đã đọc kết quả |
| Dọn code vừa viết | `/simplify` | Sau khi tính năng chạy, trước PR |
| Xác minh bằng app thật | `/verify`, `/run` | Thay đổi UI hoặc tích hợp |
| Dạy cách chạy dự án | `/run-skill-generator` | Một lần cho mỗi dự án có setup phức tạp |
| Lặp một việc định kỳ | `/loop 5m …` | Theo dõi CI, deploy, PR |
| Thay đổi cơ học lớn | `/batch …` | Migration nhiều file, chia worktree/PR |
| Chẩn đoán sự cố Claude Code | `/debug …`, `/doctor` | Hook không chạy, MCP lỗi, cấu hình sai |
| Sửa settings bằng lời | `/update-config …` | Thêm permission, env, hook |
| Bớt hộp thoại xin quyền | `/fewer-permission-prompts` | Sau vài ngày dùng — đọc kỹ danh sách đề xuất |
| Làm việc với Claude API | `/claude-api` | Dự án dùng SDK của Anthropic |
| Thiết kế biểu đồ | `/dataviz` | Dashboard, chart |
| Nghiên cứu nhiều nguồn | `/deep-research …` | So sánh thư viện, tìm hiểu chủ đề mới |

Xem đủ trong `/skills` (lọc, sắp theo token) và phần **Tra cứu lệnh**.

### Ví dụ: một vòng làm tính năng chỉ bằng skill có sẵn

```text
/plan Thêm bộ lọc theo khoảng ngày cho trang Orders, giữ nguyên API.
```

```text
(sau khi làm xong) /simplify
```

```text
/verify
```

```text
/code-review high
```

## Plugin chính thức nên biết

Marketplace chính thức `claude-plugins-official` được thêm sẵn lần đầu bạn mở phiên tương tác.

### `typescript-lsp` — code intelligence

```bash
npm install -g typescript-language-server typescript
which typescript-language-server     # phải có trên PATH của shell mở claude
```

```text
/plugin install typescript-lsp@claude-plugins-official
```

Kiểm tra: nhờ Claude cố ý tạo một lỗi type rồi sửa — dưới lần sửa phải có dòng `Found N new diagnostic issues…`. Không thấy → `/plugin` → tab **Errors** (thường là `Executable not found in $PATH`). Lưu ý: không chạy trong cloud session.

### `commit-commands` — lệnh git dựng sẵn

```text
/plugin install commit-commands@claude-plugins-official
```

Ví dụ plugin dùng trong tài liệu cài đặt: thêm các lệnh liên quan commit. Xem nó thêm gì bằng `claude plugin details commit-commands`.

### `security-guidance` và `claude-security`

```text
/plugin install security-guidance@claude-plugins-official
/plugin install claude-security@claude-plugins-official
```

Một cái tự soát lỗi bảo mật trong khi Claude viết code; một cái quét lỗ hổng chuyên sâu theo yêu cầu (`/claude-security`) — xem bài *Review và bảo mật ở quy mô team*.

## Chi phí và dọn dẹp

| Kiểm tra | Cách |
|---|---|
| Plugin thêm gì vào phiên | `claude plugin details <ten>` |
| Ước tính context trước khi cài | Tab **Marketplaces** trong `/plugin` (plugin chính thức có *Context cost*) |
| Cái nào lâu không dùng | Tab **Installed** → nhóm *Not used recently* |
| Skill nào tốn mà ít dùng | `/skill-doctor` |
| Tắt mà không gỡ | `/plugin` hoặc `claude plugin disable <ten>` |

:::senior Góc nhìn senior
Trước khi viết skill/plugin cho team, kiểm tra cái có sẵn: `/simplify` + `/code-review` + `/verify` đã bao phủ phần lớn "quy trình trước PR" mà nhiều team tự viết lại. Tập trung công sức tự viết vào phần **riêng** của dự án bạn (quy ước domain, công thức chạy app, checklist bảo mật của khách hàng).
:::

:::interview Trước khi tự viết skill cho team, bạn kiểm tra gì?
Xem skill có sẵn (`/simplify`, `/code-review`, `/verify`, `/batch`, `/loop`…) và plugin chính thức đã bao phủ chưa; đo chi phí bằng `/plugin` (Context cost), `/skill-doctor`. Chỉ viết phần riêng của dự án: quy ước domain, công thức chạy app, checklist của khách hàng.
:::

:::quiz Bạn cài `typescript-lsp` nhưng không thấy dòng diagnostics sau khi Claude sửa file `.ts`. Kiểm tra gì đầu tiên?
- [ ] Đổi model
- [x] `typescript-language-server` có trên `PATH` của shell mở `claude` không — xem `/plugin` → tab Errors
- [ ] Xoá CLAUDE.md
- [ ] Bật fast mode

Plugin chỉ khai báo cách khởi động server; binary phải được cài riêng.
:::

:::quiz Skill có sẵn nào **không** săn bug mà tập trung dọn code (tái sử dụng, đơn giản hoá, hiệu năng)?
- [ ] `/code-review`
- [x] `/simplify`
- [ ] `/security-review`
- [ ] `/verify`

Dùng `/code-review` để tìm bug.
:::

:::exercise Một buổi "dùng đồ có sẵn"
Trong cc-lab: (1) cài `typescript-lsp` và xác nhận có dòng diagnostics; (2) làm một thay đổi nhỏ rồi chạy lần lượt `/simplify`, `/code-review`, `/verify`; (3) `/fewer-permission-prompts` và đọc đề xuất, chỉ chấp nhận lệnh chỉ-đọc; (4) `/skill-doctor` (nếu có) và `/plugin` tab Installed. Ghi lại skill nào bạn sẽ dùng hằng ngày.
???
Kỳ vọng: với `typescript-lsp`, khi Claude cố ý viết `const x: number = 'a'` sẽ có dòng `Found 1 new diagnostic issue…` và Claude tự sửa. `/simplify` thường đề xuất dùng lại helper có sẵn (vd `isOverdue`) thay vì viết lại logic; `/verify` chạy `ng serve` và kiểm tra trang. Ở bước (3), từ chối mọi đề xuất có tác dụng ghi hoặc ra mạng (vd `npm install`, `git push`).
:::

> Nguồn: *Extend Claude with skills* — "Bundled skills"; *Commands*; *Code intelligence plugins*; *Install and manage plugins*; *Plugins overview* — code.claude.com/docs (truy cập 12/11/2026).
