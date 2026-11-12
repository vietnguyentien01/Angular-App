---
title: Biến môi trường quan trọng — xác thực, model, giới hạn, mạng, dữ liệu, chẩn đoán
summary: "Tài liệu chính thức có gần 400 biến môi trường; bài này chọn các biến dev và team hay cần nhất, nhóm theo mục đích, kèm ví dụ, cách đặt trong khối env của settings, thứ tự ưu tiên với settings, và những biến bị bỏ qua khi đặt trong settings của repo."
type: cheatsheet
level: intermediate
lastReviewed: 2026-11-12
tags: [claude-code, env-vars, configuration, reference]
related: [claude-code/commands/commands/flag-dong-lenh, claude-code/consolidate/getting-started/mang-doanh-nghiep-va-dev-container]
---

## Đặt biến ở đâu?

| Cách | Áp dụng | Ghi chú |
|---|---|---|
| `export VAR=...` trong shell | Phiên mở từ shell đó | Đọc **một lần** lúc khởi động |
| Khối `env` trong `~/.claude/settings.json` | Mọi phiên của bạn, kể cả phiên nền, IDE | Cách khuyến nghị cho cấu hình cá nhân |
| Khối `env` trong `.claude/settings.json` | Mọi người trong repo | Một số biến nhạy cảm **bị bỏ qua** ở đây (xem cuối bài) |
| Managed settings | Cả tổ chức | IT phát cấu hình proxy, telemetry… |

```json title="~/.claude/settings.json"
{
  "env": {
    "BASH_DEFAULT_TIMEOUT_MS": "300000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

Giá trị trong khối `env` của settings **ghi đè** biến cùng tên đã export trong shell; nhiều file cùng đặt thì file ưu tiên cao hơn thắng. Ngoại lệ: phiên do Claude Desktop hoặc runner self-hosted khởi chạy — môi trường khởi chạy của chúng thắng. Muốn huỷ một biến đã export: đặt nó thành `""` trong `env`. Đừng nhầm với chuyện **biến môi trường so với khoá setting** (vd `ANTHROPIC_MODEL` thắng khoá `model`) — đó là quy tắc riêng từng cặp.

## Xác thực và nhà cung cấp

| Biến | Tác dụng |
|---|---|
| `ANTHROPIC_API_KEY` | API key. Khi có, được dùng **thay** gói Claude dù bạn đã đăng nhập (chế độ tương tác hỏi bạn duyệt một lần; `-p` luôn dùng) |
| `ANTHROPIC_AUTH_TOKEN` | Giá trị header `Authorization` (tự thêm `Bearer `) — thường cho gateway |
| `CLAUDE_CODE_OAUTH_TOKEN` | Token OAuth của claude.ai cho script/SDK (tạo bằng `claude setup-token`) |
| `ANTHROPIC_BASE_URL` | Đổi endpoint API — đi qua proxy hoặc LLM gateway |
| `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY` | Dùng Amazon Bedrock / Google Cloud / Microsoft Foundry |
| `CLAUDE_CONFIG_DIR` | Đổi thư mục cấu hình (mặc định `~/.claude`) — chạy nhiều tài khoản song song, dev container |

```bash title="Hai tài khoản trên cùng máy"
CLAUDE_CONFIG_DIR=~/.claude-congty claude      # tài khoản công ty
claude                                          # tài khoản cá nhân
```

## Model và suy luận

| Biến | Tác dụng |
|---|---|
| `ANTHROPIC_MODEL` | Model cho phiên (thắng khoá `model` trong settings) |
| `ANTHROPIC_DEFAULT_OPUS_MODEL`, `…_SONNET_MODEL`, `…_HAIKU_MODEL` | Cố định alias `opus`/`sonnet`/`haiku` trỏ tới ID cụ thể (cần khi dùng cloud provider) |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Model mặc định cho subagent, teammate, agent của workflow chưa được gán model |
| `CLAUDE_CODE_EFFORT_LEVEL` | Effort (`low`…`max`) — **thắng** `--effort` và `/effort` |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Giới hạn token output mỗi request |
| `CLAUDE_CODE_DISABLE_FAST_MODE` | `1` để tắt fast mode |

## Lệnh shell và giới hạn

| Biến | Mặc định | Tác dụng |
|---|---|---|
| `BASH_DEFAULT_TIMEOUT_MS` | 120000 (2 phút) | Timeout mặc định cho lệnh Bash — tăng khi `ng build`/E2E chạy lâu |
| `BASH_MAX_TIMEOUT_MS` | 600000 (10 phút) | Timeout tối đa model được đặt |
| `BASH_MAX_OUTPUT_LENGTH` | 30000 ký tự (tối đa 150000) | Lượng output lệnh Claude đọc lại |
| `CLAUDE_CODE_SHELL` | tự phát hiện | Đường dẫn `bash`/`zsh` dùng cho lệnh (không hỗ trợ fish) |
| `CLAUDE_CODE_GIT_BASH_PATH` | — | Windows: đường dẫn `bash.exe` của Git Bash |
| `CLAUDE_ENV_FILE` | — | Script chạy trước mỗi lệnh Bash (vd kích hoạt nvm/virtualenv) |
| `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | — | Quay về thư mục gốc dự án sau mỗi lệnh |
| `USE_BUILTIN_RIPGREP` | — | `0` để dùng `rg` của hệ thống |

```bash title="E2E chạy 6 phút bị cắt"
export BASH_DEFAULT_TIMEOUT_MS=480000
```

## MCP

| Biến | Mặc định | Tác dụng |
|---|---|---|
| `MCP_TIMEOUT` | 30000 | Timeout khởi động MCP server |
| `MCP_TOOL_TIMEOUT` | rất lớn (server HTTP: 60 giây mỗi request) | Timeout thực thi tool MCP |
| `MAX_MCP_OUTPUT_TOKENS` | 25000 (cảnh báo từ 10000) | Giới hạn token trong phản hồi tool MCP |

## Context, cache, bộ nhớ

| Biến | Tác dụng |
|---|---|
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | Context đầy tới mức nào thì tự compact (100000–1000000 token) |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | Compact **sớm hơn** theo % (chỉ hạ được ngưỡng) |
| `CLAUDE_CODE_PROMPT_CACHE_TTL` | `5m` hoặc `1h` cho cache của hội thoại chính |
| `DISABLE_PROMPT_CACHING` | `1` để tắt prompt caching (chẩn đoán; tốn hơn) |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | `1` tắt auto memory; `0` buộc bật |
| `CLAUDE_CODE_SIMPLE` | `1` = chế độ tối giản (như `--bare`) |
| `CLAUDE_CODE_NEW_INIT` | `1` để `/init` chạy luồng tương tác nhiều bước |

## Dữ liệu, mạng, bảo mật

| Biến | Tác dụng |
|---|---|
| `HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY` | Proxy (không hỗ trợ SOCKS) |
| `NODE_EXTRA_CA_CERTS` | Tin thêm chứng chỉ CA nội bộ |
| `CLAUDE_CODE_CERT_STORE` | Nguồn CA: `bundled`, `system` (mặc định cả hai) |
| `CLAUDE_CODE_CLIENT_CERT`, `CLAUDE_CODE_CLIENT_KEY`, `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE` | mTLS |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Tắt mọi lưu lượng không thiết yếu (tự cập nhật, telemetry, báo lỗi, `/feedback`, release notes…) |
| `DISABLE_TELEMETRY` | Tắt telemetry — **đặt `0` hay `false` vẫn là tắt**; muốn bật lại phải xoá biến |
| `DISABLE_ERROR_REPORTING`, `DISABLE_FEEDBACK_COMMAND`, `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` | Tắt từng loại |
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` | `1` = gỡ credential khỏi môi trường của lệnh Bash, hook, MCP stdio (giữ token GitHub và cấu hình proxy) |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `1` = bật OpenTelemetry để team tự thu metrics/log |

## Cập nhật, giao diện

| Biến | Tác dụng |
|---|---|
| `DISABLE_AUTOUPDATER` | Tắt tự cập nhật nền (`claude update` vẫn chạy); `DISABLE_UPDATES` chặn cả hai |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` | Không đổi tiêu đề terminal theo hội thoại |
| `CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL` | `/ide` không tự cài extension IDE |

## Biến bị bỏ qua trong settings của repo

Một số biến **bị bỏ qua** khi đặt trong `.claude/settings.json` hoặc `.claude/settings.local.json` — một repo đã checkout không được điều khiển chúng. Ví dụ: `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_TMPDIR`, `HOME`, `TMPDIR`, họ `XDG_*`; biến xuất nội dung phiên như `OTEL_LOG_RAW_API_BODIES`; theo trang Environment variables còn có `CLAUDE_CODE_OAUTH_TOKEN` và `CLAUDE_CODE_ENABLE_TELEMETRY`. Biến từ settings của repo chỉ áp dụng sau khi bạn **tin cậy thư mục** (trừ các biến được coi là an toàn như chọn model, timeout). Đặt chúng trong shell, user settings hoặc managed settings. Danh sách đầy đủ ở trang *Settings reference* (mục "Variables Claude Code ignores in env").

:::quiz Bạn đã đăng nhập gói Max nhưng shell có sẵn `ANTHROPIC_API_KEY` của dự án khác. Khi chạy `claude -p`, request dùng gì?
- [ ] Gói Max
- [x] API key — ở `-p`, key luôn được dùng khi có
- [ ] Hỏi bạn chọn
- [ ] Báo lỗi

Ở chế độ tương tác, Claude Code hỏi bạn duyệt key một lần.
:::

:::quiz `ng e2e` mất 5 phút và lần nào Claude chạy cũng bị cắt ở 2 phút. Biến nào?
- [ ] `MCP_TIMEOUT`
- [x] `BASH_DEFAULT_TIMEOUT_MS` (vd 360000)
- [ ] `CLAUDE_CODE_MAX_OUTPUT_TOKENS`
- [ ] `DISABLE_PROMPT_CACHING`

Mặc định 2 phút cho lệnh foreground; hoặc cho chạy nền với `Ctrl+B`.
:::

:::exercise Viết khối env cho máy làm việc của bạn
Viết khối `env` cho `~/.claude/settings.json` giải quyết: (1) E2E chạy 6 phút; (2) output test dài bị cắt; (3) không gửi telemetry; (4) dùng Node qua nvm trong lệnh Bash. Nêu biến nào **không** nên đặt trong settings commit của repo.
???
```json
{
  "env": {
    "BASH_DEFAULT_TIMEOUT_MS": "420000",
    "BASH_MAX_OUTPUT_LENGTH": "80000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_ENV_FILE": "/home/ban/.claude/env.sh"
  }
}
```
với `env.sh` chứa `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null`. Không commit vào repo: token/API key, `CLAUDE_CODE_OAUTH_TOKEN` (bị bỏ qua ở đó), đường dẫn cá nhân như `CLAUDE_ENV_FILE`. Tăng `BASH_MAX_OUTPUT_LENGTH` cũng tăng context — cân nhắc lọc output test thay vì đọc hết.
:::

> Nguồn: *Environment variables*, *Settings reference*, *Enterprise network configuration*, *Data usage* — code.claude.com/docs (truy cập 12/11/2026).
