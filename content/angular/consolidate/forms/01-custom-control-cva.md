---
title: Custom form control — ControlValueAccessor và FormValueControl
summary: Viết ô nhập tiền VND dùng được với cả Reactive Forms (CVA) và Signal Forms (FormValueControl) — kỹ năng cốt lõi khi xây thư viện component dùng chung.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [forms, cva, custom-control, signal-forms]
related: [angular/review/forms/reactive-forms-co-type, angular/review/forms/signal-forms-co-ban, angular/consolidate/forms/validator-tu-viet]
---

## TL;DR

| Dùng với | Hợp đồng cần cài đặt |
|---|---|
| Reactive / template-driven Forms | `ControlValueAccessor`: `writeValue`, `registerOnChange`, `registerOnTouched`, (`setDisabledState`) + provider `NG_VALUE_ACCESSOR` |
| Signal Forms | `FormValueControl<T>`: chỉ cần `readonly value = model<T>()` |

## Ô nhập tiền — phiên bản CVA

```ts title="money-input.ts"
@Component({
  selector: 'app-money-input',
  template: `
    <input
      inputmode="numeric"
      [value]="display()"
      [disabled]="disabled()"
      (input)="onInput($any($event.target).value)"
      (blur)="onTouched()"
    />
    <span>₫</span>
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInput), multi: true }],
})
export class MoneyInput implements ControlValueAccessor {
  private readonly value = signal<number | null>(null);
  protected readonly disabled = signal(false);
  protected readonly display = computed(() => (this.value() == null ? '' : this.value()!.toLocaleString('vi-VN')));

  private onChange: (v: number | null) => void = () => {};
  protected onTouched: () => void = () => {};

  // Form → component
  writeValue(v: number | null): void {
    this.value.set(v);
  }
  registerOnChange(fn: (v: number | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  // Component → form
  protected onInput(raw: string) {
    const digits = raw.replace(/\D/g, '');
    const v = digits ? Number(digits) : null;
    this.value.set(v);
    this.onChange(v);
  }
}
```

```html
<app-money-input formControlName="premium" />
```

## Phiên bản Signal Forms — gọn hơn nhiều

```ts title="money-field.ts"
@Component({
  selector: 'app-money-field',
  template: `<input inputmode="numeric" [value]="display()" (input)="onInput($any($event.target).value)" /> ₫`,
})
export class MoneyField implements FormValueControl<number | null> {
  readonly value = model<number | null>(null); // hợp đồng duy nhất bắt buộc
  protected readonly display = computed(() => this.value()?.toLocaleString('vi-VN') ?? '');

  protected onInput(raw: string) {
    const digits = raw.replace(/\D/g, '');
    this.value.set(digits ? Number(digits) : null);
  }
}
```

```html
<app-money-field [formField]="quoteForm.premium" />
```

:::senior Góc nhìn Senior
Trong design system dùng chung giữa nhiều micro frontend, custom control nên hỗ trợ **cả hai** mô hình trong giai đoạn chuyển đổi: dự án cũ dùng Reactive Forms, dự án mới dùng Signal Forms. Giữ logic định dạng/parse trong hàm thuần dùng chung để hai phiên bản không lệch nhau.
:::

:::quiz Trong CVA, method nào được gọi khi code gọi `form.controls.premium.setValue(500000)`?
- [x] `writeValue(500000)`
- [ ] `registerOnChange`
- [ ] `onChange(500000)`
- [ ] `setDisabledState`

`writeValue` là chiều **form → component**. `onChange` là chiều ngược lại, do component gọi khi người dùng nhập.
:::

:::quiz Quên gọi `this.onTouched()` khi blur thì sao?
- [ ] Giá trị không được cập nhật
- [x] Control không bao giờ `touched` — các thông báo lỗi hiển thị theo điều kiện `touched` sẽ không xuất hiện
- [ ] Lỗi runtime
- [ ] Form bị disable

Bug rất hay gặp với custom control: validate đúng nhưng người dùng không thấy lỗi.
:::

:::quiz Vì sao provider dùng `forwardRef(() => MoneyInput)`?
- [ ] Để lazy-load component
- [x] Vì class `MoneyInput` được tham chiếu trong decorator của chính nó, lúc đó class chưa được định nghĩa xong
- [ ] Để tạo nhiều instance
- [ ] Bắt buộc với mọi provider

`forwardRef` hoãn việc đọc tham chiếu tới khi class đã tồn tại.
:::

:::exercise Gọi `onChange` trong `writeValue`?
Một đồng nghiệp viết `writeValue(v) { this.value.set(v); this.onChange(v); }` "cho chắc". Có vấn đề gì?
???
`writeValue` được gọi khi **form** đặt giá trị. Gọi lại `onChange` sẽ báo ngược cho form như thể người dùng vừa sửa: control bị đánh dấu `dirty`, `valueChanges` phát thừa, và trong vài trường hợp có thể tạo vòng lặp cập nhật. `onChange` chỉ được gọi khi **người dùng** thay đổi giá trị.
:::
