---
title: Zoneless bên trong — Angular biết khi nào cần render thế nào?
summary: Từ Zone.js "đoán" mọi tác vụ async sang mô hình thông báo tường minh; những gì kích hoạt render và cách migrate dự án cũ.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [zoneless, change-detection, internals, migration]
related: [angular/deep-dive/signals/reactive-graph, angular/consolidate/change-detection/markforcheck-detectchanges]
---

## TL;DR

- **Zone.js** patch mọi API bất đồng bộ (`setTimeout`, `Promise`, `addEventListener`, XHR…). Mỗi khi một tác vụ kết thúc, Angular chạy change detection **cho chắc** — kể cả khi không có gì đổi.
- **Zoneless**: không patch gì cả. Angular chỉ lên lịch change detection khi nhận được **thông báo** cụ thể.
- Từ v21, app mới mặc định zoneless; app này (Angular 22) không cài `zone.js` và cũng không cần provider nào.

## Những gì lên lịch change detection khi zoneless

| Nguồn | Ví dụ |
|---|---|
| Signal được đọc trong template thay đổi | `count.set(1)` |
| `markForCheck()` (kể cả qua `async` pipe) | `obs$ \| async` nhận giá trị |
| Event listener trong template / host | `(click)`, `host: { '(keydown)': ... }` |
| `ComponentRef.setInput()` | Component động |
| Attach / detach view, tạo component | `ViewContainerRef.createComponent` |

**Không** kích hoạt: `setTimeout`, `Promise.then`, callback của thư viện ngoài, gán field thường bên ngoài event.

```ts bad title="Hoạt động với Zone.js, im lặng khi zoneless"
ngOnInit() {
  setTimeout(() => (this.loaded = true), 500);
}
```

```ts good
readonly loaded = signal(false);
ngOnInit() {
  setTimeout(() => this.loaded.set(true), 500);
}
```

## Migrate dự án cũ sang zoneless

1. Chuyển component sang **OnPush** trước (zoneless chỉ ổn khi component đã OnPush-safe).
2. Thay state hiển thị bằng **signals** hoặc `async` pipe.
3. Bỏ phụ thuộc `NgZone.onStable` / `onMicrotaskEmpty` → `afterNextRender` / `afterEveryRender`.
4. Bật `provideZonelessChangeDetection()` (bản ≤ v20), bỏ `zone.js` khỏi `polyfills`.
5. SSR: dùng `PendingTasks` cho tác vụ async mà server cần chờ.

:::version v16 Ở Angular 16 / 19
v16 chỉ có Zone.js. Zoneless xuất hiện thử nghiệm ở v18, developer preview ở v20 và ổn định từ v20.2; v21 bật mặc định cho app mới. Dự án v16–v19 muốn chuẩn bị: viết component OnPush + signals ngay từ bây giờ — code đó chạy đúng ở cả hai thế giới.
:::

:::quiz Trong app zoneless, component gán `this.items = data` (field thường) trong callback `subscribe` của HTTP. Kết quả?
- [ ] UI cập nhật ngay
- [x] UI không cập nhật cho tới khi có thông báo khác (event, signal…)
- [ ] Lỗi runtime
- [ ] Angular tự gọi `detectChanges`

Không có Zone.js để "đoán" rằng HTTP vừa xong. Dùng `toSignal`, `async` pipe, hoặc `httpResource`.
:::

:::quiz Thư viện cũ dùng `ngZone.onStable.subscribe(...)` để chạy code sau render. Khi zoneless thì?
- [ ] Vẫn chạy như cũ
- [x] Không còn đáng tin — thay bằng `afterNextRender` / `afterEveryRender`
- [ ] Chạy nhiều lần hơn
- [ ] Lỗi biên dịch

Khi zoneless, `NgZone` là bản no-op nên các sự kiện của nó không phản ánh vòng render nữa.
:::

:::quiz Lợi ích nào KHÔNG phải của zoneless?
- [ ] Bundle nhỏ hơn (không có zone.js)
- [ ] Ít lượt change detection thừa
- [ ] Stack trace dễ đọc hơn
- [x] Không cần quan tâm OnPush hay signals nữa

Ngược lại: zoneless **đòi hỏi** state được thông báo rõ ràng (signals/markForCheck).
:::

:::interview Giải thích vì sao Zone.js gây change detection thừa?
Zone.js không biết tác vụ async nào làm đổi state hiển thị. Nó chỉ biết "có tác vụ vừa xong", nên Angular chạy CD từ root mỗi lần — kể cả cho `setTimeout` của analytics hay `mousemove` không liên quan. Với cây component lớn, đây là chi phí đáng kể. Signals cho Angular biết **chính xác** view nào phụ thuộc vào dữ liệu nào.
:::
