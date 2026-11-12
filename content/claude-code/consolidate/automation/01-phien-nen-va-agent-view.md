---
title: Phiên nền và agent view trong ngày làm việc — giao 3 việc cùng lúc, theo dõi, trả lời, gắn vào
summary: "Dùng claude agents để giao nhiều việc độc lập chạy nền trên máy bạn: gõ prompt là một phiên mới, xem trạng thái cần bạn/đang chạy/xong, peek và trả lời bằng Space, gắn vào bằng Enter, đưa phiên đang mở xuống nền bằng ← hoặc /bg, cô lập file bằng worktree tự động — kèm giới hạn quota và cách dọn dẹp."
type: lesson
level: intermediate
lastReviewed: 2026-11-12
tags: [claude-code, agent-view, background, parallel]
related: [claude-code/review/automation/ba-muc-tu-dong-hoa, claude-code/deep-dive/automation/lam-viec-song-song]
---

## TL;DR

- `claude agents` mở **agent view**: một màn hình cho mọi phiên nền — cái nào **cần bạn**, cái nào **đang chạy**, cái nào **xong**.
- Mỗi prompt gõ ở đó = **một phiên mới** chạy nền. Phiên nền sửa file trong **worktree riêng** (tự động, nếu repo là git).
- Mỗi phiên tiêu quota riêng: 10 phiên song song ≈ tiêu nhanh gấp 10.
- Tính năng đang ở dạng research preview — giao diện và phím có thể đổi.

## Vòng làm việc cơ bản

```bash
claude agents
```

1. **Giao việc**: gõ prompt ở ô dưới cùng → `Enter` → một hàng mới xuất hiện.
2. **Theo dõi**: mỗi hàng có tên, trạng thái mới nhất hoặc câu hỏi đang chờ, thời gian.
3. **Peek và trả lời**: chọn hàng bằng mũi tên → `Space` mở bảng peek (output gần nhất hoặc câu hỏi) → gõ trả lời → `Enter`.
4. **Gắn vào**: `Enter` hoặc `→` để vào hội thoại đầy đủ; `←` ở ô nhập trống để tách ra, quay về bảng.
5. **Rời đi**: `Esc` về shell — các phiên vẫn chạy.

## Ví dụ: buổi sáng với ba việc độc lập

Trong agent view, gõ lần lượt:

```text
Điều tra test flaky user-list.component.spec.ts: chạy riêng 10 lần, tìm nguyên nhân, đề xuất sửa, chưa sửa.
```

```text
Review PR #128 bằng gh: chỉ bug đúng đắn và a11y, viết kết quả ra review-128.md, không comment lên GitHub.
```

```text
Nâng các gói @angular/* lên bản patch mới nhất, chạy ng build và test, commit trên nhánh riêng nếu xanh.
```

Bạn làm việc chính ở terminal khác; khi một hàng chuyển sang **Needs input**, peek và trả lời.

## Đưa phiên đang mở xuống nền

| Cách | Kết quả |
|---|---|
| `←` ở ô nhập trống | Đưa phiên xuống nền và mở agent view |
| `/background` (`/bg`) `[prompt]` | Tách phiên chạy nền, giải phóng terminal |
| `/fork [prompt]` | **Sao chép** hội thoại sang phiên nền mới; bạn ở lại phiên hiện tại |
| `claude --bg "task"` (từ shell) | Tạo thẳng một phiên nền |
| `claude --bg --exec 'npm run e2e'` | Chạy **lệnh shell** thành job nền |

Quản lý từ shell: `claude attach <id>`, `claude logs <id>`, `claude stop <id>`, `claude respawn <id>`, `claude rm <id>`.

## File được cô lập thế nào?

Phiên nền tạo từ agent view hoặc `claude --bg` bắt đầu ở thư mục làm việc; **trước khi sửa file**, Claude chuyển phiên vào một git worktree riêng dưới `.claude/worktrees/`. Ngoại lệ (sửa thẳng thư mục hiện tại):

- Phiên bạn đưa xuống nền bằng `←` hoặc `/background` (nó tiếp tục ở chỗ cũ).
- Phiên đã ở trong một worktree; thư mục không phải repo git (và không có hook `WorktreeCreate`).

:::warning Xoá phiên = xoá worktree của nó
Worktree do Claude tạo bị xoá cùng phiên trong agent view. **Commit** (hoặc push nhánh) trước khi xoá một phiên đã sửa file.
:::

## Giới hạn

- **Quota**: phiên nền tiêu usage như phiên tương tác.
- **Chạy trên máy bạn**: giữ được qua chế độ ngủ, dừng khi tắt máy (cần chạy cả khi tắt máy → cloud session hoặc `/schedule`).
- Mỗi phiên có model, effort, permission mode riêng — đặt mặc định khi mở: `claude agents --model sonnet --permission-mode auto`.

## Khi nào dùng cái gì?

| Muốn | Dùng |
|---|---|
| Việc phụ trong **một** task, kết quả quay về hội thoại | Subagent / `/subtask` |
| Vài task **độc lập**, tự bạn giao và theo dõi | Agent view |
| Hai phiên **tự bạn điều khiển** song song | Hai terminal + `claude -w` |
| Chạy cả khi tắt máy | Cloud session (`claude --cloud`) / `/schedule` |

:::senior Góc nhìn senior
Agent view biến bạn thành người **giao việc và duyệt việc**. Năng suất thật phụ thuộc vào chất lượng lời giao việc (mỗi việc tự chứa, có tiêu chí xong) và tốc độ bạn duyệt kết quả. Bắt đầu với 2–3 việc song song; tăng lên khi bạn vẫn review kịp mà không hạ tiêu chuẩn.
:::

:::interview Khi nào bạn chạy nhiều phiên Claude song song, và giới hạn gì?
Khi có các việc độc lập, tự chứa, có phép kiểm tra tự động (fix test flaky, nâng patch dependency, review một PR). Giới hạn: quota tiêu nhanh theo số phiên; khả năng review của tôi là nút thắt; mỗi phiên sửa file trong worktree riêng nên phải gộp và chạy lại test. Tôi bắt đầu với 2–3 việc và chỉ tăng khi vẫn review kịp.
:::

:::quiz Trong agent view, bạn gõ prompt thứ hai và nhấn Enter. Điều gì xảy ra?
- [ ] Prompt được gửi làm tin nhắn tiếp theo cho phiên đầu
- [x] Một phiên nền mới chạy song song với phiên đầu
- [ ] Phiên đầu bị dừng
- [ ] Báo lỗi

Muốn trả lời một phiên có sẵn: chọn hàng, `Space` để peek rồi gõ.
:::

:::quiz Một phiên nền đã sửa file trong worktree riêng. Trước khi xoá phiên trong agent view nên làm gì?
- [ ] Không cần gì
- [x] Commit (hoặc push nhánh) thay đổi — worktree do Claude tạo bị xoá cùng phiên
- [ ] `/clear`
- [ ] Tắt máy

Xoá phiên mà chưa commit có thể mất công việc.
:::

:::exercise Một giờ với agent view
Trong cc-lab: giao 3 việc độc lập trong agent view — (a) viết test biên cho `isOverdue`; (b) thêm docstring tiếng Việt cho mọi hàm trong `task-filter.ts`; (c) đề xuất (không sửa) cách lưu task vào localStorage. Trong lúc chờ, tự làm việc khác. Peek và trả lời ít nhất một câu hỏi, gắn vào một phiên để xem hội thoại đầy đủ, rồi gộp các thay đổi và dọn phiên.
???
Quan sát: (a) và (b) sửa file → mỗi cái trong worktree riêng (`ls .claude/worktrees`), có nhánh riêng; (c) chỉ đề xuất → không cần worktree. Gộp: commit trong từng worktree, `git merge` nhánh tương ứng vào nhánh chính (hoặc mở PR), chạy test. Dọn: `claude rm <id>` sau khi đã merge. Ghi lại thời gian bạn tiết kiệm được so với làm tuần tự — và thời gian bạn tốn để review.
:::

> Nguồn: *Manage multiple agents with agent view*, *Run agents in parallel*, *CLI reference* — code.claude.com/docs (truy cập 12/11/2026).
