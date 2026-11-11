---
title: Pipe có sẵn, pure vs impure, tự viết pipe
summary: date, number, currency, async, keyvalue… cách định dạng kiểu Việt Nam, và vì sao pipe pure nhanh hơn gọi hàm trong template.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [pipe, i18n, performance]
related: [angular/review/directives-pipes/tu-viet-directive]
---

## Pipe hay dùng

| Pipe | Ví dụ | Kết quả (locale `vi`) |
|---|---|---|
| `date` | `{{ d \| date: 'dd/MM/yyyy HH:mm' }}` | `11/11/2026 09:30` |
| `number` | `{{ 1234567.891 \| number: '1.0-2' }}` | `1.234.567,89` |
| `currency` | `{{ 150000 \| currency: 'VND' }}` | `150.000 ₫` |
| `percent` | `{{ 0.125 \| percent: '1.0-1' }}` | `12,5%` |
| `async` | `{{ user$ \| async }}` | Giá trị mới nhất của Observable/Promise |
| `keyvalue` | `@for (e of obj \| keyvalue; track e.key)` | Duyệt object (mặc định sắp xếp theo key) |
| `json` | `{{ form.value \| json }}` | Debug nhanh |

:::warning Locale
Mặc định Angular dùng `en-US`. Muốn định dạng kiểu Việt Nam: `registerLocaleData(localeVi)` (từ `@angular/common/locales/vi`) và provide `{ provide: LOCALE_ID, useValue: 'vi' }`.
:::

## Tự viết pipe

```ts title="file-size.pipe.ts"
@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number, digits = 1): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let v = bytes / 1024, i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(digits)} ${units[i]}`;
  }
}
```

**Pure** (mặc định): chỉ chạy lại khi tham số đổi (so `===`). **Impure** (`pure: false`): chạy mỗi lượt change detection — tránh trừ khi bắt buộc.

:::quiz `{{ items | filterActive }}` (pipe pure). Bạn `items.push(newItem)`. Kết quả?
- [ ] Danh sách lọc cập nhật ngay
- [x] Không cập nhật — tham chiếu `items` không đổi nên pipe pure không chạy lại
- [ ] Lỗi
- [ ] Pipe tự chuyển thành impure

Pipe pure + dữ liệu bất biến (tạo mảng mới) là bộ đôi đúng.
:::

:::quiz Vì sao `{{ size | fileSize }}` tốt hơn `{{ formatSize(size) }}` trong bảng lớn?
- [ ] Không khác gì
- [x] Pipe pure được memoize theo tham số, còn hàm trong template chạy lại mỗi lần component được kiểm tra
- [ ] Pipe chạy trên Web Worker
- [ ] Hàm không được phép gọi trong template

Với signal, `computed` cũng đạt hiệu quả tương tự.
:::

:::quiz `{{ 150000 | currency: 'VND' }}` khi chưa cấu hình locale `vi` hiển thị thế nào?
- [ ] `150.000 ₫`
- [x] Định dạng theo `en-US`, kiểu `₫150,000`
- [ ] Lỗi
- [ ] `150000`

Ký hiệu tiền theo mã `VND`, còn dấu phân cách và vị trí ký hiệu theo `LOCALE_ID`.
:::
