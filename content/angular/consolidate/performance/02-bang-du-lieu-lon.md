---
title: Bảng dữ liệu lớn và import Excel không đơ UI
summary: Case study từ dự án enterprise — hàng nghìn dòng, sửa inline, import file Excel lớn — và cách giữ giao diện mượt.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [performance, table, web-worker, excel, case-study]
related: [angular/review/performance/checklist-hieu-nang, angular/deep-dive/performance/do-luong-profiling]
---

## Vấn đề

- 5.000 dòng × 15 cột = **75.000 ô** DOM → render chậm, cuộn giật.
- Mỗi ô có binding gọi hàm format → mỗi lượt CD chạy 75.000 lần.
- Parse file Excel 20MB trên main thread → UI **đứng** vài giây.

## 1. Giảm số DOM: phân trang hoặc virtual scroll

```html
<!-- CDK virtual scroll: chỉ render các dòng đang nhìn thấy -->
<cdk-virtual-scroll-viewport itemSize="40" class="h-[600px]">
  <div *cdkVirtualFor="let row of rows(); trackBy: trackById" class="h-10">…</div>
</cdk-virtual-scroll-viewport>
```

Phân trang phía server vẫn là lựa chọn tốt nhất khi dữ liệu rất lớn — virtual scroll không giảm dữ liệu tải về.

## 2. Tính sẵn thay vì gọi hàm trong template

```ts good
readonly viewRows = computed(() =>
  this.rows().map((r) => ({ ...r, amountText: this.money.format(r.amount), statusLabel: STATUS[r.status] })),
);
```

## 3. Sửa inline: mỗi dòng một signal

Thay vì một mảng lớn trong một signal (sửa 1 ô → tạo lại cả mảng → mọi dòng bị so sánh), tách state theo dòng hoặc dùng `track row.id` để Angular chỉ cập nhật dòng thay đổi.

## 4. Parse Excel trong Web Worker

```ts title="excel.worker.ts"
/// <reference lib="webworker" />
import * as XLSX from 'xlsx';

addEventListener('message', ({ data }: MessageEvent<ArrayBuffer>) => {
  const wb = XLSX.read(data, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  postMessage(rows);
});
```

```ts title="import.service.ts"
async parse(file: File): Promise<unknown[]> {
  const buffer = await file.arrayBuffer();
  const worker = new Worker(new URL('./excel.worker', import.meta.url), { type: 'module' });
  try {
    return await new Promise<unknown[]>((resolve, reject) => {
      worker.onmessage = ({ data }) => resolve(data);
      worker.onerror = reject;
      worker.postMessage(buffer, [buffer]); // chuyển quyền sở hữu buffer, không copy
    });
  } finally {
    worker.terminate();
  }
}
```

Tạo worker bằng `ng generate web-worker excel`. Thư viện `xlsx` khi đó chỉ nằm trong bundle của worker, không làm nặng main bundle.

:::quiz Vì sao parse Excel lớn trên main thread làm UI "đứng" dù code là `async`?
- [ ] Vì `async` không hoạt động với file
- [x] `async/await` không đưa việc tính toán ra thread khác — phần parse đồng bộ vẫn chặn main thread
- [ ] Vì Angular khoá UI khi đọc file
- [ ] Vì zoneless

Bất đồng bộ ≠ song song. Việc nặng CPU cần Web Worker (hoặc chia nhỏ theo lô).
:::

:::quiz Bảng 5.000 dòng dùng virtual scroll. Điều gì KHÔNG cải thiện?
- [ ] Số DOM node
- [ ] Thời gian render lần đầu
- [x] Lượng dữ liệu tải từ server
- [ ] Độ mượt khi cuộn

Virtual scroll chỉ giảm phần **hiển thị**. Dữ liệu vẫn tải hết — muốn giảm thì phân trang/lazy load phía server.
:::

:::quiz Truyền `ArrayBuffer` sang worker bằng `postMessage(buffer, [buffer])` khác gì `postMessage(buffer)`?
- [ ] Không khác
- [x] Dạng có danh sách transfer **chuyển quyền sở hữu** buffer (không copy) — nhanh hơn với file lớn, nhưng main thread không dùng buffer đó được nữa
- [ ] Dạng thứ hai lỗi
- [ ] Dạng có transfer chậm hơn

Với file hàng chục MB, tránh copy giúp giảm thời gian và bộ nhớ.
:::

:::exercise Sửa lỗi hiệu năng
```html
@for (row of rows(); track $index) {
  <tr>
    <td>{{ formatDate(row.createdAt) }}</td>
    <td>{{ getStatusLabel(row.status) }}</td>
    <td><app-row-actions [row]="row" [permissions]="{ canEdit: canEdit(), canDelete: canDelete() }" /></td>
  </tr>
}
```
Chỉ ra 3 vấn đề và cách sửa.
???
1. `track $index` → đổi thành `track row.id`.
2. `formatDate`, `getStatusLabel` gọi mỗi lượt CD cho mọi dòng → dùng pure pipe (`row.createdAt | date: 'dd/MM/yyyy'`) hoặc `computed` tính sẵn `viewRows`.
3. Object literal `{ canEdit…, canDelete… }` trong template: Angular giữ object nếu các giá trị bên trong không đổi, nhưng mỗi dòng nhận một object riêng và code khó đọc → tạo `readonly permissions = computed(() => ({ canEdit: this.canEdit(), canDelete: this.canDelete() }))` và truyền `[permissions]="permissions()"` — một tham chiếu dùng chung, chỉ đổi khi quyền đổi.
:::
