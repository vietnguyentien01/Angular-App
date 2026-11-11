---
title: combineLatest vs forkJoin vs withLatestFrom
summary: Ba cách kết hợp nhiều luồng — khi nào phát, khi nào complete, và các bẫy "không bao giờ phát".
level: intermediate
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, combineLatest, forkJoin]
related: [rxjs/review/operators/operators-hay-dung]
---

## TL;DR

- `combineLatest` — **trạng thái dẫn xuất** từ nhiều nguồn đang sống (filter + sort + data).
- `forkJoin` — **chờ nhiều request một lần** (như `Promise.all`).
- `withLatestFrom` — **khi sự kiện A xảy ra**, lấy giá trị hiện tại của B (B không tự kích hoạt).

```ts title="product-list.ts"
// Danh sách được lọc: chạy lại khi bất kỳ nguồn nào đổi
readonly visible$ = combineLatest([this.products$, this.filter$, this.sort$]).pipe(
  map(([products, filter, sort]) => applyFilterSort(products, filter, sort)),
);

// Màn hình chi tiết cần 3 API, hiển thị khi đủ cả 3
readonly page$ = forkJoin({
  user: this.api.user(id),
  orders: this.api.orders(id),
  settings: this.api.settings(id),
});

// Khi bấm Lưu, gửi kèm form value hiện tại
this.save$.pipe(withLatestFrom(this.form.valueChanges), concatMap(([, value]) => this.api.save(value)));
```

## Bẫy "không bao giờ phát"

:::warning combineLatest chờ tất cả
`combineLatest` chỉ phát lần đầu khi **mọi** nguồn đã phát ít nhất 1 giá trị. Một `Subject` chưa từng `next` sẽ chặn cả luồng. Giải pháp: `startWith(...)` hoặc dùng `BehaviorSubject`.
:::

:::warning forkJoin chờ tất cả complete
Đưa một nguồn **không complete** (vd `valueChanges`, `interval`, `Subject`) vào `forkJoin` → nó **không bao giờ phát**. Chỉ dùng với nguồn complete như HTTP.
:::

:::quiz `combineLatest([a$, b$])`, trong đó `a$` phát `1` lúc 0ms và `b$` chưa phát gì. Kết quả?
- [ ] Phát `[1, undefined]`
- [x] Chưa phát gì cho tới khi `b$` phát lần đầu
- [ ] Lỗi
- [ ] Phát `[1]`

`combineLatest` cần mỗi nguồn có ít nhất một giá trị "mới nhất".
:::

:::quiz `forkJoin([http.get('/a'), this.form.valueChanges])` sẽ?
- [ ] Phát khi `/a` trả về
- [ ] Phát mỗi khi form đổi
- [x] Không bao giờ phát vì `valueChanges` không complete
- [ ] Phát `[a, null]`

`forkJoin` phát giá trị cuối của mỗi nguồn khi **tất cả** complete.
:::

:::quiz `click$.pipe(withLatestFrom(value$))`. Khi `value$` phát giá trị mới mà không có click, chuyện gì xảy ra?
- [ ] Luồng phát `[lastClick, newValue]`
- [x] Không phát gì — chỉ `click$` kích hoạt việc phát
- [ ] Lỗi
- [ ] Luồng complete

`withLatestFrom` chỉ "chụp" giá trị mới nhất của `value$` khi nguồn chính phát. Nếu `value$` chưa phát lần nào, các click trước đó bị bỏ qua.
:::

:::exercise Tìm bug
```ts
readonly vm$ = combineLatest([this.search$, this.http.get<Item[]>('/api/items')]).pipe(
  map(([q, items]) => items.filter((i) => i.name.includes(q))),
);
// search$ = new Subject<string>()
```
Danh sách trống khi vào trang cho tới khi người dùng gõ. Sửa thế nào?
???
`search$` là `Subject` chưa phát nên `combineLatest` chưa phát lần nào. Thêm giá trị đầu:

```ts
combineLatest([this.search$.pipe(startWith('')), this.items$]);
```
Ngoài ra nên `shareReplay` cho `items$` nếu dùng ở nhiều nơi, để không gọi API lại.
:::
