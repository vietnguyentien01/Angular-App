---
title: Khung trả lời Frontend System Design (RADIO) + case autocomplete
summary: Cách đi qua một câu hỏi system design trong 45 phút — yêu cầu, kiến trúc, mô hình dữ liệu, interface, tối ưu — áp dụng cho ô tìm kiếm autocomplete.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [system-design, interview, autocomplete]
related: [angular/deep-dive/system-design/case-dashboard-realtime, rxjs/consolidate/flattening/chon-dung-flattening]
---

## Khung RADIO

| Bước | Hỏi / trình bày | Thời gian |
|---|---|---|
| **R**equirements | Chức năng, phi chức năng (hiệu năng, thiết bị, a11y, i18n, offline), phạm vi | ~5–8 phút |
| **A**rchitecture | Các khối chính và luồng dữ liệu (component, store, API layer, cache) | ~10 phút |
| **D**ata model | State phía client, cấu trúc response, chuẩn hoá dữ liệu | ~5 phút |
| **I**nterface | API giữa client–server và giữa các component (input/output, event) | ~5–8 phút |
| **O**ptimizations | Hiệu năng, UX, a11y, lỗi mạng, bảo mật, khả năng mở rộng | ~10–15 phút |

Nguyên tắc: **hỏi trước khi vẽ**, nói ra trade-off, chủ động quản lý thời gian.

## Áp dụng: ô tìm kiếm autocomplete

**R** — Gợi ý khi gõ ≥ 2 ký tự, tối đa 10 kết quả, dùng bàn phím ↑↓ Enter Esc, hoạt động trên mobile, độ trễ cảm nhận < 200ms, a11y đầy đủ.

**A**
```text
<app-autocomplete>
  input ──(query$)──► debounce 200ms ─► distinctUntilChanged ─► cache? ──► switchMap(api.search)
                                                                   │
  listbox ◄──── results (signal) ◄───────────────────────────────────┘
```

**D** — `{ query, status: 'idle'|'loading'|'success'|'error', items: Suggestion[], activeIndex }`; cache `Map<query, Suggestion[]>` giới hạn kích thước (LRU).

**I** — `GET /api/suggest?q=…&limit=10` → `{ items: [{ id, label, highlight }] }`. Component: `input` `minLength`, `output` `(selected)`.

**O**
- `switchMap` huỷ request cũ → không race condition; cache theo prefix giảm request.
- Highlight phần khớp phía server (tránh tự chèn HTML → XSS).
- a11y: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, option `role="option"`.
- Mạng chậm: hiển thị trạng thái loading sau 300ms, giữ kết quả cũ trong lúc chờ.
- Danh sách dài → virtual scroll; mobile → vùng bấm ≥ 44px.

:::quiz Bước nào thường bị bỏ qua nhất khiến bài system design bị đánh giá thấp?
- [ ] Vẽ sơ đồ
- [x] Làm rõ yêu cầu (đặc biệt phi chức năng) trước khi thiết kế
- [ ] Viết code
- [ ] Chọn framework

Thiết kế đúng cho yêu cầu sai vẫn là thiết kế sai. Người phỏng vấn đánh giá cao việc hỏi đúng câu.
:::

:::quiz Trong autocomplete, vì sao cache theo query lại hữu ích dù đã có `switchMap`?
- [ ] Không hữu ích
- [x] Người dùng hay xoá rồi gõ lại (backspace) — cache trả kết quả tức thì, giảm request và độ trễ
- [ ] Để thay thế `debounce`
- [ ] Để tránh XSS

`switchMap` giải quyết race condition; cache giải quyết request lặp lại. Hai việc khác nhau.
:::

:::exercise Luyện tập
Dùng khung RADIO, phác thảo trong 15 phút: "Thiết kế trang danh sách hồ sơ cho cán bộ: 50.000 hồ sơ, lọc nhiều tiêu chí, sắp xếp, xuất Excel, cập nhật trạng thái hàng loạt."
???
Gợi ý các ý chính:
- **R**: phân trang/lọc phía server, lưu bộ lọc lên URL, chọn nhiều dòng, hành động hàng loạt có xác nhận, xuất Excel bất đồng bộ (file lớn), phân quyền theo vai trò, chạy tốt trên màn hình 1366px.
- **A**: page (smart) + facade (state lọc, chọn) + table (presentational, virtual scroll hoặc phân trang) + export service (job bất đồng bộ, poll trạng thái).
- **D**: `filter` (URL là nguồn sự thật), `selection: Set<id>` (giữ khi đổi trang?), `page` từ server `{ items, total }`.
- **I**: `GET /cases?…`, `POST /cases/bulk-status { ids, status }` trả kết quả từng id, `POST /exports` → `{ jobId }`, `GET /exports/:id`.
- **O**: `switchMap` khi đổi bộ lọc, giữ cuộn, optimistic update có rollback từng dòng lỗi, `concatMap`/giới hạn kích thước lô, a11y cho bảng (header, checkbox có nhãn), audit log cho thao tác hàng loạt.
:::
