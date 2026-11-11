---
title: Marble testing với TestScheduler
summary: Test logic phụ thuộc thời gian (debounce, retry, switchMap) chạy tức thì và chính xác bằng marble diagram.
level: advanced
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, testing, marble]
related: [rxjs/deep-dive/operators/tu-viet-custom-operator]
---

## TL;DR

`TestScheduler` chạy code RxJS trong **thời gian ảo**: `debounceTime(300)` không phải chờ 300ms thật. Bạn mô tả input/output bằng chuỗi marble:

| Ký hiệu | Ý nghĩa |
|---|---|
| `-` | 1 frame (1ms ảo) |
| `a` | Phát giá trị `a` |
| `\|` | Complete |
| `#` | Error |
| `^` | Điểm subscribe (hot) |
| `(ab)` | Phát `a` và `b` cùng frame |
| `300ms` | Khoảng thời gian |

```ts title="search.spec.ts"
import { TestScheduler } from 'rxjs/testing';

describe('search pipeline', () => {
  let scheduler: TestScheduler;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  it('debounce và chỉ lấy từ khoá cuối', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const input = cold('a 100ms b 400ms c|');
      const result = input.pipe(debounceTime(300));
      // a@0, b@101, c@502, complete@503
      // b phát sau 300ms im lặng (101 + 300 = 401); c được "xả" ngay khi nguồn complete
      expectObservable(result).toBe('401ms b 101ms (c|)');
    });
  });
});
```

:::tip Mẹo đọc chuỗi marble
Mỗi ký tự giá trị cũng chiếm **1 frame**. `'a 100ms b'`: `a` ở frame 0, `b` ở frame 101. Khoảng trắng chỉ để dễ đọc trong `run()`.
:::

## Test switchMap huỷ request cũ

```ts
it('switchMap huỷ inner cũ', () => {
  scheduler.run(({ cold, hot, expectObservable, expectSubscriptions }) => {
    const query = hot('-a-b------|'); // a@1, b@3: b đến khi inner của a chưa xong
    const api = cold('---r|'); // phát r sau 3 frame, complete ở frame 4
    const result = query.pipe(switchMap(() => api));
    // inner của a bị huỷ ở frame 3 (chưa kịp phát r); inner của b phát r@6
    expectObservable(result).toBe('------r---|');
    expectSubscriptions(api.subscriptions).toBe(['-^-!', '---^---!']);
  });
});
```

:::quiz Trong `scheduler.run`, chuỗi `'--a--|'` biểu diễn gì?
- [ ] Phát `a` ở frame 1, complete ở frame 4
- [x] Phát `a` ở frame 2, complete ở frame 5
- [ ] Phát `a` sau 2 giây
- [ ] Lỗi ở frame 5

Mỗi `-` là 1 frame, `a` ở vị trí thứ 3 (index 2), `|` ở index 5.
:::

:::quiz Lợi ích chính của marble testing so với `fakeAsync` + `tick`?
- [ ] Chạy được không cần RxJS
- [x] Mô tả chính xác thời điểm từng giá trị, kể cả subscribe/unsubscribe của inner, ngắn gọn và dễ đọc
- [ ] Không cần TestBed nên test được component
- [ ] Tự sinh code

Marble test kiểm tra được cả **khi nào** inner được subscribe/huỷ (`expectSubscriptions`) — thứ rất khó kiểm tra bằng `tick`.
:::

:::exercise Viết marble test cho `exhaustMap`
Nguồn click: `hot('-a-b--c-----|')`, inner: `cold('---x|')`. Viết kỳ vọng output khi dùng `exhaustMap`.
???
- Click `a` ở frame 1 → inner chạy từ frame 1, phát `x` ở frame 4, complete ở frame 5.
- Click `b` ở frame 3 → đang bận → bỏ qua.
- Click `c` ở frame 6 → inner trước đã complete → chạy, phát `x` ở frame 9, complete ở frame 10.
- Nguồn complete ở frame 12 (không còn inner đang chạy) → output complete ở frame 12.

```ts
expectObservable(result).toBe('----x----x--|');
```
:::

:::warning Cẩn thận khi click trùng frame inner complete
Nếu `c` ở **đúng** frame 5 (cùng lúc inner của `a` complete), `c` được xử lý trước và **vẫn bị bỏ qua**. Những chi tiết thứ tự trong cùng một frame như vậy là lý do nên chạy thử marble test thay vì đoán.
:::
