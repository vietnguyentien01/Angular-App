---
title: linkedSignal trong tình huống thật
summary: Giữ lựa chọn khi danh sách đổi, form chỉnh sửa có thể huỷ, và vì sao nó thay thế được effect + set.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [signals, linkedSignal, pattern]
related: [angular/consolidate/signals/effect-dung-cach, angular/review/signals/linkedsignal-resource-co-ban]
---

## TL;DR

Dùng `linkedSignal` khi state **phụ thuộc vào nguồn** nhưng **người dùng sửa được**. Dạng đầy đủ cho phép xem **giá trị trước** để quyết định reset hay giữ.

## Pattern 1 — giữ lựa chọn nếu vẫn còn trong danh sách

```ts good title="user-picker.ts"
readonly users = input.required<User[]>();

readonly selected = linkedSignal<User[], User | undefined>({
  source: this.users,
  computation: (users, previous) =>
    users.find((u) => u.id === previous?.value?.id) ?? users[0],
});
```

```ts bad title="Cách cũ — effect + set"
readonly selected = signal<User | undefined>(undefined);
constructor() {
  effect(() => {
    const users = this.users();
    const current = untracked(this.selected);
    this.selected.set(users.find((u) => u.id === current?.id) ?? users[0]);
  });
}
```

Cách cũ bị "trễ một nhịp" và khó đọc; `linkedSignal` đồng bộ và khai báo rõ ràng.

## Pattern 2 — form chỉnh sửa có nút "Huỷ"

```ts title="profile-editor.ts"
readonly profile = input.required<Profile>(); // dữ liệu gốc từ server
readonly draft = linkedSignal(() => ({ ...this.profile() })); // bản nháp sửa được

save() { this.saved.emit(this.draft()); }
cancel() { this.draft.set({ ...this.profile() }); }
// Khi parent truyền profile mới (vd sau khi lưu) → draft tự reset theo
```

:::quiz Với Pattern 1, danh sách đổi từ `[A, B, C]` (đang chọn B) sang `[B, D]`. `selected()` là gì?
- [ ] A
- [x] B
- [ ] D
- [ ] undefined

`previous.value` là B và B vẫn còn trong danh sách mới nên được giữ.
:::

:::quiz Danh sách đổi từ `[A, B]` (đang chọn B) sang `[C, D]`. `selected()` là gì?
- [x] C
- [ ] B
- [ ] D
- [ ] undefined

B không còn → fallback `users[0]` = C.
:::

:::quiz Người dùng gọi `selected.set(X)` với X không nằm trong danh sách. Sau đó danh sách không đổi. `selected()` là?
- [x] X — `set` ghi đè cho tới lần nguồn đổi tiếp theo
- [ ] Tự reset về `users[0]`
- [ ] Lỗi
- [ ] undefined

`linkedSignal` chỉ tính lại khi `source` thay đổi. Nếu cần ràng buộc giá trị hợp lệ, kiểm tra trước khi `set`.
:::

:::exercise Phân trang reset khi đổi bộ lọc
Có `filter = signal('')`. Viết `page` sao cho người dùng đổi trang được, nhưng mỗi khi `filter` đổi thì `page` về 1.
???
```ts
readonly filter = signal('');
readonly page = linkedSignal({ source: this.filter, computation: () => 1 });

next() { this.page.update((p) => p + 1); }
```
Không cần `effect`. Mỗi khi `filter` đổi, `page` được tính lại thành 1.
:::
