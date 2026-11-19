---
title: Variance — vì sao mảng là "không an toàn" và method khác function property
summary: Covariance và contravariance, strictFunctionTypes chỉ áp cho thuộc tính kiểu hàm (không áp cho method), mảng covariant không an toàn, và chú thích in/out.
level: advanced
version: 6
lastReviewed: 2026-11-19
tags: [typescript, variance, soundness]
related: [typescript/deep-dive/advanced/type-level-programming]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Ý tưởng

Cho `Dog extends Animal`:

| Vị trí | Hướng | Ví dụ |
|---|---|---|
| Giá trị trả về / đọc | **Covariant**: `() => Dog` gán được cho `() => Animal` | Đưa ra Dog khi được hứa Animal: an toàn |
| Tham số / ghi | **Contravariant**: `(a: Animal) => void` gán được cho `(d: Dog) => void` | Nhận Animal thì chắc chắn xử lý được Dog |

## strictFunctionTypes: function property vs method

```ts
interface Animal { name: string }
interface Dog extends Animal { bark(): void }

interface HandlerProp { handle: (a: Animal) => void }   // function property → kiểm tra chặt
interface HandlerMethod { handle(a: Animal): void }      // method → bivariant (lỏng)

const dogOnly = (d: Dog) => d.bark();
const h1: HandlerProp = { handle: dogOnly };   // ✗ lỗi: Dog-only handler không xử lý được mọi Animal
const h2: HandlerMethod = { handle: dogOnly }; // ✓ không lỗi (cho tương thích lịch sử) — nhưng có thể crash
```

Muốn an toàn trong interface của mình: khai báo callback dạng **property** `handle: (a: Animal) => void`.

## Mảng covariant — một lỗ hổng có chủ đích

```ts
const dogs: Dog[] = [];
const animals: Animal[] = dogs; // ✓ được phép
animals.push({ name: 'mèo' });  // ✓ TypeScript không báo — giờ dogs chứa một con không biết sủa
dogs[0].bark();                 // 💥 runtime
```

TypeScript chấp nhận để dùng tiện; tránh bằng `readonly Animal[]` khi chỉ cần đọc.

## Chú thích `in` / `out` (TS 4.7+)

```ts
interface Producer<out T> { get(): T }
interface Consumer<in T> { accept(v: T): void }
```

Giúp tài liệu hoá ý định và tăng tốc kiểm tra kiểu ở kiểu generic phức tạp; TypeScript báo lỗi nếu chú thích không khớp cách dùng.

:::quiz Với `interface Animal { name: string }` và `interface Dog extends Animal { bark(): void }`, dòng nào lỗi khi bật `strict`?
```ts
let f1: (a: Animal) => void = (d: Dog) => {};   // (1)
let f2: (d: Dog) => void = (a: Animal) => {};   // (2)
```

- [x] Chỉ (1)
- [ ] Chỉ (2)
- [ ] Cả hai
- [ ] Không dòng nào

(1): hàm chỉ xử lý Dog bị đặt vào chỗ cần xử lý mọi Animal — không an toàn. (2): hàm xử lý được mọi Animal thì xử lý được Dog — an toàn.
:::

:::quiz Với `strict` bật, dòng gán `h1` báo lỗi nhưng dòng gán `h2` thì không. Vì sao `HandlerMethod` không báo lỗi?
```ts
interface Animal { name: string }
interface Dog extends Animal { bark(): void }

interface HandlerProp { handle: (a: Animal) => void }   // function property
interface HandlerMethod { handle(a: Animal): void }      // method

const dogOnly = (d: Dog) => d.bark();
const h1: HandlerProp = { handle: dogOnly };   // ✗ lỗi
const h2: HandlerMethod = { handle: dogOnly }; // không lỗi
```

- [ ] Do lỗi của TypeScript
- [x] Tham số của **method** được kiểm tra bivariant (lỏng hơn) để tương thích với nhiều API sẵn có như DOM; `strictFunctionTypes` chỉ áp cho thuộc tính kiểu hàm
- [ ] Vì `Dog` có thêm method
- [ ] Vì interface không kiểm tra method

Đây là khác biệt thực tế giữa `handle(a): void` và `handle: (a) => void`.
:::
