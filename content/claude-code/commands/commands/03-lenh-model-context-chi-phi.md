---
title: Lệnh model, context và chi phí — /model, /effort, /fast, /advisor, /context, /usage…
summary: "Giải thích từng lệnh chọn model và mức suy luận, xem context đang bị chiếm bởi gì, theo dõi usage và hạn mức gói, xử lý khi chạm giới hạn, và báo cáo thói quen sử dụng — kèm ví dụ và khi nào dùng."
type: cheatsheet
level: core
lastReviewed: 2026-11-11
tags: [claude-code, commands, models, cost, reference]
related: [claude-code/deep-dive/sessions/model-va-usage, claude-code/commands/commands/lenh-phien-va-hoi-thoai]
---

## Model và suy luận

### `/model [model]` — đổi model

Đổi model và **lưu làm mặc định** cho phiên mới. Không đối số → bộ chọn; nhấn `s` trên một dòng để chỉ đổi cho phiên hiện tại; mũi tên trái/phải chỉnh effort (model hỗ trợ).

```text
/model sonnet
/model opusplan
/model claude-opus-5-5
```

Phím tắt tương đương: `Option+P` / `Alt+P`.

### `/effort [level|auto|status|ultracode [on|off]]` — mức suy luận

`low`, `medium`, `high`, `xhigh`, `max` (chỉ cho phiên này) hoặc `auto`; `status` in mức hiện tại; `ultracode` bật chế độ ultracode cho phiên.

```text
/effort high
/effort status
```

Chỉ một tin nhắn cần nghĩ sâu → viết `ultrathink` trong tin đó thay vì đổi effort.

### `/fast [on|off]` — fast mode

Cùng model, nhanh hơn (tới ~2,5×), giá mỗi token cao hơn. Chạy được giữa lượt (lượt đang chạy vẫn theo tốc độ cũ). Phím: `Option+O` / `Alt+O`.

### `/advisor [model|off]` — "cố vấn" model thứ hai

Bật công cụ advisor: tại các thời điểm quan trọng, Claude hỏi ý kiến một model khác (`fable`, `opus`, `sonnet` hoặc ID đầy đủ). Không đối số → bộ chọn.

```text
/advisor opus
/advisor off
```

## Context

### `/context [all]` — context đang chứa gì

Lưới màu: CLAUDE.md, memory, MCP tools, skill, hội thoại… cùng gợi ý tối ưu và cảnh báo khi sắp đầy/vượt. `all` mở rộng chi tiết từng mục (gồm danh sách **Memory files**).

```text
/context all
```

Dùng khi: phiên chậm/tốn bất thường, nghi CLAUDE.md không nạp, muốn biết MCP server nào tốn chỗ.

### `/autocompact` — xem bài *Lệnh quản lý phiên*.

## Usage và hạn mức

### `/usage` — chi phí, hạn mức, thống kê

Alias `/cost`, `/stats` (`/stats` mở thẳng tab Stats). Gói Pro/Max/Ultra/Team/Enterprise: hiện **hạn mức gói** và phần nào đang tiêu hạn mức. Con số đô-la của phiên tính theo giá niêm yết — chỉ có ý nghĩa thanh toán với API.

### `/rate-limit-options` — khi chạm giới hạn gói

Các lựa chọn để làm tiếp: chờ và **tự tiếp tục khi hạn mức reset**, thêm usage credits, hoặc nâng gói. Claude Code có thể tự mở menu này khi bạn chạm giới hạn.

### `/usage-credits` — cấu hình usage credits

Mở trang thanh toán; thành viên Team/Enterprise không có quyền thanh toán thì gửi yêu cầu cho admin.

### `/upgrade` — mở trang nâng gói

### `/passes` — chia sẻ một tuần dùng thử Claude Code cho bạn bè (chỉ hiện khi tài khoản đủ điều kiện)

### `/privacy-settings` — xem/cập nhật cài đặt quyền riêng tư (gói Pro, Max, Ultra)

## Phân tích thói quen

### `/insights` — báo cáo HTML về cách bạn dùng Claude Code

Phân tích các phiên gần đây trên máy: dự án nào, dùng thế nào, chỗ nào hay hỏng, tính năng nên thử. Không có trong cloud session. Báo cáo cũng tốn token để tạo.

### `/team-onboarding` — hướng dẫn onboarding cho đồng nghiệp

Phân tích 30 ngày phiên, lệnh, MCP server bạn dùng → một bản markdown đồng nghiệp dán vào làm tin nhắn đầu tiên để thiết lập nhanh.

:::quiz Bạn muốn đổi sang Sonnet **chỉ cho phiên này**, không đổi mặc định. Cách nào?
- [ ] `/model sonnet`
- [x] `/model` rồi nhấn `s` trên dòng Sonnet trong bộ chọn
- [ ] `/effort sonnet`
- [ ] `/fast on`

`/model <tên>` lưu làm mặc định cho các phiên mới.
:::

:::quiz Phiên bỗng tốn token nhiều bất thường. Lệnh nào cho biết context đang bị chiếm bởi gì?
- [ ] `/usage`
- [x] `/context`
- [ ] `/recap`
- [ ] `/insights`

`/usage` cho biết tốn bao nhiêu; `/context` cho biết vì sao.
:::

:::exercise Đo một phiên làm việc thật
Làm một task nhỏ (khoảng 15 phút). Đầu task chạy `/context` và `/usage`; giữa task đọc một file lớn bằng `@` rồi chạy lại `/context`; cuối task chạy `/usage` lần nữa. Ghi lại: phần nào tăng nhiều nhất, và một thay đổi bạn sẽ làm lần sau.
???
Thường thấy: phần hội thoại/tool results tăng mạnh sau khi đọc file lớn hoặc chạy lệnh có output dài (test, build). Cải thiện: đọc đúng phần cần (đưa đường dẫn + dòng), giao tìm kiếm rộng cho subagent, lọc output test chỉ còn phần fail, `/compact` có trọng tâm khi chuyển pha, `/clear` giữa các task. Nếu MCP chiếm nhiều: tắt server không dùng (`/mcp disable <ten>`).
:::

> Nguồn: *Commands*, *Model configuration*, *Speed up responses with fast mode*, *Manage costs effectively* — code.claude.com/docs (truy cập 11/11/2026).
