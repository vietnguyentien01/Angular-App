---
title: "Lab 06 — Ba hook cho cc-lab: tự format, bảo vệ file cấu hình, không cho dừng khi test đỏ"
summary: "Viết và thử từng hook trên dự án thật: PostToolUse chạy Prettier, PreToolUse chặn sửa angular.json/package-lock.json/.env, Stop hook buộc Claude làm tiếp khi test đỏ (có chống vòng lặp) — kèm cách test hook bằng tay và một hook thông báo cá nhân."
type: lesson
level: advanced
lastReviewed: 2026-11-11
tags: [claude-code, lab, hooks]
related: [claude-code/deep-dive/extending/hooks-thuc-chien, claude-code/consolidate/guardrails/hook-permission-sandbox]
---

## Mục tiêu

Ba quy tắc "không có ngoại lệ" chuyển từ lời dặn thành hook — và bạn tự chứng minh từng cái hoạt động.

**Thời gian:** 50–60 phút · **Cần:** `jq` (`brew install jq` / `apt-get install jq`), Prettier (đã có trong devDependencies của dự án Angular 22 mới).

## Bước 1 — Hook format (PostToolUse)

```json title=".claude/settings.json (thêm khoá hooks, giữ nguyên permissions của Lab 05)"
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write" }
        ]
      }
    ]
  }
}
```

Thử: mở phiên, `/hooks` để thấy hook đã nạp, rồi:

```text
Thêm vào task-filter.ts một hàm isDone(task) dùng chuỗi nháy kép và thụt lề 4 space.
```

Mở file: Prettier đã chuẩn hoá về cấu hình của dự án (Angular CLI mới mặc định dùng nháy đơn). Hook chạy xong không hiện gì trong hội thoại — đó là bình thường.

## Bước 2 — Hook bảo vệ file (PreToolUse)

```bash title=".claude/hooks/protect-files.sh"
#!/bin/bash
# Chặn Claude sửa file nhạy cảm. Đọc JSON của PreToolUse từ stdin.
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
FILE_PATH="${FILE_PATH//\\//}"
PROTECTED=(".env" "package-lock.json" "angular.json" ".git/")
for p in "${PROTECTED[@]}"; do
  if [[ "$FILE_PATH" == *"$p"* ]]; then
    echo "Blocked: $FILE_PATH là file được bảo vệ ($p). Hỏi người dùng nếu thật sự cần sửa." >&2
    exit 2
  fi
done
exit 0
```

```bash
chmod +x .claude/hooks/protect-files.sh
```

**Test bằng tay trước** (không cần Claude):

```bash
echo '{"tool_input":{"file_path":"'$PWD'/angular.json"}}' | .claude/hooks/protect-files.sh; echo "exit=$?"
# → in "Blocked: …" và exit=2
echo '{"tool_input":{"file_path":"'$PWD'/src/app/app.ts"}}' | .claude/hooks/protect-files.sh; echo "exit=$?"
# → exit=0
```

Đăng ký vào `PreToolUse` cùng file settings:

```json
"PreToolUse": [
  {
    "matcher": "Edit|Write",
    "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh" }]
  }
]
```

Thử: *"Tăng budget initial trong angular.json lên 1MB."* → Claude nhận thông báo Blocked và (thường) hỏi lại bạn thay vì sửa.

## Bước 3 — Cổng test (Stop)

```bash title=".claude/hooks/require-green-tests.sh"
#!/bin/bash
# Stop hook: không cho Claude kết thúc khi test còn đỏ.
INPUT=$(cat)
# Nếu Claude đang tiếp tục vì chính hook này, đừng chặn thêm để tránh vòng lặp vô tận.
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi
# Chỉ kiểm tra khi có thay đổi trong src/
if git diff --quiet HEAD -- src; then
  exit 0
fi
if ! OUTPUT=$(npm test -- --watch=false 2>&1); then
  echo "Test đang fail, sửa cho xanh trước khi kết thúc:" >&2
  echo "$OUTPUT" | grep -E "FAIL|×|AssertionError|Expected|Received" | head -20 >&2
  exit 2
fi
exit 0
```

Test bằng tay: làm hỏng một kỳ vọng trong `task-filter.spec.ts` (vd đổi `[3]` thành `[99]`), rồi:

```bash
chmod +x .claude/hooks/require-green-tests.sh
echo '{"stop_hook_active":false}' | .claude/hooks/require-green-tests.sh; echo "exit=$?"   # exit=2 kèm lỗi test
echo '{"stop_hook_active":true}'  | .claude/hooks/require-green-tests.sh; echo "exit=$?"   # exit=0
git checkout src
```

Đăng ký:

```json
"Stop": [
  { "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/require-green-tests.sh" }] }
]
```

Thử: *"Đổi filterTasks để trả về task đã sắp xếp theo dueDate."* — thay đổi này làm test `lọc theo trạng thái`/`từ khoá` có thể vẫn xanh hoặc đỏ tuỳ cách làm; nếu đỏ, bạn sẽ thấy Claude **tự làm tiếp** thay vì báo xong.

## Bước 4 — Hook cá nhân: thông báo khi Claude cần bạn

Đặt trong `~/.claude/settings.json` (của bạn, không phải của team):

```json title="macOS"
{
  "hooks": {
    "Notification": [
      { "hooks": [{ "type": "command", "command": "osascript -e 'display notification \"Claude Code cần bạn\" with title \"Claude Code\"'" }] }
    ]
  }
}
```

Linux: thay lệnh bằng `notify-send 'Claude Code' 'Claude Code cần bạn'`.

## Checklist hoàn thành

- [ ] `/hooks` hiển thị đủ ba hook dự án
- [ ] Đã test bằng tay hai script, thấy đúng exit 0/2
- [ ] Claude bị chặn khi sửa `angular.json`
- [ ] Đã thấy Stop hook buộc Claude làm tiếp khi test đỏ
- [ ] Commit `.claude/settings.json` và `.claude/hooks/*.sh`; hook thông báo nằm ở settings cá nhân

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Sửa |
|---|---|---|
| Hook không chạy | `matcher` viết thường hoặc là mảng | `"Edit\|Write"` một chuỗi |
| `Permission denied` khi chạy script | Thiếu quyền thực thi | `chmod +x` |
| JSON output của hook bị lỗi | `.zshrc`/`.bashrc` in chữ ra stdout | Bỏ lệnh `echo` trong shell profile cho shell không tương tác |
| Stop hook chạy mãi | Không kiểm tra `stop_hook_active` | Thêm đoạn kiểm tra như script mẫu |
| Hook format làm hỏng file không phải code | Prettier chạy cả trên file lạ | Lọc đuôi file trong lệnh trước khi gọi Prettier |

:::quiz Script `protect-files.sh` kết thúc bằng `exit 0` khi file hợp lệ. Lần sửa file đó sẽ thế nào?
- [ ] Được tự duyệt không hỏi
- [x] Đi tiếp qua luồng permission bình thường — exit 0 là 'không quyết định', không phải 'cho phép'
- [ ] Bị chặn
- [ ] Hook chạy lại

Muốn tự duyệt phải trả JSON `permissionDecision: "allow"`.
:::

:::quiz Vì sao hook dùng `"$CLAUDE_PROJECT_DIR"/.claude/hooks/...` thay vì đường dẫn tương đối?
- [ ] Cho đẹp
- [x] Để hook tìm đúng script dù Claude đang ở thư mục con hay đã `cd` đi đâu
- [ ] Vì đường dẫn tương đối bị cấm
- [ ] Để chạy trên Windows

Thư mục làm việc của lệnh có thể thay đổi trong phiên.
:::

:::quiz Vì sao script Stop hook kiểm tra `stop_hook_active`?
- [ ] Để chạy nhanh hơn
- [x] Để không chặn lần nữa khi Claude đang tiếp tục chính vì hook này — tránh vòng lặp vô tận
- [ ] Vì Claude Code bắt buộc
- [ ] Để bỏ qua test

Claude Code cũng có giới hạn số lần chặn liên tiếp, nhưng script nên tự an toàn.
:::

:::exercise Thử thách mở rộng — chỉ format file code
Sửa hook PostToolUse để chỉ chạy Prettier khi file có đuôi `.ts`, `.html`, `.css`, `.json`, `.md`.
???
```json
{ "type": "command", "command": "f=$(jq -r '.tool_input.file_path // empty'); case \"$f\" in *.ts|*.html|*.css|*.json|*.md) npx prettier --write \"$f\";; esac" }
```
Hoặc chuyển thành script `.claude/hooks/format.sh` để dễ đọc và test bằng tay giống Bước 2. Kiểm tra: nhờ Claude tạo `notes.txt` — Prettier không chạy; sửa một file `.ts` — Prettier chạy.
:::

> Nguồn: *Automate actions with hooks*, *Hooks reference*, *Debug your configuration* — code.claude.com/docs (truy cập 11/11/2026). Hai script đã được chạy thử trên cc-lab (exit 2 khi chặn, exit 0 khi hợp lệ).
