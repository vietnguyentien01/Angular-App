---
title: Variadic tuple và kiểu cho hàm bậc cao
summary: Parameters/ReturnType, tuple có tên, spread trong tuple, và viết kiểu cho debounce, memoize, partial application mà vẫn giữ nguyên chữ ký hàm gốc.
level: advanced
version: 6
lastReviewed: 2026-11-11
tags: [typescript, variadic-tuple, higher-order-functions]
related: [typescript/consolidate/functions/overload-union-generic-va-this, typescript/deep-dive/advanced/type-level-programming]
---

## Giữ nguyên chữ ký khi bọc hàm

```ts
function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const save = debounce((id: string, draft: Draft) => api.save(id, draft), 500);
save('c1', draft); // ✓ giữ nguyên (id: string, draft: Draft)
save(1);           // ✗ lỗi
```

## Tuple có tên và spread

```ts
type Range = [start: Date, end: Date];          // tên chỉ để đọc/gợi ý
type WithCtx<A extends unknown[]> = [ctx: Ctx, ...args: A];

function withLog<A extends unknown[], R>(fn: (...args: A) => R) {
  return (...args: A): R => {
    console.debug('call', args);
    return fn(...args);
  };
}
```

## Partial application

```ts
function partial<H extends unknown[], T extends unknown[], R>(
  fn: (...args: [...H, ...T]) => R,
  ...head: H
): (...tail: T) => R {
  return (...tail) => fn(...head, ...tail);
}

const formatVnd = (locale: string, amount: number) => amount.toLocaleString(locale) + ' ₫';
const vi = partial(formatVnd, 'vi-VN'); // (amount: number) => string
vi(150000);
```

:::quiz Với `debounce` ở trên, gọi `save('c1')` (thiếu draft) thì sao?
- [ ] Chạy, draft là undefined
- [x] Lỗi biên dịch — `A` là `[id: string, draft: Draft]`, thiếu đối số
- [ ] Chỉ cảnh báo
- [ ] Lỗi runtime

Generic `A extends unknown[]` giữ chính xác tuple tham số của hàm gốc.
:::

:::quiz `Parameters<(a: string, b?: number) => void>` là gì?
- [ ] `[string, number]`
- [x] `[a: string, b?: number | undefined]`
- [ ] `string | number`
- [ ] `[string]`

Tham số tuỳ chọn trở thành phần tử tuỳ chọn của tuple.
:::

:::exercise Viết `memoize` cho hàm một đối số kiểu khoá
Viết `memoize<K extends string | number, R>(fn: (key: K) => R): (key: K) => R` dùng `Map`.
???
```ts
function memoize<K extends string | number, R>(fn: (key: K) => R): (key: K) => R {
  const cache = new Map<K, R>();
  return (key) => {
    if (cache.has(key)) return cache.get(key)!;
    const value = fn(key);
    cache.set(key, value);
    return value;
  };
}
const provinceName = memoize((code: string) => lookupProvince(code)); // (key: string) => string
```
Dùng `cache.has` thay vì kiểm tra `cache.get(key) !== undefined` để cache được cả giá trị `undefined`.
:::
