---
title: Claude Code trong monorepo và codebase lớn — CLAUDE.md theo tầng, loại trừ, chặn đọc file sinh ra, sparse worktree
summary: "Với workspace Nx/Angular nhiều app và lib: chọn nơi mở Claude, xếp tầng CLAUDE.md và rules, claudeMdExcludes, chặn đọc dist và code sinh ra, code intelligence, worktree.sparsePaths, --add-dir, skill theo thư mục và plugin nội bộ khi quy ước không còn chia tầng nổi."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, monorepo, nx, large-codebase, memory]
related: [claude-code/consolidate/memory/cau-truc-bo-nho, claude-code/deep-dive/extending/mcp-va-plugin]
---

## TL;DR

- Mở Claude ở **thư mục của package bạn đang làm**, không nhất thiết ở gốc repo.
- CLAUDE.md gốc: chỉ điều đúng cho **mọi** package. Quy ước riêng: CLAUDE.md của package hoặc rule có `paths`.
- Chặn Claude mở `dist/`, code sinh ra, vendor bằng deny `Read(...)`; loại CLAUDE.md của package bạn không bao giờ đụng bằng `claudeMdExcludes`.
- Worktree trong repo khổng lồ: `worktree.sparsePaths` chỉ checkout thư mục cần.

## Ví dụ: Nx workspace

```text
workspace/
├── CLAUDE.md                     # quy ước chung
├── apps/
│   ├── portal/                   # app người dân
│   │   └── CLAUDE.md
│   └── back-office/              # app nội bộ
│       └── CLAUDE.md
├── libs/
│   ├── shared/ui/
│   ├── shared/data-access/
│   └── legacy-reports/           # code cũ, đội khác
├── dist/                         # build output (gitignore)
└── libs/api-client/generated/    # sinh từ OpenAPI, có commit
```

## 1. Mở Claude ở đâu?

| Mở ở | Truy cập file | Nạp gì | Hợp khi |
|---|---|---|---|
| `workspace/` | Mọi file | CLAUDE.md gốc; CLAUDE.md của package nạp **khi** Claude đụng file ở đó | Việc xuyên nhiều package |
| `workspace/apps/portal/` | Chỉ cây thư mục đó, tới khi bạn cấp thêm | CLAUDE.md của portal **và** của mọi thư mục cha lúc khởi động | Làm trong một app |

Lưu ý: `.claude/settings.json` và skill của dự án được đọc từ **thư mục làm việc chính** — settings ở gốc không được "kế thừa" khi bạn mở ở thư mục con. Đặt `.claude/` ở nơi bạn hay mở Claude (hoặc ở cả hai).

## 2. Xếp tầng chỉ dẫn

```md title="workspace/CLAUDE.md"
# Workspace
- Chạy lệnh qua Nx: `npx nx test <project>`, `npx nx build <project>`, `npx nx affected -t test`.
- Không import chéo app ↔ app; lib chỉ import lib cùng tầng hoặc thấp hơn (xem tags trong project.json).
- Code trong libs/api-client/generated/ là sinh tự động — không sửa tay, chạy `npm run gen:api`.
```

```md title="workspace/apps/portal/CLAUDE.md"
# Portal (người dân)
- Mọi text hiển thị qua i18n ($localize), không hard-code.
- WCAG 2.1 AA bắt buộc; kiểm tra bằng `npx nx run portal:a11y`.
```

CLAUDE.md của package hay rule có `paths`?

| Dùng CLAUDE.md của package khi | Dùng `.claude/rules/*.md` có `paths` khi |
|---|---|
| Quy ước gắn với **một thư mục** | Quy ước theo **loại file** rải khắp repo (vd `**/*.spec.ts`, `**/*.store.ts`) |
| Đội sở hữu package tự bảo trì | Muốn quản lý tập trung ở một chỗ |

## 3. Loại trừ CLAUDE.md không liên quan

```json title=".claude/settings.local.json (cá nhân, nhớ gitignore nếu tự tạo)"
{
  "claudeMdExcludes": [
    "**/libs/legacy-reports/**",
    "**/apps/back-office/CLAUDE.md"
  ]
}
```

Danh sách cố định, không phải công tắc theo task — muốn tập trung vào package khác hôm nay thì **mở Claude ở package đó**. Danh sách gộp qua các phạm vi (team đặt mặc định trong project, cá nhân thêm trong local).

## 4. Giảm những gì Claude đọc

Tìm kiếm của Claude đã tôn trọng `.gitignore` (`node_modules/`, `dist/`). Với thứ **có commit** như code sinh ra hay vendor:

```json title=".claude/settings.json"
{
  "permissions": {
    "deny": [
      "Read(./**/dist/**/*)",
      "Read(./**/*.generated.*)",
      "Read(./libs/api-client/generated/**/*)",
      "Read(./**/vendor/**/*)"
    ]
  }
}
```

- Pattern kết thúc bằng `/**/*` chặn **nội dung** nhưng vẫn cho liệt kê thư mục.
- Deny `Read` áp cho công cụ đọc file và các lệnh đọc file Claude Code nhận diện trong Bash (`cat`, `grep`, `find`…); không áp cho tiến trình con tự mở file.
- Pattern tương đối neo ở thư mục làm việc của phiên — mở Claude ở thư mục con thì cân nhắc pattern tuyệt đối.

**Code intelligence plugin** cho TypeScript: Claude tìm định nghĩa/reference qua language server thay vì đọc hàng loạt file — tiết kiệm lớn trong repo nhiều nghìn file.

## 5. Worktree và truy cập liên package

```json title=".claude/settings.json"
{
  "worktree": {
    "sparsePaths": ["apps/portal", "libs/shared", "tools"]
  }
}
```

`claude -w` khi đó chỉ checkout các thư mục liệt kê (cùng file ở gốc) — nhanh và nhẹ hơn nhiều với repo lớn. Danh sách gộp qua các phạm vi.

Cần đọc/sửa package anh em hoặc repo khác trong cùng phiên: `claude --add-dir ../design-system` (hoặc `additionalDirectories` trong settings). Chỉ cấp quyền file — phần lớn cấu hình `.claude/` của thư mục thêm vào không được nạp.

## 6. Skill theo thư mục và plugin nội bộ

- Skill lồng: `apps/portal/.claude/skills/new-page/SKILL.md` — nạp khi làm việc ở portal; giữ description rõ để vẫn dễ được phát hiện.
- Khi số CLAUDE.md theo thư mục tăng tới mức khó bảo trì, hoặc **nhiều repo** cần cùng quy ước: đóng gói quy ước + skill + hook thành **plugin** trong marketplace nội bộ, mọi người cài một lần.

## 7. Thay đổi xuyên package

```text
/plan Đổi kiểu trả về của OrderApi.list() từ Order[] sang Page<Order>.
Trước khi đề xuất: dùng npx nx graph --file=graph.json để liệt kê project phụ thuộc libs/shared/data-access,
rồi tìm mọi call site. Kế hoạch theo từng project, mỗi bước chạy npx nx affected -t test,build.
```

:::senior Góc nhìn senior
Trong monorepo, chi phí của một dòng chỉ dẫn mơ hồ ở CLAUDE.md gốc nhân lên theo **số người × số phiên × số package**. Hãy đối xử với CLAUDE.md gốc như API công khai của workspace: ít, chính xác, có người sở hữu, review qua PR; đẩy chi tiết xuống package nơi đội sở hữu chịu trách nhiệm.
:::

:::quiz Bạn hay làm trong `apps/portal` nhưng mỗi phiên Claude lại nạp quy ước của `libs/legacy-reports` mà bạn không bao giờ đụng. Cách phù hợp?
- [ ] Xoá CLAUDE.md của legacy-reports
- [x] `claudeMdExcludes` trong settings (cá nhân: `.claude/settings.local.json`) với pattern của thư mục đó
- [ ] Deny `Read` toàn bộ repo
- [ ] Viết IN HOA trong CLAUDE.md gốc

Xoá file của đội khác không phải quyết định của bạn; loại trừ chỉ ảnh hưởng phiên của bạn.
:::

:::quiz Thư mục `libs/api-client/generated/` có commit, Claude hay đọc nó làm tốn context. Cách đúng?
- [ ] Thêm vào `.gitignore`
- [x] Deny `Read(./libs/api-client/generated/**/*)` trong `.claude/settings.json`
- [ ] Dùng `--bare`
- [ ] Đổi model

`.gitignore` sẽ làm mất file khỏi repo; deny Read chỉ chặn Claude đọc nội dung.
:::

:::exercise Cấu hình Claude Code cho workspace của bạn
Với repo lớn nhất bạn đang làm: (1) vẽ cây thư mục cấp 2; (2) quyết định CLAUDE.md gốc chứa gì (≤ 15 dòng) và package nào cần CLAUDE.md riêng; (3) viết deny Read cho output build và code sinh ra; (4) nếu repo rất lớn, viết `worktree.sparsePaths` cho task thường gặp; (5) kiểm tra bằng `/context all` khi mở Claude ở gốc và ở một package.
???
Tiêu chí đạt: mở ở package → Memory files có CLAUDE.md gốc và của package, không có của package khác; Claude không mở file trong thư mục đã deny (thử nhờ nó đọc một file generated → bị chặn); `claude -w thu` tạo worktree chỉ có thư mục trong `sparsePaths`. Ghi chú: nếu team chưa dùng Claude Code, bắt đầu bằng `.claude/settings.local.json` cá nhân, chứng minh hiệu quả rồi mới đề xuất commit.
:::

> Nguồn: *Set up Claude Code in a monorepo or large codebase*, *How Claude remembers your project* — code.claude.com/docs/en/large-codebases, /memory (truy cập 12/11/2026).
