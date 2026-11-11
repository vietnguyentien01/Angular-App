# Hướng dẫn viết nội dung

Tài liệu này là **quy ước bắt buộc** cho mọi nội dung trong `content/` — kể cả các lần cập nhật tự động mỗi 2 ngày.
Sau khi sửa nội dung, luôn chạy:

```bash
npm run content:check   # validate schema, liên kết, demo
npm test                # unit test
npm run build           # build thử
```

## 1. Cấu trúc thư mục

```
content/
  <subject>/                         # một môn học, vd: angular
    subject.json                     # thông tin môn + danh sách phần (sections)
    topics.json                      # danh sách chủ đề (thứ tự = thứ tự hiển thị)
    <section>/<topic>/NN-<slug>.md   # một bài; NN = số thứ tự trong chủ đề
  updates/YYYY/MM/YYYY-MM-DD-<slug>.md   # bản tin "Frontend mới"
```

- `id`, `slug`: chữ thường không dấu, số và `-` (vd `effect-dung-cach`).
- Thêm **môn học mới**: tạo `content/<id>/subject.json` + `topics.json` + bài → app tự hiện môn mới.
- Thêm **chủ đề**: thêm vào `topics.json`, rồi tạo thư mục `<section>/<topic>/`.
- File/thư mục bắt đầu bằng `_` bị bỏ qua (dùng cho bản nháp).

## 2. Front-matter của bài học

```yaml
---
title: Dùng effect đúng cách            # bắt buộc
summary: Một câu tóm tắt (≤ 300 ký tự)  # bắt buộc
type: lesson                            # lesson | card | cheatsheet (mặc định lesson)
level: intermediate                     # core | intermediate | advanced — bắt buộc
version: 22                             # phiên bản công nghệ mà bài được viết cho
lastReviewed: 2026-11-11                # ngày xem lại gần nhất — bắt buộc
tags: [signals, effect]
related: [angular/review/signals/signal-computed-effect]   # dạng subject/section/topic/slug
changelog:
  - date: 2026-12-01
    note: Bổ sung linkedSignal do Angular v23 thay đổi API.
---
```

App tự cảnh báo bài "có thể đã cũ" khi `version` < `currentVersion` của môn, hoặc `lastReviewed` quá 365 ngày.
**Khi sửa một bài**: cập nhật `lastReviewed`, `version` (nếu cần) và thêm một dòng `changelog`.

## 3. Cấu trúc nội dung theo phần

Yêu cầu tối thiểu về luyện tập: bài `review` có **≥ 2 `:::quiz`**, bài `consolidate` có **≥ 2 `:::quiz` và ≥ 1 `:::exercise`**, bài `deep-dive` có **≥ 1 `:::quiz` hoặc `:::exercise`**.
Câu "đoán output" và đáp án code **phải được chạy thử** (RxJS, signals…) trước khi commit.


| Phần | Mục đích | Khung bài |
|---|---|---|
| `review` (Ôn lại Core) | Nhắc lại nhanh, 1–3 phút | TL;DR → ví dụ ngắn → bảng chọn nhanh → 1 lỗi hay gặp → `:::version` → 1 `:::interview` |
| `consolidate` (Củng cố) | Hiểu "tại sao", luyện tay | TL;DR → cơ chế → code `bad`/`good` → demo → pitfalls → `:::senior` → `:::version` → `:::interview` → bài tập |
| `deep-dive` (Chuyên sâu & Cập nhật) | Bên trong & cái mới | TL;DR → cơ chế bên trong / mã nguồn → so sánh phương án, trade-off → tính năng mới theo phiên bản → `:::senior` |

## 4. Cú pháp mở rộng

````md
:::tip Tiêu đề tuỳ chọn          (tip | note | warning | danger | senior)
Nội dung Markdown.
:::

:::version v16 Ở Angular 16 / 19
Khác biệt ở các bản cũ mà dự án thực tế còn dùng.
:::

:::interview Câu hỏi phỏng vấn?
Đáp án (ẩn, bấm để mở).
:::

:::demo signals-counter           (demo phải được đăng ký, xem mục 6)

:::quiz Câu hỏi trắc nghiệm?
(tuỳ chọn: đoạn code hoặc mô tả)

- [ ] Đáp án sai
- [x] Đáp án đúng                 (≥ 2 đáp án, ≥ 1 đúng; nhiều [x] = chọn nhiều)
- [ ] Đáp án sai

Giải thích (hiện sau khi trả lời).
:::

:::exercise Tiêu đề bài tập
Đề bài…
???
Lời giải (ẩn, bấm để xem).
:::

```ts good title="app.ts"         (good | bad | không có; title tuỳ chọn)
const x = 1;
```
````

- **Không lồng container** (vd `:::warning` bên trong `:::exercise`) — build sẽ báo lỗi.
- Mọi `:::quiz` của môn học được gom vào trang **Luyện tập** (`/<subject>/practice`).
- **HTML thô bị escape** — không dùng thẻ HTML trong Markdown.
- Link nội bộ dùng đường dẫn tuyệt đối trong app, vd `[Signals](/angular/review)`.
- Ngôn ngữ code hỗ trợ: `ts, js, html, css, scss, json, bash, yaml, diff, text`.

## 5. Bản tin "Frontend mới" (cập nhật mỗi 2 ngày)

File: `content/updates/YYYY/MM/YYYY-MM-DD-<slug>.md` (ngày trong tên file = `date`).

```yaml
---
title: Angular 23 ra mắt signal-based router guards
date: 2026-11-13
summary: Tóm tắt 1–2 câu (≤ 400 ký tự).
importance: high          # high | medium | low
tags: [angular, router]
relatedTopics: [angular/signals]    # dạng subject/topic, phải tồn tại
sources:                  # bắt buộc ≥ 1, chỉ https, ưu tiên nguồn chính thống
  - title: Angular Blog — ...
    url: https://blog.angular.dev/...
---
```

Khung nội dung bản tin:

1. `## Có gì mới` — mô tả ngắn gọn, chính xác.
2. `## Vì sao quan trọng` — ảnh hưởng thực tế với dev Angular / dự án enterprise.
3. `## Ví dụ` — code trước/sau nếu có.
4. `## Việc nên làm` — áp dụng ngay / theo dõi / chưa cần quan tâm.
5. Tuỳ chọn: một `:::quiz` ngắn để tự kiểm tra đã hiểu tin.

Quy tắc:

- **Chỉ viết điều có nguồn kiểm chứng**; không suy đoán, không bịa số phiên bản hay ngày phát hành.
- Ưu tiên nguồn chính thống: blog/release notes/changelog chính thức, GitHub release, RFC, TC39, web.dev, MDN, Chrome/Firefox/Safari release notes.
- Mỗi lần chạy tối đa ~3 bản tin; gộp tin nhỏ cùng chủ đề. Nếu không có gì đáng kể: **không tạo file**.
- Không trùng tin đã có (tìm trong `content/updates/` trước khi viết).
- Nếu tin làm một bài học cũ bị lỗi thời: sửa bài đó (cập nhật `lastReviewed`, `changelog`) trong cùng lần chạy.

## 5b. Lộ trình (roadmap.json)

Mỗi môn có thể có `content/<subject>/roadmap.json` → trang `/<subject>/roadmap`:

```json
{
  "title": "…", "description": "…",
  "stages": [
    { "id": "kebab-id", "title": "…", "duration": "2–3 tuần", "goal": "…",
      "outcomes": ["…"], "items": ["angular/consolidate/signals/effect-dung-cach", "rxjs/…"],
      "practice": ["Việc thực hành trên dự án thật"], "milestone": "Cột mốc kiểm chứng" }
  ]
}
```

`items` dùng khoá đầy đủ `subject/section/topic/slug` (được tham chiếu bài của môn khác) — build báo lỗi nếu bài không tồn tại. Khi thêm bài mới quan trọng, cân nhắc thêm vào chặng phù hợp.

## 6. Thêm demo tương tác

1. Tạo component trong `src/app/plugins/demos/<ten-demo>/`.
2. Thêm tên vào `src/app/plugins/demos/demo-names.ts`.
3. Thêm loader vào `src/app/plugins/demos/demo-registry.ts`.
4. Dùng trong Markdown: `:::demo ten-demo`.
