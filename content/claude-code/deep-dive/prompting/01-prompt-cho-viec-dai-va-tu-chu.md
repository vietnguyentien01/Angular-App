---
title: Prompt nâng cao — spec bằng phỏng vấn, "be ambitious", điều kiện /goal, lời giao việc cho subagent và lần chạy tự chủ
summary: "Khi việc dài và Claude tự chạy nhiều bước, chất lượng phụ thuộc vào văn bản bạn đưa trước: phỏng vấn để có SPEC.md, nói rõ phạm vi bằng 'be ambitious', viết điều kiện /goal đo được có giới hạn, giao việc cho subagent như viết ticket, prompt cho /batch và claude -p — kèm mẫu và các lỗi thường gặp."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, prompting, spec, goal, subagents]
related: [claude-code/consolidate/prompting/sau-mau-prompt-hieu-qua, claude-code/deep-dive/automation/lam-viec-song-song]
---

## TL;DR

- Việc dài: **viết ra đĩa** những gì phải sống suốt quá trình (SPEC.md, tiêu chí xong) — hội thoại có thể bị compact, file thì không.
- Claude mặc định hiểu yêu cầu **thận trọng** (làm bản nhỏ nhất thoả mãn). Muốn bản đầy đủ: nói "be ambitious" + liệt kê phạm vi.
- "think step by step", "be thorough" chỉ là chữ thường — nút thật là **effort**; `ultrathink` cho một lượt.
- Điều kiện `/goal` tốt = **một trạng thái cuối đo được + cách chứng minh + ràng buộc + giới hạn lượt**.

## 1. Chưa rõ mình muốn gì → phỏng vấn

```text
Mình muốn thêm phân quyền theo vai trò (admin, editor, viewer) cho app nhưng chưa nghĩ kỹ.
Phỏng vấn mình từng câu (ưu tiên câu trắc nghiệm) cho tới khi đủ để viết spec, rồi ghi vào SPEC.md gồm:
phạm vi, ngoài phạm vi, quy tắc, tiêu chí chấp nhận đánh số, rủi ro.
```

Claude hỏi những phần bạn chưa chốt (quyền theo route hay theo nút? token chứa role hay gọi API? hành vi khi mất quyền giữa phiên?). Có `SPEC.md` rồi → **mở phiên mới** để triển khai từ context sạch; SPEC.md cũng là thứ reviewer đối chiếu sau này.

## 2. Nói rõ phạm vi: "be ambitious"

```text bad
làm trang settings theo mockup
```

```text good
Làm trang settings theo mockup [Image #1]. Be ambitious: trạng thái rỗng và lỗi, luồng lưu nối API thật,
điều hướng bằng bàn phím, thông báo thành công cho trình đọc màn hình — không chỉ layout.
```

Đây là nói về **phạm vi** (chỉ bạn biết), không phải về "nghĩ kỹ hơn".

## 3. Điều kiện `/goal`

Thành phần của một điều kiện bền:

| Thành phần | Ví dụ |
|---|---|
| Một trạng thái cuối đo được | `ng build` exit 0, không còn file nào dùng `*ngIf` |
| Cách chứng minh | "`npm test -- --watch=false` exit 0", "`git grep -n '\*ngIf' src` rỗng" |
| Ràng buộc | "không sửa file spec nào ngoài file được thêm mới", "không dùng `any`" |
| Giới hạn | "hoặc dừng sau 25 lượt" |

```text
/goal Mọi template trong src/app không còn *ngIf/*ngFor (git grep -nE '\*ng(If|For)' src/app trả về rỗng),
ng build exit 0 và npm test -- --watch=false exit 0; không đổi hành vi, không sửa file .spec.ts có sẵn;
hoặc dừng sau 25 lượt và báo phần còn lại.
```

Điều kiện tối đa 4.000 ký tự. `/goal` không tự cấp quyền — chạy ở auto mode nếu muốn không bị hỏi từng bước.

```text bad
/goal làm xong migration
```

Không đo được → evaluator đoán; không giới hạn → có thể chạy rất lâu.

## 4. Giao việc cho subagent

Subagent **không thấy** hội thoại của bạn (trừ fork). Lời giao việc phải tự chứa như một ticket:

```text
Dùng subagent Explore: trong src/app, tìm mọi nơi subscribe() mà không có takeUntilDestroyed, async pipe,
hay unsubscribe trong ngOnDestroy. Chỉ trả về bảng: file:dòng | observable | đề xuất cleanup. Tối đa 30 dòng.
```

Checklist: mục tiêu · phạm vi (thư mục) · tiêu chí (cái gì tính là vi phạm) · **định dạng và độ dài kết quả** (giữ context chính gọn).

## 5. Prompt cho `/batch` và lần chạy không giám sát

```text
/batch Chuyển constructor injection sang inject() trong mọi file src/app/**/*.ts.
Mỗi đơn vị: một thư mục feature. Giữ nguyên thứ tự khởi tạo; không đổi public API của service.
Mỗi đơn vị phải chạy ng build và test của feature đó trước khi mở PR; PR mô tả số file đổi và chỗ cần review kỹ.
```

```bash
claude --bare -p "$(cat prompts/nightly-deps.md)" --allowedTools "..." --permission-mode dontAsk --max-turns 20
```

Prompt cho lần chạy không có người nên có thêm:

- **Điều gì làm thì dừng và báo** (vd "nếu cần đổi major version thì dừng, liệt kê lý do").
- **Đầu ra cho bước sau** (định dạng cố định, hoặc `--json-schema`).
- Không có câu hỏi ngược — người không có mặt để trả lời.

## 6. Effort và ultrathink

| Bạn muốn | Dùng |
|---|---|
| Một câu hỏi khó trong phiên bình thường | Viết `ultrathink` trong tin nhắn đó |
| Cả phiên cho việc khó (bug lạ, thiết kế) | `/effort high` hoặc `xhigh` |
| "Nghĩ kỹ vào" | Không có tác dụng như nút — chỉ là chữ |

## Lỗi thường gặp

| Lỗi | Hậu quả | Sửa |
|---|---|---|
| Spec chỉ nằm trong hội thoại | Mất chi tiết sau compact | Ghi SPEC.md |
| Goal không đo được | Dừng sớm hoặc chạy mãi | Lệnh kiểm tra + giới hạn lượt |
| Giao subagent "xem giúp module auth" | Kết quả dài, không dùng được | Tiêu chí + định dạng + độ dài |
| Prompt `-p` có câu "nếu không rõ thì hỏi mình" | Không ai trả lời | Quy tắc dừng-và-báo |
| Bỏ ràng buộc "không sửa test" | Claude sửa test cho xanh | Ghi ràng buộc vào điều kiện |

:::senior Góc nhìn senior
Khi giao việc cho agent tự chủ, bạn đang viết **hợp đồng**: định nghĩa xong, giới hạn, điều cấm, và báo cáo. Những người viết được hợp đồng chặt là những người tận dụng được chế độ chạy dài; người viết lỏng sẽ mất thời gian review thứ không mong muốn.
:::

:::quiz Điều kiện `/goal` nào tốt nhất?
- [ ] "/goal tối ưu module reports"
- [ ] "/goal làm cho test xanh"
- [x] "/goal npm test -- --watch=false exit 0 và ng build exit 0, không sửa file .spec.ts có sẵn, hoặc dừng sau 20 lượt"
- [ ] "/goal think hard and finish everything"

Có trạng thái đo được, cách chứng minh, ràng buộc và giới hạn.
:::

:::quiz Vì sao nên mở phiên mới sau khi có SPEC.md?
- [ ] Vì SPEC.md chỉ đọc được ở phiên mới
- [x] Để phiên triển khai bắt đầu với context sạch và một định nghĩa xong đã viết ra, không mang theo các phương án bị loại khi phỏng vấn
- [ ] Để đổi model
- [ ] Không cần

File trên đĩa sống qua `/clear`; hội thoại phỏng vấn thì không cần nữa.
:::

:::exercise Viết bộ ba văn bản cho một việc lớn
Chọn một việc lớn trong dự án (vd chuyển toàn bộ form sang Signal Forms). Viết: (1) prompt phỏng vấn để ra SPEC.md; (2) điều kiện `/goal` đủ bốn thành phần; (3) lời giao việc cho một subagent review cuối, có tiêu chí và định dạng kết quả.
???
(1) *"Mình muốn chuyển form sang Signal Forms. Phỏng vấn mình về: form nào trước, validator tuỳ chỉnh, form động, test hiện có, tiêu chí xong; rồi viết SPEC.md."* (2) *"/goal mọi form trong SPEC.md mục 3 dùng @angular/forms/signals (git grep FormGroup src/app/features chỉ còn các file ghi trong mục ngoài phạm vi), ng build và npm test exit 0, không xoá test cũ, hoặc dừng sau 30 lượt và báo form còn lại."* (3) *"Subagent review: đối chiếu diff với từng tiêu chí chấp nhận trong SPEC.md; trả bảng tiêu chí | đạt/không | bằng chứng file:dòng; tối đa 20 dòng; không sửa file."*
:::

> Nguồn: *Best practices for Claude Code* — "Write a specific prompt", "Brainstorm with Claude first"; *Keep Claude working toward a goal*; *Create custom subagents*; *Commands* — `/batch`, code.claude.com/docs (truy cập 12/11/2026).
