---
title: "Tổ chức state cho trang bán hàng — server state, client state, URL state, và tách context để bớt render"
summary: "Phân loại state của một trang bán hàng rồi đặt mỗi loại đúng chỗ: sản phẩm từ API vào TanStack Query, giỏ hàng vào reducer + context, bộ lọc lên URL. Đo thật: một context chung làm nút Thêm render lại 4/4 lần, tách context state và dispatch còn 1 lần. Kèm reducer giỏ hàng có test."
level: intermediate
version: 19
lastReviewed: 2026-11-13
tags: [react, state-management, context, usereducer, architecture]
related: [react/review/architecture/nang-state-context-va-reducer, react/deep-dive/architecture/hieu-nang-va-react-compiler]
---

## TL;DR

- Hỏi "state này **thuộc về ai** và **sống bao lâu**?" trước khi hỏi "dùng thư viện gì".
- **Server state** (danh sách sản phẩm, đơn hàng) → TanStack Query. **Client state** (giỏ hàng, modal mở/đóng) → `useState`/`useReducer`, chia sẻ bằng context. **URL state** (bộ lọc, trang, tab) → query string để chia sẻ link và nút Back hoạt động.
- Context gửi **cả giá trị** cho mọi nơi đọc nó: object `{ lines, dispatch }` đổi là tất cả render lại. Tách **context dữ liệu** và **context hành động** (dispatch ổn định).
- Không lưu trùng: dữ liệu suy ra (tổng tiền, số lượng) **tính** từ state, không lưu thêm.

## Phân loại state của trang bán hàng

| State | Loại | Đặt ở |
|---|---|---|
| Danh sách sản phẩm, tồn kho | Server | `useQuery(['products', filters])` |
| Bộ lọc danh mục, khoảng giá, trang | URL | `?category=gia-dung&page=2` (router) |
| Ô tìm kiếm đang gõ | UI cục bộ | `useState` + `useDebouncedValue` → đẩy lên URL khi ngừng gõ |
| Giỏ hàng | Client, nhiều nơi dùng | `useReducer` + context (+ `localStorage` để giữ khi tải lại) |
| Tổng tiền, số món trong giỏ | Suy ra | Tính từ giỏ hàng |
| Modal xác nhận đang mở | UI cục bộ | `useState` trong component cha của modal |
| Người dùng đăng nhập | Server (session) | `useQuery(['me'])` hoặc context nạp một lần |

## Reducer và hai context

```tsx title="cart.tsx"
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

const CartStateContext = createContext<Line[] | null>(null);
const CartDispatchContext = createContext<React.Dispatch<Action> | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, []);
  return (
    <CartDispatchContext value={dispatch}>          {/* dispatch từ useReducer luôn ổn định */}
      <CartStateContext value={lines}>{children}</CartStateContext>
    </CartDispatchContext>
  );
}

export const useCartLines = () => useContext(CartStateContext)!;
export const useCartDispatch = () => useContext(CartDispatchContext)!;
```

```ts title="cart.test.ts"
test('add hai lần cùng sản phẩm → một dòng qty 2, mảng mới', () => {
  const X = { productId: 1, name: 'Nồi chiên', price: 1_500_000 };
  const a = cartReducer([], { type: 'add', product: X });
  const b = cartReducer(a, { type: 'add', product: X });
  expect(b).toEqual([{ ...X, qty: 2 }]);
  expect(a).not.toBe(b);
  expect(cartReducer(b, { type: 'setQty', productId: 1, qty: 0 })).toEqual([]);
});
```

## Số đo: một context hay hai context

`Header` (đọc giỏ để hiện số món) và `AddButtons` (chỉ gọi `dispatch`), cả hai bọc `memo`, bấm "Thêm" 3 lần:

| Cách | `Header` render | `AddButtons` render |
|---|---|---|
| Một context `{ lines, dispatch }` | 4 | **4** — object mới mỗi lần nên mọi nơi đọc đều render |
| Tách `CartStateContext` và `CartDispatchContext` | 4 | **1** — chỉ đọc `dispatch` không đổi |

Với trang có hàng trăm nút "Thêm vào giỏ", khác biệt này đáng kể. Khi giỏ hàng phức tạp hơn (nhiều nơi đọc từng phần nhỏ), chuyển sang Zustand/Redux Toolkit để đọc theo selector.

## Pitfalls

```tsx bad
const [products, setProducts] = useState([]);           // copy dữ liệu server vào state
useEffect(() => { fetch('/api/products').then(…).then(setProducts) }, []);
const [cartCount, setCartCount] = useState(0);          // lưu trùng thứ suy ra được
```

```tsx bad
<CartContext value={{ lines, dispatch, total: sum(lines) }}>   // object mới mỗi render của Provider
```

Nếu buộc phải dùng một context: `const value = useMemo(() => ({ lines, dispatch }), [lines])` — ít nhất không đổi khi Provider render lại vì lý do khác.

:::senior Góc nhìn senior
Thói quen từ Angular "mọi thứ vào một service toàn cục" dễ biến thành "mọi thứ vào một context/Redux store" ở React. Phần lớn state trong app quản trị là **server state** — giao cho TanStack Query thì phần client state còn lại thường nhỏ đến mức `useState` + một hai context là đủ. Đưa bộ lọc lên URL là chi tiết nhỏ nhưng người dùng cảm nhận ngay: chia sẻ được link, F5 không mất bộ lọc, nút Back đúng.
:::

:::version Thư viện state
Hiện phổ biến: Zustand (nhỏ, hook-based), Redux Toolkit (+ RTK Query) cho team lớn cần quy ước chặt, Jotai (state nguyên tử). React 19 cho `<Context value>` trực tiếp và `use(Context)`; React Compiler giảm render thừa nhưng không đổi việc context truyền **cả** giá trị.
:::

:::interview Bạn quyết định đặt một mẩu state ở đâu trong ứng dụng React?
Bắt đầu từ chỗ **thấp nhất** dùng nó (`useState` trong component); nhiều component anh em cần thì nâng lên cha chung; nhiều tầng/nhiều nhánh cần thì context hoặc store. Trước đó phân loại: dữ liệu từ server → thư viện server state (TanStack Query) vì cần cache, làm mới, đồng bộ; trạng thái cần chia sẻ qua link/F5 → URL; giá trị suy ra → tính, không lưu. Kiểm thêm: state có bị lưu ở hai nơi không (nguồn bug đồng bộ), và context có đang làm render lại nhiều component không cần thiết không.
:::

:::quiz `Header` và `AddButtons` cùng đọc một context `{ lines, dispatch }`. `AddButtons` chỉ dùng `dispatch`. Bấm "Thêm" 3 lần, `AddButtons` (bọc memo) render bao nhiêu lần?
- [ ] 1
- [x] 4 — giá trị context là object mới mỗi lần nên mọi component đọc nó đều render, memo không chặn được
- [ ] 3
- [ ] 0

Đã đo. Tách context dispatch riêng: 1 lần.
:::

:::quiz Bộ lọc "danh mục, khoảng giá, trang" của trang sản phẩm nên lưu ở đâu?
- [ ] `useState` trong component danh sách
- [ ] Redux store
- [x] Query string của URL — chia sẻ được link, F5 và nút Back giữ đúng bộ lọc
- [ ] `localStorage`

Component đọc bộ lọc từ URL và đưa vào `queryKey` của `useQuery`.
:::

:::exercise Giữ giỏ hàng qua F5 và đồng bộ giữa các tab
Mở rộng `CartProvider`: (1) giỏ hàng còn nguyên sau khi tải lại trang; (2) mở hai tab, thêm sản phẩm ở tab A thì tab B cập nhật; (3) dữ liệu hỏng trong `localStorage` không làm vỡ trang. Viết code và mô tả cách kiểm tra.
???
```tsx
const KEY = 'cart:v1';
function load(): Line[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

type Act = Action | { type: 'replace'; lines: Line[] };
function reducer(lines: Line[], a: Act): Line[] {
  return a.type === 'replace' ? a.lines : cartReducer(lines, a);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, dispatch] = useReducer(reducer, undefined, load);           // lazy init
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {} }, [lines]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) dispatch({ type: 'replace', lines: load() }); };
    window.addEventListener('storage', onStorage);                          // chỉ bắn ở các tab KHÁC
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return (
    <CartDispatchContext value={dispatch}>
      <CartStateContext value={lines}>{children}</CartStateContext>
    </CartDispatchContext>
  );
}
```

Kiểm: thêm hai sản phẩm, F5 → còn; mở tab thứ hai cùng trang, thêm ở tab một → tab hai cập nhật (sự kiện `storage`); trong DevTools đặt `localStorage['cart:v1'] = '{hỏng'`, F5 → giỏ rỗng, không lỗi. Test tự động: `localStorage.setItem(KEY, …)` trước khi render để kiểm lazy init; `window.dispatchEvent(new StorageEvent('storage', { key: KEY }))` để kiểm đồng bộ tab. Khoá có `:v1` để đổi cấu trúc sau này mà không đọc nhầm dữ liệu cũ.
:::
