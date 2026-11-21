---
title: catchError, retry, finalize
summary: Lỗi làm luồng chết — ba operator cơ bản để bắt lỗi, thử lại và dọn dẹp.
type: card
level: core
version: 7
lastReviewed: 2026-11-19
tags: [rxjs, error]
related: [rxjs/consolidate/errors/xu-ly-loi-dung-cho]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

- Khi một Observable phát `error`, nó **kết thúc** — không phát thêm gì nữa.
- `catchError(err => fallback$)` — bắt lỗi và **thay thế** bằng một Observable khác (vd `of([])`, `EMPTY`).
- `retry({ count: 2, delay: 1000 })` — subscribe lại nguồn khi lỗi.
- `finalize(() => ...)` — chạy khi luồng kết thúc **vì bất kỳ lý do gì** (complete, error, unsubscribe). Hợp để tắt loading.

```ts
this.loading.set(true);
this.http.get<User[]>('/api/users').pipe(
  retry({ count: 2, delay: 500 }),
  catchError((err) => {
    this.error.set('Không tải được danh sách');
    return of([]);
  }),
  finalize(() => this.loading.set(false)),
);
```

:::quiz Trong đoạn dưới đây, thứ tự `retry` và `catchError` có quan trọng không?
```ts
this.http.get<User[]>('/api/users').pipe(
  retry({ count: 2, delay: 500 }),
  catchError((err) => {
    this.error.set('Không tải được danh sách');
    return of([]);
  }),
  finalize(() => this.loading.set(false)),
);
```

- [x] Có — `retry` phải đứng trước `catchError`, nếu không lỗi đã bị "nuốt" trước khi kịp retry
- [ ] Không, operator chạy song song
- [ ] Có — `catchError` phải đứng trước để retry hoạt động
- [ ] Chỉ quan trọng với Promise

Operator xử lý theo thứ tự trong `pipe`. Nếu `catchError` đứng trước, nó biến lỗi thành `of([])` (thành công) nên `retry` phía sau không bao giờ thấy lỗi.
:::

:::quiz `catchError(() => EMPTY)` làm gì?
- [ ] Phát `null` rồi tiếp tục
- [x] Kết thúc luồng bằng `complete` thay vì `error`, không phát giá trị
- [ ] Subscribe lại nguồn
- [ ] Ném lỗi ra ngoài

`EMPTY` là Observable complete ngay mà không phát gì. Lỗi được "nuốt" và subscriber nhận `complete`.
:::
