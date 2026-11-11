---
title: Quy trình một task Angular với Claude Code — từ spec tới merge
summary: Ghép các nguyên tắc thành một quy trình lặp lại được, kèm thư viện prompt mẫu cho các việc hay gặp trong dự án Angular enterprise.
level: intermediate
lastReviewed: 2026-11-11
tags: [claude-code, workflow, angular, prompts]
related: [claude-code/review/prompting/viet-prompt-cu-the, claude-code/consolidate/verification/cho-claude-phep-kiem-tra]
---

## Quy trình

| Bước | Bạn làm | Claude làm |
|---|---|---|
| 1. Làm rõ | Mô tả vấn đề, nhờ phỏng vấn nếu chưa rõ | Hỏi lại, viết `SPEC.md` |
| 2. Hiểu code | Đọc phần liên quan (đừng bỏ bước này!) | Khám phá codebase, chỉ ra file sẽ đụng tới |
| 3. Triển khai | Đưa phép kiểm tra (test/typecheck), theo dõi phút đầu | Viết test tái hiện → sửa → chạy kiểm tra |
| 4. Review độc lập | — | `/code-review` hoặc subagent review theo spec |
| 5. Bạn review diff | Giải thích được **mọi** thay đổi | Trả lời câu hỏi của bạn |
| 6. PR & merge | Người duyệt merge | — |

Bước 2 và 5 là nơi kiến thức nền của bạn quyết định chất lượng. Một khuyến nghị đơn giản cho bản thân: *không merge code mà mình không giải thích được cho đồng nghiệp*.

## Thư viện prompt mẫu

**Sửa bug có tái hiện**
```text
Bug: [triệu chứng, bước tái hiện]. Bắt đầu ở [file/thư mục].
Viết test fail tái hiện bug trước, rồi sửa nguyên nhân gốc (không che triệu chứng).
Kiểm tra: [lệnh test]. Giải thích nguyên nhân gốc trong 3 câu và dán output test.
```

**Component mới theo chuẩn team**
```text
Tạo component [tên] theo mẫu [component có sẵn]: signal input/output, OnPush mặc định,
không logic gọi API trong component (dùng facade). Có test cho các trạng thái
loading/empty/error. Không thêm thư viện mới. Kiểm tra: [lệnh typecheck + test].
```

**Migration dùng schematic chính thức**
```text
Chạy ng generate @angular/core:[migration] cho [đường dẫn], sau đó chỉ sửa tay phần còn lại.
Không đổi hành vi. Kiểm tra: [lệnh]. Liệt kê các chỗ sửa tay và lý do.
```

**Tìm nguyên nhân gốc sự cố production**
```text
Log lỗi: [dán log]. Tìm nguyên nhân gốc, chưa sửa vội. Đưa ra 2–3 giả thuyết xếp theo khả năng,
cách kiểm chứng từng cái, rồi kiểm chứng cái khả năng cao nhất. Tóm tắt kèm bằng chứng.
```

**Viết test cho code cũ trước khi refactor (characterization)**
```text
Trước khi refactor [file], viết characterization test ghi lại hành vi HIỆN TẠI (kể cả chỗ có vẻ lạ)
với các input thật trong [fixtures]. Không sửa code. Kiểm tra: test pass trên code hiện tại.
```

:::quiz Bước nào trong quy trình mà kiến thức nền của bạn quan trọng nhất?
- [ ] Bước 6 — merge
- [x] Bước 2 và 5 — hiểu phần code liên quan và review được diff
- [ ] Bước 1 — viết spec
- [ ] Không bước nào, Claude lo hết

Bạn không thể đánh giá một thay đổi về change detection hay RxJS nếu không hiểu cơ chế của nó.
:::

:::quiz Với migration lớn trong Angular, vì sao prompt mẫu yêu cầu chạy schematic chính thức trước?
- [ ] Để Claude bớt việc
- [x] Schematic là biến đổi xác định, đã được Angular kiểm thử; AI chỉ nên xử lý phần schematic không làm được — giảm rủi ro và dễ review hơn
- [ ] Vì Claude không sửa được template
- [ ] Vì schematic nhanh hơn AI

Dùng công cụ xác định khi có; dùng AI cho phần cần phán đoán.
:::

:::exercise Viết CLAUDE.md cho dự án của bạn
Dựa trên dự án Angular bạn đang làm, viết một `CLAUDE.md` không quá 20 dòng, chỉ gồm: lệnh kiểm chứng, chỗ dễ gây hiểu lầm, quyết định của team chưa có trong code, và một điều bạn đã phải nhắc Claude hai lần.
???
Tự kiểm tra với từng dòng: *Claude có tự tìm được điều này bằng cách đọc code không, và nó có thật sự đi tìm không?* — nếu cả hai đều có, xoá dòng đó. Không mô tả kiến trúc hay liệt kê thư mục. Quy tắc không có ngoại lệ (không đọc file secret, bắt buộc test pass) chuyển sang hook/deny rule thay vì viết vào đây. Chạy `/context all` để xác nhận file được nạp, và `/doctor` để xem gợi ý cắt bớt.
:::

> Quy trình tổng hợp từ *Best practices for Claude Code* (code.claude.com/docs, truy cập 11/11/2026); thư viện prompt là khuyến nghị cho dự án Angular của Learning Hub.
