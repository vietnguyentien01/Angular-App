---
title: "Lab 09 — Git và pull request trên GitHub: nhánh, commit tách nhỏ, review, PR, @claude"
summary: "Đưa cc-lab lên một repo GitHub riêng tư, làm một thay đổi trên nhánh mới, để Claude tách commit theo Conventional Commits, chạy /code-review và /security-review, tạo PR bằng gh với mô tả chuẩn, tìm lại phiên bằng --from-pr, rồi (tuỳ chọn) cài GitHub App để @claude trả lời trong PR."
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, lab, git, pull-request, github]
related: [claude-code/consolidate/workflows/git-va-pull-request, claude-code/labs/labs/headless-va-ci]
---

## Mục tiêu

Một PR **nhỏ, một mục đích, có mô tả "vì sao" và "cách test"** — Claude làm phần cơ học, bạn giữ quyết định.

**Thời gian:** 45–60 phút · **Cần:** tài khoản GitHub, [GitHub CLI](https://cli.github.com) đã `gh auth login`.

## Bước 1 — Đưa cc-lab lên GitHub (riêng tư)

```bash
cd cc-lab
gh repo create cc-lab --private --source . --push
```

Bật branch protection cho `main` trên GitHub (Settings → Branches): bắt buộc PR trước khi merge. Đây là hàng rào **phía server** — không phụ thuộc Claude có "nhớ" hay không.

## Bước 2 — Làm thay đổi trên nhánh mới

```bash
claude -n "lab09-sort"
```

```text
Tạo nhánh feat/sort-by-due từ main. Sau đó:
1. Thêm lựa chọn sắp xếp theo hạn chót (tăng dần/giảm dần) vào TaskStore và TaskList, có label cho select.
2. Đổi tên biến `list` thành `current` trong TaskStore.toggleDone cho dễ đọc.
3. Có test cho sắp xếp. Chạy npm test -- --watch=false.
```

## Bước 3 — Tách commit

```text
Xem thay đổi hiện tại và tách thành các commit theo Conventional Commits: một commit refactor (đổi tên biến), một commit feat (sắp xếp + test). Cho mình xem danh sách commit dự kiến trước khi commit.
```

Kiểm tra: `git log --oneline main..HEAD` có đúng 2 commit, mỗi commit một mục đích.

## Bước 4 — Review trước khi push

```text
/code-review
```

```text
/security-review
```

Với mỗi phát hiện: đồng ý → nhờ sửa (commit riêng `fix:`); không đồng ý → ghi lý do. `/security-review` cần remote `origin` (đã có từ Bước 1).

## Bước 5 — Tạo PR

```text
Push nhánh và tạo PR bằng gh. Mô tả PR gồm: Vấn đề, Thay đổi, Cách test thủ công (các bước trên trình duyệt), Rủi ro. Viết tiếng Việt.
```

Mở PR trên GitHub, **tự đọc diff** như một reviewer. Nhờ Claude nêu rủi ro:

```text
Đóng vai reviewer khó tính: 3 câu hỏi bạn sẽ hỏi tác giả PR này là gì?
```

## Bước 6 — Tìm lại phiên theo PR

Thoát Claude, rồi:

```bash
claude --from-pr <số-PR>
```

Phiên tạo PR hiện trong danh sách. Hỏi tiếp: *"Thêm mục Screenshots vào mô tả PR."*

## Bước 7 (tuỳ chọn) — `@claude` ngay trong PR

```text
/install-github-app
```

Làm theo hướng dẫn: cài GitHub App, chọn workflow, lưu secret. Merge PR chứa workflow mà lệnh mở. Sau đó comment trong PR của bạn:

```text
@claude giải thích ngắn thay đổi trong task-store.ts và đề xuất thêm một test biên
```

Xem tab **Actions** để thấy workflow chạy; Claude trả lời bằng comment.

## Checklist hoàn thành

- [ ] `main` có branch protection
- [ ] PR có đúng 2–3 commit theo Conventional Commits, mỗi commit một mục đích
- [ ] Đã chạy `/code-review` và `/security-review`, ghi lại phát hiện đúng/sai
- [ ] Mô tả PR có đủ 4 mục; bạn tự đọc diff trước khi merge
- [ ] Mở lại được phiên bằng `claude --from-pr`

:::quiz Vì sao bật branch protection cho `main` dù đã dặn Claude "đừng push main"?
- [ ] Để GitHub chạy nhanh hơn
- [x] Lời dặn là chỉ dẫn mềm và có thể mất sau compact; branch protection là hàng rào phía server không ai/agent nào vượt qua được nếu không có quyền
- [ ] Vì Claude không đọc được lời dặn
- [ ] Không cần thiết

Quy tắc không có ngoại lệ → cơ chế cứng.
:::

:::exercise Thử thách mở rộng — review comment thành commit
Nhờ một người khác (hoặc chính bạn bằng tài khoản thứ hai) để lại 2 review comment trên PR. Trong Claude: *"Đọc các review comment của PR này bằng gh, đề xuất cách xử lý từng cái, chưa sửa."* Duyệt đề xuất rồi cho sửa, push, và trả lời từng comment.
???
Lệnh Claude thường dùng: `gh pr view <số> --comments` hoặc `gh api repos/<owner>/cc-lab/pulls/<số>/comments`. Quy trình tốt: mỗi comment → một commit `fix:` nhỏ hoặc một câu trả lời giải thích vì sao không đổi; không gộp sửa không liên quan. Đừng để Claude tự "resolve" comment thay bạn — người review quyết định.
:::

> Nguồn: *Common workflows* — "Create pull requests"; *Manage sessions* — `--from-pr`; *Claude Code GitHub Actions* — code.claude.com/docs (truy cập 11/11/2026).
