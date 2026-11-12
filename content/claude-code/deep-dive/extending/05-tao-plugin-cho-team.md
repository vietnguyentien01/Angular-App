---
title: Tạo plugin cho team — đóng gói skill, subagent, hook thành một gói và phát hành qua marketplace nội bộ
summary: "Khi repo thứ hai cần cùng cấu hình: dựng plugin team-angular-kit gồm skill, subagent reviewer và hook format, validate bằng claude plugin validate, chạy thử với --plugin-dir, tạo marketplace nội bộ, cài bằng một lệnh, chuyển cấu hình .claude/ có sẵn vào plugin — mọi file mẫu đã được validate thật."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, plugins, marketplace, team]
related: [claude-code/deep-dive/extending/mcp-va-plugin, claude-code/deep-dive/memory/monorepo-va-codebase-lon]
---

## TL;DR

- Plugin = thư mục có `.claude-plugin/plugin.json` + các thành phần ở **thư mục cố định**: `skills/`, `agents/`, `hooks/hooks.json`, `.mcp.json`.
- Skill/agent của plugin có **tiền tố tên plugin**: `/team-angular-kit:new-feature` — hai plugin cùng có skill `hello` không xung đột.
- Vòng phát triển: viết → `claude plugin validate` → `claude --plugin-dir ./plugin` → marketplace → `claude plugin install`.

## Khi nào cần plugin?

Skill, agent, hook, MCP chạy tốt **không cần** plugin khi chỉ phục vụ một dự án hoặc chỉ bạn. Làm plugin khi muốn **chia sẻ** cho đồng đội, cài ở **nhiều repo**, hoặc phát hành **có phiên bản**.

## Cấu trúc

```text
team-angular-kit/
├── .claude-plugin/
│   └── plugin.json            # CHỈ manifest nằm ở đây
├── skills/
│   └── new-feature/
│       └── SKILL.md
├── agents/
│   └── angular-reviewer.md
├── hooks/
│   └── hooks.json
├── README.md                  # nên có
└── LICENSE                    # nên có (bắt buộc nếu gửi vào thư mục của Anthropic)
```

:::warning Đặt sai chỗ là không nạp
Chỉ `plugin.json` nằm trong `.claude-plugin/`. Skill, agent, hook đặt trong `.claude-plugin/` sẽ **không** được nạp.
:::

## Các file (đã validate)

```json title="team-angular-kit/.claude-plugin/plugin.json"
{
  "name": "team-angular-kit",
  "description": "Quy ước Angular của team: skill tạo feature, subagent reviewer, hook format",
  "version": "1.0.0",
  "author": { "name": "Frontend Team" }
}
```

`name` bắt buộc, không có dấu cách, trở thành tiền tố. Có `version` → người dùng ở lại phiên bản đó tới khi bạn tăng số.

```md title="team-angular-kit/skills/new-feature/SKILL.md"
---
description: Scaffold a lazy-loaded Angular feature following team conventions. Use when the user asks to create a new feature or page.
argument-hint: <feature-name>
disable-model-invocation: true
---
Tạo feature $ARGUMENTS theo quy ước của team:
1. `src/app/features/$ARGUMENTS/` gồm page component, facade, data-access service.
2. Route lazy `loadComponent` trong `app.routes.ts`.
3. Test cho trạng thái loading/empty/error.
4. Chạy `npm test -- --watch=false` và báo kết quả.
```

```md title="team-angular-kit/agents/angular-reviewer.md"
---
name: angular-reviewer
description: Reviews Angular changes against team conventions and accessibility. Use after code changes in src/app.
tools: Read, Glob, Grep, Bash
model: sonnet
---
Review `git diff main...HEAD`. Checklist: control flow @if/@for; signal state; cleanup of subscriptions/intervals; accessible names for inputs and buttons.
Report only real problems as `file:line — problem — fix`. Do not edit files.
```

```json title="team-angular-kit/hooks/hooks.json"
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "f=$(jq -r '.tool_input.file_path // empty'); case \"$f\" in *.ts|*.html|*.css|*.scss|*.json) npx prettier --write \"$f\";; esac" }
        ]
      }
    ]
  }
}
```

`hooks.json` có khoá `"hooks"` ở trên cùng, cùng dạng với khoá `hooks` trong file settings.

## Validate và chạy thử

```bash
claude plugin validate ./team-angular-kit      # → "Validation passed"
claude --plugin-dir ./team-angular-kit         # nạp cho phiên này, không cài
```

Trong phiên:

```text
/team-angular-kit:new-feature reports
```

Thiếu `README.md`/`LICENSE`: validate vẫn pass nhưng liệt kê là vấn đề nếu bạn định gửi vào thư mục plugin của Anthropic. Khung nhanh: `claude plugin init team-angular-kit --with skills agents hooks`. Muốn Claude giúp viết plugin lớn: cài plugin `plugin-dev` từ marketplace chính thức.

## Marketplace nội bộ

```json title="acme-frontend/.claude-plugin/marketplace.json"
{
  "name": "acme-frontend",
  "description": "Plugin nội bộ của team frontend",
  "owner": { "name": "Frontend Team" },
  "plugins": [
    {
      "name": "team-angular-kit",
      "source": "./plugins/team-angular-kit",
      "description": "Quy ước Angular của team"
    }
  ]
}
```

```bash
claude plugin validate ./acme-frontend
claude plugin marketplace add ./acme-frontend         # thử cục bộ
claude plugin install team-angular-kit@acme-frontend
```

Đưa thư mục `acme-frontend/` lên một repo git (có thể private). Đồng đội:

```text
/plugin marketplace add your-org/acme-frontend
/plugin install team-angular-kit@acme-frontend
```

Admin có thể yêu cầu marketplace này trên mọi máy qua managed settings. Phát hành bản mới: sửa, tăng `version`, push — người dùng nhận qua cập nhật marketplace.

## Chuyển cấu hình `.claude/` có sẵn thành plugin

```bash
mkdir -p my-plugin/.claude-plugin
# tạo my-plugin/.claude-plugin/plugin.json
cp -r .claude/skills my-plugin/
cp -r .claude/agents my-plugin/
# hooks: chép khối "hooks" từ .claude/settings.json sang my-plugin/hooks/hooks.json
```

Sau khi chuyển: tên lệnh đổi thành `/my-plugin:ten`; gỡ bản standalone để không bị trùng.

:::senior Góc nhìn senior
Plugin nội bộ là **sản phẩm**: có người sở hữu, changelog, phiên bản, README nói rõ nó thêm gì vào context. Giữ plugin **nhỏ và đúng mục đích** — một plugin "mọi thứ của công ty" sẽ đắt context cho mọi người ở mọi phiên. Tách theo nhu cầu: chuẩn Angular, bảo mật, quy trình release.
:::

:::quiz Bạn đặt `SKILL.md` vào `team-angular-kit/.claude-plugin/skills/new-feature/` nhưng skill không xuất hiện. Vì sao?
- [ ] Phải chạy `/reload-skills`
- [x] Chỉ `plugin.json` nằm trong `.claude-plugin/`; `skills/` phải ở ngay dưới thư mục gốc của plugin
- [ ] Skill trong plugin phải viết bằng JSON
- [ ] Phải có `version`

Thành phần đặt trong `.claude-plugin/` không được nạp.
:::

:::quiz Đồng nghiệp gõ `/new-feature` nhưng không thấy; skill nằm trong plugin `team-angular-kit`. Tên đúng là gì?
- [ ] `/new-feature` — phải cài lại
- [x] `/team-angular-kit:new-feature` (menu `/` cũng khớp theo tên ngắn khi gõ)
- [ ] `/plugin new-feature`
- [ ] `/skills new-feature`

Skill của plugin có tiền tố tên plugin.
:::

:::exercise Đóng gói cấu hình của Lab 06–08
Chuyển hook (Lab 06), skill `/new-filter` (Lab 07) và subagent `angular-reviewer` (Lab 08) của cc-lab thành plugin `cc-lab-kit`. Validate, chạy với `--plugin-dir`, tạo marketplace cục bộ, cài vào một repo Angular **khác** và chứng minh cả ba thành phần hoạt động.
???
Các bước: tạo `cc-lab-kit/.claude-plugin/plugin.json`; `cp -r .claude/skills cc-lab-kit/`, `cp -r .claude/agents cc-lab-kit/`; tạo `cc-lab-kit/hooks/hooks.json` từ khối `hooks` của `.claude/settings.json` (đổi đường dẫn script sang `${CLAUDE_PLUGIN_ROOT}/hooks/...` nếu hook gọi script nằm trong plugin, và chép script vào plugin). `claude plugin validate ./cc-lab-kit`. Marketplace như mẫu. Ở repo khác: `/cc-lab-kit:new-filter …` chạy, `@"cc-lab-kit:angular-reviewer (agent)"` gọi được, sửa file `.ts` thấy Prettier chạy. Gỡ bản standalone trong cc-lab để tránh trùng.
:::

> Nguồn: *Create a Claude Code plugin*, *Create a marketplace*, *Plugin commands reference* — code.claude.com/docs/en/plugins/create, /plugins/create-marketplace, /plugins/cli-reference (truy cập 12/11/2026). Plugin và marketplace mẫu đã chạy `claude plugin validate` (Claude Code 2.1.322): passed.
