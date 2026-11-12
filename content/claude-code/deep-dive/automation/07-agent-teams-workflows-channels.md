---
title: Phối hợp nhiều agent — agent teams, dynamic workflows, nhắn tin giữa các phiên, channels
summary: "Khi một phiên với vài subagent không còn đủ: agent teams (lead + teammate phối hợp qua task list), dynamic workflows (script điều phối hàng trăm agent, lưu thành lệnh), nhắn tin giữa các phiên, channels đẩy sự kiện vào phiên — so sánh, cách bật, prompt mẫu, giới hạn."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, agent-teams, workflows, cross-session, channels]
related: [claude-code/deep-dive/automation/lam-viec-song-song, claude-code/deep-dive/extending/subagent]
---

## TL;DR

| | Subagent | Agent team | Dynamic workflow |
|---|---|---|---|
| Là gì | Worker Claude gọi trong phiên | Lead giám sát các teammate ngang hàng | **Script** do runtime thực thi |
| Ai quyết định bước tiếp | Claude, từng lượt | Lead, từng lượt | Script |
| Kết quả trung gian nằm ở | Context của Claude | Task list chung | Biến trong script |
| Quy mô | Vài việc mỗi lượt | Một nhóm nhỏ chạy lâu | Hàng chục tới hàng trăm agent |
| Lặp lại được | Định nghĩa worker | Định nghĩa team | Chính cách điều phối |
| Trạng thái | Ổn định | **Thử nghiệm, tắt mặc định** | Có trên các gói trả phí (Pro phải bật trong `/config`) |

Cộng thêm: **nhắn tin giữa các phiên** (phiên A báo cho phiên B) và **channels** (sự kiện từ Telegram/Discord/CI đẩy vào phiên đang mở, research preview).

Bắt đầu bằng thứ nhẹ nhất đủ dùng: subagent → (nhắn tin giữa phiên) → workflow / agent team.

## Agent teams (thử nghiệm)

Một phiên là **lead**: điều phối, giao việc, tổng hợp. Các **teammate** là phiên Claude riêng, context riêng, **nhắn tin trực tiếp** cho nhau và nhận việc từ task list chung. Bạn cũng nói chuyện trực tiếp với từng teammate được.

```json title="Bật trong settings.json"
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }
}
```

Chỉ hoạt động trong phiên **tương tác** (không với `-p`/Agent SDK). Khi bật, subagent mà Claude tự đặt tên cũng có thể chạy như teammate.

Prompt mẫu — review song song theo nhiều góc:

```text
Spawn three teammates to review PR #142:
- One focused on security implications
- One checking performance impact (change detection, bundle size)
- One validating test coverage
Have them each review and report findings.
```

Prompt mẫu — điều tra bằng các giả thuyết cạnh tranh:

```text
Trang /orders thỉnh thoảng hiển thị dữ liệu của bộ lọc cũ. Spawn 4 teammates, mỗi người một giả thuyết
(race condition trong switchMap, cache HTTP, signal không reset, route reuse).
Cho họ tranh luận để bác bỏ giả thuyết của nhau; ghi kết luận chung vào findings.md.
```

Cơ chế tranh luận giúp tránh "neo" vào giả thuyết đầu tiên.

Khi nào dùng: nghiên cứu/review nhiều góc, module mới chia phần độc lập, debug nhiều giả thuyết, thay đổi xuyên tầng. **Không** hợp: việc tuần tự, sửa cùng file, phụ thuộc chặt.

Giới hạn quan trọng: tốn token **nhiều hơn đáng kể** (mỗi teammate là một phiên); `/resume`, `/rewind` không khôi phục teammate; trạng thái task có thể chậm cập nhật; một team mỗi phiên, không team lồng; lead cố định.

## Dynamic workflows

Workflow là **script JavaScript** điều phối nhiều subagent; runtime chạy nền, phiên của bạn vẫn rảnh. Kế hoạch nằm trong **code** thay vì trong đầu Claude → chạy được quy mô lớn, áp dụng mẫu chất lượng (agent kiểm tra chéo phát hiện của nhau), tiếp tục được khi bị gián đoạn.

```text
/deep-research Những thay đổi về SSR và hydration giữa Angular 19 và 22?
```

`/deep-research` là workflow có sẵn. Theo dõi bằng `/workflows` (xem, tạm dừng, tiếp tục, lưu).

Nhờ Claude viết workflow cho việc của bạn — dùng từ khoá `ultracode` hoặc nói thẳng "use a workflow":

```text
ultracode: audit mọi component trong src/app/features cho subscribe() không có cleanup, và kiểm tra chéo từng phát hiện trước khi báo
```

```text
use a workflow to run npx tsc --noEmit and keep fixing the reported errors until the type check passes or two rounds in a row make no progress
```

Bạn duyệt kế hoạch trước khi chạy; mọi lần gọi công cụ của các agent vẫn qua permission và sandbox như thường.

**Lưu thành lệnh**: `/workflows` → chọn lần chạy → `s` → chọn `.claude/workflows/` (chia sẻ cho repo) hoặc `~/.claude/workflows/` (cá nhân). Lần sau chạy bằng `/<tên>`.

## Nhắn tin giữa các phiên

Một phiên của bạn gửi **tin nhắn văn bản** (không phải lịch sử hay file) cho phiên khác — trên máy này, máy khác hoặc cloud. Bật sẵn khi đủ phiên bản.

```text
Báo cho phiên đang làm module payments biết mình vừa đổi kiểu trả về của OrderApi.list() thành Page<Order>.
```

```text
Hỏi phiên ở terminal kia xem migration đã xong chưa.
```

Hợp khi chạy song song nhiều worktree: một phiên đổi API chung thì báo các phiên khác. `/list-agents` (`/peers`) liệt kê phiên nhắn được. Trong auto mode, classifier cũng xét từng tin nhắn gửi đi.

## Channels (research preview)

Channel là MCP server **đẩy sự kiện vào phiên đang mở** — Claude phản ứng khi bạn không ngồi trước terminal, có thể trả lời ngược qua cùng kênh. Bản preview có Telegram, Discord, iMessage (plugin, cần Bun); tự viết channel cho CI của bạn theo *Channels reference*.

```bash
claude --channels plugin:telegram@claude-plugins-official
```

So với `/loop` (hỏi định kỳ): channel nhận sự kiện **ngay khi xảy ra**, không tốn lượt kiểm tra vô ích. Cần đăng nhập Anthropic (claude.ai hoặc Console), không có trên Bedrock/Vertex/Foundry; tổ chức Team/Enterprise phải bật.

:::warning Mọi kênh vào là một cửa cho prompt injection
Tin nhắn từ channel hay từ phiên khác là **dữ liệu**, không phải lệnh của bạn. Giữ hàng rào (permission, deny, branch protection) như với mọi nội dung bên ngoài; không cấp quyền rộng cho phiên chỉ vì nó nhận được yêu cầu qua channel.
:::

:::senior Góc nhìn senior
Đa agent là công cụ cho **vấn đề song song thật sự**, không phải cách làm việc thường ngày. Trước khi bật agent team hay viết workflow, hỏi: việc này có chia được thành phần độc lập không, có phép kiểm tra tự động cho từng phần không, và tôi có review kịp kết quả không? Nếu câu trả lời là không, một phiên tốt với vài subagent sẽ nhanh và rẻ hơn.
:::

:::quiz Bạn cần migrate 300 file theo cùng một mẫu, mỗi file kiểm tra bằng typecheck, muốn chạy lại được lần sau. Lựa chọn phù hợp nhất?
- [ ] Một agent team 300 teammate
- [x] Một dynamic workflow (hoặc `/batch`) — script điều phối quy mô lớn, lưu lại thành lệnh được
- [ ] Một subagent duy nhất
- [ ] Channels

Agent team hợp với nhóm nhỏ cần thảo luận; workflow hợp với quy mô lớn và lặp lại.
:::

:::quiz Bạn bật agent teams rồi chạy `claude -p "spawn 3 teammates to review"` trong CI. Điều gì xảy ra?
- [ ] Ba teammate được tạo
- [x] Không có teammate — agent teams cần phiên tương tác; ở `-p` subagent chạy như subagent thường
- [ ] Lỗi cú pháp
- [ ] Chạy trên cloud

Dùng workflow hoặc nhiều lệnh `-p` cho CI.
:::

:::exercise Chọn cơ chế và viết prompt
Với mỗi tình huống, chọn cơ chế và viết prompt: (1) review một PR lớn theo ba góc bảo mật, hiệu năng, a11y; (2) audit 200 component tìm `subscribe()` thiếu cleanup và kiểm tra chéo; (3) phiên A ở worktree `api` đổi model dữ liệu, cần báo phiên B ở worktree `ui`; (4) muốn Claude phản ứng khi CI fail mà không cần `/loop`.
???
(1) Agent team (nếu đã bật) hoặc 3 subagent: "Spawn three teammates to review PR #… one each for security, performance (CD, bundle), accessibility; synthesize." (2) Workflow: "ultracode: audit every component under src/app for subscribe() without takeUntilDestroyed/async pipe/unsubscribe, adversarially verify each finding, output a table file:line | observable | fix." (3) Nhắn tin giữa phiên: "Báo cho phiên ở worktree ui: Order giờ có trường priority bắt buộc, OrderApi.list trả Page<Order>." (4) Channel: viết một channel MCP nhận webhook CI (xem Channels reference) và chạy `claude --channels …`; tạm thời có thể dùng `/loop` nếu chưa dựng được.
:::

> Nguồn: *Orchestrate teams of Claude Code sessions*, *Orchestrate subagents at scale with dynamic workflows*, *Message your other Claude Code sessions*, *Push events into a running session with channels*, *Run agents in parallel* — code.claude.com/docs (truy cập 12/11/2026).
