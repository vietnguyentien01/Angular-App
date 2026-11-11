---
title: Micro Frontend — single-spa, Module Federation, Native Federation
summary: So sánh các cách ghép nhiều ứng dụng frontend, chia sẻ dependency, giao tiếp giữa các MFE và khi nào KHÔNG nên dùng micro frontend.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [architecture, micro-frontend, single-spa, module-federation]
related: [angular/deep-dive/architecture/nx-monorepo, angular/deep-dive/routing/kien-truc-route-lon]
---

## Ba hướng phổ biến

| | single-spa | Module Federation (webpack) | Native Federation |
|---|---|---|---|
| Ý tưởng | Router cấp cao mount/unmount từng app theo URL | Bundler chia sẻ module giữa các build lúc runtime | Như Module Federation nhưng dựa trên ES module + import map, độc lập bundler |
| Ghép framework khác nhau | Rất mạnh (Angular + React + Vue) | Được, phức tạp hơn | Được |
| Hợp với builder Angular hiện tại (esbuild) | Có (qua adapter) | Cần webpack | **Có** — thiết kế cho esbuild |
| Chia sẻ dependency | Tự cấu hình (import map, SystemJS) | `shared: { singleton, requiredVersion }` | Tương tự, qua import map |

## Những vấn đề phải giải quyết dù chọn công cụ nào

1. **Dependency dùng chung**: Angular core, RxJS phải là **singleton** cùng version — hai bản Angular trên một trang là bug và tốn bộ nhớ.
2. **Giao tiếp giữa MFE**: ưu tiên URL, custom event trên `window`, hoặc một shared lib có version (contract). Tránh để MFE đọc state nội bộ của nhau.
3. **Style**: CSS của MFE này không được ảnh hưởng MFE khác — prefix, CSS layer, hoặc ViewEncapsulation.
4. **Design system dùng chung**: publish thành package có version; mỗi MFE nâng cấp theo nhịp riêng.
5. **Auth & cấu hình**: shell chịu trách nhiệm đăng nhập, truyền token/cấu hình cho MFE qua contract rõ ràng.

## Khi nào KHÔNG nên dùng

- Một team, một nhịp release → monorepo + lazy route đã đủ, đơn giản hơn nhiều.
- Lý do chỉ là "code lớn" → vấn đề tổ chức code, không phải deployment.

Micro frontend giải bài toán **tổ chức**: nhiều team độc lập cần deploy độc lập.

:::senior Góc nhìn Senior
Từ kinh nghiệm single-spa (cổng dịch vụ công, hệ thống kiểm sát), câu trả lời phỏng vấn tốt nên có số liệu và bài học: *bao nhiêu MFE, ai sở hữu shared component, cách xử lý version Angular lệch nhau giữa các MFE, sự cố nào đã xảy ra (vd style rò rỉ, hai bản zone.js) và cách khắc phục*. Đó là điều phân biệt người "đã dùng" với người "hiểu".
:::

:::quiz Vì sao Angular core nên được chia sẻ dạng singleton giữa các MFE?
- [ ] Để build nhanh hơn
- [x] Hai bản Angular trên cùng trang gây tải trùng, xung đột (vd DI, zone.js trong app cũ) và tốn bộ nhớ
- [ ] Vì license
- [ ] Không cần, mỗi MFE nên có bản riêng

Chia sẻ singleton đòi hỏi các MFE thống nhất phạm vi version tương thích.
:::

:::quiz Hai MFE cần biết "hồ sơ đang chọn". Cách giao tiếp ít ràng buộc nhất?
- [ ] MFE B import service nội bộ của MFE A
- [x] Đưa id hồ sơ lên URL hoặc phát custom event có schema rõ ràng
- [ ] Dùng biến toàn cục `window.selectedCase`
- [ ] Gộp hai MFE làm một

URL và event có contract giúp mỗi MFE thay đổi bên trong mà không làm vỡ MFE kia.
:::

:::quiz Một team 6 người, một sản phẩm, release cùng lúc. Có nên tách micro frontend?
- [ ] Có, vì micro frontend luôn tốt hơn
- [x] Thường là không — chi phí vận hành lớn hơn lợi ích; lazy route + ranh giới module trong monorepo là đủ
- [ ] Có, để dùng nhiều framework
- [ ] Bắt buộc với Angular 22

Micro frontend phục vụ độc lập về **tổ chức và deploy**, không phải giải pháp cho code lớn.
:::
