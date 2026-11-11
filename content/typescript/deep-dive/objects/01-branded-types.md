---
title: Branded types — nominal typing trong thế giới structural
summary: Ngăn truyền nhầm CaseId cho UserId, tiền VND cho số lượng — bằng kiểu "đóng dấu" không tốn chi phí runtime, kèm hàm tạo có kiểm tra.
level: advanced
version: 6
lastReviewed: 2026-11-11
tags: [typescript, branded-types, domain]
related: [typescript/review/objects/interface-type-va-structural-typing, typescript/deep-dive/unions/mo-hinh-hoa-trang-thai]
---

## Vấn đề

```ts
function approve(caseId: string, userId: string) { … }
approve(user.id, caseItem.id); // đảo thứ tự — TypeScript không báo vì đều là string
```

Structural typing coi mọi `string` như nhau.

## Brand

```ts
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

type CaseId = Brand<string, 'CaseId'>;
type UserId = Brand<string, 'UserId'>;
type Vnd = Brand<number, 'Vnd'>;

function approve(caseId: CaseId, userId: UserId) { … }

approve(user.id, caseItem.id);       // ✗ lỗi: UserId không gán được cho CaseId
approve('c-1', 'u-1');               // ✗ lỗi: string thường không gán được
approve(caseItem.id, user.id);       // ✓
```

Brand chỉ tồn tại ở tầng kiểu — lúc runtime vẫn là string/number bình thường.

## Tạo giá trị có brand ở ranh giới

```ts
function toVnd(n: number): Vnd {
  if (!Number.isInteger(n) || n < 0) throw new Error('Số tiền VND phải là số nguyên không âm');
  return n as Vnd; // chỗ DUY NHẤT được phép ép kiểu
}

const CaseIdSchema = z.string().regex(/^HS-\d+$/).brand<'CaseId'>(); // zod hỗ trợ brand sẵn
```

Quy tắc: ép kiểu sang brand **chỉ ở một hàm tạo có kiểm tra** (hoặc schema), không rải `as CaseId` khắp nơi.

:::quiz `const id: CaseId = 'HS-1';` có lỗi không?
- [x] Có — `string` không có thuộc tính brand nên không gán được cho `CaseId`
- [ ] Không
- [ ] Chỉ lỗi lúc runtime
- [ ] Chỉ khi bật strict

Phải đi qua hàm tạo/schema để có giá trị `CaseId`.
:::

:::quiz Ngược lại, truyền `CaseId` vào hàm nhận `string` thì sao?
- [ ] Lỗi
- [x] Được — `CaseId` là `string & {...}` nên vẫn là một `string`
- [ ] Chỉ được khi ép kiểu
- [ ] Mất brand và lỗi runtime

Brand chỉ chặn chiều "chuỗi bất kỳ → CaseId", không chặn việc dùng CaseId như chuỗi.
:::

:::exercise Tránh cộng nhầm tiền khác loại
Định nghĩa `Vnd` và `Usd` sao cho `addVnd(a: Vnd, b: Vnd): Vnd` không nhận `Usd`, và viết `addVnd`.
???
```ts
type Vnd = Brand<number, 'Vnd'>;
type Usd = Brand<number, 'Usd'>;

function addVnd(a: Vnd, b: Vnd): Vnd {
  return (a + b) as Vnd; // a + b là number thường → gắn lại brand
}

declare const price: Vnd, fee: Usd;
addVnd(price, price); // ✓
addVnd(price, fee);   // ✗ lỗi
```
Phép toán trên brand trả về `number` thường, nên các hàm số học của domain cần gắn lại brand — nên gom chúng vào một module `money.ts`.
:::
