# Kế hoạch: Angular Mastery — App kiến thức Angular từ Middle lên Senior

> Một ứng dụng cá nhân (chạy local / offline), tổng hợp kiến thức Angular theo lộ trình,
> có ví dụ chạy được ngay trong app, quiz, flashcard và theo dõi tiến độ.

---

## 1. Mục tiêu

- Hệ thống hoá **toàn bộ** kiến thức cần thiết để một Angular developer middle lên senior.
- Mỗi chủ đề không chỉ trả lời "dùng thế nào" mà cả **"tại sao"**, **"bên dưới chạy ra sao"**, **"khi nào không nên dùng"**.
- Học chủ động: demo tương tác, bài tập, quiz, flashcard ôn tập ngắt quãng.
- Chỉ dùng cá nhân → **không backend, không đăng nhập**, dữ liệu lưu trong trình duyệt.

## 2. Công nghệ

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Framework | Angular bản mới nhất, **standalone**, **zoneless**, **signals** | App tự nó là ví dụ về Angular hiện đại |
| Style | SCSS + CSS variables (light/dark), có thể thêm Angular Material/CDK | Nhẹ, tự kiểm soát |
| Nội dung | File **Markdown** (`content/**/*.md`) + front-matter, render bằng `ngx-markdown` + highlight code (Shiki/Prism) | Viết/sửa nội dung dễ, tách khỏi code |
| Demo tương tác | Component Angular thật nhúng vào bài học | Thấy tận mắt change detection, signals, RxJS... |
| Tìm kiếm | MiniSearch (full-text phía client) | Không cần server |
| Lưu trữ | IndexedDB / localStorage (tiến độ, ghi chú, bookmark, lịch ôn flashcard) | Offline, riêng tư |
| Offline | PWA (`@angular/service-worker`) | Mở như app trên máy/điện thoại |
| Test | Vitest/Jest cho unit, Playwright cho e2e cơ bản | |
| Deploy (tuỳ chọn) | Chạy local `ng serve`, hoặc GitHub Pages | |

## 3. Tính năng

1. **Lộ trình (Roadmap)** — sơ đồ các module, trạng thái chưa học / đang học / đã xong.
2. **Trang bài học** — mỗi bài có cấu trúc cố định:
   - Tóm tắt 30 giây (TL;DR)
   - Khái niệm & cơ chế bên dưới (kèm sơ đồ)
   - Code ví dụ (tốt vs xấu)
   - Demo tương tác (nếu phù hợp)
   - Pitfalls / lỗi thường gặp
   - Best practices & góc nhìn senior (trade-off, khi nào không dùng)
   - Câu hỏi phỏng vấn kèm đáp án
   - Bài tập thực hành
   - Checklist "đã hiểu"
   - Tài liệu tham khảo
3. **Quiz** theo module (trắc nghiệm + đọc code đoán output), lưu điểm.
4. **Flashcard** với ôn tập ngắt quãng (thuật toán SM-2).
5. **Ghi chú cá nhân & bookmark** trên từng bài.
6. **Tìm kiếm toàn văn** (Ctrl+K).
7. **Dashboard tiến độ**: % hoàn thành theo module, streak học, thẻ cần ôn hôm nay.
8. **Cheat sheets**: tổng hợp nhanh RxJS operators, lifecycle hooks, DI providers, CLI...
9. **Senior self-assessment**: bảng tự đánh giá năng lực theo từng mảng.
10. Dark mode, responsive (học trên điện thoại), export/import dữ liệu cá nhân (JSON).

## 4. Nội dung chi tiết (Curriculum)

### Phần A — Nền tảng vững chắc
1. **TypeScript nâng cao**: generics, conditional/mapped/template literal types, `infer`, type guards, `satisfies`, utility types, decorators, strict mode, viết type cho thư viện.
2. **JavaScript & Browser cho senior**: event loop (macro/microtask), closures, prototype, memory & GC, rendering pipeline (layout/paint/composite), Web Workers, Web APIs.
3. **Kiến trúc Angular**: bootstrap app, standalone vs NgModule, compiler (Ivy, AOT, JIT), template → instructions, `ApplicationRef`, application config.

### Phần B — Angular Core chuyên sâu
4. **Components nâng cao**: lifecycle chi tiết, content projection (`ng-content`, select, `ngProjectAs`), `ng-template`/`ngTemplateOutlet`, view/content queries (signal queries), dynamic components (`ViewContainerRef`, `createComponent`), host bindings, host directives, ViewEncapsulation, control flow (`@if`, `@for`, `@switch`, `@let`).
5. **Directives & Pipes**: attribute/structural directive tự viết, microsyntax, pure vs impure pipe, hiệu năng pipe.
6. **Dependency Injection chuyên sâu**: hierarchical injectors (Environment vs Element), resolution rules, `inject()`, `providedIn`, `useClass/useValue/useFactory/useExisting`, `InjectionToken`, multi providers, modifiers (`optional`, `self`, `skipSelf`, `host`), `viewProviders`, injection context, `runInInjectionContext`, pattern plugin/strategy với DI.
7. **Change Detection**: Zone.js hoạt động ra sao, cây CD, Default vs OnPush, `markForCheck`/`detectChanges`, `ExpressionChangedAfterItHasBeenChecked`, **zoneless**, migration sang zoneless. *(Demo: highlight component được check)*
8. **Signals**: `signal`, `computed`, `effect`, `linkedSignal`, `untracked`, reactive graph (producer/consumer, glitch-free), signal inputs/`model()`/`output()`, `resource`/`httpResource`, signals vs RxJS — khi nào dùng gì, interop `toSignal`/`toObservable`.

### Phần C — Reactive & Dữ liệu
9. **RxJS chuyên sâu**: Observable từ con số 0 (tự viết), hot vs cold, Subjects, higher-order mapping (`switchMap`/`mergeMap`/`concatMap`/`exhaustMap` — chọn đúng), combination operators, error handling & retry, multicasting (`share`, `shareReplay` và bẫy của nó), schedulers, memory leak & `takeUntilDestroyed`, marble diagrams, custom operators. *(Demo: marble visualizer)*
10. **HTTP**: `HttpClient`, functional interceptors (auth, retry, cache, loading, error), `HttpContext`, cancel request, upload/download progress, caching strategies, transfer state.
11. **Forms**: typed reactive forms, `FormArray`/dynamic forms, custom & async validators, cross-field validation, `ControlValueAccessor` (tự viết input component), signal forms, hiệu năng form lớn, UX validation.
12. **Routing**: lazy loading (`loadComponent`/`loadChildren`), functional guards & resolvers, `withComponentInputBinding`, preloading strategies, nested/named outlets, route reuse strategy, view transitions, xử lý lỗi điều hướng.
13. **State Management**: service + signals, NgRx Store (actions/reducers/effects/selectors), NgRx SignalStore, entity, so sánh & tiêu chí chọn, server state vs client state, normalize state, anti-patterns.

### Phần D — Chất lượng & Hiệu năng
14. **Performance**: đo trước khi tối ưu (DevTools, Angular DevTools profiler, Web Vitals), OnPush/zoneless, `@for track`, `@defer` (triggers, prefetch), virtual scroll (CDK), `NgOptimizedImage`, bundle budget & phân tích bundle, tree-shaking, lazy loading, memory leak detection.
15. **SSR, Hydration & SSG**: `@angular/ssr`, full/incremental hydration, event replay, prerender, `isPlatformBrowser`, hydration mismatch, SEO.
16. **Testing**: chiến lược testing pyramid, TestBed, test component/service/directive/pipe, Component Harness (CDK), `HttpTestingController`, test signals & effects, marble testing, mocking DI, Playwright e2e, test coverage có ý nghĩa.
17. **Security**: XSS & sanitization, `DomSanitizer` (và nguy hiểm của `bypassSecurityTrust*`), CSP, Trusted Types, CSRF/XSRF, auth (JWT, refresh token, OIDC/PKCE), lưu token ở đâu.
18. **Accessibility (a11y)**: ARIA, focus management, CDK a11y (`FocusTrap`, `LiveAnnouncer`), keyboard navigation, kiểm tra với axe.
19. **i18n**: `$localize`, Angular i18n vs Transloco/ngx-translate, định dạng ngày/số, RTL.

### Phần E — Kiến trúc & Hệ sinh thái
20. **Kiến trúc ứng dụng lớn**: cấu trúc thư mục theo feature/domain, smart vs presentational, facade pattern, layered architecture, public API & ranh giới module, enforce boundaries (ESLint/Nx).
21. **Monorepo & Micro Frontends**: Nx (libs, affected, caching), Module Federation / Native Federation, chia sẻ dependencies, khi nào *không* nên dùng micro frontends.
22. **Design system & thư viện**: Angular CDK (Overlay, Portal, DragDrop), xây component library, `ng-packagr`, theming, Storybook.
23. **Tooling & Build**: Angular CLI, builder esbuild/Vite, environment config, schematics & generators tự viết, ESLint/Prettier, `ng update` & migration, CI/CD pipeline.
24. **Migration thực tế**: NgModule → standalone, Zone → zoneless, `*ngIf` → control flow, `@Input` → signal inputs, nâng cấp nhiều major version.

### Phần F — Kỹ năng Senior (ngoài code)
25. **Frontend System Design**: cách tiếp cận bài system design (requirements → architecture → data model → API → performance → a11y), case study: dashboard realtime, news feed, form builder, autocomplete.
26. **Kỹ năng lãnh đạo kỹ thuật**: code review hiệu quả, viết technical design doc/ADR, ước lượng, quản lý technical debt, mentoring, giao tiếp với PM/BE.
27. **Phỏng vấn Senior**: bộ câu hỏi theo chủ đề (kèm đáp án mẫu), câu hỏi hành vi (STAR), live coding thường gặp.

> Ước tính: ~27 module, ~150–200 bài học, ~500+ câu quiz/flashcard.

## 5. Cấu trúc dự án

```
src/
  app/
    core/            # services: progress, notes, search, storage, theme, srs
    layout/          # shell, sidebar, header, command palette (Ctrl+K)
    features/
      dashboard/
      roadmap/
      lesson/        # render markdown + demo slots
      quiz/
      flashcards/
      cheatsheets/
      notes/
    demos/           # các demo tương tác (change-detection, signals-graph, rxjs-marbles...)
    shared/          # UI components, pipes, directives
content/
  01-typescript/
    _module.json     # metadata module
    01-generics.md
    ...
  quizzes/*.json
  flashcards/*.json
scripts/
  build-content-index.ts   # build index tìm kiếm + mục lục lúc build
```

## 6. Các giai đoạn triển khai

| Giai đoạn | Nội dung | Kết quả để bạn review |
|---|---|---|
| **1. Khung app** | Khởi tạo Angular, layout, routing, hệ thống render Markdown, lưu tiến độ, dark mode | App chạy được, điều hướng giữa các bài |
| **2. Nội dung mẫu** | Viết đầy đủ 3 module mẫu: **Change Detection**, **Signals**, **RxJS** (kèm demo) | Bạn duyệt độ sâu & văn phong trước khi viết tiếp |
| **3. Học chủ động** | Quiz, flashcard SM-2, ghi chú, bookmark, tìm kiếm, dashboard | |
| **4. Nội dung còn lại** | Viết các module còn lại theo từng đợt (mỗi đợt 4–5 module) | |
| **5. Hoàn thiện** | PWA offline, cheat sheets, export/import, self-assessment, test | |

Mỗi giai đoạn sẽ commit & push lên nhánh để bạn xem.

## 7. Cá nhân hoá theo hồ sơ (CV)

### Điểm mạnh hiện có → học nhanh / đào sâu "tại sao"
- 4+ năm Angular, đi qua v12 → v21 (standalone, Signals, OnPush) → module **Migration** trở thành thế mạnh, đóng gói thành case study.
- **Micro Frontend (single-spa)**, shared components dùng chung giữa nhiều MFE.
- **Dynamic forms (JSON Schema, Form.io, JSONLogic)**, BPMN/Flowable, low-code platform.
- **RxJS**, TanStack Query, Playwright, Excel import/export, chuyển đổi hệ thống legacy.
- Làm việc trong team lớn (20–50 người), domain Chính phủ / Y tế / Ngân hàng / Bảo hiểm.

### Khoảng trống so với Senior → ưu tiên cao
| Mảng | Vì sao quan trọng với bạn |
|---|---|
| **Change Detection nội tại & Zoneless** | Angular 21 mặc định zoneless; senior phải giải thích được cơ chế, không chỉ dùng OnPush |
| **Performance có đo lường** | CV mới ghi "tham gia tối ưu"; senior cần profiling, số liệu trước/sau (bảng lớn, Excel import, form hàng trăm field) |
| **DI chuyên sâu & thiết kế API cho thư viện** | Nền tảng để xây form engine / component library cấu hình được |
| **Security** | Domain chính phủ, ngân hàng, y tế: XSS, CSP, Trusted Types, OIDC/PKCE, lưu token |
| **Testing strategy** | Từ "viết test" → thiết kế chiến lược test, Component Harness, test signals/effects |
| **Kỹ năng Senior** | Code review, ADR / technical design doc, mentoring, ước lượng, dẫn dắt kỹ thuật |
| **Frontend System Design** | Vòng phỏng vấn senior gần như luôn có |

### Ưu tiên trung bình
- State management: NgRx Store / SignalStore, so sánh với TanStack Query & `resource()` (server state vs client state).
- Monorepo Nx, **Module Federation / Native Federation so với single-spa** (bạn đã có trải nghiệm thực tế để so sánh).
- Design system & thư viện: CDK, `ng-packagr`, versioning, theming (từ kinh nghiệm shared components).
- Accessibility (WCAG) — cổng dịch vụ công cần chuẩn này.
- SSR / Hydration (ít gặp ở app nội bộ, nhưng hay bị hỏi phỏng vấn).
- Tooling & CI/CD, schematics/generators.

### Học ít hơn (đã vững)
- Control flow cơ bản, Reactive Forms cơ bản, gọi REST API, UI libraries (NG-ZORRO, Material, PrimeNG).

### Case study gắn với dự án thật của bạn
1. Thiết kế **dynamic form engine từ JSON Schema** (kiến trúc, hiệu năng, signal forms, validation bằng JSONLogic).
2. **Auto-save draft** an toàn (RxJS debounce, hủy request cũ, xung đột phiên bản, offline).
3. **Import Excel lớn** không đơ UI (Web Worker, virtual scroll, chunking).
4. **Shared component library cho micro frontends** (versioning, singleton dependencies, theming).
5. **Migration legacy → Angular 21** đảm bảo "kết quả giống hệt" (characterization tests, chạy song song).

### Thêm cho phát triển nghề nghiệp
- **Bảng thuật ngữ Anh–Việt** và mẫu câu tiếng Anh dùng trong code review / phỏng vấn.
- Hướng dẫn viết lại CV theo kiểu senior: thêm **số liệu tác động** (giảm X% thời gian load, giảm Y% bug...).

### Điều chỉnh giai đoạn 2 (module mẫu)
Thay RxJS (đã mạnh) bằng mảng còn thiếu: **Change Detection & Zoneless**, **Signals chuyên sâu (kèm signal forms, resource)**, **Performance**.

## 8. Câu hỏi cần bạn xác nhận

1. **Ngôn ngữ nội dung**: tiếng Việt, giữ thuật ngữ kỹ thuật tiếng Anh (đề xuất) — hay song ngữ?
2. **Phiên bản Angular**: bám theo bản mới nhất (đề xuất), có cần ghi chú khác biệt cho bản cũ (v14–v16) mà dự án công ty bạn đang dùng không?
3. **UI**: tự thiết kế nhẹ bằng SCSS (đề xuất) hay dùng Angular Material?
4. **Triển khai**: chỉ chạy local, hay deploy GitHub Pages để học trên điện thoại?
5. Có chủ đề nào bạn muốn **ưu tiên** hoặc **bỏ bớt** không?
