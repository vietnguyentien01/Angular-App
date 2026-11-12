---
title: Bảo mật và quy định team khi dùng Claude Code trong dự án enterprise
summary: Chuyển quy định của team (bắt buộc test, code review, không chạm secret) thành cấu hình đúng tầng; managed settings cho chính sách tổ chức; và những thói quen bảo vệ dữ liệu khách hàng.
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, security, team, enterprise]
related: [claude-code/consolidate/guardrails/hook-permission-sandbox, claude-code/deep-dive/automation/chay-khong-can-giam-sat]
---

## TL;DR

- Mỗi quy định của team ánh xạ tới đúng cơ chế: mềm → CLAUDE.md/rules; cứng → hook, deny, sandbox, CI, branch protection.
- Ba tầng cấu hình: cá nhân, repo, **managed settings** của tổ chức (không ai ghi đè được).
- Bảo vệ dữ liệu khách hàng: chính sách AI của khách, không dán dữ liệu thật, secret ngoài repo, mọi thay đổi qua cùng quy trình review.

## Ánh xạ quy định → cơ chế

| Quy định team | Mềm hay cứng? | Đặt ở |
|---|---|---|
| Bắt buộc test pass trước khi xong | Cứng | `Stop` hook + CI |
| Mọi thay đổi phải qua code review | Cứng | Branch protection (người duyệt merge) |
| Không đọc file secret / cấu hình production | Cứng, bảo mật | `deny` rule + sandbox; chính sách tổ chức → managed settings |
| Format code | Cứng nhưng vô hại | `PostToolUse` hook |
| Kiểm tra regression trước khi lên production | Cứng | CI (E2E/regression suite) — không dựa vào lời hứa của AI |
| Ưu tiên pattern facade, Signal Forms | Mềm | `CLAUDE.md` / `.claude/rules/` |

Nguyên tắc từ hướng dẫn: **giữ tập quy tắc cứng nhỏ**. Mỗi hook/deny rule thỉnh thoảng sẽ chặn nhầm và cần người bảo trì — có tới bốn mươi cái thì phần lớn là sở thích lẽ ra để Claude tự cân nhắc.

## Ba tầng cấu hình

- **Cá nhân** (`~/.claude/settings.json`, `.claude/settings.local.json`).
- **Repo** (`.claude/settings.json` commit vào repo — áp cho mọi người; deny rule có hiệu lực ngay, allow rule và hook chờ mỗi người chấp nhận hộp thoại tin cậy thư mục).
- **Tổ chức** (managed settings từ admin console/MDM — không file cá nhân nào ghi đè được). Đây là nơi duy nhất phù hợp cho chính sách của security team.

## Managed settings mẫu cho tổ chức

File cùng dạng `settings.json`, đặt ở thư mục hệ thống trên mỗi máy (hoặc phân phối qua MDM / server-managed settings từ admin console):

- macOS: `/Library/Application Support/ClaudeCode/managed-settings.json`
- Linux, WSL: `/etc/claude-code/managed-settings.json`
- Windows: `C:\Program Files\ClaudeCode\managed-settings.json`

```json title="managed-settings.json (theo ví dụ trong tài liệu chính thức)"
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./secrets/**)"
    ],
    "disableBypassPermissionsMode": "disable"
  },
  "allowManagedPermissionRulesOnly": true
}
```

- `disableBypassPermissionsMode: "disable"`: không ai bật được `bypassPermissions` (tương tự `disableAutoMode` cho auto mode).
- `allowManagedPermissionRulesOnly: true`: bỏ qua permission rule từ file user/project/local và `--allowedTools` — chỉ rule của tổ chức có hiệu lực. Mạnh nhưng làm mất tính linh hoạt của team; cân nhắc trước khi bật.
- Kiểm tra trên máy dev: `/status` → dòng *Setting sources* phải hiện nguồn managed.

## Onboarding một dev mới vào dự án có quy định

1. Cài Claude Code, đăng nhập bằng tài khoản **của tổ chức**; `/status` xác nhận managed settings đã áp dụng.
2. Clone repo → tin cậy thư mục → `/permissions` để xem rule của team; `/hooks` xem hook.
3. Đọc `CLAUDE.md`, `.claude/rules/`, `REVIEW.md` (nếu có).
4. Làm một task nhỏ theo quy trình của team (plan → test-first → `/code-review` → PR).
5. Biết đường báo sự cố: rule chặn nhầm, hook lỗi → báo người sở hữu cấu hình, **không** tự vô hiệu hoá.

Xem thêm bài *Dữ liệu đi đâu?* cho phần quyền riêng tư và telemetry, và *Review và bảo mật ở quy mô team* cho các lớp review.

## Thói quen bảo vệ dữ liệu (khuyến nghị)

> Phần dưới là khuyến nghị thực hành chung cho dự án chính phủ/ngân hàng/bảo hiểm, không phải trích dẫn từ tài liệu Anthropic.

- Tuân thủ chính sách dùng AI của công ty và khách hàng **trước** khi dùng trên code dự án.
- Không dán dữ liệu thật của người dân/khách hàng vào prompt; dùng dữ liệu đã ẩn danh hoặc fixture giả.
- Secret không nằm trong repo; nếu buộc phải có file nhạy cảm cục bộ, chặn bằng deny rule + sandbox.
- Kết quả của AI đi qua **cùng** quy trình như code người viết: review, test, CI, branch protection.

:::senior Góc nhìn senior
Chính sách tốt là chính sách **được dùng**. Trước khi khoá chặt bằng managed settings, chạy thử một tháng ở chế độ khuyến nghị (settings repo + hướng dẫn), thu thập chỗ chặn nhầm, rồi mới khoá phần đã chứng minh cần thiết. Khoá quá sớm khiến dev quay về công cụ không kiểm soát được.
:::

:::quiz Security team muốn cấm Claude đọc thư mục `secrets/` trên mọi máy của công ty, không ai tắt được. Đặt ở đâu?
- [ ] `CLAUDE.md` của từng repo
- [ ] `~/.claude/settings.json` của từng người
- [x] Managed settings của tổ chức
- [ ] Một skill

Chỉ managed settings mới không bị file cá nhân ghi đè.
:::

:::quiz Quy định "mọi thay đổi phải qua code review" nên được bảo đảm bằng gì?
- [ ] Một dòng trong `CLAUDE.md`
- [ ] Hook `PostToolUse`
- [x] Branch protection yêu cầu người duyệt trước khi merge
- [ ] Auto mode

Bước "ai có tiếng nói cuối" thuộc về người duyệt — không phải bản tóm tắt của Claude.
:::

:::exercise Biến quy định team thành cấu hình
Lấy 5 quy định thật của team bạn (hoặc dùng: test phải xanh; không đọc secret; mọi thay đổi qua review; format chuẩn; ưu tiên Signal Forms). Với mỗi quy định: mềm hay cứng, đặt ở đâu (CLAUDE.md, rule, hook, permission, branch protection, managed settings), và viết cấu hình cụ thể cho cc-lab.
???
Test xanh → Stop hook (Lab 06) + CI; không đọc secret → deny `Read(./.env*)` + sandbox `credentials` (Lab 05), chính sách công ty → managed settings; qua review → branch protection trên GitHub (Lab 09); format → PostToolUse Prettier (Lab 06); Signal Forms → một dòng trong `.claude/rules/forms.md` có `paths`. Kiểm tra mỗi cái bằng một lần thử vi phạm có chủ đích.
:::

> Nguồn: *Best practices for Claude Code* — mục "Choose who a rule applies to" và bảng chỉ dẫn mềm/bắt buộc; *Deploy managed settings* — code.claude.com/docs/en/managed-settings (truy cập 12/11/2026). Phần thói quen bảo vệ dữ liệu là khuyến nghị của Learning Hub.
