---
title: "Case study: dashboard realtime qua WebSocket"
summary: Thiết kế dashboard nhận hàng trăm cập nhật mỗi giây — kết nối lại, backpressure, gộp cập nhật trước khi render, và giữ UI mượt.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [system-design, websocket, realtime, rxjs, performance]
related: [angular/deep-dive/system-design/khung-tra-loi-system-design, rxjs/deep-dive/subjects/rxjs-va-signals-kien-truc]
---

## Yêu cầu

- Hiển thị số liệu xử lý hồ sơ theo đơn vị, cập nhật realtime (~200 message/giây lúc cao điểm).
- Mất mạng → tự kết nối lại, không mất dữ liệu quan trọng.
- UI không giật, chạy được trên máy văn phòng cấu hình thấp.

## Kiến trúc dữ liệu

```text
WebSocket ──► messages$ (RxJS) ──► scan(apply patch vào state) ──► auditTime(250ms) ──► toSignal ──► template
                │
                └─ retry({ delay: backoff }) khi mất kết nối, sau khi nối lại: tải snapshot đầy đủ
```

```ts title="dashboard.store.ts"
private readonly socket$ = webSocket<Patch>('wss://…/dashboard');

private readonly state$ = defer(() => this.api.snapshot()).pipe(
  switchMap((snapshot) =>
    this.socket$.pipe(scan((state, patch) => applyPatch(state, patch), snapshot), startWith(snapshot)),
  ),
  retry({ delay: (_, n) => timer(Math.min(30_000, 1000 * 2 ** n)) }), // nối lại + tải lại snapshot
  auditTime(250), // tối đa ~4 lần render/giây
  share(),
);

readonly state = toSignal(this.state$, { initialValue: EMPTY_STATE });
```

## Các quyết định chính

| Vấn đề | Quyết định | Vì sao |
|---|---|---|
| 200 msg/s | Xử lý **mọi** message bằng `scan`, nhưng chỉ render bằng `auditTime(250)` | Không mất dữ liệu, nhưng không render 200 lần/giây |
| Mất kết nối | `retry` có backoff + tải **snapshot** sau khi nối lại | Message bị lỡ trong lúc mất mạng được bù bằng snapshot |
| Render bảng lớn | `track` theo id, OnPush, chỉ dòng đổi mới cập nhật | Giảm DOM thay đổi |
| Tab ẩn | Tạm dừng render khi `document.hidden` | Tiết kiệm CPU/pin |

:::quiz Vì sao dùng `scan` cho mọi message nhưng `auditTime` trước khi render?
- [ ] Để giảm số message nhận được
- [x] State phải áp dụng đủ mọi patch (không mất dữ liệu), còn UI chỉ cần cập nhật vài lần mỗi giây
- [ ] Vì `scan` không chạy với WebSocket
- [ ] Để retry

Tách "xử lý dữ liệu" khỏi "tần suất render" là kỹ thuật cốt lõi với dữ liệu tần suất cao.
:::

:::quiz Sau khi WebSocket nối lại, vì sao phải tải lại snapshot?
- [ ] Không cần
- [x] Các patch phát ra trong lúc mất kết nối đã bị lỡ; áp patch mới lên state cũ sẽ cho kết quả sai
- [ ] Để làm mới token
- [ ] Vì WebSocket không giữ kết nối

Pattern "snapshot + stream of patches" luôn cần đồng bộ lại khi có gián đoạn (hoặc server hỗ trợ gửi lại từ sequence number).
:::

:::exercise Mở rộng
Người dùng muốn "tạm dừng cập nhật" để đọc số liệu, rồi "tiếp tục". Thiết kế thế nào để khi tiếp tục, số liệu đúng ngay?
???
Không dừng kết nối — tiếp tục `scan` mọi patch để state luôn đúng, chỉ dừng **render**:

```ts
readonly paused = signal(false);
private readonly view$ = combineLatest([this.state$, toObservable(this.paused)]).pipe(
  filter(([, paused]) => !paused),
  map(([state]) => state),
);
```
Khi `paused` về `false`, `combineLatest` phát ngay state mới nhất (đã áp đủ patch trong lúc dừng). Hiển thị badge "Có N cập nhật mới" trong lúc tạm dừng.
:::
