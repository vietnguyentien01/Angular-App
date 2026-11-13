---
title: "Hiệu năng React — đo trước, memo đúng chỗ, transition, tách bundle, danh sách dài và React Compiler"
summary: "Tối ưu bắt đầu bằng Profiler. Số đo: useMemo tính 1 lần qua 4 lần render; con bọc memo nhận useCallback render 1 lần, nhận hàm inline render 4 lần. Kèm useTransition/useDeferredValue, React.lazy + Suspense (đã chạy), ảo hoá danh sách và React Compiler làm gì thay bạn."
level: advanced
version: 19
lastReviewed: 2026-11-13
tags: [react, performance, memo, react-compiler, code-splitting]
related: [react/consolidate/components/doan-so-lan-render, react/consolidate/architecture/to-chuc-state-gio-hang]
---

## TL;DR

- **Đo trước**: React DevTools → Profiler (component nào render, mất bao lâu, vì sao). Phần lớn "React chậm" là render một danh sách quá dài, tính toán nặng trong render, hoặc bundle quá lớn — không phải vài lần render thừa.
- `memo(Component)` chỉ có tác dụng khi props **ổn định**: object/hàm truyền vào phải giữ tham chiếu (`useMemo`, `useCallback`, hoặc khai báo ngoài component).
- Cập nhật nặng không khẩn cấp (lọc 10.000 dòng theo ô tìm kiếm) → `useTransition`/`useDeferredValue` để ô gõ vẫn mượt.
- Bundle lớn → `React.lazy` + `Suspense` theo route/tính năng. Danh sách hàng nghìn dòng → **ảo hoá** (chỉ render phần đang thấy).
- **React Compiler** tự chèn ghi nhớ khi build — bật được thì phần lớn `useMemo`/`useCallback`/`memo` viết tay không còn cần.

## Ghi nhớ: số đo

```tsx
const RowA = memo(function RowA({ onPick }: { onPick: () => void }) { /* … */ });
const RowB = memo(function RowB({ onPick }: { onPick: () => void }) { /* … */ });

function Parent({ items }: { items: number[] }) {
  const [n, setN] = useState(0);
  const total = useMemo(() => items.reduce((s, x) => s + x, 0), [items]);   // chỉ tính lại khi items đổi
  const pickStable = useCallback(() => { /* … */ }, []);
  return (
    <>
      <button onClick={() => setN(n + 1)}>+</button>
      <p>{total}</p>
      <RowA onPick={pickStable} />        {/* props ổn định */}
      <RowB onPick={() => {}} />          {/* hàm mới mỗi lần render */}
    </>
  );
}
// Bấm + 3 lần (4 lần render Parent): useMemo tính 1 lần · RowA render 1 lần · RowB render 4 lần
```

| Công cụ | Ghi nhớ | Khi nào đáng dùng |
|---|---|---|
| `useMemo(fn, deps)` | Giá trị | Tính toán đo được là chậm; hoặc object truyền vào `memo`/deps |
| `useCallback(fn, deps)` | Hàm | Hàm truyền vào component `memo` hoặc làm deps của effect |
| `memo(Component)` | Kết quả render | Component nặng, render lại thường xuyên với props giống hệt |

Ghi nhớ không miễn phí: so sánh deps mỗi lần render, giữ giá trị trong bộ nhớ, và code khó đọc hơn.

## Ưu tiên cập nhật: useTransition / useDeferredValue

```tsx
function ProductSearch({ products }: { products: Product[] }) {     // 10.000 sản phẩm
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);                              // bản "chậm hơn" của q
  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(deferredQ.toLowerCase())),
    [products, deferredQ],
  );
  return (
    <>
      <label htmlFor="q">Tìm</label>
      <input id="q" value={q} onChange={(e) => setQ(e.target.value)} />   {/* cập nhật ngay, gõ mượt */}
      <ProductTable products={filtered} stale={q !== deferredQ} />       {/* render lại khi rảnh, có thể bị ngắt */}
    </>
  );
}
```

`useTransition` tương tự nhưng bọc **lệnh cập nhật** (`startTransition(() => setTab('reports'))`) và trả `isPending` để hiển thị trạng thái. Cả hai không làm việc nhanh hơn — chúng cho React **ngắt** việc render chậm để ưu tiên phản hồi gõ phím.

## Tách bundle (đã chạy)

```tsx
import { lazy, Suspense } from 'react';
const RevenueChart = lazy(() => import('./RevenueChart'));   // thư viện biểu đồ nặng chỉ tải khi cần

<Suspense fallback={<p>Đang tải biểu đồ…</p>}>
  <RevenueChart />
</Suspense>
// Test: lúc đầu hiện "Đang tải biểu đồ…", sau khi module tải xong hiện biểu đồ
```

Tách theo **route** là điểm bắt đầu hợp lý (React Router hỗ trợ `lazy` cho route) — giống `loadComponent` trong Angular router.

## Danh sách dài

Render 5.000 dòng bảng tốn thời gian và bộ nhớ dù không ai cuộn tới. Ảo hoá (TanStack Virtual, react-window) chỉ render ~20–50 dòng đang thấy và thay đổi khi cuộn. Với bảng quản trị, phân trang phía server thường đơn giản và tốt hơn.

## React Compiler

- Plugin Babel/SWC phân tích component và tự ghi nhớ giá trị, hàm, JSX ở mức chi tiết hơn viết tay — tình huống `RowB` ở trên không còn render thừa.
- Yêu cầu code tuân thủ quy tắc của React (component/hook thuần, không đọc ghi ref khi render, không sửa props/state) — rule ESLint của compiler báo chỗ vi phạm; component vi phạm sẽ được bỏ qua chứ không chạy sai.
- Không sửa **lỗi logic** (effect thừa, state trùng, danh sách quá dài) và không thay tách bundle hay ảo hoá.

:::senior Góc nhìn senior
Thứ tự đầu tư hiệu năng cho app React: (1) kiến trúc state đúng (state ở thấp, server state qua TanStack Query, context tách hợp lý); (2) phân trang/ảo hoá danh sách và tách bundle theo route — hai thứ này đem lại khác biệt người dùng cảm nhận được; (3) bật React Compiler; (4) chỉ khi Profiler chỉ ra điểm nóng mới viết `memo`/`useMemo` tay. Đo bằng số liệu thật (Profiler, Lighthouse, Web Vitals INP/LCP) trước và sau — giống quy trình EXPLAIN ANALYZE ở môn SQL.
:::

:::version React 18 → 19 và Compiler
`useTransition`, `useDeferredValue` có từ React 18 (concurrent rendering). React 19 cho `startTransition` nhận hàm async (Actions). React Compiler bản 1.0 ổn định từ 10/2025, dùng được với React 17+ (qua gói runtime) nhưng tốt nhất với React 19.
:::

:::quiz Component `RowB` bọc `memo`, nhận prop `onPick={() => {}}`. Cha render 4 lần. `RowB` render bao nhiêu lần?
- [ ] 1
- [x] 4 — hàm inline là tham chiếu mới mỗi lần, `memo` so sánh nông thấy props đổi
- [ ] 0
- [ ] 2

Đã đo. Với `useCallback` (RowA): 1 lần.
:::

:::quiz Ô tìm kiếm lọc 10.000 sản phẩm bị giật khi gõ. Cách nào giải quyết **đúng vấn đề** nhất?
- [ ] Bọc ô input bằng `memo`
- [x] `useDeferredValue(q)` cho phần lọc + `useMemo`, hoặc ảo hoá/phân trang danh sách
- [ ] Đổi sang uncontrolled input
- [ ] Dùng `useLayoutEffect`

Vấn đề là render danh sách lớn chặn việc cập nhật ô gõ; tách ưu tiên hoặc giảm số dòng render.
:::

:::exercise Tối ưu trang báo cáo
Trang báo cáo có: bảng 3.000 đơn hàng, ô lọc theo tên khách, biểu đồ doanh thu dùng thư viện 400 KB, và một context `{ user, theme, filters, setFilters }` bọc toàn bộ app. Người dùng phàn nàn trang tải chậm và gõ lọc bị giật. Viết kế hoạch tối ưu theo thứ tự, mỗi bước kèm cách đo trước/sau.
???
1. **Đo**: Lighthouse/Web Vitals cho thời gian tải (LCP, kích thước bundle qua `vite build --report` hoặc `source-map-explorer`); React Profiler ghi lại một lần gõ vào ô lọc — xem component nào render và mất bao lâu.
2. **Tách bundle**: `lazy(() => import('./RevenueChart'))` + `Suspense`, và lazy cho route báo cáo. Đo lại kích thước bundle đầu và LCP.
3. **Danh sách**: phân trang phía server (50 dòng/trang, cursor) hoặc ảo hoá bảng. Đo lại thời gian render trong Profiler.
4. **Ô lọc**: `useDeferredValue` cho giá trị lọc + `useMemo` cho danh sách đã lọc (nếu lọc ở client), hoặc debounce rồi đưa vào `queryKey` (nếu lọc ở server). Kiểm INP khi gõ.
5. **Context**: tách `filters` khỏi context chung (đưa lên URL hoặc context riêng của trang báo cáo) — để `user`/`theme` không làm cả app render lại mỗi phím gõ. Profiler: số component render khi gõ phải giảm mạnh.
6. **React Compiler**: bật và chạy lại test + Profiler; gỡ các `useMemo`/`useCallback` không còn cần.

Mỗi bước một commit, ghi số liệu trước/sau trong mô tả PR.
:::
