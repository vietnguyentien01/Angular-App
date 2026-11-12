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

## Bốn lý do — ví dụ trong dự án Angular

| Lý do | Triệu chứng thật | Sửa đúng chỗ |
|---|---|---|
| Thiếu thông tin không có trong repo | Mỗi phiên Claude lại hỏi "test chạy bằng lệnh gì", hoặc dùng `npm` trong repo dùng `pnpm` | Một dòng trong `CLAUDE.md` |
| Không có cách tự kiểm tra | "Đã sửa lỗi lọc ngày" nhưng chưa ai chạy test; bug còn nguyên | Đưa lệnh `npm test -- --watch=false` vào prompt; Stop hook |
| Quy tắc cần cơ chế bắt buộc | Claude sửa `environment.prod.ts` dù CLAUDE.md đã dặn | Deny `Edit(...)` hoặc hook PreToolUse |
| Cần đổi một mặc định | Phiên nào cũng bị hỏi quyền chạy `ng build` 20 lần | Allow rule `Bash(npx ng build *)`; chọn model/effort hợp việc |

Khi một phiên hỏng, hỏi theo thứ tự: **thiếu thông tin → thiếu phép kiểm tra → thiếu hàng rào → mặc định chưa hợp**. Đa số trường hợp rơi vào hai mục đầu.

## Chu trình làm việc có trách nhiệm

1. **Hiểu** vấn đề đủ để mô tả "xong" là gì (nếu không, nhờ Claude phỏng vấn và giải thích trước).
2. **Giao** việc với bối cảnh, phạm vi, phép kiểm tra.
3. **Kiểm** bằng bằng chứng: output test/build, diff, chạy app.
4. **Hiểu lại**: giải thích được mọi dòng sẽ merge.
5. **Rút kinh nghiệm**: sửa lặp lại → CLAUDE.md; quy trình lặp lại → skill; quy tắc cứng → hook/permission.

:::interview Phỏng vấn Senior: "Team bạn dùng AI coding tool thế nào để không giảm chất lượng?"
Trả lời theo khung: (1) **trách nhiệm** — người merge chịu trách nhiệm, không merge thứ không giải thích được; (2) **kiểm chứng** — mọi thay đổi có phép kiểm tra chạy được (test, build, CI), AI review chỉ là một lớp; (3) **hàng rào** — quy tắc không ngoại lệ nằm ở hook/permission/branch protection chứ không trong prompt; (4) **tri thức chung** — quy ước ghi trong CLAUDE.md và review qua PR; (5) **đo lường** — theo dõi bug lọt, thời gian review, chi phí.
:::

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

:::exercise Chẩn đoán một phiên không như ý
Nhớ lại (hoặc cố ý tạo trong cc-lab) một phiên mà kết quả không như ý — vd giao *"làm cho danh sách task đẹp hơn"*. Xếp nguyên nhân vào bốn nhóm của bài: thiếu bối cảnh, yêu cầu mơ hồ, không có phép kiểm tra, quy tắc cần bắt buộc nhưng chỉ nằm trong lời dặn. Viết lại prompt giải quyết cả bốn.
???
Prompt mơ hồ "đẹp hơn" trượt cả bốn: không biết đẹp theo chuẩn nào, không có ràng buộc, không có cách kiểm. Viết lại: *"Trong TaskList: mỗi task một dòng có padding 8px, task xong gạch ngang và màu xám, badge 'Quá hạn' màu đỏ đạt tương phản AA. Chỉ sửa task-list.ts. Kiểm tra: npm test xanh và chụp màn hình bằng Playwright (Lab 12)."* Quy tắc "không sửa angular.json" thì đưa vào hook (Lab 06) thay vì lời dặn.
:::

> Nguồn: *Best practices for Claude Code* — code.claude.com/docs/en/best-practices (truy cập 11/11/2026).
