---
title: "Lab 14 — Workflow nhiều agent: chuỗi subagent explorer → implementer → reviewer, điều tra bug song song, và một agent team làm chung tính năng"
summary: "Ba cách cho nhiều agent cùng làm trên cc-lab: phiên chính điều phối chuỗi subagent cho tính năng sắp xếp theo hạn chót, ba subagent điều tra song song một bug cài sẵn theo ba giả thuyết, rồi một agent team chia file và task list làm tính năng thống kê — kèm bảng chọn cơ chế."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, lab, subagents, agent-teams, multi-agent, workflow]
related: [claude-code/deep-dive/automation/agent-teams-workflows-channels, claude-code/deep-dive/extending/subagent, claude-code/labs/labs/subagent-reviewer]
---

## Mục tiêu

- **Phần A:** phiên chính làm "nhạc trưởng" cho một **chuỗi subagent**: khám phá → kế hoạch (bạn duyệt) → triển khai test-first → review → sửa.
- **Phần B:** ba subagent điều tra **song song** một bug theo ba giả thuyết khác nhau, phiên chính so bằng chứng rồi mới sửa.
- **Phần C:** một **agent team** (lead + teammate) chia việc qua task list chung, mỗi teammate sở hữu file riêng.
- **Phần D:** tự rút ra khi nào dùng cơ chế nào, dựa trên số liệu của chính bạn.

**Thời gian:** 2–2,5 giờ (làm được từng phần riêng). Lab này ghi hướng dẫn để **bạn tự chạy**; câu chữ Claude trả lời mỗi lần một khác, hãy kiểm theo bảng *Kết quả bạn nên thấy*.

## Trước khi bắt đầu

- [ ] Đã làm Lab 08 (biết tạo subagent) và Lab 11 (biết làm song song). Có sẵn `.claude/agents/angular-reviewer.md` của Lab 08 — nếu đã xoá, tạo lại theo Lab 08 Bước 2.
- [ ] cc-lab ở nhánh `main`, `git status` sạch, `npm test -- --watch=false` xanh.
- [ ] `claude --version` mới (agent teams là tính năng thử nghiệm, đổi nhanh — chạy `claude update` trước).
- [ ] Phần C tốn token **nhiều hơn đáng kể** (mỗi teammate là một phiên Claude riêng). Gói có giới hạn thấp: làm Phần C vào lúc còn nhiều quota, hoặc giảm còn 2 teammate.

```bash
cd ~/projects/cc-lab
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b lab14-multi-agent
mkdir -p docs/lab14
```

Cho phép sẵn các lệnh kiểm tra để bớt hộp thoại (agent con và teammate đều chạy lệnh test/build):

```json title=".claude/settings.local.json (gộp vào nếu file đã có)"
{
  "permissions": {
    "allow": ["Bash(npm test *)", "Bash(npx ng build*)", "Bash(git diff *)", "Bash(git status*)"]
  }
}
```

## Phần A — Chuỗi subagent cho tính năng "Sắp xếp theo hạn chót"

### Bước A1 — Tạo hai subagent mới

```md title=".claude/agents/task-explorer.md"
---
name: task-explorer
description: Read-only explorer for the cc-lab tasks module. Use to locate code relevant to a change before planning. Never edits files.
tools: Read, Glob, Grep
model: haiku
---
You explore src/app/tasks and related files to answer one question from the caller.
Return a short report:
1. Relevant files with file:line and one sentence each on why they matter.
2. Existing tests that cover the area, and gaps.
3. Conventions you observed (signals, control flow, test style).
Do not propose a full design. Do not edit anything. Keep it under 40 lines.
```

```md title=".claude/agents/task-implementer.md"
---
name: task-implementer
description: Implements an approved plan for cc-lab test-first. Use only after a plan file has been approved by the user.
tools: Read, Glob, Grep, Edit, Write, Bash
model: sonnet
---
You implement exactly the plan file the caller names, step by step.
For each step: write or update the failing test first, run `npm test -- --watch=false`, then implement until green.
Follow repo conventions: signals and computed for state, @if/@for, pure functions for filtering/sorting, every input has a label.
Do not change files the plan does not list. If the plan is wrong or unclear, stop and report instead of improvising.
Finish by running `npm test -- --watch=false` and `npx ng build`, and report: files changed, tests added, both command results.
```

Khởi động phiên (file agent mới tạo cần phiên mới mới nạp):

```bash
claude -n "lab14-a"
```

Gõ `/agents` → thấy `task-explorer`, `task-implementer`, `angular-reviewer`.

### Bước A2 — Giao chuỗi việc, dừng ở kế hoạch

```text
Mình muốn thêm tính năng "Sắp xếp theo hạn chót" cho cc-lab:
- hàm thuần sortByDue(tasks) trả mảng MỚI, tăng dần theo dueDate, cùng hạn thì theo id; không đổi mảng đầu vào
- TaskStore có signal sortByDue (mặc định false); visible áp dụng sắp xếp khi bật
- một checkbox có label "Sắp theo hạn chót" trong TaskList

Làm theo quy trình, mỗi bước báo tóm tắt ngắn:
1. Giao @"task-explorer (agent)" tìm mọi chỗ liên quan tới thứ tự hiển thị, filterTasks, visible và test hiện có.
2. Dựa trên báo cáo đó, viết docs/lab14/plan.md: các bước, file đổi, test cho từng bước. CHƯA code. Dừng lại chờ mình duyệt.
```

Đọc `docs/lab14/plan.md`. Sửa nếu thiếu (vd thiếu test "không đổi mảng đầu vào"). Rồi:

```text
Duyệt plan.md. Tiếp:
3. Giao @"task-implementer (agent)" làm theo docs/lab14/plan.md.
4. Giao @"angular-reviewer (agent)" review git diff so với main.
5. Nếu reviewer báo vấn đề thật (không phải nit), giao lại task-implementer sửa đúng các mục đó, rồi review lại. Tối đa 2 vòng.
6. Báo cáo cuối: bảng các bước, agent nào làm, kết quả test/build, các phát hiện còn mở.
Bạn (phiên chính) không tự sửa code — chỉ điều phối và tổng hợp.
```

### Bước A3 — Kiểm chứng và ghi số liệu

```bash
npm test -- --watch=false
npx ng build
git diff --stat main
```

Trong phiên: `/context` xem context của phiên chính đang dùng bao nhiêu. Ghi vào bảng ở Phần D: thời gian, số vòng review, context phiên chính, và cảm nhận về chi phí (`/usage`).

```bash
git add -A && git commit -m "feat(tasks): sort by due date (lab14 part A)"
```

:::tip Vì sao phiên chính không tự code?
Mỗi subagent làm việc trong **context riêng** và chỉ trả bản tóm tắt. Phiên chính giữ context gọn để điều phối được lâu; reviewer chưa thấy quá trình code nên review khách quan hơn. Subagent **không** gọi được subagent khác — chuỗi luôn do phiên chính nối.
:::

## Phần B — Ba subagent điều tra song song một bug

### Bước B1 — Tự tay cài bug (không dùng Claude)

Trong `src/app/tasks/task-store.ts`, thay `toggleDone` bằng:

```ts title="src/app/tasks/task-store.ts — bản có bug"
toggleDone(id: number): void {
  this.tasks.update((list) => {
    const task = list.find((t) => t.id === id);
    if (task) task.status = task.status === 'done' ? 'todo' : 'done';
    return list;
  });
}
```

```bash
git commit -am "wip: lab14 part B planted bug"
```

Hiện tượng (tự xem bằng `npx ng serve`): chọn lọc "Cần làm", tick checkbox của "Viết unit test" — task **vẫn nằm** trong danh sách "Cần làm" (lẽ ra phải biến mất). Đổi bộ lọc sang loại khác rồi quay lại thì mới đúng.

### Bước B2 — Giao ba giả thuyết song song

Mở phiên mới (`/clear` hoặc `claude -n "lab14-b"`), **đừng** kể bạn đã sửa gì:

```text
Bug: trong cc-lab, đang lọc "Cần làm" mà tick hoàn thành một task thì task đó vẫn nằm trong danh sách; đổi bộ lọc qua lại thì mới đúng.
Chạy SONG SONG 3 subagent task-explorer, mỗi subagent kiểm một giả thuyết, chỉ đọc, không sửa file:
- H1: TaskStore cập nhật state sai cách
- H2: template/binding sự kiện của checkbox trong TaskList sai
- H3: filterTasks hoặc computed visible tính sai
Mỗi subagent trả: giả thuyết, bằng chứng file:line, kết luận ĐÚNG / SAI / CHƯA RÕ.
Sau đó so ba báo cáo, nêu nguyên nhân gốc. CHƯA sửa.
```

### Bước B3 — Chứng minh bằng test rồi mới sửa

```text
Viết test tái hiện trong src/app/tasks/task-store.spec.ts (dùng new TaskStore(), không cần TestBed):
đặt status = 'todo', đọc visible() một lần (phải chứa id 2), gọi toggleDone(2), đọc lại visible() và kỳ vọng KHÔNG còn id 2. Chạy test, cho mình xem nó ĐỎ.
Sau đó sửa toggleDone theo cách bất biến (trả mảng mới) và chạy lại toàn bộ test.
```

```bash
npm test -- --watch=false
git add -A && git commit -m "fix(tasks): immutable toggleDone so computed updates (lab14 part B)"
```

## Phần C — Agent team làm tính năng "Thống kê task"

### Bước C1 — Bật agent teams và viết spec

Agent teams **tắt mặc định**. Bật cho cc-lab (file local, không commit):

```json title=".claude/settings.local.json (thêm khối env)"
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }
}
```

Spec chung cho cả team — **chốt interface trước** để hai teammate làm song song mà không chờ nhau:

```md title="docs/lab14/stats-spec.md"
# Thống kê task

## Interface (không được đổi)
export interface TaskStats { todo: number; doing: number; done: number; overdue: number }
export function taskStats(tasks: Task[], today: string): TaskStats   // file: src/app/tasks/task-stats.ts
overdue dùng isOverdue() có sẵn trong task-filter.ts.

## Panel
TaskStatsPanel (src/app/tasks/task-stats-panel.ts), selector app-task-stats-panel,
input bắt buộc stats: TaskStats. Hiển thị bằng <dl> với nhãn chữ: Cần làm, Đang làm, Xong, Quá hạn.
Khi overdue > 0 thêm chữ "cần xử lý" (không chỉ đổi màu).

## Xong khi
npm test -- --watch=false xanh, npx ng build thành công, panel hiện trên trang.
```

```bash
git add docs/lab14/stats-spec.md && git commit -m "docs: lab14 stats spec"
claude -n "lab14-c"
```

### Bước C2 — Tạo team với quyền sở hữu file rõ ràng

```text
Tạo một agent team gồm 3 teammate để làm docs/lab14/stats-spec.md:
- "stats-logic": CHỈ sở hữu src/app/tasks/task-stats.ts và task-stats.spec.ts. Test-first, phủ cả trường hợp danh sách rỗng và task done quá hạn (không tính overdue).
- "stats-ui": CHỈ sở hữu src/app/tasks/task-stats-panel.ts và task-stats-panel.spec.ts. Import kiểu TaskStats từ './task-stats' đúng interface trong spec; không sửa file của stats-logic.
- "reviewer": dùng subagent type angular-reviewer. Chỉ review sau khi hai task kia completed; gửi phát hiện trực tiếp cho teammate sở hữu file.
Tạo task list với phụ thuộc: task review bị chặn tới khi hai task code xong.
Lead KHÔNG tự code phần của teammate. Khi cả ba xong: lead thêm computed stats vào TaskStore, đặt <app-task-stats-panel [stats]="store.stats()" /> vào TaskList, chạy npm test và ng build, rồi tóm tắt.
```

### Bước C3 — Theo dõi và điều khiển team

| Muốn | Làm (chế độ hiển thị mặc định *in-process*) |
|---|---|
| Xem task list chung | `Ctrl+T` |
| Chọn một teammate | Mũi tên lên/xuống trong agent panel dưới ô nhập |
| Xem phiên của teammate và nhắn trực tiếp | `Enter` rồi gõ tin nhắn |
| Dừng một teammate | Chọn nó rồi nhấn `x` |
| Duyệt quyền | Hộp thoại quyền của teammate hiện ở **phiên lead** — duyệt ở đó |

Thử nhắn trực tiếp cho `stats-ui`: *"nhớ thêm aria-live='polite' cho vùng số liệu"* và xem nó tiếp nhận.

Nếu lead bắt đầu tự code thay teammate:

```text
Wait for your teammates to complete their tasks before proceeding
```

### Bước C4 — Kiểm chứng và dọn team

```bash
npm test -- --watch=false
npx ng build
git status        # chỉ thấy các file trong spec + task-store.ts, task-list.ts
```

```text
Ask all teammates to shut down
```

Teammate xong lượt hiện tại rồi mới tắt (có thể chậm). Thư mục chung của team tự dọn khi phiên kết thúc; task list còn ở `~/.claude/tasks/<tên-team>/` tới khi hết hạn lưu.

```bash
git add -A && git commit -m "feat(tasks): task stats panel by agent team (lab14 part C)"
```

:::warning Giới hạn cần biết của agent teams
`/resume` và `/rewind` **không** khôi phục teammate in-process; mỗi phiên chỉ một team, không team lồng nhau; không chạy với `claude -p`; không đặt được permission mode riêng cho từng teammate lúc tạo (teammate theo mode của lead). Lead đang ở `bypassPermissions` thì teammate cũng vậy — đừng làm lab này ở mode đó.
:::

## Phần D — Chọn cơ chế

Điền từ số liệu của bạn:

| | A: chuỗi subagent | B: subagent song song | C: agent team |
|---|---|---|---|
| Thời gian thực tế | | | |
| Số lần bạn phải can thiệp | | | |
| Context phiên chính (`/context`) | | | |
| Chi phí cảm nhận (`/usage`) | thấp / vừa / cao | | |
| Có xung đột file không | | | |
| Lần sau bạn có dùng lại cho việc này không | | | |

Rồi tự điền quy tắc của bạn:

- Việc **tuần tự**, bước sau cần kết quả bước trước → …
- Nhiều **góc nhìn độc lập** trên cùng câu hỏi, chỉ đọc → …
- Nhiều phần **chia được file**, cần trao đổi với nhau trong lúc làm → …
- Cùng một thay đổi lặp trên **hàng chục, hàng trăm file** → … (gợi ý: `/batch` hoặc dynamic workflow, bài *Phối hợp nhiều agent*)

## Kết quả bạn nên thấy

> Câu chữ Claude trả lời mỗi lần một khác — điều cần kiểm là **kết quả** trong bảng dưới (file đổi gì, lệnh nào pass, agent nào làm việc gì), không phải câu chữ.

| Bước | Dấu hiệu đúng | Nếu khác |
|---|---|---|
| A1 | `/agents` liệt kê `task-explorer`, `task-implementer`, `angular-reviewer` | File phải nằm trong `.claude/agents/`; khởi động lại phiên sau khi tạo file |
| A2 | Thấy lần lượt các dòng gọi agent `task-explorer`; `docs/lab14/plan.md` được tạo; Claude **dừng** chờ duyệt | Phiên chính tự đọc code thay vì giao → @-mention đúng tên agent; Claude code luôn → nhắc "CHƯA code", hoặc vào plan mode trước |
| A2 (tiếp) | `task-implementer` chạy test đỏ trước rồi xanh; reviewer trả danh sách `file:line — vấn đề — sửa` | Implementer sửa file ngoài plan → thêm câu "only files listed in the plan" vào system prompt, chạy lại |
| A3 | Test và build xanh; sắp xếp đúng khi bật checkbox; input không bị đổi thứ tự | Có test "không đổi mảng đầu vào" chưa? Nếu không, thêm và chạy lại |
| B2 | Ba báo cáo chạy gần như cùng lúc; H1 **ĐÚNG** (trả lại cùng tham chiếu `list`, signal coi là không đổi), H2 và H3 **SAI** | Một subagent kết luận khác → yêu cầu nó trích dòng code làm bằng chứng; đó là lý do cần so ba báo cáo |
| B3 | Test mới **đỏ** trước khi sửa, **xanh** sau khi `toggleDone` trả mảng mới (`list.map(...)`) | Test xanh ngay từ đầu → test không đọc `visible()` **trước** khi toggle (computed chưa được cache nên tính mới và trông như đúng), hoặc bug đã bị sửa |
| C2 | Lead tạo task list (Ctrl+T) có 3 task, task review hiện **blocked**; agent panel có 3 teammate | Không thấy teammate → kiểm tra biến `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (`/status`), phiên phải tương tác, cập nhật Claude Code; việc quá nhỏ thì Claude có thể không tạo team — nói rõ "Create an agent team" |
| C3 | Nhắn trực tiếp cho `stats-ui` được; hộp thoại quyền hiện ở lead | Quá nhiều hộp thoại → bổ sung allow rule rồi tạo lại team |
| C4 | `git status` chỉ có file theo spec + `task-store.ts`, `task-list.ts`; test, build xanh; panel hiện số liệu đúng | Hai teammate sửa cùng file → spec chưa đủ rõ về quyền sở hữu; ghi lại vào Phần D |

## Checklist hoàn thành

- [ ] Phần A: `plan.md` được bạn duyệt trước khi có code; ít nhất một vòng reviewer → implementer
- [ ] Phần B: bằng chứng `file:line` cho cả ba giả thuyết; test tái hiện đỏ trước, xanh sau
- [ ] Phần C: task list có phụ thuộc; mỗi teammate chỉ sửa file của mình; team được tắt gọn
- [ ] Phần D: bảng điền đủ và bốn quy tắc chọn cơ chế viết bằng lời của bạn
- [ ] Commit `.claude/agents/task-explorer.md`, `task-implementer.md`; **không** commit `.claude/settings.local.json`

:::quiz Ở Phần A, vì sao phải dừng ở `plan.md` cho bạn duyệt trước khi giao `task-implementer`?
- [ ] Vì subagent không đọc được file
- [x] Vì kế hoạch là điểm rẻ nhất để sửa hướng: implementer làm đúng những gì plan ghi, plan sai thì cả chuỗi sau đều sai
- [ ] Vì agent teams yêu cầu vậy
- [ ] Không cần, chỉ để chậm lại

Đó cũng là lý do system prompt của implementer bảo nó dừng và báo khi plan không rõ, thay vì tự ứng biến.
:::

:::quiz Phần B dùng ba subagent song song thay vì một agent điều tra lần lượt. Lợi ích chính là gì?
- [ ] Luôn rẻ hơn
- [x] Mỗi giả thuyết được kiểm độc lập trong context riêng, tránh "neo" vào giả thuyết đầu tiên; phiên chính so bằng chứng của cả ba
- [ ] Subagent song song tự sửa bug nhanh hơn
- [ ] Vì một subagent không đọc được nhiều file

Ba lần chạy tốn token hơn một lần; đổi lại là kết luận có bằng chứng từ nhiều phía.
:::

:::quiz Hai teammate trong Phần C cùng sửa `task-store.ts`. Rủi ro và cách phòng là gì?
- [ ] Không rủi ro, Claude tự gộp
- [x] Ghi đè thay đổi của nhau; chia việc để mỗi teammate sở hữu file riêng, việc nối chung (store, template) để lead làm sau cùng
- [ ] Phải dùng split pane
- [ ] Phải tắt task list

Tài liệu chính thức: hai teammate sửa cùng file dẫn tới overwrite — chia theo file ngay từ spec.
:::

:::quiz Bạn muốn chạy Phần C mỗi đêm trong CI bằng `claude -p`. Điều gì xảy ra?
- [ ] Team chạy bình thường
- [x] Agent teams chỉ chạy trong phiên tương tác — dùng chuỗi lệnh `-p`, subagent, `/batch` hoặc dynamic workflow cho CI
- [ ] Teammate chạy trên cloud
- [ ] CI sẽ tự bật biến thử nghiệm

Agent teams hợp với việc bạn theo dõi và điều khiển được.
:::

:::exercise Thử thách mở rộng — cổng chất lượng cho team bằng hook
Thêm hook `TaskCompleted` để teammate **không** đánh dấu task xong khi test còn đỏ. Gợi ý: hook thoát mã 2 thì việc đánh dấu bị chặn và stderr được gửi lại cho teammate. Viết khối `hooks` trong `.claude/settings.local.json`, cố ý làm đỏ một test trong lúc team chạy, quan sát teammate phản ứng.
???
```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && npm test -- --watch=false >/dev/null 2>&1 || { echo 'Test đang đỏ — sửa cho xanh rồi mới đánh dấu task xong' >&2; exit 2; }"
          }
        ]
      }
    ]
  }
}
```

Dấu hiệu đúng: khi test đỏ, task vẫn ở trạng thái *in progress* và teammate nhận thông báo rồi tiếp tục sửa. Kiểm tra hook đã nạp bằng `/hooks`. Lưu ý: hook chạy toàn bộ test mỗi lần đánh dấu xong — với dự án lớn, chỉ chạy test liên quan. Hook tương tự `TeammateIdle` (thoát 2 để giữ teammate làm tiếp) dùng khi teammate hay dừng sớm.
:::

> Nguồn: *Orchestrate teams of Claude Code sessions* (agent teams), *Create custom subagents*, *Hooks reference* (TaskCompleted, TeammateIdle) — code.claude.com/docs/en/agent-teams, /sub-agents, /hooks (truy cập 12/11/2026). Lab ghi hướng dẫn để bạn tự chạy; bug ở Phần B tái hiện chắc chắn bằng test vì `update` trả lại cùng tham chiếu mảng thì signal coi là không đổi (so bằng `Object.is`), nên `computed` giữ giá trị cũ cho tới khi một signal khác như `status` thay đổi.
