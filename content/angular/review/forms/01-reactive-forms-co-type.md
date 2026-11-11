---
title: Reactive Forms có type và validator
summary: FormGroup/FormControl có kiểu, nonNullable, Validators có sẵn, hiển thị lỗi, và khi nào dùng template-driven.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [forms, reactive-forms, validation]
related: [angular/review/forms/signal-forms-co-ban]
---

## Form có type

```ts title="register.ts"
export class Register {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    age: [18, [Validators.min(18)]],
    agree: [false, Validators.requiredTrue],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue(); // { fullName: string; email: string; age: number; agree: boolean }
  }
}
```

```html
<form [formGroup]="form" (ngSubmit)="submit()">
  <input formControlName="email" />
  @if (form.controls.email.touched && form.controls.email.hasError('email')) {
    <p class="error">Email không hợp lệ</p>
  }
</form>
```

| Validator | Ý nghĩa |
|---|---|
| `required` / `requiredTrue` | Bắt buộc / checkbox phải tích |
| `min` / `max` | Số |
| `minLength` / `maxLength` | Độ dài chuỗi/mảng |
| `email`, `pattern(regex)` | Định dạng |

## Reactive hay template-driven?

- **Reactive**: logic trong class, test dễ, form động/phức tạp → mặc định cho dự án enterprise.
- **Template-driven** (`ngModel`): form nhỏ, đơn giản.
- **Signal Forms** (ổn định từ v22): hướng mới cho form dựa trên signal — xem thẻ tiếp theo.

:::quiz `this.fb.group({...})` với `NonNullableFormBuilder` — gọi `form.reset()` thì giá trị về đâu?
- [ ] `null` cho mọi field
- [x] Giá trị khởi tạo ban đầu (vd `''`, `18`, `false`)
- [ ] Không đổi
- [ ] Lỗi

Với control non-nullable, `reset()` trả về giá trị ban đầu thay vì `null` — và kiểu không có `| null`.
:::

:::quiz `form.value` khác `form.getRawValue()` thế nào?
- [ ] Không khác
- [x] `value` bỏ qua các control đang `disabled`; `getRawValue()` lấy cả control disabled
- [ ] `value` là Observable
- [ ] `getRawValue()` bỏ qua validator

Nhiều bug "thiếu trường khi submit" đến từ việc dùng `value` với field bị disable.
:::

:::quiz Vì sao gọi `markAllAsTouched()` khi submit form không hợp lệ?
- [ ] Để xoá lỗi
- [x] Để hiện lỗi ở mọi field — vì template thường chỉ hiện lỗi khi field đã `touched`
- [ ] Để reset form
- [ ] Bắt buộc trước khi đọc value

Người dùng bấm "Gửi" ngay mà chưa chạm field nào vẫn cần thấy lỗi.
:::
