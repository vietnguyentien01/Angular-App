---
title: linkedSignal và resource — nhắc nhanh
summary: State ghi được nhưng tự reset theo nguồn, và dữ liệu bất đồng bộ dạng signal.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [signals, linkedSignal, resource]
related: [angular/consolidate/signals/linkedsignal-patterns, angular/deep-dive/signals/resource-httpresource]
---

## linkedSignal

Giống `computed` nhưng **ghi được**. Khi nguồn đổi, giá trị được tính lại (ghi đè giá trị bạn đã `set`).

```ts
readonly options = input.required<string[]>();
// Mặc định chọn phần tử đầu; người dùng chọn khác được; đổi danh sách → reset
readonly selected = linkedSignal(() => this.options()[0]);
```

## resource / httpResource

Dữ liệu bất đồng bộ phụ thuộc vào signal, trả về các signal trạng thái.

```ts
readonly userId = input.required<string>();

readonly user = httpResource<User>(() => `/api/users/${this.userId()}`);
// user.value(), user.isLoading(), user.error(), user.hasValue(), user.reload()
```

| Trạng thái `status()` | Ý nghĩa |
|---|---|
| `idle` | Chưa có params (hàm params trả `undefined`) |
| `loading` | Đang tải lần đầu / params đổi |
| `reloading` | Đang tải lại bằng `reload()` |
| `resolved` | Có dữ liệu |
| `error` | Loader lỗi |
| `local` | Giá trị đã được `set()` thủ công |

:::quiz `userId` đổi từ `1` sang `2` trong lúc request của `1` chưa xong. `httpResource` làm gì?
- [ ] Chờ request `1` xong rồi mới gọi `2`
- [x] Huỷ request `1`, gọi request `2`
- [ ] Gọi song song và giữ kết quả về sau
- [ ] Bỏ qua thay đổi

Resource hành xử như `switchMap`: params mới làm request cũ bị abort.
:::

:::quiz Khi nào nên dùng `linkedSignal` thay vì `computed`?
- [ ] Khi giá trị phụ thuộc nhiều signal
- [x] Khi giá trị dẫn xuất từ nguồn nhưng người dùng vẫn cần ghi đè được
- [ ] Khi cần gọi API
- [ ] Không bao giờ, `computed` luôn tốt hơn

`computed` chỉ đọc. `linkedSignal` = "computed có thể `set`, tự reset khi nguồn đổi".
:::
