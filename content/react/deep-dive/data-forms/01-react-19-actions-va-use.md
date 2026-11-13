---
title: "React 19 — Actions, useActionState, useFormStatus, useOptimistic, use() với Suspense và Server Components"
summary: "Form gửi bằng <form action={fn}> với useActionState (lỗi, giá trị cũ, isPending), nút tự biết đang gửi nhờ useFormStatus, bình luận hiện ngay bằng useOptimistic rồi thay bằng dữ liệu thật, đọc Promise bằng use() trong Suspense — ba test chạy thật — và Server Components khác gì SPA."
level: advanced
version: 19
lastReviewed: 2026-11-13
tags: [react, react-19, actions, suspense, server-components]
related: [react/review/data-forms/goi-api-va-form, react/consolidate/data-forms/tanstack-query-va-form]
---

## TL;DR

- **Action** = hàm (có thể async) gắn vào `<form action={fn}>` hoặc chạy trong `startTransition`. React tự theo dõi trạng thái đang chạy.
- `useActionState(fn, initial)` → `[state, formAction, isPending]`: kết quả lần gửi gần nhất (lỗi, dữ liệu) + cờ đang gửi — không cần tự viết `useState` cho loading/error.
- `useFormStatus()` (từ `react-dom`) cho component con trong form biết form đang gửi — nút "Lưu" không cần nhận prop.
- `useOptimistic` hiển thị kết quả dự kiến ngay; khi action xong, React bỏ bản tạm và dùng state thật.
- `use(promise)` đọc Promise trong render, kết hợp `<Suspense fallback>`; `use(Context)` đọc context, gọi được cả trong `if`.

## useActionState + useFormStatus (đã test)

```jsx title="NewsletterForm.jsx"
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();           // đọc trạng thái của <form> cha gần nhất
  return <button type="submit" disabled={pending}>{pending ? 'Đang gửi…' : 'Đăng ký'}</button>;
}

export function NewsletterForm({ subscribe }) {
  const [state, formAction, isPending] = useActionState(async (prev, formData) => {
    const email = String(formData.get('email') ?? '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Email không hợp lệ', email };
    try {
      await subscribe(email);
      return { ok: true, email: '' };
    } catch (e) {
      return { error: e.message, email };
    }
  }, { email: '' });

  return (
    <form action={formAction}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" defaultValue={state.email} key={state.email} />
      <SubmitButton />
      {state.error && <p role="alert">{state.error}</p>}
      {state.ok && <p role="status">Đã đăng ký</p>}
    </form>
  );
}
```

Hành vi đã kiểm: email sai → `role="alert"` "Email không hợp lệ" và ô vẫn giữ `sai-email` (React tự reset form không được kiểm soát sau khi action chạy xong, nên trả lại giá trị qua `defaultValue` + `key`); email đúng → trong lúc chờ, nút hiện "Đang gửi…" và bị khoá, `isPending = true`; xong → "Đã đăng ký", ô trống, `subscribe` được gọi đúng **1** lần.

## useOptimistic (đã test)

```jsx title="Comments.jsx"
export function Comments({ initial, send }) {
  const [comments, setComments] = useState(initial);
  const [optimistic, addOptimistic] = useOptimistic(
    comments,
    (list, text) => [...list, { id: 'tam', text, pending: true }],
  );
  async function action(formData) {
    const text = String(formData.get('text'));
    addOptimistic(text);                         // hiện ngay "(đang gửi)"
    const saved = await send(text);
    setComments((c) => [...c, saved]);           // xong action: bản tạm biến mất, bản thật hiện
  }
  return (
    <>
      <ul>{optimistic.map((c) => <li key={c.id}>{c.text}{c.pending ? ' (đang gửi)' : ''}</li>)}</ul>
      <form action={action}>
        <label htmlFor="text">Bình luận</label><input id="text" name="text" />
        <button type="submit">Gửi</button>
      </form>
    </>
  );
}
```

Đã kiểm: bấm Gửi → "Giao nhanh (đang gửi)" xuất hiện trước khi server trả lời; sau khi `send` xong → chỉ còn "Giao nhanh". Nếu `send` ném lỗi, bản tạm tự biến mất (state thật không đổi) — hiển thị lỗi bằng error boundary hoặc bắt lỗi trong action.

## use() với Suspense (đã test)

```jsx
import { Suspense, use } from 'react';

function ProductName({ productPromise }) {
  const product = use(productPromise);           // chưa xong → "treo", Suspense hiện fallback
  return <h1>{product.name}</h1>;
}
export function ProductHeader({ productPromise }) {
  return <Suspense fallback={<p>Đang tải sản phẩm…</p>}><ProductName productPromise={productPromise} /></Suspense>;
}
```

Đã kiểm: trước khi Promise xong hiển thị "Đang tải sản phẩm…", sau đó là `<h1>Máy lọc nước</h1>`. Khi test, render và resolve trong `act(async () => …)` — bản đầu tiên của test (không bọc `act`) không thấy heading trong thời gian chờ mặc định.

Lưu ý: Promise phải được tạo **ngoài** render (trong loader của router, trong cache của thư viện, hoặc ở Server Component) — tạo `fetch()` mới ngay trong component sẽ tạo Promise mới mỗi lần render và treo mãi.

## Server Components (khái niệm)

| | Client Component (SPA như Angular/Vite) | Server Component (Next.js App Router, React Router framework) |
|---|---|---|
| Chạy ở | Trình duyệt | Server (lúc build hoặc mỗi request) |
| Gửi xuống trình duyệt | JavaScript của component | Kết quả render; không gửi code của component |
| Đọc DB/secret trực tiếp | Không — phải qua API | Có |
| Dùng `useState`, `useEffect`, sự kiện | Có | Không — đánh dấu `'use client'` cho phần tương tác |
| Server Actions | — | Hàm `'use server'` gọi từ form như một Action |

Với dev Angular: gần với SSR + hydration của Angular nhưng chia tới từng component — phần tĩnh không tốn JavaScript ở client. Không cần cho app quản trị nội bộ dạng SPA; đáng cân nhắc cho trang công khai cần SEO và tải nhanh.

:::senior Góc nhìn senior
Actions và `useOptimistic` giải quyết đúng chỗ đau của form: trạng thái gửi, lỗi, gửi trùng, phản hồi tức thì — với ít code hơn. Nhưng chúng không thay TanStack Query cho **đọc** dữ liệu có cache và làm mới; hai thứ dùng cùng nhau tốt (`useMutation` cũng có optimistic update). Chọn công nghệ theo loại sản phẩm: SPA quản trị → Vite + React Router + TanStack Query; trang bán hàng cần SEO → framework có Server Components.
:::

:::version React 19.x
`useActionState` (React 19) thay `useFormState` của bản canary/`react-dom` trước đó. `form action={fn}` nhận hàm chỉ có từ React 19 — React 18 cần `onSubmit` + `preventDefault`. Server Components và Server Actions cần framework hỗ trợ (Next.js App Router, React Router v7 chế độ framework…); trong Vite SPA thuần chỉ dùng phần client.
:::

:::quiz Trong `useActionState`, action trả về `{ error: 'Email không hợp lệ', email }`. Giá trị đó đi đâu?
- [ ] Bị bỏ qua
- [x] Thành `state` ở lần render tiếp theo — hiển thị lỗi và điền lại ô bằng `state.email`
- [ ] Ném thành exception
- [ ] Gửi lên server

Giá trị trả về của action là state mới; tham số đầu tiên `prev` là state trước đó.
:::

:::quiz Nút `SubmitButton` gọi `useFormStatus()` nhưng được đặt **ngoài** thẻ `<form>`. `pending` sẽ ra sao?
- [ ] Vẫn đúng như bình thường
- [x] Luôn `false` — `useFormStatus` chỉ đọc trạng thái của `<form>` **cha** chứa nó
- [ ] Lỗi biên dịch
- [ ] Luôn `true`

Đặt nút bên trong form, hoặc dùng `isPending` từ `useActionState` rồi truyền xuống.
:::

:::exercise Chuyển form thêm sản phẩm sang Actions
Viết lại `ProductForm` (bài Củng cố: Zod, lỗi theo ô, khoá nút khi gửi) bằng `useActionState` + `useFormStatus`: không dùng `useState` cho giá trị ô; lỗi validate hiển thị theo ô và **giữ lại** giá trị người dùng đã nhập; thành công thì form trống và danh sách TanStack Query được làm mới.
???
```jsx
function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>;
}

export function ProductFormAction() {
  const qc = useQueryClient();
  const [state, action] = useActionState(async (_prev, fd) => {
    const values = { name: String(fd.get('name') ?? ''), price: String(fd.get('price') ?? '') };
    const r = ProductInput.safeParse(values);
    if (!r.success) return { values, errors: Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])) };
    try {
      await api('/api/products', { method: 'POST', body: JSON.stringify(r.data) });
      await qc.invalidateQueries({ queryKey: ['products'] });
      return { values: { name: '', price: '' }, errors: {}, ok: true };
    } catch (e) {
      return { values, errors: { form: e.message } };
    }
  }, { values: { name: '', price: '' }, errors: {} });

  const k = JSON.stringify(state.values);     // đổi key để defaultValue áp lại sau mỗi lần submit
  return (
    <form action={action} noValidate key={k}>
      <label htmlFor="name">Tên</label>
      <input id="name" name="name" defaultValue={state.values.name} aria-invalid={!!state.errors.name}
             aria-describedby={state.errors.name ? 'name-err' : undefined} />
      {state.errors.name && <p id="name-err" role="alert">{state.errors.name}</p>}
      {/* price tương tự */}
      {state.errors.form && <p role="alert">Không lưu được: {state.errors.form}</p>}
      <SaveButton />
    </form>
  );
}
```

Kiểm bằng lại bốn test của bài Củng cố (đổi tên component) — hành vi người dùng thấy phải giống hệt. Điểm khác: không còn `useState` cho giá trị ô và cờ đang gửi; React tự reset form sau action, nên giá trị cần giữ phải trả về qua `state`.
:::
