---
title: "Đoán số lần render — cha và con, memo, đặt cùng giá trị, state suy ra bằng effect, useState từ props"
summary: "Năm tình huống đếm render đã chạy: cha render 3 lần thì con thường render 3, con bọc memo 1; set cùng giá trị không render lại; state suy ra bằng useEffect tốn 4 lần render thay vì 2; useState(props) không theo props mới cho tới khi đổi key; setState trong thân hàm gây Too many re-renders."
level: intermediate
version: 19
lastReviewed: 2026-11-13
tags: [react, rendering, memo, pitfalls]
related: [react/review/components/jsx-props-state-va-danh-sach, react/deep-dive/components/reconciliation-va-key]
---

## TL;DR

- Component render lại khi: **state của nó đổi**, **cha render lại** (mặc định, kể cả props không đổi), hoặc **context nó đọc đổi**.
- Render ≠ cập nhật DOM: React gọi hàm, so cây mới với cây cũ, chỉ sửa DOM chỗ khác. Render thừa thường rẻ — chỉ tối ưu khi đo thấy chậm.
- Giá trị **tính được** từ props/state thì tính ngay khi render; đừng copy vào state rồi đồng bộ bằng effect.
- Muốn component "bắt đầu lại từ đầu" khi một giá trị đổi → đổi **`key`**.

## Cơ chế

```text
setState(v) ──► Object.is(v, cũ)? ──có──► bỏ qua (không render)
                     │ không
                     ▼
        render component đó và toàn bộ cây con
        (trừ con bọc memo có props không đổi theo Object.is)
                     ▼
        so sánh với cây trước → cập nhật DOM tối thiểu → chạy effect
```

## Năm tình huống (số đo thật)

```tsx title="A. Cha render, con có/không memo"
function Child() { return <p>con</p>; }
const MemoChild = memo(function MemoChild({ label }: { label: string }) { return <p>{label}</p>; });

function Parent() {
  const [n, setN] = useState(0);
  return <><button onClick={() => setN(n + 1)}>+</button><Child /><MemoChild label="cố định" /></>;
}
// Bấm 2 lần: Parent 3, Child 3, MemoChild 1
```

```tsx title="B. Đặt state bằng đúng giá trị hiện tại"
const [v, setV] = useState('a');
<button onClick={() => setV('a')}>{v}</button>
// Bấm 3 lần: chỉ 1 lần render (lần đầu) — Object.is('a', 'a') nên React bỏ qua
```

```tsx bad title="C. State suy ra bằng effect"
function CartTotal({ items }: { items: number[] }) {
  const [total, setTotal] = useState(0);
  useEffect(() => { setTotal(items.reduce((s, x) => s + x, 0)); }, [items]);
  return <p>{total}</p>;
}
// 2 lần props: 4 lần render, và có một khung hình hiển thị tổng CŨ
```

```tsx good
function CartTotal({ items }: { items: number[] }) {
  const total = items.reduce((s, x) => s + x, 0);   // tính khi render; tốn kém thì useMemo
  return <p>{total}</p>;
}
// 2 lần props: 2 lần render
```

```tsx title="D. useState khởi tạo từ props"
function NameEditor({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);   // initial chỉ dùng ở lần render ĐẦU
  /* … */
}
<NameEditor initial={customer.name} />           // đổi khách: vẫn hiện "An" (đã chạy thử)
<NameEditor key={customer.id} initial={customer.name} />   // đổi key → mount mới → hiện tên khách mới
```

```tsx bad title="E. setState trực tiếp trong thân hàm"
function Loop() {
  const [n, setN] = useState(0);
  setN(n + 1);          // Error: Too many re-renders. React limits the number of renders…
  return <p>{n}</p>;
}
```

## Pitfalls tổng hợp

| Thấy trong code | Vấn đề | Sửa |
|---|---|---|
| `useEffect(() => setX(f(props)), [props])` | Render thừa, khung hình sai | Tính `f(props)` khi render |
| `useState(props.value)` rồi mong nó theo props | Chỉ lấy giá trị lần đầu | Dùng thẳng prop, hoặc `key` để reset |
| `<Memo data={{ a: 1 }} />` | Object mới mỗi lần → memo vô dụng (đã đo: con bọc memo nhận `style={{ color: 'red' }}` vẫn render 3/3 lần) | Đưa hằng ra ngoài component, hoặc `useMemo` |
| `onClick={setOpen(true)}` | Gọi ngay khi render → vòng lặp render | `onClick={() => setOpen(true)}` |

:::senior Góc nhìn senior
Phỏng vấn React hay xoáy vào "khi nào component render lại" vì nó lộ ra bạn hiểu mô hình hay chỉ thuộc cú pháp. Trong dự án, nguyên tắc là: viết code **đúng** trước (không state trùng lặp, không effect thừa), **đo** bằng React DevTools Profiler khi thấy chậm, rồi mới `memo`/`useMemo` đúng chỗ — hoặc bật React Compiler để nó tự làm. Với dev Angular: hãy nghĩ "cả hàm component là một `computed` lớn chạy lại", khác với signals chỉ cập nhật đúng chỗ phụ thuộc.
:::

:::version React Compiler
React Compiler (1.0, 10/2025) tự thêm ghi nhớ ở mức biên dịch nên tình huống A và object inline ít gây render thừa hơn khi bật. Các tình huống C, D, E là lỗi **logic** — compiler không sửa thay bạn.
:::

:::interview Khi nào một component React render lại? Làm sao tránh render không cần thiết?
Khi state của chính nó đổi (khác theo `Object.is`), khi component cha render lại, hoặc khi context mà nó dùng đổi giá trị. Tránh render thừa: giữ state ở chỗ thấp nhất cần nó (không đẩy lên quá cao), tách phần hay đổi ra component con, bọc component nặng bằng `memo` và giữ props ổn định (`useMemo`/`useCallback` cho object/hàm truyền vào), chia context theo tần suất thay đổi, hoặc bật React Compiler. Nhưng chỉ làm sau khi đo bằng Profiler — render thừa thường không phải nguyên nhân chậm.
:::

:::quiz `Parent` có state `n`, render `<Child />` (không memo) và `<MemoChild label="cố định" />`. Bấm tăng `n` hai lần. Mỗi component render bao nhiêu lần (tính cả lần đầu)?
- [ ] Parent 3, Child 1, MemoChild 1
- [x] Parent 3, Child 3, MemoChild 1
- [ ] Parent 3, Child 3, MemoChild 3
- [ ] Parent 1, Child 1, MemoChild 1

Đã đo. Con không memo render theo cha dù không nhận props nào.
:::

:::quiz `const [v, setV] = useState('a')`, nút gọi `setV('a')`. Bấm 3 lần, component render thêm bao nhiêu lần?
- [ ] 3
- [ ] 1
- [x] 0 — giá trị mới bằng giá trị cũ theo `Object.is` nên React bỏ qua
- [ ] Vô hạn

Đã đo: tổng cộng chỉ 1 lần render (lần mount).
:::

:::exercise Sửa form sửa thông tin khách hàng
Component sau hiển thị form sửa tên cho khách đang chọn ở danh sách bên trái. Người dùng báo: (1) chọn khách khác, ô tên vẫn là tên khách cũ; (2) dòng "Còn N ký tự" luôn chậm một nhịp. Tìm nguyên nhân và viết lại.

```tsx
function CustomerForm({ customer }: { customer: Customer }) {
  const [name, setName] = useState(customer.name);
  const [remaining, setRemaining] = useState(50 - customer.name.length);
  useEffect(() => { setRemaining(50 - name.length); }, [name]);
  return (
    <form>
      <label htmlFor="cname">Tên khách</label>
      <input id="cname" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
      <p>Còn {remaining} ký tự</p>
    </form>
  );
}
```
???
(1) `useState(customer.name)` chỉ dùng giá trị ở lần mount; đổi `customer` không reset state. (2) `remaining` là state suy ra, cập nhật trong effect **sau** khi render, nên có một lần render hiển thị số cũ, và tốn thêm một lần render mỗi phím.

```tsx
function CustomerForm({ customer }: { customer: Customer }) {
  const [name, setName] = useState(customer.name);
  const remaining = 50 - name.length;                  // tính khi render
  return (
    <form>
      <label htmlFor="cname">Tên khách</label>
      <input id="cname" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} aria-describedby="cname-left" />
      <p id="cname-left">Còn {remaining} ký tự</p>
    </form>
  );
}

// Nơi dùng: key theo id để form mount lại khi đổi khách
<CustomerForm key={selected.id} customer={selected} />
```

Kiểm bằng test: render với khách A, `rerender` với khách B cùng `key={B.id}` → ô input có tên B; gõ một ký tự → "Còn N ký tự" đúng ngay sau mỗi phím (không cần `waitFor`).
:::
