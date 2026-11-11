---
title: Kiểu, union và narrowing
summary: interface vs type, union type, type guard, unknown vs any, strict null — nền tảng TypeScript dùng hằng ngày trong Angular.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [typescript, union, narrowing]
related: [angular/review/typescript/generics-utility-types]
---

## TL;DR

- `interface` — mô tả hình dạng object, **mở rộng** được (`extends`, declaration merging).
- `type` — đặt tên cho **bất kỳ** kiểu nào: union, tuple, function, mapped type.
- **Union** `A | B` + **narrowing** (`typeof`, `in`, `===`, thuộc tính phân biệt) = cách mô hình hoá trạng thái an toàn.
- `unknown` buộc phải kiểm tra trước khi dùng; `any` tắt kiểm tra — tránh dùng.

```ts title="Discriminated union cho trạng thái tải"
type LoadState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

function render(s: LoadState<User>) {
  switch (s.status) {
    case 'loading':
      return 'Đang tải…';
    case 'success':
      return s.data.name; // TS biết chắc có `data`
    case 'error':
      return s.message;
  }
}
```

## Type guard tự viết

```ts
function isApiError(e: unknown): e is { code: string; message: string } {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e;
}

try { … } catch (e) {            // e có kiểu unknown (useUnknownInCatchVariables)
  if (isApiError(e)) toast(e.message);
}
```

:::quiz Với `strictNullChecks`, đoạn nào báo lỗi?
```ts
function len(s: string | undefined) {
  return s.length;
}
```

- [x] `s.length` — `s` có thể là `undefined`
- [ ] Không lỗi
- [ ] Lỗi ở kiểu tham số
- [ ] Lỗi vì thiếu `return` type

Sửa: `return s?.length ?? 0;` hoặc kiểm tra `if (!s) return 0;` trước.
:::

:::quiz `let x: unknown = JSON.parse(raw); x.name;` thì sao?
- [ ] Chạy bình thường
- [x] Lỗi biên dịch — phải narrowing `x` trước khi truy cập thuộc tính
- [ ] Trả `undefined`
- [ ] Tự suy ra kiểu từ JSON

`unknown` là "any an toàn": nhận mọi giá trị nhưng không cho dùng khi chưa kiểm tra. Hợp cho dữ liệu từ API, `JSON.parse`, `catch`.
:::

:::quiz Trong `switch (s.status)` ở trên, thêm trạng thái `{ status: 'idle' }` vào union. Làm sao để TS báo chỗ quên xử lý?
- [ ] Không có cách
- [x] Thêm nhánh `default` gán `const _exhaustive: never = s;`
- [ ] Dùng `any`
- [ ] Dùng `as const`

Nếu còn trường hợp chưa xử lý, `s` ở `default` không phải `never` → lỗi biên dịch. Đây là "exhaustive check".
:::
