---
title: Bản đồ mở rộng cho người mới — CLAUDE.md, skill, subagent, hook, MCP, plugin là gì và khi nào cần
summary: "Sáu cách mở rộng Claude Code giải thích bằng ví dụ đời thường và ví dụ Angular: cái nào luôn nạp, cái nào nạp khi cần, cái nào chạy tự động, cái nào kết nối ra ngoài — và quy tắc 'chỉ thêm khi có tín hiệu' để người mới không cấu hình thừa ngay từ ngày đầu."
type: lesson
level: core
lastReviewed: 2026-11-12
tags: [claude-code, beginner, extending, skills, hooks, mcp]
related: [claude-code/deep-dive/guardrails/mo-rong-claude-code, claude-code/consolidate/extending/skill-va-plugin-co-san]
---

## TL;DR

Ngày đầu **không cần** cấu hình gì ngoài một `CLAUDE.md` ngắn. Thêm từng thứ khi gặp đúng tín hiệu.

## Sáu thứ, một câu mỗi thứ

| Thứ | Ví von | Một câu | Ví dụ Angular |
|---|---|---|---|
| **CLAUDE.md** | Sổ tay nội quy dán trên bàn | Chỉ dẫn được nạp **mỗi phiên** | "Test: `npm test -- --watch=false`. State dùng signal." |
| **Skill** | Quy trình in sẵn trong ngăn kéo | Hướng dẫn/kiến thức **chỉ nạp khi cần** hoặc khi gọi `/ten` | `/new-component` tạo component theo chuẩn team |
| **Subagent** | Đồng nghiệp làm việc phụ ở phòng bên | Worker có **context riêng**, trả về tóm tắt | Reviewer chỉ đọc soát diff trước PR |
| **Hook** | Cảm biến tự động | Lệnh **luôn chạy** ở một sự kiện, không phụ thuộc Claude nhớ | Chạy Prettier sau mỗi lần sửa file |
| **MCP server** | Cổng kết nối hệ thống ngoài | Cho Claude **công cụ** của dịch vụ khác | Đọc ticket Jira, điều khiển trình duyệt |
| **Plugin** | Hộp đồ nghề đóng gói | **Gói** gồm skill + agent + hook + MCP, cài một lệnh | Bộ "chuẩn Angular của công ty" cho mọi repo |

## Khi nào thêm cái gì?

| Tín hiệu | Thêm |
|---|---|
| Claude sai cùng một quy ước **lần thứ hai** | Một dòng trong **CLAUDE.md** |
| Bạn gõ cùng một prompt mở đầu task lần thứ ba | **Skill** gọi bằng `/ten` |
| Việc phụ làm ngập hội thoại bằng kết quả tìm kiếm | **Subagent** |
| Việc gì phải xảy ra **mọi lần**, không ngoại lệ | **Hook** |
| Bạn cứ copy dữ liệu từ một tab trình duyệt vào chat | **MCP server** (hoặc CLI nếu hệ thống có) |
| Repo thứ hai cần cùng bộ cấu hình | **Plugin** |

## Luôn nạp, nạp khi cần, chạy tự động

```text
Luôn có trong context mỗi phiên: CLAUDE.md, auto memory, mô tả của skill, tên công cụ MCP
Nạp khi cần:                     nội dung skill, định nghĩa đầy đủ công cụ MCP, rule có paths
Ngoài context chính:            subagent (context riêng), hook (chạy ngoài model)
```

Hệ quả: CLAUDE.md dài và cài nhiều plugin/MCP **tốn context ở mọi phiên**; skill và subagent thì rẻ cho tới khi dùng.

## Mềm hay cứng?

- **Mềm** (Claude nên làm theo, có thể quên): CLAUDE.md, skill, output style.
- **Cứng** (luôn xảy ra): hook, permission rule, sandbox.

Quy tắc không có ngoại lệ (không sửa file prod, test phải xanh) → cơ chế **cứng**.

## Tiếp theo nên học

- Dùng ngay các skill và plugin **có sẵn** → bài *Skill và plugin có sẵn nên dùng ngay*.
- Tự viết → *Viết skill*, *Subagent*, *Hook thực chiến*, *MCP server và plugin*; thực hành ở Lab 06–08, 12.

:::quiz Bạn muốn **mọi lần** Claude sửa file `.ts` đều chạy ESLint, không phụ thuộc Claude có nhớ không. Dùng gì?
- [ ] Một dòng trong CLAUDE.md
- [ ] Một skill
- [x] Một hook (PostToolUse)
- [ ] Một subagent

"Mọi lần, không ngoại lệ" là tín hiệu của hook.
:::

:::quiz Ngày đầu tiên dùng Claude Code trong dự án mới, nên cấu hình gì?
- [ ] Cài 10 plugin phổ biến và 5 MCP server
- [x] Một CLAUDE.md ngắn (lệnh build/test, vài quy ước khác mặc định); thêm thứ khác khi gặp tín hiệu
- [ ] Viết 20 hook
- [ ] Không gì cả và không bao giờ cấu hình

Cấu hình thừa tốn context và khó bảo trì.
:::

:::exercise Phân loại 8 nhu cầu
Xếp mỗi nhu cầu vào CLAUDE.md / skill / subagent / hook / MCP / plugin: (1) luôn dùng pnpm; (2) quy trình release 7 bước; (3) chặn sửa `environment.prod.ts`; (4) đọc thiết kế trên Figma; (5) tìm mọi chỗ dùng API cũ trong repo 3.000 file; (6) chia sẻ toàn bộ cấu hình cho 5 repo của team; (7) thông báo khi Claude cần duyệt quyền; (8) kiến thức nghiệp vụ "hồ sơ quá hạn" chỉ cần khi sửa module hồ sơ.
???
(1) CLAUDE.md. (2) Skill `/release` với `disable-model-invocation: true`. (3) Hook PreToolUse (hoặc deny `Edit(...)`). (4) MCP server của Figma. (5) Subagent (Explore). (6) Plugin trong marketplace nội bộ. (7) Hook Notification trong settings cá nhân. (8) Skill kiến thức (`user-invocable: false`) hoặc rule `.claude/rules/` có `paths` trỏ vào module hồ sơ.
:::

> Nguồn: *Extend Claude Code* — code.claude.com/docs/en/features-overview; *Best practices* — bảng chỉ dẫn mềm/bắt buộc (truy cập 12/11/2026).
