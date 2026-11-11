---
title: CLAUDE.md ngắn gọn, rules theo đường dẫn và skill cho quy trình
summary: Chỉ ghi những gì Claude không tự tìm được từ repo; giữ dưới 200 dòng; .claude/rules cho quy tắc theo thư mục; skill cho quy trình của team.
type: card
level: core
lastReviewed: 2026-11-11
tags: [claude-code, claude-md, skills]
related: [claude-code/consolidate/memory/quy-trinh-task-angular, claude-code/deep-dive/guardrails/mo-rong-claude-code]
---

## Phép thử trước khi ghi một dòng

1. Claude có tìm được điều này bằng cách đọc code không?
2. Claude có thật sự đi tìm không?

Nếu cả hai đều **có** → đừng ghi. Mỗi dòng trong `CLAUDE.md` được nạp vào **mọi** phiên và chiếm một phần sự chú ý của Claude.

## Nên ghi

- Cách kiểm chứng: lệnh test, typecheck, lint chính xác, cách chạy **một** file test.
- Chỗ code dễ gây hiểu lầm: pattern cũ còn khắp nơi nhưng code mới không được chép; thư mục trông như bỏ đi nhưng vẫn dùng.
- Quyết định không nằm trong repo: helper xử lý lỗi team đã chọn, quy trình deploy.
- Bất cứ điều gì bạn đã phải sửa **hai lần**.

```markdown title="CLAUDE.md — ví dụ cho dự án Angular"
# Lệnh
- Cài: npm ci
- Chạy một file test: npx ng test --watch=false --include src/app/features/cases/case-list.spec.ts
- Typecheck: npx tsc --noEmit -p tsconfig.app.json

# Quy ước
- Lỗi HTTP: dùng AppError từ core/http/error.interceptor.ts, không tự parse HttpErrorResponse trong component
- features/legacy-* vẫn chạy nhưng không chép pattern Zone.js/BehaviorSubject của nó cho code mới

# Lưu ý
- E2E cần biến API_BASE_URL, xem .env.example
```

**Không nên** mô tả kiến trúc hay cấu trúc thư mục — Claude tự đọc được.

## Công cụ có sẵn

- `/init` tạo bản đầu từ codebase — việc còn lại chủ yếu là **xoá bớt**. Hướng dẫn khuyến nghị dưới 200 dòng.
- `/doctor` gợi ý cắt những dòng Claude tự suy ra được.
- `/context all` xác nhận file đã được nạp.
- Sở thích cá nhân để trong `CLAUDE.local.md` (thêm vào `.gitignore`).

## Rules theo đường dẫn & skill

```markdown title=".claude/rules/forms.md"
---
paths:
  - "src/app/**/forms/**/*.ts"
---
- Form mới dùng Signal Forms; custom control phải hỗ trợ cả CVA và FormValueControl
```

Quy trình của team (release, xử lý sự cố, chuẩn viết tài liệu API) → **skill** tại `.claude/skills/<tên>/SKILL.md`. Claude chỉ thấy tên và mô tả trong mọi phiên, nội dung đầy đủ chỉ nạp khi cần. Skill có tác dụng phụ (như release) thêm `disable-model-invocation: true` để chỉ chạy khi bạn gõ `/release`.

:::quiz Dòng nào KHÔNG nên có trong `CLAUDE.md`?
- [ ] Lệnh chạy một file test
- [ ] "Không chép pattern trong `features/legacy-*`"
- [x] Mô tả cấu trúc thư mục `src/app` và danh sách component
- [ ] Biến môi trường mà E2E test cần

Claude tự đọc repo và tìm ra cấu trúc nhanh hơn bạn giải thích. Chỉ ghi điều nó không thấy được.
:::

:::quiz Claude cứ bỏ qua một dòng trong `CLAUDE.md`. Theo hướng dẫn, thêm chữ IMPORTANT có giải quyết được không?
- [ ] Có, luôn luôn
- [x] Thường là không — hoặc file đã quá dài khiến dòng đó bị chìm, hoặc đó là quy tắc không có ngoại lệ và cần chuyển thành hook
- [ ] Có, nếu viết IN HOA toàn bộ
- [ ] Chỉ khi effort là `max`

Model hiện tại làm theo câu viết bình thường; nhấn mạnh quá mức còn khiến Claude áp dụng quy tắc quá đà.
:::

:::quiz Quy tắc chỉ áp dụng cho code trong `src/app/**/forms/` nên đặt ở đâu?
- [ ] `CLAUDE.md` gốc
- [x] `.claude/rules/` với `paths:` — chỉ nạp khi Claude làm việc với file khớp đường dẫn
- [ ] Một hook
- [ ] `CLAUDE.local.md`

Giữ `CLAUDE.md` gọn và tiết kiệm context cho những task không liên quan.
:::

> Nguồn: *Best practices for Claude Code* và *Extend Claude Code* — code.claude.com/docs (truy cập 11/11/2026).
