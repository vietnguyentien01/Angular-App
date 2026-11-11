---
title: Bẫy narrowing hay gặp
summary: Truthiness với 0 và chuỗi rỗng, narrowing bị mất trong callback, filter tự suy ra type predicate (TS 5.5+), và in với thuộc tính tuỳ chọn.
level: intermediate
version: 6
lastReviewed: 2026-11-11
tags: [typescript, narrowing, pitfalls]
related: [typescript/review/unions/narrowing]
---

## 1. Truthiness nuốt `0` và `''`

```ts bad
function showFee(fee: number | undefined) {
  if (fee) return `${fee} ₫`;
  return 'Chưa có phí'; // fee = 0 cũng rơi vào đây!
}
```

```ts good
if (fee !== undefined) return `${fee} ₫`;
// hoặc: fee ?? 'Chưa có phí' — ?? chỉ bỏ qua null/undefined, khác với ||
```

## 2. Narrowing bị mất trong callback

```ts
function run(user: { name?: string }) {
  if (user.name) {
    setTimeout(() => user.name.toUpperCase()); // ✗ lỗi: name có thể đã bị đổi trước khi callback chạy
  }
}
```

```ts good
const name = user.name;            // chụp vào const
if (name) setTimeout(() => name.toUpperCase()); // ✓
```

Với `const`/biến cục bộ không bị gán lại, TypeScript giữ được narrowing trong closure; với thuộc tính của object thì không.

## 3. `filter` và type predicate tự suy ra

```ts
const ids = ['a', undefined, 'b'];
const clean = ids.filter((x) => x !== undefined); // string[] (TS ≥ 5.5 tự suy ra x is string)
const clean2 = ids.filter(Boolean);               // (string | undefined)[] — Boolean không phải type predicate
```

:::quiz `function f(n: number | undefined) { return n || 10; }` — `f(0)` trả về gì?
- [ ] `0`
- [x] `10`
- [ ] `undefined`
- [ ] Lỗi biên dịch

`||` coi `0` là falsy. Dùng `n ?? 10` nếu `0` là giá trị hợp lệ.
:::

:::quiz Với TypeScript 6, `['a', undefined].filter((x) => x !== undefined)` có kiểu gì?
- [ ] `(string | undefined)[]`
- [x] `string[]`
- [ ] `unknown[]`
- [ ] `never[]`

Từ TS 5.5, TypeScript tự suy ra type predicate `x is string` cho callback đơn giản như thế này.
:::

:::quiz Kiểu của `clean2 = ['a', undefined].filter(Boolean)`?
- [ ] `string[]`
- [x] `(string | undefined)[]`
- [ ] `boolean[]`
- [ ] Lỗi

`Boolean` là hàm thường, không phải type predicate — TypeScript không biết nó loại `undefined`. Dùng arrow function như ví dụ trên.
:::

:::exercise Viết type guard cho phản hồi API
API trả về `unknown`. Viết `isPage<T>(v: unknown, isItem: (x: unknown) => x is T): v is { items: T[]; total: number }`.
???
```ts
function isPage<T>(v: unknown, isItem: (x: unknown) => x is T): v is { items: T[]; total: number } {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as { items?: unknown; total?: unknown };
  return Array.isArray(o.items) && o.items.every(isItem) && typeof o.total === 'number';
}
```
Type guard nhận một type guard khác cho phần tử — ghép được cho cấu trúc lồng nhau. Với schema phức tạp, dùng thư viện validate (zod) để không phải viết tay.
:::
