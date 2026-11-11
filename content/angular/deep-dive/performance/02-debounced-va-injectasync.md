---
title: "Mới ở Angular 22: debounced() và injectAsync()"
summary: Debounce signal không cần RxJS (thử nghiệm) và lazy-load service nặng có prefetch — hai API mới hữu ích cho hiệu năng.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [whats-new, angular-22, debounced, injectAsync]
related: [angular/deep-dive/dependency-injection/di-cho-kien-truc, rxjs/consolidate/angular/tosignal-toobservable]
---

## `debounced()` — thử nghiệm (experimental) từ 22.0

Trước đây muốn debounce một signal phải đi vòng qua RxJS: `toObservable` → `debounceTime` → `toSignal`. Angular 22 thêm:

```ts
// Chữ ký trong @angular/core 22:
// debounced<T>(source: () => T, wait: number | ((value, lastValue) => Promise<void> | void), options?): Resource<T>
readonly query = signal('');
readonly debouncedQuery = debounced(this.query, 300);

readonly results = httpResource<Item[]>(() => {
  const q = this.debouncedQuery.value();
  return q && q.length >= 2 ? { url: '/api/search', params: { q } } : undefined;
});
```

Điểm cần nhớ:

- Kết quả là một **`Resource`** (có `value()`, `status()`, `isLoading()`), không phải signal thường.
- `wait` có thể là số mili-giây hoặc một hàm trả Promise — cho phép debounce có điều kiện.
- API được đánh dấu **experimental**: có thể đổi ở bản sau, cân nhắc trước khi dùng rộng trong dự án enterprise.

## `injectAsync()` — lazy-load service

```ts
private readonly exporter = injectAsync(
  () => import('./excel-export.service').then((m) => m.ExcelExportService),
  { prefetch: onIdle },
);

async export() {
  (await this.exporter()).exportTable(this.rows());
}
```

- Service phải tự đăng ký (`@Service()` hoặc `providedIn: 'root'`).
- `prefetch: onIdle` tải chunk khi trình duyệt rảnh — người dùng bấm nút là có ngay.

:::quiz `debounced(this.query, 300)` trả về gì?
- [ ] `Signal<string>`
- [x] `Resource<string>` — đọc bằng `.value()`
- [ ] `Observable<string>`
- [ ] `Promise<string>`

Vì debounce là bất đồng bộ, Angular mô hình hoá nó như một resource có trạng thái.
:::

:::quiz Khi nào vẫn nên dùng RxJS thay vì `debounced()`?
- [ ] Không bao giờ
- [x] Khi cần kết hợp debounce với các operator khác như `distinctUntilChanged`, `switchMap`, retry, hoặc khi cần API đã ổn định
- [ ] Khi dùng signals
- [ ] Khi debounce dưới 100ms

`debounced` giải quyết case đơn giản. Pipeline phức tạp vẫn là thế mạnh của RxJS.
:::
