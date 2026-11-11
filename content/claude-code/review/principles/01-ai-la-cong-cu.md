---
title: Nguyên tắc nền — kiến thức của bạn trước, Claude Code sau
summary: Vì sao vẫn phải nắm vững kiến thức nền, chỉ dẫn "mềm" khác chỉ dẫn "bắt buộc" thế nào, và bốn lý do thường gặp khi một phiên làm việc không như ý (theo hướng dẫn của Anthropic).
type: card
level: core
lastReviewed: 2026-11-11
tags: [claude-code, principles]
related: [claude-code/review/prompting/viet-prompt-cu-the, claude-code/consolidate/principles/hoc-cung-ai-khong-phu-thuoc]
---

## Bạn vẫn là người chịu trách nhiệm

Claude Code viết code nhanh, nhưng **người quyết định merge là bạn**. Nếu không giải thích được một thay đổi (vì sao `switchMap` chứ không phải `mergeMap`, vì sao component này OnPush an toàn), bạn không review được nó. Các môn Angular, RxJS, TypeScript trong app này là nền để bạn **đánh giá** những gì AI đề xuất.

## Chỉ dẫn mềm và chỉ dẫn bắt buộc

Theo *Best practices for Claude Code* (Anthropic), mọi chỉ dẫn thuộc một trong hai loại:

| | Mềm (model quyết định) | Bắt buộc (Claude Code luôn thực thi) |
|---|---|---|
| Làm gì | Prompt, `CLAUDE.md`, skill | Hook |
| Được đụng vào gì | Bộ phân loại của auto mode | Deny rule, sandbox, managed settings |
| Thế nào là xong | Yêu cầu bằng chứng, `/goal`, `/code-review` | Test, typecheck, `Stop` hook, CI |
| Ai có tiếng nói cuối | Bản tóm tắt của Claude | Branch protection, người duyệt merge |

Phần lớn thời gian hãy để Claude tự quyết. Chỉ những việc **luôn luôn** phải xảy ra (hoặc không bao giờ được xảy ra) mới cần cơ chế bắt buộc.

## Bốn lý do một phiên không như ý

1. Claude làm khác ý bạn hoặc phải tự tìm lại cùng một thông tin ở mỗi phiên → **thiếu thông tin không có trong repo**.
2. Claude báo xong nhưng chưa xong → **không có cách tự kiểm tra**.
3. Claude làm điều không bao giờ được làm, hoặc bỏ qua bước bắt buộc → **quy tắc đó cần cơ chế bắt buộc**, prompt không đảm bảo được.
4. Đúng nhưng tốn thời gian/token/lần hỏi quyền → **cần đổi một mặc định**.

:::quiz Quy tắc "không bao giờ sửa thư mục `src/gen/`" nên đặt ở đâu nếu thật sự không được có ngoại lệ?
- [ ] Viết IN HOA trong `CLAUDE.md`
- [ ] Nhắc lại trong mỗi prompt
- [x] Một hook `PreToolUse` hoặc deny rule — do Claude Code thực thi, không phụ thuộc model
- [ ] Một skill

`CLAUDE.md` và prompt là chỉ dẫn mềm: Claude làm theo gần như mọi lúc, nhưng không được đảm bảo.
:::

:::quiz Claude nói "xong rồi, test đều pass" nhưng thực tế còn lỗi. Theo hướng dẫn, nguyên nhân phổ biến nhất là?
- [ ] Model quá nhỏ
- [x] Claude không có phép kiểm tra pass/fail để tự chạy, nên chỉ dựa vào "trông có vẻ xong"
- [ ] Thiếu chữ "be thorough" trong prompt
- [ ] Context đầy

Giải pháp: đưa lệnh test/typecheck, và yêu cầu **bằng chứng** (lệnh đã chạy và output).
:::

:::quiz Vì sao vẫn cần nắm vững Angular/RxJS khi đã có Claude Code?
- [ ] Không cần nữa
- [x] Để đánh giá, review và chịu trách nhiệm cho code được đề xuất — và để viết prompt/kiểm chứng đúng chỗ
- [ ] Chỉ để phỏng vấn
- [ ] Vì Claude Code không biết Angular

AI tăng tốc người đã hiểu vấn đề; với người chưa hiểu, nó tăng tốc việc tạo ra lỗi khó phát hiện.
:::

> Nguồn: *Best practices for Claude Code* — code.claude.com/docs/en/best-practices (truy cập 11/11/2026).
