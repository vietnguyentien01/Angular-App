---
title: Lệnh quản lý phiên và hội thoại — /clear, /compact, /rewind, /resume, /branch, /fork, /goal, /loop…
summary: "Giải thích từng lệnh điều khiển hội thoại: bắt đầu lại, nén, quay lui, mở lại, đặt tên, rẽ nhánh, sao chép sang phiên nền, giao việc phụ, hỏi ngoài lề, xuất/copy, đổi thư mục, chạy theo mục tiêu hoặc theo chu kỳ — mỗi lệnh có cú pháp, ví dụ và lưu ý."
type: cheatsheet
level: core
lastReviewed: 2026-11-11
tags: [claude-code, commands, sessions, reference]
related: [claude-code/consolidate/sessions/context-window-va-checkpoint, claude-code/commands/commands/lenh-model-context-chi-phi]
---

## Bắt đầu lại và thu gọn

### `/clear [name]` — hội thoại mới, context trống

Alias: `/reset`, `/new`. Dùng khi chuyển sang task không liên quan. Đặt tên để dễ tìm lại phiên cũ trong `/resume`.

```text
/clear fix-login-bug
```

Lưu ý: `CLAUDE.md` và auto memory vẫn được nạp lại. Lỡ tay? `/resume` hoặc mục *previous session* trong menu `/rewind` (cùng tiến trình).

### `/compact [instructions]` — tóm tắt để giải phóng context

Giữ nguyên task, nén lịch sử thành tóm tắt. Thêm trọng tâm để tóm tắt giữ đúng thứ bạn cần.

```text
/compact giữ lại danh sách file đã đổi, các test còn fail và quyết định về tên API
```

### `/rewind` — quay lui code và/hoặc hội thoại

Alias: `/checkpoint`, `/undo`; hoặc `Esc Esc` khi ô nhập trống. Chọn một prompt cũ rồi: *Restore code and conversation*, *Restore conversation*, *Restore code*, *Summarize from here*, *Summarize up to here*, *Never mind*.

Lưu ý: không khôi phục file chỉ bị Bash thay đổi, sửa đổi của subagent (thường), hay sửa tay ngoài Claude Code.

### `/autocompact [auto|<size>]` — ngưỡng tự compact

Đặt context đầy tới mức nào thì tự compact, vd `/autocompact 500k`; `auto` để về mức mặc định theo model. Lưu vào user settings.

## Mở lại, đặt tên, rẽ nhánh

### `/resume [session]` — mở lại hội thoại cũ

Theo ID hoặc tên, hoặc mở danh sách chọn. Phiên nền đang chạy có nhãn `bg` — chọn nó thì terminal này gắn vào phiên đó.

```text
/resume fix-login-bug
```

### `/rename [name]` — đặt tên phiên

Tên hiện trên thanh prompt và trong `/resume`; bỏ trống để Claude tự đặt tên theo nội dung. Dùng được với `-p`.

### `/branch [name]` — rẽ nhánh hội thoại

Sao chép hội thoại tới thời điểm này sang phiên mới và **chuyển bạn sang đó**; phiên gốc giữ nguyên.

```text
/branch thu-cach-dung-resource
```

### `/fork [prompt]` — sao chép sang một phiên **nền**

Bạn ở lại phiên hiện tại; bản sao chạy nền (xem trong agent view). Có prompt thì bản sao bắt đầu làm ngay; Claude Code dặn nó tự tạo worktree trước khi sửa code.

```text
/fork thử viết lại OrderService bằng signal store, đừng đụng các file khác
```

### `/subtask <task>` — giao việc phụ cho subagent kế thừa hội thoại

Subagent nền **thừa hưởng toàn bộ hội thoại**, làm việc phụ trong lúc bạn làm tiếp; kết quả quay về hội thoại này.

```text
/subtask tìm mọi chỗ còn dùng HttpClient trực tiếp trong components và liệt kê file:line
```

So sánh nhanh: `/branch` = bạn chuyển sang bản sao · `/fork` = bản sao chạy nền riêng · `/subtask` = việc phụ, kết quả quay về đây.

## Hỏi nhanh, tóm tắt, xuất

### `/btw [question]` — câu hỏi ngoài lề

Trả lời từ những gì đã có trong phiên, **không** ghi vào lịch sử. Không kèm câu hỏi → xem lại câu hỏi ngoài lề gần nhất.

```text
/btw interceptor xử lý 401 nằm ở file nào nhỉ?
```

### `/recap` — tóm tắt phiên một dòng

Hữu ích khi quay lại sau giờ nghỉ.

### `/export [filename]` — xuất hội thoại ra văn bản

```text
/export notes/session-orders-refactor.txt
```

Không có tên file → hộp thoại copy vào clipboard hoặc lưu file.

### `/copy [N]` — copy câu trả lời

`/copy` copy câu trả lời gần nhất, `/copy 2` câu áp chót. Có code block thì hiện bộ chọn từng block; nhấn `w` để ghi ra file (tiện khi làm qua SSH).

## Thư mục làm việc

### `/add-dir <path>` — cho phép truy cập thêm thư mục

```text
/add-dir ../shared-ui-lib
```

Chỉ cấp quyền đọc/sửa file; phần lớn cấu hình `.claude/` của thư mục đó **không** được nạp.

### `/cd <path>` — chuyển phiên sang thư mục khác, giữ hội thoại

Khác `/add-dir`: thư mục làm việc chính đổi hẳn (và cấu hình dự án của thư mục mới được áp dụng).

## Việc nền và chạy dài

### `/tasks` — việc nền trong phiên

Alias `/bashes`. Xem/quản lý lệnh Bash nền và subagent (kể cả đã xong).

### `/background [prompt]` — đưa cả phiên xuống nền

Alias `/bg`. Giải phóng terminal; theo dõi bằng `claude agents`. Có prompt thì gửi thêm một chỉ dẫn trước khi tách.

### `/stop` — dừng phiên nền bạn đang gắn vào

Giữ transcript và worktree. Muốn tách mà **không** dừng: `/exit` hoặc `←`.

### `/goal [condition|clear]` — làm tới khi đạt điều kiện

```text
/goal ng build không lỗi và npm test -- --watch=false pass, hoặc dừng sau 15 lượt
```

Không đối số → xem goal hiện tại; `clear` (hoặc `stop`, `off`, `reset`, `none`, `cancel`) để huỷ.

### `/loop [interval] [prompt]` — lặp prompt khi phiên còn mở

Alias `/proactive`. Bỏ interval → Claude tự điều chỉnh nhịp; bỏ prompt → chạy prompt bảo trì có sẵn hoặc `loop.md` của bạn.

```text
/loop 10m kiểm tra PR #42 có review mới không, có thì tóm tắt
```

Dừng: bảo Claude huỷ vòng lặp. Vòng lặp lặp lại tự hết hạn sau 7 ngày.

### `/exit` — thoát

Alias `/quit`. Ở phiên nền đang gắn vào: chỉ tách ra, phiên vẫn chạy.

:::quiz Bạn muốn thử một hướng giải khác nhưng vẫn muốn quay về đúng hội thoại hiện tại sau đó. Lệnh nào phù hợp nhất?
- [ ] `/clear`
- [x] `/branch`
- [ ] `/compact`
- [ ] `/exit`

`/branch` giữ nguyên phiên gốc; `/resume` để quay lại nó.
:::

:::quiz Lệnh nào giao việc phụ cho một subagent **thừa hưởng cả hội thoại** và đưa kết quả về lại đây?
- [ ] `/fork`
- [x] `/subtask`
- [ ] `/background`
- [ ] `/btw`

`/fork` tạo phiên nền riêng; `/subtask` là subagent mà kết quả quay về hội thoại hiện tại.
:::

:::exercise Luyện nhóm lệnh phiên trong 15 phút
Trong một repo thử: (1) hỏi Claude giải thích một file, rồi `/rename hoc-lenh`; (2) `/btw` hỏi một câu về file đó; (3) `/branch thu-nghiem` rồi nhờ Claude sửa một dòng; (4) `/resume hoc-lenh` để về phiên gốc và kiểm tra file; (5) `/export` ra file; (6) `/clear` rồi `/resume` để quay lại.
???
Ở bước (4), lưu ý: `/branch` chỉ tách **hội thoại** — file trên đĩa là chung, nên dòng đã sửa ở nhánh vẫn còn khi bạn về phiên gốc. Muốn tách cả file thì dùng worktree (`claude -w`). Bước (2): câu hỏi `/btw` không xuất hiện trong lịch sử khi bạn `/export`.
:::

> Nguồn: *Commands*, *Manage sessions*, *Checkpointing*, *Keep Claude working toward a goal*, *Run prompts on a schedule* — code.claude.com/docs (truy cập 11/11/2026).
