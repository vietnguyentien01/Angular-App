---
title: "Lab 13 — Dự án tổng hợp: tính năng 'Nhắc việc sắp đến hạn' từ spec tới PR, dùng mọi kỹ năng"
summary: "Bài cuối khoá: phỏng vấn để viết SPEC.md, plan mode, test-first, hook và skill của các lab trước, reviewer subagent, kiểm tra giao diện bằng Playwright, PR với cổng review tự động — kèm thang chấm điểm để bạn tự đánh giá mức thành thạo Claude Code."
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, lab, capstone]
related: [claude-code/consolidate/memory/quy-trinh-task-angular, claude-code/deep-dive/automation/chay-khong-can-giam-sat]
---

## Đề bài

Thêm vào cc-lab tính năng **Nhắc việc sắp đến hạn**:

- Khu vực "Sắp đến hạn" hiển thị task chưa xong có hạn trong 3 ngày tới (tính cả hôm nay và ngày thứ 3), sắp theo hạn gần nhất.
- Người dùng chọn được khoảng 1, 3 hoặc 7 ngày; lựa chọn được nhớ sau khi tải lại trang.
- Task quá hạn hiển thị riêng, nổi bật, có số đếm.
- Truy cập được bằng bàn phím, đọc được bằng trình đọc màn hình.

**Thời gian:** 2–3 giờ · **Tiền đề:** Lab 01–12 (dùng lại CLAUDE.md, rules, settings, hook, skill, subagent, script review).

## Giai đoạn 1 — Spec (20 phút)

```text
Mình muốn làm tính năng "Nhắc việc sắp đến hạn" (mô tả ngắn: …dán đề bài…).
Phỏng vấn mình từng câu một về những điểm còn mơ hồ (múi giờ, lưu lựa chọn ở đâu, khi không có task, a11y…),
rồi viết SPEC.md gồm: phạm vi, ngoài phạm vi, quy tắc nghiệp vụ, tiêu chí chấp nhận đánh số (kiểm chứng được), kế hoạch test.
```

Đọc `SPEC.md`, sửa tay ít nhất một tiêu chí cho chặt hơn. Commit.

## Giai đoạn 2 — Kế hoạch (15 phút)

```text
/clear
```

```text
/plan Đọc SPEC.md và lên kế hoạch triển khai theo từng bước nhỏ, mỗi bước có test và lệnh kiểm tra. Dùng dueWithin/isOverdue có sẵn nếu hợp; không thêm thư viện.
```

Sửa kế hoạch bằng `Ctrl+G` nếu cần. Ghi lại: kế hoạch có dùng `dueWithin` không, và có nhớ rằng nó từng có bug ở Lab 04?

## Giai đoạn 3 — Triển khai test-first (60–90 phút)

- Duyệt kế hoạch (auto mode nếu bạn tin hướng đi; manual nếu muốn luyện đọc).
- Hook của Lab 06 đang chạy: format tự động, chặn sửa `angular.json`, không cho dừng khi test đỏ.
- Dùng `/new-filter` (Lab 07) cho hàm lọc mới nếu cần.
- Phút đầu của mỗi bước: theo dõi, `Esc` nếu lệch.

## Giai đoạn 4 — Kiểm chứng (30 phút)

```text
@"angular-reviewer (agent)" review nhánh hiện tại theo SPEC.md: với mỗi tiêu chí chấp nhận, đạt hay không, bằng chứng ở file:dòng nào.
```

```text
/code-review
```

```text
Dùng Playwright kiểm tra từng tiêu chí chấp nhận trên http://localhost:4200, kể cả tải lại trang để xem lựa chọn có được nhớ. Báo bảng đạt/không đạt kèm bằng chứng.
```

```bash
./scripts/claude-review.sh && ./scripts/review-gate.sh
```

## Giai đoạn 5 — PR (15 phút)

```text
Tách commit theo Conventional Commits, push, tạo PR: Vấn đề, Thay đổi, Cách test (theo tiêu chí trong SPEC.md), Rủi ro, Ảnh chụp.
```

Tự đọc diff trên GitHub. Chỉ merge khi bạn giải thích được **mọi** dòng.

## Thang tự chấm (tối đa 20 điểm)

| Tiêu chí | 0 | 1 | 2 |
|---|---|---|---|
| Spec | Không có | Có nhưng tiêu chí mơ hồ | Tiêu chí đánh số, kiểm chứng được |
| Kế hoạch | Bỏ qua | Duyệt không đọc | Đọc, sửa ít nhất một điểm |
| Test-first | Test viết sau | Một phần | Mọi quy tắc nghiệp vụ có test fail trước |
| Phép kiểm tra | Không | Chỉ unit test | Unit test + kiểm tra trình duyệt + gate |
| Review độc lập | Không | Một loại | Reviewer theo spec + `/code-review` |
| Quyền & an toàn | Bypass | Mặc định | Settings/hook phù hợp, không mở rộng quyền vô lý |
| Context | Một phiên dài lộn xộn | Có `/clear` | `/clear` giữa giai đoạn, spec trên đĩa làm "neo" |
| PR | Một commit khổng lồ | Có mô tả | Commit tách theo mục đích, mô tả đủ 5 mục |
| Hiểu code | Không giải thích được | Giải thích phần lớn | Giải thích mọi dòng, trả lời câu hỏi của reviewer |
| Trung thực | Báo "xong" khi chưa xong | — | Phát hiện và ghi lại chỗ Claude sai |

**16–20:** thành thạo — sẵn sàng áp quy trình vào dự án thật. **10–15:** làm lại các lab ứng với tiêu chí thấp điểm. **Dưới 10:** quay lại phần Thực hành hằng ngày.

:::quiz Trong thang chấm, tiêu chí "Trung thực" đạt 2 điểm khi nào?
- [ ] Claude không bao giờ sai
- [x] Bạn phát hiện và ghi lại chỗ Claude sai (và cơ chế nào bắt được)
- [ ] Bạn không dùng Claude
- [ ] PR được merge nhanh

Phát hiện lỗi của AI là kỹ năng, không phải thất bại.
:::

:::quiz Vì sao Giai đoạn 4 dùng cả subagent review theo SPEC, `/code-review` và Playwright?
- [ ] Để tốn nhiều token
- [x] Mỗi lớp bắt loại lỗi khác: đúng yêu cầu, bug đúng đắn, hành vi giao diện thật
- [ ] Vì một lớp không chạy được
- [ ] Để thay người review

Nhiều lớp độc lập → ít lỗi lọt; người vẫn quyết định merge.
:::

:::quiz Ở Giai đoạn 2 vì sao `/clear` trước khi `/plan`?
- [ ] Để tiết kiệm tiền tuyệt đối
- [x] Để kế hoạch dựa trên SPEC.md trên đĩa (đã chốt), không bị nhiễu bởi các phương án bị loại trong cuộc phỏng vấn
- [ ] Vì plan mode yêu cầu context trống
- [ ] Để xoá SPEC.md

Spec trên đĩa sống qua `/clear` và compact; hội thoại thì không.
:::

:::exercise Viết bản rút kinh nghiệm
Sau khi merge, viết 5 dòng: (1) Claude làm tốt nhất ở đâu; (2) Claude sai ở đâu và bạn bắt được bằng cơ chế nào; (3) một dòng bạn sẽ thêm vào CLAUDE.md; (4) một hook/skill bạn sẽ thêm; (5) một việc lần sau bạn sẽ tự làm thay vì giao cho Claude.
???
Ví dụ: (1) Viết test biên và component nhanh, đúng style; (2) Lần đầu dùng `new Date()` trong hàm lọc — reviewer subagent bắt theo checklist mục 5; (3) "Lựa chọn của người dùng lưu localStorage qua một service bọc try/catch, không gọi trực tiếp trong component"; (4) Skill `/a11y-check` chạy kịch bản Playwright chuẩn; (5) Tự viết SPEC.md bản nháp trước khi nhờ phỏng vấn — để giữ kỹ năng phân tích yêu cầu.
:::

> Nguồn: tổng hợp từ *Best practices for Claude Code* và các trang đã dẫn trong Lab 01–12, code.claude.com/docs (truy cập 11/11/2026).
