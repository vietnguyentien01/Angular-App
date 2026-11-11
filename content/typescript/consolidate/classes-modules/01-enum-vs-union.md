---
title: Enum, const enum hay union literal?
summary: Hành vi thật của enum số và enum chuỗi, vì sao const enum gặp vấn đề với isolatedModules/esbuild, và pattern object as const thay thế.
level: intermediate
version: 6
lastReviewed: 2026-11-11
tags: [typescript, enum, union]
related: [typescript/review/classes-modules/class-enum-va-module]
---

## Enum sinh ra gì?

```ts
enum Dir { Up, Down }
// JavaScript đầu ra (rút gọn):
// var Dir; (function (Dir) { Dir[Dir["Up"] = 0] = "Up"; Dir[Dir["Down"] = 1] = "Down"; })(Dir || (Dir = {}));
Object.keys(Dir); // ['0', '1', 'Up', 'Down'] — reverse mapping làm "bẩn" danh sách key
```

Enum chuỗi (`enum Status { Draft = 'draft' }`) không có reverse mapping, nhưng vẫn là **nominal**: chuỗi `'draft'` từ API không gán thẳng được cho `Status`.

```ts
enum Status { Draft = 'draft', Approved = 'approved' }
const fromApi: string = 'draft';
const s1: Status = 'draft';   // ✗ lỗi — phải dùng Status.Draft
```

## `const enum` và build hiện đại

`const enum` được thay thẳng bằng giá trị lúc biên dịch — việc này cần thông tin kiểu từ file khác. Các công cụ biên dịch **từng file độc lập** như esbuild (builder của Angular), Vite, Babel không có thông tin đó, nên TypeScript có cờ `isolatedModules` để báo trước những gì sẽ hỏng. Ví dụ, kiểm chứng với tsc 6:

```text
error TS2748: Cannot access ambient const enums when 'isolatedModules' is enabled.
```

(khi dùng một `declare const enum` khai báo trong file `.d.ts`). Vì vậy hầu hết dự án hiện đại tránh `const enum`.

## Pattern thay thế

```ts
export const CaseStatus = {
  Draft: 'draft',
  Submitted: 'submitted',
  Approved: 'approved',
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus]; // 'draft' | 'submitted' | 'approved'

const s: CaseStatus = 'draft';           // ✓ chuỗi thường từ API dùng được
const s2: CaseStatus = CaseStatus.Draft; // ✓ vẫn có "tên hằng" để tự động gợi ý
Object.values(CaseStatus);               // ['draft', 'submitted', 'approved'] — sạch, dùng cho dropdown
```

:::quiz `Object.keys(Dir)` với `enum Dir { Up, Down }` trả về gì?
- [ ] `['Up', 'Down']`
- [x] `['0', '1', 'Up', 'Down']`
- [ ] `[0, 1]`
- [ ] `[]`

Reverse mapping của enum số thêm key số. Duyệt enum để làm dropdown hay bị lỗi vì điều này.
:::

:::quiz `enum Status { Draft = 'draft' }`, `const s: Status = 'draft';` có lỗi không?
- [x] Có — enum chuỗi không nhận chuỗi literal trực tiếp, phải dùng `Status.Draft`
- [ ] Không
- [ ] Chỉ lỗi khi bật strict
- [ ] Chỉ lỗi lúc runtime

Đây là lý do khi map dữ liệu API sang enum thường phải ép kiểu — pattern `as const` không gặp vấn đề này.
:::

:::exercise Chuyển enum sang pattern as const
```ts
export enum Priority { Low = 'low', Normal = 'normal', High = 'high' }
export const PRIORITY_LABEL: Record<Priority, string> = { … };
```
Viết lại bằng object `as const`, giữ được `Priority.High` khi dùng và `Record<Priority, string>` cho nhãn.
???
```ts
export const Priority = { Low: 'low', Normal: 'normal', High: 'high' } as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const PRIORITY_LABEL = {
  low: 'Thấp',
  normal: 'Bình thường',
  high: 'Cao',
} satisfies Record<Priority, string>;
```
Cùng tên cho cả giá trị và kiểu là hợp lệ (hai "không gian tên" khác nhau). `satisfies` đảm bảo không thiếu nhãn cho mức nào.
:::
