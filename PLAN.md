# Kế hoạch: Angular Mastery — App kiến thức Angular từ Middle lên Senior

> Ứng dụng cá nhân (chạy local / offline), chia làm **3 phần**:
> **Ôn lại Core** → **Củng cố** → **Chuyên sâu & Cập nhật**.

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

## 6. Cấu trúc dự án

```
src/app/
  core/              # services: progress, notes, search, storage, theme, srs
  layout/            # shell, sidebar (3 phần), header, command palette
  features/
    dashboard/
    review/          # PHẦN 1: thẻ kiến thức, cheat sheet, flashcard, quick quiz
    consolidate/     # PHẦN 2: bài học, bài tập đoán output / tìm bug / refactor
    deep-dive/       # PHẦN 3: internals, what's new, timeline, migration, senior skills
    knowledge-matrix/
    notes/
  demos/             # demo tương tác
  shared/
content/
  review/<topic>/*.md
  consolidate/<topic>/*.md
  deep-dive/<topic>/*.md
  whats-new/v12.md ... vNN.md
  flashcards/*.json
  quizzes/*.json
  exercises/*.json
```

## 7. Các giai đoạn triển khai

| Giai đoạn | Nội dung | Kết quả để bạn review |
|---|---|---|
| **1. Khung app** | Angular + Tailwind, layout 3 phần, routing, render Markdown, lưu tiến độ, dark mode | App chạy được, điều hướng giữa 3 phần |
| **2. Lát cắt mẫu** | Làm trọn **2 chủ đề xuyên suốt cả 3 phần**: **Signals** và **Change Detection** (thẻ ôn + flashcard / bài củng cố + bài tập / bài chuyên sâu + what's new) | Bạn duyệt hình thức & độ sâu của từng phần |
| **3. Công cụ học** | Flashcard SM-2, quiz, bài tập đoán output/tìm bug, ma trận kiến thức, tìm kiếm, dashboard | |
| **4. Nội dung còn lại** | Viết theo đợt, ưu tiên các khoảng trống trong CV | |
| **5. Hoàn thiện** | PWA, timeline v12 → mới nhất, tech radar, self-assessment, export/import | |

Mỗi giai đoạn sẽ commit & push lên nhánh để bạn xem.

## 8. Câu hỏi cần bạn xác nhận

1. **Ngôn ngữ**: tiếng Việt, giữ thuật ngữ tiếng Anh (đề xuất)?
2. **Ghi chú phiên bản cũ** (v16/v19) trong bài học — có cần không?
3. **UI**: Tailwind (đề xuất) hay SCSS / Angular Material?
4. **Triển khai**: chỉ local, hay GitHub Pages để học trên điện thoại?
