---
title: Bảo mật và quy định team khi dùng Claude Code trong dự án enterprise
summary: Chuyển quy định của team (bắt buộc test, code review, không chạm secret) thành cấu hình đúng tầng; managed settings cho chính sách tổ chức; và những thói quen bảo vệ dữ liệu khách hàng.
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, security, team, enterprise]
related: [claude-code/consolidate/guardrails/hook-permission-sandbox, claude-code/deep-dive/automation/chay-khong-can-giam-sat]
---

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

## Thói quen bảo vệ dữ liệu (khuyến nghị)

> Phần dưới là khuyến nghị thực hành chung cho dự án chính phủ/ngân hàng/bảo hiểm, không phải trích dẫn từ tài liệu Anthropic.

- Tuân thủ chính sách dùng AI của công ty và khách hàng **trước** khi dùng trên code dự án.
- Không dán dữ liệu thật của người dân/khách hàng vào prompt; dùng dữ liệu đã ẩn danh hoặc fixture giả.
- Secret không nằm trong repo; nếu buộc phải có file nhạy cảm cục bộ, chặn bằng deny rule + sandbox.
- Kết quả của AI đi qua **cùng** quy trình như code người viết: review, test, CI, branch protection.

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

> Nguồn: *Best practices for Claude Code* — mục "Choose who a rule applies to" và bảng chỉ dẫn mềm/bắt buộc, code.claude.com/docs (truy cập 11/11/2026). Phần thói quen bảo vệ dữ liệu là khuyến nghị của Learning Hub.
