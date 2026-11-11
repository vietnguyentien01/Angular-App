---
title: "Đoán kiểu: TypeScript suy ra gì?"
summary: Luyện đoán kiểu suy luận — widening, ternary, mảng hỗn hợp, mảng rỗng "tiến hoá", contextual typing — trước khi hover để kiểm tra.
level: intermediate
version: 6
lastReviewed: 2026-11-11
tags: [typescript, inference, quiz]
related: [typescript/review/basics/kieu-co-ban-va-suy-luan, typescript/deep-dive/basics/control-flow-analysis]
---

## TL;DR

- `const` giữ literal cho giá trị nguyên thuỷ; `let` và thuộc tính object bị nới (widening).
- Mảng hỗn hợp → **union của phần tử**: `[1, 'a']` là `(string | number)[]`, không phải tuple.
- Mảng rỗng `const a = []` là **mảng tiến hoá**: kiểu thay đổi theo những gì bạn `push`.
- **Contextual typing**: tham số callback được suy ra từ vị trí dùng (`[1,2].map((n) => …)` → `n: number`).

:::quiz Kiểu của `m`?
```ts
let m = Math.random() > 0.5 ? 1 : 'a';
```

- [ ] `1 | 'a'`
- [x] `string | number`
- [ ] `number`
- [ ] `unknown`

`let` nới literal: `1 | 'a'` thành `number | string`. Với `const` sẽ là `1 | "a"`.
:::

:::quiz Kiểu của `mix`?
```ts
const mix = [1, 'a', null];
```

- [ ] `[number, string, null]`
- [x] `(string | number | null)[]`
- [ ] `any[]`
- [ ] `readonly [1, 'a', null]`

Mảng literal được suy ra là mảng của union, không phải tuple. Muốn tuple: `as const` hoặc chú thích kiểu.
:::

:::quiz Kiểu của `arr` sau hai lệnh push?
```ts
const arr = [];
arr.push(1);
arr.push('a');
```

- [ ] `never[]`
- [ ] `any[]` (lỗi implicit any)
- [x] `(string | number)[]`
- [ ] `number[]`

"Evolving array": TypeScript theo dõi các phần tử được thêm vào để xác định kiểu khi mảng được dùng.
:::

:::quiz Với `strict` (mặc định ở TS 6), `let x = null;` có kiểu gì?
- [ ] `any`
- [x] `null`
- [ ] `undefined`
- [ ] `unknown`

Khi tắt `strictNullChecks`, `null` bị nới thành `any` — một lý do code cũ nhiều `any` ẩn.
:::

:::exercise Sửa để giữ kiểu chính xác
```ts
const STEPS = ['info', 'documents', 'confirm'];
type Step = (typeof STEPS)[number]; // đang là string
```
Sửa để `Step` là `'info' | 'documents' | 'confirm'`, và `STEPS` không bị sửa đổi.
???
```ts
const STEPS = ['info', 'documents', 'confirm'] as const; // readonly ['info', 'documents', 'confirm']
type Step = (typeof STEPS)[number]; // 'info' | 'documents' | 'confirm'
```
`as const` vừa giữ literal type vừa làm mảng `readonly` (không gọi được `push`).
:::
