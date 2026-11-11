---
title: Union và narrowing
summary: Thu hẹp kiểu bằng typeof, in, instanceof, so sánh bằng, discriminated union, type predicate và assertion function.
type: card
level: core
version: 6
lastReviewed: 2026-11-11
tags: [typescript, union, narrowing]
related: [typescript/consolidate/unions/bay-narrowing, typescript/review/basics/kieu-co-ban-va-suy-luan]
---

## Các cách narrowing

```ts
function show(v: string | number | Date | null) {
  if (v === null) return '—';                 // so sánh bằng
  if (typeof v === 'string') return v.trim(); // typeof
  if (v instanceof Date) return v.toISOString(); // instanceof
  return v.toFixed(2);                         // còn lại: number
}

type Shape = { kind: 'circle'; r: number } | { kind: 'rect'; w: number; h: number };
function area(s: Shape) {
  switch (s.kind) {                 // discriminated union
    case 'circle': return Math.PI * s.r ** 2;
    case 'rect': return s.w * s.h;
  }
}

function hasEmail(x: object): x is { email: string } {   // type predicate
  return 'email' in x && typeof (x as { email: unknown }).email === 'string';
}

function assertDefined<T>(v: T): asserts v is NonNullable<T> {   // assertion function
  if (v == null) throw new Error('Thiếu giá trị');
}
```

## Exhaustive check

```ts
function label(s: Shape): string {
  switch (s.kind) {
    case 'circle': return 'Tròn';
    case 'rect': return 'Chữ nhật';
    default: {
      const _never: never = s; // thêm kind mới mà quên xử lý → lỗi ở đây
      return _never;
    }
  }
}
```

:::quiz Trong nhánh `else`, kiểu của `v` là gì?
```ts
function f(v: string | string[]) {
  if (typeof v === 'string') { /* … */ } else { v; }
}
```

- [ ] `string`
- [x] `string[]`
- [ ] `object`
- [ ] `unknown`

TypeScript loại `string` khỏi union ở nhánh còn lại.
:::

:::quiz `typeof null` trong JavaScript là gì, và điều đó ảnh hưởng narrowing thế nào?
- [ ] `'null'` — dùng `typeof v === 'null'` để kiểm tra
- [x] `'object'` — vì vậy `typeof v === 'object'` vẫn còn khả năng `v` là `null`
- [ ] `'undefined'`
- [ ] Lỗi

TypeScript mô hình đúng điều này: sau `typeof v === 'object'`, kiểu vẫn có `| null` cho tới khi bạn kiểm tra thêm.
:::

:::quiz Khác biệt giữa `x is T` và `asserts x is T`?
- [ ] Không khác
- [x] `x is T` trả boolean và narrowing trong nhánh `if`; `asserts x is T` không trả gì, nếu không ném lỗi thì **toàn bộ code phía sau** được narrowing
- [ ] `asserts` chỉ dùng trong test
- [ ] `x is T` chạy lúc runtime, `asserts` thì không

Cả hai đều do bạn tự cài đặt đúng — TypeScript tin lời bạn, nên viết sai là tự lừa trình biên dịch.
:::
