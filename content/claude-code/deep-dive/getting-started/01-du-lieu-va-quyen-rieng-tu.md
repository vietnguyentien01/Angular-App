---
title: Dữ liệu đi đâu? Quyền riêng tư, lưu trữ, telemetry và chọn tài khoản cho dự án khách hàng
summary: "Claude Code gửi gì lên mạng, Anthropic giữ bao lâu, có dùng để huấn luyện không (khác nhau giữa gói cá nhân và thương mại), transcript cục bộ nằm đâu, cách tắt telemetry và báo lỗi, ZDR, cloud provider — và checklist trước khi dùng trên code của ngân hàng/chính phủ."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, privacy, data-usage, enterprise, security]
related: [claude-code/deep-dive/automation/bao-mat-va-quy-dinh-team, claude-code/deep-dive/guardrails/sandbox-va-prompt-injection]
---

## TL;DR

- Claude Code chạy trên máy bạn nhưng **gửi prompt, nội dung file Claude đọc và output lệnh** lên model qua TLS 1.2+. Cái gì Claude đọc là cái đó rời máy.
- **Gói cá nhân** (Free, Pro, Max, Ultra): bạn **chọn** có cho dùng dữ liệu cải thiện model hay không. **Gói thương mại** (Team, Enterprise, API, cloud provider): mặc định **không** huấn luyện trên code/prompt.
- Transcript **cục bộ** lưu dạng văn bản thường trong `~/.claude/projects/` (mặc định 30 ngày, đổi bằng `cleanupPeriodDays`).
- Dự án khách hàng: dùng tài khoản/hợp đồng **của công ty**, theo chính sách AI của khách hàng — không dùng gói cá nhân.

## Cái gì rời khỏi máy?

| Dữ liệu | Rời máy? | Ghi chú |
|---|---|---|
| Prompt của bạn, câu trả lời của model | Có | Mã hoá khi truyền (TLS 1.2+) |
| Nội dung file Claude **đọc** | Có | Kể cả `.env` nếu bạn cho đọc → dùng deny rule |
| Output lệnh Claude chạy (test, build, log) | Có | Log có thể chứa dữ liệu thật — cẩn thận |
| File Claude **không** đọc | Không | Repo không bị "tải lên" toàn bộ |
| Metrics vận hành (độ trễ, độ tin cậy, mẫu sử dụng) | Có, trừ khi tắt | **Không** bao gồm code, prompt, đường dẫn file |
| Báo lỗi nội bộ của Claude Code | Có điều kiện | Đã xoá các mẫu secret, đường dẫn, email trước khi gửi |
| Transcript khi bạn dùng `/feedback`, `/bug` | Chỉ khi bạn gửi | Lưu **5 năm** — đừng gửi phiên chứa dữ liệu khách hàng |

## Huấn luyện và thời gian lưu

| Loại tài khoản | Dùng để huấn luyện? | Lưu phía Anthropic |
|---|---|---|
| Free/Pro/Max/Ultra, **bật** cho phép cải thiện model | Có | 5 năm |
| Free/Pro/Max/Ultra, **tắt** | Không | 30 ngày |
| Team/Enterprise/API (điều khoản thương mại) | Không (trừ khi tổ chức chủ động tham gia chương trình chia sẻ dữ liệu) | 30 ngày (chuẩn) |
| Enterprise có **Zero Data Retention** | Không | Không lưu phía server (bật theo từng tổ chức sau khi xác nhận đủ điều kiện) |

Đổi lựa chọn của gói cá nhân: `/privacy-settings` hoặc trang cài đặt quyền riêng tư trên claude.ai.

## Dữ liệu cục bộ

- `~/.claude/projects/<project>/*.jsonl` — transcript từng phiên, **văn bản thường**, gồm cả nội dung file Claude đã đọc.
- `~/.claude/projects/<project>/memory/` — auto memory.
- Snapshot file cho checkpoint.
- Thời gian giữ: `cleanupPeriodDays` (mặc định 30 ngày; auto memory không bị dọn theo chu kỳ này).
- Xoá toàn bộ dữ liệu của một dự án: `claude purge <path>` (chạy `--dry-run` trước).

:::warning Laptop là nơi rò rỉ phổ biến
Transcript chứa nguyên văn file đã đọc. Máy làm dự án khách hàng cần mã hoá ổ đĩa; khi kết thúc hợp đồng, `claude purge` thư mục dự án và xoá repo.
:::

## Tắt bớt lưu lượng không cần thiết

| Biến môi trường | Tác dụng |
|---|---|
| `DISABLE_TELEMETRY=1` | Tắt metrics |
| `DISABLE_ERROR_REPORTING=1` | Tắt báo lỗi |
| `DISABLE_FEEDBACK_COMMAND=1` | Tắt `/feedback` |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1` | Tắt khảo sát chất lượng phiên |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` | Tắt mọi lưu lượng không thiết yếu cùng lúc |

Đặt trong khối `env` của settings (dự án hoặc managed) để áp cho cả team:

```json title=".claude/settings.json"
{
  "env": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

Khi dùng **Amazon Bedrock / Google Cloud / Microsoft Foundry / Claude Platform on AWS**: metrics, báo lỗi, `/feedback` **mặc định tắt**; mã hoá lưu trữ theo nhà cung cấp (có khoá do khách hàng quản lý — KMS/CMEK). Đây thường là lựa chọn của tổ chức đã có hợp đồng cloud.

## Cloud session khác gì?

- Repo được clone vào **VM cách ly**; transcript lưu phía Anthropic để bạn quay lại (theo chính sách tài khoản).
- Credential GitHub được lưu mã hoá phía server, **không** vào VM; lưu lượng GitHub đi qua proxy gắn credential.
- Mọi lưu lượng ra ngoài đi qua proxy có audit log.
- Xoá phiên cloud bất kỳ lúc nào để xoá dữ liệu sự kiện của phiên.

## Checklist trước khi dùng trên dự án khách hàng

1. Hợp đồng/chính sách của khách hàng có cho dùng trợ lý AI trên code không? Có yêu cầu nhà cung cấp/vùng dữ liệu cụ thể không?
2. Dùng tài khoản **thương mại của công ty** (Team/Enterprise/API hoặc cloud provider), không dùng gói cá nhân.
3. Deny rule cho file bí mật (`.env*`, `*.pem`, cấu hình production) + sandbox.
4. Không dán dữ liệu thật của người dân/khách hàng; dùng dữ liệu giả hoặc đã ẩn danh. Cẩn thận log và dump DB trong output lệnh.
5. Tắt lưu lượng không thiết yếu nếu chính sách yêu cầu; không gửi `/feedback` từ phiên có dữ liệu nhạy cảm.
6. Mã hoá ổ đĩa, đặt `cleanupPeriodDays` theo chính sách, `claude purge` khi kết thúc dự án.

:::senior Góc nhìn senior
Câu hỏi đúng không phải "AI có an toàn không" mà là "**dữ liệu nào** đi tới **đâu**, **ai** giữ, **bao lâu**, theo **hợp đồng nào**". Trả lời được bốn ý đó bằng tài liệu chính thức là điều security team của ngân hàng/chính phủ cần để phê duyệt — và là điều phân biệt kỹ sư senior với người chỉ dùng công cụ.
:::

:::quiz Bạn dùng gói Max cá nhân và đã **bật** cho phép dùng dữ liệu cải thiện model. Có nên dùng tài khoản này trên code của ngân hàng khách hàng?
- [ ] Có, vì dữ liệu được mã hoá khi truyền
- [x] Không — dữ liệu phiên có thể được dùng huấn luyện và giữ 5 năm; dự án khách hàng cần tài khoản thương mại của công ty theo chính sách của khách hàng
- [ ] Có, nếu tắt telemetry
- [ ] Có, nếu dùng plan mode

Mã hoá khi truyền không thay đổi điều khoản sử dụng dữ liệu.
:::

:::quiz Biến nào tắt cùng lúc metrics, báo lỗi, feedback và khảo sát?
- [ ] `DISABLE_TELEMETRY=1`
- [x] `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`
- [ ] `CLAUDE_CODE_SIMPLE=1`
- [ ] `--bare`

`DISABLE_TELEMETRY` chỉ tắt metrics; `--bare` liên quan đến việc nạp cấu hình, không phải telemetry.
:::

:::exercise Viết "bản trả lời security team" cho dự án của bạn
Security team của khách hàng hỏi: "Khi dev dùng Claude Code, dữ liệu nào rời máy, lưu ở đâu, bao lâu, có bị dùng huấn luyện không, chặn file bí mật thế nào?" Viết câu trả lời 10 dòng cho cấu hình bạn đề xuất.
???
Mẫu (giả định công ty dùng Claude Enterprise): (1) Rời máy: prompt, nội dung file Claude đọc, output lệnh — qua TLS 1.2+. (2) Không tải toàn bộ repo. (3) Điều khoản thương mại: không huấn luyện trên code/prompt. (4) Lưu phía Anthropic 30 ngày (hoặc ZDR nếu được bật). (5) Transcript cục bộ trên laptop mã hoá ổ, `cleanupPeriodDays` = 14, `claude purge` khi kết thúc. (6) Deny `Read(./.env*)`, `Read(./**/*.pem)`, cấu hình prod; sandbox bật. (7) Managed settings khoá các rule này. (8) `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. (9) Không dùng dữ liệu thật trong prompt/test. (10) Mọi thay đổi qua PR có người duyệt, CI bắt buộc.
:::

> Nguồn: *Data usage*, *Security*, *Explore the .claude directory* — code.claude.com/docs/en/data-usage, /security, /claude-directory (truy cập 12/11/2026).
