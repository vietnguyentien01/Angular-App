---
title: Hàm — tham số, overload, callback và void
summary: Tham số tuỳ chọn và mặc định, rest, function overload, vì sao callback trả void vẫn nhận hàm có giá trị trả về, và tham số this.
type: card
level: core
version: 6
lastReviewed: 2026-11-11
tags: [typescript, function, overload]
related: [typescript/review/generics/generics-va-utility-types]
---

## Tham số

```ts
function format(amount: number, currency = 'VND', ...tags: string[]): string { … }
function greet(name?: string) { return `Xin chào ${name ?? 'bạn'}`; } // name: string | undefined
```

## Overload

```ts
function parse(input: string): number;
function parse(input: string[]): number[];
function parse(input: string | string[]): number | number[] {
  return Array.isArray(input) ? input.map(Number) : Number(input);
}

const a = parse('1');        // number
const b = parse(['1', '2']); // number[]
```

Chữ ký cuối (implementation signature) **không** được gọi trực tiếp từ bên ngoài. Nhiều trường hợp có thể thay overload bằng generic hoặc union đơn giản hơn.

## Callback trả `void`

```ts
const ids: number[] = [];
[1, 2, 3].forEach((n) => ids.push(n)); // ✓ dù push trả về number
```

Kiểu callback `(n: number) => void` nghĩa là "giá trị trả về sẽ bị bỏ qua", nên hàm trả về bất cứ gì đều gán được.

## Tham số `this`

```ts
function onClick(this: HTMLButtonElement, e: MouseEvent) {
  this.disabled = true;
}
```

`this` chỉ tồn tại lúc biên dịch để kiểm tra ngữ cảnh gọi, không phải tham số thật.

:::quiz `function f(x?: number)` — kiểu của `x` bên trong hàm?
- [ ] `number`
- [x] `number | undefined`
- [ ] `number | null`
- [ ] `unknown`

Tham số tuỳ chọn có thể vắng mặt → `undefined`.
:::

:::quiz Với hai overload ở trên, gọi `parse(Math.random() > 0.5 ? '1' : ['1'])` thì sao?
- [ ] Trả `number | number[]`
- [x] Lỗi biên dịch — đối số kiểu `string | string[]` không khớp overload nào (implementation signature không được tính)
- [ ] Trả `number`
- [ ] Trả `number[]`

Muốn chấp nhận union thì phải thêm overload thứ ba `parse(input: string | string[]): number | number[]`.
:::

:::quiz Vì sao `[1,2].forEach((n) => ids.push(n))` không lỗi dù `push` trả `number`?
- [ ] Vì `forEach` khai báo callback trả `any`
- [x] Vì callback có kiểu trả về `void` chấp nhận hàm trả về giá trị bất kỳ — giá trị đó bị bỏ qua
- [ ] Vì TypeScript không kiểm tra arrow function
- [ ] Vì `push` trả `void`

Lưu ý: khi **khai báo** một hàm với `: void` rõ ràng thì `return 1` bên trong vẫn báo lỗi.
:::
