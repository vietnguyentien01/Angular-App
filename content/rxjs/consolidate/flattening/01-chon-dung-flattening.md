---
title: Chọn đúng flattening operator trong tình huống thật
summary: Autocomplete, auto-save, nút submit, tải chi tiết theo route — phân tích race condition và chọn operator phù hợp.
level: intermediate
version: 7
lastReviewed: 2026-11-11
tags: [rxjs, flattening, race-condition]
related: [rxjs/review/flattening/bon-toan-tu-flattening, rxjs/consolidate/errors/xu-ly-loi-dung-cho]
---

## TL;DR

Câu hỏi cần trả lời: **"Nếu yêu cầu mới tới khi yêu cầu cũ chưa xong, chuyện gì nên xảy ra?"**

- Kết quả cũ **vô nghĩa** → `switchMap`
- Mọi yêu cầu phải **được thực hiện, đúng thứ tự** → `concatMap`
- Yêu cầu mới **không được phép chạy** khi đang bận → `exhaustMap`
- Các yêu cầu **độc lập**, thứ tự không quan trọng → `mergeMap`

:::demo rxjs-flattening

## Case 1 — Autocomplete

```ts bad
this.query$.pipe(
  debounceTime(300),
  mergeMap((q) => this.api.search(q)), // race condition
);
```

```ts good
this.query$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap((q) => this.api.search(q)),
);
```

## Case 2 — Auto-save form (đúng thứ tự)

Bản nháp phải được lưu **theo đúng thứ tự** thay đổi, nếu không bản cũ có thể ghi đè bản mới trên server:

```ts good title="draft-autosave.ts"
this.form.valueChanges.pipe(
  debounceTime(1000),
  concatMap((draft) => this.api.saveDraft(draft)),
  takeUntilDestroyed(),
).subscribe();
```

:::senior Góc nhìn Senior
Với auto-save, `switchMap` **nghe có vẻ** đúng ("chỉ lưu bản mới nhất") nhưng huỷ request ở client **không** đảm bảo server chưa xử lý nó. Hai request có thể tới server không theo thứ tự. `concatMap` đảm bảo tuần tự; nếu hàng đợi dài, kết hợp với `debounceTime` hoặc gửi kèm version để server từ chối bản cũ.
:::

## Case 3 — Nút submit / thanh toán

```ts good
this.submit$.pipe(
  exhaustMap(() => this.api.pay(this.order())),
  takeUntilDestroyed(),
).subscribe();
```

## Case 4 — Tải chi tiết theo route param

```ts good
readonly order = toSignal(
  inject(ActivatedRoute).paramMap.pipe(
    map((p) => p.get('id')!),
    switchMap((id) => this.api.getOrder(id)),
  ),
);
```

:::quiz Upload 20 file, mỗi file độc lập, nhưng server chỉ chịu tối đa 3 request đồng thời. Chọn?
- [ ] `switchMap`
- [x] `mergeMap(upload, 3)`
- [ ] `concatMap`
- [ ] `exhaustMap`

Tham số thứ 2 của `mergeMap` là `concurrent`: tối đa 3 inner chạy cùng lúc, phần còn lại xếp hàng. `concatMap` chính là `mergeMap(fn, 1)`.
:::

:::quiz Trong case auto-save, nếu dùng `exhaustMap` thì điều gì xảy ra khi người dùng sửa form trong lúc đang lưu?
- [ ] Lần sửa đó được lưu sau khi request hiện tại xong
- [x] Lần sửa đó bị bỏ qua — server có thể giữ bản nháp cũ
- [ ] Request hiện tại bị huỷ
- [ ] Hai request chạy song song

`exhaustMap` bỏ qua giá trị mới khi inner đang chạy. Nếu không có thay đổi nào tiếp theo, bản nháp cuối **không bao giờ** được lưu — bug mất dữ liệu.
:::

:::quiz `switchMap` huỷ inner cũ. Với HttpClient, "huỷ" nghĩa là gì?
- [ ] Server chắc chắn không xử lý request
- [x] Trình duyệt abort request, client bỏ qua response — nhưng server có thể đã nhận và xử lý
- [ ] Request được gửi lại
- [ ] Không có gì, chỉ bỏ qua response

Unsubscribe khỏi `HttpClient` sẽ abort XHR/fetch. Nếu request đã tới server, server vẫn có thể hoàn tất. Vì vậy không dùng `switchMap` cho thao tác ghi quan trọng.
:::

:::quiz Đoạn code dưới có vấn đề gì?
```ts
this.route.paramMap.pipe(
  map((p) => p.get('id')!),
  concatMap((id) => this.api.getOrder(id)),
);
```

- [ ] Không có vấn đề
- [x] Chuyển nhanh giữa các đơn hàng sẽ tải tuần tự mọi đơn đã đi qua, màn hình hiển thị đơn cũ một lúc
- [ ] Lỗi biên dịch
- [ ] Memory leak vĩnh viễn

Khi xem chi tiết, chỉ đơn **hiện tại** có ý nghĩa → `switchMap`. `concatMap` buộc chờ từng request cũ.
:::

:::exercise Nút "Làm mới" gọi API danh sách
Người dùng có thể bấm "Làm mới" nhiều lần. Yêu cầu: luôn hiển thị dữ liệu của lần bấm **cuối cùng**, hiển thị loading, và không làm hỏng luồng khi API lỗi. Viết pipe cho `refresh$`.
???
```ts
readonly state = toSignal(
  this.refresh$.pipe(
    startWith(undefined),
    switchMap(() =>
      this.api.list().pipe(
        map((items) => ({ status: 'ok' as const, items })),
        catchError(() => of({ status: 'error' as const, items: [] })),
        startWith({ status: 'loading' as const, items: [] }),
      ),
    ),
  ),
  { initialValue: { status: 'loading' as const, items: [] } },
);
```
Điểm mấu chốt: `catchError` đặt **bên trong** `switchMap` để lỗi chỉ kết thúc inner, còn `refresh$` vẫn sống cho lần bấm tiếp theo.
:::

:::exercise Phân loại nhanh
Chọn operator cho: (a) chat gửi tin nhắn, (b) kéo slider lọc giá, (c) nút "Gửi OTP", (d) tải avatar cho 50 user trong danh sách.
???
(a) `concatMap` — tin nhắn phải đến đúng thứ tự. (b) `switchMap` (kèm `debounceTime`) — chỉ giá trị cuối có ý nghĩa. (c) `exhaustMap` — chống gửi OTP nhiều lần. (d) `mergeMap` có giới hạn concurrency, vd `mergeMap(load, 4)`.
:::
