---
title: "Claude Code 2.1.326–2.1.327: sandbox và quyền chặt hơn, thêm mcp add-json đọc từ stdin"
date: 2026-11-18
summary: "Hai bản 16–17/11/2026 siết an toàn: tool không ghi được file đăng nhập của Claude Code, sandbox không ghi vào thư mục home nhạy cảm, ExitWorktree hỏi trước khi xoá worktree, auto mode bỏ qua thêm rule chạy package tuỳ ý. Mới: claude mcp add-json <tên> - để token không lộ trên dòng lệnh."
importance: medium
category: ai
tags: [claude-code, security, sandbox, permissions, mcp]
relatedTopics: [claude-code/guardrails, claude-code/extending]
sources:
  - title: Claude Code — Changelog (2.1.326, 2.1.327)
    url: https://code.claude.com/docs/en/changelog
---

## Có gì mới

Theo changelog chính thức, hai bản phát hành liên tiếp tập trung vào **an toàn và quyền**.

**2.1.326 (16/11/2026)**
- File tool của Claude **từ chối ghi** vào file đăng nhập của Claude Code (vd `.credentials.json`); kiểm tra quyền Bash **hỏi trước** với nhiều lệnh chạm tới các file này hơn.
- Lệnh trong sandbox trên macOS, Linux, WSL **không còn ghi** vào một số thư mục home nhạy cảm theo mặc định; có thể cho phép lại bằng `sandbox.filesystem.allowWrite` trong user hoặc managed settings.
- Sau mỗi lệnh, sandbox **cất riêng** những mục lạ xuất hiện trong thư mục `.git`.
- Hook trả `"decision": "block"` giữ hiệu lực trong nhiều trường hợp hơn. Hook nào luôn in `block` có thể bắt đầu **chặn thật**.
- Phiên terminal và VS Code chưa đặt mode sẽ khởi động ở **auto mode** khi chính sách tổ chức chưa tải xong.

**2.1.327 (17/11/2026)**
- **Mới:** `claude mcp add-json <tên> -` đọc JSON cấu hình server từ **stdin**, để token không nằm trên dòng lệnh (và không vào lịch sử shell).
- `ExitWorktree` **hỏi trước** khi xoá worktree có thể còn việc chưa lưu.
- Auto mode **bỏ qua thêm** các allow rule chạy package tuỳ ý (vd `Bash(pnpm dlx *)`); bộ kiểm tra an toàn tự quyết những lệnh đó. Thông báo về việc fallback sang classifier tính phí giờ nói rõ: một bản sắp tới sẽ **bỏ fallback này**.
- `permissions.blockReadsOutsideWorkingDirectories` hỏi hoặc chặn thêm nhiều lệnh Bash đọc ngoài thư mục làm việc.
- Commit trên model mới: Claude được dặn **không commit file có khả năng chứa secret**.

## Vì sao quan trọng

- **Xu hướng rõ ràng:** công cụ agent đang chuyển từ "tin mặc định" sang "**từ chối mặc định cho vùng nhạy cảm**": file đăng nhập, `.git`, thư mục home, secret. Đây đúng là các guardrail mà môn [AI Agents cho người mới](/ai-agents/course/nang-cao/bao-mat-ai-agent) và bài [Sandbox và prompt injection](/claude-code/deep-dive/guardrails/sandbox-va-prompt-injection) bàn tới.
- **Có thể làm hỏng script cũ:** hook luôn trả `block`, allow rule kiểu `pnpm dlx *`, hay lệnh ghi vào thư mục home trong sandbox có thể bắt đầu bị hỏi hoặc bị chặn.

## Ví dụ

```bash
# Trước: token nằm trên dòng lệnh và trong lịch sử shell
claude mcp add-json github '{"type":"http","url":"https://api.githubcopilot.com/mcp/","headers":{"Authorization":"Bearer ghp_xxx"}}'

# Sau (2.1.327): đọc JSON từ stdin, vd từ file chỉ bạn đọc được
claude mcp add-json github - < ~/.config/mcp/github.json
```

```json title="~/.claude/settings.json — cho sandbox ghi lại vào một thư mục cụ thể nếu thật sự cần"
{
  "sandbox": {
    "filesystem": { "allowWrite": ["~/.cache/my-tool"] }
  }
}
```

## Việc nên làm

- **Áp dụng ngay:** `claude update`; chuyển cấu hình MCP có token sang `mcp add-json <tên> -`.
- **Kiểm tra:** hook luôn trả `"decision": "block"` và các allow rule chạy package tuỳ ý trong `.claude/settings.json` của dự án; chạy `/status` để xem file cấu hình hỏng và hook matcher không bao giờ khớp (mục mới của 2.1.327).
- **Theo dõi:** bản sắp tới bỏ fallback classifier tính phí của auto mode. Khi đó, hành động không kiểm tra được sẽ bị hỏi hoặc từ chối.

:::quiz Lệnh nào giúp thêm MCP server mà token không xuất hiện trên dòng lệnh (từ Claude Code 2.1.327)?
- [ ] `claude mcp add --token-file`
- [x] `claude mcp add-json <tên> -`, đọc JSON cấu hình từ stdin
- [ ] `claude mcp serve --secret`
- [ ] Không có cách nào

Dấu `-` cho biết đọc JSON từ stdin; theo changelog, lệnh này không dùng được bên trong một phiên Claude Code.
:::
