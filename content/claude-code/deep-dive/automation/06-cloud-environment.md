---
title: Cloud environment — mạng, biến, network secret, setup script và cache cho phiên chạy trên cloud
summary: "Mọi cloud session và scheduled task chạy trong một environment: mức mạng None/Limited/Full và danh sách domain, biến môi trường, network secret (proxy gắn key, Claude không thấy), setup script có cache, so với SessionStart hook — kèm case study environment của chính Learning Hub."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, cloud, environment, setup-script, scheduled-tasks]
related: [claude-code/consolidate/getting-started/chon-noi-lam-viec, claude-code/deep-dive/automation/lam-viec-song-song]
---

## TL;DR

- **Environment** = cấu hình máy ảo cho cloud session: **mạng**, **biến môi trường**, **network secret**, **setup script**. Dùng chung cho claude.ai/code, desktop, mobile, `claude --cloud`, scheduled task.
- Mặc định có environment **Default**: mạng **Limited** (registry gói, GitHub, SDK cloud), không biến, không setup script.
- Setup script chạy **trước** khi Claude khởi động (root, Ubuntu 24.04) và được **cache** — xong trong ~5 phút thì phiên sau khởi động nhanh.
- Cloud session là bản clone sạch của repo: thứ commit thì có, thứ chỉ có trên máy bạn (user settings, hook cá nhân, `.env`) thì **không**.

## Mạng

| Mức | Ra ngoài được |
|---|---|
| **None** | Không gì qua mạng của phiên |
| **Limited** | Danh sách mặc định (npm, PyPI, crates.io…, GitHub, SDK cloud) khi bật *Allow package managers*, cộng domain bạn liệt kê |
| **Full** | Mọi domain |

```text title="Allowed domains (một dòng một domain, *. cho subdomain)"
api.example.com
*.internal.example.com
registry.example.com
```

Ở mọi mức, phiên vẫn tới được: GitHub (qua proxy riêng), connector MCP đã bật, host của network secret, và API của Anthropic cho chính Claude Code.

Request bị chặn → lỗi kiểu *host not allowed*; thêm đúng host cần thiết, đừng chuyển sang **Full** cho nhanh.

## Biến môi trường

Định dạng `.env`, mỗi dòng `KEY=value`:

```text
NODE_ENV=test
API_BASE_URL=https://api-dev.example.com
FEATURE_FLAGS="search,export"
```

:::warning Biến môi trường không phải nơi cất secret
Giá trị lưu dạng văn bản và mọi tiến trình trong phiên đọc được. API key → **network secret**.
:::

## Network secret

- Lưu API key/token trên environment; **proxy của Anthropic gắn key vào request** tới các host bạn liệt kê **sau khi request rời VM** → Claude và mã trong phiên **không thấy** key.
- Có ở gói Pro, Max, Ultra, Team, Enterprise; chỉ cho environment do Anthropic host (không cho self-hosted); API đích phải nhận kết nối từ internet.
- Không lưu được nếu tổ chức dùng khoá mã hoá do khách hàng quản lý.

## Setup script

```bash title="Setup script: cài Chromium cho test E2E và Angular CLI"
#!/bin/bash
apt-get update && apt-get install -y chromium || true
npm install -g @angular/cli@22 &
wait
```

Bốn ràng buộc:

1. **Exit 0** — script fail thì phiên không khởi động (hoặc thiếu thứ cần cài). Thêm `|| true` cho lệnh không quan trọng.
2. **Dưới ~5 phút** — quá thời gian thì không được cache. Chạy song song với `&` và `wait`.
3. **Cần mạng cho việc cài** — mức **None** thì cài gói sẽ fail.
4. **Biến của environment chưa được đặt** khi script chạy — giá trị script cần thì ghi ngay trong script.

**Cache**: lần đầu script chạy xong, hệ thống chụp **filesystem** làm điểm bắt đầu cho các phiên sau (giữ gói đã cài, file đã ghi; **không** giữ tiến trình đang chạy như DB hay `docker compose up`). Script chạy lại khi bạn đổi script hoặc danh sách host, hoặc khi cache hết hạn (~7 ngày).

## Setup script hay SessionStart hook?

| | Setup script | SessionStart hook |
|---|---|---|
| Cấu hình ở | Hộp thoại environment trên claude.ai/code | File settings trong repo |
| Chạy khi | Trước khi Claude Code khởi động; bỏ qua khi có cache | Sau khi Claude Code khởi động, mọi phiên kể cả resume |
| Chạy ở | Chỉ cloud | Local và cloud |
| Dùng cho | Toolchain, CLI chưa cài sẵn của **máy** | Thiết lập **dự án** như `npm install` |

Chỉ chạy `npm install` trên cloud bằng hook trong repo:

```json title=".claude/settings.json"
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [{ "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR\"/scripts/install_pkgs.sh" }]
      }
    ]
  }
}
```

```bash title="scripts/install_pkgs.sh"
#!/bin/bash
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0          # máy local: bỏ qua
fi
cd "$CLAUDE_PROJECT_DIR" || exit 1
npm ci
```

## Giới hạn tài nguyên

Khoảng **4 vCPU, 16 GB RAM, 30 GB đĩa** (có thể thay đổi). Lệnh Bash vẫn theo timeout mặc định (2 phút, tối đa 10 phút; quá hạn thì chuyển xuống nền). Build Angular rất lớn vượt giới hạn → Remote Control (chạy trên máy bạn) hoặc self-hosted environment.

## Chọn environment

- Trên claude.ai/code: bộ chọn dưới ô nhập ở màn hình tạo phiên (thêm, sửa, lưu trữ environment).
- Từ CLI: `/remote-env` chọn environment mặc định cho `claude --cloud`.
- Team/Enterprise: Owner tạo **environment dùng chung** và đặt mặc định cho tổ chức.

## Case study: environment của Learning Hub

Phiên cập nhật bản tin "Frontend mới" mỗi 2 ngày của app này chạy trong một environment riêng:

| Thiết lập | Lựa chọn | Lý do |
|---|---|---|
| Mạng | Limited + danh sách domain nguồn tin chính thống | Đủ để đọc tin, không mở toàn bộ internet |
| Setup script | Không cần | Node và npm có sẵn; `npm ci` chạy trong phiên |
| Secret | Không | Chỉ cần quyền GitHub có sẵn của phiên |
| Đầu ra | Push lên `main` sau khi `content:check`, test, build pass | Bạn đã chọn tự động merge cho app cá nhân |

Muốn phiên đó cũng theo dõi thay đổi của Claude Code: thêm `code.claude.com` vào Allowed domains của environment.

:::senior Góc nhìn senior
Environment là **ranh giới bảo mật** của mọi việc chạy trên cloud. Thiết kế nó như thiết kế quyền cho một service account: mạng tối thiểu theo domain, secret qua network secret (không qua biến), setup script tất định và nhanh để cache được, một environment riêng cho mỗi loại việc (cập nhật nội dung khác với review PR).
:::

:::quiz Bạn để API key của Sentry trong **biến môi trường** của environment. Rủi ro là gì và nên đổi sang gì?
- [ ] Không rủi ro gì
- [x] Mọi tiến trình trong phiên (kể cả code Claude chạy) đọc được key; chuyển sang network secret để proxy gắn key vào request tới host của Sentry mà phiên không thấy key
- [ ] Key sẽ bị xoá sau 7 ngày
- [ ] Phải dùng mức mạng Full

Network secret giữ key ngoài VM.
:::

:::quiz Setup script của bạn chạy `docker compose up -d` để có DB cho test. Phiên thứ hai thấy DB không chạy. Vì sao?
- [ ] Docker không được hỗ trợ
- [x] Cache là snapshot filesystem: giữ image đã pull nhưng không giữ tiến trình đang chạy; khởi động DB trong SessionStart hook hoặc ngay trong phiên
- [ ] Setup script chạy sau Claude
- [ ] Phải dùng mức mạng None

Tiến trình nền không sống qua snapshot.
:::

:::exercise Thiết kế environment cho job review PR của cc-lab
Bạn muốn một scheduled task trên cloud mỗi tối review các PR mở của cc-lab và comment kết quả. Thiết kế: mức mạng và domain, biến môi trường, có cần network secret không, setup script (nếu cần), SessionStart hook cho `npm ci`, và vì sao không đặt `ANTHROPIC_API_KEY` trong biến.
???
Mạng: Limited + *Allow package managers* (npm cho `npm ci`); không cần thêm domain vì GitHub đi qua proxy riêng. Biến: `NODE_ENV=test`. Network secret: không cần cho GitHub (quyền GitHub của phiên đã có); chỉ cần nếu gọi API ngoài (vd Sentry). Setup script: cài Chromium nếu review cần chạy E2E, ngược lại bỏ trống. Hook SessionStart với `CLAUDE_CODE_REMOTE=true` → `npm ci`. Không cần `ANTHROPIC_API_KEY`: phiên cloud dùng tài khoản của bạn; key trong biến chỉ thêm rủi ro lộ.
:::

> Nguồn: *Configure cloud environments*, *Use Claude Code in the cloud*, *Automate work with scheduled tasks* — code.claude.com/docs (truy cập 12/11/2026). Case study là cấu hình thật của Learning Hub.
