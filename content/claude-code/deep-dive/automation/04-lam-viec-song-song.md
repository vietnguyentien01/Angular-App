---
title: Làm song song và chạy dài — worktree, agent view, /goal, /loop, scheduled task
summary: Nhiều phiên cùng lúc không giẫm chân nhau nhờ git worktree; năm cách chạy nhiều việc (subagent, agent view, agent team, dynamic workflow, project); /goal để Claude làm tới khi đạt điều kiện; /loop lặp trong phiên; /schedule cho scheduled task trên cloud; /batch cho thay đổi cơ học lớn.
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, worktrees, parallel, goal, loop, scheduled-tasks]
related: [claude-code/deep-dive/automation/chay-khong-can-giam-sat, claude-code/deep-dive/extending/subagent]
changelog:
  - date: 2026-11-12
    note: "Tách cách dừng /loop theo hai kiểu (khoảng cố định vs tự điều chỉnh nhịp); thêm thay đổi của v2.1.319: vòng lặp tự điều chỉnh nhịp kết thúc khi một lượt không lên lịch tiếp."
---

## TL;DR

- Hai phiên sửa cùng một thư mục sẽ giẫm lên nhau → mỗi phiên một **worktree**: `claude -w <ten>`.
- Chạy dài có điều kiện dừng rõ: **`/goal`**. Lặp theo chu kỳ khi phiên còn mở: **`/loop`**. Chạy cả khi tắt máy: **`/schedule`** (cloud).
- Song song chỉ có lợi với việc **độc lập**; việc phụ thuộc nhau thì tuần tự vẫn nhanh hơn.

## Worktree

```bash
claude --worktree feature-auth     # hoặc: claude -w feature-auth
claude --worktree fix-orders       # terminal thứ hai
```

- Tạo dưới `.claude/worktrees/<ten>/`, trên nhánh mới `worktree-<ten>`. Không đặt tên → Claude tự sinh.
- Thêm `.claude/worktrees/` vào `.gitignore`.
- Worktree là checkout mới: cần `npm install` lại. File gitignore cần chép sang (như `.env.local`) → liệt kê trong **`.worktreeinclude`** (cú pháp `.gitignore`; chỉ chép file vừa khớp vừa bị gitignore).
- Trong phiên, nói *"work in a worktree"* → Claude tạo bằng công cụ `EnterWorktree`.
- Thoát phiên: worktree **sạch** của phiên không đặt tên được tự xoá; có thay đổi/commit mới thì Claude hỏi trước.
- Subagent có thể chạy trong worktree tạm với `isolation: worktree`.

```text title=".worktreeinclude"
.env
.env.local
```

## Năm cách chạy nhiều việc

| Cách | Là gì | Dùng khi |
|---|---|---|
| Subagent | Worker trong **một** phiên, context riêng, trả tóm tắt | Việc phụ làm ngập hội thoại chính |
| Agent view (`claude agents`) | Một màn hình điều phối và theo dõi các phiên chạy nền (research preview) | Nhiều task độc lập muốn giao rồi kiểm tra sau |
| Agent teams | Nhiều phiên phối hợp, có task list chung và nhắn tin, một "lead" điều phối (thử nghiệm, tắt mặc định) | Chia một dự án thành phần cần trao đổi với nhau |
| Dynamic workflows | Script chạy nhiều subagent và kiểm tra chéo kết quả | Việc quá lớn cho vài subagent, cần nhiều lượt |
| Projects | Một hội thoại lâu dài trên claude.ai/code hoặc desktop, Claude mở các thread song song | Điều phối công việc liên tục |

Liên quan: `/background` đưa phiên hiện tại thành phiên nền; `/fork` sao chép hội thoại sang một phiên nền mới; `/tasks` xem việc nền trong phiên.

## `/batch` — thay đổi cơ học lớn

```text
/batch migrate every component in src/app/features to signal inputs
```

Claude nghiên cứu codebase, chia việc thành nhiều đơn vị (khoảng 5–30) và cho bạn xem kế hoạch; bạn duyệt xong, mỗi đơn vị chạy trong worktree riêng và mở PR (hoặc báo kết quả).

## `/goal` — làm tới khi đạt điều kiện

```text
/goal mọi file trong src/app/features/orders đã chuyển sang Signal Forms, ng build không lỗi và npm test -- --watch=false pass, hoặc dừng sau 20 lượt
```

- Sau mỗi lượt, một model kiểm tra điều kiện; chưa đạt → Claude làm lượt tiếp, đạt → dừng.
- Điều kiện tốt: **kiểm chứng được** (lệnh pass/fail, số lượng đo được) và có **giới hạn** ("hoặc dừng sau 20 lượt").
- `/goal` không đổi permission mode — muốn chạy không cần duyệt từng bước thì dùng auto mode.
- `/goal clear` để huỷ. `Ctrl+O` xem lý do của từng lần đánh giá.
- So với `Stop` hook: `/goal` chỉ cho phiên hiện tại, gõ là dùng; Stop hook nằm trong settings và áp cho mọi phiên.

## `/loop` — lặp trong phiên

```text
/loop 5m kiểm tra workflow deploy đã xong chưa và báo kết quả
```

- Chạy khi phiên còn mở. Có hai kiểu:
  - **Khoảng cố định** (`/loop 5m …`): dừng bằng cách **bảo Claude huỷ** ("cancel the deploy check loop"). `Esc` / `Ctrl+C` **không** dừng được kiểu này.
  - **Tự điều chỉnh nhịp** (bỏ khoảng thời gian): sau mỗi lượt, Claude tự chọn độ trễ từ 1 phút tới 1 giờ. Trong lúc vòng lặp đang chờ lượt kế, nhấn `Esc` để dừng. Claude cũng có thể tự kết thúc vòng lặp khi việc đã xong.
- Từ v2.1.319, vòng lặp tự điều chỉnh nhịp **kết thúc luôn** nếu một lượt chạy xong mà không lên lịch lượt kế. Trước đây Claude Code tự đặt thêm một lần đánh thức dự phòng. Đặt `CLAUDE_CODE_LOOP_KEEPALIVE=1` nếu muốn giữ hành vi cũ.
- Task lặp tự **hết hạn sau 7 ngày** (chạy lần cuối rồi tự xoá) — chặn vòng lặp bị quên.
- Muốn phản ứng theo sự kiện thay vì hỏi định kỳ: xem *Channels* (CI đẩy lỗi vào phiên).

## `/schedule` — scheduled task trên cloud

Scheduled task (trước gọi là routine) = prompt + repo + connector, đóng gói và chạy tự động **trên cloud**, kể cả khi máy bạn tắt (research preview). Trigger:

- **Lịch**: hằng giờ, hằng đêm, hằng tuần, hoặc một lần vào thời điểm định trước.
- **API**: gọi HTTP POST tới endpoint riêng với bearer token.
- **Sự kiện GitHub**.

```text
/schedule mỗi sáng thứ Hai, chạy npm audit trên repo này, nếu có lỗ hổng high thì mở PR nâng version và tóm tắt
```

App Learning Hub này cập nhật bản tin "Frontend mới" bằng đúng cơ chế này.

:::warning Trước khi để task chạy dài hạn
Bảo vệ nhánh chính bằng branch rule mà task không vượt qua được, giới hạn quyền của task, theo dõi vài lần chạy đầu. Năm câu hỏi ở bài *Để Claude chạy một mình* áp dụng cho mọi cơ chế trong bài này.
:::

:::senior Góc nhìn senior
Song song hoá tăng thông lượng của **Claude**, không tăng thông lượng review của **bạn**. Giới hạn số luồng song song theo khả năng bạn review kỹ kết quả; ưu tiên việc có phép kiểm tra tự động mạnh (test, typecheck, build) để mỗi luồng tự chứng minh được trước khi tới tay bạn.
:::

:::quiz Bạn muốn hai phiên Claude cùng sửa hai tính năng khác nhau của một repo mà không ghi đè file của nhau. Cách được khuyến nghị?
- [ ] Mở hai terminal trong cùng thư mục
- [x] `claude -w feature-a` và `claude -w feature-b` — mỗi phiên một git worktree
- [ ] Dùng `/branch`
- [ ] Bật bypassPermissions

`/branch` chỉ rẽ nhánh **hội thoại**, không tách file trên đĩa.
:::

:::quiz Vòng `/loop 5m …` vẫn chạy và bạn muốn dừng. Làm gì?
- [ ] Nhấn `Esc`
- [ ] Nhấn `Ctrl+C`
- [x] Bảo Claude huỷ vòng lặp đó (vd "cancel the deploy check loop")
- [ ] Đợi tự hết sau 1 giờ

Vòng lặp lặp lại tự hết hạn sau 7 ngày nếu bị quên.
:::

:::exercise Chọn cơ chế cho bốn tình huống
(1) Đợi CI xanh rồi báo bạn, trong lúc bạn làm việc khác trong cùng phiên. (2) Chuyển 120 component sang control flow mới. (3) Sửa cho tới khi `ng build` hết lỗi sau khi nâng Angular. (4) Mỗi tối quét dependency có lỗ hổng, kể cả khi bạn tắt máy.
???
(1) `/loop 5m` kiểm tra trạng thái CI (hoặc Channels nếu CI đẩy sự kiện được). (2) `/batch` — chia đơn vị, mỗi đơn vị một worktree/PR; hoặc schematic chính thức trước rồi `/batch` cho phần sửa tay. (3) `/goal ng build không còn lỗi và test pass, hoặc dừng sau 30 lượt` trong auto mode. (4) `/schedule` — scheduled task trên cloud, mở PR, nhánh chính có branch protection.
:::

> Nguồn: *Run parallel sessions with worktrees*, *Run agents in parallel*, *Keep Claude working toward a goal*, *Run prompts on a schedule*, *Automate work with scheduled tasks*, *Commands*, *Best practices* — mục "Run sessions in parallel", code.claude.com/docs (truy cập 11/11/2026).
