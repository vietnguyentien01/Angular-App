---
title: Interface, type alias và structural typing
summary: Kiểu được so theo hình dạng chứ không theo tên, excess property check chỉ áp với object literal "mới", optional/readonly và index signature.
type: card
level: core
version: 6
lastReviewed: 2026-11-11
tags: [typescript, interface, structural-typing]
related: [typescript/consolidate/objects/doan-loi-bien-dich]
---

## Structural typing

```ts
interface Point { x: number; y: number }
class Pixel { constructor(public x: number, public y: number, public color: string) {} }

const p: Point = new Pixel(1, 2, 'red'); // ✓ Pixel có đủ x, y → tương thích
```

Hai kiểu tương thích nếu **hình dạng** khớp — tên không quan trọng.

## Excess property check

```ts
const a: Point = { x: 1, y: 2, z: 3 };   // ✗ lỗi: object literal có thuộc tính thừa 'z'
const tmp = { x: 1, y: 2, z: 3 };
const b: Point = tmp;                   // ✓ không lỗi: tmp không phải literal "mới"
```

Kiểm tra thuộc tính thừa chỉ áp cho **object literal gán trực tiếp** — để bắt lỗi gõ sai tên thuộc tính.

## interface hay type?

| | `interface` | `type` |
|---|---|---|
| Mô tả object | ✓ | ✓ |
| Union, tuple, mapped, conditional | ✗ | ✓ |
| `extends` / gộp nhiều lần khai báo (declaration merging) | ✓ | ✗ |
| Mở rộng kiểu thư viện (augmentation) | ✓ | ✗ |

Quy ước phổ biến: `interface` cho hình dạng object/public API, `type` cho union và kiểu tính toán.

## Optional, readonly, index signature

```ts
interface CaseFilter {
  readonly q: string;
  status?: 'open' | 'closed';     // có thể vắng mặt
  [extra: string]: unknown;       // index signature: chấp nhận key bất kỳ
}
```

:::quiz Dòng nào báo lỗi?
```ts
interface User { name: string }
const u1: User = { name: 'Lan', age: 30 };  // (1)
const raw = { name: 'Lan', age: 30 };
const u2: User = raw;                       // (2)
```

- [x] Chỉ (1)
- [ ] Chỉ (2)
- [ ] Cả hai
- [ ] Không dòng nào

(1) là object literal mới → excess property check. (2) gán qua biến → chỉ kiểm tra tương thích hình dạng, `raw` có đủ `name` nên hợp lệ.
:::

:::quiz Hai `interface Config { a: string }` và `interface Config { b: number }` khai báo trong cùng phạm vi thì sao?
- [ ] Lỗi trùng tên
- [x] Được gộp lại thành `{ a: string; b: number }` (declaration merging)
- [ ] Khai báo sau ghi đè khai báo trước
- [ ] Chỉ dùng được khai báo đầu

Với `type Config = …` khai báo hai lần sẽ báo lỗi trùng tên.
:::

:::quiz `readonly` trong TypeScript có ngăn được việc sửa object lúc runtime không?
- [ ] Có, giống `Object.freeze`
- [x] Không — chỉ là kiểm tra lúc biên dịch; code JavaScript chạy ra vẫn sửa được
- [ ] Chỉ trong strict mode
- [ ] Chỉ với mảng

Muốn bất biến lúc runtime cần `Object.freeze` (nông) hoặc cấu trúc bất biến.
:::
