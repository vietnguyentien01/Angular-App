---
title: Control flow analysis — TypeScript "đọc" code của bạn thế nào
summary: Kiểu của một biến thay đổi theo từng dòng code; gán lại, return sớm, throw, hàm never và assertion function đều ảnh hưởng tới kiểu ở các dòng sau.
level: advanced
version: 6
lastReviewed: 2026-11-11
tags: [typescript, control-flow, narrowing]
related: [typescript/consolidate/basics/doan-kieu-suy-luan, typescript/review/unions/narrowing]
---

## Kiểu "khai báo" và kiểu "tại chỗ"

```ts
let id: string | number = getId(); // kiểu khai báo: string | number
id = 'abc';                         // từ đây, kiểu tại chỗ: string
id.toUpperCase();                   // ✓
id = 42;                            // giờ là number
id.toFixed();                       // ✓
```

TypeScript phân tích **luồng điều khiển** (if, return, throw, gán lại) để biết kiểu tại mỗi điểm.

## Return sớm, throw và hàm `never`

```ts
function fail(msg: string): never { throw new Error(msg); }

function load(id: string | undefined) {
  if (!id) fail('Thiếu id'); // TypeScript biết sau dòng này id là string
  return fetchCase(id);       // ✓ id: string
}
```

Lưu ý: TypeScript chỉ coi lời gọi là "không quay về" khi hàm được khai báo kiểu `never` **tường minh** và được gọi như một câu lệnh độc lập.

## Narrowing qua biến trung gian (aliased conditions)

```ts
function show(v: string | number) {
  const isText = typeof v === 'string';
  if (isText) v.toUpperCase(); // ✓ TS ≥ 4.4 hiểu điều kiện lưu trong const
}
```

## Narrowing không "xuyên" qua lời gọi hàm

```ts
let state: 'idle' | 'loading' = 'idle';
function start() { state = 'loading'; }

state = 'idle';
start();
if (state === 'loading') { } // TypeScript vẫn nghĩ state là 'idle' → có thể báo "không bao giờ trùng"
```

TypeScript không phân tích tác dụng phụ của hàm khác lên biến — đây là đánh đổi có chủ đích để kiểm tra kiểu nhanh.

:::quiz Kiểu của `id` ở dòng cuối?
```ts
let id: string | number = Math.random() > 0.5 ? 'a' : 1;
id = 42;
id; // ?
```

- [ ] `string | number`
- [x] `number`
- [ ] `42`
- [ ] `string`

Sau phép gán, kiểu tại chỗ là kiểu của giá trị gán (bị nới về `number` vì khai báo là `string | number`).
:::

:::quiz `const isText = typeof v === 'string'; if (isText) v.toUpperCase();` — có lỗi không (TS 6)?
- [ ] Có, narrowing không qua được biến
- [x] Không — TypeScript hiểu điều kiện được lưu trong `const` (aliased condition)
- [ ] Chỉ khi dùng `let`
- [ ] Lỗi runtime

Chỉ hoạt động khi biến điều kiện là `const` (hoặc không bị gán lại) và biến được kiểm tra không bị gán lại.
:::

:::exercise Vì sao lỗi?
```ts
const fail = (msg: string): never => { throw new Error(msg); };
function load(id?: string) {
  if (!id) fail('Thiếu id');
  return id.length; // ✗ 'id' is possibly 'undefined'
}
```
???
Assertion qua hàm `never` chỉ được TypeScript ghi nhận khi hàm có **chú thích kiểu tường minh** ở chính khai báo (vd `function fail(msg: string): never`, hoặc `const fail: (msg: string) => never = …`). Với arrow function chỉ chú thích kiểu trả về như trên, biến `fail` có kiểu suy ra nên không được tính. Sửa:
```ts
function fail(msg: string): never { throw new Error(msg); }
// hoặc: if (!id) return fail('Thiếu id');  // return làm rõ luồng cho mọi trường hợp
```
:::
