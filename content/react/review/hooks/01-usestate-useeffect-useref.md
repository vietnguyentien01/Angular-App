---
title: "useState, useEffect, useRef, useMemo, useCallback và quy tắc của hook"
summary: "Nhắc nhanh các hook dùng hằng ngày và thứ tự chạy thật của effect (đã đo: effect 1 → cleanup 1 → effect 2 → cleanup 2), vì sao StrictMode chạy effect hai lần ở dev, functional updater khi cập nhật liên tiếp, và hai quy tắc của hook. Đối chiếu với signal, effect và ngOnDestroy của Angular."
type: card
level: core
version: 19
lastReviewed: 2026-11-13
tags: [react, hooks, useeffect, usestate]
related: [react/consolidate/hooks/sua-bug-useeffect, react/deep-dive/hooks/ben-trong-hook]
---

## TL;DR

- `useState` — state gây render lại. Cập nhật dựa trên giá trị cũ thì dùng **functional updater** `setN(n => n + 1)`.
- `useEffect(fn, deps)` — đồng bộ với **thế giới bên ngoài** (API, timer, DOM, subscription) **sau** khi render. `fn` có thể trả hàm **cleanup**. Chạy lại khi một giá trị trong `deps` đổi.
- `useRef` — giá trị giữ qua các lần render **mà không** gây render (tham chiếu DOM, id timer).
- `useMemo`/`useCallback` — ghi nhớ giá trị/hàm giữa các lần render; chỉ dùng khi đo thấy cần (hoặc để giữ ổn định cho `memo`/deps).
- Hai quy tắc: chỉ gọi hook ở **cấp cao nhất** của component/custom hook (không trong `if`, vòng lặp), và chỉ trong **component hoặc custom hook**.

## Ví dụ

```tsx
import { useEffect, useRef, useState } from 'react';

export function OrderSearch({ customerId }: { customerId: number }) {
  const [q, setQ] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();                     // chạy một lần sau lần render đầu
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/customers/${customerId}/orders?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((body) => setOrders(body.data))
      .catch((e) => { if (e.name !== 'AbortError') console.error(e); });
    return () => controller.abort();               // huỷ request cũ khi q/customerId đổi hoặc unmount
  }, [customerId, q]);

  return (
    <>
      <label htmlFor="q">Tìm đơn</label>
      <input id="q" ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul>{orders.map((o) => <li key={o.id}>#{o.id} — {o.status}</li>)}</ul>
    </>
  );
}
```

## Thứ tự chạy (đo bằng Testing Library)

| Tình huống | Thứ tự |
|---|---|
| Render lần đầu, effect có deps `[id]` với id = 1 | render → `effect 1` |
| Props đổi id = 2 | render → `cleanup 1` → `effect 2` |
| Render lại với id = 2 (không đổi) | render, **không** chạy effect |
| Unmount | `cleanup 2` |
| Trong `<StrictMode>` (chỉ ở dev) | render → render → effect → **cleanup → effect** |

StrictMode cố ý chạy effect, cleanup, effect thêm một lần để lộ ra effect thiếu cleanup. Production chỉ chạy một lần.

## Đối chiếu với Angular

| Angular | React |
|---|---|
| `signal()` / `set` / `update` | `useState` / `setX(v)` / `setX(prev => …)` |
| `computed()` | Tính trong thân hàm; `useMemo` nếu tốn kém |
| `effect()` | `useEffect` (nhưng deps khai báo **tay**, không tự theo dõi) |
| `ngOnDestroy`, `DestroyRef.onDestroy` | Hàm cleanup trả về từ `useEffect` |
| `viewChild()` | `useRef` gắn vào `ref={…}` |
| Service có state + `inject()` | Custom hook (`useCart()`), context |

## Lỗi hay gặp: cập nhật liên tiếp với giá trị cũ

```tsx bad
setCount(count + 1); setCount(count + 1); setCount(count + 1);   // sau một lần bấm: 1
```

```tsx good
setCount((c) => c + 1); setCount((c) => c + 1); setCount((c) => c + 1);   // sau một lần bấm: 3
```

`count` trong một lần render là **hằng số** — ba lệnh đều thấy `0`. Đã chạy thử cả hai.

:::version React 18 → 19
React 18 bật **automatic batching** cho mọi cập nhật (cả trong `setTimeout`, Promise); React 17 chỉ gộp trong event handler. React 19 thêm hook `use`, `useActionState`, `useOptimistic`, `useFormStatus` (bài Dữ liệu & form). React Compiler (ổn định từ 2025) tự ghi nhớ — giảm nhu cầu viết `useMemo`/`useCallback` tay.
:::

:::interview Khi nào nên dùng useEffect và khi nào không?
Dùng để **đồng bộ với hệ thống bên ngoài React**: gọi API khi id đổi (kèm huỷ request cũ), đăng ký/huỷ event listener, timer, WebSocket, tích hợp thư viện DOM. **Không** cần effect cho: giá trị tính từ props/state (tính thẳng khi render), phản ứng với hành động người dùng (làm trong event handler), reset state khi props đổi (dùng `key`). Effect "sửa state sau khi render" gây render thừa và dễ thành vòng lặp. Với gọi API phức tạp (cache, retry, đồng bộ), dùng thư viện như TanStack Query.
:::

:::quiz Effect `useEffect(() => { … return cleanup }, [id])`. Props đổi `id` từ 1 sang 2. Thứ tự?
- [ ] effect 2 → cleanup 1
- [x] cleanup 1 → effect 2
- [ ] Chỉ effect 2
- [ ] cleanup 1 → cleanup 2 → effect 2

Đã đo: `effect 1 → cleanup 1 → effect 2 → cleanup 2` (bước cuối là khi unmount).
:::

:::quiz Ở môi trường dev, effect với `deps = []` in log hai lần. Nguyên nhân thường gặp nhất?
- [ ] Bug của React
- [x] `<StrictMode>` cố ý mount → unmount → mount lại để kiểm cleanup; production chỉ chạy một lần
- [ ] Deps rỗng nghĩa là chạy mọi lần render
- [ ] Component bị render hai lần do CSS

Đã đo trong StrictMode: render → render → effect → cleanup → effect.
:::

:::quiz Giá trị nào nên để trong `useRef` thay vì `useState`?
- [ ] Danh sách sản phẩm hiển thị
- [x] Id của `setInterval` cần để `clearInterval` sau này
- [ ] Nội dung ô input đang hiển thị
- [ ] Số lượng trong giỏ hàng

Đổi `ref.current` không gây render — phù hợp cho giá trị không xuất hiện trên giao diện.
:::
