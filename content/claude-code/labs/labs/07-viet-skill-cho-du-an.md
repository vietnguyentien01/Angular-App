---
title: "Lab 07 — Viết hai skill cho cc-lab: lệnh /new-filter và kiến thức nền tasks-domain"
summary: "Tạo một action skill gọi bằng /new-filter (có đối số, bơm trạng thái git bằng lệnh shell, chỉ người dùng gọi được) và một reference skill chỉ Claude tự nạp khi câu hỏi liên quan; thử cả hai, đo chi phí bằng /skills, và sửa description khi Claude không tự gọi."
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, lab, skills]
related: [claude-code/deep-dive/extending/viet-skill, claude-code/labs/labs/subagent-reviewer]
---

## Mục tiêu

- **Action skill** `/new-filter`: thêm một hàm lọc thuần + test theo đúng chuẩn module tasks, mỗi lần chỉ cần gõ một dòng.
- **Reference skill** `tasks-domain`: kiến thức nghiệp vụ Claude tự nạp khi cần, không chiếm context mọi phiên như CLAUDE.md.

**Thời gian:** 45 phút.

## Trước khi bắt đầu

- [ ] Lab 01–02 xong; nhánh riêng: `git checkout -b lab07`.
- [ ] Có ít nhất một thay đổi chưa commit trước khi gọi `/new-filter` để thấy output `git status` được bơm vào (vd sửa một comment).


## Bước 1 — Action skill `/new-filter`

```bash
mkdir -p .claude/skills/new-filter
```

```md title=".claude/skills/new-filter/SKILL.md"
---
description: Add a new pure filter function with tests to the tasks module. Use only when the user runs /new-filter.
argument-hint: <ten-ham>: <mo-ta-hanh-vi>
disable-model-invocation: true
allowed-tools: Bash(npm test *)
---

## Trạng thái hiện tại

!`git status --short`

## Yêu cầu

Người dùng muốn: $ARGUMENTS

## Các bước

1. Đọc `src/app/tasks/task-filter.ts` và `task-filter.spec.ts` để theo đúng style hiện có.
2. Thêm hàm thuần (không gọi `new Date()` bên trong; ngày truyền vào dạng `YYYY-MM-DD`) kèm docstring tiếng Việt.
3. Thêm `describe` mới trong spec: ít nhất một case bình thường, một case biên, một case rỗng.
4. Chạy `npm test -- --watch=false`. Nếu fail vì code → sửa code; không sửa kỳ vọng cho xanh.
5. Trả lời ngắn: tên hàm, chữ ký, danh sách test, kết quả test.
```

Thử:

```text
/new-filter overdueTasks: trả về các task quá hạn tại ngày today, sắp xếp hạn cũ nhất trước
```

Kiểm tra: phần "Trạng thái hiện tại" Claude nhận được đã là **output thật** của `git status --short`; `npm test` chạy không phải hỏi (nhờ `allowed-tools`, chỉ trong lượt này).

## Bước 2 — Reference skill `tasks-domain`

```bash
mkdir -p .claude/skills/tasks-domain
```

```md title=".claude/skills/tasks-domain/SKILL.md"
---
description: Business rules of the cc-lab tasks domain (statuses, overdue, due dates, priorities). Use when answering questions about how tasks behave or when changing task logic.
user-invocable: false
---

# Quy tắc nghiệp vụ Tasks

- Trạng thái: `todo` → `doing` → `done`; bỏ tích "xong" đưa về `todo` (không về `doing`).
- Quá hạn: `dueDate < today` và `status !== 'done'`. Task xong không bao giờ quá hạn.
- "Sắp đến hạn": hạn trong [today, today + 3] tính cả hai đầu.
- Không cho tạo task có tiêu đề rỗng sau khi trim.
- Chi tiết các ví dụ: xem [examples.md](examples.md).
```

```md title=".claude/skills/tasks-domain/examples.md"
| Hôm nay | Task | Quá hạn? | Sắp đến hạn? |
|---|---|---|---|
| 2026-11-11 | doing, hạn 2026-11-10 | Có | Không |
| 2026-11-11 | todo, hạn 2026-11-14 | Không | Có |
| 2026-11-11 | done, hạn 2026-11-01 | Không | Không |
```

Thử (không gọi tên skill):

```text
Bỏ tích một task đã xong thì nó về trạng thái nào? Task hạn 14/11 có tính là sắp đến hạn vào ngày 11/11 không?
```

Claude nên tự nạp `tasks-domain` (xem thông báo nạp skill hoặc `Ctrl+O`) và trả lời theo quy tắc. Gõ `/tasks-domain` → không có trong menu (vì `user-invocable: false`).

## Bước 3 — Đo chi phí

```text
/skills
```

Nhấn `t` để sắp theo token. `tasks-domain` chỉ tốn phần **mô tả** cho tới khi được dùng; `new-filter` có `disable-model-invocation: true` nên mô tả của nó cũng không nằm trong context của Claude.

## Bước 4 — Khi Claude không tự gọi skill

Đổi description của `tasks-domain` thành mơ hồ (`description: Domain stuff.`), `/reload-skills`, hỏi lại câu ở Bước 2. Claude có còn nạp skill? Khôi phục description cụ thể và rút ra quy tắc viết description.

## Kết quả bạn nên thấy

> Câu chữ Claude trả lời mỗi lần một khác — điều cần kiểm là **kết quả** trong bảng dưới (file đổi gì, lệnh nào pass, Claude có bị chặn đúng chỗ không), không phải câu chữ.

| Bước | Dấu hiệu đúng | Nếu khác |
|---|---|---|
| Bước 1 | Gõ `/new-filter` thấy trong menu; Claude tạo hàm + test, `npm test` chạy không hỏi quyền | Skill phải ở `.claude/skills/new-filter/SKILL.md`; skill mới thêm giữa phiên → `/reload-skills` |
| Bước 2 | Câu hỏi về nghiệp vụ → Claude nạp `tasks-domain` (thấy khi bật `Ctrl+O`); `/tasks-domain` không có trong menu | Description phải nêu rõ "khi nào dùng" |
| Bước 3 | `/skills` liệt kê cả hai; nhấn `t` sắp theo token | — |
| Bước 4 | Description mơ hồ → Claude thường không nạp skill; khôi phục thì nạp lại | Nhớ `/reload-skills` sau mỗi lần sửa |

## Checklist hoàn thành

- [ ] `/new-filter` tạo được hàm + test xanh, output `git status` được bơm vào trước
- [ ] `tasks-domain` được Claude tự nạp khi hỏi đúng chủ đề; không hiện trong menu `/`
- [ ] Thấy rõ ảnh hưởng của description mơ hồ
- [ ] Commit `.claude/skills/`

:::quiz Skill `tasks-domain` có `user-invocable: false`. Hệ quả?
- [ ] Không ai dùng được
- [x] Không hiện trong menu `/`; chỉ Claude tự nạp khi câu hỏi khớp description
- [ ] Chỉ bạn gọi được
- [ ] Skill bị tắt

Ngược với `disable-model-invocation: true` (chỉ người gọi).
:::

:::quiz Dòng `` !`git status --short` `` trong `/new-filter` chạy khi nào?
- [ ] Khi Claude quyết định chạy
- [x] Claude Code chạy nó **trước** khi đưa nội dung skill cho Claude, thay dòng đó bằng output
- [ ] Sau khi skill xong
- [ ] Không bao giờ

Đó là dynamic context injection.
:::

:::quiz `allowed-tools: Bash(npm test *)` trong `/new-filter` có tác dụng bao lâu?
- [ ] Vĩnh viễn cho dự án
- [x] Chỉ trong lượt gọi skill — hết khi bạn gửi tin nhắn tiếp theo
- [ ] Tới khi `/clear`
- [ ] Cho mọi skill khác

Muốn cho phép lâu dài thì dùng permission rule trong settings.
:::

:::exercise Thử thách mở rộng — skill chạy trong subagent
Tạo skill `/audit-tasks` dùng `context: fork` và `agent: Explore` để đọc toàn bộ module tasks và liệt kê chỗ vi phạm quy tắc trong `tasks-domain` — kết quả trả về hội thoại chính dưới dạng bảng ngắn.
???
```md
---
description: Audit the tasks module against domain rules. Use when the user runs /audit-tasks.
disable-model-invocation: true
context: fork
agent: Explore
---
Đọc mọi file trong src/app/tasks/. Đối chiếu với quy tắc: (1) task xong không quá hạn; (2) bỏ tích xong về todo; (3) "sắp đến hạn" tính cả hai đầu; (4) chặn tiêu đề rỗng sau trim. Trả về bảng `quy tắc | file:dòng | đạt/vi phạm | ghi chú`, tối đa 10 dòng.
```
Subagent Explore chỉ đọc, chạy nền trong context riêng — hội thoại chính chỉ nhận bảng. Với seed của Lab 01, quy tắc (4) thường vi phạm nếu bạn chưa làm Lab 03.
:::

> Nguồn: *Extend Claude with skills* — code.claude.com/docs/en/skills (truy cập 11/11/2026).
