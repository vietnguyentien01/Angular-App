---
title: Explore → Plan → Code — khi nào cần lập kế hoạch và làm thế nào cho đúng
summary: Plan mode tách việc "hiểu và đề xuất" khỏi việc "sửa file". Bài này chỉ cách vào plan mode, đọc và sửa kế hoạch bằng Ctrl+G, chọn cách duyệt, khi nào bỏ qua bước plan, giao phần nghiên cứu cho subagent, và dùng opusplan để tách model cho hai pha.
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, plan-mode, workflow]
related: [claude-code/review/guardrails/che-do-quyen, claude-code/consolidate/memory/quy-trinh-task-angular]
---

## TL;DR

- Thay đổi **nhiều file, chưa rõ cách làm, hoặc đụng code lạ** → plan trước. Sửa typo, đổi tên biến, thêm một dòng log → làm luôn.
- Plan mode: Claude đọc, chạy lệnh khám phá, viết kế hoạch — **không sửa source** tới khi bạn duyệt.
- Kế hoạch là thứ rẻ nhất để sửa: sửa kế hoạch bằng `Ctrl+G` rẻ hơn rất nhiều so với sửa 15 file code sai hướng.

## Cơ chế

1. **Vào plan mode**: `Shift+Tab` tới khi thanh trạng thái hiện `⏸ plan mode on`, hoặc `/plan <mô tả>`, hoặc `claude --permission-mode plan`.
2. **Claude khám phá**: thường giao cho subagent **Plan** (chỉ đọc) để kết quả tìm kiếm nằm trong context riêng, hội thoại chính gọn.
3. **Claude trình kế hoạch** và hỏi:
   - *Yes, and use auto mode* (hoặc *auto-accept edits*) — duyệt và làm.
   - *Yes, manually approve edits* — duyệt, vẫn hỏi từng lần sửa.
   - *No, keep planning* — góp ý, Claude sửa kế hoạch.
4. **`Ctrl+G`** mở kế hoạch trong editor để bạn sửa thẳng trước khi duyệt.
5. Duyệt xong, phiên **rời plan mode** sang chế độ bạn chọn; muốn plan tiếp thì `Shift+Tab` lại hoặc `/plan`.

:::note Kế hoạch sống sót qua compact
Kế hoạch Claude viết trong plan mode được nạp lại từ đĩa sau khi context bị compact — nên với task dài, kế hoạch tốt là "neo" giữ hướng đi.
:::

## Ví dụ với dự án Angular

```text bad
Chuyển app sang zoneless.
```

```text good
/plan Mình muốn chuyển app sang zoneless (Angular 22).
Trước khi đề xuất: tìm mọi chỗ phụ thuộc NgZone (NgZone.run, onStable, setTimeout để "kích" CD),
thư viện bên thứ ba có thể cần zone, và test dùng fakeAsync.
Kế hoạch cần: danh sách file theo nhóm rủi ro, thứ tự làm từng bước nhỏ có thể kiểm tra,
lệnh kiểm tra sau mỗi bước (ng test, ng build), và điểm dừng nếu một bước fail.
```

Khi đọc kế hoạch, tự hỏi:

- Có bước nào **mình không hiểu** không? → hỏi trước khi duyệt.
- Mỗi bước có **phép kiểm tra** không?
- Có đụng tới file ngoài phạm vi (config CI, package mới) không?

## Khi nào bỏ qua plan?

| Làm luôn | Nên plan |
|---|---|
| Diff mô tả được trong một câu | Chưa biết sẽ sửa ở đâu |
| Một file, hành vi rõ | Nhiều module, có thứ tự phụ thuộc |
| Đã có test bao phủ | Đụng code legacy không ai rõ |
| Đổi tên, format, thêm log | Migration, đổi kiến trúc, đổi schema |

## Tách model cho hai pha: `opusplan`

```text
/model opusplan
```

Dùng `opus` trong plan mode để suy luận kiến trúc, tự chuyển sang `sonnet` khi thực thi — tiết kiệm mà vẫn có kế hoạch chất lượng.

## Chưa rõ yêu cầu? Phỏng vấn trước khi plan

Với tính năng lớn còn mơ hồ, nhờ Claude **phỏng vấn bạn** rồi viết `SPEC.md` (xem bài *Viết prompt cụ thể*). Sau đó `/clear` và bắt đầu phiên mới: *"Đọc SPEC.md và lên kế hoạch triển khai"* — context sạch, chỉ chứa spec.

## Pitfalls

:::warning Duyệt kế hoạch mà không đọc
Kế hoạch dài, người mới bấm "Yes" cho xong. Đó là lúc rẻ nhất để bắt sai hướng — đọc ít nhất danh sách file và các bước kiểm tra.
:::

:::warning Plan cho mọi thứ
Plan cho việc nhỏ chỉ tốn thời gian và token. Plan mode là công cụ, không phải nghi thức.
:::

:::senior Góc nhìn senior
Kế hoạch tốt của Claude giống một design doc ngắn: phạm vi, rủi ro, thứ tự, cách kiểm tra, điểm rollback. Hãy review nó như review design doc của đồng nghiệp — và giữ thói quen tự viết phác thảo trước rồi so với Claude, để kỹ năng thiết kế của chính bạn không bị teo đi.
:::

:::quiz Bạn cần đổi tên một biến trong một file đã có test. Có cần plan mode không?
- [x] Không — diff mô tả được trong một câu, làm luôn và chạy test
- [ ] Có, mọi thay đổi đều phải plan
- [ ] Có, và dùng `max` effort
- [ ] Phải viết SPEC.md trước

Plan có giá trị khi chưa rõ cách làm hoặc thay đổi lan rộng.
:::

:::quiz Kế hoạch gần đúng nhưng bạn muốn sửa thứ tự hai bước và bỏ một bước. Nhanh nhất?
- [ ] Chọn Yes rồi sửa code sau
- [x] `Ctrl+G` mở kế hoạch trong editor, sửa trực tiếp, rồi duyệt
- [ ] `/clear` và làm lại từ đầu
- [ ] Thoát và tự code

Sửa kế hoạch rẻ hơn sửa code đã viết sai thứ tự.
:::

:::interview Vì sao plan mode giúp giữ context gọn?
Phần khám phá (đọc nhiều file, grep rộng) thường được giao cho subagent Plan chỉ-đọc chạy trong context riêng; hội thoại chính chỉ nhận kết quả tóm tắt và kế hoạch. Kế hoạch còn được nạp lại sau compact, nên task dài vẫn giữ hướng.
:::

:::exercise Lập kế hoạch cho một thay đổi thật
Chọn một thay đổi trong dự án của bạn đụng ≥ 3 file (vd thêm interceptor xử lý lỗi chung, chuyển một form sang Signal Forms). Viết prompt `/plan` có: mục tiêu, phạm vi không được đụng, yêu cầu phép kiểm tra cho từng bước. Đọc kế hoạch, ghi ra 2 điểm bạn muốn sửa trước khi duyệt.
???
Prompt mẫu: *"/plan Thêm `errorInterceptor` chuẩn hoá lỗi HTTP thành `AppError` và hiện toast. Không đổi API của các service hiện có, không thêm thư viện. Kế hoạch: danh sách file, thứ tự, test cho mỗi bước (unit test interceptor với HttpTestingController), lệnh `ng test --watch=false` sau mỗi bước."* Điểm thường cần sửa: (1) kế hoạch quên thứ tự interceptor so với interceptor retry/auth hiện có; (2) kế hoạch hiển thị toast cho cả lỗi 401 vốn đã được auth interceptor xử lý → cần loại trừ.
:::

> Nguồn: *Choose a permission mode* — mục "Analyze before you edit with plan mode"; *Common workflows* — mục "Plan before editing"; *Model configuration* — mục "opusplan", code.claude.com/docs (truy cập 11/11/2026).
