---
title: Phiên làm việc đầu tiên — hỏi về dự án, sửa code đầu tiên, dùng git
summary: Đi từng bước như quickstart chính thức trên một dự án Angular thật — hỏi Claude về codebase, cho nó sửa một thay đổi nhỏ và duyệt, làm git bằng lời, tạo CLAUDE.md bằng /init — kèm bảng lệnh tối thiểu phải nhớ.
type: lesson
level: core
lastReviewed: 2026-11-11
tags: [claude-code, beginner, quickstart, git]
related: [claude-code/review/interface/phim-tat-va-cu-phap, claude-code/review/guardrails/che-do-quyen]
---

## TL;DR

1. `cd` vào dự án → `claude`.
2. **Hỏi trước, sửa sau**: để Claude đọc và giải thích dự án.
3. Giao một thay đổi **nhỏ** → xem diff → duyệt.
4. Làm git bằng lời: xem thay đổi, commit với message mô tả rõ.
5. `/init` để có `CLAUDE.md` khởi đầu, rồi tự rút gọn.

## Bước 1 — Mở phiên trong đúng thư mục

```bash
cd ~/projects/my-angular-app
claude
```

Phía trên ô nhập hiển thị phiên bản, model hiện tại và thư mục làm việc. Lần đầu mở một thư mục, Claude Code hỏi bạn có **tin tưởng thư mục này** không (workspace trust) — chỉ đồng ý với repo bạn biết rõ nguồn gốc, vì file cấu hình trong repo có thể chạy hook và MCP server.

## Bước 2 — Hỏi về dự án

Không cần dán code — Claude tự đọc file khi cần:

```text
what does this project do?
```

```text
Dự án này dùng những công nghệ gì? Entry point ở đâu? Giải thích cấu trúc thư mục src/app.
```

```text
Luồng đăng nhập chạy qua những file nào? Interceptor nào gắn token?
```

Hỏi cả về chính Claude Code: *"what can Claude Code do?"*, *"how do I create custom skills in Claude Code?"* — nó trả lời được dựa trên tài liệu.

:::tip Mẹo cho người mới
Với codebase lạ, đi từ tổng quan xuống chi tiết: kiến trúc → domain chính → một luồng cụ thể → thuật ngữ riêng của dự án. Học kỹ ở bài *Hiểu một codebase mới*.
:::

## Bước 3 — Sửa code lần đầu

Chọn một việc nhỏ, dễ kiểm tra:

```text
Thêm validator bắt buộc và minLength(8) cho ô password trong RegisterComponent, hiện thông báo lỗi dưới ô nhập. Chạy unit test của component sau khi sửa.
```

Claude tìm file phù hợp, cho xem thay đổi. Nếu nó hỏi trước khi sửa, chọn **Yes** để duyệt. Chế độ hỏi/không hỏi do **permission mode** quyết định — nhấn `Shift+Tab` để đổi (xem bài *Permission mode*).

:::warning Đọc diff trước khi chấp nhận
Người mới hay bấm "Yes" liên tục. Tối thiểu hãy đọc lướt diff của từng file, đặc biệt khi Claude sửa file bạn không nhắc tới. `/diff` cho xem toàn bộ thay đổi trong working tree.
:::

## Bước 4 — Git bằng lời

```text
what files have I changed?
```

```text
commit my changes with a descriptive message
```

```text
Tạo nhánh feature/password-rules, rồi cho mình xem 5 commit gần nhất.
```

```text
help me resolve merge conflicts
```

## Bước 5 — Bug và feature bằng ngôn ngữ tự nhiên

```text
Có bug: user submit được form rỗng ở trang Contact — sửa giúp và thêm test chứng minh.
```

Nói như với một đồng nghiệp. Lần đầu chưa đúng thì **tiếp tục trao đổi** ("chưa đúng, vấn đề nằm ở session handling") — không cần bắt đầu lại.

## Bước 6 — Tạo CLAUDE.md

```text
/init
```

Claude phân tích codebase và tạo `CLAUDE.md` với lệnh build/test và quy ước nó tìm được. Đã có `CLAUDE.md` thì `/init` gợi ý cải thiện. Sau đó **tự đọc và xoá bớt** những gì Claude tự suy ra được từ code (xem bài *CLAUDE.md ngắn gọn*).

## Lệnh tối thiểu phải nhớ

| Ở shell | Tác dụng |
|---|---|
| `claude` | Mở phiên tương tác |
| `claude "fix the build error"` | Mở phiên với prompt đầu tiên |
| `claude -p "explain this function"` | Hỏi một lần, in kết quả rồi thoát |
| `claude -c` | Tiếp tục hội thoại gần nhất trong thư mục này |
| `claude -r` | Chọn một hội thoại cũ để resume |

| Trong phiên | Tác dụng |
|---|---|
| `/help` | Xem các lệnh |
| `/` | Mở danh sách lệnh và skill (gõ tiếp để lọc) |
| `/clear` | Hội thoại mới, context trống (quay lại bằng `/resume`) |
| `/exit` hoặc `Ctrl+D` hai lần | Thoát |
| `↑` / `Tab` | Lịch sử lệnh / hoàn thành lệnh |
| `Shift+Tab` | Đổi permission mode |

:::quiz Bạn muốn Claude giải thích một hàm rồi thoát ngay, không mở phiên tương tác. Lệnh nào?
- [ ] `claude -c "explain"`
- [x] `claude -p "explain this function"`
- [ ] `/explain`
- [ ] `claude --init`

`-p` (print) là chế độ không tương tác — nền tảng của script và CI.
:::

:::quiz Lần đầu chạy `claude` trong một repo vừa clone từ nguồn lạ, Claude Code hỏi bạn có tin tưởng thư mục không. Vì sao nên cân nhắc?
- [ ] Vì Claude sẽ xoá repo nếu bạn từ chối
- [x] Vì file cấu hình trong repo (hook, MCP server trong `.mcp.json`…) có thể chạy lệnh trên máy bạn sau khi bạn tin tưởng
- [ ] Vì phải trả thêm phí
- [ ] Không có lý do, cứ đồng ý

Workspace trust là hàng rào trước khi cấu hình của repo được phép chạy.
:::

:::interview Sau phiên đầu tiên, một junior hỏi: "Em có cần viết prompt thật dài, chỉ rõ từng file không?"
Không. Hãy nêu **mục tiêu, bối cảnh và cách kiểm tra** — Claude tự tìm file. Chỉ trỏ file cụ thể khi bạn đã biết chỗ (dùng `@đường/dẫn`). Nếu kết quả lệch, chỉnh tiếp trong hội thoại; sửa hai lần vẫn sai thì `/clear` và viết lại prompt tốt hơn.
:::

:::exercise Phiên đầu tiên có chấm điểm
Trong dự án thật của bạn (hoặc cc-lab), làm đủ 6 bước của bài này trong 30 phút. Chấm bản thân: (a) có đối chiếu ít nhất 2 câu trả lời với code không; (b) đã đọc diff trước khi chấp nhận không; (c) commit message do Claude viết có đúng quy ước team không; (d) `CLAUDE.md` sau `/init` đã được bạn rút gọn chưa.
???
Đạt 4/4 là tốt. Lỗi hay gặp nhất của người mới là (b) — bấm Yes liên tục. Mẹo: ở phiên đầu, dùng Manual mode (`claude --permission-mode default`) để bị buộc phải nhìn từng thao tác; khi đã quen mới chuyển sang auto. Với (c), nếu message chưa đúng quy ước, thêm đúng một dòng vào CLAUDE.md (vd "Commit message theo Conventional Commits, tiếng Anh").
:::

> Nguồn: *Quickstart* — code.claude.com/docs/en/quickstart; *How Claude Code works* — mục "Ask Claude Code for help" (truy cập 11/11/2026).
