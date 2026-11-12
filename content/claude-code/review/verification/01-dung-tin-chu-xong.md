---
title: Đừng tin chữ "xong" — năm thói quen kiểm chứng cho người mới
summary: "Claude nói 'đã xong, test pass' chưa phải bằng chứng. Năm thói quen kiểm chứng: nêu cách kiểm tra trong prompt, đòi output thật, tự đọc diff, chạy app thật bằng /verify, đối chiếu với yêu cầu — kèm các dấu hiệu Claude đang 'lách'."
type: lesson
level: core
lastReviewed: 2026-11-12
tags: [claude-code, verification, beginner, testing]
related: [claude-code/consolidate/verification/cho-claude-phep-kiem-tra, claude-code/deep-dive/verification/kiem-chung-giao-dien]
---

## TL;DR

Claude làm tốt nhất khi **tự kiểm tra được** công việc của mình. Việc của bạn: (1) cho nó cách kiểm tra, (2) đòi **bằng chứng**, (3) tự nhìn lại trước khi chấp nhận.

## Năm thói quen

### 1. Nêu cách kiểm tra ngay trong prompt

```text bad
Sửa lỗi lọc theo ngày ở trang orders.
```

```text good
Sửa lỗi lọc theo ngày ở trang orders. Viết test tái hiện trước, rồi sửa;
xong khi npm test -- --watch=false và ng build đều pass.
```

Có tiêu chí → Claude lặp tới khi đạt, thay vì dừng sau lần thử đầu.

### 2. Đòi output thật, không phải tóm tắt

```text
Dán phần tóm tắt cuối cùng của lệnh test (số test pass/fail) và lỗi đầu tiên nếu có.
```

Hoặc tự chạy: `! npm test -- --watch=false`. Bật `Ctrl+O` để xem chính xác lệnh nào đã chạy.

### 3. Tự đọc diff

```text
/diff
```

Trả lời được ba câu trước khi chấp nhận:

- File nào đổi — có file nào **ngoài phạm vi**?
- Có thay đổi ở **test** không? Thêm test mới là tốt; **sửa kỳ vọng** của test cũ là đáng ngờ.
- Mình giải thích được mỗi thay đổi cho đồng nghiệp không?

### 4. Chạy thứ thật

Test xanh chưa chắc tính năng chạy. Với UI:

```text
/verify
```

`/verify` build và chạy app, quan sát kết quả thật — không dựa vào test hay typecheck. Hoặc tự `ng serve` và bấm thử, dùng cả bàn phím.

### 5. Đối chiếu với yêu cầu ban đầu

```text
Đối chiếu thay đổi với yêu cầu ban đầu của mình: mỗi ý đã làm chưa, có làm thêm gì mình không yêu cầu không?
```

## Dấu hiệu Claude đang "lách"

| Dấu hiệu | Nghĩa là | Phản ứng |
|---|---|---|
| Kỳ vọng của test cũ bị đổi | Sửa test cho khớp code sai | Yêu cầu sửa code, giữ test |
| Test bị `skip`/`xit`/xoá | Né test fail | Không chấp nhận |
| `as any`, `@ts-ignore`, `!` rải rác | Né lỗi type | Hỏi lý do từng chỗ |
| `try/catch` nuốt lỗi im lặng | Giấu lỗi | Yêu cầu xử lý lỗi rõ ràng |
| "Đã chạy test" nhưng không thấy lệnh trong `Ctrl+O` | Báo cáo không có bằng chứng | Chạy lại và đòi output |
| Đụng file cấu hình (`angular.json`, CI) không được yêu cầu | Lệch phạm vi | `/rewind` hoặc từ chối |

:::warning Claude có thể báo "xong" một cách tự tin mà sai
Đó không phải ác ý — mô hình có thể tin rằng nó đã làm đúng. Đó là lý do phép kiểm tra phải là thứ **chạy được** (test, build, app), không phải lời mô tả.
:::

:::interview Claude báo 'xong, test pass'. Bạn làm gì trước khi chấp nhận?
Xem bằng chứng: output thật của lệnh test (Ctrl+O hoặc tự chạy), `/diff` kiểm tra có sửa kỳ vọng test cũ, skip test, `any`/`@ts-ignore` không; chạy app thật (`/verify`) với thay đổi UI; đối chiếu từng ý của yêu cầu ban đầu. Không có bằng chứng thì chưa xong.
:::

:::quiz Claude báo "đã sửa xong, tất cả test pass". Bạn nên làm gì đầu tiên?
- [ ] Commit ngay
- [x] Xem bằng chứng: output lệnh test thật (`Ctrl+O` hoặc tự chạy) và `/diff` xem có test nào bị sửa kỳ vọng không
- [ ] Hỏi "bạn chắc không?"
- [ ] Chuyển sang task khác

Hỏi lại chỉ cho thêm một câu trả lời, không thêm bằng chứng.
:::

:::quiz Thay đổi nào trong diff là dấu hiệu đáng ngờ nhất?
- [ ] Thêm một file spec mới
- [x] Đổi `expect(result).toEqual([1])` thành `toEqual([])` trong test có sẵn
- [ ] Thêm docstring
- [ ] Đổi tên biến cục bộ

Sửa kỳ vọng của test cũ có thể là che bug — cần lý do rõ ràng theo spec.
:::

:::exercise Kiểm chứng một thay đổi có "bẫy"
Trong cc-lab: nhờ Claude *"sửa filterTasks để tìm không phân biệt hoa thường"* **mà không** nói gì về test. Khi nó xong, áp đủ năm thói quen: bằng chứng test, `/diff`, chạy app, đối chiếu yêu cầu. Ghi lại Claude có tự viết test không, có đụng file ngoài phạm vi không.
???
Kết quả hay gặp: Claude sửa đúng nhưng **không** thêm test tái hiện (vì prompt không yêu cầu) — thói quen 1 bị thiếu ngay từ đầu. Bổ sung: *"Thêm test cho trường hợp 'angular' viết thường và từ khoá có khoảng trắng hai đầu; chạy test và dán kết quả."* Kiểm tra trên trình duyệt: gõ "angular" ra đúng task. So với Lab 04, nơi test-first được yêu cầu từ đầu.
:::

> Nguồn: *Best practices for Claude Code* — "Give Claude a check to run"; *Extend Claude with skills* — "Run and verify your app", code.claude.com/docs (truy cập 12/11/2026).
