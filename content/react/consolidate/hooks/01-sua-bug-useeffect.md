---
title: "Sửa bốn bug useEffect kinh điển và viết custom hook — useDebouncedValue, useLocalStorage"
summary: "Tái hiện bằng test rồi sửa: stale closure làm bộ đếm setInterval kẹt ở 1 (sửa xong: 10 sau 100 ms), object trong mảng deps làm effect chạy liên tục (đã chặn ở 50 lần, sửa xong: 1 lần), listener không cleanup vẫn chạy sau khi component bị gỡ, và cách đóng gói logic thành custom hook có test."
level: intermediate
version: 19
lastReviewed: 2026-11-13
tags: [react, useeffect, custom-hooks, testing]
related: [react/review/hooks/usestate-useeffect-useref, react/deep-dive/hooks/ben-trong-hook]
---

## TL;DR

- **Stale closure**: hàm trong effect "nhớ" giá trị state lúc nó được tạo. Dùng functional updater `setN(n => n + 1)` hoặc khai báo đúng deps.
- **Deps là object/mảng/hàm tạo mới mỗi lần render** → effect chạy lại mọi lần → dễ thành vòng lặp. Đưa giá trị nguyên thủy vào deps, hoặc `useMemo`/đưa hằng ra ngoài component.
- Mọi thứ "mở" trong effect (listener, timer, subscription, request) phải được "đóng" trong **cleanup**.
- Logic dùng lại nhiều nơi → **custom hook** (`useXxx`) — tương đương service nhỏ có state trong Angular; test bằng `renderHook`.
- Bật rule ESLint `react-hooks/exhaustive-deps` — nó bắt phần lớn các lỗi deps.

## Bug 1 — stale closure

```tsx bad
function Ticker() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN(n + 1), 10);   // n luôn là 0 của lần render đầu
    return () => clearInterval(t);
  }, []);
  return <p>{n}</p>;
}
// Sau ~100 ms: 1
```

```tsx good
useEffect(() => {
  const t = setInterval(() => setN((x) => x + 1), 10);   // không đọc n từ closure
  return () => clearInterval(t);
}, []);
// Sau ~100 ms: 10
```

## Bug 2 — object trong deps

```tsx bad
function Orders() {
  const [data, setData] = useState(null);
  const options = { page: 1 };                         // object MỚI mỗi lần render
  useEffect(() => { fetchOrders(options).then(setData); }, [options]);
  // setData → render → options mới → effect chạy lại → … (test: 50 lần trước khi bị chặn)
}
```

```tsx good
const page = 1;                                         // giá trị nguyên thủy, hoặc đưa vào props/state
useEffect(() => { fetchOrders({ page }).then(setData); }, [page]);
// Effect chạy 1 lần
```

## Bug 3 — listener không cleanup

```tsx bad
useEffect(() => { window.addEventListener('resize', () => setWidth(window.innerWidth)); }, []);
// Mount/unmount 3 lần rồi resize một lần: handler chạy 3 lần — cả 3 component đã bị gỡ vẫn nghe
```

```tsx good
useEffect(() => {
  const onResize = () => setWidth(window.innerWidth);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, []);
// Gỡ đủ: không còn handler nào sau unmount
```

## Bug 4 — effect cho việc không phải đồng bộ bên ngoài

```tsx bad
useEffect(() => { if (submitted) { toast('Đã lưu'); setSubmitted(false); } }, [submitted]);
```

```tsx good
async function handleSave() { await save(); toast('Đã lưu'); }   // phản ứng với hành động → làm trong event handler
```

## Custom hook (đã có test)

```ts title="hooks.ts"
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);                       // gõ tiếp trước khi hết delay → huỷ lần trước
  }, [value, delay]);
  return debounced;
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {         // lazy init: chỉ đọc localStorage lần đầu
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;                                   // JSON hỏng / storage bị chặn
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* hết quota / bị chặn */ }
  }, [key, value]);
  return [value, setValue] as const;
}
```

```ts title="hooks.test.ts (Vitest + Testing Library)"
import { act, renderHook } from '@testing-library/react';

test('debounce chỉ lấy giá trị cuối sau 300 ms', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'm' } });
  rerender({ v: 'ma' });  act(() => vi.advanceTimersByTime(200));
  rerender({ v: 'may' }); act(() => vi.advanceTimersByTime(200));
  expect(result.current).toBe('m');                    // chưa đủ 300 ms kể từ lần gõ cuối
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe('may');
});

test('useLocalStorage giữ giá trị qua lần mount sau, bỏ qua JSON hỏng', () => {
  const { result, unmount } = renderHook(() => useLocalStorage('cart', [] as number[]));
  act(() => result.current[1]([1, 2]));
  unmount();
  expect(renderHook(() => useLocalStorage('cart', [] as number[])).result.current[0]).toEqual([1, 2]);
  localStorage.setItem('bad', '{hỏng');
  expect(renderHook(() => useLocalStorage('bad', 'x')).result.current[0]).toBe('x');
});
```

Dùng: `const q = useDebouncedValue(input, 300)` rồi đưa `q` vào `useQuery({ queryKey: ['products', q] })` — chỉ gọi API khi người dùng ngừng gõ.

:::senior Góc nhìn senior
Phần lớn bug React trong dự án thật nằm ở `useEffect`: deps sai, thiếu cleanup, dùng effect cho việc không cần effect. Ba hàng rào: rule `react-hooks/exhaustive-deps` bật mức error, StrictMode ở dev (lộ cleanup thiếu), và quy ước "gọi API dùng TanStack Query, không viết fetch trong effect". Custom hook là đơn vị tái sử dụng chính của React — đặt tên rõ, có test riêng, không trả về JSX.
:::

:::version Lint và compiler
`eslint-plugin-react-hooks` (bản mới đi kèm các rule của React Compiler) báo deps thiếu và vi phạm quy tắc hook. React 19 không đổi ngữ nghĩa của `useEffect`; React 19.2 thêm `useEffectEvent` để đọc giá trị mới nhất trong effect mà không đưa vào deps (thay cho mẹo dùng ref).
:::

:::interview Stale closure trong React là gì? Gặp ở đâu và sửa thế nào?
Mỗi lần render tạo một bộ hàm mới "chụp" giá trị props/state của lần render đó. Hàm được tạo một lần rồi dùng lâu dài — callback của `setInterval` trong effect `[]`, listener gắn một lần, callback của thư viện ngoài — sẽ mãi thấy giá trị cũ. Sửa: functional updater khi chỉ cần giá trị trước để tính giá trị sau; khai báo đúng deps để effect tạo lại hàm khi giá trị đổi; hoặc giữ giá trị mới nhất trong `useRef` / dùng `useEffectEvent` (React 19.2+) cho hàm cần đọc giá trị mới mà không muốn chạy lại effect.
:::

:::quiz Effect `[]` tạo `setInterval(() => setN(n + 1), 10)`. Sau khoảng 100 ms, `n` là?
- [ ] 10
- [x] 1 — callback luôn thấy `n = 0`
- [ ] 0
- [ ] Tăng mãi, khoảng 10

Đã đo: 1. Với `setN(x => x + 1)`: 10.
:::

:::quiz `useEffect(() => { … setData(…) }, [options])` với `options = { page: 1 }` khai báo trong thân component. Chuyện gì xảy ra?
- [ ] Effect chạy một lần
- [x] Effect chạy sau mỗi lần render vì `options` là object mới; mỗi lần lại `setData` → render → lặp
- [ ] React tự so sánh sâu object nên không sao
- [ ] Lỗi biên dịch

Đã đo: chạy liên tục tới khi test chặn ở 50 lần.
:::

:::exercise Viết hook useFetchProducts có huỷ request
Viết `useProducts(q)` trả `{ data, isLoading, error }` dùng `fetch('/api/products?q=…')`: huỷ request cũ khi `q` đổi hoặc unmount, không đặt state sau khi đã huỷ, coi HTTP lỗi (`!r.ok`) là error. Viết test bằng `renderHook` với `fetch` giả lập: đổi `q` từ `"may"` sang `"may loc"` trong khi request đầu còn chậm → `data` cuối cùng phải là của `"may loc"`.
???
```ts
export function useProducts(q: string) {
  const [state, setState] = useState<{ data?: Product[]; isLoading: boolean; error?: Error }>({ isLoading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, isLoading: true, error: undefined }));
    fetch(`/api/products?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()).data as Product[];
      })
      .then((data) => setState({ data, isLoading: false }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ error, isLoading: false }); });
    return () => controller.abort();
  }, [q]);
  return state;
}
```

```ts
test('kết quả cũ về muộn không ghi đè', async () => {
  globalThis.fetch = vi.fn((url: string, { signal }: RequestInit) => new Promise((resolve, reject) => {
    const slow = url.endsWith('q=may');
    const t = setTimeout(() => resolve(new Response(JSON.stringify({ data: [{ id: slow ? 1 : 2 }] }))), slow ? 100 : 10);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); });
  })) as typeof fetch;
  const { result, rerender } = renderHook(({ q }) => useProducts(q), { initialProps: { q: 'may' } });
  rerender({ q: 'may loc' });
  await waitFor(() => expect(result.current.data).toEqual([{ id: 2 }]));
  await new Promise((r) => setTimeout(r, 150));
  expect(result.current.data).toEqual([{ id: 2 }]);         // request "may" đã bị huỷ, không ghi đè
});
```

Bài Củng cố tiếp theo cho thấy TanStack Query làm tất cả những việc này sẵn.
:::
