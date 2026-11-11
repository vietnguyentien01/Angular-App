---
title: Các hàm tạo Observable
summary: of, from, interval, timer, fromEvent, defer, EMPTY, throwError — tạo luồng từ giá trị, Promise, sự kiện và hàm.
type: card
level: core
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, creation]
related: [rxjs/review/observable/observable-observer-subscription, rxjs/consolidate/observable/thu-tu-thuc-thi]
---

## Bảng tra nhanh

| Hàm | Phát | Complete |
|---|---|---|
| `of(1, 2, 3)` | Từng tham số, **đồng bộ** | Ngay sau đó |
| `from([1, 2, 3])` | Từng phần tử của mảng/iterable | Ngay sau đó |
| `from(promise)` | Giá trị khi Promise resolve | Sau giá trị đó |
| `interval(1000)` | `0, 1, 2…` mỗi giây | Không bao giờ |
| `timer(500)` | `0` sau 500ms | Ngay sau đó |
| `timer(0, 1000)` | `0` ngay, rồi mỗi giây | Không bao giờ |
| `fromEvent(el, 'click')` | Mỗi sự kiện DOM | Không bao giờ |
| `defer(() => obs$)` | Tạo Observable **lúc subscribe** | Theo obs$ |
| `EMPTY` | Không gì | Ngay lập tức |
| `throwError(() => err)` | Lỗi ngay | — |

## `defer` — trì hoãn việc tạo

```ts
// Promise chạy NGAY khi tạo (eager) — dù chưa ai subscribe
const eager$ = from(fetch('/api/me'));

// Mỗi lần subscribe mới gọi fetch — đúng tinh thần lazy của Observable
const lazy$ = defer(() => fetch('/api/me'));
```

:::quiz `of([1, 2, 3])` phát ra gì?
- [ ] `1`, `2`, `3` (ba lần)
- [x] Một lần, giá trị là mảng `[1, 2, 3]`
- [ ] Lỗi
- [ ] Không phát gì

`of` phát **từng tham số**; ở đây chỉ có một tham số là mảng. Muốn phát từng phần tử: `from([1, 2, 3])` hoặc `of(1, 2, 3)`.
:::

:::quiz `from(fetch('/api/x'))` — request được gửi khi nào?
- [ ] Khi subscribe
- [x] Ngay khi dòng code chạy, vì `fetch` trả Promise đã bắt đầu
- [ ] Không bao giờ
- [ ] Sau 1 tick

Promise là eager. Dùng `defer(() => fetch(...))` để chỉ gọi khi subscribe (và gọi lại cho mỗi subscriber).
:::

:::quiz `timer(0, 1000).pipe(take(3))` phát gì và khi nào complete?
- [ ] `1, 2, 3`, không complete
- [x] `0` ngay (bất đồng bộ), `1` sau 1s, `2` sau 2s, rồi complete
- [ ] `0, 0, 0`
- [ ] `0` rồi complete

`take(3)` lấy 3 giá trị đầu rồi complete và huỷ timer.
:::
