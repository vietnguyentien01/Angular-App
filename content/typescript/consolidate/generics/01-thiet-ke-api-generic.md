---
title: Thiết kế API generic đúng mức
summary: Khi nào cần tham số kiểu, để TypeScript tự suy ra thay vì bắt người dùng truyền, const type parameter và NoInfer.
level: intermediate
version: 6
lastReviewed: 2026-11-11
tags: [typescript, generics, api-design]
related: [typescript/review/generics/generics-va-utility-types, typescript/deep-dive/advanced/type-level-programming]
---

## Quy tắc: tham số kiểu phải xuất hiện ít nhất hai lần

```ts bad
function parseJson<T>(raw: string): T { return JSON.parse(raw); } // T chỉ ở kiểu trả về → chỉ là "as" trá hình
const u = parseJson<User>(text); // không kiểm tra gì cả
```

```ts good
function parseJson(raw: string): unknown { return JSON.parse(raw); } // trung thực: không biết là gì
function first<T>(list: readonly T[]): T | undefined { return list[0]; } // T liên kết đầu vào với đầu ra
```

## Để TypeScript suy ra

```ts
function groupBy<T, K extends PropertyKey>(items: T[], key: (item: T) => K): Record<K, T[]> { … }
const byStatus = groupBy(cases, (c) => c.status); // Record<'draft' | 'approved', Case[]> — không cần truyền kiểu
```

## `const` type parameter (TS 5.0+)

```ts
function defineRoutes<const T extends readonly string[]>(paths: T): T { return paths; }
const r = defineRoutes(['/', '/cases']); // readonly ['/', '/cases'] — không cần người gọi viết `as const`
```

## `NoInfer` (TS 5.4+)

```ts
function createStore<S extends string>(states: S[], initial: NoInfer<S>) { … }
createStore(['idle', 'loading'], 'idle');  // ✓
createStore(['idle', 'loading'], 'done');  // ✗ lỗi — 'done' không được dùng để suy ra S
```

Không có `NoInfer`, TypeScript sẽ suy ra `S = 'idle' | 'loading' | 'done'` từ cả hai đối số và không báo lỗi.

:::quiz Vì sao `function parseJson<T>(raw: string): T` bị coi là thiết kế xấu?
- [ ] Vì chậm
- [x] `T` chỉ xuất hiện ở kiểu trả về, không ràng buộc với đầu vào — nó chỉ là một phép ép kiểu được nguỵ trang, tạo cảm giác an toàn giả
- [ ] Vì `JSON.parse` không dùng được với generic
- [ ] Vì thiếu giá trị mặc định cho T

Trả `unknown` rồi validate là cách trung thực.
:::

:::quiz Bỏ `NoInfer`, gọi `createStore(['idle', 'loading'], 'done')` thì sao?
- [ ] Lỗi biên dịch
- [x] Không lỗi — `S` được suy ra là `'idle' | 'loading' | 'done'`
- [ ] `S` là `string`
- [ ] `S` là `never`

`NoInfer` chặn một vị trí tham gia vào việc suy luận, để nó chỉ được **kiểm tra** theo kết quả suy ra từ vị trí khác.
:::

:::quiz `defineRoutes<const T …>(['/', '/cases'])` khác gì khi không có `const`?
- [ ] Không khác
- [x] Có `const`, T được suy ra là tuple literal `readonly ['/', '/cases']`; không có thì là `string[]`
- [ ] `const` khiến hàm chạy nhanh hơn
- [ ] `const` biến mảng thành bất biến lúc runtime

Hữu ích cho API cấu hình (route, permission, event name) muốn giữ literal type.
:::

:::exercise Viết `groupBy` có kiểu chính xác
Hoàn thiện `groupBy<T, K extends PropertyKey>(items: T[], key: (item: T) => K): Partial<Record<K, T[]>>`.
???
```ts
function groupBy<T, K extends PropertyKey>(items: T[], key: (item: T) => K): Partial<Record<K, T[]>> {
  const out: Partial<Record<K, T[]>> = {};
  for (const item of items) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}
```
Dùng `Partial` vì không phải key nào trong `K` cũng chắc chắn có phần tử (vd không có hồ sơ `rejected` nào). Đây là lựa chọn trung thực hơn `Record<K, T[]>`.
:::
