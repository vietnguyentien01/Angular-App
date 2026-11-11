---
title: Validator tự viết — cross-field, điều kiện và bất đồng bộ
summary: Kiểm tra khoảng ngày, bắt buộc có điều kiện, kiểm tra trùng mã qua API — viết cho cả Reactive Forms và Signal Forms.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [forms, validation, async-validator, signal-forms]
related: [angular/consolidate/forms/custom-control-cva, angular/deep-dive/forms/dynamic-form-tu-json-schema]
---

## 1. Cross-field: "đến ngày" phải sau "từ ngày"

```ts title="Reactive Forms — validator ở cấp group"
export const dateRange: ValidatorFn = (group) => {
  const { from, to } = group.value as { from?: string; to?: string };
  return from && to && to < from ? { dateRange: 'Đến ngày phải sau từ ngày' } : null;
};

this.fb.group({ from: [''], to: [''] }, { validators: dateRange });
```

```ts title="Signal Forms — gắn lỗi vào đúng field `to`"
readonly filter = form(this.model, (p) => {
  validate(p.to, ({ value, valueOf }) => {
    const from = valueOf(p.from);
    return from && value() && value() < from ? { kind: 'dateRange', message: 'Đến ngày phải sau từ ngày' } : undefined;
  });
});
```

Với Signal Forms, lỗi nằm ngay trên field `to` (`filter.to().errors()`), không phải ở group — dễ hiển thị cạnh ô nhập.

## 2. Bắt buộc có điều kiện

```ts title="Signal Forms"
form(this.model, (p) => {
  required(p.taxCode, { when: ({ valueOf }) => valueOf(p.customerType) === 'company' });
  hidden(p.taxCode, ({ valueOf }) => valueOf(p.customerType) !== 'company');
});
```

```ts title="Reactive Forms — phải tự đồng bộ"
this.form.controls.customerType.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
  const tax = this.form.controls.taxCode;
  tax.setValidators(type === 'company' ? [Validators.required] : []);
  tax.updateValueAndValidity();
});
```

## 3. Bất đồng bộ: kiểm tra mã hồ sơ đã tồn tại

```ts title="Reactive Forms — AsyncValidatorFn"
export function uniqueCode(api: CaseApi): AsyncValidatorFn {
  return (control) =>
    timer(400).pipe(
      switchMap(() => api.exists(control.value)),
      map((exists) => (exists ? { duplicate: true } : null)),
      catchError(() => of(null)), // lỗi mạng: không chặn người dùng
    );
}
// code: ['', { validators: [Validators.required], asyncValidators: [uniqueCode(api)], updateOn: 'blur' }]
```

`timer(400)` + cơ chế huỷ của Angular (mỗi lần giá trị đổi, lần validate cũ bị unsubscribe) cho hiệu ứng debounce.

:::quiz Async validator chỉ chạy khi nào?
- [ ] Luôn chạy song song với validator đồng bộ
- [x] Chỉ khi mọi validator đồng bộ đã hợp lệ — trong lúc chạy, trạng thái control là `PENDING`
- [ ] Chỉ khi submit
- [ ] Chỉ một lần khi khởi tạo

Angular không gọi API kiểm tra trùng khi ô còn trống (đã fail `required`).
:::

:::quiz Với validator cấp group `dateRange` (Reactive Forms), lỗi nằm ở đâu?
- [ ] `form.controls.to.errors`
- [x] `form.errors` (của group), không phải của control `to`
- [ ] Cả hai
- [ ] Không có ở đâu

Vì vậy template phải đọc `form.hasError('dateRange')` — dễ quên hiển thị. Signal Forms cho phép gắn lỗi thẳng vào field.
:::

:::quiz Trong `validate(p.to, ({ value, valueOf }) => ...)`, khi `from` thay đổi thì sao?
- [ ] Validator của `to` không chạy lại cho tới khi `to` đổi
- [x] Validator chạy lại — `valueOf(p.from)` đọc signal nên `from` trở thành dependency
- [ ] Lỗi vì đọc field khác
- [ ] Phải tự gọi `updateValueAndValidity()`

Đây là lợi thế của mô hình signal: cross-field validation tự cập nhật, không cần `valueChanges` thủ công.
:::

:::exercise Mật khẩu xác nhận
Viết rule cho Signal Forms: `confirm` phải trùng `password`, lỗi `{ kind: 'mismatch' }` gắn vào `confirm`; `password` bắt buộc, tối thiểu 8 ký tự.
???
```ts
readonly model = signal({ password: '', confirm: '' });
readonly f = form(this.model, (p) => {
  required(p.password);
  minLength(p.password, 8);
  validate(p.confirm, ({ value, valueOf }) =>
    value() !== valueOf(p.password) ? { kind: 'mismatch', message: 'Mật khẩu xác nhận không khớp' } : undefined,
  );
});
```
:::
