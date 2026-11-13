---
title: "Bên trong hook — vì sao thứ tự gọi quan trọng, closure theo từng lần render, useLayoutEffect và useSyncExternalStore"
summary: "React lưu state của hook theo thứ tự gọi, nên hook trong if gây lỗi \"Rendered more hooks than during the previous render\" (đã tái hiện). Mỗi lần render là một ảnh chụp props/state; thứ tự render → useLayoutEffect → useEffect; đăng ký nguồn dữ liệu ngoài bằng useSyncExternalStore."
level: advanced
version: 19
lastReviewed: 2026-11-13
tags: [react, hooks, internals, useeffect, usesyncexternalstore]
related: [react/review/hooks/usestate-useeffect-useref, react/consolidate/hooks/sua-bug-useeffect]
---

## TL;DR

- Mỗi component có một **danh sách ô nhớ** cho hook, ghép theo **thứ tự gọi**: lần render nào cũng phải gọi cùng các hook theo cùng thứ tự. Gọi hook trong `if`/vòng lặp → các ô bị lệch.
- Mỗi lần render là một **ảnh chụp**: props, state, và mọi hàm tạo ra trong lần render đó "nhìn thấy" đúng các giá trị của lần ấy (gốc rễ của stale closure).
- Thứ tự một lần cập nhật: **render** (tính JSX) → **commit** (sửa DOM) → `useLayoutEffect` (đồng bộ, trước khi trình duyệt vẽ) → `useEffect` (sau khi vẽ).
- Dữ liệu ngoài React có cơ chế đăng ký (store, `navigator.onLine`, `matchMedia`) → `useSyncExternalStore`, không tự ráp `useState` + `useEffect`.

## Thứ tự gọi hook

```tsx bad
function ProductNote({ showNote }: { showNote: boolean }) {
  const [a] = useState('a');
  if (showNote) {
    useState('note');                 // ô thứ 2 chỉ có lúc showNote = true
  }
  const [b] = useState('b');
  return <p>{a}{b}</p>;
}
// Render với showNote=false rồi true:
// Error: Rendered more hooks than during the previous render.
// (kèm cảnh báo React đã phát hiện thay đổi thứ tự hook)
```

Mô hình đơn giản hoá:

```text
Lần render 1 (showNote=false):  ô#1 = 'a'   ô#2 = 'b'
Lần render 2 (showNote=true):   ô#1 → 'a'   ô#2 → React đưa giá trị 'b' cho useState('note')   ô#3 → ??? (không tồn tại)
```

Vì vậy có hai quy tắc của hook, và rule ESLint `react-hooks/rules-of-hooks` bắt lỗi ngay khi viết. Ngoại lệ duy nhất: `use()` của React 19 được gọi trong `if` vì nó không giữ ô nhớ riêng.

## Mỗi lần render là một ảnh chụp

```tsx
function Counter() {
  const [n, setN] = useState(0);
  function showLater() {
    setTimeout(() => alert(`Bạn đã bấm khi n = ${n}`), 3000);   // n của lần render tạo ra hàm này
  }
  return <><button onClick={() => setN(n + 1)}>{n}</button><button onClick={showLater}>Hiện sau 3 giây</button></>;
}
// Bấm "Hiện sau 3 giây" khi n = 2, rồi bấm tăng tới 5 → alert vẫn báo n = 2
```

Đây là hành vi đúng thiết kế (giống "đóng băng" giá trị lúc hành động xảy ra). Cần giá trị **mới nhất** thì đọc từ `useRef` được cập nhật mỗi lần render, hoặc dùng `useEffectEvent` (React 19.2+) trong effect.

## render → layout effect → effect

Đã đo: `render → layoutEffect → effect`.

| Hook | Chạy khi | Dùng cho |
|---|---|---|
| `useLayoutEffect` | Sau khi sửa DOM, **trước** khi trình duyệt vẽ; chặn việc vẽ | Đo kích thước/vị trí phần tử rồi đặt lại vị trí (tooltip, popover) để không nháy |
| `useEffect` | Sau khi trình duyệt vẽ | Gọi API, đăng ký sự kiện, log — mọi thứ còn lại |

Dùng `useLayoutEffect` cho việc nặng sẽ làm giao diện khựng; mặc định luôn chọn `useEffect`.

## useSyncExternalStore (đã test)

```tsx title="useOnline.ts"
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);   // (đăng ký, đọc giá trị, giá trị khi SSR)
}
// Test: "Trực tuyến" → phát sự kiện offline → "Mất kết nối"
```

Vì sao không `useState` + `useEffect`: giá trị có thể đổi **giữa** lúc render và lúc effect đăng ký (bỏ lỡ thay đổi), và với concurrent rendering, các phần khác nhau của cây có thể đọc các giá trị khác nhau ("tearing"). `useSyncExternalStore` là cách Zustand, Redux và các thư viện store khác kết nối với React.

## Đối chiếu với signals của Angular

| | Angular signals | React hooks |
|---|---|---|
| Theo dõi phụ thuộc | Tự động khi đọc `signal()` | Khai báo tay trong mảng deps |
| Cập nhật | Chỉ phần phụ thuộc vào signal đổi | Gọi lại cả hàm component |
| Giá trị trong callback | Đọc `count()` luôn ra giá trị mới nhất | Closure giữ giá trị của lần render tạo ra nó |
| Ràng buộc gọi | `inject()`/`effect()` trong injection context | Quy tắc thứ tự hook |

:::senior Góc nhìn senior
Hiểu cơ chế giúp đọc lỗi nhanh: "Rendered more/fewer hooks" → có hook trong điều kiện hoặc `return` sớm phía trên một hook; giá trị "cũ" trong callback → closure của lần render trước; giao diện nháy vị trí → cần `useLayoutEffect`; dữ liệu từ store ngoài lệch nhau → thiếu `useSyncExternalStore`. Với dev đến từ signals, điểm khó nhất là chấp nhận "component là hàm chạy lại" — đừng cố mô phỏng signals bằng `useRef` khắp nơi.
:::

:::quiz Vì sao không được gọi `useState` bên trong `if`?
- [ ] Vì hook chậm trong điều kiện
- [x] React ghép state với hook theo **thứ tự gọi**; số/thứ tự hook đổi giữa các lần render làm state bị ghép nhầm hoặc thiếu
- [ ] Vì JSX không hỗ trợ
- [ ] Chỉ là quy ước, không ảnh hưởng gì

Đã tái hiện: "Rendered more hooks than during the previous render."
:::

:::quiz Thứ tự chạy trong một lần mount là?
- [ ] effect → render → layoutEffect
- [x] render → layoutEffect → effect
- [ ] render → effect → layoutEffect
- [ ] layoutEffect → render → effect

Đã đo bằng Testing Library.
:::

:::exercise Hook useMediaQuery
Viết `useMediaQuery(query)` trả `true/false` theo `window.matchMedia(query)` và tự cập nhật khi kích thước cửa sổ đổi, dùng `useSyncExternalStore`. Dùng nó để hiển thị bảng sản phẩm trên màn hình rộng và danh sách thẻ trên điện thoại. Viết test với `matchMedia` giả lập.
???
```ts
export function useMediaQuery(query: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);                                   // subscribe phải ổn định, nếu không React đăng ký lại mỗi render
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

function ProductView({ products }: { products: Product[] }) {
  const wide = useMediaQuery('(min-width: 768px)');
  return wide ? <ProductTable products={products} /> : <ProductCards products={products} />;
}
```

Test: giả lập `window.matchMedia` trả object có `matches` thay đổi được và lưu listener của `addEventListener('change')`; render → kiểm đang hiện bảng; đổi `matches = false` rồi gọi listener trong `act` → hiện thẻ. jsdom không có `matchMedia` sẵn nên luôn phải giả lập. Với layout thuần CSS, ưu tiên media query trong CSS; chỉ dùng hook khi cần render **khác cấu trúc**.
:::
