---
title: Lập trình ở tầng kiểu — conditional, distributive, infer, mapped, đệ quy
summary: Hiểu conditional type phân phối qua union, trích kiểu bằng infer, đổi tên key bằng mapped type + template literal, và kiểu đệ quy như DeepReadonly.
level: advanced
version: 6
lastReviewed: 2026-11-11
tags: [typescript, conditional-types, mapped-types, infer]
related: [typescript/review/advanced/keyof-typeof-indexed-access, angular/deep-dive/typescript/conditional-mapped-template-types]
---

## Conditional type phân phối qua union

```ts
type ToArray<T> = T extends unknown ? T[] : never;
type A = ToArray<string | number>; // string[] | number[]  — phân phối từng thành viên

type ToArrayNoDist<T> = [T] extends [unknown] ? T[] : never;
type B = ToArrayNoDist<string | number>; // (string | number)[] — bọc trong tuple để tắt phân phối
```

Chỉ phân phối khi `T` là **tham số kiểu trần** đứng bên trái `extends`.

## `infer`

```ts
type ParamOf<F> = F extends (arg: infer P) => unknown ? P : never;
type Item<T> = T extends readonly (infer I)[] ? I : T;
type RouteParams<S> = S extends `${string}:${infer P}/${infer Rest}` ? P | RouteParams<`/${Rest}`>
  : S extends `${string}:${infer P}` ? P : never;

type P = RouteParams<'/cases/:caseId/files/:fileId'>; // 'caseId' | 'fileId'
```

## Mapped type đổi tên key

```ts
type Getters<T> = { [K in keyof T & string as `get${Capitalize<K>}`]: () => T[K] };
type G = Getters<{ name: string; age: number }>; // { getName: () => string; getAge: () => number }

type PickByValue<T, V> = { [K in keyof T as T[K] extends V ? K : never]: T[K] };
type Strings = PickByValue<{ a: string; b: number; c: string }, string>; // { a: string; c: string }
```

## Kiểu đệ quy

```ts
type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
```

:::quiz `type X<T> = T extends string ? 'S' : 'O'; type R = X<string | number>;` — `R` là gì?
- [ ] `'S'`
- [ ] `'O'`
- [x] `'S' | 'O'`
- [ ] `never`

Phân phối: `X<string> | X<number>` = `'S' | 'O'`.
:::

:::quiz `type N<T> = T extends unknown ? T[] : never; type R = N<never>;` — `R` là gì?
- [ ] `never[]`
- [x] `never`
- [ ] `unknown[]`
- [ ] Lỗi

`never` là union rỗng — phân phối qua 0 thành viên cho kết quả `never`. Một chi tiết hay xuất hiện khi debug kiểu phức tạp.
:::

:::exercise Viết `RequiredKeys<T>`
Trả về union các key **bắt buộc** của `T`. Ví dụ `RequiredKeys<{ a: string; b?: number }>` → `'a'`.
???
```ts
type RequiredKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T];

type R = RequiredKeys<{ a: string; b?: number; c: boolean | undefined }>; // 'a' | 'c'
```
Mẹo: nếu `K` là tuỳ chọn thì `{}` gán được cho `Pick<T, K>`. Lưu ý `c: boolean | undefined` vẫn là key **bắt buộc** (phải có mặt), khác với `c?:`.
:::
