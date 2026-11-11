---
title: Decorator chuẩn (TC39) và experimentalDecorators của Angular
summary: Hai thế hệ decorator trong TypeScript, vì sao Angular vẫn bật experimentalDecorators, cách viết decorator chuẩn cho code của mình, accessor và using/Symbol.dispose.
level: advanced
version: 6
lastReviewed: 2026-11-11
tags: [typescript, decorators, class, angular]
related: [typescript/review/classes-modules/class-enum-va-module]
---

## Hai thế hệ

| | `experimentalDecorators: true` | Decorator chuẩn (TS ≥ 5.0, mặc định) |
|---|---|---|
| Nguồn gốc | Đề xuất cũ, TypeScript tự cài đặt | Đề xuất TC39 (stage 3) |
| Chữ ký | `(target, propertyKey, descriptor)` | `(value, context)` với `context.kind`, `context.name`… |
| Decorator tham số (`constructor(@Inject(X) x)`) | Có | **Không** |
| Dùng bởi | Angular (`@Component`, `@Input`…), NestJS, TypeORM | Code mới không phụ thuộc framework |

Angular CLI tạo tsconfig với `experimentalDecorators: true` vì compiler Angular xử lý các decorator của framework theo mô hình cũ (và hỗ trợ decorator trên tham số constructor). Bật cờ này áp dụng cho **toàn bộ** project — không trộn hai kiểu trong cùng một project được.

## Decorator chuẩn (khi không bật experimentalDecorators)

```ts
function logged<This, Args extends unknown[], R>(
  target: (this: This, ...args: Args) => R,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => R>,
) {
  return function (this: This, ...args: Args): R {
    console.debug(`→ ${String(context.name)}`, args);
    return target.call(this, ...args);
  };
}

class ReportService {
  @logged
  export(format: 'pdf' | 'xlsx') { … }
}
```

## `accessor` và `using`

```ts
class Panel {
  accessor title = ''; // sinh getter/setter + field private; hợp với decorator chuẩn
}

function openFile(path: string) {
  using handle = acquire(path); // handle có [Symbol.dispose]()
  return handle.read();
} // handle tự được dispose khi ra khỏi scope, kể cả khi có exception
```

:::quiz Vì sao project Angular vẫn bật `experimentalDecorators`?
- [ ] Vì decorator chuẩn chưa tồn tại
- [x] Vì decorator của Angular được viết và biên dịch theo mô hình cũ, cần cả decorator trên tham số constructor — mô hình chuẩn không hỗ trợ
- [ ] Để tăng tốc build
- [ ] Vì TypeScript 6 bắt buộc

Code mới trong Angular có thể dùng `inject()` thay cho `@Inject()` trên tham số — giảm phụ thuộc vào tính năng chỉ có ở mô hình cũ.
:::

:::quiz Decorator chuẩn có dùng được trên tham số của constructor không?
- [ ] Có
- [x] Không — đề xuất TC39 hiện tại không có parameter decorator
- [ ] Chỉ với `accessor`
- [ ] Chỉ khi target là ES5

Đây là khác biệt lớn nhất khi chuyển đổi các thư viện dùng `@Inject()` kiểu cũ.
:::
