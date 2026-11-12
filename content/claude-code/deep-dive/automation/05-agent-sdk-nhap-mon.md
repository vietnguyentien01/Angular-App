---
title: Agent SDK nhập môn — xây agent riêng bằng TypeScript với cùng vòng lặp và công cụ của Claude Code
summary: "Khi script claude -p không còn đủ: Agent SDK cho bạn gọi vòng lặp agent của Claude Code từ code TypeScript/Python. So sánh với CLI, Client SDK, Managed Agents; cài đặt; một agent kiểm tra a11y cho dự án Angular (đã type-check); xác thực và quy định thương hiệu."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, agent-sdk, typescript, automation]
related: [claude-code/deep-dive/automation/headless-va-ci, claude-code/deep-dive/extending/subagent]
---

## TL;DR

- **Agent SDK** = thư viện chạy chính Claude Code như một **component** trong ứng dụng của bạn: cùng công cụ (đọc/sửa file, chạy lệnh, tìm web), cùng vòng lặp agent, permission, hook, subagent, MCP, session.
- Dùng khi cần **code** điều khiển agent: xử lý từng sự kiện stream, duyệt quyền theo logic riêng, nhúng vào dịch vụ nội bộ. Việc đơn giản → `claude -p` là đủ.
- Xác thực bằng **API key** (hoặc Bedrock/Vertex/Foundry). Sản phẩm của bên thứ ba **không** được dùng đăng nhập claude.ai nếu chưa được duyệt.

## Chọn công cụ nào?

| Bạn muốn | Dùng | Có sẵn gì |
|---|---|---|
| Làm việc tương tác, chạy việc lẻ trong terminal | Claude Code CLI | Giao diện terminal |
| Script/CI đơn giản, ngôn ngữ bất kỳ | `claude -p --output-format json` | Gọi CLI như subprocess |
| Nhúng agent vào ứng dụng TypeScript/Python bạn vận hành | **Agent SDK** | Công cụ, permission, session, hook, subagent, MCP, skill, plugin của Claude Code |
| Gọi thẳng Claude API, tự viết vòng lặp công cụ | Client SDK | Truy cập API trực tiếp |
| Để Anthropic host agent và sandbox | Managed Agents | Harness được host |

## Cài đặt (TypeScript)

```bash
mkdir a11y-agent && cd a11y-agent
npm init -y && npm pkg set type=module
npm install @anthropic-ai/claude-agent-sdk
npm install --save-dev tsx
export ANTHROPIC_API_KEY=...        # SDK không tự đọc .env
```

SDK cài kèm binary Claude Code qua optional dependencies — đừng dùng `npm ci --omit=optional`. Cloud provider: `CLAUDE_CODE_USE_BEDROCK=1`, `CLAUDE_CODE_USE_VERTEX=1`, `CLAUDE_CODE_USE_FOUNDRY=1` kèm credential tương ứng.

## Agent mẫu: kiểm tra a11y cho template Angular

```ts title="a11y-agent.ts (đã type-check với @anthropic-ai/claude-agent-sdk, TypeScript strict)"
import { query } from '@anthropic-ai/claude-agent-sdk';
import { writeFile } from 'node:fs/promises';

const target = process.argv[2] ?? 'src/app';

let report = '';
let cost = 0;

for await (const message of query({
  prompt:
    `Audit accessibility of Angular templates under ${target}: inputs/selects/buttons without an accessible name, ` +
    `images without alt, click handlers on non-interactive elements, missing aria-describedby for error messages. ` +
    `Do not edit files. Answer as a markdown table: file:line | problem | suggested fix.`,
  options: {
    allowedTools: ['Read', 'Glob', 'Grep'],
    permissionMode: 'dontAsk',
    maxTurns: 15,
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: 'Reply in Vietnamese, keep technical terms in English.',
    },
  },
})) {
  if (message.type === 'assistant') {
    for (const block of message.message.content) {
      if (block.type === 'tool_use') console.error(`→ ${block.name}`);
    }
  } else if (message.type === 'result') {
    cost = message.total_cost_usd;
    if (message.subtype === 'success') report = message.result;
    else console.error(`Kết thúc: ${message.subtype}`);
  }
}

await writeFile('a11y-report.md', report);
console.error(`Đã ghi a11y-report.md — chi phí ước tính $${cost.toFixed(4)}`);
```

```bash
cd ~/projects/cc-lab
npx tsx ../a11y-agent/a11y-agent.ts src/app
```

Đọc code:

- `query()` trả về **async iterator** các message: `assistant` (lời và lần gọi công cụ), `result` (kết quả cuối, chi phí, `subtype` là `success` hay lý do dừng).
- `allowedTools` + `permissionMode: 'dontAsk'`: chỉ đọc; mọi thứ khác bị từ chối — giống cấu hình CLI khoá chặt.
- `maxTurns`: giới hạn số lượt.
- `systemPrompt` dạng preset `claude_code` + `append`: giữ system prompt mặc định của Claude Code, thêm quy tắc riêng (tương đương `--append-system-prompt`).

## SDK làm được gì thêm so với `-p`

| Khả năng | Dùng để |
|---|---|
| Hook bằng code | Chặn/ghi log từng lần gọi công cụ theo logic của bạn |
| Subagent | Định nghĩa worker chuyên biệt ngay trong code |
| MCP và custom tool | Cho agent gọi API nội bộ của bạn như công cụ |
| Permission tuỳ biến | Callback quyết định duyệt/từ chối, hỏi người dùng qua UI của bạn |
| Session | Tiếp tục, fork hội thoại theo ID — agent nhiều bước qua nhiều request |
| Skill, CLAUDE.md, plugin | Tự nạp từ `.claude/` của dự án như Claude Code |

## Lưu ý khi đưa vào sản phẩm

- **Xác thực**: API key hoặc cloud provider; không dùng đăng nhập claude.ai cho sản phẩm của bạn (trừ khi được Anthropic duyệt).
- **Thương hiệu**: có thể gọi là "Claude Agent" hoặc "<Tên> Powered by Claude"; **không** được gọi sản phẩm là "Claude Code" hay bắt chước giao diện Claude Code.
- **Điều khoản**: theo Commercial Terms của Anthropic.
- Áp dụng mọi nguyên tắc của chạy không giám sát: quyền tối thiểu, giới hạn lượt/chi phí, đầu ra có cấu trúc, người duyệt cho thao tác không hoàn tác được.

:::senior Góc nhìn senior
Đừng vội viết agent bằng SDK cho thứ một dòng `claude -p` hay một skill làm được. SDK đáng giá khi agent là **một phần của hệ thống** — cần UI duyệt quyền riêng, tích hợp API nội bộ dạng công cụ, lưu session vào storage của bạn, hay chạy như một dịch vụ cho người không dùng terminal. Khi đó, thiết kế nó như một service: observability (log từng tool call), giới hạn, test.
:::

:::quiz Bạn cần một công cụ nội bộ có giao diện web, nơi QA bấm nút "Kiểm tra a11y" và duyệt từng hành động agent muốn làm. Chọn gì?
- [ ] `claude -p` trong cron
- [x] Agent SDK — nhúng vòng lặp agent vào dịch vụ của bạn, xử lý duyệt quyền bằng callback và UI riêng
- [ ] Output style
- [ ] Một hook Stop

`-p` không có cách duyệt tương tác từ UI của bạn.
:::

:::quiz Đặt tên sản phẩm nội bộ xây bằng Agent SDK thế nào cho đúng quy định thương hiệu?
- [ ] "Claude Code Pro nội bộ"
- [x] Tên riêng, có thể kèm "Powered by Claude" hoặc gọi là "Claude Agent"
- [ ] "Claude Code Agent"
- [ ] Bắt chước giao diện Claude Code cho quen

Sản phẩm không được trông như Claude Code hay sản phẩm của Anthropic.
:::

:::exercise Chạy và mở rộng agent a11y
(1) Chạy agent mẫu trên cc-lab, đọc `a11y-report.md`. (2) Sửa để nó trả **JSON** thay vì bảng markdown và ghi `a11y-report.json`. (3) Cho script exit code 1 khi có vấn đề, để dùng trong CI.
???
(2) Đổi prompt thành *"Answer ONLY with a JSON array of {file, line, problem, fix}"* rồi `JSON.parse(report)` (bọc try/catch, báo lỗi nếu không parse được); hoặc dùng tuỳ chọn output có cấu trúc của SDK (xem tài liệu *Get structured output from agents*) để có kết quả đã kiểm tra theo schema. (3) Sau khi ghi file: `if (issues.length > 0) process.exitCode = 1;`. Trong CI đặt `ANTHROPIC_API_KEY` từ secret, giữ `permissionMode: 'dontAsk'` và `allowedTools` chỉ đọc.
:::

> Nguồn: *Agent SDK overview*, *Quickstart* — code.claude.com/docs/en/agent-sdk/overview, /agent-sdk/quickstart (truy cập 12/11/2026). Ví dụ đã type-check với gói `@anthropic-ai/claude-agent-sdk` (TypeScript strict); chưa chạy gọi API thật trong môi trường biên soạn.
