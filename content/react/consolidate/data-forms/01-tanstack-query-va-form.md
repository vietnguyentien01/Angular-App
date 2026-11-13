---
title: "Trang sản phẩm với TanStack Query và form có validation — kèm 4 test chạy thật"
summary: "Danh sách dùng useQuery, form thêm sản phẩm dùng useMutation và tự làm mới danh sách bằng invalidateQueries, validation bằng Zod có thông báo lỗi gắn aria-describedby, xử lý lỗi 409 từ server, nút Lưu khoá khi đang gửi. Bốn test Testing Library với fetch giả lập đều xanh."
level: intermediate
version: 19
lastReviewed: 2026-11-13
tags: [react, tanstack-query, forms, zod, testing, accessibility]
related: [react/review/data-forms/goi-api-va-form, nodejs/consolidate/rest-api/viet-api-co-test]
---

## TL;DR

- `useQuery({ queryKey, queryFn })` cho đọc; `useMutation({ mutationFn, onSuccess })` cho ghi; `invalidateQueries` để danh sách tự tải lại sau khi ghi.
- Một hàm `api()` bọc `fetch`: gắn header, ném lỗi khi `!r.ok` (TanStack Query chỉ coi Promise bị **reject** là lỗi — `fetch` không tự reject với HTTP 4xx/5xx).
- Validate trước khi gửi bằng Zod; lỗi hiển thị cạnh ô, có `role="alert"`, ô có `aria-invalid` và `aria-describedby`.
- Test như người dùng: tìm theo **label/role/text**, gõ và bấm bằng `userEvent`, giả lập `fetch` thay vì gọi server thật.

## Cài đặt

```bash
npm install @tanstack/react-query zod
npm install --save-dev vitest jsdom @testing-library/react @testing-library/user-event @testing-library/dom @vitejs/plugin-react
```

```js title="vitest.config.js"
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], test: { environment: 'jsdom' } });
```

## Code

```jsx title="products.jsx"
import { useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

async function api(path, init) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? `HTTP ${r.status}`), { status: r.status, body });
  }
  return r.status === 204 ? null : r.json();
}

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: () => api('/api/products').then((b) => b.data) });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p) => api('/api/products', { method: 'POST', body: JSON.stringify(p) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

const ProductInput = z.object({
  name: z.string().trim().min(1, 'Nhập tên sản phẩm'),
  price: z.coerce.number({ error: 'Giá phải là số' }).int('Giá phải là số nguyên').positive('Giá phải lớn hơn 0'),
});

export function ProductForm() {
  const [values, setValues] = useState({ name: '', price: '' });
  const [errors, setErrors] = useState({});
  const create = useCreateProduct();

  function handleSubmit(e) {
    e.preventDefault();
    const r = ProductInput.safeParse(values);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    create.mutate(r.data, { onSuccess: () => setValues({ name: '', price: '' }) });
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Thêm sản phẩm">
      <label htmlFor="p-name">Tên</label>
      <input id="p-name" value={values.name} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'p-name-err' : undefined}
             onChange={(e) => setValues({ ...values, name: e.target.value })} />
      {errors.name && <p id="p-name-err" role="alert">{errors.name}</p>}

      <label htmlFor="p-price">Giá (₫)</label>
      <input id="p-price" inputMode="numeric" value={values.price} aria-invalid={!!errors.price} aria-describedby={errors.price ? 'p-price-err' : undefined}
             onChange={(e) => setValues({ ...values, price: e.target.value })} />
      {errors.price && <p id="p-price-err" role="alert">{errors.price}</p>}

      {create.error && <p role="alert">Không lưu được: {create.error.message}</p>}
      <button type="submit" disabled={create.isPending}>{create.isPending ? 'Đang lưu…' : 'Lưu'}</button>
    </form>
  );
}

export function ProductList() {
  const { data, isPending, error } = useProducts();
  if (isPending) return <p>Đang tải…</p>;
  if (error) return <p role="alert">Không tải được: {error.message}</p>;
  return <ul aria-label="Sản phẩm">{data.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}

export function ProductPage({ client = new QueryClient() }) {
  return <QueryClientProvider client={client}><ProductForm /><ProductList /></QueryClientProvider>;
}
```

Điểm chính: `aria-describedby` chỉ trỏ tới thông báo lỗi khi có lỗi; `noValidate` tắt bong bóng validate mặc định của trình duyệt để hiển thị lỗi thống nhất; `create.isPending` khoá nút để không gửi hai lần.

## Test

```jsx title="products.test.jsx"
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ProductPage } from './products.jsx';

let db;
beforeEach(() => {
  db = [{ id: 1, name: 'Máy lọc nước', price: 5000000 }];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      if (body.name === 'Trùng') return new Response(JSON.stringify({ error: 'DUPLICATE' }), { status: 409 });
      const p = { id: db.length + 1, ...body }; db.push(p);
      return new Response(JSON.stringify(p), { status: 201 });
    }
    return new Response(JSON.stringify({ data: db }), { status: 200 });
  });
});
afterEach(cleanup);
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

test('hiển thị danh sách', async () => {
  render(<ProductPage client={client()} />);
  expect(screen.getByText('Đang tải…')).toBeTruthy();
  expect(await screen.findByText('Máy lọc nước')).toBeTruthy();
});

test('validation hiển thị lỗi và không gọi API', async () => {
  render(<ProductPage client={client()} />);
  await screen.findByText('Máy lọc nước');
  await userEvent.type(screen.getByLabelText('Giá (₫)'), '-5');
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  const alerts = screen.getAllByRole('alert').map((a) => a.textContent);
  expect(alerts).toEqual(['Nhập tên sản phẩm', 'Giá phải lớn hơn 0']);
  expect(screen.getByLabelText('Tên').getAttribute('aria-invalid')).toBe('true');
  expect(fetch.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0);
});

test('tạo mới thì danh sách tự làm mới', async () => {
  render(<ProductPage client={client()} />);
  await screen.findByText('Máy lọc nước');
  await userEvent.type(screen.getByLabelText('Tên'), 'Nồi chiên');
  await userEvent.type(screen.getByLabelText('Giá (₫)'), '1500000');
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  const list = screen.getByRole('list', { name: 'Sản phẩm' });
  expect(await within(list).findByText('Nồi chiên')).toBeTruthy();
  expect(screen.getByLabelText('Tên').value).toBe('');
});

test('lỗi từ server', async () => {
  render(<ProductPage client={client()} />);
  await screen.findByText('Máy lọc nước');
  await userEvent.type(screen.getByLabelText('Tên'), 'Trùng');
  await userEvent.type(screen.getByLabelText('Giá (₫)'), '100');
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  expect((await screen.findByText(/Không lưu được/)).textContent).toBe('Không lưu được: DUPLICATE');
});
```

```bash
npx vitest run
# Tests  4 passed (4)
```

`retry: false` trong test để lỗi hiện ngay (mặc định TanStack Query thử lại 3 lần với query). Mỗi test tạo `QueryClient` mới để cache không rò giữa các test.

## Pitfalls

```jsx bad
queryFn: () => fetch('/api/products').then((r) => r.json())   // 500 vẫn "thành công" với body lỗi
```

```jsx bad
onSuccess: () => { products.push(newProduct) }                 // sửa trực tiếp cache → UI không cập nhật
```

```jsx bad
<input placeholder="Tên" />                                     // placeholder không thay được label
```

:::senior Góc nhìn senior
Ranh giới rõ ràng giúp code React sống lâu: `api()` là lớp HTTP duy nhất (giống interceptor), hook `useProducts`/`useCreateProduct` là lớp "service" (khoá cache đặt một chỗ), component chỉ hiển thị và gọi hook. Dùng chung schema Zod giữa backend (validate request) và frontend (validate form) — hoặc sinh client từ OpenAPI — để hai bên không lệch nhau. Test theo hành vi người dùng (Testing Library) thay vì kiểm state nội bộ: đổi cách cài đặt mà hành vi giữ nguyên thì test vẫn xanh.
:::

:::version TanStack Query v5 và React Hook Form
TanStack Query v5 dùng `isPending` (v4 là `isLoading`), một object tham số duy nhất cho `useQuery`. Form lớn thường dùng React Hook Form + `@hookform/resolvers/zod` để giảm render và code; React 19 có `useActionState` cho form đơn giản (bài Chuyên sâu).
:::

:::interview Bạn test một component React gọi API thế nào?
Render component trong môi trường jsdom bằng Testing Library, bọc trong các provider cần thiết (QueryClient mới mỗi test, router nếu có). Giả lập tầng mạng: mock `fetch` hoặc dùng MSW để trả dữ liệu theo URL/method. Tương tác như người dùng (`userEvent.type`, `click`), tìm phần tử theo role/label/text, chờ thay đổi bất đồng bộ bằng `findBy…`/`waitFor`. Kiểm các trạng thái: đang tải, có dữ liệu, lỗi từ server, validation, và rằng API được gọi (hoặc không được gọi) đúng lúc.
:::

:::quiz Server trả `500`. `queryFn` viết `() => fetch(url).then((r) => r.json())`. `useQuery` báo gì?
- [ ] `error` với status 500
- [x] Thành công — `fetch` chỉ reject khi lỗi mạng; phải tự kiểm `r.ok` và ném lỗi
- [ ] Tự retry rồi báo lỗi
- [ ] Treo ở trạng thái loading

Hàm `api()` trong bài ném lỗi kèm `status` và body.
:::

:::quiz Trong test "validation", nhập giá `-5` và để trống tên rồi bấm Lưu. Kết quả đã kiểm?
- [ ] Gửi POST và server báo lỗi
- [x] Hai thông báo "Nhập tên sản phẩm" và "Giá phải lớn hơn 0", ô tên có `aria-invalid="true"`, không có request POST nào
- [ ] Chỉ báo lỗi đầu tiên
- [ ] Trình duyệt hiện bong bóng lỗi mặc định

`noValidate` tắt bong bóng của trình duyệt.
:::

:::exercise Thêm xoá sản phẩm với cập nhật lạc quan
Thêm nút "Xoá" cho mỗi dòng: gọi `DELETE /api/products/:id`; sản phẩm biến mất **ngay** khi bấm (optimistic update); nếu server lỗi, sản phẩm hiện lại và có thông báo lỗi; nút có tên dễ hiểu cho trình đọc màn hình. Viết hook `useDeleteProduct` và hai test (thành công, server lỗi).
???
```jsx
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/api/products/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['products'] });              // chặn lần tải đang chạy ghi đè
      const previous = qc.getQueryData(['products']);
      qc.setQueryData(['products'], (old = []) => old.filter((p) => p.id !== id));   // mảng MỚI
      return { previous };
    },
    onError: (_err, _id, ctx) => qc.setQueryData(['products'], ctx.previous),        // hoàn tác
    onSettled: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

// Trong ProductList
const del = useDeleteProduct();
<li key={p.id}>
  {p.name}
  <button onClick={() => del.mutate(p.id)} aria-label={`Xoá ${p.name}`}>Xoá</button>
</li>
{del.error && <p role="alert">Không xoá được: {del.error.message}</p>}
```

Test thành công: bấm "Xoá Máy lọc nước" → `expect(screen.queryByText('Máy lọc nước')).toBeNull()` ngay sau click (trước khi fetch trả về). Test lỗi: mock `DELETE` trả `500` → dòng biến mất rồi xuất hiện lại (`findByText`) và có `role="alert"`. Mock `fetch` cần nhánh `init.method === 'DELETE'`.
:::
