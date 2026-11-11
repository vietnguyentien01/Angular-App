---
title: Eager (Default) vs OnPush
summary: Hai chiến lược change detection, khi nào component OnPush được kiểm tra lại, và thay đổi mặc định ở Angular 22.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [change-detection, performance]
related: [angular/consolidate/change-detection/markforcheck-detectchanges]
changelog:
  - date: 2026-11-11
    note: Cập nhật cho Angular 22 — OnPush là mặc định, Default được đổi tên thành Eager.
---

## TL;DR

- **Change detection (CD)** = Angular duyệt cây component, so sánh giá trị binding trong template và cập nhật DOM.
- **Eager** (trước đây gọi là **Default**): component được kiểm tra **mỗi lần** CD đi qua nó.
- **OnPush**: component chỉ được kiểm tra khi được **đánh dấu "dirty"**.
- **Angular 22**: OnPush là **mặc định**; `ChangeDetectionStrategy.Default` bị deprecated, thay bằng `ChangeDetectionStrategy.Eager`.

## OnPush được kiểm tra lại khi nào?

1. Một **input** nhận tham chiếu mới (so sánh `===`).
2. Một **event** phát ra từ template của chính nó hoặc con của nó (`(click)`...).
3. Một **signal** được đọc trong template thay đổi.
4. `async` pipe nhận giá trị mới.
5. Gọi `ChangeDetectorRef.markForCheck()` thủ công.

:::demo onpush-tree

:::warning Bẫy kinh điển
Mutate object/array (`this.items.push(x)`) rồi truyền xuống component OnPush → tham chiếu không đổi → **UI không cập nhật**. Hãy tạo tham chiếu mới (`[...items, x]`) hoặc dùng signal.
:::

```ts bad
this.items.push(newItem); // con OnPush không thấy thay đổi
```

```ts good
this.items.update((list) => [...list, newItem]);
```

:::version v16 Ở Angular 16 / 19
Mặc định là `ChangeDetectionStrategy.Default` và app chạy với **Zone.js**. Bạn phải tự khai báo `changeDetection: ChangeDetectionStrategy.OnPush` cho từng component. Từ **Angular 22**, component mới mặc định là OnPush; component cũ cần hành vi kiểm tra liên tục phải ghi rõ `ChangeDetectionStrategy.Eager`. Khi nâng cấp lên v22, migration `change-detection-eager` của `ng update` thêm `ChangeDetectionStrategy.Eager` vào các component để giữ nguyên hành vi cũ — sau đó bạn chuyển dần từng component sang OnPush.
:::

:::quiz Ở Angular 22, một component không khai báo `changeDetection` sẽ dùng chiến lược nào?
- [x] OnPush
- [ ] Eager
- [ ] Default
- [ ] Tuỳ vào Zone.js

Từ v22, OnPush là mặc định. `Eager` (tên mới của `Default`) phải khai báo tường minh.
:::

:::quiz Parent đổi `this.user.name = 'B'` (cùng object) và truyền `[user]="user"` xuống con OnPush. Con hiển thị gì?
- [ ] `B` ngay lập tức
- [x] Vẫn tên cũ, cho tới khi con bị đánh dấu dirty vì lý do khác
- [ ] Lỗi ExpressionChanged
- [ ] Trống

Input so sánh bằng `===`; tham chiếu không đổi nên con OnPush không được kiểm tra. Dùng object mới hoặc signal.
:::

:::quiz Trong một component OnPush, `setTimeout(() => this.count++, 1000)` (field thường, không phải signal) thì sao?
- [ ] UI cập nhật sau 1 giây
- [x] UI không cập nhật cho tới khi có lý do khác làm component dirty
- [ ] Lỗi biên dịch
- [ ] Angular tự chuyển `count` thành signal

`setTimeout` không đánh dấu component dirty. Dùng `count = signal(0)` rồi `count.update(...)`, hoặc gọi `markForCheck()`.
:::

:::interview Tại sao OnPush giúp app nhanh hơn?
Vì Angular **bỏ qua cả nhánh con** của một component OnPush không bị dirty. Với cây component lớn (bảng nhiều dòng, form nhiều field), số binding phải so sánh mỗi lượt CD giảm đáng kể. Đổi lại, dữ liệu phải được cập nhật **bất biến** (immutable) hoặc qua signals.
:::
