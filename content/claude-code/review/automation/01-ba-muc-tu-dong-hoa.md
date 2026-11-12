---
title: Ba mức tự động hoá cho người mới — trong phiên, trong script, trên cloud
summary: "Khi nào nên để Claude chạy mà không gõ từng bước: /loop và /goal khi phiên còn mở, claude -p trong script và CI, scheduled task chạy trên cloud cả khi tắt máy. Mỗi mức có ví dụ một dòng cho dự án Angular, rủi ro và điều kiện tối thiểu trước khi dùng."
type: lesson
level: core
lastReviewed: 2026-11-12
tags: [claude-code, beginner, automation, loop, headless]
related: [claude-code/consolidate/automation/phien-nen-va-agent-view, claude-code/deep-dive/automation/chay-khong-can-giam-sat]
---

## TL;DR

| Mức | Chạy ở | Dừng khi | Ví dụ |
|---|---|---|---|
| **1. Trong phiên** | Phiên đang mở trên máy bạn | Đạt điều kiện / bạn huỷ / đóng phiên | `/loop 5m kiểm tra CI`, `/goal test xanh` |
| **2. Trong script** | Terminal, CI | Lệnh kết thúc | `claude -p "…"` trong `package.json`, GitHub Actions |
| **3. Trên cloud** | Hạ tầng Anthropic | Theo lịch / trigger | `/schedule mỗi sáng thứ Hai chạy npm audit` |

Bắt đầu ở mức 1, chỉ lên mức 3 khi đã có phép kiểm tra tự động và hàng rào (branch protection).

## Mức 1 — trong phiên

```text
/loop 5m kiểm tra workflow CI của nhánh hiện tại bằng gh run list, báo khi xong hoặc fail
```

```text
/goal npm test -- --watch=false exit 0 và ng build exit 0, hoặc dừng sau 15 lượt
```

- `/loop` lặp theo chu kỳ (dừng: bảo Claude huỷ; tự hết hạn sau 7 ngày).
- `/goal` lặp **tới khi đạt điều kiện**.
- Rủi ro thấp: bạn đang ở đó, thấy mọi thứ.

## Mức 2 — trong script

```bash
git diff main | claude -p "liệt kê lỗi chính tả trong diff này, mỗi lỗi một dòng file:dòng — lỗi"
```

```bash
claude -p "tóm tắt các thay đổi trong 10 commit gần nhất cho release note" > notes.md
```

- `-p` chạy một lần rồi thoát; mặc định **không** tự duyệt lệnh cần quyền — cấp bằng `--allowedTools`.
- Thêm `--bare` để lần chạy không phụ thuộc cấu hình cá nhân trên từng máy.
- Thực hành đầy đủ: Lab 10.

## Mức 3 — trên cloud

```text
/schedule mỗi sáng thứ Hai 8h: chạy npm audit; có lỗ hổng high thì mở PR nâng version, không push nhánh chính
```

- Chạy cả khi máy bạn tắt; trigger theo lịch, API hoặc sự kiện GitHub.
- Cần: repo trên GitHub, branch protection, phép kiểm tra tự động (CI), và theo dõi vài lần chạy đầu.

## Trước khi tự động hoá bất cứ thứ gì

Năm câu hỏi (chi tiết ở bài *Để Claude chạy một mình*):

1. Thế nào là **xong**?
2. Nó **tự kiểm tra** bằng gì?
3. Nó được **đụng** vào đâu?
4. Điều gì **dừng** nó?
5. Kết quả đi đâu, **ai duyệt**?

:::warning Đừng tự động hoá việc bạn chưa làm tay được
Nếu bạn chưa từng làm việc đó thành công trong một phiên tương tác, đừng đưa nó vào script hay lịch. Làm tay → ổn định prompt → mức 1 → mức 2 → mức 3.
:::

:::interview Bạn quyết định tự động hoá một việc bằng Claude thế nào?
Chỉ khi đã làm tay thành công nhiều lần và có phép kiểm tra tự động. Lên dần ba mức: trong phiên (`/loop`, `/goal`) → script/CI (`claude -p` quyền tối thiểu, giới hạn lượt) → cloud scheduled task (branch protection, theo dõi các lần chạy đầu). Trả lời năm câu hỏi: xong là gì, kiểm tra gì, đụng gì, dừng khi nào, ai duyệt.
:::

:::quiz Bạn muốn Claude kiểm tra mỗi 10 phút xem deploy staging xong chưa trong lúc bạn làm việc khác, ngay trong phiên đang mở. Dùng gì?
- [ ] `/schedule`
- [x] `/loop 10m …`
- [ ] `claude -p`
- [ ] GitHub Actions

`/schedule` tạo task trên cloud, hợp với việc lặp dài hạn kể cả khi tắt máy.
:::

:::quiz Vì sao `claude -p "fix lint"` trong CI có thể dừng mà không sửa gì?
- [ ] `-p` không được sửa file
- [x] Ở `-p`, hành động cần duyệt bị từ chối khi không có ai duyệt — phải cấp trước bằng `--allowedTools` hoặc permission mode
- [ ] CI không có mạng
- [ ] Thiếu `/loop`

Xem Lab 10 cho cấu hình khoá chặt.
:::

:::exercise Tự động hoá một việc nhỏ qua ba mức
Chọn việc: "tóm tắt thay đổi của ngày hôm nay". (1) Làm tay trong phiên; (2) chuyển thành một dòng `claude -p` trong `package.json` (`npm run daily-summary`); (3) viết mô tả `/schedule` (chưa cần tạo thật) kèm câu trả lời cho năm câu hỏi.
???
(1) *"Tóm tắt các commit hôm nay trên nhánh hiện tại thành 5 gạch đầu dòng tiếng Việt."* (2) `"daily-summary": "git log --since=midnight --pretty='- %s' | claude -p \"Tóm tắt thành 5 gạch đầu dòng tiếng Việt cho standup.\""` — pipe dữ liệu vào nên không cần quyền Bash. (3) Xong: một tin nhắn tóm tắt; tự kiểm tra: mỗi commit được nhắc tới; được đụng: chỉ đọc git log; dừng: một lượt; kết quả: comment vào một issue cố định hoặc gửi qua connector, bạn đọc mỗi sáng — không ghi gì vào repo.
:::

> Nguồn: *Run prompts on a schedule*, *Keep Claude working toward a goal*, *Run Claude Code programmatically*, *Automate work with scheduled tasks*, *Best practices* — "Let Claude run without you", code.claude.com/docs (truy cập 12/11/2026).
