---
title: DI cho kiến trúc — provideX(), injection context và injectAsync
summary: Thiết kế API cấu hình cho thư viện nội bộ, chạy code cần inject ngoài constructor, và lazy-load service nặng bằng injectAsync (mới ở v22).
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [di, architecture, library, injectAsync]
related: [angular/consolidate/dependency-injection/injectiontoken-multi-factory]
---

## 1. API `provideX()` cho thư viện nội bộ

```ts title="libs/audit/provide-audit.ts"
export interface AuditOptions {
  endpoint: string;
  batchSize?: number;
}

export function provideAudit(options: AuditOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AUDIT_OPTIONS, useValue: { batchSize: 20, ...options } },
    provideAppInitializer(() => inject(AuditService).start()),
  ]);
}

// app.config.ts
providers: [provideAudit({ endpoint: '/api/audit' })];
```

`makeEnvironmentProviders` trả về kiểu `EnvironmentProviders` — **không** thể đặt nhầm vào `providers` của component (lỗi biên dịch). Đây là cách Angular tự bảo vệ API như `provideRouter`.

## 2. Injection context ngoài constructor

```ts
export class ReportPage {
  private readonly injector = inject(Injector);

  openExport() {
    // Cần inject trong lúc chạy (không phải lúc khởi tạo)
    runInInjectionContext(this.injector, () => {
      const exporter = inject(ExportService);
      exporter.run();
    });
  }
}
```

Đây cũng là cách viết helper "giống hook": hàm gọi `inject()` bên trong và chỉ được dùng ở field initializer.

```ts
export function injectQueryParam(name: string) {
  return toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((p) => p.get(name))));
}
// dùng: readonly tab = injectQueryParam('tab');
```

## 3. `injectAsync` — lazy-load service nặng (mới ở Angular 22)

Service xuất PDF/Excel kéo theo thư viện lớn nhưng chỉ dùng khi bấm nút:

```ts title="report-toolbar.ts"
export class ReportToolbar {
  private readonly pdf = injectAsync(() => import('./pdf-export.service').then((m) => m.PdfExportService), {
    prefetch: onIdle, // tải trước khi trình duyệt rảnh
  });

  async exportPdf() {
    (await this.pdf()).export(this.report());
  }
}
```

Điều kiện: service được lazy-load phải **tự đăng ký** (`@Service()` hoặc `providedIn: 'root'`).

:::senior Góc nhìn Senior
DI tốt là thứ giúp team lớn **không giẫm chân nhau**: thư viện chỉ lộ ra `provideX(options)` và vài token; phần cài đặt bên trong đổi thoải mái. Khi review, cảnh giác với service gọi `inject()` ở khắp nơi một cách ẩn (service locator) — dependency nên rõ ràng ở field của class.
:::

:::quiz Vì sao `provideAudit` trả về `EnvironmentProviders` thay vì `Provider[]`?
- [ ] Để chạy nhanh hơn
- [x] Để TypeScript chặn việc đặt nó vào `providers` của component — nó chỉ hợp lệ ở app/route
- [ ] Vì `Provider[]` không hỗ trợ `useValue`
- [ ] Không có lý do

`provideAppInitializer` và các cấu hình toàn app chỉ có nghĩa ở environment injector.
:::

:::quiz `injectAsync(loader)` trả về gì?
- [ ] Instance service ngay lập tức
- [ ] Một Observable
- [x] Một hàm trả về `Promise` của instance service
- [ ] Một signal

Gọi `await this.pdf()` để lấy instance; chunk JS chỉ được tải khi cần (hoặc sớm hơn nếu có `prefetch`).
:::

:::exercise Viết `injectDebugLog(tag)`
Viết helper dùng ở field initializer, trả về hàm `log(msg)` chỉ in ra console khi **dev mode**, và tự in `[tag] destroyed` khi component bị huỷ.
???
```ts
export function injectDebugLog(tag: string) {
  const enabled = isDevMode();
  inject(DestroyRef).onDestroy(() => enabled && console.debug(`[${tag}] destroyed`));
  return (msg: string) => enabled && console.debug(`[${tag}] ${msg}`);
}

export class OrderPage {
  private readonly log = injectDebugLog('OrderPage');
}
```
`inject(DestroyRef)` ở đây là DestroyRef của component đang được tạo — vì helper chạy trong injection context của nó.
:::
