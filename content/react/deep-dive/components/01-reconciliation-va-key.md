---
title: "Reconciliation — React quyết định giữ hay huỷ state thế nào, và key thực sự làm gì"
summary: "React giữ state theo vị trí trong cây và loại phần tử. Năm thí nghiệm đã chạy: cùng vị trí cùng loại giữ nguyên chữ đã gõ dù đổi label; thêm key khác nhau, đổi phần tử bọc, tách hai nhánh && hay định nghĩa component bên trong component đều làm mất state. Kèm cách dùng key để reset có chủ đích."
level: advanced
version: 19
lastReviewed: 2026-11-13
tags: [react, reconciliation, key, state, internals]
related: [react/review/components/jsx-props-state-va-danh-sach, react/consolidate/components/doan-so-lan-render]
---

## TL;DR

- Sau mỗi lần render, React so cây mới với cây cũ (**reconciliation**). State gắn với **vị trí trong cây** + **loại phần tử** (+ `key` nếu có) — không gắn với biến JSX hay tên component bạn viết.
- Cùng vị trí, cùng loại, cùng key → **giữ** component và state, chỉ cập nhật props.
- Khác loại (kể cả phần tử bọc ngoài), khác key → **huỷ** cây con cũ (chạy cleanup, mất state) và **tạo mới**.
- `key` không chỉ cho danh sách: đổi `key` là cách chủ động "reset" một component.
- **Không** định nghĩa component bên trong component khác — mỗi lần render là một "loại" mới, state mất liên tục.

## Năm thí nghiệm

`Field` là ô input giữ chữ đang gõ trong `useState`. Gõ `abc`, bấm nút đổi, xem ô input còn gì:

```tsx
function Field({ label }: { label: string }) {
  const [v, setV] = useState('');
  return <label>{label}<input value={v} onChange={(e) => setV(e.target.value)} /></label>;
}
```

| # | JSX | Sau khi đổi |
|---|---|---|
| 1 | `{b ? <Field label="Công ty" /> : <Field label="Cá nhân" />}` | `"abc"` — cùng vị trí, cùng loại `Field`: React coi là **một** component, chỉ đổi label |
| 2 | `{b ? <Field key="cty" … /> : <Field key="cn" … />}` | `""` — khác key |
| 3 | `{b ? <div><Field /></div> : <section><Field /></section>}` | `""` — phần tử cha khác loại nên cả cây con bị tạo lại |
| 4 | `{b && <Field label="Công ty" />}{!b && <Field label="Cá nhân" />}` | `""` — hai **vị trí** khác nhau trong mảng con (vị trí rỗng vẫn được tính) |
| 5 | `function Inner() { return <Field … /> }` khai báo **trong** component cha | `""` sau **mỗi** lần cha render — `Inner` là hàm mới, tức loại mới |

Thí nghiệm 1 là nguồn bug kinh điển: form "Khách cá nhân/Công ty" dùng chung một ô mà người dùng thấy dữ liệu cũ còn lại. Muốn tách state → thêm `key` (2) hoặc tách vị trí (4).

## Thuật toán, ngắn gọn

So sánh cây tổng quát tốn O(n³); React dùng hai giả định để còn O(n):

1. Hai phần tử **khác loại** sinh ra cây khác nhau → không cố so sánh sâu, thay luôn.
2. Trong danh sách con, `key` cho biết phần tử nào là phần tử nào giữa các lần render → di chuyển/giữ đúng phần tử thay vì so theo thứ tự.

Không có key, React so con theo **chỉ số**: xoá phần tử đầu thì mọi phần tử sau "dịch lên" và nhận state của phần tử trước nó (bài Ôn lại đã tái hiện với `key={index}`).

## Dùng key để reset có chủ đích

```tsx
// Đổi khách đang chọn → form sửa mount lại với state ban đầu từ khách mới
<CustomerForm key={customer.id} customer={customer} />

// Bắt đầu lại một wizard nhiều bước
<CheckoutWizard key={attempt} onRestart={() => setAttempt((a) => a + 1)} />
```

Đây là cách thay cho mẫu "useEffect theo dõi prop rồi reset từng state" — ít code hơn và không có khung hình hiển thị dữ liệu cũ.

## So với Angular

Angular không có cây ảo: template được biên dịch thành lệnh tạo/cập nhật DOM, và `@for (…; track item.id)` đóng vai trò của `key` — `track` sai (vd `track $index` khi xoá/sắp xếp) cũng làm component con giữ state sai chỗ. `@if/@else` ở Angular luôn huỷ và tạo lại nhánh, nên thí nghiệm 1 cho kết quả **ngược** với React.

:::senior Góc nhìn senior
Hiểu "state theo vị trí" giúp đọc được những bug nghe như ma ám: dữ liệu form nhảy sang bản ghi khác, animation chạy lại không lý do, input mất focus mỗi lần gõ (thường là thí nghiệm 5 — component khai báo bên trong component). Quy tắc review: component luôn khai báo ở cấp module; `key` của danh sách là id ổn định từ dữ liệu; khi muốn reset thì dùng `key` một cách có chủ ý và ghi chú lý do.
:::

:::quiz `{isCompany ? <Field label="Mã số thuế" /> : <Field label="CCCD" />}`. Người dùng gõ "0123" rồi chuyển loại khách. Ô input hiển thị gì?
- [ ] Rỗng
- [x] "0123" — cùng vị trí, cùng loại component nên React giữ state, chỉ đổi label
- [ ] Lỗi
- [ ] Tuỳ trình duyệt

Đã chạy thử (thí nghiệm 1). Thêm `key="mst"`/`key="cccd"` để tách.
:::

:::quiz Ô input trong một component mất focus sau mỗi phím gõ. Nguyên nhân hay gặp nhất?
- [ ] Thiếu `useMemo`
- [x] Component chứa ô input được **khai báo bên trong** một component khác — mỗi lần render là một loại mới nên bị huỷ và tạo lại
- [ ] Dùng controlled input
- [ ] StrictMode

Đã chạy thử (thí nghiệm 5): state mất sau mỗi lần cha render. Đưa khai báo ra cấp module.
:::

:::exercise Form khách hàng hai loại
Viết form tạo khách với hai loại "Cá nhân" (họ tên, CCCD) và "Doanh nghiệp" (tên công ty, mã số thuế). Yêu cầu: đổi loại thì các ô của loại kia **không** giữ dữ liệu; nhưng ô "Số điện thoại" dùng chung **giữ nguyên** khi đổi loại. Viết bằng hai cách khác nhau và một test Testing Library cho yêu cầu này.
???
Cách 1 — `key` cho phần riêng:

```tsx
function CustomerForm() {
  const [type, setType] = useState<'person' | 'company'>('person');
  return (
    <form>
      <fieldset>
        <legend>Loại khách</legend>
        <label><input type="radio" checked={type === 'person'} onChange={() => setType('person')} /> Cá nhân</label>
        <label><input type="radio" checked={type === 'company'} onChange={() => setType('company')} /> Doanh nghiệp</label>
      </fieldset>
      <Field label="Số điện thoại" />                       {/* vị trí và loại không đổi → giữ */}
      <TypeFields key={type} type={type} />                  {/* key đổi → reset */}
    </form>
  );
}
```

Cách 2 — tách vị trí: `{type === 'person' && <PersonFields />}{type === 'company' && <CompanyFields />}`.

Test: gõ số điện thoại và CCCD → chọn "Doanh nghiệp" → ô "Mã số thuế" rỗng, ô "Số điện thoại" còn giá trị → chọn lại "Cá nhân" → ô CCCD rỗng (state đã bị huỷ). Nếu cần **nhớ** dữ liệu của cả hai loại khi chuyển qua lại, phải nâng state lên `CustomerForm` (hoặc giữ cả hai nhánh trong cây và ẩn bằng CSS).
:::
