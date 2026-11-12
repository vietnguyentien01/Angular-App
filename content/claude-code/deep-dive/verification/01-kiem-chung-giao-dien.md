---
title: Kiểm chứng ở mức hệ thống — /verify, /run-skill-generator, review theo spec, Stop hook và kiểm tra giao diện tự động
summary: "Từ 'test xanh' tới 'tính năng chạy đúng': dạy Claude cách chạy app của bạn bằng /run-skill-generator, để /verify tự chạy trước mỗi commit, kết hợp Playwright hoặc Chrome cho UI, review độc lập theo SPEC.md, Stop hook và /goal làm cổng — thiết kế một chuỗi kiểm chứng nhiều lớp cho dự án Angular."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, verification, testing, e2e, hooks]
related: [claude-code/consolidate/verification/cho-claude-phep-kiem-tra, claude-code/labs/labs/mcp-playwright-kiem-tra-giao-dien]
---

## TL;DR

Một chuỗi kiểm chứng tốt có **nhiều lớp độc lập**, mỗi lớp bắt loại lỗi khác:

| Lớp | Bắt | Công cụ |
|---|---|---|
| Kiểu và biên dịch | Sai type, template lỗi | `ng build`, `tsc --noEmit` |
| Hành vi đơn vị | Logic sai | Unit/component test |
| App chạy thật | Lỗi tích hợp, wiring, cấu hình | `/verify`, `/run` |
| Giao diện | Layout, a11y, luồng người dùng | Playwright MCP, Claude in Chrome |
| Đúng yêu cầu | Làm sai/thiếu so với spec | Subagent review theo SPEC.md |
| Cổng bắt buộc | "Báo xong" khi chưa xong | Stop hook, `/goal`, CI |

## 1. Dạy Claude cách chạy app: `/run-skill-generator`

`/run` và `/verify` tự suy ra cách chạy từ loại dự án, README, `package.json`. Suy luận kém tin cậy khi app cần DB, file env, mock server, nhiều tiến trình. Khi đó:

```text
/run-skill-generator
```

Claude chạy app từ môi trường sạch, ghi lại những gì đã chạy được (lệnh cài, biến env, script khởi động) thành skill riêng của dự án ở `.claude/skills/run-<tên>/`. Commit skill đó → mọi phiên và agent sau dùng cùng công thức.

Ví dụ với app Angular cần mock API:

```text
App cần chạy `npm run mock-api` (json-server cổng 3000) trước `ng serve --proxy-config proxy.conf.json`.
Đăng nhập thử bằng user demo/demo. Ghi lại công thức chạy và kiểm tra trang /orders hiển thị dữ liệu.
```

## 2. `/verify` trước mỗi commit

`/verify` cũng tự ghi công thức vào `.claude/skills/verify/SKILL.md` nếu chưa có. Khi phiên có skill tên `verify` (hoặc `simplify`), hướng dẫn commit có sẵn của Claude Code bảo Claude **chạy nó ngay trước mỗi commit** (trừ thay đổi chỉ ở docs/test) — với điều kiện Claude được phép tự gọi skill đó và bạn không tắt `includeGitInstructions`.

## 3. Kiểm tra giao diện tự động

Chọn công cụ (chi tiết ở *Lab 12* và *Claude in Chrome cho dev frontend*):

```text
Dùng Playwright MCP: mở localhost:4200/register, kiểm tra 5 tiêu chí a11y trong SPEC.md mục 4
(label, aria-describedby cho lỗi, thứ tự tab, focus sau submit lỗi, tương phản).
Bảng: tiêu chí | đạt/không | bằng chứng (snapshot/ảnh).
```

Biến phần lặp lại thành E2E test thật (vd Playwright Test) — Claude viết được — để CI chạy mỗi PR, thay vì nhờ Claude kiểm tra tay mỗi lần.

## 4. Review độc lập theo spec

```text
Dùng một subagent mới (không có hội thoại này) review diff so với SPEC.md:
với mỗi tiêu chí chấp nhận → đạt/không/không rõ, bằng chứng file:dòng hoặc test nào chứng minh.
Không sửa file. Tối đa 20 dòng.
```

Reviewer "chưa thấy cách code được viết" không bị thuyết phục bởi lời giải thích trong hội thoại — đó là giá trị của nó.

## 5. Cổng bắt buộc

- **Stop hook** (Lab 06): không cho kết thúc lượt khi test đỏ.
- **`/goal`** với điều kiện đo được: làm tới khi đạt.
- **CI + branch protection**: lớp cuối không phụ thuộc vào máy hay phiên nào.

## Thiết kế mẫu cho dự án Angular

```text
Mỗi thay đổi:
  Claude: test-first → sửa → ng build + npm test (Stop hook bắt buộc)
  Claude: /verify (skill ghi sẵn) trước commit
  Claude: Playwright kiểm tra tiêu chí UI trong SPEC.md (nếu có UI)
  Subagent: review theo SPEC.md
  Bạn: /diff, đọc bảng kết quả, quyết định
PR:
  CI: lint, unit, build, E2E; Code Review/Actions review
  Người review: thiết kế, rủi ro nghiệp vụ → merge
```

:::senior Góc nhìn senior
Kiểm chứng tốn thời gian; thiếu kiểm chứng tốn nhiều hơn — nhưng ở dạng hoá đơn đến sau (bug production, review kéo dài, mất niềm tin vào AI). Cân đối bằng cách tự động hoá lớp rẻ (build, test, hook) và giữ con người cho lớp đắt (đúng yêu cầu, rủi ro). Mỗi lần một lỗi lọt qua, hỏi: lớp nào lẽ ra phải bắt — rồi bổ sung lớp đó.
:::

:::quiz `/verify` đoán sai cách chạy app vì app cần mock server và file env. Cách bền vững?
- [ ] Mỗi lần giải thích lại trong prompt
- [x] Chạy `/run-skill-generator` để ghi công thức chạy thành skill của dự án và commit
- [ ] Tắt `/verify`
- [ ] Dùng `--bare`

Công thức ghi lại được dùng chung cho mọi phiên và agent.
:::

:::quiz Vì sao reviewer theo spec nên là subagent **mới** thay vì hỏi tiếp trong hội thoại chính?
- [ ] Subagent luôn dùng model mạnh hơn
- [x] Nó chưa thấy quá trình viết code và lời giải thích, nên đánh giá dựa trên spec và code — độc lập hơn
- [ ] Hội thoại chính không đọc được SPEC.md
- [ ] Subagent rẻ hơn tuyệt đối

Đó là lý do tài liệu khuyên dùng reviewer "fresh context".
:::

:::exercise Dựng chuỗi kiểm chứng cho cc-lab
(1) `/run-skill-generator` cho cc-lab và commit skill sinh ra; (2) viết SPEC.md ngắn cho một tính năng nhỏ (3 tiêu chí, có 1 tiêu chí UI); (3) làm tính năng với Stop hook đang bật; (4) chạy Playwright kiểm tra tiêu chí UI; (5) subagent review theo SPEC.md. Ghi lại lớp nào đã bắt được vấn đề.
???
Tính năng gợi ý: "Nút Xoá task đã xong" — tiêu chí: (a) chỉ xoá task `done`; (b) `total` cập nhật; (c) nút có tên truy cập được và bị vô hiệu khi không có task xong. Thường thấy: Stop hook bắt test đỏ ở (b); Playwright/snapshot bắt (c) khi nút chỉ có icon không có `aria-label`; subagent review phát hiện thiếu test cho trạng thái vô hiệu. Ghi lại để thấy giá trị của từng lớp.
:::

> Nguồn: *Extend Claude with skills* — "Run and verify your app", "Run your checks before each commit"; *Best practices* — "Give Claude a check to run", "Review against your spec"; *Automate actions with hooks* — code.claude.com/docs (truy cập 12/11/2026).
