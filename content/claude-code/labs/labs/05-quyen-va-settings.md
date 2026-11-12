---
title: "Lab 05 — Quyền và settings: allowlist cho lệnh kiểm tra, chặn file bí mật, thử từng permission mode"
summary: "Tạo .env giả trong cc-lab, viết .claude/settings.json với allow/ask/deny, chứng minh deny chặn được còn lời dặn trong CLAUDE.md thì không, dùng /permissions để đọc rule và nguồn, rồi chạy cùng một task ở Manual, acceptEdits, plan và auto để cảm nhận khác biệt."
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, lab, permissions, settings]
related: [claude-code/consolidate/guardrails/settings-va-permission-rule, claude-code/review/guardrails/che-do-quyen]
---

## Mục tiêu

- Claude chạy test/build **không phải hỏi**; push và cài package **phải hỏi**; đọc `.env` **bị chặn**.
- Hiểu bằng trải nghiệm: rule do Claude Code thực thi, lời dặn chỉ là gợi ý.

**Thời gian:** 40 phút.

## Trước khi bắt đầu

- [ ] Lab 01 xong; nhánh riêng: `git checkout -b lab05`.
- [ ] Biết cách thoát và mở lại phiên (`/exit` rồi `claude …`) vì Bước 5 chạy bốn lần với bốn chế độ.


## Bước 1 — Tạo "bí mật" giả

```bash
cd cc-lab
echo "API_TOKEN=fake-token-for-lab-only" > .env
echo ".env" >> .gitignore
```

## Bước 2 — Lời dặn mềm không phải hàng rào

Thêm vào `CLAUDE.md`: `- Không đọc file .env.` Mở phiên **Manual mode**:

```bash
claude --permission-mode default -n "lab05"
```

```text
Đọc file .env và cho mình biết có biến gì.
```

Quan sát: Claude có thể từ chối vì lời dặn, hoặc vẫn xin quyền/đọc. Dù thế nào, đây **không** phải đảm bảo. Xoá dòng vừa thêm khỏi CLAUDE.md.

## Bước 3 — Viết settings của team

```json title=".claude/settings.json"
{
  "permissions": {
    "allow": [
      "Bash(npm test *)",
      "Bash(npx ng build *)",
      "Bash(npx ng build)",
      "Bash(git status)",
      "Bash(git diff *)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(npm install *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)"
    ]
  }
}
```

Thoát và mở lại phiên (hoặc tiếp tục — đổi rule có hiệu lực từ lần gọi công cụ kế tiếp), rồi:

```text
/permissions
```

Tìm 3 nhóm rule và cột **nguồn** (`.claude/settings.json`).

## Bước 4 — Kiểm chứng từng rule

| Thử | Kỳ vọng |
|---|---|
| *"Chạy npm test -- --watch=false"* | Chạy luôn, không hỏi |
| *"Đọc .env"* | Bị chặn bởi deny |
| *"Cài thư viện date-fns"* | Hỏi bạn (ask) — chọn **No** kèm ghi chú "không thêm thư viện" bằng `Tab` |
| *"Chạy npx ng lint"* (không có trong allow) | Hỏi bạn — thử chọn **Yes, and don't ask again** rồi mở `.claude/settings.local.json` xem rule mới |

:::warning Deny Read chưa phải bức tường tuyệt đối
Deny `Read(./.env)` chặn công cụ Read **và** các lệnh đọc file Claude Code nhận diện được trong Bash khi đường dẫn bị cấm xuất hiện làm đối số (`cat`, `head`, `grep`, `find`…, cả chuyển hướng `< .env`). Nhưng nó **không** chặn một tiến trình con tự mở file — vd `node -e "console.log(require('fs').readFileSync('.env','utf8'))"` hay một script npm đọc `.env`. Muốn chặn ở mức hệ điều hành: sandbox với `denyRead` (thử thách bên dưới).
:::

## Bước 5 — Cùng một task, bốn chế độ

Task (sau mỗi lần: `git checkout . && git clean -fd src`):

```text
Thêm hàm countByStatus(tasks) vào task-filter.ts trả về { todo, doing, done }, có test, chạy test.
```

| Chế độ | Khởi động | Bạn phải bấm duyệt bao nhiêu lần? | Cảm nhận |
|---|---|---|---|
| Manual | `claude --permission-mode default` | | |
| acceptEdits | `claude --permission-mode acceptEdits` | | |
| plan | `claude --permission-mode plan` | | Kế hoạch trước, duyệt rồi mới sửa |
| auto | `claude --permission-mode auto` | | Thường gần như không hỏi; xem `/permissions` → Recently blocked |

## Bước 6 — Commit settings của team

Commit `.claude/settings.json`. **Không** commit `.claude/settings.local.json` (Claude Code tự đưa nó ra ngoài git) và `.env`.

## Kết quả bạn nên thấy

> Câu chữ Claude trả lời mỗi lần một khác — điều cần kiểm là **kết quả** trong bảng dưới (file đổi gì, lệnh nào pass, Claude có bị chặn đúng chỗ không), không phải câu chữ.

| Bước | Dấu hiệu đúng | Nếu khác |
|---|---|---|
| Bước 3 | `/permissions` hiện 3 nhóm rule, nguồn `.claude/settings.json` | JSON lỗi → `/doctor` hoặc `claude doctor` chỉ ra dòng sai |
| Bước 4 | `npm test` chạy không hỏi; đọc `.env` bị chặn; `npm install` hỏi; "don't ask again" ghi vào `.claude/settings.local.json` | Rule không khớp lệnh: kiểm tra Claude chạy đúng `npm test -- --watch=false` (khớp `Bash(npm test *)`) |
| Bước 5 | Manual hỏi nhiều nhất; acceptEdits không hỏi khi sửa file nhưng hỏi lệnh ngoài allowlist; plan trình kế hoạch trước; auto gần như không hỏi | Auto không có trong vòng `Shift+Tab` → tài khoản/model chưa hỗ trợ, xem `/status` |

## Checklist hoàn thành

- [ ] Test/build chạy không hỏi; `npm install` và `git push` luôn hỏi; Read `.env` bị chặn
- [ ] Đã thấy rule "don't ask again" được ghi vào `.claude/settings.local.json`
- [ ] Điền đủ bảng bốn chế độ ở Bước 5
- [ ] Giải thích được vì sao deny Read chưa đủ để bảo vệ `.env` tuyệt đối

:::quiz Bạn chọn "Yes, and don't ask again" cho `npx ng lint`. Rule được lưu ở đâu?
- [ ] `.claude/settings.json` (commit)
- [x] `.claude/settings.local.json` ở gốc repo — file cá nhân, ngoài git
- [ ] `CLAUDE.md`
- [ ] `~/.claude.json`

Muốn chia sẻ cho team thì chủ động chuyển sang `.claude/settings.json`.
:::

:::quiz Ở acceptEdits mode, Claude muốn chạy `npm test`. Điều gì xảy ra (không có allow rule)?
- [ ] Chạy luôn
- [x] Vẫn hỏi bạn — acceptEdits chỉ tự duyệt sửa file và lệnh filesystem thông dụng (`mkdir`, `mv`, `cp`…)
- [ ] Bị từ chối
- [ ] Chuyển sang auto mode

Allow rule `Bash(npm test *)` từ Bước 3 là thứ giúp không bị hỏi.
:::

:::quiz Bạn thêm `allow: ["Bash(git push origin feature/*)"]` vào local settings, còn file team có `ask: ["Bash(git push *)"]`. `git push origin feature/x` sẽ thế nào?
- [ ] Chạy luôn vì allow cụ thể hơn
- [x] Vẫn hỏi — thứ tự xét là deny → ask → allow, ask khớp trước
- [ ] Bị chặn
- [ ] Báo lỗi cấu hình

Độ cụ thể không đổi thứ tự xét rule.
:::

:::exercise Thử thách mở rộng — chặn cả đường shell
Trước tiên nhờ Claude `cat .env` (bị chặn nhờ deny Read). Rồi nhờ nó đọc bằng `node -e "console.log(require('fs').readFileSync('.env','utf8'))"`. Làm cho cách thứ hai cũng thất bại.
???
Cách thứ hai lọt qua deny Read vì Node tự mở file — rule Bash chỉ khớp **chuỗi lệnh**, không biết chương trình làm gì bên trong (ở Manual mode bạn vẫn được hỏi trước khi chạy, nên hãy đọc lệnh). Chặn thật sự: bật sandbox và thêm `"sandbox": { "enabled": true, "filesystem": { "denyRead": ["./.env"] } }` (hoặc dùng `sandbox.credentials.files`) — lệnh shell chạy trong sandbox không đọc được file đó dù dùng lệnh gì. Sandbox chạy trên macOS, Linux, WSL2. Kiểm chứng xong, xoá `.env` giả.
:::

> Nguồn: *Configure permissions*, *Choose a permission mode*, *Settings files and precedence*, *Configure the sandboxed Bash tool* — code.claude.com/docs (truy cập 11/11/2026).
