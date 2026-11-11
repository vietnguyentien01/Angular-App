---
title: Dùng effect đúng cách
summary: Khi nào effect là lựa chọn đúng, khi nào là code smell, và cách tránh vòng lặp / chạy thừa.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [signals, effect, pitfalls]
related: [angular/review/signals/signal-computed-effect, angular/deep-dive/signals/reactive-graph]
---

## TL;DR

`effect` dùng để **đồng bộ trạng thái reactive ra thế giới bên ngoài**. Nếu bạn đang dùng `effect` để tính ra một signal khác, gần như chắc chắn nên dùng `computed` hoặc `linkedSignal`.

## Effect phù hợp cho

- Ghi log / analytics.
- Đồng bộ với `localStorage`, `IndexedDB`.
- Gọi API của thư viện **không phải Angular** (chart, map, editor) khi dữ liệu đổi.

```ts good title="theme.ts"
effect(() => {
  document.documentElement.classList.toggle('dark', this.theme() === 'dark');
  localStorage.setItem('theme', this.theme());
});
```

## Code smell: effect set signal

```ts bad
effect(() => {
  this.fullName.set(`${this.first()} ${this.last()}`);
});
```

Vấn đề:

1. `fullName` bị **trễ một nhịp** — có thời điểm nó chưa khớp với `first` / `last`.
2. Dễ tạo **vòng lặp** khi effect đọc chính signal mà nó ghi.
3. Khó đọc: luồng dữ liệu không còn khai báo (declarative).

```ts good
readonly fullName = computed(() => `${this.first()} ${this.last()}`);
```

## Chỉ phụ thuộc vào thứ bạn muốn: `untracked`

Mọi signal được đọc bên trong `effect` đều trở thành dependency. Khi chỉ muốn **đọc giá trị hiện tại** mà không muốn effect chạy lại vì nó, bọc trong `untracked`:

```ts
effect(() => {
  const query = this.query(); // dependency
  const user = untracked(() => this.currentUser()); // chỉ đọc, không theo dõi
  this.analytics.track('search', { query, user: user.id });
});
```

:::senior Góc nhìn Senior
Trong code review, mỗi `effect` nên trả lời được câu hỏi: *“side effect này đẩy dữ liệu ra đâu?”*. Nếu câu trả lời là “vào một signal khác” → đề nghị đổi sang `computed` / `linkedSignal`. Với dữ liệu bất đồng bộ (gọi API theo tham số), cân nhắc `resource()` / `httpResource()` thay vì effect + subscribe.
:::

:::version v16 Ở Angular 16 / 19
Ở v16–v18, ghi signal trong effect bị chặn mặc định (cần `allowSignalWrites: true`). Từ v19 cờ này không còn cần thiết (deprecated), ghi signal trong effect **không còn bị chặn** — càng cần kỷ luật trong review.
:::

:::interview Vì sao effect set signal lại gây “trễ một nhịp”?
Effect được lên lịch chạy **sau** khi signal nguồn thay đổi (không đồng bộ ngay lúc `set`). Trong khoảng giữa, ai đọc signal đích sẽ thấy giá trị cũ. `computed` thì được tính **khi được đọc** và luôn nhất quán với nguồn (glitch-free).
:::

:::quiz Trường hợp nào DÙNG `effect` là hợp lý?
- [ ] Tính `total` từ `items` và `discount`
- [ ] Reset `page` về 1 khi `filter` đổi
- [x] Lưu `theme()` vào `localStorage` mỗi khi đổi
- [ ] Tạo `fullName` từ `first` và `last`

Ba trường hợp còn lại là state dẫn xuất → `computed` / `linkedSignal`. Ghi `localStorage` là đồng bộ ra **bên ngoài** reactive graph.
:::

:::quiz Effect sau chạy lại khi signal nào đổi?
```ts
effect(() => {
  if (this.enabled()) {
    console.log(this.value());
  }
});
```

- [ ] Chỉ `enabled`
- [ ] Cả `enabled` và `value`, luôn luôn
- [x] `enabled` luôn được theo dõi; `value` chỉ được theo dõi khi lần chạy gần nhất có `enabled() === true`
- [ ] Không signal nào

Dependency được thu thập **động** theo những gì thực sự được đọc trong lần chạy. Khi `enabled` là `false`, `value()` không được đọc nên không phải dependency.
:::

:::exercise Refactor component
```ts
export class Cart {
  readonly items = input.required<Item[]>();
  readonly total = signal(0);
  readonly isEmpty = signal(true);

  constructor() {
    effect(() => {
      this.total.set(this.items().reduce((s, i) => s + i.price * i.qty, 0));
      this.isEmpty.set(this.items().length === 0);
      localStorage.setItem('cart', JSON.stringify(this.items()));
    });
  }
}
```
???
```ts
export class Cart {
  readonly items = input.required<Item[]>();
  readonly total = computed(() => this.items().reduce((s, i) => s + i.price * i.qty, 0));
  readonly isEmpty = computed(() => this.items().length === 0);

  constructor() {
    // Chỉ giữ lại side effect thật sự
    effect(() => localStorage.setItem('cart', JSON.stringify(this.items())));
  }
}
```
`total` và `isEmpty` là giá trị dẫn xuất → `computed`. Chỉ việc ghi `localStorage` mới cần `effect`.
:::
