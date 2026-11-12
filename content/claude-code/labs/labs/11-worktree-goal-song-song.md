---
title: "Lab 11 — Làm song song bằng worktree, chạy tới đích bằng /goal, giao việc nền"
summary: "Chạy hai phiên Claude trên hai tính năng của cc-lab cùng lúc bằng git worktree (kèm .worktreeinclude cho .env), dùng /goal với điều kiện kiểm chứng được để Claude tự làm tới khi build và test xanh, giao một việc nền bằng --bg và theo dõi bằng claude agents, rồi gộp kết quả."
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, lab, worktrees, goal, parallel]
related: [claude-code/deep-dive/automation/lam-viec-song-song, claude-code/labs/labs/mcp-playwright-kiem-tra-giao-dien]
---

## Mục tiêu

- Hai tính năng độc lập tiến hành **cùng lúc** mà không giẫm file của nhau.
- Một task chạy **tới khi đạt điều kiện**, không cần bạn nhắc từng bước.
- Biết giới hạn: song song tăng tốc Claude, không tăng tốc phần review của bạn.

**Thời gian:** 60 phút.

## Bước 1 — Chuẩn bị

```bash
cd cc-lab
echo ".claude/worktrees/" >> .gitignore
printf ".env\n" > .worktreeinclude
git add -A && git commit -m "chore: worktree setup"
```

`.worktreeinclude` chép `.env` (đã gitignore) sang mỗi worktree mới; file tracked không bao giờ bị nhân đôi.

## Bước 2 — Hai worktree, hai tính năng

Terminal 1:

```bash
claude -w priority
```

```text
Thêm field priority ('low' | 'normal' | 'high', mặc định 'normal') cho Task, hiển thị badge trong TaskList, có test. Chạy npm install nếu cần rồi npm test -- --watch=false.
```

Terminal 2 (cùng lúc):

```bash
claude -w stats
```

```text
Tạo component TaskStats hiển thị số task theo từng trạng thái và số task quá hạn (dùng isOverdue), đặt dưới TaskList. Có test. Chạy npm test -- --watch=false.
```

Quan sát: `ls .claude/worktrees/` có `priority/` và `stats/`; `git branch` có `worktree-priority` và `worktree-stats`. Dùng `/color green` và `/color purple` để phân biệt hai terminal.

:::note Worktree là checkout mới
Mỗi worktree cần `npm install` riêng — lần đầu chậm. Đó là lý do prompt nhắc chạy `npm install`.
:::

## Bước 3 — Gộp kết quả

Khi cả hai xong và đã commit trong worktree của mình:

```bash
git merge worktree-priority
git merge worktree-stats      # có thể conflict ở task-list.ts / app.html
```

Nếu conflict:

```text
help me resolve merge conflicts — giải thích từng conflict trước khi chọn cách gộp, giữ cả hai tính năng.
```

Chạy lại `npm test -- --watch=false` và `npx ng build` trên nhánh chính. Thoát hai phiên worktree: worktree **sạch** của phiên không đặt tên được tự xoá, còn thay đổi/commit thì Claude hỏi trước.

## Bước 4 — `/goal` chạy tới đích

Cố ý tạo việc nhiều bước: nâng `tsconfig.json` lên chặt hơn, thêm `"noUncheckedIndexedAccess": true` và `"exactOptionalPropertyTypes": true` vào `compilerOptions` của `tsconfig.json`. (Đã thử trên cc-lab: test lập tức báo `TS2345: Argument of type 'Task | undefined' is not assignable…` ở `task-filter.spec.ts` — việc thật để Claude làm; các tính năng bạn thêm ở bước trước có thể sinh thêm lỗi.) Rồi trong một phiên (nên ở auto mode để không phải duyệt từng bước):

```bash
claude --permission-mode auto -n "lab11-goal"
```

```text
/goal npx ng build không còn lỗi TypeScript và npm test -- --watch=false pass, không dùng `any` hay `@ts-ignore` để lách, hoặc dừng sau 20 lượt
```

Theo dõi: sau mỗi lượt có một đánh giá điều kiện; `Ctrl+O` xem lý do. `/goal` (không đối số) xem trạng thái; `/goal clear` để dừng sớm. Khi xong, kiểm tra diff có lách bằng `any`/`@ts-ignore` không:

```bash
git diff | grep -nE "as any|: any|@ts-ignore" || echo "Không lách"
```

## Bước 5 — Việc nền

```bash
claude --bg "Viết thêm test biên cho dueWithin và isOverdue (days=0, hôm nay trùng hạn, task done) và chạy npm test -- --watch=false. Báo kết quả."
claude agents        # agent view: theo dõi các phiên nền
```

Trong lúc chờ, bạn làm việc khác. Xem output: `claude logs <id>`; gắn vào: `claude attach <id>`.

## Checklist hoàn thành

- [ ] Hai worktree chạy song song, không ghi đè file của nhau
- [ ] Gộp được cả hai tính năng, build/test xanh trên nhánh chính
- [ ] `/goal` dừng khi đạt điều kiện; diff không có lối lách `any`/`@ts-ignore`
- [ ] Đã giao và theo dõi một phiên nền bằng `--bg` + `claude agents`

:::quiz Vì sao thêm `.claude/worktrees/` vào `.gitignore`?
- [ ] Để worktree chạy nhanh
- [x] Để nội dung các worktree không hiện thành file untracked trong checkout chính
- [ ] Vì git bắt buộc
- [ ] Để Claude không đọc được

Worktree nằm trong thư mục repo.
:::

:::quiz Điều kiện `/goal` có câu "không dùng `any` hay `@ts-ignore` để lách". Tác dụng?
- [ ] Không có tác dụng
- [x] Là ràng buộc evaluator đọc khi đánh giá — chặn cách 'xong' bằng cách tắt kiểm tra type; bạn vẫn kiểm lại bằng `git diff | grep`
- [ ] Tắt TypeScript
- [ ] Bật strict mode

Điều kiện tốt có cả trạng thái cuối và ràng buộc.
:::

:::quiz Bạn dùng `/branch` trong cùng một thư mục để "làm song song" hai tính năng. Vấn đề gì xảy ra?
- [ ] Không vấn đề gì
- [x] `/branch` chỉ tách hội thoại; cả hai cùng sửa một thư mục làm việc nên ghi đè file của nhau — cần worktree
- [ ] `/branch` tự tạo worktree
- [ ] Claude từ chối

Worktree tách file trên đĩa; branch hội thoại thì không.
:::

:::exercise Thử thách mở rộng — /batch
Dùng `/batch` để chuyển mọi `input`/`output` theo kiểu decorator (nếu bạn cố ý thêm vài component cũ dùng `@Input()`) sang `input()`/`output()`. Xem kế hoạch chia đơn vị trước khi duyệt.
???
Chuẩn bị: tạo 3–4 component nhỏ dùng `@Input()`/`@Output()` để có việc. `/batch chuyển mọi @Input/@Output trong src/app sang input()/output(), cập nhật template và test liên quan`. Kế hoạch nên chia mỗi component một đơn vị; mỗi đơn vị chạy trong worktree riêng và mở PR (cần repo GitHub từ Lab 09) hoặc báo kết quả. Với thay đổi kiểu này, cân nhắc chạy schematic chính thức trước: `npx ng generate @angular/core:signal-input-migration`.
:::

> Nguồn: *Run parallel sessions with worktrees*, *Keep Claude working toward a goal*, *Manage multiple agents with agent view*, *Commands* — `/batch`, code.claude.com/docs (truy cập 11/11/2026).
