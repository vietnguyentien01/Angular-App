---
title: input(), output(), model() — giao tiếp component kiểu mới
summary: Signal inputs, output function và two-way binding bằng model(), so sánh với @Input/@Output.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [signals, input, output, model]
related: [angular/review/signals/signal-computed-effect]
---

## TL;DR

| API | Thay cho | Đặc điểm |
|---|---|---|
| `input<T>()` / `input.required<T>()` | `@Input()` | Trả về `InputSignal` — **chỉ đọc** trong component, dùng được trong `computed` |
| `output<T>()` | `@Output() + EventEmitter` | `.emit(value)`, không phải Observable |
| `model<T>()` | `@Input() x` + `@Output() xChange` | Signal **ghi được**, hỗ trợ `[(x)]` |

```ts title="rating.ts"
@Component({
  selector: 'app-rating',
  template: `
    @for (star of stars(); track star) {
      <button type="button" (click)="value.set(star)" [attr.aria-pressed]="star <= value()">★</button>
    }
  `,
})
export class Rating {
  readonly max = input(5);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly value = model(0); // two-way
  readonly changed = output<number>();

  protected readonly stars = computed(() => Array.from({ length: this.max() }, (_, i) => i + 1));
}
```

```html title="Dùng"
<app-rating [(value)]="score" disabled />
```

:::tip transform
`booleanAttribute` cho phép viết `<app-rating disabled />` thay vì `[disabled]="true"`. Tương tự có `numberAttribute`.
:::

:::version v16 Ở Angular 16 / 19
v16 chỉ có `@Input()` / `@Output()`. `input()`, `output()`, `model()` xuất hiện từ v17.1–v17.2 và ổn định ở v19. Khi đọc code v16, logic phản ứng theo input thường nằm trong `ngOnChanges` hoặc setter; với signal input, thay bằng `computed` / `effect`.
:::

:::quiz Trong component, gọi `this.max.set(10)` với `max = input(5)` thì sao?
- [ ] Cập nhật thành 10
- [x] Lỗi TypeScript — `InputSignal` không có `set`, input chỉ do parent quyết định
- [ ] Cập nhật nhưng parent không biết
- [ ] Chạy nhưng bị bỏ qua

Signal input chỉ đọc. Nếu cần giá trị ghi được dựa trên input, dùng `linkedSignal(() => this.max())` hoặc `model()`.
:::

:::quiz `[(value)]="score"` hoạt động với `model()` khi `score` là gì?
- [ ] Chỉ khi `score` là signal
- [ ] Chỉ khi `score` là field thường
- [x] Cả hai: field thường hoặc `WritableSignal`
- [ ] Chỉ khi dùng FormsModule

Two-way binding với `model()` chấp nhận cả property thường lẫn writable signal của parent.
:::

:::quiz `output()` trả về gì?
- [ ] `EventEmitter`
- [ ] `Observable`
- [x] `OutputEmitterRef` — có `.emit()`, parent lắng nghe bằng `(changed)="..."`
- [ ] `Subject`

Muốn chuyển sang Observable thì dùng `outputToObservable()`; muốn tạo output từ Observable thì dùng `outputFromObservable()` (trong `@angular/core/rxjs-interop`).
:::
