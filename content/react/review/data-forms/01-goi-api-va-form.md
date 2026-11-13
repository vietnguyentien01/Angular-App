---
title: "Gọi API và form trong React — loading/error, race condition, TanStack Query, controlled input"
summary: "Ba trạng thái của một lần gọi API, vì sao useEffect + fetch dễ dính race condition và cách huỷ bằng AbortController, khi nào chuyển sang TanStack Query, form controlled và uncontrolled, validation bằng Zod. Đối chiếu với HttpClient, httpResource và Reactive/Signal Forms của Angular."
type: card
level: core
version: 19
lastReviewed: 2026-11-13
tags: [react, fetch, tanstack-query, forms]
related: [react/consolidate/data-forms/tanstack-query-va-form, react/deep-dive/data-forms/react-19-actions-va-use]
---

## TL;DR

- Mỗi lần gọi API có ba trạng thái: **đang tải**, **lỗi**, **có dữ liệu** — giao diện phải xử lý cả ba.
- `useEffect` + `fetch` tự viết: phải **huỷ request cũ** (AbortController hoặc cờ `ignore`) khi tham số đổi, nếu không kết quả cũ về sau ghi đè kết quả mới.
- Dữ liệu từ server (danh sách, chi tiết, cache, làm mới) → **TanStack Query** (`useQuery`, `useMutation`) thay vì tự quản lý.
- Form: **controlled** (`value` + `onChange`, React giữ giá trị) cho form cần validate theo từng phím; **uncontrolled** (`FormData` khi submit) cho form đơn giản. Validate bằng schema (Zod) dùng chung với backend.

## TanStack Query

```tsx title="main.tsx"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();
root.render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
```

```tsx title="ProductPage.tsx"
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

function useProducts(q: string) {
  return useQuery({
    queryKey: ['products', q],                              // khoá cache — đổi q là query mới
    queryFn: async ({ signal }) => {
      const r = await fetch(`/api/products?q=${encodeURIComponent(q)}`, { signal });   // tự huỷ khi không cần
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).data as Product[];
    },
    staleTime: 30_000,
  });
}

export function ProductPage({ q }: { q: string }) {
  const { data, isPending, error } = useProducts(q);
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (p: NewProduct) => fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),   // làm mới danh sách
  });

  if (isPending) return <p>Đang tải…</p>;
  if (error) return <p role="alert">Không tải được: {error.message}</p>;
  return <ul>{data.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

## Form controlled với Zod

```tsx
import { z } from 'zod';
const ProductInput = z.object({ name: z.string().trim().min(1, 'Bắt buộc'), price: z.coerce.number().int().positive('Giá phải > 0') });

export function ProductForm({ onSubmit }: { onSubmit: (p: z.infer<typeof ProductInput>) => void }) {
  const [values, setValues] = useState({ name: '', price: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = ProductInput.safeParse(values);
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrors({});
    onSubmit(r.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="name">Tên</label>
      <input id="name" value={values.name} aria-invalid={!!errors.name} aria-describedby="name-err"
             onChange={(e) => setValues({ ...values, name: e.target.value })} />
      {errors.name && <p id="name-err" role="alert">{errors.name}</p>}
      {/* … price tương tự … */}
      <button type="submit">Lưu</button>
    </form>
  );
}
```

## Đối chiếu với Angular

| Angular | React |
|---|---|
| `HttpClient` + interceptor | `fetch`/axios + một hàm bọc chung (gắn header, xử lý 401) |
| `httpResource()` / `resource()` | `useQuery` của TanStack Query |
| `switchMap` huỷ request cũ | `AbortController` trong cleanup của effect, hoặc `signal` của TanStack Query |
| Reactive Forms / Signal Forms | State + `onChange`, hoặc React Hook Form; validate bằng Zod |
| `async` pipe | `isPending`/`data`/`error` của `useQuery` |

## Lỗi hay gặp: race condition

```tsx bad
useEffect(() => {
  fetch(`/api/products?q=${q}`).then((r) => r.json()).then((b) => setItems(b.data));
}, [q]);
// Gõ "may" rồi "may loc": request "may" về SAU request "may loc" → danh sách hiển thị kết quả của "may"
```

Sửa: trả cleanup `() => controller.abort()` (hoặc cờ `let ignore = false; … return () => { ignore = true }`), hoặc dùng TanStack Query. Bài Củng cố tái hiện lỗi này bằng test.

:::version React 19 Actions
React 19 cho `<form action={fn}>` nhận hàm async, kèm `useActionState` (state + pending của lần submit), `useFormStatus`, `useOptimistic`. Hợp với form gửi một lần; TanStack Query vẫn là lựa chọn chính cho đọc dữ liệu có cache. Xem bài Chuyên sâu.
:::

:::interview Vì sao nên dùng TanStack Query (hoặc SWR) thay vì tự viết useEffect + fetch?
Vì dữ liệu từ server cần nhiều thứ hơn "gọi một lần": cache theo khoá và chia sẻ giữa các component, chống gọi trùng, huỷ request cũ, retry, làm mới khi quay lại tab hoặc sau mutation (`invalidateQueries`), trạng thái loading/error thống nhất, phân trang/infinite scroll. Tự viết bằng `useEffect` dễ sót race condition, rò rỉ request, và lặp code. Nó tương đương vai trò của `httpResource`/RxJS + service cache trong Angular.
:::

:::quiz Người dùng gõ nhanh "may" rồi "may loc". Effect gọi `fetch` không có cleanup. Request "may" về chậm hơn. Màn hình hiển thị?
- [ ] Kết quả "may loc"
- [x] Kết quả "may" — kết quả cũ về sau ghi đè kết quả mới
- [ ] Cả hai gộp lại
- [ ] Lỗi

Cần huỷ/bỏ qua request cũ trong cleanup.
:::

:::quiz Sau khi tạo sản phẩm bằng `useMutation`, làm sao để danh sách `useQuery(['products', q])` cập nhật?
- [ ] Tải lại trang
- [x] `queryClient.invalidateQueries({ queryKey: ['products'] })` trong `onSuccess` — mọi query có khoá bắt đầu bằng `products` được làm mới
- [ ] Gọi lại `useQuery` trong `onSuccess`
- [ ] Đặt `staleTime: 0`

Hook không được gọi trong callback; invalidate là cách đúng.
:::

:::quiz Ô input `<input value={name} />` không có `onChange`. Người dùng gõ phím thì sao?
- [ ] Gõ được bình thường
- [x] Không gõ được — input controlled luôn hiển thị đúng `name`; React cảnh báo thiếu `onChange` (hoặc dùng `defaultValue` nếu muốn uncontrolled)
- [ ] Lỗi biên dịch
- [ ] Gõ được nhưng không lưu

Controlled: `value` + `onChange`. Uncontrolled: `defaultValue`, đọc bằng `FormData`/`ref`.
:::
