---
title: Permission mode — Claude được làm gì mà không hỏi bạn?
summary: Sáu chế độ Manual, acceptEdits, plan, auto, dontAsk, bypassPermissions; cách đổi bằng Shift+Tab; ý nghĩa từng lựa chọn trong hộp thoại xin quyền; auto mode chặn gì theo mặc định; và những hành động không chế độ nào tự duyệt.
type: lesson
level: core
lastReviewed: 2026-11-11
tags: [claude-code, beginner, permissions, plan-mode, auto-mode]
related: [claude-code/consolidate/guardrails/settings-va-permission-rule, claude-code/consolidate/guardrails/hook-permission-sandbox]
---

## TL;DR

- **Permission mode** đặt mức "tự chủ" của cả phiên; `Shift+Tab` để xoay vòng.
- Người mới nên dùng **Manual** hoặc **plan** với repo quan trọng; **auto** cho việc bạn tin hướng đi chung; **bypassPermissions** chỉ trong container/VM cô lập.
- Rule **deny** chặn ở mọi chế độ, kể cả `bypassPermissions`. Chỉ dẫn trong prompt hay `CLAUDE.md` **không** thay đổi được quyền — quyền do Claude Code thực thi, không phải do model.

## Sáu chế độ

| Chế độ | Chạy không cần hỏi | Hợp với |
|---|---|---|
| `default` (hiển thị là **Manual**) | Chỉ đọc | Tự duyệt từng hành động, việc nhạy cảm, code lạ |
| `acceptEdits` | Đọc, sửa file, lệnh filesystem thông dụng (`mkdir`, `touch`, `mv`, `cp`…) | Lặp nhanh trên code bạn đang review |
| `plan` | Đọc (+ lệnh được classifier duyệt nếu có auto mode) — **không sửa source** | Khám phá codebase, lên kế hoạch trước khi sửa |
| `auto` | Mọi thứ, có **classifier** kiểm tra an toàn ở nền | Task dài, giảm "mỏi tay bấm Yes" |
| `dontAsk` | Chỉ file đọc trong thư mục làm việc và công cụ đã được allow; mọi thứ khác **bị từ chối** | Script/CI với allowlist chính xác |
| `bypassPermissions` | Mọi thứ | **Chỉ** container và VM cô lập |

Từ phiên bản gần đây, **auto** là chế độ khởi đầu mặc định của phiên tương tác trong terminal và VS Code (khi tài khoản và model hỗ trợ; không thì về Manual). `claude -p` mặc định là `default`.

## Đổi chế độ

- Trong phiên: `Shift+Tab`. Từ `auto`, lần nhấn đầu sang `default`, rồi `default` → `acceptEdits` → `plan` → …; thanh trạng thái hiển thị chế độ hiện tại (vd `⏸ manual mode on`).
- Khi khởi động: `claude --permission-mode plan`.
- Mặc định cho dự án/cá nhân: `permissions.defaultMode` trong file settings.
- Một prompt duy nhất ở plan mode: bắt đầu bằng `/plan`.

## Hộp thoại xin quyền (Manual)

Khi Claude muốn chạy `npm test`, bạn thấy mô tả, lệnh, và các lựa chọn:

- **Yes** — cho phép một lần.
- **Yes, and don't ask again** — với Bash và WebFetch domain: lưu **vĩnh viễn** thành rule `allow` trong `.claude/settings.local.json` ở gốc repo (file cá nhân, không commit). Với sửa file: chỉ tới hết phiên.
- **No** — từ chối; nhấn `Tab` trên lựa chọn để kèm **ghi chú** (vd "đừng chạy e2e, chỉ unit test") — Claude nhận ghi chú làm lý do và làm tiếp. Chọn No không ghi chú ở hội thoại chính sẽ dừng lượt.

| Loại công cụ | Manual có hỏi? | "Don't ask again" |
|---|---|---|
| Đọc file, Grep | Không (trong thư mục làm việc) | — |
| Lệnh Bash | Có, trừ một tập lệnh chỉ-đọc có sẵn | Vĩnh viễn theo repo + lệnh |
| Sửa/ghi file | Có | Tới hết phiên |
| WebFetch | Có, trừ một số domain tài liệu được duyệt sẵn | Vĩnh viễn theo repo + domain |

## Plan mode: nghĩ trước, sửa sau

Claude đọc file, chạy lệnh để khám phá, viết kế hoạch — **không sửa source**. Khi kế hoạch xong, bạn chọn:

- **Yes, and use auto mode** (hoặc *Yes, auto-accept edits* nếu không có auto mode) — duyệt và bắt đầu làm.
- **Yes, manually approve edits** — duyệt, nhưng từng lần sửa vẫn hỏi.
- **No, keep planning** — góp ý để Claude sửa kế hoạch.

`Ctrl+G` mở kế hoạch trong editor để bạn sửa trực tiếp trước khi duyệt.

## Auto mode chặn gì theo mặc định?

Một model riêng (classifier) xem từng hành động trước khi chạy, chặn những gì vượt quá yêu cầu, nhắm vào hạ tầng lạ, hoặc có vẻ bị điều khiển bởi nội dung độc hại Claude vừa đọc. Mặc định bị chặn, ví dụ:

- Tải và chạy code (`curl | bash`), gửi dữ liệu nhạy cảm ra ngoài
- Deploy/migration production, `terraform destroy`, sửa DNS, ghi vào secret manager
- **Force push**, `git reset --hard`, `git clean -fd`, `git checkout -- .`
- Merge PR chưa ai duyệt, tự approve PR của chính Claude, tắt CI
- In credential/token ra transcript hoặc file

:::tip Ranh giới bạn nói trong hội thoại
Nói "đừng push" hay "đợi mình review rồi mới deploy" → classifier coi đó là tín hiệu chặn. Nhưng ranh giới này **không** được lưu như rule và có thể mất sau khi compact — cần đảm bảo cứng thì dùng rule `deny`.
:::

Classifier chặn 3 lần liên tiếp hoặc 20 lần tổng → auto mode tạm dừng và quay lại hỏi bạn. Hành động bị chặn hiện trong `/permissions` → tab **Recently blocked**.

:::warning Auto mode không bảo đảm an toàn
Nó giảm số lần hỏi, không thay thế review cho thao tác nhạy cảm. Dùng cho việc bạn tin hướng đi chung.
:::

## Không chế độ nào tự duyệt

- Công cụ khớp rule **ask** tường minh.
- Công cụ cần người dùng tương tác (Claude hỏi bạn câu hỏi).
- Lệnh `rm`/`rmdir` nhắm vào **đường dẫn quan trọng** (vd `rm -rf ~`).

**Protected paths** (như `.git`, `.claude`) có quy tắc riêng: Manual/acceptEdits hỏi, `dontAsk` từ chối, `bypassPermissions` cho phép.

:::quiz Bạn ghi vào `CLAUDE.md`: "Tuyệt đối không đọc file .env". Như vậy đã chặn được chưa?
- [ ] Rồi, CLAUDE.md là cấu hình bắt buộc
- [x] Chưa — CLAUDE.md chỉ định hướng; muốn chặn cứng phải dùng rule `deny` như `Read(./.env)`
- [ ] Rồi, nếu viết IN HOA
- [ ] Chỉ chặn ở auto mode

Quyền do Claude Code thực thi qua permission rule, mode, hook — không phải qua lời dặn cho model.
:::

:::quiz Bạn muốn Claude khám phá một module legacy và đề xuất cách refactor mà chưa đụng vào file nào. Chế độ nào?
- [ ] `acceptEdits`
- [ ] `bypassPermissions`
- [x] `plan`
- [ ] `dontAsk`

Plan mode cho đọc và lên kế hoạch, chặn sửa source tới khi bạn duyệt kế hoạch.
:::

:::quiz Chọn "Yes, and don't ask again" cho `npm test`, rule được lưu ở đâu?
- [ ] `CLAUDE.md`
- [ ] `.claude/settings.json` (commit cho cả team)
- [x] `.claude/settings.local.json` ở gốc repo — file cá nhân, Claude Code giữ nó ngoài git
- [ ] Không lưu, chỉ nhớ trong phiên

Muốn chia sẻ cho cả team thì chủ động chuyển rule sang `.claude/settings.json` và commit.
:::

:::interview Khi nào được dùng `--dangerously-skip-permissions` (bypassPermissions)?
Chỉ khi Claude chạy trong môi trường **cô lập** (container, VM, sandbox runtime) mà thiệt hại tối đa chấp nhận được — vd job CI dùng một lần, không có credential quan trọng, chạy bằng user không phải root. Trên máy cá nhân có SSH key, cloud credential, repo khác… thì không. Kể cả khi bypass, rule `deny` vẫn có hiệu lực.
:::

:::exercise Một task, ba chế độ
Trong cc-lab, sau mỗi lần chạy thì `git checkout . && git clean -fd src`. Giao cùng một task — *"Thêm hàm isDueToday(task, today) vào task-filter.ts kèm test, chạy test"* — lần lượt ở `--permission-mode default`, `--permission-mode acceptEdits` và `--permission-mode plan`. Đếm số lần bạn phải duyệt và ghi lại điều khác biệt.
???
Manual: hỏi cho mỗi lần sửa file và lệnh `npm test` (trừ khi đã có allow rule). acceptEdits: sửa file không hỏi, `npm test` vẫn hỏi (không phải lệnh filesystem thông dụng). Plan: Claude đọc và trình kế hoạch, không sửa gì tới khi bạn chọn một lựa chọn duyệt; sau đó chế độ chuyển theo lựa chọn. Rút ra: chọn chế độ theo mức bạn muốn giám sát, còn allowlist cho lệnh kiểm tra giảm số lần hỏi ở mọi chế độ.
:::

> Nguồn: *Choose a permission mode* và *Configure permissions* — code.claude.com/docs/en/permission-modes, /permissions (truy cập 11/11/2026).
