---
title: Overload, union hay generic? — và bẫy this khi truyền method làm callback
summary: Chọn cách khai báo hàm phù hợp, tránh overload không cần thiết, và hiểu vì sao method mất this khi được truyền đi.
level: intermediate
version: 6
lastReviewed: 2026-11-11
tags: [typescript, functions, overload, this]
related: [typescript/review/functions/ham-va-overload, typescript/deep-dive/functions/variadic-tuple-va-ham-bac-cao]
---

## Chọn cách khai báo

| Tình huống | Chọn |
|---|---|
| Kiểu trả về **không** phụ thuộc kiểu tham số | Union: `fn(x: string \| number): string` |
| Kiểu trả về **liên kết** với kiểu tham số | Generic: `fn<T>(x: T): T[]` |
| Các cách gọi khác nhau về **số lượng/hình dạng** tham số | Overload |

```ts bad
function len(x: string): number;
function len(x: unknown[]): number;
function len(x: string | unknown[]) { return x.length; }
```

```ts good
function len(x: string | readonly unknown[]): number { return x.length; } // một chữ ký là đủ
```

## Bẫy `this`

```ts
class Counter {
  count = 0;
  inc() { this.count++; }
  incArrow = () => { this.count++; };
}

const c = new Counter();
setTimeout(c.inc, 0);      // 💥 runtime: this là undefined (TS không báo lỗi)
setTimeout(c.incArrow, 0); // ✓
setTimeout(() => c.inc(), 0); // ✓
```

TypeScript không báo lỗi trường hợp đầu vì kiểu của `c.inc` chỉ là `() => void`. Muốn TypeScript bắt được, khai báo tham số `this`:

```ts
class SafeCounter {
  count = 0;
  inc(this: SafeCounter) { this.count++; }
}
const s = new SafeCounter();
const f = s.inc;
f(); // ✗ lỗi biên dịch: ngữ cảnh 'this' kiểu 'void' không gán được cho 'SafeCounter'
```

Trong Angular, template gọi `(click)="inc()"` luôn đúng `this`; bẫy chỉ xuất hiện khi truyền method cho API bên ngoài (`setTimeout`, thư viện chart, `addEventListener`).

:::quiz `setTimeout(c.inc, 0)` với `inc() { this.count++ }` — TypeScript có báo lỗi không?
- [ ] Có
- [x] Không — nhưng lúc chạy `this` không trỏ tới `c`
- [ ] Có nếu bật strict
- [ ] Không, và chạy đúng

Trừ khi method khai báo tham số `this` tường minh.
:::

:::quiz Hàm nhận `string | number` và luôn trả về `string`. Nên viết thế nào?
- [ ] Hai overload
- [ ] Generic `<T extends string | number>(x: T): string`
- [x] Một chữ ký với union: `(x: string | number): string`
- [ ] Dùng `any`

Generic chỉ hữu ích khi `T` liên kết đầu vào với đầu ra; ở đây không có.
:::

:::exercise Viết overload hợp lý
Viết `getById` sao cho: gọi với một `string` trả về `Case | undefined`, gọi với `string[]` trả về `Case[]`.
???
```ts
function getById(id: string): Case | undefined;
function getById(ids: readonly string[]): Case[];
function getById(arg: string | readonly string[]): Case | undefined | Case[] {
  return typeof arg === 'string' ? cases.find((c) => c.id === arg) : cases.filter((c) => arg.includes(c.id));
}
```
Ở đây overload hợp lý vì kiểu trả về **khác nhau** theo hình dạng đối số. Có thể thay bằng conditional type `T extends string ? Case | undefined : Case[]`, nhưng cài đặt sẽ cần ép kiểu — overload dễ đọc hơn.
:::
