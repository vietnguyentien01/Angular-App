---
title: "Angular 22: những thay đổi mặc định cần biết khi nâng cấp"
summary: OnPush mặc định, Eager thay Default, strictTemplates, incremental hydration — đọc từ danh sách migration chính thức của ng update.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [whats-new, migration, angular-22]
related: [angular/review/change-detection/default-vs-onpush, angular/deep-dive/change-detection/zoneless-ben-trong]
---

## TL;DR

Cách đáng tin nhất để biết một bản major **đổi gì mặc định** là đọc các migration mà `ng update` sẽ chạy. Với `@angular/core` 22, file `node_modules/@angular/core/schematics/migrations.json` liệt kê:

| Migration | Mô tả chính thức (tóm tắt) | Ý nghĩa |
|---|---|---|
| `change-detection-eager` | Thêm `ChangeDetectionStrategy.Eager` vào các component | Mặc định mới là **OnPush**; migration giữ hành vi cũ |
| `strict-templates-default` | Thêm `strictTemplates: false` vào tsconfig nếu chưa khai báo | `strictTemplates` giờ **bật mặc định** |
| `incremental-hydration` | Thêm `withNoIncrementalHydration()` nếu chưa bật incremental hydration | Incremental hydration **bật mặc định** khi dùng `provideClientHydration()` |
| `http-xhr-backend` | Thêm `withXhr` khi đang dùng `HttpXhrBackend` | `FetchBackend` là backend mặc định, `withFetch()` bị deprecated; dùng `withXhr()` nếu cần báo tiến độ **upload** (Fetch API chưa hỗ trợ) |
| `can-match-snapshot-required` | Thêm tham số thứ ba bắt buộc cho các lời gọi `canMatch` | Kiểm tra lại guard `canMatch` tự viết |

:::warning Đừng dừng ở migration
Migration chỉ **giữ nguyên hành vi cũ** cho code hiện có. Lợi ích của mặc định mới (OnPush, strict templates) chỉ có khi bạn **chủ động** gỡ dần các opt-out đó, ví dụ chuyển từng component từ `Eager` sang OnPush kèm test.
:::

## Kế hoạch nâng cấp cho dự án enterprise

1. Nâng từng major một (`ng update @angular/core@N @angular/cli@N`), chạy test sau mỗi bước.
2. Commit riêng phần thay đổi do migration sinh ra → dễ review.
3. Lập danh sách opt-out (`Eager`, `strictTemplates: false`…) thành technical debt có owner và deadline.
4. Gỡ opt-out theo module, ưu tiên màn hình nhiều traffic.

:::senior Góc nhìn Senior
Khi được hỏi "nâng cấp Angular có rủi ro gì", câu trả lời tốt không phải "chạy `ng update` là xong" mà là: *đọc migration và breaking changes, nâng từng bước, có test bao phủ luồng chính, tách commit, và có kế hoạch gỡ các opt-out*. Đó là khác biệt giữa người làm theo và người dẫn dắt nâng cấp.
:::

:::quiz Sau `ng update` lên v22, vì sao app vẫn chạy y như cũ dù mặc định đã đổi sang OnPush?
- [ ] Vì OnPush không ảnh hưởng gì
- [x] Vì migration `change-detection-eager` đã thêm `Eager` vào các component
- [ ] Vì v22 tự phát hiện component cần Eager
- [ ] Vì Zone.js vẫn bật

Migration giữ hành vi. Muốn hưởng lợi OnPush, phải tự gỡ `Eager` từng component.
:::

:::quiz Tìm ở đâu để biết chính xác `ng update` sẽ thay đổi gì trong code?
- [ ] Chỉ trên mạng xã hội
- [x] File `schematics/migrations.json` của package và trang update guide chính thức
- [ ] `package-lock.json`
- [ ] Không có cách nào

Mỗi package Angular khai báo migration trong `migrations.json`; kết hợp với update.angular.dev để có checklist đầy đủ.
:::
