---
title: Hook nâng cao — quyết định bằng JSON, hook dạng prompt, agent và http, audit tập trung cho team
summary: "Vượt khỏi exit 0/2: trả JSON allow/deny/ask kèm lý do; hook prompt để model phán đoán, hook agent để kiểm tra thật, hook http gửi sự kiện tới dịch vụ audit của team — kèm máy chủ hook Node đã chạy thử và cách chọn fail-open hay fail-closed."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, hooks, http-hooks, prompt-hooks, audit]
related: [claude-code/deep-dive/extending/hooks-thuc-chien, claude-code/labs/labs/hooks-format-bao-ve-cong-test]
---

## TL;DR

| `type` | Ai quyết định | Hợp khi | Timeout mặc định |
|---|---|---|---|
| `command` | Script của bạn | Quy tắc tất định (đường dẫn, mẫu lệnh) | 10 phút |
| `prompt` | Một lần gọi model, trả `{"ok", "reason"}` | Cần **phán đoán** chỉ từ dữ liệu của sự kiện | 30 giây |
| `agent` (thử nghiệm) | Một subagent có công cụ | Cần **kiểm tra thực tế** codebase (chạy test, đọc file) | 60 giây |
| `http` | Dịch vụ web của bạn | Logic dùng chung cho cả team (audit, chính sách tập trung) | 10 phút |

## 1. Quyết định bằng JSON thay vì exit code

Hook `PreToolUse` có thể in JSON ra stdout (exit 0) để nói rõ quyết định:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Không chạy migration ngoài script migrations"
  }
}
```

| `permissionDecision` | Kết quả |
|---|---|
| `"allow"` | Bỏ qua hộp thoại quyền (trừ các hành động không chế độ nào tự duyệt) |
| `"deny"` | Chặn; lý do được gửi cho Claude |
| `"ask"` | Hỏi người dùng; lý do hiện trong hộp thoại |
| `"defer"` | Kết thúc lượt để tiếp tục sau (chỉ với `-p`) |

- Rule `deny`/`ask` trong settings **vẫn** được xét bất kể hook trả gì — hook không vượt được rule.
- `updatedInput` trong `hookSpecificOutput` thay đối số của công cụ trước khi chạy (vd thêm `--dry-run`).
- Exit 0 **không** có output = không quyết định (không phải "allow").

Ví dụ tự duyệt lệnh chỉ đọc của Nx trong repo:

```bash title=".claude/hooks/allow-nx-readonly.sh"
#!/bin/bash
CMD=$(jq -r '.tool_input.command // empty')
if [[ "$CMD" =~ ^npx\ nx\ (graph|show|print-affected)(\ |$) ]]; then
  jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",permissionDecisionReason:"Lệnh Nx chỉ đọc"}}'
fi
exit 0
```

## 2. Hook `prompt` — khi cần phán đoán

```json title="Stop: chưa xong thì làm tiếp"
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if all tasks the user requested are complete, including tests. If not, respond with {\"ok\": false, \"reason\": \"what remains to be done\"}."
          }
        ]
      }
    ]
  }
}
```

Model chỉ trả `{"ok": true}` hoặc `{"ok": false, "reason": "..."}`:

- `Stop`/`SubagentStop`: `reason` trở thành chỉ dẫn tiếp theo để Claude làm tiếp (trừ khi đánh dấu `"impossible": true`).
- `PreToolUse`: chặn lần gọi; mặc định kết thúc lượt — đặt `continueOnBlock: true` để Claude nhận lý do và tự điều chỉnh.
- `$ARGUMENTS` trong `prompt` được thay bằng JSON đầu vào của sự kiện; trường `model` chọn model khác.

## 3. Hook `agent` — kiểm tra thật (thử nghiệm)

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify that all unit tests pass by running npm test -- --watch=false. $ARGUMENTS",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

Subagent được đọc file, chạy lệnh (tối đa 50 lượt công cụ) rồi trả `ok/reason`. Tính năng còn thử nghiệm — cho quy trình chính thức nên dùng hook `command` (như Stop hook ở Lab 06).

## 4. Hook `http` — audit và chính sách tập trung

```json title=".claude/settings.json"
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8787/hooks/pre-tool-use",
            "timeout": 10,
            "headers": { "Authorization": "Bearer $HOOK_TOKEN" },
            "allowedEnvVars": ["HOOK_TOKEN"]
          }
        ]
      }
    ]
  }
}
```

Claude Code POST **cùng JSON** mà hook command nhận qua stdin; phản hồi dùng **cùng định dạng JSON output**. Biến trong `headers` chỉ được thay nếu có tên trong `allowedEnvVars` (tránh lộ biến môi trường ngoài ý muốn).

Máy chủ mẫu (đã chạy thử: lệnh có `prod` → trả `deny`; `npm test` → body rỗng; thiếu token → 401):

```js title="hook-server.mjs"
import { createServer } from 'node:http';
import { appendFile } from 'node:fs/promises';

const TOKEN = process.env.HOOK_TOKEN;

createServer(async (req, res) => {
  if (req.method !== 'POST' || req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401).end();
    return;
  }
  let body = '';
  for await (const chunk of req) body += chunk;
  const input = JSON.parse(body);
  const command = input.tool_input?.command ?? '';

  await appendFile(
    'audit.log',
    JSON.stringify({ at: new Date().toISOString(), session: input.session_id, command }) + '\n',
  );

  res.writeHead(200, { 'content-type': 'application/json' });
  if (/\b(prod|production)\b/i.test(command)) {
    res.end(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Lệnh nhắm vào production — hỏi người phụ trách release.',
        },
      }),
    );
  } else {
    res.end(); // 2xx + body rỗng = không quyết định, luồng quyền bình thường tiếp tục
  }
}).listen(8787, () => console.log('hook server on :8787'));
```

### Phản hồi HTTP được hiểu thế nào

| Phản hồi | Kết quả |
|---|---|
| 2xx, body rỗng | Thành công, không quyết định (như exit 0 không output) |
| 2xx, body JSON hợp lệ | Áp dụng quyết định trong JSON |
| 2xx, body văn bản thường | Lỗi không chặn |
| Không phải 2xx, lỗi kết nối | Lỗi không chặn — **hành động vẫn chạy** |
| Quá timeout | Hook bị huỷ |

## 5. Fail-open hay fail-closed?

Mặc định hook lỗi là **fail-open** (hành động tiếp tục). Với hook bảo vệ (dịch vụ chính sách sập không được biến thành "cho phép hết"), đặt:

```json
{ "type": "http", "url": "…", "onFailure": "block" }
```

`onFailure: "block"` chặn hành động khi hook lỗi. Cân nhắc: dịch vụ chính sách sập → mọi người bị chặn làm việc; cần giám sát dịch vụ đó như hạ tầng quan trọng.

:::warning Hook chạy với quyền của bạn
Hook `command` chạy lệnh trên máy bạn; hook `http` gửi **dữ liệu sự kiện** (gồm lệnh, đường dẫn, có thể cả nội dung) tới URL. Chỉ trỏ tới dịch vụ nội bộ tin cậy, dùng HTTPS ngoài localhost, đừng ghi log nội dung file nhạy cảm.
:::

:::senior Góc nhìn senior
Dùng hook `http` + managed settings để có **một nơi** thực thi chính sách và audit cho cả tổ chức, thay vì mỗi repo một script. Nhưng giữ logic tất định ở `command`/`http` của bạn; dùng `prompt`/`agent` chỉ khi thật sự cần phán đoán — chúng chậm hơn, tốn token và khó dự đoán hơn.
:::

:::quiz Dịch vụ hook HTTP của team trả 503 vì đang bảo trì. Theo mặc định, lệnh Bash Claude định chạy sẽ thế nào?
- [ ] Bị chặn
- [x] Vẫn chạy — lỗi HTTP là lỗi không chặn, trừ khi hook đặt `onFailure: "block"`
- [ ] Claude Code thoát
- [ ] Hỏi người dùng

Hook bảo vệ quan trọng cần cân nhắc fail-closed.
:::

:::quiz Bạn muốn hook chặn khi Claude định kết thúc mà còn việc dang dở, dựa trên phán đoán (không có lệnh kiểm tra cụ thể). Loại hook nào?
- [ ] `command` với `exit 2`
- [x] `prompt` ở sự kiện `Stop`, trả `{"ok": false, "reason": "..."}` khi chưa xong
- [ ] `http` ở `SessionStart`
- [ ] `PostToolUse`

Nếu có lệnh kiểm tra cụ thể (test), hook `command` tất định là lựa chọn tốt hơn.
:::

:::exercise Dựng audit tập trung cho cc-lab
(1) Chạy máy chủ hook mẫu với `HOOK_TOKEN` tự đặt; (2) cấu hình hook `http` cho `PreToolUse` matcher `Bash` trong cc-lab; (3) nhờ Claude chạy `npm test` (được phép, có dòng audit) và `echo deploy to prod` (bị chặn với lý do); (4) dừng máy chủ, thử lại — quan sát fail-open; (5) thêm `onFailure: "block"` và thử lại.
???
Kỳ vọng: (3) `audit.log` có hai dòng; Claude nhận lý do "Lệnh nhắm vào production…" và không chạy lệnh thứ hai. (4) Máy chủ tắt → lỗi kết nối là lỗi không chặn → lệnh chạy (transcript có thông báo hook error). (5) Với `onFailure: "block"` → lệnh bị chặn khi máy chủ không phản hồi. Đặt `HOOK_TOKEN` trong môi trường trước khi chạy `claude` (và khai báo trong `allowedEnvVars`), không ghi token vào file settings commit.
:::

> Nguồn: *Hooks reference* (HTTP hook fields, Prompt and agent hook fields, JSON output, PreToolUse decision control, HTTP response handling), *Automate actions with hooks* — code.claude.com/docs/en/hooks, /hooks-guide (truy cập 12/11/2026). Máy chủ hook mẫu đã chạy thử với curl.
