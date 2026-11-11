---
title: Cây injector — Environment và Element
summary: Angular tìm dependency theo thứ tự nào, vì sao cùng một service lại ra hai instance, và các option self/skipSelf/host/optional.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [di, injector, hierarchy]
related: [angular/consolidate/dependency-injection/providers-o-dau]
---

## Hai cây injector

```text
Platform injector
  └─ Root (Environment) injector      ← @Service(), providedIn: 'root', app.config providers
       └─ Route injector (lazy)        ← providers: [...] trong định nghĩa route
            ...
Element injector của component cha    ← @Component({ providers })
  └─ Element injector của component con
```

Khi một component gọi `inject(X)`, Angular tìm:

1. **Element injector** của chính nó → của cha → … lên tới component gốc.
2. Nếu không thấy, chuyển sang **Environment injector** (route → root → platform).
3. Không thấy nữa → lỗi `NG0201: No provider for X` (trừ khi `optional: true`).

## Option khi inject

| Option | Ý nghĩa |
|---|---|
| `inject(X, { optional: true })` | Trả `null` thay vì lỗi |
| `inject(X, { self: true })` | Chỉ tìm ở injector của chính element này |
| `inject(X, { skipSelf: true })` | Bỏ qua chính mình, tìm từ cha trở lên |
| `inject(X, { host: true })` | Dừng tìm ở component host |

:::quiz `CartService` có `@Service()`. Component `Checkout` lại khai báo `providers: [CartService]`. Con của `Checkout` inject `CartService` sẽ nhận?
- [ ] Instance singleton ở root
- [x] Instance riêng được tạo ở element injector của `Checkout`
- [ ] Lỗi vì khai báo trùng
- [ ] Ngẫu nhiên

Element injector gần nhất thắng. Đây là nguồn gốc của bug "tôi thêm vào giỏ hàng mà header không cập nhật": header dùng instance root, còn Checkout dùng instance riêng.
:::

:::quiz Một directive muốn lấy service từ component cha nhưng KHÔNG lấy bản mà chính nó khai báo. Dùng option nào?
- [ ] `self: true`
- [x] `skipSelf: true`
- [ ] `optional: true`
- [ ] `host: true`

`skipSelf` bắt đầu tìm từ injector cha — hay gặp trong pattern lồng nhau (menu con tìm menu cha).
:::

:::quiz Service khai báo trong `providers` của một route lazy sẽ sống bao lâu?
- [ ] Bị tạo lại mỗi lần vào route
- [x] Được tạo trong environment injector của route khi lần đầu cần, và sống tiếp khi rời route (không bị huỷ theo component)
- [ ] Huỷ ngay khi rời route
- [ ] Giống hệt `@Service()` ở root

Route injector được tạo khi route được kích hoạt lần đầu và mặc định được giữ lại. Đừng dùng nó cho state "mỗi lần vào trang là mới" — hãy để ở component providers.
:::
