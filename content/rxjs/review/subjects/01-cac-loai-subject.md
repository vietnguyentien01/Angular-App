---
title: Subject, BehaviorSubject, ReplaySubject, AsyncSubject
summary: Bốn loại Subject khác nhau ở chỗ subscriber đến muộn nhận được gì.
type: card
level: core
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, subject]
related: [rxjs/consolidate/subjects/sharereplay-va-multicasting]
---

## TL;DR

`Subject` vừa là **Observable** (subscribe được) vừa là **Observer** (gọi `next` được) và là **hot / multicast**: mọi subscriber dùng chung.

| Loại | Subscriber mới nhận được | Dùng khi |
|---|---|---|
| `Subject` | Chỉ giá trị phát **sau** khi subscribe | Event bus, `destroy$` |
| `BehaviorSubject(init)` | Giá trị **hiện tại** ngay lập tức (bắt buộc có giá trị đầu) | State có giá trị ban đầu |
| `ReplaySubject(n)` | **n** giá trị gần nhất | Cache vài giá trị cuối |
| `AsyncSubject` | Chỉ giá trị **cuối cùng**, khi complete | Hiếm dùng |

```ts title="cart.service.ts"
@Service()
export class CartService {
  private readonly items$$ = new BehaviorSubject<Item[]>([]);
  /** Chỉ lộ ra Observable — bên ngoài không gọi next() được */
  readonly items$ = this.items$$.asObservable();

  add(item: Item) {
    this.items$$.next([...this.items$$.value, item]);
  }
}
```

:::senior Ngày nay
Với **state đồng bộ** trong Angular hiện đại, `signal()` thường thay thế `BehaviorSubject` gọn hơn (không cần subscribe/unsubscribe). Giữ Subject cho **luồng sự kiện** (event stream) và khi cần operator thời gian.
:::

:::quiz In ra gì?
```ts
const s = new Subject<number>();
s.next(1);
s.subscribe((v) => console.log(v));
s.next(2);
```

- [ ] `1, 2`
- [x] `2`
- [ ] `1`
- [ ] Không in gì

`Subject` không lưu giá trị. `1` được phát khi chưa có subscriber nên bị mất.
:::

:::quiz In ra gì?
```ts
const s = new BehaviorSubject(0);
s.next(1);
s.next(2);
s.subscribe((v) => console.log(v));
s.next(3);
```

- [ ] `0, 1, 2, 3`
- [ ] `3`
- [x] `2, 3`
- [ ] `0, 3`

`BehaviorSubject` phát ngay **giá trị hiện tại** (`2`) cho subscriber mới, rồi các giá trị tiếp theo.
:::

:::quiz In ra gì?
```ts
const s = new ReplaySubject<number>(2);
s.next(1);
s.next(2);
s.next(3);
s.subscribe((v) => console.log(v));
```

- [ ] `1, 2, 3`
- [x] `2, 3`
- [ ] `3`
- [ ] `1, 2`

`ReplaySubject(2)` lưu **2** giá trị gần nhất và phát lại cho subscriber mới.
:::
