---
title: Chạy Claude Code trong mạng doanh nghiệp và dev container — proxy, chứng chỉ CA, mTLS, danh sách host, môi trường cô lập
summary: "Khi cài Claude Code ở công ty bị chặn mạng: cấu hình HTTPS_PROXY/NO_PROXY, tin chứng chỉ CA nội bộ bằng NODE_EXTRA_CA_CERTS, mTLS, các host cần mở trên firewall, kiểm tra bằng --debug; rồi chạy Claude Code trong dev container để lệnh không đụng máy thật — giữ đăng nhập qua rebuild và giới hạn mạng."
type: lesson
level: intermediate
lastReviewed: 2026-11-12
tags: [claude-code, proxy, enterprise, network, devcontainer]
related: [claude-code/consolidate/getting-started/khi-gap-su-co, claude-code/deep-dive/guardrails/sandbox-va-prompt-injection]
---

## TL;DR

- Claude Code đọc biến proxy chuẩn: `HTTPS_PROXY` (khuyến nghị), `HTTP_PROXY`, `NO_PROXY`. **Không** hỗ trợ SOCKS.
- Proxy chặn TLS bằng chứng chỉ của công ty → `NODE_EXTRA_CA_CERTS=/đường/dẫn/ca.pem`.
- Đặt các biến này trong khối `env` của settings (không chỉ trong shell) để cả phiên nền và IDE dùng được.
- Muốn lệnh của Claude chạy **cách ly khỏi máy thật**: dev container với feature chính thức của Claude Code.

## 1. Proxy

```bash
export HTTPS_PROXY=https://proxy.congty.vn:8080
export NO_PROXY="localhost,127.0.0.1,.congty.local"
claude
```

- Chữ thường cũng được; thứ tự ưu tiên: `https_proxy`, `HTTPS_PROXY`, `http_proxy`, `HTTP_PROXY`.
- Proxy cần đăng nhập cơ bản: `https://user:pass@proxy…` — đừng ghi cứng mật khẩu vào script. Proxy dùng NTLM/Kerberos: tài liệu khuyên đặt một **LLM gateway** hỗ trợ cách xác thực đó ở giữa.
- Biến trong shell chỉ được đọc **một lần lúc khởi động** — đổi xong phải mở lại phiên.

## 2. Chứng chỉ CA nội bộ

Mặc định Claude Code tin cả bộ CA Mozilla đi kèm **và** kho chứng chỉ của hệ điều hành (`CLAUDE_CODE_CERT_STORE=bundled,system`). Thường thì chứng chỉ công ty đã cài vào hệ điều hành là đủ. Nếu chưa:

```bash
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/corp-ca.pem
```

Cảnh báo kiểu *"used only the certificates that it could read in full…"* nghĩa là file PEM có phần không đọc được — sửa file theo hướng dẫn trong cảnh báo.

## 3. mTLS (chứng chỉ phía client)

```bash
export CLAUDE_CODE_CLIENT_CERT=/path/client-cert.pem
export CLAUDE_CODE_CLIENT_KEY=/path/client-key.pem
export CLAUDE_CODE_CLIENT_KEY_PASSPHRASE="..."   # nếu key có mật khẩu
```

Xoay vòng chứng chỉ: thay file ở **cùng đường dẫn**, Claude Code đọc lại khi gặp lỗi kết nối — không cần khởi động lại.

## 4. Đặt trong settings thay vì shell

```json title="~/.claude/settings.json (hoặc managed settings do IT phát)"
{
  "env": {
    "HTTPS_PROXY": "https://proxy.congty.vn:8080",
    "NO_PROXY": "localhost,127.0.0.1,.congty.local",
    "NODE_EXTRA_CA_CERTS": "/etc/ssl/certs/corp-ca.pem"
  }
}
```

Phiên nền, extension IDE, desktop app không phải lúc nào cũng thừa hưởng shell của bạn — khối `env` trong settings đến được với tất cả. Giá trị trong `env` ghi đè biến cùng tên trong shell; riêng phiên do Claude Desktop quản lý kết nối thì đọc proxy/CA từ managed settings và `~/.claude/settings.json`, và môi trường khởi chạy của app được ưu tiên.

## 5. Host cần mở trên firewall

| Host | Để làm gì |
|---|---|
| `api.anthropic.com` | Gọi model, feature flag, kiểm tra an toàn của WebFetch |
| `claude.ai`, `claude.com`, `platform.claude.com` | Đăng nhập (claude.ai và Console), làm mới token |
| `sso.claude.com` | Đăng nhập SSO của tổ chức |
| `downloads.claude.ai` | Cài đặt, tự cập nhật, tải plugin |
| `registry.npmjs.org` | Plugin dạng npm, MCP server chạy bằng `npx` |
| `github.com`, `raw.githubusercontent.com` | Marketplace plugin, `/release-notes` |
| `mcp-proxy.anthropic.com` | Connector MCP từ claude.ai |
| `bridge.claudeusercontent.com` | Claude in Chrome |

Dùng Bedrock/Vertex/Foundry thì gọi model đi tới endpoint của nhà cung cấp đó thay vì `api.anthropic.com`.

## 6. Kiểm tra

```bash
claude --debug
```

Log ghi ra `~/.claude/debug/<id>.txt`; tìm dòng xác nhận đã nạp CA (vd `CA certs: Appended extra certificates from NODE_EXTRA_CA_CERTS (...)`). Lỗi kết nối/chứng chỉ thường chỉ lộ ra ở request đầu tiên — xem *Error reference* cho từng thông báo. `claude doctor` kiểm tra thêm phần cài đặt.

## 7. Dev container

Dev container là môi trường Docker giống nhau cho cả team. Claude Code chạy **bên trong** nên mọi lệnh nó chạy cũng ở trong container, còn file dự án được mount từ máy bạn.

```json title=".devcontainer/devcontainer.json"
{
  "image": "mcr.microsoft.com/devcontainers/typescript-node:22",
  "features": {
    "ghcr.io/anthropics/devcontainer-features/claude-code:1.0": {}
  },
  "mounts": [
    "source=claude-code-config,target=/home/node/.claude,type=volume"
  ],
  "containerEnv": {
    "CLAUDE_CONFIG_DIR": "/home/node/.claude"
  }
}
```

- Feature cài bản Claude Code mới nhất (tag `:1.0` là phiên bản của script cài, không phải của Claude Code) và thêm extension VS Code khi mở bằng VS Code/Codespaces.
- Volume + `CLAUDE_CONFIG_DIR` giữ đăng nhập, settings, lịch sử qua mỗi lần rebuild.
- VS Code: Command Palette → **Dev Containers: Rebuild Container**, rồi chạy `claude` trong terminal của container.
- Giới hạn mạng ra ngoài: container tham khảo của Anthropic có script `init-firewall.sh` chỉ mở các đích cần thiết.

:::danger Dev container không làm `--dangerously-skip-permissions` an toàn với repo lạ
Trong container, một repo độc hại vẫn có thể lấy mọi thứ container truy cập được — kể cả credential Claude Code trong `~/.claude`. Chỉ dùng với repo tin cậy, không mount `~/.ssh` hay file credential cloud từ máy host vào container; ưu tiên token ngắn hạn, phạm vi repo.
:::

:::senior Góc nhìn senior
Ở ngân hàng/chính phủ, đi cùng IT từ đầu: xin mở đúng danh sách host ở trên (đừng xin "mở internet"), phát `env` qua **managed settings** để không dev nào phải tự cấu hình proxy, và chuẩn hoá dev container cho dự án để "chạy được trên máy tôi" không còn là vấn đề — kể cả với Claude.
:::

:::quiz Công ty dùng proxy SOCKS5 duy nhất. Claude Code có dùng được trực tiếp không?
- [ ] Có, đặt `HTTPS_PROXY=socks5://…`
- [x] Không — Claude Code không hỗ trợ SOCKS; cần proxy HTTP(S) hoặc một LLM gateway
- [ ] Có, nếu bật sandbox
- [ ] Có, qua `NO_PROXY`

Báo IT để có proxy HTTP(S) hoặc gateway.
:::

:::quiz Bạn đặt `HTTPS_PROXY` trong `.zshrc` và CLI chạy tốt, nhưng phiên nền / extension IDE không kết nối được. Cách khắc phục được khuyến nghị?
- [ ] Khởi động lại máy
- [x] Đặt biến trong khối `env` của `~/.claude/settings.json` (hoặc managed settings)
- [ ] Dùng `--bare`
- [ ] Tắt proxy

Không phải tiến trình nào cũng thừa hưởng shell của bạn.
:::

:::interview "Team bạn cài Claude Code trong mạng có proxy chặn TLS thế nào?"
(1) Đặt `HTTPS_PROXY`/`NO_PROXY` trong khối `env` của managed settings; (2) chứng chỉ CA công ty cài vào kho hệ điều hành, hoặc `NODE_EXTRA_CA_CERTS` khi cần; (3) xin IT mở đúng các host bắt buộc (API, đăng nhập, tải bản cập nhật, npm cho MCP); (4) kiểm tra bằng `claude --debug` và `claude doctor`; (5) với việc rủi ro hoặc chạy không giám sát, chạy trong dev container có firewall.
:::

:::exercise Chuẩn bị cho máy công ty
Viết sẵn hai file cho dự án của bạn: (1) khối `env` cho settings với proxy, `NO_PROXY` (localhost, mạng nội bộ, registry npm nội bộ nếu có) và CA; (2) `.devcontainer/devcontainer.json` có Node 22, feature Claude Code, volume giữ đăng nhập. Thử mở cc-lab trong dev container và chạy `claude doctor`.
???
Kiểm tra: trong container, `claude --version` chạy; `claude doctor` không báo lỗi cài đặt; sau **Rebuild Container** không phải đăng nhập lại (nhờ volume + `CLAUDE_CONFIG_DIR`). Nếu npm trong công ty dùng registry nội bộ, cấu hình `.npmrc` riêng — biến proxy của Claude Code không thay thế cấu hình npm. Đừng commit mật khẩu proxy vào `devcontainer.json`.
:::

> Nguồn: *Enterprise network configuration*, *Development containers* — code.claude.com/docs/en/network-config, /devcontainer (truy cập 12/11/2026).
