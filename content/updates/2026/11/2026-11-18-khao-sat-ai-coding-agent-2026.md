---
title: "Khảo sát JetBrains 2026: 90% dev chuyên nghiệp dùng AI coding agent mỗi tuần, Claude Code dẫn đầu ở nơi làm việc"
date: 2026-11-18
summary: "Theo khảo sát JetBrains (tháng 5–7/2026), 90% lập trình viên chuyên nghiệp dùng AI coding agent ở chỗ làm ít nhất mỗi tuần, 68% dùng hằng ngày. Claude Code tăng từ 18% lên khoảng 39%, Codex từ 3% lên 16%, GitHub Copilot giảm còn 21%."
importance: medium
category: xu-huong
tags: [xu-huong, ai-coding, khao-sat, claude-code, copilot, codex]
relatedTopics: [claude-code/getting-started, ai-agents/nen-tang]
sources:
  - title: "JetBrains Research — AI Coding Agents: Adoption Trends (8/2026)"
    url: https://blog.jetbrains.com/research/2026/08/ai-coding-agent-adoption-2026/
  - title: JetBrains Research — How Much Code Do Developers Really Let Agents Write? (8/2026)
    url: https://blog.jetbrains.com/research/2026/08/how-much-code-do-developers-really-let-agents-write/
  - title: JetBrains Research — Which AI Coding Tools Do Developers Actually Use at Work? (4/2026)
    url: https://blog.jetbrains.com/research/2026/04/which-ai-coding-tools-do-developers-actually-use-at-work/
---

## Có gì mới

Nhóm JetBrains Research công bố số liệu về việc dùng **AI coding agent** (agent tự đọc code, sửa file, chạy lệnh) trong công việc. Dữ liệu khảo sát **tháng 5–7/2026**, hơn 15.000 lập trình viên chuyên nghiệp. Đây là **số liệu tự báo cáo**.

| Chỉ số | Số liệu |
|---|---|
| Dùng AI coding agent ở chỗ làm **ít nhất mỗi tuần** | **90%** (châu Âu, Anh, Mỹ: 86–90%) |
| Dùng **hằng ngày** | **68%** |
| Claude Code dùng ở chỗ làm | khoảng **39%**, tăng từ 18% (tháng 1/2026); bài viết nói gấp đôi GitHub Copilot |
| OpenAI Codex | từ **3%** (tháng 1/2026) lên **16%** |
| GitHub Copilot | giảm từ 29% (một năm trước) còn **21%** |

Bài thứ hai của JetBrains (cũng tháng 8/2026) cho biết **hơn một nửa** lập trình viên giờ **tự gõ dưới 20% code**; với người dùng Cursor, trung bình **58%** code do agent sinh ra.

## Vì sao quan trọng

- **Agent đã là công cụ mặc định, không còn là lợi thế riêng.** Phỏng vấn và công việc giờ ngầm định bạn biết làm việc *cùng* agent: viết yêu cầu rõ, giới hạn quyền, review và kiểm chứng output.
- **Kỹ năng dịch chuyển từ "gõ code" sang "định hướng và kiểm chứng":**
  - đọc hiểu codebase;
  - chia việc;
  - viết test làm tiêu chí xong;
  - review diff do agent tạo.

  Đây là trọng tâm của môn [Làm việc với Claude Code](/claude-code/review) và [AI Agents cho người mới](/ai-agents/course).
- **Thị trường công cụ biến động nhanh:** thứ hạng đổi chỉ trong vài tháng. Đừng gắn quy trình team vào một công cụ duy nhất; ưu tiên chuẩn mở như MCP, và file hướng dẫn dự án như `CLAUDE.md`, `AGENTS.md`.

## Ví dụ

Một quy trình "làm việc cùng agent" tối thiểu mà khảo sát cho thấy đang thành chuẩn:

```text
1. Mô tả việc + tiêu chí xong (test, lệnh build)        ← bạn
2. Agent khám phá code, đề xuất kế hoạch                 ← agent
3. Duyệt kế hoạch, giới hạn phạm vi file                 ← bạn
4. Agent sửa code, chạy test                             ← agent
5. Review diff, chạy kiểm chứng độc lập, rồi mới merge   ← bạn
```

## Việc nên làm

- **Áp dụng ngay:** nếu chưa dùng agent hằng ngày, bắt đầu từ [Lab 1](/claude-code/labs) của môn Claude Code; ghi lại những việc agent làm tốt và chưa tốt trong dự án của bạn.
- **Theo dõi:** báo cáo đầy đủ *State of Developer Ecosystem 2026* của JetBrains, và Stack Overflow Developer Survey, để so sánh số liệu giữa các khảo sát (cách hỏi và cỡ mẫu khác nhau, nên đừng cộng trừ trực tiếp).
- **Lưu ý:** "dùng agent" không có nghĩa "giao hết cho agent". Câu hỏi đáng đo trong team là **tỷ lệ thay đổi do agent tạo bị trả lại khi review**.

:::quiz Theo JetBrains (tháng 5–7/2026), tỷ lệ lập trình viên chuyên nghiệp dùng AI coding agent ở chỗ làm **hằng ngày** là bao nhiêu?
- [ ] 39%
- [ ] 90%
- [x] 68%
- [ ] 21%

90% là tỷ lệ dùng *ít nhất mỗi tuần*; 39% là tỷ lệ dùng Claude Code; 21% là GitHub Copilot.
:::
