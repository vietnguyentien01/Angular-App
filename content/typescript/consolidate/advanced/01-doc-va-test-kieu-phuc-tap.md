---
title: Đọc, debug và viết test cho kiểu phức tạp
summary: Làm phẳng kiểu khó đọc bằng Simplify, kiểm tra kiểu bằng Equal/expectType, @ts-expect-error trong test kiểu, và cách chia nhỏ kiểu để debug.
level: intermediate
version: 6
lastReviewed: 2026-11-11
tags: [typescript, type-testing, debugging]
related: [typescript/deep-dive/advanced/type-level-programming, typescript/review/advanced/keyof-typeof-indexed-access]
---

## Làm phẳng kiểu để đọc

```ts
type Simplify<T> = { [K in keyof T]: T[K] } & {};

type Raw = Pick<User, 'id'> & Partial<Omit<User, 'id'>>; // hover: khó đọc
type Clean = Simplify<Raw>; // hover: { id: string; name?: string; email?: string }
```

## Test kiểu — kiểu cũng cần test

Khi viết utility type cho thư viện dùng chung, kiểm tra nó như code thường:

```ts title="types.spec-d.ts"
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
function expectType<T extends true>() {}

expectType<Equal<RequiredKeys<{ a: string; b?: number }>, 'a'>>(); // ✓ nếu đúng, lỗi biên dịch nếu sai

// @ts-expect-error — khẳng định dòng sau PHẢI lỗi
pick(user, ['notAKey']);
```

- `Equal` so khớp **chính xác** (khác `A extends B` vốn chỉ kiểm tra gán được).
- `@ts-expect-error` báo lỗi nếu dòng sau **không** có lỗi → bắt được trường hợp kiểu bị nới lỏng ngoài ý muốn.
- Chạy bằng `tsc --noEmit` trong CI. Bộ bài TypeScript trong app này được kiểm chứng đúng bằng cách đó.

## Debug kiểu: chia nhỏ

```ts
type Step1 = keyof Profile;                 // hover từng bước
type Step2 = Step1 extends string ? Step1 : never;
type Step3 = `get${Capitalize<Step2>}`;
```

:::quiz Vì sao không dùng `A extends B ? true : false` để so sánh hai kiểu bằng nhau?
- [ ] Vì cú pháp sai
- [x] `extends` chỉ kiểm tra "A gán được cho B" — `'a' extends string` là true dù hai kiểu khác nhau; còn với union nó phân phối và cho ra `boolean`
- [ ] Vì chậm
- [ ] Vì không dùng được với generic

`Equal` dùng mẹo so sánh hai hàm generic để kiểm tra đúng nghĩa "giống hệt".
:::

:::quiz Đặt `// @ts-expect-error` phía trên một dòng **không có lỗi** thì sao?
- [ ] Không có gì
- [x] TypeScript báo lỗi "Unused '@ts-expect-error' directive"
- [ ] Dòng đó bị bỏ qua khi biên dịch
- [ ] Cảnh báo nhưng vẫn build

Khác với `@ts-ignore` (luôn im lặng) — vì vậy `@ts-expect-error` hợp để viết test kiểu, `@ts-ignore` nên tránh.
:::

:::exercise Viết test kiểu
Viết 3 dòng test kiểu cho `Paths<T>` (đường dẫn `'a.b.c'`): một khẳng định kết quả chính xác, một khẳng định đường dẫn sai bị từ chối.
???
```ts
interface P { name: string; address: { city: string } }

expectType<Equal<Paths<P>, 'name' | 'address' | 'address.city'>>();

const ok: Paths<P> = 'address.city';
// @ts-expect-error — đường dẫn không tồn tại phải bị từ chối
const bad: Paths<P> = 'address.zip';
```
Đặt trong file `*.spec-d.ts` và thêm `tsc --noEmit -p tsconfig.spec.json` vào CI.
:::
