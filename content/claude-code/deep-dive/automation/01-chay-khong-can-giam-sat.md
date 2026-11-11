---
title: Để Claude chạy một mình — năm câu hỏi, headless, scheduled task, worktree
summary: Trước khi để Claude chạy không giám sát phải biết thế nào là xong, cách tự kiểm tra, được đụng vào đâu, điều gì dừng nó và ai duyệt kết quả; kèm case study phiên cập nhật tự động của chính Learning Hub.
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, automation, headless, scheduled-tasks, worktrees, case-study]
related: [claude-code/deep-dive/automation/bao-mat-va-quy-dinh-team, claude-code/consolidate/verification/cho-claude-phep-kiem-tra]
---

## Năm câu hỏi trước khi rời đi

1. **Nó có biết thế nào là xong?** Goal, file spec, hoặc test fail cần chuyển sang xanh.
2. **Nó tự kiểm tra được không?** Bộ test, `Stop` hook, bước review.
3. **Nó được đụng vào đâu?** Permission rule, `dontAsk`, sandbox, worktree, đúng một nhánh được push.
4. **Điều gì dừng nó?** `--max-turns`, `--max-budget-usd`, giới hạn chi tiêu.
5. **Kết quả đi đâu, ai duyệt?** PR, comment, tóm tắt — và một **người** duyệt merge/deploy.

## Chạy từ script

```bash
for file in $(cat files.txt); do
  claude --bare -p "Chuyển $file sang AppError mới và commit. Trả lời OK hoặc FAIL." \
    --allowedTools "Read,Edit,Bash(git add *),Bash(git commit *)" \
    --permission-mode dontAsk \
    --max-turns 20
done
```

- `--bare`: bỏ qua hook, skill, plugin, MCP và mọi `CLAUDE.md` → chạy giống nhau ở mọi máy (xác thực bằng `ANTHROPIC_API_KEY` hoặc cấu hình truyền vào).
- `--permission-mode dontAsk` + `--allowedTools`: chỉ được làm đúng những gì đã cho phép.
- Thử với 3 file trước, sửa prompt, rồi mới chạy hết.

## Theo lịch và song song

- `/loop 15m …` lặp một prompt trong phiên đang mở; `/schedule` tạo **cloud scheduled task** chạy cả khi máy bạn tắt.
- Trước khi để scheduled task chạy dài hạn: **bảo vệ nhánh `main` bằng branch rule mà task không vượt qua được**, và theo dõi vài lần chạy đầu.
- Song song: `claude -w <tên>` chạy trong worktree riêng; `.worktreeinclude` liệt kê file gitignore cần chép sang (vd `.env`); `/batch` chia một thay đổi cơ học lớn thành nhiều phần, mỗi phần một worktree và một PR.

## Case study: phiên cập nhật bản tin của Learning Hub

App này có một scheduled task chạy mỗi 2 ngày để viết bản tin "Frontend mới". Đối chiếu với năm câu hỏi:

| Câu hỏi | Hiện tại | Đánh giá |
|---|---|---|
| Thế nào là xong | Tối đa 3 bản tin theo `CONTENT_GUIDE.md`, hoặc không có gì đáng kể thì không tạo file | ✓ rõ ràng |
| Tự kiểm tra | `content:check`, test, build phải pass mới push; kiểm tra workflow deploy | ✓ |
| Được đụng vào đâu | Môi trường riêng chỉ mở các trang nguồn chính thống; chỉ push `main` | Hợp lý |
| Điều gì dừng | Giới hạn của phiên/scheduled task | Có thể thêm giới hạn rõ hơn |
| Ai duyệt | **Push thẳng `main` không qua người duyệt** (bạn đã chọn để tiện cho app cá nhân) | ⚠ Khác khuyến nghị — chấp nhận được vì CI chặn nội dung sai định dạng, nhưng nội dung sai về **sự thật** vẫn có thể lọt |

Nếu muốn theo sát khuyến nghị hơn: để phiên tự động mở **PR** thay vì push `main`, bạn duyệt trên điện thoại rồi merge — đổi lấy một thao tác bấm mỗi 2 ngày.

:::quiz Theo hướng dẫn, việc gì nên làm trước khi để một cloud scheduled task chạy lâu dài?
- [ ] Tắt CI để chạy nhanh hơn
- [x] Bảo vệ nhánh `main` bằng branch rule task không vượt qua được, và theo dõi vài lần chạy đầu
- [ ] Cho task quyền `bypassPermissions`
- [ ] Xoá `CLAUDE.md`

Người duyệt cuối cùng cho những gì không thể hoàn tác là con người.
:::

:::quiz `claude --bare -p "…"` bỏ qua những gì?
- [ ] Chỉ bỏ qua CLAUDE.md
- [x] Hook, skill, plugin, MCP server và mọi file CLAUDE.md — để lần chạy giống nhau ở mọi nơi
- [ ] Bỏ qua permission
- [ ] Bỏ qua model

Truyền rõ những gì lần chạy cần bằng `--append-system-prompt`, `--mcp-config`, `--settings`.
:::

:::exercise Thiết kế một job tự động cho dự án
Bạn muốn mỗi đêm Claude chạy lint + test trên nhánh `develop`, nếu có lỗi dễ sửa (format, import thừa) thì tự sửa và mở PR. Trả lời năm câu hỏi cho job này.
???
1. Xong khi: lint và unit test pass, hoặc báo cáo "không tự sửa được" kèm danh sách lỗi.
2. Tự kiểm tra: chạy lại lint + test sau khi sửa; chỉ mở PR khi pass.
3. Được đụng: chỉ file có lỗi lint; tạo nhánh `bot/nightly-fix-<ngày>`; `--allowedTools` giới hạn lệnh git/npm cần thiết; không push `develop`/`main`.
4. Dừng: `--max-turns`, `--max-budget-usd`, timeout của CI.
5. Kết quả: một PR gắn nhãn `bot`, cần một người review; branch protection trên `develop` bắt buộc review và CI xanh.
:::

> Nguồn: *Best practices for Claude Code* — mục "Let Claude run without you", code.claude.com/docs (truy cập 11/11/2026). Case study là cấu hình thật của Learning Hub.
