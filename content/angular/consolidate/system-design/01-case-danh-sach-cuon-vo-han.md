---
title: "Case: danh sách cuộn vô hạn (news feed / lịch sử xử lý)"
summary: Phân trang theo cursor, tải thêm khi gần cuối, giữ vị trí cuộn khi quay lại, tránh trùng/mất mục khi dữ liệu thay đổi.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [system-design, infinite-scroll, pagination]
related: [angular/review/system-design/checklist-yeu-cau-phi-chuc-nang, angular/deep-dive/system-design/case-dashboard-realtime]
---

## Offset hay cursor?

| | `?page=3&size=20` (offset) | `?after=<cursor>&limit=20` (cursor) |
|---|---|---|
| Có mục mới chèn lên đầu | Trang sau bị **trùng** mục | Không ảnh hưởng |
| Có mục bị xoá | Trang sau bị **mất** mục | Không ảnh hưởng |
| Nhảy tới trang bất kỳ | Được | Không |
| Hợp với | Bảng quản trị có số trang | Feed, lịch sử, chat |

## Thiết kế phía client

```ts title="feed.store.ts"
readonly items = signal<FeedItem[]>([]);
private cursor: string | null = null;
readonly loading = signal(false);
readonly done = signal(false);

private readonly loadMore$ = new Subject<void>();

constructor() {
  this.loadMore$
    .pipe(
      filter(() => !this.loading() && !this.done()),
      exhaustMap(() => {
        this.loading.set(true);
        return this.api.feed(this.cursor).pipe(finalize(() => this.loading.set(false)));
      }),
      takeUntilDestroyed(),
    )
    .subscribe((page) => {
      this.items.update((list) => [...list, ...page.items.filter((i) => !list.some((x) => x.id === i.id))]);
      this.cursor = page.nextCursor;
      this.done.set(!page.nextCursor);
    });
}

loadMore() { this.loadMore$.next(); }
```

```html
@for (item of store.items(); track item.id) { <app-feed-item [item]="item" /> }
@if (!store.done()) {
  <div appInViewport (enter)="store.loadMore()" aria-hidden="true"></div>
  @if (store.loading()) { <app-spinner /> }
}
```

`appInViewport` dùng `IntersectionObserver` trên phần tử "sentinel" cuối danh sách.

## Các điểm thường bị hỏi thêm

- **Giữ vị trí cuộn** khi vào chi tiết rồi Back: giữ store ở service (không huỷ theo component), `withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })` hoặc tự lưu offset.
- **Danh sách rất dài** (hàng nghìn mục): kết hợp virtual scroll để DOM không phình.
- **A11y**: nút "Tải thêm" dự phòng cho người dùng bàn phím; thông báo "đã tải thêm 20 mục" qua live region.

:::quiz Vì sao dùng `exhaustMap` cho `loadMore$`?
- [ ] Để huỷ request cũ
- [x] Sentinel có thể bắn nhiều lần liên tiếp khi cuộn nhanh; `exhaustMap` bỏ qua các lần kích hoạt trong lúc đang tải → không tải trùng trang
- [ ] Để tải song song
- [ ] Bắt buộc với IntersectionObserver

`switchMap` sẽ huỷ request đang tải dở rồi tải lại cùng cursor — lãng phí.
:::

:::quiz Feed dùng offset (`page=2`). Trong lúc người dùng đọc trang 1, có 3 bài mới đăng lên đầu. Khi tải trang 2 điều gì xảy ra?
- [ ] Không có gì
- [x] 3 bài cuối của trang 1 xuất hiện lại ở đầu trang 2 (trùng)
- [ ] Mất 3 bài
- [ ] Lỗi server

Đó là lý do feed nên dùng cursor; nếu buộc dùng offset, phải lọc trùng theo id (như code ở trên).
:::

:::exercise Viết directive `appInViewport`
Viết directive phát output `enter` khi phần tử lọt vào viewport, dùng `IntersectionObserver`, dọn dẹp khi bị huỷ, an toàn với SSR.
???
```ts
@Directive({ selector: '[appInViewport]' })
export class InViewportDirective {
  readonly enter = output<void>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef); // lấy trong injection context

  constructor() {
    afterNextRender(() => {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) this.enter.emit();
        },
        { rootMargin: '200px' }, // tải sớm trước khi chạm đáy
      );
      io.observe(this.el.nativeElement);
      this.destroyRef.onDestroy(() => io.disconnect());
    });
  }
}
```
Không gọi `inject()` bên trong callback của `afterNextRender` — lúc đó không còn injection context. `afterNextRender` đảm bảo code không chạy trên server.
:::
