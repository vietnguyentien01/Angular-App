---
title: Kiểu cơ bản, literal type và suy luận kiểu
summary: TypeScript suy ra kiểu thế nào, vì sao let và const cho kiểu khác nhau, as const, và khác biệt giữa any, unknown, never, void.
type: card
level: core
version: 6
lastReviewed: 2026-11-11
tags: [typescript, inference, literal]
related: [typescript/review/objects/interface-type-va-structural-typing, typescript/review/unions/narrowing]
---

## Suy luận và widening

```ts
let a = 'hồ sơ';      // string        — let có thể gán lại nên "nới rộng" (widening)
const b = 'hồ sơ';    // 'hồ sơ'       — const không đổi nên giữ literal type
const c = { s: 'draft' };        // { s: string }  — thuộc tính object vẫn bị nới
const d = { s: 'draft' } as const; // { readonly s: 'draft' }
const list = ['a', 'b'] as const;  // readonly ['a', 'b']
```

## Các kiểu "đặc biệt"

| Kiểu | Ý nghĩa | Dùng khi |
|---|---|---|
| `any` | Tắt kiểm tra hoàn toàn | Gần như không bao giờ |
| `unknown` | Có thể là bất cứ gì, **phải kiểm tra** trước khi dùng | Dữ liệu từ ngoài: API, `JSON.parse`, `catch` |
| `never` | Không có giá trị nào | Nhánh không thể xảy ra, hàm luôn ném lỗi |
| `void` | Hàm không trả giá trị có ý nghĩa | Kiểu trả về của handler |
| `null` / `undefined` | Hai giá trị riêng biệt khi bật `strictNullChecks` | |

:::tip TypeScript 6
Từ TypeScript 6.0, `strict` (gồm `strictNullChecks`, `noImplicitAny`…) **bật mặc định**. Code cũ dựa vào chế độ không strict sẽ bắt đầu báo lỗi khi nâng cấp.
:::

:::quiz Kiểu của `x` là gì?
```ts
const x = { status: 'draft' };
```

- [ ] `{ status: 'draft' }`
- [x] `{ status: string }`
- [ ] `{ readonly status: 'draft' }`
- [ ] `object`

Thuộc tính của object có thể bị gán lại nên bị nới thành `string`, dù biến là `const`. Muốn giữ literal: `as const`, hoặc chú thích kiểu.
:::

:::quiz Đoạn nào báo lỗi biên dịch?
```ts
let v: unknown = 'abc';
v.toUpperCase(); // (1)
let w: any = 'abc';
w.toUpperCase(); // (2)
```

- [x] Chỉ (1)
- [ ] Chỉ (2)
- [ ] Cả hai
- [ ] Không dòng nào

`unknown` cấm dùng khi chưa narrowing; `any` cho qua tất cả (kể cả khi sai).
:::

:::quiz `function fail(msg: string): never { throw new Error(msg); }` — vì sao kiểu trả về là `never`?
- [ ] Vì hàm không có `return`
- [x] Vì hàm không bao giờ kết thúc bình thường (luôn ném lỗi), nên không bao giờ "trả về" giá trị nào
- [ ] Vì `never` giống `void`
- [ ] Bắt buộc với hàm có `throw`

Hàm có kiểu `never` giúp TypeScript hiểu code sau lời gọi nó là không thể tới được.
:::
