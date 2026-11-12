---
title: "Lab 03 — Làm một tính năng bằng plan mode: lọc theo trạng thái và form thêm task"
summary: "Dùng plan mode cho một thay đổi nhiều file: viết prompt /plan có phạm vi và phép kiểm tra, đọc và sửa kế hoạch bằng Ctrl+G, duyệt với từng bước sửa, theo dõi phút đầu, xác minh bằng test và chạy app, rồi tự đánh giá kế hoạch so với kết quả."
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, lab, plan-mode, feature]
related: [claude-code/consolidate/workflows/explore-plan-code, claude-code/labs/labs/sua-bug-test-first-va-rewind]
---

## Mục tiêu

Thêm vào cc-lab: (1) dropdown lọc theo trạng thái (Tất cả / Cần làm / Đang làm / Xong) nối với `TaskStore.status`; (2) form thêm task (tiêu đề bắt buộc, hạn chót); (3) test cho cả hai.

**Thời gian:** 45–60 phút · **Tiền đề:** Lab 01–02.

## Trước khi bắt đầu

- [ ] Lab 01–02 xong; `git status` sạch.
- [ ] Tạo nhánh riêng cho lab: `git checkout -b lab03`.
- [ ] Mở sẵn một terminal thứ hai để chạy `npx ng serve` ở Bước 5.


## Bước 1 — Tự phác kế hoạch trước (5 phút, không dùng Claude)

Viết ra giấy: những file nào sẽ đổi? Test nào cần có? Thứ tự làm? Giữ tờ giấy này để so ở Bước 6.

## Bước 2 — Vào plan mode với prompt có cấu trúc

```bash
claude -n "lab03-filter-form"
```

```text
/plan Thêm hai tính năng vào module tasks:
1. Dropdown lọc theo trạng thái (Tất cả, Cần làm, Đang làm, Xong) điều khiển TaskStore.status.
2. Form thêm task: tiêu đề bắt buộc (bỏ khoảng trắng hai đầu, không cho rỗng), hạn chót dạng YYYY-MM-DD, gọi TaskStore.add.

Phạm vi: chỉ src/app/tasks/. Không thêm thư viện. Không đổi chữ ký các hàm trong task-filter.ts.
Kế hoạch cần có: danh sách file sẽ tạo/sửa, thứ tự các bước, test cho từng bước (component test bằng TestBed),
và lệnh kiểm tra sau mỗi bước: npm test -- --watch=false.
Lưu ý a11y: mọi input/select có label.
```

Thanh trạng thái phải hiện `⏸ plan mode on`. Claude đọc code (thường qua subagent Plan) rồi trình kế hoạch.

## Bước 3 — Đọc và sửa kế hoạch

Trước khi duyệt, kiểm tra bằng các câu hỏi:

- Có bước nào bạn không hiểu? → chọn **No, keep planning** và hỏi.
- Mỗi bước có test và lệnh kiểm tra chưa?
- Có đụng file ngoài `src/app/tasks/` không?
- Form dùng gì: Reactive Forms, Signal Forms hay binding tay? Có hợp quy ước của bạn không?

Nhấn `Ctrl+G` để mở kế hoạch trong editor và **sửa ít nhất một điểm**, ví dụ thêm bước "test: submit tiêu đề toàn khoảng trắng thì không thêm task" nếu kế hoạch thiếu.

## Bước 4 — Duyệt và theo dõi phút đầu

Chọn **Yes, manually approve edits** (lab này cố ý duyệt từng lần sửa). Trong phút đầu:

- Claude sửa đúng file như kế hoạch chưa?
- Nếu lệch: `Esc`, nói rõ chỗ lệch, hoặc gõ thêm một tin (được xếp hàng) mà không dừng.

## Bước 5 — Xác minh

```text
Chạy npm test -- --watch=false và npx ng build, dán phần tóm tắt kết quả.
```

Rồi tự chạy app:

```bash
npx ng serve
```

Mở http://localhost:4200: lọc "Xong" chỉ còn "Review PR"; thêm task "  " (toàn khoảng trắng) bị chặn; thêm task hợp lệ thấy xuất hiện. Dùng bàn phím (Tab/Enter) để chắc form truy cập được.

## Bước 6 — So sánh và commit

So kế hoạch của bạn (Bước 1) với kế hoạch của Claude và kết quả:

| Câu hỏi | Ghi chú của bạn |
|---|---|
| Claude nghĩ tới điều gì bạn bỏ sót? | |
| Bạn nghĩ tới điều gì Claude bỏ sót? | |
| Bước nào trong kế hoạch bị làm khác đi? Vì sao? | |

```text
/code-review
```

Sửa những phát hiện đúng, rồi commit.

## Kết quả bạn nên thấy

> Câu chữ Claude trả lời mỗi lần một khác — điều cần kiểm là **kết quả** trong bảng dưới (file đổi gì, lệnh nào pass, Claude có bị chặn đúng chỗ không), không phải câu chữ.

| Bước | Dấu hiệu đúng | Nếu khác |
|---|---|---|
| Bước 2 | Thanh trạng thái `⏸ plan mode on`; Claude trình kế hoạch, **không** sửa file | `Shift+Tab` tới plan mode; dùng `/plan …` |
| Bước 3 | `Ctrl+G` mở kế hoạch trong editor; lưu đóng thì kế hoạch đã sửa hiện lại | Đặt biến `EDITOR`/`VISUAL` (vd `export EDITOR=nano`) |
| Bước 4 | Mỗi lần sửa file đều hỏi bạn (vì chọn manually approve) | Bạn đã chọn auto mode — không sao, nhưng mất phần luyện đọc diff |
| Bước 5 | Test và build pass; trên trình duyệt: lọc "Xong" chỉ còn "Review PR"; tiêu đề toàn khoảng trắng bị chặn | Mô tả lại đúng hành vi sai cho Claude kèm bước tái hiện |
| Bước 6 | `/code-review` trả danh sách (có thể rỗng); bạn sửa phát hiện đúng rồi commit | Phát hiện sai → ghi lại, đừng sửa theo |

## Checklist hoàn thành

- [ ] Prompt `/plan` có mục tiêu, phạm vi, ràng buộc, phép kiểm tra
- [ ] Đã sửa kế hoạch bằng `Ctrl+G` trước khi duyệt
- [ ] Test mới bao phủ: lọc theo từng trạng thái, thêm task hợp lệ, chặn tiêu đề rỗng
- [ ] `npm test` và `ng build` xanh; kiểm tra tay trên trình duyệt bằng bàn phím
- [ ] Bảng so sánh ở Bước 6 có ít nhất một dòng ở mỗi cột

## Lỗi thường gặp

| Hiện tượng | Xử lý |
|---|---|
| Kế hoạch đề xuất thêm thư viện UI | No, keep planning: "không thêm thư viện, dùng phần tử HTML chuẩn" |
| Claude sửa `task-filter.ts` dù đã cấm đổi chữ ký | Kiểm tra: đổi chữ ký hay chỉ thêm hàm? Nếu đổi chữ ký → từ chối kèm ghi chú |
| Test component fail vì thứ tự thay đổi signal | Nhờ Claude giải thích vì sao trước khi sửa; đọc kỹ lời giải thích |

:::quiz Thanh trạng thái hiện `⏸ plan mode on`. Claude được làm gì?
- [ ] Sửa file tự do
- [x] Đọc file, chạy lệnh khám phá, viết kế hoạch — không sửa source tới khi bạn duyệt
- [ ] Chỉ trả lời câu hỏi, không đọc file
- [ ] Push code

Duyệt kế hoạch xong phiên mới chuyển sang chế độ được sửa.
:::

:::quiz Vì sao lab yêu cầu tự phác kế hoạch trên giấy trước (Bước 1)?
- [ ] Để Claude đọc tờ giấy
- [x] Để so với kế hoạch của Claude — vừa kiểm tra Claude, vừa giữ kỹ năng thiết kế của chính bạn
- [ ] Vì plan mode cần đầu vào
- [ ] Không có lý do

Bảng so sánh ở Bước 6 cho thấy ai bỏ sót điều gì.
:::

:::quiz Trong lab này vì sao chọn "Yes, manually approve edits" thay vì auto mode?
- [ ] Auto mode không dùng được với Angular
- [x] Để luyện đọc từng thay đổi và đối chiếu với kế hoạch — mục tiêu học, không phải tốc độ
- [ ] Vì plan mode bắt buộc như vậy
- [ ] Để tiết kiệm token

Khi đã quen, với thay đổi bạn tin hướng đi chung, auto mode giúp nhanh hơn.
:::

:::exercise Thử thách mở rộng — dùng opusplan
Làm lại một tính năng nhỏ khác (vd nút "Xoá các task đã xong") với `/model opusplan`: plan trên Opus, thực thi trên Sonnet. Sau đó so `/usage` với lần làm Bước 2–5 bằng model mặc định.
???
Kỳ vọng: chất lượng kế hoạch tương đương, phần thực thi tốn ít hơn nếu Sonnet rẻ hơn model mặc định của bạn. Nhớ thêm test: xoá đúng các task `done`, không đổi task khác, `total` cập nhật. Về lại model cũ bằng `/model default` hoặc model bạn hay dùng.
:::

> Nguồn: *Choose a permission mode* — mục plan mode; *Common workflows*; *Model configuration* — opusplan, code.claude.com/docs (truy cập 11/11/2026).
