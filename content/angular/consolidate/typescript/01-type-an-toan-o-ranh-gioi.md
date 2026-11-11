---
title: Type an toàn ở ranh giới — dữ liệu API không đáng tin như bạn nghĩ
summary: http.get<T>() chỉ là lời hứa; validate dữ liệu ở biên bằng schema, mô hình hoá trạng thái bằng union, và tránh as/any lan ra toàn code.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [typescript, validation, zod, api]
related: [angular/review/typescript/kieu-va-narrowing, angular/review/http/httpclient-co-ban]
---

## Vấn đề

```ts bad
this.http.get<Case>('/api/cases/1').subscribe((c) => {
  this.total.set(c.fee.amount * 1.1); // backend đổi `fee` thành `fees: []` → crash lúc runtime, TS không báo
});
```

`get<Case>` **không kiểm tra** gì cả — chỉ nói với TypeScript "tin tôi đi". Sai cấu trúc chỉ lộ ra khi người dùng gặp lỗi.

## Validate ở biên bằng schema

```ts title="case.schema.ts"
import { z } from 'zod';

export const CaseSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']),
  fee: z.object({ amount: z.number(), currency: z.literal('VND') }),
  submittedAt: z.iso.datetime().nullable(),
});
export type Case = z.infer<typeof CaseSchema>; // type sinh từ schema — một nguồn sự thật
```

```ts title="case.api.ts"
get(id: string) {
  return this.http.get<unknown>(`/api/cases/${id}`).pipe(map((raw) => CaseSchema.parse(raw)));
}
```

Lỗi cấu trúc giờ xuất hiện **ngay tại API layer** với thông báo rõ field nào sai, thay vì `undefined is not an object` ở một component xa.

## Hạn chế `as` và `any`

| Viết | Vấn đề | Thay bằng |
|---|---|---|
| `data as Case` | Ép kiểu, không kiểm tra | Schema / type guard |
| `any` | Tắt kiểm tra và **lan** sang mọi chỗ dùng | `unknown` + narrowing |
| `!` (non-null assertion) | Giả định không null | Xử lý trường hợp null rõ ràng |

:::quiz `http.get<Case>(url)` đảm bảo điều gì lúc runtime?
- [ ] Response đúng kiểu `Case`
- [x] Không gì cả — generic chỉ ảnh hưởng kiểu lúc biên dịch
- [ ] Ném lỗi nếu thiếu field
- [ ] Tự chuyển đổi kiểu dữ liệu

Type của TypeScript bị xoá khi biên dịch. Muốn kiểm tra thật phải có code chạy lúc runtime.
:::

:::quiz Vì sao `any` nguy hiểm hơn `unknown`?
- [ ] `any` chậm hơn
- [x] `any` tắt kiểm tra và lây sang mọi biểu thức dùng nó; `unknown` buộc phải narrowing trước khi dùng
- [ ] `unknown` không nhận được object
- [ ] Không khác nhau

`const x: any = ...; const y = x.a.b;` → `y` cũng là `any`, lỗi lan rộng mà không ai biết.
:::

:::exercise Viết type guard không dùng thư viện
Viết `isCaseStatus(v: unknown): v is CaseStatus` với `type CaseStatus = 'draft' | 'submitted' | 'approved'`, không lặp lại danh sách giá trị ở hai nơi.
???
```ts
const CASE_STATUSES = ['draft', 'submitted', 'approved'] as const;
type CaseStatus = (typeof CASE_STATUSES)[number]; // 'draft' | 'submitted' | 'approved'

function isCaseStatus(v: unknown): v is CaseStatus {
  return typeof v === 'string' && (CASE_STATUSES as readonly string[]).includes(v);
}
```
`as const` + `(typeof X)[number]` sinh union type từ mảng — danh sách chỉ khai báo **một lần**, dùng được cả lúc runtime lẫn lúc biên dịch.
:::
