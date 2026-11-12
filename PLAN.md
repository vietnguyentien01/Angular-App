# Kế hoạch: Learning Hub — bắt đầu với Angular từ Middle lên Senior

> Ứng dụng học tập cá nhân, **thiết kế để mở rộng thành nhiều môn học**.
> Môn đầu tiên: **Angular**, chia làm **3 phần**: **Ôn lại Core** → **Củng cố** → **Chuyên sâu & Cập nhật**.
> Kiến thức frontend mới được **tự động cập nhật mỗi 2 ngày**.

---

## 1. Mục tiêu

- **Ôn lại** nhanh những phần core của Angular để không bị "rỉ" kiến thức nền.
- **Củng cố**: hiểu "tại sao", tránh lỗi thường gặp, luyện qua bài tập và tình huống thực tế.
- **Đi chuyên sâu & cập nhật**: cơ chế bên trong, tính năng mới theo từng phiên bản, kiến trúc, kỹ năng senior.
- Chỉ dùng cá nhân → **không backend, không đăng nhập**, dữ liệu lưu trong trình duyệt.

## 2. Công nghệ

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Framework | Angular bản mới nhất, **standalone**, **zoneless**, **signals** | App tự nó là ví dụ về Angular hiện đại |
| Style | Tailwind CSS (+ CSS variables cho light/dark) | Bạn đã quen dùng |
| Ngôn ngữ nội dung | Tiếng Việt, giữ thuật ngữ tiếng Anh | Đã chốt |
| Phiên bản | Bám bản Angular mới nhất, **có ghi chú khác biệt cho v16 / v19** | Đã chốt |
| Content pipeline | Script build-time: đọc Markdown/JSON → validate schema (Zod) → sinh mục lục, search index | Thêm nội dung không cần sửa code |
| Hosting | **GitHub Pages**, deploy tự động bằng GitHub Actions khi push lên `main` | Đã chốt — học được trên điện thoại |
| Nội dung | File **Markdown** + front-matter, render bằng `ngx-markdown` + highlight code (Shiki) | Viết/sửa/cập nhật nội dung dễ, tách khỏi code |
| Demo tương tác | Component Angular thật nhúng vào bài học | Thấy tận mắt change detection, signals, RxJS... |
| Tìm kiếm | MiniSearch (full-text phía client) | Không cần server |
| Lưu trữ | IndexedDB / localStorage | Offline, riêng tư |
| Offline | PWA (`@angular/service-worker`) | Mở như app trên máy/điện thoại |
| Test | Vitest cho unit, Playwright cho e2e cơ bản | |

---

## 3. Cấu trúc app: 3 phần

Mỗi **chủ đề** (ví dụ: Signals) có thể xuất hiện ở cả 3 phần với **3 tầng sâu khác nhau**,
và được liên kết với nhau: *Ôn lại API* → *Củng cố pattern & pitfalls* → *Chuyên sâu cơ chế & tính năng mới*.

```
                 ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐
  Chủ đề         │ 1. ÔN LẠI CORE   │ → │ 2. CỦNG CỐ       │ → │ 3. CHUYÊN SÂU & CẬP NHẬT │
                 │ (nhắc lại nhanh) │   │ (hiểu & luyện)   │   │ (bên trong & cái mới)    │
  Signals        │ signal/computed/ │   │ effect đúng cách,│   │ reactive graph, linked-  │
                 │ effect cơ bản    │   │ signals vs RxJS  │   │ Signal, resource, forms  │
  Change Det.    │ Default/OnPush   │   │ ExpressionChanged│   │ zoneless, scheduler      │
  ...            │ ...              │   │ ...              │   │ ...                      │
                 └──────────────────┘   └──────────────────┘   └──────────────────────────┘
```

---

### PHẦN 1 — ÔN LẠI CORE (Review)

**Mục đích:** nhắc lại nhanh, kiểm tra trí nhớ, phiên ôn hằng ngày ~10–15 phút.

**Hình thức:**
- **Thẻ kiến thức ngắn** (mỗi thẻ 1 khái niệm, đọc trong 1–2 phút).
- **Cheat sheet** theo chủ đề (in được / xem nhanh).
- **Flashcard ôn tập ngắt quãng** (SM-2): app tự chọn thẻ cần ôn hôm nay.
- **Quick quiz** 5–10 câu, kết quả quyết định thẻ nào cần ôn lại.
- **"Giải thích trong 60 giây"**: tự trả lời rồi mở đáp án mẫu (luyện nói khi phỏng vấn).
- **Bài kiểm tra đầu vào**: làm đạt → đánh dấu đã nắm, nhảy sang Phần 2.

**Chủ đề:**
1. TypeScript cần thiết cho Angular (types, interfaces, generics cơ bản, decorators, strict mode)
2. Components & Templates: data binding, `@Input`/`@Output` & `input()`/`output()`/`model()`, control flow `@if`/`@for`/`@switch`/`@let`
3. Lifecycle hooks: thứ tự chạy, khi nào dùng hook nào
4. Directives & Pipes có sẵn, pure vs impure
5. Services & DI cơ bản: `providedIn`, `inject()`
6. Routing cơ bản: routes, params, lazy loading, guards
7. Forms: template-driven vs reactive, validators có sẵn
8. HttpClient cơ bản: GET/POST, xử lý lỗi, interceptor là gì
9. RxJS core: Observable, Subject, các operator hay dùng (`map`, `filter`, `switchMap`, `debounceTime`, `catchError`...)
10. Signals cơ bản: `signal`, `computed`, `effect`
11. Change Detection cơ bản: Default vs OnPush
12. Angular CLI & cấu trúc project

---

### PHẦN 2 — CỦNG CỐ (Consolidate)

**Mục đích:** hiểu "tại sao", biết pitfalls, luyện tay đến mức dùng đúng mà không phải nghĩ.

**Cấu trúc mỗi bài:** TL;DR → cơ chế (kèm sơ đồ) → code tốt vs xấu → demo tương tác → pitfalls → best practices & trade-off → câu hỏi phỏng vấn → bài tập.

**Hình thức luyện tập:**
- **Đoán output**: đọc code, đoán log / thứ tự chạy / giá trị hiển thị.
- **Tìm bug**: đoạn code có memory leak, lỗi CD, race condition... → tìm & sửa.
- **Refactor**: chuyển code "dở" thành code chuẩn.
- **Bài tập nhỏ có lời giải**.
- **Case study từ dự án thật của bạn** (xem mục 5).

**Chủ đề:**
1. **Components nâng cao**: content projection, `ng-template`/`ngTemplateOutlet`, view/content queries (signal queries), dynamic components, host bindings, host directives, ViewEncapsulation
2. **Directives & Pipes tự viết**: attribute/structural directive, microsyntax, hiệu năng pipe
3. **Dependency Injection**: hierarchical injectors (Environment vs Element), `useClass/useValue/useFactory/useExisting`, `InjectionToken`, multi providers, modifiers, `viewProviders`, injection context
4. **Change Detection**: cây CD, OnPush thực sự check khi nào, `markForCheck` vs `detectChanges`, `ExpressionChangedAfterItHasBeenChecked`
5. **Signals trong thực tế**: dùng `effect` đúng/sai, `untracked`, signals vs RxJS, interop `toSignal`/`toObservable`
6. **RxJS**: hot vs cold, chọn đúng `switchMap`/`mergeMap`/`concatMap`/`exhaustMap`, error handling & retry, `shareReplay` và bẫy, memory leak & `takeUntilDestroyed`, custom operator, marble diagrams *(demo: marble visualizer)*
7. **HTTP**: functional interceptors (auth, refresh token, retry, cache, loading), `HttpContext`, cancel request, upload/download progress
8. **Forms**: typed reactive forms, `FormArray`, dynamic forms, custom & async validators, cross-field validation, `ControlValueAccessor`, form lớn nhiều field
9. **Routing**: functional guards & resolvers, `withComponentInputBinding`, preloading, nested/named outlets, route reuse strategy
10. **State management**: service + signals, NgRx Store, NgRx SignalStore, TanStack Query; server state vs client state; anti-patterns
11. **Testing**: TestBed, test component/service/directive/pipe, Component Harness, `HttpTestingController`, test signals & effects, marble testing, Playwright
12. **Performance cơ bản đến thực chiến**: đo bằng DevTools/Angular DevTools, OnPush, `@for track`, `@defer`, virtual scroll, `NgOptimizedImage`, bundle budget
13. **Security**: XSS & sanitization, `bypassSecurityTrust*`, CSP, XSRF, JWT/OIDC, lưu token ở đâu
14. **Accessibility & i18n**: ARIA, focus management, CDK a11y, WCAG; `$localize` vs Transloco
15. **Kiến trúc dự án**: cấu trúc theo feature/domain, smart vs presentational, facade, ranh giới module, ESLint boundaries

---

### PHẦN 3 — CHUYÊN SÂU & CẬP NHẬT (Deep dive & What's new)

**Mục đích:** hiểu tận bên trong, theo kịp Angular mới, tư duy kiến trúc & kỹ năng senior.

#### 3A. Chuyên sâu (Internals)
1. **Compiler & runtime**: Ivy, AOT, template → instructions, `ApplicationRef`, bootstrap
2. **Change Detection nội tại & Zoneless**: Zone.js patch gì, scheduler zoneless, migration sang zoneless
3. **Reactive graph của Signals**: producer/consumer, glitch-free, cách `computed` lazy & memoize *(demo: vẽ graph signals trực tiếp)*
4. **Tự viết mini Observable / mini Signal** để hiểu cơ chế
5. **JS & Browser cho senior**: event loop (macro/microtask), rendering pipeline, memory & GC, Web Workers
6. **TypeScript nâng cao**: conditional/mapped/template literal types, `infer`, viết type cho thư viện
7. **SSR, Hydration & SSG**: `@angular/ssr`, incremental hydration, event replay, hydration mismatch
8. **Monorepo & Micro Frontends**: Nx, Module Federation / Native Federation **so sánh với single-spa**, chia sẻ dependencies
9. **Design system & thư viện**: CDK (Overlay, Portal, DragDrop), `ng-packagr`, versioning, theming, Storybook
10. **Tooling & Build**: esbuild/Vite builder, schematics & generators tự viết, CI/CD, `ng update`
11. **Performance chuyên sâu**: profiling, memory leak detection, Web Vitals, tối ưu bảng/form rất lớn

#### 3B. Cập nhật (What's new)
1. **Dòng thời gian Angular v12 → bản mới nhất**: mỗi version có gì mới, cái gì bị deprecated, ảnh hưởng thực tế.
2. **Tính năng mới đáng chú ý** (có demo): signal inputs/queries, `linkedSignal`, `resource`/`httpResource`, **signal forms**, `@defer`, `@let`, zoneless, incremental hydration...
3. **Hướng dẫn migration** từng bước: NgModule → standalone, `*ngIf` → control flow, `@Input` → signal inputs, Zone → zoneless, Karma → Vitest.
4. **Tech radar cá nhân**: Adopt / Trial / Assess / Hold cho các thư viện & pattern trong hệ sinh thái Angular.
5. Mỗi bài có **`angularVersion`** và **`lastReviewed`** → app cảnh báo bài nào có thể đã cũ khi có bản Angular mới.

#### 3C. Kỹ năng Senior
1. **Frontend System Design**: khung trả lời + case study (dashboard realtime, form builder, autocomplete, data grid lớn)
2. **Lãnh đạo kỹ thuật**: code review, ADR / technical design doc, ước lượng, quản lý technical debt, mentoring
3. **Phỏng vấn Senior**: câu hỏi kỹ thuật theo chủ đề, câu hỏi hành vi (STAR), live coding
4. **Phát triển nghề nghiệp**: bảng thuật ngữ Anh–Việt, mẫu câu tiếng Anh cho code review/phỏng vấn, viết CV kiểu senior (có số liệu tác động)

---

## 4. Tính năng chung

1. **Dashboard** chia 3 khu vực tương ứng 3 phần: thẻ cần ôn hôm nay / bài củng cố đang học / bài chuyên sâu & cập nhật mới.
2. **Ma trận kiến thức**: chủ đề × 3 tầng, tô màu theo mức độ nắm vững.
3. **Ghi chú cá nhân & bookmark** trên từng bài.
4. **Tìm kiếm toàn văn** (Ctrl+K), lọc theo phần.
5. **Senior self-assessment**: tự đánh giá năng lực theo từng mảng, theo dõi qua thời gian.
6. Dark mode, responsive, PWA offline, export/import dữ liệu cá nhân (JSON).

## 5. Cá nhân hoá theo hồ sơ (CV)

**Điểm mạnh hiện có** (Phần 1 đi nhanh, Phần 2/3 đào sâu "tại sao"): Angular v12 → v21 (standalone, Signals, OnPush), Micro Frontend (single-spa), dynamic forms (JSON Schema, Form.io, JSONLogic), RxJS, TanStack Query, Playwright, migration hệ thống legacy, team lớn 20–50 người.

**Khoảng trống ưu tiên cao**: Change Detection nội tại & Zoneless, Performance có đo lường, DI chuyên sâu, Security, chiến lược Testing, kỹ năng Senior, Frontend System Design.

**Case study gắn với dự án thật** (nằm trong Phần 2 & 3):
1. Thiết kế dynamic form engine từ JSON Schema (kiến trúc, hiệu năng, signal forms, validation bằng JSONLogic)
2. Auto-save draft an toàn (debounce, hủy request cũ, xung đột phiên bản)
3. Import Excel lớn không đơ UI (Web Worker, virtual scroll, chunking)
4. Shared component library cho micro frontends (versioning, singleton deps, theming)
5. Migration legacy → Angular 21 đảm bảo "kết quả giống hệt" (characterization tests)

## 6. Kiến trúc mở rộng (Scalable) — thêm môn học mới không cần sửa code

### Mô hình nội dung

```
Subject (môn học)          ví dụ: angular, javascript, react, system-design, english-for-dev...
 └── Section (phần)        cấu hình được cho từng môn; mặc định: review / consolidate / deep-dive
      └── Topic (chủ đề)   ví dụ: signals, change-detection
           └── Item        lesson | card | flashcard | quiz | exercise | update
```

- **Mỗi môn học = 1 thư mục** trong `content/` + file `subject.json` (tên, icon, màu, danh sách phần, thứ tự).
  Thêm môn mới = thêm thư mục → build → app tự hiện môn mới trên sidebar và dashboard.
- **Section cấu hình được**: môn Angular dùng 3 phần; môn khác (ví dụ tiếng Anh) có thể chỉ có "Ôn tập" + "Luyện tập".
- **Liên kết chéo**: một topic có thể tham chiếu topic ở môn khác (ví dụ Angular › Signals ↔ JavaScript › Event loop).
- **Schema chung** cho mọi loại item (front-matter Markdown + JSON), được validate bằng Zod lúc build và trong CI —
  nội dung sai định dạng sẽ không được deploy.

### Engine dùng chung cho mọi môn
- Flashcard SM-2, quiz, bài tập, ghi chú, bookmark, tìm kiếm, ma trận kiến thức, dashboard, tiến độ.
- **Loại bài tập dạng plugin** (registry): đoán output, tìm bug, refactor, trắc nghiệm, điền khuyết...
  thêm loại mới = thêm 1 component + đăng ký, không đụng phần còn lại.
- **Demo tương tác dạng plugin**: Markdown gọi demo bằng tên (`<demo name="signals-graph" />`), demo được lazy-load.

### Hiệu năng khi nội dung lớn dần
- Mỗi môn học được **lazy-load** riêng (route `/:subject/:section/:topic/:item`).
- Nội dung bài học tách thành từng file JSON nhỏ, chỉ tải khi mở; search index tách theo môn.
- Dữ liệu cá nhân (tiến độ, SRS, ghi chú) trong IndexedDB có **version + migration**, không mất khi app nâng cấp.
- Export/import JSON để sao lưu hoặc chuyển máy.

### Cấu trúc thư mục

```
src/app/
  core/                 # content loader, storage (IndexedDB), progress, srs, search, theme
  layout/               # shell, sidebar (môn học → phần → chủ đề), command palette (Ctrl+K)
  features/
    dashboard/          # tổng hợp mọi môn: thẻ cần ôn hôm nay, đang học, cập nhật mới
    subject/            # trang môn học, render section/topic theo cấu hình
    lesson/             # render Markdown + demo slots
    flashcards/  quiz/  exercises/
    updates/            # bản tin "Frontend mới" (mỗi 2 ngày)
    knowledge-matrix/  notes/  settings/
  plugins/
    exercises/          # các loại bài tập
    demos/              # demo tương tác
  shared/
content/
  angular/
    subject.json
    review/<topic>/*.md
    consolidate/<topic>/*.md
    deep-dive/<topic>/*.md
    whats-new/v12.md … vNN.md
    flashcards/*.json  quizzes/*.json  exercises/*.json
  updates/              # bản tin cập nhật, dùng chung mọi môn
    2026/11/2026-11-13-<slug>.md
  <môn-học-mới>/        # thêm sau này
scripts/
  build-content.ts      # validate + sinh index, search index, manifest
  new-subject.ts        # tạo khung môn học mới bằng 1 lệnh
  new-lesson.ts
docs/
  CONTENT_GUIDE.md      # quy ước viết nội dung (để mọi lần cập nhật đều thống nhất)
```

---

## 7. Cập nhật kiến thức tự động mỗi 2 ngày

Tôi sẽ tạo một **scheduled task** chạy mỗi 2 ngày (khoảng 6h sáng giờ Việt Nam). Mỗi lần chạy, một phiên Claude Code mới sẽ:

1. **Thu thập** tin mới trong 2 ngày qua từ nguồn chính thống: Angular blog & release notes / changelog,
   RFC trên GitHub angular/angular, TypeScript blog, TC39 proposals, web.dev, Chrome / Firefox / Safari release notes,
   Node.js, Vite/esbuild, NgRx, Nx, RxJS, MDN, Can I use, các báo cáo State of JS / CSS...
2. **Lọc** những gì thực sự đáng học với dev Angular (bỏ tin rác, tin quảng cáo, tin trùng).
3. **Viết bản tin** vào `content/updates/`: tóm tắt tiếng Việt, "vì sao quan trọng", ví dụ code, link nguồn gốc,
   gắn tag với topic liên quan trong app.
4. **Sinh flashcard** cho kiến thức mới → tự vào hàng đợi ôn tập của bạn.
5. **Đánh dấu bài cần cập nhật** khi có thay đổi ảnh hưởng nội dung cũ (ví dụ API bị deprecated);
   khi Angular ra bản mới thì bổ sung `whats-new/vNN.md`.
6. **Kiểm tra** (validate schema + build + test) → **push** → GitHub Actions deploy lên GitHub Pages.

Trên app:
- Mục **"Frontend mới"** trên dashboard, có badge số tin chưa đọc.
- Mỗi bài học có lịch sử cập nhật ("cập nhật ngày …: thêm phần … do Angular vNN thay đổi …").
- Nếu 2 ngày không có gì đáng kể, bản tin sẽ ghi "không có cập nhật quan trọng" thay vì viết cho có.

> Lưu ý: mỗi lần chạy sẽ dùng hạn mức sử dụng Claude của bạn. Scheduled task sẽ được tạo **sau giai đoạn 1**
> khi cấu trúc nội dung đã có, để phiên tự động ghi đúng chỗ.

---

## 8. Các giai đoạn triển khai

| Giai đoạn | Nội dung | Kết quả để bạn review |
|---|---|---|
| **1. Khung app có thể mở rộng** ✅ | Angular + Tailwind, mô hình Subject/Section/Topic, content pipeline + validate, layout, routing, render Markdown, IndexedDB, dark mode, **GitHub Actions deploy lên GitHub Pages** | App chạy trên GitHub Pages, có môn Angular với 3 phần (nội dung giả) |
| **2. Lát cắt mẫu** ✅ | Làm trọn **Signals** và **Change Detection** xuyên suốt cả 3 phần | Bạn duyệt hình thức & độ sâu |
| **3. Công cụ học + cập nhật tự động** | Flashcard SM-2, quiz, bài tập, ma trận kiến thức, tìm kiếm, dashboard, mục "Frontend mới"; **tạo scheduled task mỗi 2 ngày** | Nhận bản tin đầu tiên |
| **4. Nội dung còn lại** | Viết theo đợt, ưu tiên các khoảng trống trong CV | |
| **5. Hoàn thiện** | PWA, timeline v12 → mới nhất, tech radar, self-assessment, export/import, script `new-subject` | Sẵn sàng thêm môn học mới |

Mỗi giai đoạn sẽ commit & push để bạn xem.

## 8b. Cập nhật theo phản hồi (11/11/2026)

- ✅ **Bài tập tương tác**: `:::quiz` (trắc nghiệm, đoán output — có giải thích) và `:::exercise` (đề + lời giải ẩn), kết quả lưu IndexedDB.
- ✅ **Trang Luyện tập** cho mỗi môn: ngẫu nhiên / câu chưa làm / ôn câu đã sai, lọc theo phần & chủ đề.
- ✅ **Môn RxJS riêng** (3 phần, 12 bài, 48 câu hỏi, demo so sánh switchMap/mergeMap/concatMap/exhaustMap).
- ✅ **Angular Signals & Change Detection** đầy đủ 3 phần (19 bài, 34 câu hỏi, demo cây OnPush).
- ✅ **Đợt 1 mở rộng Angular** (ưu tiên theo khoảng trống CV): Dependency Injection, Performance, Testing, Security — mỗi chủ đề đủ 3 phần + bài tập.
- ✅ **Mở rộng Ôn lại Core**: TypeScript, Components & Templates, Directives & Pipes, Routing, Forms (kể cả Signal Forms), HttpClient, CLI.
- ✅ **Đợt 2**: Forms (CVA + FormValueControl, validator tự viết, dynamic form engine), Routing (state trên URL, lỗi hay gặp, kiến trúc route lớn), HTTP (interceptor, upload/download, cache & dedupe).
- ✅ **Đợt 3**: Kiến trúc & Micro Frontend (feature structure, facade, Nx, single-spa vs Module Federation), SSR & Hydration (mặc định v22), Accessibility & i18n, Frontend System Design (RADIO, dashboard realtime), Kỹ năng Senior (thuật ngữ tiếng Anh, code review, ADR, phỏng vấn STAR, CV).

## 9. Đã chốt & còn cần xác nhận

**Đã chốt:**
- Tiếng Việt, giữ thuật ngữ tiếng Anh
- Có ghi chú khác biệt cho v16 / v19
- Deploy GitHub Pages
- UI: Tailwind (mặc định theo đề xuất, vì bạn chưa chọn khác)
- Cập nhật kiến thức frontend mới mỗi 2 ngày
- Kiến trúc nhiều môn học

**Còn cần xác nhận:**
1. **Cách đưa bản cập nhật lên app**: (a) tự push thẳng lên `main` và deploy ngay nếu kiểm tra đạt (đề xuất cho app cá nhân), hay (b) tạo Pull Request để bạn duyệt trước?
2. **GitHub Pages với repo private** cần gói GitHub trả phí; nếu repo đang private thì để public hay đổi sang host khác (Cloudflare Pages / Netlify miễn phí cho repo private)?
3. Ngoài Angular, bạn đã nghĩ tới môn tiếp theo chưa (để tôi kiểm tra kiến trúc với trường hợp đó)?

## 10. Lộ trình lên Senior (11/11/2026)

- ✅ Trang **Lộ trình** (`/angular/roadmap`): 7 chặng cá nhân hoá theo hồ sơ — mục tiêu, thời lượng, kết quả đầu ra, bài học liên kết, bài thực hành trên dự án thật (checkbox lưu IndexedDB), cột mốc kiểm chứng.
- ✅ Tiến độ tự tính từ bài đã học + bài thực hành; thẻ "Học tiếp" trên dashboard.

## 11. TypeScript & Claude Code (11/11/2026)

- ✅ Môn **TypeScript** riêng: 25 bài, 64 câu — mọi phát biểu kiểm chứng bằng tsc 6.0.3.
- ✅ Môn **Làm việc với Claude Code**: 12 bài bám *Best practices for Claude Code* và *Extend Claude Code* (code.claude.com/docs) — kiến thức nền là chính, AI là công cụ; có case study lỗi AI bị bắt khi xây chính app này.


## 12. Claude Code từ người mới tới nâng cao (11/11/2026)

- ✅ Viết lại môn **Làm việc với Claude Code** thành giáo trình đầy đủ: 35 bài, 80 câu trắc nghiệm, bám ~45 trang tài liệu chính thức (code.claude.com/docs), mỗi bài ghi nguồn.
- ✅ Ba phần đổi tên theo trình độ: **Cơ bản (người mới)** · **Thực hành hằng ngày** · **Nâng cao**; thêm chủ đề Bắt đầu, Giao diện & lệnh, Quy trình hằng ngày, Mở rộng Claude Code.
- ✅ Lộ trình riêng `/claude-code/roadmap`: 6 chặng từ cài đặt tới tự động hoá, bao phủ mọi bài.
- ✅ Dashboard hiển thị thẻ lộ trình cho **mọi** môn có lộ trình (component `RoadmapCard`).

## 13. Claude Code: bài thực hành và tra cứu lệnh (11/11/2026)

- ✅ Phần **Bài thực hành**: 13 lab trên dự án mẫu `cc-lab` (Angular 22) — seed code, bug cài sẵn, script hook và script cổng review đều đã chạy thử; lab cuối là dự án tổng hợp có thang tự chấm 20 điểm.
- ✅ Phần **Tra cứu lệnh**: 9 bài giải thích mọi slash command, lệnh `claude` trên shell, flag dòng lệnh và phím tắt (đối chiếu đủ với trang Commands và CLI reference).
- ✅ Mọi bài Claude Code có ít nhất một bài tập thực hành cụ thể; lộ trình 6 chặng gắn lab và bài tra cứu tương ứng (57 bài).
- ✅ Sửa lỗi hiển thị: khối code ```text có chữ quá nhạt trên nền sáng.

## 14. Claude Code: lấp đầy ma trận và mở rộng bài cũ (12/11/2026)

- ✅ 16 bài mới, không còn ô trống ở ba phần chính: dữ liệu & quyền riêng tư, tuỳ biến môi trường, Claude in Chrome, bên trong Claude Code (prompt caching), sáu mẫu prompt, prompt cho việc dài, monorepo, review & bảo mật quy mô team, kiểm chứng cơ bản và hệ thống, bản đồ mở rộng, skill/plugin có sẵn, tạo plugin (đã `claude plugin validate`), ba mức tự động hoá, agent view, Agent SDK (đã type-check).
- ✅ Mở rộng 8 bài cũ (ví dụ Angular, bảng chọn nhanh, managed settings mẫu, onboarding, câu hỏi phỏng vấn); sửa hai chỗ chưa chính xác về deny Read với lệnh Bash và checkpoint với file đổi qua Bash.
- ✅ Lộ trình 7 chặng, phủ đủ 73 bài.

## 15. Claude Code: hoàn thiện theo đợt rà soát (12/11/2026)

- ✅ Đợt 1 (ưu tiên cao): mạng doanh nghiệp + dev container, cấu hình auto mode, hook JSON/prompt/agent/http (máy chủ hook mẫu đã chạy thử), tra cứu biến môi trường, cloud environment.
- ✅ Đợt 2: mọi bài ở ba phần chính có TL;DR, câu hỏi phỏng vấn (Cơ bản/Thực hành) và góc nhìn senior (Thực hành/Nâng cao); mỗi lab có 3 câu trắc nghiệm.
- ✅ Đợt 3: agent teams, dynamic workflows, nhắn tin giữa phiên, channels.
- ✅ Đợt 4: artifacts, Projects, desktop app, OpenTelemetry/analytics; phiên cập nhật tự động đọc hướng dẫn mới trong CONTENT_GUIDE mục 5 để theo dõi changelog Claude Code (code.claude.com nằm trong allowlist mặc định của cloud environment).
- ✅ Sửa: auto mode mặc định cho push lên mọi nhánh của repo hiện tại; khối `env` trong settings ghi đè biến của shell.
- ✅ Lộ trình 7 chặng phủ đủ 80 bài; 183 câu trắc nghiệm.

## 16. Lab 14 — workflow nhiều agent

- ✅ Lab 14: chuỗi subagent (explorer → implementer → reviewer) do phiên chính điều phối, ba subagent điều tra song song một bug cài sẵn, agent team chia file và task list có phụ thuộc, bảng chọn cơ chế; hook `TaskCompleted` làm thử thách mở rộng. Ghi hướng dẫn tự chạy (không chạy thật trong môi trường biên soạn). Lộ trình phủ 81 bài.
