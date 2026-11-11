---
title: Flag dòng lệnh — giải thích từng flag của claude theo nhóm
summary: "Mọi flag khi khởi động claude, nhóm theo mục đích: phiên và resume, model và effort, quyền và công cụ, system prompt, chế độ không tương tác và output, MCP/plugin/settings, phiên nền và worktree, debug, IDE/Chrome/cloud/Remote Control — mỗi flag có ví dụ."
type: cheatsheet
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, cli, flags, reference]
related: [claude-code/commands/commands/lenh-claude-tren-shell, claude-code/deep-dive/automation/headless-va-ci]
---

## Ghi nhớ

- `claude --help` **không** liệt kê mọi flag.
- Nhiều flag chỉ có tác dụng ở **print mode** (`-p`) — đánh dấu *(-p)* bên dưới.
- Flag thắng settings trong file cho phiên đó (trừ managed settings).

## Phiên và resume

| Flag | Làm gì | Ví dụ |
|---|---|---|
| `--continue`, `-c` | Tiếp tục hội thoại gần nhất trong thư mục (bỏ qua phiên tạo bằng `-p`/SDK và phiên bắt đầu bằng `/loop`) | `claude -c` |
| `--resume`, `-r` | Mở lại theo ID, tên, đường dẫn file `.jsonl`, hoặc mở bộ chọn | `claude -r auth-refactor` |
| `--fork-session` | Khi resume, tạo phiên **mới** thay vì ghi tiếp vào phiên cũ | `claude -r abc123 --fork-session` |
| `--from-pr` | Bộ chọn lọc theo PR (số, URL GitHub/GitLab/Bitbucket) | `claude --from-pr 123` |
| `--name`, `-n` | Đặt tên phiên ngay khi mở | `claude -n "orders-paging"` |
| `--session-id` | Dùng một session ID (UUID) cụ thể | `claude --session-id "550e8400-…"` |
| `--no-session-persistence` | Không lưu phiên ra đĩa *(-p)* | `claude -p --no-session-persistence "…"` |

## Model và suy luận

| Flag | Làm gì | Ví dụ |
|---|---|---|
| `--model` | Model cho phiên (alias hoặc ID đầy đủ); thắng setting `model` và `ANTHROPIC_MODEL` | `claude --model opus` |
| `--effort` | `low`, `medium`, `high`, `xhigh`, `max`, `ultracode` | `claude --effort high` |
| `--fallback-model` | Chuỗi model dự phòng khi model chính quá tải/không có | `claude --fallback-model sonnet,haiku` |
| `--advisor` | Bật advisor với model chỉ định | `claude --advisor opus` |
| `--betas` | Header beta cho API (chỉ người dùng API key) | `claude --betas interleaved-thinking` |

## Quyền và công cụ

| Flag | Làm gì | Ví dụ |
|---|---|---|
| `--permission-mode` | `default`/`manual`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` | `claude --permission-mode plan` |
| `--allowedTools` | Công cụ/lệnh chạy không cần hỏi (cú pháp permission rule) | `--allowedTools "Read,Edit,Bash(npm test *)"` |
| `--disallowedTools` | Rule deny; tên trần gỡ hẳn công cụ (`"Edit"`, `"mcp__*"`) | `--disallowedTools "Bash(git push *)"` |
| `--tools` | Giới hạn bộ công cụ có sẵn: `""` tắt hết, `"default"`, hoặc danh sách | `claude --tools "Read,Grep,Glob"` |
| `--dangerously-skip-permissions` | = `bypassPermissions` — chỉ trong môi trường cô lập | — |
| `--allow-dangerously-skip-permissions` | Thêm bypass vào vòng `Shift+Tab` mà không bắt đầu ở đó | `claude --permission-mode plan --allow-dangerously-skip-permissions` |
| `--permission-prompts` | Ai trả lời hộp thoại quyền *(-p)*: `host` (mặc định) hoặc `none` (từ chối hết) | `--permission-mode auto --permission-prompts none` |
| `--permission-prompt-tool` | Một MCP tool xử lý hộp thoại quyền *(-p)* | `--permission-prompt-tool mcp__approver__check` |
| `--restricted` | Chế độ hạn chế cho môi trường dùng chung (gỡ công cụ chạy lệnh/code và WebFetch, không đọc settings của máy) | `claude --restricted` |
| `--add-dir` | Cho phép đọc/sửa thêm thư mục | `claude --add-dir ../shared-lib` |
| `--disable-slash-commands` | Tắt mọi skill và command | — |

## System prompt

| Flag | Làm gì |
|---|---|
| `--append-system-prompt "…"` | **Thêm** vào cuối system prompt mặc định — giữ nguyên hướng dẫn công cụ và an toàn (thường là lựa chọn đúng) |
| `--append-system-prompt-file <file>` | Như trên, đọc từ file |
| `--system-prompt "…"` | **Thay toàn bộ** system prompt mặc định |
| `--system-prompt-file <file>` | Thay bằng nội dung file |
| `--system-prompt-snapshot off` | Dựng lại prompt mỗi request (khi đang chỉnh nội dung append qua nhiều lần `--continue`) |
| `--append-subagent-system-prompt`, `--append-subagent-system-prompt-file` | Thêm vào system prompt của mọi subagent *(-p)* |
| `--exclude-dynamic-system-prompt-sections` | Đưa phần ngữ cảnh theo người dùng ra khỏi system prompt để tái dùng prompt cache tốt hơn giữa các máy |

```bash
claude -p --append-system-prompt-file ./review-rules.md "Review diff hiện tại"
```

Quy ước luôn cần theo → CLAUDE.md; persona chuyển đổi được → output style; quy tắc cho một lần chạy script → `--append-system-prompt`.

## Không tương tác và output

| Flag | Làm gì | Ví dụ |
|---|---|---|
| `--print`, `-p` | Chế độ không tương tác | `claude -p "…"` |
| `--output-format` | `text`, `json`, `stream-json` *(-p)* | `--output-format json` |
| `--json-schema` | Ép output theo JSON Schema; kết quả ở `structured_output` *(-p)* | `--json-schema '{…}'` |
| `--input-format` | `text` hoặc `stream-json` *(-p)* | — |
| `--include-partial-messages` | Sự kiện streaming từng phần (cần `stream-json`) | — |
| `--verbose` | Log đầy đủ từng lượt | — |
| `--max-turns` | Giới hạn số lượt *(-p)* | `--max-turns 10` |
| `--max-budget-usd` | Dừng khi chi phí ước tính đạt mức *(-p)* | `--max-budget-usd 2` |
| `--bare` | Bỏ qua tự phát hiện hook, skill, plugin, MCP, auto memory, CLAUDE.md — lần chạy tái lập được | `claude --bare -p "…"` |
| `--forward-subagent-text` | Đưa text của subagent vào stream output | — |
| `--include-hook-events` | Đưa sự kiện hook vào stream output | — |
| `--replay-user-messages` | Phát lại tin nhắn user từ stdin ra stdout (stream-json) | — |
| `--prompt-suggestions` | Phát gợi ý prompt tiếp theo sau mỗi lượt (stream-json) | — |
| `--init`, `--maintenance` | Chạy Setup hook (`init`/`maintenance`) trước phiên *(-p)* | `claude -p --init "…"` |
| `--init-only` | Chạy Setup và SessionStart hook rồi thoát | — |

## MCP, plugin, settings, agent

| Flag | Làm gì | Ví dụ |
|---|---|---|
| `--mcp-config` | Nạp MCP server từ file/chuỗi JSON | `--mcp-config ./ci-mcp.json` |
| `--strict-mcp-config` | **Chỉ** dùng server từ `--mcp-config` | `--strict-mcp-config --mcp-config ./mcp.json` |
| `--settings` | File hoặc chuỗi JSON settings cho phiên | `--settings ./ci-settings.json` |
| `--setting-sources` | Chọn nguồn settings được nạp: `user,project,local` | `--setting-sources user,project` |
| `--plugin-dir` | Nạp plugin từ thư mục/`.zip` cho phiên này | `--plugin-dir ./my-plugin` |
| `--plugin-url` | Tải plugin `.zip` từ URL cho phiên này | — |
| `--agent` | Chạy cả phiên dưới dạng một subagent | `claude --agent angular-reviewer` |
| `--agents` | Định nghĩa subagent bằng JSON cho phiên | `--agents '{"reviewer":{…}}'` |
| `--autocompact` | Ngưỡng tự compact cho phiên | `--autocompact 500k` |
| `--safe-mode` | Tắt mọi tuỳ biến (CLAUDE.md, skill, plugin, hook, MCP…) để khoanh vùng lỗi cấu hình | `claude --safe-mode` |

## Phiên nền, song song, worktree

| Flag | Làm gì | Ví dụ |
|---|---|---|
| `--bg`, `--background` | Chạy phiên nền và trả terminal ngay | `claude --bg "chạy toàn bộ test và tóm tắt lỗi"` |
| `--exec` | Cùng `--bg`: chạy **lệnh shell** thành job nền | `claude --bg --exec 'npm run e2e'` |
| `--worktree`, `-w` | Mở trong git worktree riêng; nhận cả `#123` hoặc URL PR để tạo nhánh từ PR | `claude -w feature-auth` |
| `--tmux` | Tạo tmux session cho worktree (cần `-w`) | `claude -w feat --tmux` |
| `--teammate-mode` | Cách hiển thị teammate của agent team | — |

## IDE, trình duyệt, cloud, Remote Control

| Flag | Làm gì | Ví dụ |
|---|---|---|
| `--ide` | Tự kết nối IDE khi khởi động (nếu có đúng một IDE) | `claude --ide` |
| `--chrome` / `--no-chrome` | Bật/tắt tích hợp Chrome | `claude --chrome` |
| `--cloud` | Tạo cloud session với task (hoặc gửi tin vào phiên cloud có sẵn với `-p`) | `claude --cloud "fix lint và mở PR"` |
| `--remote` | Alias cũ của `--cloud` | — |
| `--teleport` | Kéo cloud session về terminal | `claude --teleport` |
| `--environment`, `--ref` | Tạo cloud session trên self-hosted environment, dựa trên ref chỉ định | — |
| `--remote-control`, `--rc` | Mở phiên tương tác có bật Remote Control | `claude --rc "Dự án Orders"` |
| `--remote-control-session-name-prefix` | Tiền tố tên phiên Remote Control | — |
| `--desktop` | Mở Claude Desktop ở thư mục hiện tại rồi thoát | `claude --desktop --continue` |
| `--channels` | (Preview) nghe sự kiện channel từ MCP server | — |
| `--dangerously-load-development-channels` | Bật channel chưa có trong allowlist, chỉ để phát triển cục bộ (hỏi xác nhận; bị bỏ qua với `-p`) | — |

## Debug và hiển thị

| Flag | Làm gì | Ví dụ |
|---|---|---|
| `--debug` | Bật debug, lọc theo nhóm | `claude --debug='mcp,startup'` |
| `--debug-file` | Ghi debug log ra file | `--debug-file /tmp/cc.log` |
| `--ax-screen-reader` | Output thân thiện với trình đọc màn hình | — |
| `--version`, `-v` | In phiên bản | `claude -v` |

## Ba công thức hay dùng

```bash title="Khám phá repo lạ an toàn"
claude --permission-mode plan -n "onboarding-repo-x"
```

```bash title="Job CI khoá chặt"
claude --bare -p "Chạy lint và sửa lỗi format" \
  --allowedTools "Read,Edit,Bash(npm run lint *)" \
  --permission-mode dontAsk --max-turns 15 --output-format json
```

```bash title="Khoanh vùng lỗi cấu hình"
claude --safe-mode          # hết lỗi → do tuỳ biến; bật lại từng phần
claude --debug='mcp'        # nghi MCP
```

:::quiz Bạn muốn Claude vẫn là trợ lý code mặc định nhưng thêm quy tắc review riêng cho một script. Flag nào?
- [ ] `--system-prompt`
- [x] `--append-system-prompt` (hoặc `-file`)
- [ ] `--agents`
- [ ] `--tools`

`--system-prompt` thay toàn bộ prompt mặc định, mất hướng dẫn công cụ và an toàn có sẵn.
:::

:::quiz Khác nhau giữa `--tools "Read,Grep"` và `--allowedTools "Read,Grep"`?
- [ ] Giống nhau
- [x] `--tools` giới hạn công cụ **có sẵn**; `--allowedTools` cho phép công cụ chạy **không cần hỏi** (công cụ khác vẫn có, nhưng cần duyệt)
- [ ] `--tools` chỉ cho MCP
- [ ] `--allowedTools` chỉ cho Bash

Muốn Claude không thể sửa file: `--tools` không có Edit/Write.
:::

:::exercise Viết lệnh khởi động cho bốn tình huống
(1) Review code của đồng nghiệp, không được sửa file, model mạnh. (2) Script hằng đêm sửa lint, tối đa 10 lượt, output JSON. (3) Thử cấu hình MCP mới mà không dùng các server đang có. (4) Mở lại phiên "orders-paging" nhưng thử hướng khác mà không ghi đè phiên cũ.
???
(1) `claude --permission-mode plan --model opus` (hoặc `--tools "Read,Grep,Glob"` để chắc chắn không sửa). (2) `claude --bare -p "Sửa lỗi lint" --allowedTools "Read,Edit,Bash(npm run lint *)" --permission-mode dontAsk --max-turns 10 --output-format json`. (3) `claude --strict-mcp-config --mcp-config ./thu-nghiem-mcp.json`. (4) `claude -r orders-paging --fork-session`.
:::

> Nguồn: *CLI reference* — code.claude.com/docs/en/cli-reference (truy cập 11/11/2026).
