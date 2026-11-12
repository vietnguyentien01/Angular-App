---
title: Cấu hình auto mode — khai báo hạ tầng tin cậy, thêm điểm dừng cho người, chỉnh rule của classifier, xử lý lần bị chặn
summary: "Auto mode mặc định chỉ tin thư mục làm việc và remote của repo — push lên org Git công ty, bucket của team đều bị chặn, trong khi push lên mọi nhánh của repo hiện tại lại được phép. Cách khai báo autoMode.environment, thêm ask rule cho push/PR, hard_deny/soft_deny/allow, đọc tab Recently blocked."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, auto-mode, permissions, classifier, security]
related: [claude-code/review/guardrails/che-do-quyen, claude-code/consolidate/guardrails/settings-va-permission-rule]
---

## TL;DR

- Auto mode dùng một **classifier** xét từng hành động. Mặc định nó chỉ tin **thư mục làm việc** và **remote đã cấu hình** của repo; mọi đích khác bị coi là "bên ngoài".
- Mặc định **được phép**: push lên **mọi nhánh** của repo hiện tại — kể cả nhánh mặc định — và tạo PR. Muốn có điểm dừng cho người: rule `ask` cho `git push` và `gh pr create`.
- Khai báo hạ tầng công ty trong `autoMode.environment` bằng **văn xuôi** — ở `~/.claude/settings.json` hoặc managed settings, **không** đọc từ `.claude/settings.json` của repo.

## Ba mức ranh giới

| Muốn | Cơ chế | Trong auto mode |
|---|---|---|
| Hỏi người trước khi làm | `permissions.ask` | Luôn hỏi với lệnh khớp rule có nội dung; classifier không tự duyệt được |
| Không bao giờ làm | `permissions.deny` | Chặn **trước** khi classifier được hỏi; không ý định nào ghi đè được |
| Ranh giới riêng cho phiên này | Nói trong hội thoại: "đừng push tới khi mình review" | Classifier chặn, nhưng có thể mất nếu tin nhắn đó bị compact — cần chắc chắn thì dùng `ask` |

### Điểm dừng cho push và PR

```json title="~/.claude/settings.json hoặc .claude/settings.json"
{
  "permissions": {
    "ask": [
      "Bash(git push *)",
      "Bash(gh pr create *)"
    ]
  }
}
```

Lưu ý: rule khớp lệnh **bắt đầu bằng** `git push`; cách viết khác như `git -C <dir> push` không khớp. Muốn kiểm tra chặt theo nội dung lệnh → hook `PreToolUse`. Lớp chắc nhất vẫn là **branch protection** phía server.

## Khai báo hạ tầng tin cậy

```json title="~/.claude/settings.json (cá nhân) — hoặc managed settings (cả tổ chức)"
{
  "autoMode": {
    "environment": [
      "$defaults",
      "Organization: Công ty ABC, Claude Code dùng cho phát triển frontend Angular",
      "Source control: github.com/abc-frontend and all repos under it",
      "Trusted internal domains: *.abc.internal, api-dev.abc.internal",
      "Key internal services: Jenkins at ci.abc.internal, Nexus npm registry at nexus.abc.internal",
      "Internal package registry: npm installs must go through nexus.abc.internal",
      "Sensitive remote targets: any host or namespace containing prod or uat",
      "Additional context: government project, citizen personal data must never leave the internal network"
    ]
  }
}
```

- Viết như mô tả hạ tầng cho **kỹ sư mới vào**: đây là câu văn, không phải regex.
- `"$defaults"` giữ các mục mặc định (và nhận cập nhật khi Claude Code đổi danh sách mặc định).
- Không ghi `autoMode` trong `.claude/settings.json` hay `.claude/settings.local.json` — classifier **bỏ qua** hai file đó, để repo không tự "cấp quyền" cho mình.
- Mục từ các phạm vi được gộp; dev thêm được mục riêng nhưng không gỡ được mục của managed settings.

Soạn nhanh bằng lệnh:

```text
/auto-mode-setup
```

Claude đọc dự án và các phiên gần đây, soạn mục `environment` cho bạn duyệt rồi lưu vào user settings.

## Chỉnh rule của classifier

| Trường | Tác dụng | Ý định của người dùng ghi đè được? |
|---|---|---|
| `autoMode.hard_deny` | Chặn kể cả khi người dùng yêu cầu | Không |
| `autoMode.soft_deny` | Chặn hành động phá huỷ | Có — nếu người dùng nói **đúng và cụ thể** hành động đó |
| `autoMode.allow` | Ngoại lệ cho `soft_deny` | — |

```json
{
  "autoMode": {
    "allow": [
      "$defaults",
      "Deploying to the dev namespace is allowed: it resets nightly and holds only fake data"
    ],
    "soft_deny": [
      "$defaults",
      "Never run database migrations outside the migrations CLI, even against dev databases"
    ],
    "hard_deny": [
      "$defaults",
      "Never copy files from the exports/ directory anywhere: it contains citizen personal data"
    ]
  }
}
```

"Ý định cụ thể" nghĩa là: *"dọn repo"* **không** cho phép force-push; *"force-push nhánh feature/x"* thì có.

Xem rule mặc định và cấu hình thực tế:

```bash
claude auto-mode defaults
claude auto-mode defaults --label 'Git Destructive'
claude auto-mode config
claude auto-mode reset          # xoá mục autoMode trong user settings
```

Cũng sửa được trong `/permissions` → tab **Auto mode**.

## Khi bị chặn

1. `/permissions` → tab **Recently blocked**.
2. Đọc **lệnh/đầu vào thật** của dòng (không dựa vào mô tả do Claude viết).
3. Nhấn `r` để duyệt và cho Claude thử lại; `Esc` để áp dụng.
4. Duyệt một lần **không** tạo rule — lần sau vẫn có thể bị chặn. Bị chặn lặp lại với việc hợp lệ → thêm `allow` (permission hoặc `autoMode.allow`) hoặc một mục `environment`.

Bị chặn 3 lần liên tiếp hoặc 20 lần tổng → auto mode tạm dừng và quay lại hỏi bạn.

:::warning Auto mode không thay thế hàng rào cứng
Classifier là **cổng thứ hai** sau hệ thống permission. Thứ tuyệt đối không được xảy ra (đọc file secret, xoá dữ liệu khách hàng) → `permissions.deny` trong managed settings, chặn trước khi classifier được hỏi.
:::

:::senior Góc nhìn senior
Đội security nên sở hữu `autoMode.environment` của tổ chức qua managed settings: đó là định nghĩa "trong" và "ngoài" của công ty dưới dạng văn bản. Viết nó cùng lúc với tài liệu kiến trúc mạng — nếu bạn không mô tả được ranh giới cho một kỹ sư mới, classifier cũng không đoán được.
:::

:::quiz Không cấu hình gì thêm, Claude ở auto mode chạy `git push origin main` trên repo hiện tại. Điều gì xảy ra theo mặc định?
- [ ] Luôn bị chặn
- [x] Được phép — auto mode mặc định cho push lên mọi nhánh của repo đang làm và tạo PR; muốn có điểm dừng phải thêm rule `ask` (và branch protection)
- [ ] Hỏi người dùng
- [ ] Chỉ được phép với gói Enterprise

Force push và các nhánh mang tên deploy/publish như `production`, `release` thì khác.
:::

:::quiz Bạn ghi `autoMode.environment` vào `.claude/settings.json` của repo và commit, nhưng classifier vẫn chặn push lên org GitHub công ty. Vì sao?
- [ ] Sai cú pháp regex
- [x] Classifier không đọc `autoMode` từ settings của repo (project/local) — phải đặt ở `~/.claude/settings.json` hoặc managed settings
- [ ] Phải khởi động lại máy
- [ ] Phải dùng `--bare`

Nếu đọc từ repo, một repo lạ có thể tự nới quyền cho chính nó.
:::

:::exercise Viết autoMode.environment cho công ty của bạn
Viết 6–10 mục `environment` mô tả hạ tầng nơi bạn làm (thay tên thật bằng tên giả nếu cần): tổ chức, source control, domain nội bộ, CI, registry nội bộ, dữ liệu nhạy cảm, môi trường production. Thêm một `hard_deny` và một rule `ask` cho push. Kiểm tra bằng `claude auto-mode config`.
???
Tiêu chí: mỗi mục là câu văn rõ nghĩa (không phải regex); có `"$defaults"` ở đầu mảng; đặt trong `~/.claude/settings.json`; `claude auto-mode config` liệt kê đủ mục của bạn bên cạnh mục mặc định. Kiểm chứng hành vi: ở auto mode, nhờ Claude push lên org công ty (giờ được phép theo environment) và `curl` tới một domain lạ (bị chặn); xem tab Recently blocked.
:::

> Nguồn: *Configure auto mode*, *Choose a permission mode* — code.claude.com/docs/en/auto-mode-config, /permission-modes (truy cập 12/11/2026).
