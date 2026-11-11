---
title: Signal Forms cơ bản (ổn định từ Angular 22)
summary: form() bọc quanh một signal model, schema validation và directive [formField] — mô hình form mới dựa trên signals.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [forms, signal-forms, angular-22]
related: [angular/review/forms/reactive-forms-co-type, angular/review/signals/signal-computed-effect]
---

## TL;DR

- Dữ liệu form là **một signal model** của bạn; `form(model, schema)` tạo ra cây field bọc quanh nó.
- Form **không giữ bản sao** dữ liệu — sửa field là sửa thẳng vào model.
- Validation khai báo bằng **schema** (`required`, `email`, `min`, `minLength`, `pattern`, `validate`…).
- Template dùng directive `[formField]`.

```ts title="login.ts"
import { email, form, FormField, required, minLength } from '@angular/forms/signals';

@Component({
  selector: 'app-login',
  imports: [FormField],
  template: `
    <input type="email" [formField]="loginForm.email" />
    @if (loginForm.email().touched() && loginForm.email().invalid()) {
      <p class="error">Email chưa hợp lệ</p>
    }
    <input type="password" [formField]="loginForm.password" />
    <button [disabled]="loginForm().invalid()" (click)="login()">Đăng nhập</button>
  `,
})
export class Login {
  readonly model = signal({ email: '', password: '' });

  readonly loginForm = form(this.model, (p) => {
    required(p.email);
    email(p.email);
    required(p.password);
    minLength(p.password, 8);
  });

  login() {
    console.log(this.model()); // dữ liệu mới nhất, không cần getRawValue()
  }
}
```

| Đọc | Ý nghĩa |
|---|---|
| `loginForm.email()` | `FieldState` của field email |
| `.value()` | Giá trị (signal ghi được) |
| `.valid()` / `.invalid()` / `.errors()` | Trạng thái validation |
| `.touched()` / `.dirty()` | Người dùng đã tương tác chưa |
| `loginForm()` | State của cả form |

:::quiz Gõ vào ô email (gắn `[formField]="loginForm.email"`). `this.model()` thay đổi thế nào?
- [ ] Không đổi cho tới khi submit
- [x] Cập nhật ngay — form ghi thẳng vào signal model
- [ ] Chỉ đổi khi form hợp lệ
- [ ] Tạo bản sao mới, model gốc giữ nguyên

Đây là khác biệt lớn với Reactive Forms (vốn giữ state riêng trong `FormControl`).
:::

:::quiz Validation trong Signal Forms được khai báo ở đâu?
- [ ] Trong template bằng thuộc tính HTML
- [x] Trong hàm schema truyền vào `form(model, (p) => { ... })`
- [ ] Trong `Validators` của Reactive Forms
- [ ] Trong `effect`

Schema gắn rule vào từng path (`p.email`, `p.password`) — tách logic khỏi template và tái sử dụng được.
:::
