---
title: toSignal và toObservable — cầu nối RxJS ↔ Signals
summary: Chuyển qua lại giữa Observable và Signal đúng cách, initialValue, requireSync và thời điểm phát giá trị.
level: intermediate
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, signals, interop]
related: [angular/consolidate/signals/effect-dung-cach]
---

## TL;DR

- `toSignal(obs$)` — subscribe ngay khi tạo, trả về Signal. Trước giá trị đầu tiên, giá trị là `undefined` (trừ khi có `initialValue` hoặc `requireSync: true`).
- `toObservable(sig)` — tạo Observable phát khi signal đổi. Phát **bất đồng bộ** (qua effect), và các thay đổi liên tiếp trong cùng một nhịp chỉ phát giá trị cuối.
- Cả hai cần **injection context** (hoặc truyền `injector`).

```ts title="search.ts"
export class Search {
  readonly query = signal('');

  readonly results = toSignal(
    toObservable(this.query).pipe(
      debounceTime(300),
      switchMap((q) => this.api.search(q)),
    ),
    { initialValue: [] as Item[] },
  );
}
```

## Các option của toSignal

| Option | Ý nghĩa |
|---|---|
| `initialValue` | Giá trị trước khi Observable phát lần đầu — kiểu trả về không còn `undefined` |
| `requireSync: true` | Khẳng định Observable phát **đồng bộ** khi subscribe (vd `BehaviorSubject`) — nếu không sẽ lỗi |
| `injector` | Dùng ngoài injection context |
| `manualCleanup` | Không tự unsubscribe khi context bị huỷ |

:::quiz `toSignal(this.http.get<User>('/me'))` có kiểu trả về là gì?
- [ ] `Signal<User>`
- [x] `Signal<User | undefined>`
- [ ] `Observable<User>`
- [ ] `Signal<Promise<User>>`

Không có `initialValue`, signal là `undefined` cho tới khi response về.
:::

:::quiz Code sau log mấy lần?
```ts
const count = signal(0);
toObservable(count).subscribe((v) => console.log(v));
count.set(1);
count.set(2);
count.set(3);
```

- [ ] 4 lần: `0, 1, 2, 3`
- [x] 1 lần: `3` (sau khi effect chạy)
- [ ] 3 lần: `1, 2, 3`
- [ ] Không lần nào

`toObservable` dùng effect bên dưới; effect chạy **sau**, khi đó signal đã là `3`. Các giá trị trung gian không được phát. Đừng dùng `toObservable` khi cần bắt từng thay đổi — dùng `Subject`.
:::

:::senior Khi nào giữ RxJS, khi nào sang Signals?
- **Signals**: state đồng bộ, giá trị dẫn xuất, binding trong template.
- **RxJS**: sự kiện theo thời gian (debounce, throttle), huỷ / race condition (switchMap), kết hợp nhiều luồng bất đồng bộ, WebSocket.
- Ranh giới hay gặp: luồng RxJS ở service/data layer → `toSignal` ở component.
:::
