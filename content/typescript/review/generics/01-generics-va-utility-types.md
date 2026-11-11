---
title: Generics, ràng buộc và utility types
summary: Hàm và kiểu generic, extends và keyof làm ràng buộc, giá trị mặc định, cùng bảng utility types dùng hằng ngày.
type: card
level: core
version: 6
lastReviewed: 2026-11-11
tags: [typescript, generics, utility-types]
related: [typescript/consolidate/generics/thiet-ke-api-generic]
---

## Generic và ràng buộc

```ts
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}

const u = { id: 1, name: 'Lan', email: 'lan@x.vn' };
const p = pick(u, ['id', 'name']); // { id: number; name: string }
pick(u, ['phone']);                 // ✗ 'phone' không phải key của u

interface ApiResponse<T = unknown> { data: T; error?: string } // giá trị mặc định cho T
```

## Utility types

| Utility | Kết quả |
|---|---|
| `Partial<T>` / `Required<T>` | Mọi thuộc tính tuỳ chọn / bắt buộc |
| `Readonly<T>` | Mọi thuộc tính chỉ đọc |
| `Pick<T, K>` / `Omit<T, K>` | Giữ / bỏ một số thuộc tính |
| `Record<K, V>` | Object có key `K`, value `V` |
| `Exclude<U, X>` / `Extract<U, X>` | Bỏ / giữ thành viên của union |
| `NonNullable<T>` | Bỏ `null` và `undefined` |
| `ReturnType<F>` / `Parameters<F>` | Kiểu trả về / tuple tham số của hàm |
| `Awaited<T>` | Kiểu sau khi `await` (gỡ Promise lồng nhau) |

```ts
type Status = 'draft' | 'submitted' | 'approved' | 'rejected';
type Final = Extract<Status, 'approved' | 'rejected'>; // 'approved' | 'rejected'
type Open = Exclude<Status, Final>;                      // 'draft' | 'submitted'
type Data = Awaited<ReturnType<typeof fetchCases>>;      // kiểu dữ liệu fetchCases resolve ra
```

:::quiz `Exclude<'a' | 'b' | 'c', 'a' | 'z'>` là gì?
- [ ] `'b' | 'c' | 'z'`
- [x] `'b' | 'c'`
- [ ] `'a'`
- [ ] `never`

`Exclude` bỏ các thành viên có trong tham số thứ hai; `'z'` không có trong union gốc nên không ảnh hưởng.
:::

:::quiz Vì sao `K extends keyof T` thay vì `K extends string`?
- [ ] Không khác gì
- [x] Để chỉ chấp nhận đúng các key của `T` — truyền key không tồn tại sẽ lỗi biên dịch, và `T[K]` có kiểu chính xác
- [ ] Vì key luôn là string
- [ ] Để hỗ trợ symbol

`keyof T` là union các key thật của `T`.
:::

:::quiz `Awaited<Promise<Promise<number>>>` là gì?
- [ ] `Promise<number>`
- [x] `number`
- [ ] `Promise<Promise<number>>`
- [ ] `unknown`

`Awaited` gỡ đệ quy giống hành vi của `await`.
:::
