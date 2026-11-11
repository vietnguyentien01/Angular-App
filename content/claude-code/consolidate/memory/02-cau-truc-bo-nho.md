---
title: Bộ nhớ của Claude Code — các file CLAUDE.md, import, rules và auto memory
summary: Claude nhớ dự án qua hai hệ thống — CLAUDE.md do bạn viết và auto memory do Claude tự ghi. Bài này chỉ vị trí và phạm vi từng file, cách import bằng @, .claude/rules có paths, AGENTS.md, cách kiểm tra file nào đã nạp, và cái gì còn lại sau khi compact.
type: lesson
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, memory, claude-md, rules, auto-memory]
related: [claude-code/review/memory/claude-md-ngan-gon, claude-code/consolidate/sessions/context-window-va-checkpoint]
---

## TL;DR

| | CLAUDE.md | Auto memory |
|---|---|---|
| Ai viết | Bạn | Claude |
| Chứa | Chỉ dẫn, quy tắc | Điều học được, sở thích, các lần bạn sửa Claude |
| Phạm vi | Tổ chức, cá nhân, dự án | Theo repo (chung cho mọi worktree), chỉ trên máy này |
| Nạp | Mỗi phiên (toàn bộ file) | Mỗi phiên — 200 dòng hoặc 25KB đầu của `MEMORY.md` |

Cả hai là **context**, không phải cấu hình bắt buộc. Muốn chặn chắc chắn → hook hoặc permission rule.

## Các vị trí CLAUDE.md

| Phạm vi | Vị trí | Dùng cho | Chia sẻ |
|---|---|---|---|
| Tổ chức (managed) | `/etc/claude-code/CLAUDE.md` (Linux/WSL), `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS), `C:\Program Files\ClaudeCode\CLAUDE.md` (Windows) | Chuẩn code của công ty | Mọi người trên máy được triển khai |
| Cá nhân | `~/.claude/CLAUDE.md` | Sở thích riêng cho mọi dự án | Chỉ bạn |
| Dự án | `./CLAUDE.md` hoặc `./.claude/CLAUDE.md` | Lệnh build/test, quy ước, kiến trúc | Cả team (commit) |
| Cục bộ | `./CLAUDE.local.md` | URL sandbox của bạn, dữ liệu test riêng — **thêm vào .gitignore** | Chỉ bạn, dự án này |

- File ở thư mục **cha** của thư mục làm việc được nạp lúc khởi động; file trong **thư mục con** nạp khi Claude làm việc với file ở đó.
- Nạp từ rộng tới hẹp, nên chỉ dẫn dự án đứng **sau** chỉ dẫn cá nhân trong context.
- Repo chỉ có `AGENTS.md` (dùng chung với công cụ AI khác) thì Claude Code cũng đọc được.

## Viết chỉ dẫn hiệu quả

- **Cụ thể, kiểm chứng được**: "Dùng 2 space" thay vì "format cho đẹp"; "Chạy `npm test` trước khi commit" thay vì "nhớ test".
- **Dưới 200 dòng mỗi file** — dài hơn tốn context và giảm mức tuân thủ.
- **Có cấu trúc**: heading + bullet.
- **Không mâu thuẫn**: hai chỉ dẫn trái nhau → Claude có thể chọn tuỳ ý. `/doctor prompt-audit` giúp tìm chỉ dẫn lỗi thời, mâu thuẫn, trỏ tới file không tồn tại.

Khi nào thêm một dòng? Khi Claude **mắc cùng lỗi lần thứ hai**, khi review bắt được điều Claude lẽ ra phải biết, khi bạn gõ lại cùng một lời nhắc như phiên trước.

## Import file khác bằng `@`

```md title="CLAUDE.md"
Xem @README.md để biết tổng quan và @package.json cho các script npm.

# Quy trình git
- @docs/git-workflow.md
```

- Đường dẫn tương đối tính từ **file chứa import**; import lồng tối đa **4 cấp**.
- Muốn nhắc tên file mà không import: bọc trong backtick `` `@README` ``.
- Đường dẫn có dấu cách: thêm `\` trước mỗi dấu cách.

## `.claude/rules/` — chia nhỏ và giới hạn theo đường dẫn

```text
.claude/
├── CLAUDE.md
└── rules/
    ├── testing.md        # không có paths → nạp mỗi phiên
    └── angular-forms.md  # có paths → chỉ nạp khi đụng file khớp
```

```md title=".claude/rules/angular-forms.md"
---
paths:
  - "src/app/**/*.form.ts"
  - "src/app/**/forms/**"
---
# Forms
- Form mới dùng Signal Forms (`@angular/forms/signals`), không dùng template-driven.
- Validator dùng chung đặt ở `src/app/shared/validators/`.
```

Rule có `paths` nạp khi Claude đọc/sửa file khớp. Quy trình nhiều bước hoặc chỉ dùng thỉnh thoảng → **skill** (chỉ nạp khi gọi), không phải rule.

## Auto memory

- Claude tự ghi bốn loại: `user` (vai trò, sở thích), `feedback` (lần bạn sửa/xác nhận cách làm), `project` (việc đang làm, quyết định không suy ra được từ code), `reference` (thông tin ở ngoài repo như issue tracker).
- Không ghi những gì suy ra được từ code hoặc đã có trong `CLAUDE.md`.
- Lưu tại `~/.claude/projects/<project>/memory/` — `MEMORY.md` là mục lục, mỗi ghi nhớ một file. **Chỉ trên máy này**, không đồng bộ sang máy khác hay cloud.
- Thấy "Saved 2 memories" / "Recalled 2 memories" là Claude đang ghi/đọc.
- Bật/tắt và xem bằng `/memory`; tắt cho một dự án: `"autoMemoryEnabled": false` trong settings của dự án.

:::tip "Nhớ giúp mình…" đi đâu?
Nói *"nhớ là dùng pnpm, không dùng npm"* → Claude ghi vào **auto memory**. Muốn ghi vào `CLAUDE.md` (để cả team thấy) thì nói rõ: *"thêm điều này vào CLAUDE.md"*.
:::

## Kiểm tra và xử lý sự cố

| Triệu chứng | Làm gì |
|---|---|
| Không chắc CLAUDE.md có nạp | `/context all` → mục **Memory files** |
| Claude không theo CLAUDE.md | File quá dài? Chỉ dẫn mơ hồ? Mâu thuẫn? Chỉ dẫn bắt buộc → chuyển sang hook |
| Chỉ dẫn "mất" sau `/compact` | CLAUDE.md ở gốc dự án và rule không có `paths` được nạp lại từ đĩa; rule có `paths` và CLAUDE.md thư mục con chỉ nạp lại khi đụng file khớp; dặn dò trong hội thoại có thể mất → đưa vào CLAUDE.md |
| Không biết auto memory đã ghi gì | `/memory`, mở file — chúng là markdown, sửa/xoá thoải mái |

:::senior Góc nhìn senior
Đối xử với CLAUDE.md như code: review trong PR, xoá dòng lỗi thời, giữ ngắn. Một dòng chỉ dẫn mơ hồ ở file chung ảnh hưởng mọi phiên của mọi người trong team — chi phí của nó nhân lên theo số người dùng.
:::

:::quiz Bạn muốn ghi URL môi trường sandbox **của riêng bạn** cho dự án, không để team thấy. File nào?
- [ ] `./CLAUDE.md`
- [x] `./CLAUDE.local.md` (và thêm vào `.gitignore`)
- [ ] `/etc/claude-code/CLAUDE.md`
- [ ] `.claude/rules/sandbox.md`

`CLAUDE.local.md` là chỉ dẫn cá nhân cho một dự án.
:::

:::quiz Quy tắc về form chỉ cần khi Claude sửa file form. Cách tiết kiệm context nhất?
- [ ] Thêm vào CLAUDE.md gốc
- [x] `.claude/rules/angular-forms.md` với `paths` khớp file form
- [ ] Viết IN HOA trong CLAUDE.md
- [ ] Đặt vào auto memory

Rule có `paths` chỉ nạp khi Claude làm việc với file khớp.
:::

:::quiz Auto memory của bạn trên laptop có tự xuất hiện trong cloud session không?
- [ ] Có, đồng bộ qua tài khoản
- [x] Không — auto memory chỉ nằm trên máy này
- [ ] Có, nếu dùng cùng repo
- [ ] Chỉ phần `feedback`

Điều cần có ở mọi nơi thì ghi vào `CLAUDE.md` và commit.
:::

:::interview Phân biệt CLAUDE.md, rules, skill, auto memory trong một câu mỗi loại?
CLAUDE.md: sự thật luôn đúng mà Claude cần ở mọi phiên (lệnh, quy ước). Rules: chỉ dẫn chia theo chủ đề, có thể giới hạn theo đường dẫn file. Skill: quy trình/kiến thức chỉ nạp khi được gọi hoặc khi liên quan. Auto memory: ghi chú Claude tự rút ra về bạn và dự án, chỉ trên máy này.
:::

:::exercise Rút gọn CLAUDE.md của dự án bạn
Mở `CLAUDE.md` hiện tại (hoặc tạo bằng `/init`). Với mỗi dòng, hỏi: "Xoá dòng này Claude có làm sai không?" Chuyển phần chỉ liên quan một thư mục sang `.claude/rules/` có `paths`, quy trình nhiều bước sang skill.
???
Thường xoá được: mô tả cấu trúc thư mục (Claude tự đọc), quy ước chung của ngôn ngữ, lời khuyên chung chung ("viết code sạch"). Giữ lại: lệnh build/test/lint chính xác, quy ước riêng của team khác mặc định, "gotcha" (vd "test e2e cần chạy `npm run mock-api` trước"). Kiểm tra lại bằng `/context all` và chạy một task thử.
:::

> Nguồn: *How Claude remembers your project* — code.claude.com/docs/en/memory; *Explore the context window* — mục "What survives compaction" (truy cập 11/11/2026).
