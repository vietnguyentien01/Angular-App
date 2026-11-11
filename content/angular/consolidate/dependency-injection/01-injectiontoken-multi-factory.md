---
title: InjectionToken, multi provider và factory — pattern cho code cấu hình được
summary: Cấu hình qua token có giá trị mặc định, plugin bằng multi provider, và factory phụ thuộc môi trường — nền tảng cho form engine hay design system.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [di, injectiontoken, multi, factory, pattern]
related: [angular/review/dependency-injection/inject-va-providers, angular/deep-dive/dependency-injection/di-cho-kien-truc]
---

## TL;DR

- `InjectionToken<T>` cho thứ **không phải class** (config, function, interface).
- Token có `factory` → có **giá trị mặc định**, không cần ai provide.
- `multi: true` → nhiều provider cho cùng token, `inject` nhận **mảng** — nền tảng cho plugin.

## Config có giá trị mặc định

```ts title="date-format.token.ts"
export interface DateFormatConfig {
  format: string;
  timezone: string;
}

export const DATE_FORMAT = new InjectionToken<DateFormatConfig>('DATE_FORMAT', {
  factory: () => ({ format: 'dd/MM/yyyy', timezone: 'Asia/Ho_Chi_Minh' }),
});

// Ghi đè cho một khu vực của app
providers: [{ provide: DATE_FORMAT, useValue: { format: 'yyyy-MM-dd', timezone: 'UTC' } }];
```

## Plugin bằng multi provider — ví dụ form engine

```ts title="field-renderer.ts"
export interface FieldRenderer {
  type: string; // 'text' | 'date' | 'select' | …
  component: Type<unknown>;
}

export const FIELD_RENDERERS = new InjectionToken<FieldRenderer[]>('FIELD_RENDERERS');

export function provideFieldRenderer(r: FieldRenderer) {
  return { provide: FIELD_RENDERERS, useValue: r, multi: true };
}

// app.config.ts — mỗi team đăng ký renderer của mình, không sửa code lõi
providers: [
  provideFieldRenderer({ type: 'text', component: TextField }),
  provideFieldRenderer({ type: 'money', component: MoneyField }),
];

// trong engine
private readonly renderers = new Map(inject(FIELD_RENDERERS).map((r) => [r.type, r.component]));
```

:::senior Góc nhìn Senior
Với một low-code / dynamic form engine (render form từ JSON Schema), multi provider giúp engine **mở cho mở rộng, đóng cho sửa đổi**: thêm loại field mới = thêm một provider, không đụng vào `switch(type)` khổng lồ. Đây là câu trả lời tốt khi phỏng vấn được hỏi "thiết kế form builder mở rộng được thế nào".
:::

:::quiz `inject(FIELD_RENDERERS)` khi KHÔNG có provider nào được đăng ký (token không có factory) sẽ?
- [ ] Trả `[]`
- [x] Lỗi `No provider` — cần `{ optional: true }` hoặc khai báo factory trả `[]`
- [ ] Trả `undefined`
- [ ] Trả mảng một phần tử `null`

Multi provider chỉ gom những gì đã đăng ký. Không có gì → không có provider. Có thể dùng `inject(FIELD_RENDERERS, { optional: true }) ?? []`.
:::

:::quiz Quên `multi: true` ở một trong ba provider cho cùng token. Kết quả?
- [ ] Vẫn ra mảng 3 phần tử
- [x] Lỗi khi khởi tạo vì trộn provider multi và không multi cho cùng token
- [ ] Chỉ provider cuối được dùng, không báo lỗi
- [ ] Mảng 2 phần tử

Angular ném lỗi *"Cannot mix multi providers and regular providers"* khi một token có cả provider multi và non-multi — giúp phát hiện sớm.
:::

:::quiz Vì sao nên bọc provider trong hàm `provideFieldRenderer()` thay vì để người dùng tự viết object?
- [ ] Vì Angular bắt buộc
- [x] Ẩn chi tiết (token, `multi: true`), có type rõ ràng và dễ thay đổi cài đặt bên trong mà không phá code người dùng
- [ ] Để tăng tốc độ
- [ ] Để tránh tree-shaking

Đây là cùng pattern với `provideRouter()`, `provideHttpClient()` của chính Angular.
:::

:::exercise Factory phụ thuộc nền tảng
Tạo token `APP_STORAGE` kiểu `Storage`-like (`getItem`, `setItem`). Mặc định dùng `localStorage` trên trình duyệt, còn khi chạy SSR (không có `window`) dùng bản lưu trong bộ nhớ.
???
```ts
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => void this.map.set(k, v);
}

export const APP_STORAGE = new InjectionToken<KeyValueStore>('APP_STORAGE', {
  factory: () => (isPlatformBrowser(inject(PLATFORM_ID)) ? localStorage : new MemoryStore()),
});
```
`factory` của token chạy trong injection context nên được phép `inject(PLATFORM_ID)`. Trong test, chỉ cần `{ provide: APP_STORAGE, useValue: new MemoryStore() }`.
:::
