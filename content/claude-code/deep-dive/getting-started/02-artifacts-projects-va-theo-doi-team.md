---
title: Artifacts, Projects, desktop app và theo dõi dùng cho team (OpenTelemetry, analytics)
summary: "Những bề mặt còn lại cần biết: artifact (trang web tương tác Claude xuất bản từ phiên), Projects (một hội thoại điều phối nhiều thread), các điểm mạnh riêng của desktop app, và cách tổ chức theo dõi usage/chi phí bằng OpenTelemetry hoặc dashboard analytics — kèm lưu ý dữ liệu khi bật log nội dung."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, artifacts, projects, desktop, opentelemetry, analytics]
related: [claude-code/consolidate/getting-started/chon-noi-lam-viec, claude-code/deep-dive/getting-started/du-lieu-va-quyen-rieng-tu]
---

## TL;DR

| Bề mặt | Là gì | Dùng khi |
|---|---|---|
| **Artifact** | Trang web tương tác Claude xuất bản từ phiên lên URL riêng tư trên claude.ai, cập nhật tại chỗ | Kết quả dễ **nhìn** hơn đọc: diff có chú thích, dashboard, so sánh phương án, timeline điều tra |
| **Projects** (beta) | Một hội thoại lâu dài; Claude mở **thread** cho từng việc (thường là cloud session) | Một mục tiêu sinh ra nhiều việc qua thời gian, nhiều repo |
| **Desktop app** (tab Code) | Giao diện có nhiều phiên song song cách ly git, review diff trực quan, preview app | Thích giao diện đồ hoạ, chạy nhiều phiên cùng lúc |
| **OpenTelemetry / analytics** | Số liệu usage, chi phí, hoạt động công cụ cho tổ chức | Team/tổ chức cần đo và quản lý |

## Artifacts

- Có trên gói Pro, Max, Ultra, Team, Enterprise; phiên phải đăng nhập bằng `/login`.
- Riêng tư mặc định; chia sẻ từ header của trang khi bạn muốn.
- Là **một trang tự chứa, không có backend** — không thay thế tool nội bộ cần server.
- `/artifacts` liệt kê artifact của bạn, gắn vào phiên, mở hoặc copy link.

Prompt mẫu:

```text
Làm một artifact giải thích PR này cho reviewer: diff của task-store.ts có chú thích từng thay đổi,
sơ đồ luồng signal trước và sau, và danh sách rủi ro.
```

```text
Dựng artifact so sánh 3 phương án lưu task (localStorage, IndexedDB, backend): bảng trade-off và đề xuất.
```

:::warning Dữ liệu khách hàng và link chia sẻ
Artifact được tạo từ mọi thứ phiên đọc được. Đừng xuất bản trang chứa dữ liệu thật của khách hàng; kiểm tra trước khi bấm chia sẻ.
:::

## Projects (beta)

- Gửi mọi việc liên quan vào **một chỗ** (bug, stack trace, danh sách việc); Claude mở thread cho từng việc hoặc chuyển cho thread đang làm khu vực đó.
- **Đặt bối cảnh một lần**: chỉ dẫn của project áp cho mọi thread mới (vd nhánh đích, quy ước).
- **Overview** cho biết thread nào xong, PR nào chờ review, thread nào đang chờ bạn trả lời.
- Thread cần thứ chỉ máy bạn có → yêu cầu chạy thread đó trên máy bạn qua Remote Control.
- Hợp với: một mục tiêu trên nhiều repo ("đưa mọi service lên cấu hình lint mới"), một khu vực bạn liên tục đổ việc vào.
- Đang beta trên Pro, Max, Ultra, triển khai dần.

## Desktop app — điểm khác CLI

- Nhiều phiên song song, mỗi phiên cách ly bằng git worktree; bố cục pane kéo thả, terminal và editor tích hợp.
- Review diff trực quan, **preview app** ngay trong ứng dụng, theo dõi PR.
- Cho Claude dùng máy tính (computer use) và duyệt site bên ngoài khi bạn duyệt.
- Chuyển phiên CLI sang desktop: `/desktop` (macOS, Windows x64).

Cấu hình (CLAUDE.md, settings, hook, MCP, skill) giống CLI — kiến thức trong khoá này áp dụng nguyên vẹn.

## Theo dõi dùng cho team

### Dashboard có sẵn

| Gói | Dashboard | Có gì |
|---|---|---|
| Team / Enterprise | claude.ai/analytics/claude-code | Usage, đóng góp (tích hợp GitHub), bảng xếp hạng, xuất dữ liệu — Admin/Owner xem |
| API (Console) | platform.claude.com/claude-code | Usage, chi tiêu, thông tin theo team |

### OpenTelemetry (tự thu về hệ thống của bạn)

```json title="managed settings — bật cho cả tổ chức"
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://collector.noibo.vn:4317"
  }
}
```

Metric tiêu biểu: `claude_code.session.count`, `claude_code.cost.usage` (USD), `claude_code.token.usage` (chia theo loại token, model, skill, plugin, agent), `claude_code.lines_of_code.count`, `claude_code.commit.count`, `claude_code.pull_request.count`, `claude_code.active_time.total`.

Kiểm tra: tìm metric `claude_code.session.count` trên backend; không thấy gì → `claude --debug-file /tmp/otel.log`, tìm lỗi `[3P telemetry]`.

:::danger Log nội dung là dữ liệu nhạy cảm
Mặc định **không** ghi nội dung prompt, câu trả lời hay đối số công cụ. `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_DETAILS`… bật lên là đưa nội dung làm việc (có thể gồm code và dữ liệu khách hàng) vào hệ thống log — chỉ bật khi có lý do và chính sách lưu trữ rõ ràng. Token xác thực của collector: dùng `otelHeadersHelper` thay vì ghi cứng vào settings.
:::

## Tự chạy để kiểm chứng

**Artifact** (gói Pro trở lên, đăng nhập bằng `/login`):

| # | Làm | Bạn nên thấy | Nếu khác |
|---|---|---|---|
| 1 | Trong cc-lab: *"Làm một artifact tóm tắt module tasks: sơ đồ luồng signal và bảng các hàm lọc"* | Claude trả một link claude.ai riêng tư | Không có công cụ artifact → kiểm tra gói và đăng nhập (`/status`) |
| 2 | Mở link | Trang tương tác, chỉ bạn xem được | — |
| 3 | `/artifacts` | Artifact vừa tạo trong danh sách | — |

**OpenTelemetry** — thử nhanh không cần collector, dùng exporter `console`:

| # | Làm | Bạn nên thấy | Nếu khác |
|---|---|---|---|
| 1 | `export CLAUDE_CODE_ENABLE_TELEMETRY=1 OTEL_METRICS_EXPORTER=console OTEL_METRIC_EXPORT_INTERVAL=10000` | — | — |
| 2 | `claude --debug-file /tmp/otel.log -p "nói xin chào"` | Câu trả lời; metric được in ra theo exporter console (có `claude_code.session.count`, `claude_code.token.usage`) | Không thấy metric → `grep -i telemetry /tmp/otel.log` tìm lỗi `[3P telemetry]` |
| 3 | Bỏ thử nghiệm: `unset CLAUDE_CODE_ENABLE_TELEMETRY OTEL_METRICS_EXPORTER OTEL_METRIC_EXPORT_INTERVAL` | — | — |

Với collector thật (Grafana/Prometheus…): đổi sang `OTEL_METRICS_EXPORTER=otlp` và `OTEL_EXPORTER_OTLP_ENDPOINT` của collector, kiểm tra metric `claude_code.session.count` trên backend.

:::senior Góc nhìn senior
Đo AI như đo mọi công cụ kỹ thuật: chi phí, mức dùng, và **kết quả** (thời gian review, tỉ lệ bug lọt, lead time) — không chỉ "số dòng code AI viết". Số dòng code tăng mà tỉ lệ revert cũng tăng là tín hiệu xấu. Đặt dashboard cạnh chỉ số chất lượng của team.
:::

:::quiz Bạn muốn gửi cho PM một trang tương tác so sánh 3 phương án thiết kế, có sơ đồ, thay vì dán văn bản dài vào chat. Dùng gì?
- [ ] Output style Explanatory
- [x] Một artifact
- [ ] `/export`
- [ ] Một subagent

Artifact là trang web riêng tư cập nhật tại chỗ, chia sẻ khi bạn muốn.
:::

:::quiz Mặc định, OpenTelemetry của Claude Code có ghi nội dung prompt của dev không?
- [ ] Có, luôn ghi
- [x] Không — phải bật riêng `OTEL_LOG_USER_PROMPTS` (và các biến nội dung khác)
- [ ] Chỉ ghi khi dùng Bedrock
- [ ] Chỉ ghi lệnh Bash

Đây là lựa chọn có chủ đích; nội dung làm việc là dữ liệu nhạy cảm.
:::

:::exercise Đề xuất bộ chỉ số cho team
Viết đề xuất 1 trang cho trưởng nhóm: (1) bật dashboard nào (hoặc OTel về collector nào); (2) 5 chỉ số theo dõi hằng tuần, trong đó ít nhất 2 là chỉ số **chất lượng** chứ không phải mức dùng; (3) chính sách về log nội dung; (4) một artifact mẫu bạn sẽ dùng để báo cáo hằng tuần.
???
Gợi ý: (1) Team/Enterprise → claude.ai/analytics; tổ chức có hệ thống quan sát riêng → OTel qua managed settings về collector nội bộ. (2) Chi phí/người/tuần (`claude_code.cost.usage`), số PR (`pull_request.count`), thời gian từ mở tới merge PR, tỉ lệ PR bị yêu cầu sửa lớn, số bug lọt lên staging liên quan tới thay đổi do AI hỗ trợ. (3) Không bật `OTEL_LOG_USER_PROMPTS`/`OTEL_LOG_TOOL_DETAILS` trên dự án khách hàng; chỉ bật tạm thời trên repo nội bộ để gỡ lỗi. (4) Artifact "Báo cáo tuần" dựng từ số liệu đã xuất, không chứa dữ liệu khách hàng.
:::

> Nguồn: *Share session output as artifacts*, *Let Claude coordinate ongoing work with Projects*, *Desktop application*, *Monitoring*, *Track team usage with analytics* — code.claude.com/docs (truy cập 12/11/2026).
