---
title: Cheat sheet operators hay dùng
summary: Nhóm operator theo mục đích — biến đổi, lọc, thời gian, kết hợp — kèm ví dụ một dòng.
type: cheatsheet
level: core
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, operators, cheatsheet]
related: [rxjs/consolidate/operators/combinelatest-forkjoin-withlatestfrom]
---

## Biến đổi & lọc

| Operator | Làm gì | Ví dụ |
|---|---|---|
| `map` | Biến đổi từng giá trị | `map(u => u.name)` |
| `filter` | Giữ giá trị thoả điều kiện | `filter(q => q.length >= 2)` |
| `tap` | Side effect, không đổi giá trị | `tap(v => console.log(v))` |
| `distinctUntilChanged` | Bỏ giá trị trùng giá trị liền trước | `distinctUntilChanged()` |
| `scan` | Tích luỹ (như `reduce` nhưng phát từng bước) | `scan((sum, x) => sum + x, 0)` |
| `startWith` | Phát giá trị đầu tiên ngay | `startWith('')` |
| `take(n)` / `first()` | Lấy n giá trị rồi complete | `take(1)` |
| `takeUntil(notifier$)` | Dừng khi notifier phát | `takeUntil(destroy$)` |

## Thời gian

| Operator | Làm gì | Dùng khi |
|---|---|---|
| `debounceTime(ms)` | Chờ "im lặng" ms rồi phát giá trị cuối | Ô tìm kiếm |
| `throttleTime(ms)` | Phát giá trị đầu, bỏ qua trong ms | Scroll, resize |
| `auditTime(ms)` | Phát giá trị **cuối** mỗi khoảng ms | Cập nhật vị trí chuột |
| `delay(ms)` | Trì hoãn mỗi giá trị | Demo, animation |

## Kết hợp

| Operator | Phát khi | Complete khi |
|---|---|---|
| `combineLatest([a$, b$])` | Bất kỳ nguồn nào phát (sau khi **tất cả** đã phát ≥ 1 lần) | Tất cả complete |
| `forkJoin([a$, b$])` | **Một lần**, khi tất cả complete (giá trị cuối của mỗi nguồn) | Ngay sau đó |
| `merge(a$, b$)` | Bất kỳ nguồn nào phát | Tất cả complete |
| `zip(a$, b$)` | Ghép cặp theo thứ tự | Một nguồn complete và hết cặp |
| `a$.pipe(withLatestFrom(b$))` | **Chỉ khi a$** phát, kèm giá trị mới nhất của b$ | a$ complete |

:::tip Pattern ô tìm kiếm kinh điển
```ts
this.query$.pipe(
  map((q) => q.trim()),
  debounceTime(300),
  distinctUntilChanged(),
  filter((q) => q.length >= 2),
  switchMap((q) => this.api.search(q)),
);
```
:::

:::quiz Người dùng gõ "a", "an", "ang" mỗi lần cách nhau 100ms rồi dừng. Với `debounceTime(300)`, giá trị nào được phát?
- [ ] `a`, `an`, `ang`
- [ ] `a`
- [x] `ang` (khoảng 300ms sau lần gõ cuối)
- [ ] Không có gì

`debounceTime` reset bộ đếm mỗi khi có giá trị mới; chỉ khi nguồn "im lặng" đủ 300ms nó mới phát giá trị **cuối cùng**.
:::

:::quiz Bạn cần gọi 3 API song song và chỉ xử lý khi CẢ 3 đã trả về. Chọn operator nào?
- [x] `forkJoin`
- [ ] `combineLatest`
- [ ] `merge`
- [ ] `concat`

`forkJoin` chờ tất cả nguồn **complete** rồi phát một lần mảng giá trị cuối — hợp với HTTP request (phát 1 lần rồi complete). Lưu ý: nếu một nguồn lỗi, `forkJoin` lỗi; nếu một nguồn complete mà không phát gì, `forkJoin` complete mà **không phát**.
:::

:::quiz `of(1, 1, 2, 2, 1).pipe(distinctUntilChanged())` phát ra gì?
- [ ] `1, 2`
- [x] `1, 2, 1`
- [ ] `1, 1, 2, 2, 1`
- [ ] `2, 1`

`distinctUntilChanged` chỉ so với giá trị **liền trước**, không phải mọi giá trị đã thấy (đó là `distinct`).
:::
