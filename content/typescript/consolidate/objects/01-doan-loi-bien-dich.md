---
title: "Đoán lỗi biên dịch: object, readonly, optional"
summary: Luyện đọc code và đoán TypeScript có báo lỗi hay không — structural typing, readonly array, optional với exactOptionalPropertyTypes, index signature.
level: intermediate
version: 6
lastReviewed: 2026-11-11
tags: [typescript, quiz, objects]
related: [typescript/review/objects/interface-type-va-structural-typing, typescript/review/config/tsconfig-va-typescript-6]
---

## TL;DR

- Tương thích kiểu = **đủ** thuộc tính cần thiết (thừa thì được, trừ object literal mới).
- `readonly T[]` không gán được sang `T[]` (vì `T[]` cho phép sửa).
- `x?: string` khác `x: string | undefined` — rõ nhất khi bật `exactOptionalPropertyTypes`.

:::quiz Dòng nào lỗi?
```ts
const ro: readonly number[] = [1, 2];
const a: number[] = ro;          // (1)
const b: readonly number[] = [3]; // (2)
ro.push(3);                      // (3)
```

- [ ] Chỉ (1)
- [ ] Chỉ (3)
- [x] (1) và (3)
- [ ] Không dòng nào

`readonly number[]` không có `push`, và không gán được cho `number[]` (nếu không bên nhận có thể sửa mảng). Ngược lại `number[]` → `readonly number[]` thì được.
:::

:::quiz Với `exactOptionalPropertyTypes: true`, dòng nào lỗi?
```ts
interface Opts { title?: string }
const o1: Opts = {};                    // (1)
const o2: Opts = { title: undefined };  // (2)
```

- [ ] Chỉ (1)
- [x] Chỉ (2)
- [ ] Cả hai
- [ ] Không dòng nào

Với cờ này, `title?: string` nghĩa là "có thể **vắng mặt**", không phải "có thể là `undefined`". Muốn cho phép cả hai: `title?: string | undefined`.
:::

:::quiz Dòng nào lỗi?
```ts
interface HasId { id: string }
function save(x: HasId) {}
const order = { id: 'o1', total: 100 };
save(order);                      // (1)
save({ id: 'o2', total: 100 });   // (2)
```

- [ ] Chỉ (1)
- [x] Chỉ (2)
- [ ] Cả hai
- [ ] Không dòng nào

Truyền object literal trực tiếp vào tham số cũng bị excess property check; truyền qua biến thì không.
:::

:::quiz `interface Dict { [k: string]: number; length: string }` có hợp lệ không?
- [ ] Hợp lệ
- [x] Lỗi — thuộc tính `length: string` không khớp index signature `[k: string]: number`
- [ ] Hợp lệ nếu bật strict
- [ ] Chỉ lỗi lúc runtime

Mọi thuộc tính có tên (string) phải tương thích với kiểu của string index signature. Sửa: `[k: string]: number | string`.
:::

:::exercise Sửa kiểu để bắt lỗi gõ nhầm
```ts
function updateCase(id: string, patch: object) { /* … */ }
updateCase('1', { stauts: 'approved' }); // gõ nhầm 'status' nhưng không lỗi
```
???
```ts
interface Case { status: 'draft' | 'approved'; note: string }
function updateCase(id: string, patch: Partial<Case>) { /* … */ }
updateCase('1', { stauts: 'approved' }); // ✗ lỗi: 'stauts' không tồn tại trong Partial<Case>
```
`object` chấp nhận mọi object nên mất kiểm tra. `Partial<Case>` vừa cho phép gửi một phần, vừa bắt key sai nhờ excess property check.
:::
