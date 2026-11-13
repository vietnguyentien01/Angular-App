---
title: "Tổ chức state — nâng state lên, context, useReducer, thư viện state, và React so với Angular"
summary: "State đặt ở component chung gần nhất cần nó; context để truyền xuống sâu không qua từng tầng props; useReducer khi nhiều cách cập nhật liên quan nhau; khi nào cần Zustand/Redux Toolkit và khi nào TanStack Query đã đủ. Kèm bảng so sánh React với Angular để trả lời phỏng vấn."
type: card
level: core
version: 19
lastReviewed: 2026-11-13
tags: [react, state-management, context, usereducer]
related: [react/consolidate/architecture/to-chuc-state-gio-hang, react/deep-dive/architecture/hieu-nang-va-react-compiler]
---

## TL;DR

- **Nâng state lên** (lifting state up): hai component cần chung dữ liệu → đặt state ở **cha chung gần nhất**, truyền xuống bằng props.
- **Context**: dữ liệu nhiều tầng cùng cần (người dùng đăng nhập, theme, giỏ hàng) — tránh "khoan props" qua 5 tầng. Mọi component đọc context **render lại khi giá trị context đổi**.
- **useReducer**: nhiều hành động cùng sửa một khối state (`ADD`, `REMOVE`, `SET_QTY`) — logic thành hàm thuần, dễ test.
- Phân loại state trước khi chọn công cụ: **server state** (dữ liệu từ API) → TanStack Query; **UI/client state** (giỏ hàng, bộ lọc, modal) → useState/useReducer/context, hoặc Zustand/Redux Toolkit khi lớn.

## Ví dụ: giỏ hàng với context + reducer

```tsx title="cart.tsx"
import { createContext, useContext, useReducer, type ReactNode } from 'react';

type Line = { productId: number; name: string; price: number; qty: number };
type Action =
  | { type: 'add'; product: Omit<Line, 'qty'> }
  | { type: 'remove'; productId: number }
  | { type: 'setQty'; productId: number; qty: number };

export function cartReducer(lines: Line[], action: Action): Line[] {
  switch (action.type) {
    case 'add': {
      const found = lines.find((l) => l.productId === action.product.productId);
      return found
        ? lines.map((l) => (l === found ? { ...l, qty: l.qty + 1 } : l))
        : [...lines, { ...action.product, qty: 1 }];
    }
    case 'remove':
      return lines.filter((l) => l.productId !== action.productId);
    case 'setQty':
      return action.qty <= 0
        ? lines.filter((l) => l.productId !== action.productId)
        : lines.map((l) => (l.productId === action.productId ? { ...l, qty: action.qty } : l));
  }
}

const CartContext = createContext<{ lines: Line[]; dispatch: React.Dispatch<Action> } | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, []);
  return <CartContext value={{ lines, dispatch }}>{children}</CartContext>;   // React 19: <Context> thay cho <Context.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart phải nằm trong <CartProvider>');
  const total = ctx.lines.reduce((s, l) => s + l.price * l.qty, 0);
  return { ...ctx, total };
}
```

```tsx
function AddButton({ product }: { product: Product }) {
  const { dispatch } = useCart();
  return <button onClick={() => dispatch({ type: 'add', product: { productId: product.id, name: product.name, price: product.price } })}>Thêm</button>;
}
```

## Chọn công cụ

| State | Công cụ |
|---|---|
| Chỉ một component dùng | `useState` |
| Vài component anh em dùng chung | Nâng lên cha chung |
| Nhiều tầng cùng đọc, ít khi đổi (user, theme, locale) | Context |
| Nhiều hành động phức tạp | `useReducer` (+ context nếu cần chia sẻ) |
| Dữ liệu từ server | TanStack Query (cache, làm mới, loading/error) |
| Client state lớn, cập nhật thường xuyên, nhiều nơi đọc một phần | Zustand / Redux Toolkit (đọc theo selector, chỉ render lại phần cần) |
| Trạng thái trên URL (bộ lọc, trang) | Query string qua router |

## React so với Angular (câu hỏi phỏng vấn kinh điển)

| | Angular | React |
|---|---|---|
| Loại | Framework đầy đủ (router, form, HTTP, DI, i18n) | Thư viện UI; tự chọn router, data fetching, form |
| Template | HTML + control flow `@if/@for` | JSX (JavaScript) |
| Phản ứng thay đổi | Signals — theo dõi chính xác phụ thuộc | Render lại component khi state đổi, so sánh cây ảo |
| Chia sẻ logic/state | Service + DI (`inject()`) | Custom hook, context |
| Bất đồng bộ | RxJS, `resource`/`httpResource` | Promise, TanStack Query |
| Quy ước | Chặt, Angular CLI sinh cấu trúc | Linh hoạt; framework như Next.js/React Router đặt quy ước |

:::version React 19
React 19 cho dùng `<CartContext value={…}>` trực tiếp (thay cho `<CartContext.Provider>`) và đọc context bằng `use(CartContext)` (gọi được cả trong `if`). Redux hiện đại là Redux Toolkit (`createSlice`); Redux "thuần" với `switch` và `connect` thấy ở dự án cũ.
:::

:::interview Khi nào dùng Context, khi nào dùng thư viện quản lý state như Redux/Zustand?
Context là cơ chế **truyền** giá trị xuống cây, không phải công cụ tối ưu: mọi component dùng context render lại khi giá trị đổi. Hợp với dữ liệu ít đổi, nhiều nơi đọc (user, theme, quyền). Khi client state lớn, đổi thường xuyên, nhiều component chỉ cần một phần (giỏ hàng lớn, editor, bảng lọc phức tạp), dùng Zustand/Redux Toolkit để đọc theo selector và chỉ render lại nơi cần. Dữ liệu server thì dùng TanStack Query, không nhét vào Redux.
:::

:::quiz `cartReducer([], { type: 'add', product: X })` rồi `add` X lần nữa. Kết quả?
- [ ] Hai dòng X, mỗi dòng qty 1
- [x] Một dòng X với qty 2
- [ ] Lỗi vì trùng
- [ ] Mảng rỗng

Reducer tìm dòng đã có và tăng `qty`, trả mảng **mới**.
:::

:::quiz Vì sao `cartReducer` dễ test hơn logic viết trực tiếp trong các `onClick`?
- [ ] Vì nó chạy nhanh hơn
- [x] Nó là hàm thuần `(state, action) => state mới` — test bằng gọi hàm và so kết quả, không cần render component
- [ ] Vì React tự test reducer
- [ ] Không dễ hơn

Giống việc tách logic khỏi component vào service thuần trong Angular.
:::

:::quiz Hai component anh em `ProductFilter` và `ProductList` cần chung giá trị bộ lọc. Cách đơn giản nhất?
- [ ] Mỗi component một `useState` rồi đồng bộ bằng `useEffect`
- [x] Đặt state ở component cha chung, truyền `value` + `onChange` cho bộ lọc và `filter` cho danh sách
- [ ] Bắt buộc dùng Redux
- [ ] Dùng biến toàn cục

Hai state đồng bộ bằng effect là nguồn bug kinh điển.
:::
