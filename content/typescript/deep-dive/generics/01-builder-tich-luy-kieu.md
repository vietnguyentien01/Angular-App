---
title: Generic tích luỹ — builder có kiểm tra kiểu từng bước
summary: Mỗi lời gọi method trả về kiểu mới mang thêm thông tin, nhờ đó builder chỉ cho build() khi đã đủ trường bắt buộc và kết quả có kiểu chính xác.
level: advanced
version: 6
lastReviewed: 2026-11-11
tags: [typescript, generics, builder, api-design]
related: [typescript/consolidate/generics/thiet-ke-api-generic, typescript/deep-dive/advanced/type-level-programming]
---

## Ý tưởng

Generic không chỉ để "nhận một kiểu" — mỗi bước có thể **tạo ra một kiểu mới** từ kiểu cũ:

```ts
class FormBuilder<Fields extends Record<string, unknown> = {}> {
  private constructor(private readonly fields: Fields) {}
  static create() {
    return new FormBuilder({});
  }

  text<K extends string>(key: K): FormBuilder<Fields & Record<K, string>> {
    return new FormBuilder({ ...this.fields, [key]: '' } as Fields & Record<K, string>);
  }
  number<K extends string>(key: K, initial = 0): FormBuilder<Fields & Record<K, number>> {
    return new FormBuilder({ ...this.fields, [key]: initial } as Fields & Record<K, number>);
  }
  build(): Fields {
    return this.fields;
  }
}

const model = FormBuilder.create().text('fullName').number('age', 18).build();
// { fullName: string } & { age: number }
model.age.toFixed();   // ✓
model.email;           // ✗ lỗi: không tồn tại
```

## Bắt buộc đủ trường trước khi build

```ts
interface Req { url?: string; method?: 'GET' | 'POST' }

class RequestBuilder<S extends Req = {}> {
  constructor(private readonly s: S) {}
  url(u: string) { return new RequestBuilder({ ...this.s, url: u }); }
  method<M extends 'GET' | 'POST'>(m: M) { return new RequestBuilder({ ...this.s, method: m }); }
  build(this: RequestBuilder<{ url: string; method: 'GET' | 'POST' }>) { return this.s; }
}

new RequestBuilder({}).url('/api').method('GET').build(); // ✓
new RequestBuilder({}).url('/api').build();               // ✗ lỗi: thiếu method
```

Mẹo: tham số `this` của `build()` ràng buộc trạng thái của builder tại thời điểm gọi.

:::quiz Vì sao mỗi method trả về **instance mới** (`new FormBuilder(...)`) thay vì `return this`?
- [ ] Vì nhanh hơn
- [x] Vì kiểu của builder thay đổi sau mỗi bước — `this` có kiểu cũ, instance mới mang kiểu `Fields & …` mới
- [ ] Vì `this` không dùng được trong class generic
- [ ] Không có lý do

Có thể `return this as unknown as FormBuilder<…>` nếu muốn tránh cấp phát, nhưng instance mới bất biến và dễ hiểu hơn.
:::

:::quiz `new RequestBuilder({}).url('/api').build()` lỗi vì sao?
- [ ] Thiếu `new`
- [x] `build` yêu cầu `this` có `method`; builder lúc đó chỉ có `{ url: string }`
- [ ] `url` sai kiểu
- [ ] `build` là private

Đây là cách mã hoá "thứ tự/điều kiện gọi" vào hệ thống kiểu.
:::
