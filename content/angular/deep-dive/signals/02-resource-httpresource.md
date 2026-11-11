---
title: resource() và httpResource() bên trong
summary: Vòng đời params → loader → trạng thái, abort request, cập nhật lạc quan (optimistic) và khi nào nên chọn RxJS hay TanStack Query.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [signals, resource, httpResource, server-state]
related: [angular/review/signals/linkedsignal-resource-co-ban, rxjs/deep-dive/subjects/rxjs-va-signals-kien-truc]
---

## TL;DR

```ts
const user = resource({
  params: () => ({ id: this.userId() }), // signal → params; trả undefined → idle
  loader: async ({ params, abortSignal }) => {
    const res = await fetch(`/api/users/${params.id}`, { signal: abortSignal });
    if (!res.ok) throw new Error(res.statusText);
    return (await res.json()) as User;
  },
});
```

1. `params()` được theo dõi như `computed`. Mỗi khi nó đổi → loader cũ bị **abort** (`abortSignal`), loader mới chạy.
2. Trả về `undefined` từ `params` → trạng thái `idle`, **không gọi** loader (hữu ích khi chưa đủ điều kiện).
3. Kết quả được đưa vào các signal: `value`, `status`, `error`, `isLoading`, `hasValue`.

## httpResource

`httpResource` là resource dùng `HttpClient` — đi qua **interceptor** (auth, retry) của app:

```ts
readonly orders = httpResource<Order[]>(() => ({
  url: '/api/orders',
  params: { page: this.page(), q: this.query() },
}));
```

## Cập nhật lạc quan với `set` / `update`

```ts
toggleDone(todo: Todo) {
  this.todos.update((list) => list?.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)));
  // status() lúc này là 'local'
  this.api.toggle(todo.id).subscribe({ error: () => this.todos.reload() }); // lỗi → tải lại từ server
}
```

## So sánh lựa chọn cho server state

| Nhu cầu | `httpResource` | RxJS + `shareReplay` | TanStack Query |
|---|---|---|---|
| Fetch theo params, huỷ request cũ | ✓ | ✓ (`switchMap`) | ✓ |
| Trạng thái loading/error sẵn có | ✓ | Tự viết | ✓ |
| Cache dùng chung nhiều component, stale time, refetch khi focus | ✗ (tự làm) | Một phần | ✓ |
| Debounce / điều phối phức tạp | Kết hợp RxJS | ✓ | Một phần |

:::senior Góc nhìn Senior
Với ứng dụng enterprise nhiều màn hình cùng đọc một dữ liệu (danh mục, hồ sơ người dùng), `httpResource` đặt trong component sẽ **gọi lại API ở mỗi màn hình**. Hoặc đặt resource trong một service dùng chung, hoặc dùng thư viện server state có cache (TanStack Query). Hãy chọn và ghi lại quyết định (ADR) cho cả team.
:::

:::quiz `params` trả về `undefined` khi `userId()` rỗng. Trạng thái resource là?
- [ ] `loading`
- [x] `idle` và loader không được gọi
- [ ] `error`
- [ ] `resolved` với `value()` là `undefined`

Đây là cách "chờ đủ điều kiện" mà không cần `if` trong loader.
:::

:::quiz Vì sao nên dùng `abortSignal` trong loader tự viết bằng `fetch`?
- [ ] Bắt buộc, nếu không sẽ lỗi biên dịch
- [x] Để request cũ thực sự bị huỷ khi params đổi, tránh tốn băng thông và race condition
- [ ] Để retry tự động
- [ ] Để cache

Resource bỏ qua kết quả của loader cũ, nhưng chỉ `abortSignal` mới dừng request mạng thật.
:::

:::quiz Sau khi gọi `todos.update(...)` thủ công, `todos.status()` là?
- [ ] `resolved`
- [ ] `reloading`
- [x] `local`
- [ ] `idle`

`local` cho biết giá trị đến từ cập nhật tại chỗ, chưa đồng bộ với server.
:::

:::exercise Ô tìm kiếm với httpResource
Có `query = signal('')`. Viết `results` dùng `httpResource` gọi `/api/search?q=...` nhưng **không gọi** khi query ngắn hơn 2 ký tự.
???
```ts
readonly query = signal('');
readonly results = httpResource<Item[]>(() => {
  const q = this.query().trim();
  return q.length < 2 ? undefined : { url: '/api/search', params: { q } };
});
```
Trả `undefined` → `idle`. Nếu cần debounce, tạo `debouncedQuery` bằng RxJS (`toObservable` → `debounceTime` → `toSignal`) rồi dùng nó trong hàm request.
:::
