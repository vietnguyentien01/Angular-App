---
title: Default vs OnPush
summary: Hai chiến lược change detection, khi nào component OnPush được kiểm tra lại, và thay đổi mặc định ở Angular 22.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [change-detection, performance]
---

## TL;DR

- **Change detection (CD)** = Angular duyệt cây component, so sánh giá trị binding trong template và cập nhật DOM.
- **Default**: component được kiểm tra **mỗi lần** CD chạy.
- **OnPush**: component chỉ được kiểm tra khi được **đánh dấu "dirty"**.

## OnPush được kiểm tra lại khi nào?

1. Một **input** nhận tham chiếu mới (so sánh `===`).
2. Một **event** phát ra từ template của chính nó hoặc con của nó (`(click)`...).
3. Một **signal** được đọc trong template thay đổi.
4. `async` pipe nhận giá trị mới.
5. Gọi `ChangeDetectorRef.markForCheck()` thủ công.

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
Mặc định là `ChangeDetectionStrategy.Default` và app chạy với **Zone.js**. Bạn phải tự khai báo `changeDetection: ChangeDetectionStrategy.OnPush` cho từng component. Từ **Angular 22**, OnPush là mặc định cho component mới — khi đọc code cũ hãy để ý component đang dùng chiến lược nào.
:::

:::interview Tại sao OnPush giúp app nhanh hơn?
Vì Angular **bỏ qua cả nhánh con** của một component OnPush không bị dirty. Với cây component lớn (bảng nhiều dòng, form nhiều field), số binding phải so sánh mỗi lượt CD giảm đáng kể. Đổi lại, dữ liệu phải được cập nhật **bất biến** (immutable) hoặc qua signals.
:::
