---
title: Conditional, mapped và template literal types — viết type cho thư viện
summary: DeepPartial, đường dẫn field dạng 'a.b.c' có kiểm tra kiểu, event bus có type — các kỹ thuật type nâng cao dùng khi xây form engine hay design system.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [typescript, advanced-types, generics]
related: [angular/consolidate/typescript/type-an-toan-o-ranh-gioi, angular/deep-dive/forms/dynamic-form-tu-json-schema]
---

## Mapped type

```ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Nullable<T> = { [K in keyof T]: T[K] | null };

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
// Bản nháp form: mọi cấp đều có thể thiếu
type CaseDraft = DeepPartial<Case>;
```

## Conditional type và `infer`

```ts
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type A = ElementOf<string[]>; // string

type Unwrap<T> = T extends Observable<infer V> ? V : T extends Promise<infer V> ? V : T;
type B = Unwrap<Observable<User>>; // User
```

## Template literal type: đường dẫn field có kiểm tra

```ts title="paths.ts"
type Paths<T> = T extends object
  ? { [K in keyof T & string]: T[K] extends object ? K | `${K}.${Paths<T[K]>}` : K }[keyof T & string]
  : never;

type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

interface Profile {
  name: string;
  address: { city: string; ward: { code: string } };
}

type ProfilePath = Paths<Profile>;
// 'name' | 'address' | 'address.city' | 'address.ward' | 'address.ward.code'

function getValue<T, P extends Paths<T>>(obj: T, path: P): PathValue<T, P> {
  return path.split('.').reduce<any>((o, k) => o?.[k], obj);
}

const code = getValue(profile, 'address.ward.code'); // string
getValue(profile, 'address.zip'); // ✗ lỗi biên dịch: không có đường dẫn này
```

Form engine dùng kiểu này để cấu hình `{ field: 'address.ward.code' }` được kiểm tra lúc biên dịch.

## Event bus có type

```ts
interface AppEvents {
  'case:selected': { id: string };
  'case:saved': { id: string; version: number };
  logout: void;
}

class EventBus<E> {
  private readonly subject = new Subject<{ type: keyof E; payload: unknown }>();
  emit<K extends keyof E>(type: K, ...payload: E[K] extends void ? [] : [E[K]]) {
    this.subject.next({ type, payload: payload[0] });
  }
  on<K extends keyof E>(type: K): Observable<E[K]> {
    return this.subject.pipe(filter((e) => e.type === type), map((e) => e.payload as E[K]));
  }
}

bus.emit('case:saved', { id: '1', version: 2 }); // ✓
bus.emit('logout'); // ✓ không cần payload
bus.emit('case:saved', { id: '1' }); // ✗ thiếu version
```

:::quiz `ElementOf<number>` (với định nghĩa ở trên) là gì?
- [ ] `number`
- [x] `never`
- [ ] `unknown`
- [ ] Lỗi biên dịch

`number` không khớp `readonly (infer E)[]` nên rơi vào nhánh `never`.
:::

:::quiz Vì sao `Paths<T>` dùng `keyof T & string`?
- [ ] Để nhanh hơn
- [x] `keyof` có thể gồm cả `number | symbol`; template literal chỉ ghép được với string-like, nên lọc lấy key dạng chuỗi
- [ ] Bắt buộc với mọi mapped type
- [ ] Để loại bỏ thuộc tính optional

Không có `& string`, TypeScript báo lỗi khi đặt `K` vào `` `${K}.…` ``.
:::

:::exercise Viết `RequireKeys<T, K>`
Viết type làm cho các key `K` của `T` trở thành bắt buộc, giữ nguyên các key khác. Ví dụ `RequireKeys<{ a?: string; b?: number }, 'a'>` → `{ a: string; b?: number }`.
???
```ts
type RequireKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Hiển thị gọn khi hover:
type Simplify<T> = { [P in keyof T]: T[P] } & {};
type R = Simplify<RequireKeys<{ a?: string; b?: number }, 'a'>>; // { b?: number; a: string }
```
Hữu ích cho kiểu "sau khi validate": `RequireKeys<CaseDraft, 'code' | 'status'>`.
:::
