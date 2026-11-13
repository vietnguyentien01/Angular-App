---
title: "JSX, props, state, sự kiện và danh sách — React nhìn từ Angular"
summary: "Component React là một hàm trả về JSX; props đi xuống, sự kiện đi lên qua callback; state đổi thì component chạy lại. Bảng đối chiếu với @if/@for/input()/output() của Angular, và lỗi key là index — đã chạy thử: xoá phần tử đầu làm ghi chú của An hiện sang ô của Bình."
type: card
level: core
version: 19
lastReviewed: 2026-11-13
tags: [react, jsx, props, state, key]
related: [react/consolidate/components/doan-so-lan-render, react/deep-dive/components/reconciliation-va-key]
---

## TL;DR

- Component = **hàm** nhận `props`, trả về **JSX**. Mỗi lần state/props đổi, React **gọi lại hàm** và so kết quả với lần trước để cập nhật DOM.
- Dữ liệu đi **một chiều**: cha truyền props xuống; con báo lên bằng **callback** trong props.
- State **bất biến**: luôn tạo object/mảng mới (`[...items, x]`), không `push`/gán thuộc tính rồi `setItems(items)`.
- Danh sách: `items.map(...)` với `key` **ổn định và duy nhất** (id), không dùng index khi danh sách thay đổi thứ tự/xoá.

## Ví dụ

```tsx title="ProductList.tsx"
import { useState } from 'react';

type Product = { id: number; name: string; price: number; stock: number };

function ProductRow({ product, onAdd }: { product: Product; onAdd: (id: number) => void }) {
  return (
    <li>
      {product.name} — {product.price.toLocaleString('vi-VN')} ₫
      {product.stock === 0 ? <em> (hết hàng)</em> : <button onClick={() => onAdd(product.id)}>Thêm vào giỏ</button>}
    </li>
  );
}

export function ProductList({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<number[]>([]);
  return (
    <section>
      <p>Giỏ hàng: {cart.length} sản phẩm</p>
      {products.length === 0 && <p>Chưa có sản phẩm</p>}
      <ul>
        {products.map((p) => (
          <ProductRow key={p.id} product={p} onAdd={(id) => setCart((c) => [...c, id])} />
        ))}
      </ul>
    </section>
  );
}
```

## Đối chiếu với Angular

| Angular | React |
|---|---|
| `@Component` + template | Hàm trả về JSX |
| `input()` | `props` (tham số của hàm) |
| `output()` + `(event)="…"` | Callback trong props: `onAdd={…}` |
| `signal()` | `useState()` — đổi thì component chạy lại |
| `computed()` | Biểu thức tính ngay trong hàm, hoặc `useMemo` khi tốn kém |
| `@if (x) { … } @else { … }` | `{x ? <A /> : <B />}` hoặc `{x && <A />}` |
| `@for (p of list; track p.id)` | `{list.map(p => <Row key={p.id} … />)}` |
| `[class.active]="on"` | `className={on ? 'active' : ''}` |
| `(click)="save()"` | `onClick={save}` (truyền hàm, **không** gọi `save()`) |
| `[(ngModel)]` / `model()` | `value` + `onChange` (controlled input) |

## Lỗi hay gặp: `key` là index

```tsx bad
{items.map((name, i) => <Row key={i} label={name} />)}
```

Đã chạy thử: danh sách `['An', 'Bình']`, mỗi dòng có ô ghi chú giữ trong state của `Row`. Gõ "ghi chú của An" rồi xoá phần tử đầu → ô của **Bình** hiện `"ghi chú của An"`. React thấy key `0` vẫn còn nên giữ nguyên state của dòng đó và chỉ đổi `label`. Dùng `key={item.id}` thì ô của Bình trống đúng.

:::version React 19
React 19 (12/2024; bản hiện tại 19.3) bỏ `propTypes` và `defaultProps` cho function component (dùng TypeScript và tham số mặc định), cho truyền `ref` như một prop thường (không cần `forwardRef`), và thêm Actions/`useActionState` cho form. Dự án React 16–18 vẫn dùng chung cú pháp JSX và hook ở bài này.
:::

:::interview Props khác state thế nào? Vì sao không được sửa trực tiếp state?
Props do component **cha** truyền vào và là chỉ đọc với component con; state do chính component **sở hữu** và đổi bằng hàm `set…`. React phát hiện thay đổi bằng cách so **tham chiếu** (`Object.is`) giá trị mới với cũ: sửa trực tiếp (`items.push(x); setItems(items)`) giữ nguyên tham chiếu nên React coi như không đổi và **không render lại** (đã chạy thử: số phần tử hiển thị vẫn là 1). Luôn tạo giá trị mới: `setItems([...items, x])`. Giống tinh thần của `signal.update()` với giá trị bất biến trong Angular.
:::

:::quiz Viết `<button onClick={save()}>` thay vì `onClick={save}`. Điều gì xảy ra?
- [ ] Giống nhau
- [x] `save()` bị **gọi ngay khi render**, và giá trị trả về (thường `undefined`) được gán làm handler
- [ ] Lỗi biên dịch JSX
- [ ] `save` chạy hai lần khi bấm

Cần tham số thì bọc: `onClick={() => save(id)}`.
:::

:::quiz Danh sách dùng `key={index}`, mỗi dòng có ô input giữ state riêng. Xoá phần tử đầu tiên thì sao?
- [ ] Đúng như mong đợi
- [x] State của dòng đầu "trôi" sang dòng tiếp theo — React ghép state theo key, và key 0 vẫn còn
- [ ] React báo lỗi
- [ ] Mọi ô input bị xoá trắng

Đã chạy thử với Testing Library.
:::

:::quiz `{count && <Badge n={count} />}` khi `count = 0` hiển thị gì?
- [ ] Không gì
- [x] Chữ `0`
- [ ] Badge với n = 0
- [ ] Lỗi

`0 && …` trả về `0`, và React render số 0. Viết `{count > 0 && …}`.
:::
