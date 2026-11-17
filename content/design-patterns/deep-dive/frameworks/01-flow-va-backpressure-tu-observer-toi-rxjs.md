---
title: "Flow và backpressure — từ Observer tới Reactive Streams và RxJS"
summary: "Flow thêm request(n) vào Observer: đo được submit chặn người phát 930 ms để nhận đủ 100/100, offer không chờ thì mất 91/100. RxJS không có backpressure; concatMap, mergeMap, exhaustMap, switchMap quyết định xếp hàng, song song, bỏ hay huỷ. Đã chạy trên JDK 25 và RxJS 7.8."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, observer, reactive-streams, backpressure, flow, rxjs]
related: [design-patterns/review/frameworks/pattern-trong-spring-angular-rxjs, design-patterns/deep-dive/behavioral/observer-chain-of-responsibility-va-su-kien]
---

## Tóm tắt nhanh

- Observer cổ điển: người phát gọi `onNext` bao nhiêu tuỳ ý. Người nhận chậm → hàng đợi phình to (tràn bộ nhớ) hoặc người phát bị chặn.
- **Reactive Streams** (`java.util.concurrent.Flow` từ Java 9) thêm **backpressure**: người nhận gọi `subscription.request(n)` để nói "tôi nhận thêm n phần tử".
- `SubmissionPublisher.submit` **chặn** người phát khi bộ đệm của người nhận đầy (không mất dữ liệu, người phát chậm theo). `offer` cho bạn quyết định: chờ có hạn hoặc **bỏ**.
- RxJS **không** có backpressure theo kiểu `request(n)`; thay vào đó bạn chọn chiến lược bằng operator: `concatMap` (xếp hàng), `mergeMap` (song song), `exhaustMap` (bỏ khi bận), `switchMap` (huỷ cái cũ).
- Câu hỏi thiết kế luôn là: khi người nhận không theo kịp thì **chậm lại, xếp hàng, bỏ, hay huỷ**?

## Cơ chế: bốn interface của Flow

```text
Publisher.subscribe(subscriber)
        │
        ▼
Subscriber.onSubscribe(subscription) ──► subscription.request(n)   ← người nhận điều tiết
        │
        ▼  (tối đa n phần tử)
Subscriber.onNext(x) ... onNext(x) ──► request(n) tiếp
        │
        ▼
onComplete() | onError(t)                ← kết thúc, sau đó không còn onNext
```

`Flow.Processor` vừa là subscriber vừa là publisher — tương đương một operator. Flow chỉ là **interface chuẩn**; Project Reactor (Spring WebFlux), RxJava, Akka Streams, driver R2DBC cài đặt chúng để nối được với nhau.

## Demo Java: người nhận chậm 10 ms/phần tử, bộ đệm 8

```java title="Người nhận xin từng phần tử một"
final class NguoiNhanCham implements Subscriber<Integer> {
    private Subscription sub;
    public void onSubscribe(Subscription s) { sub = s; s.request(1); }
    public void onNext(Integer x) {
        Thread.sleep(10);                 // xử lý chậm (bỏ qua try/catch cho gọn)
        daNhan.incrementAndGet();
        sub.request(1);                   // xong mới xin tiếp
    }
    ...
}

try (var pub = new SubmissionPublisher<Integer>(ForkJoinPool.commonPool(), 8)) {
    pub.subscribe(nn);
    for (int i = 0; i < 100; i++) pub.submit(i);          // cách 1
    // for (...) pub.offer(i, (s, x) -> { biBo.incrementAndGet(); return false; });   // cách 2
}
```

```text
1) phát 100 phần tử bằng submit mất 931 ms (người phát phải chờ)
   người nhận được 100/100
2) phát 100 phần tử bằng offer mất 1 ms
   người nhận được 9/100, bị bỏ 91
bộ đệm mặc định: 256
```

Hai lần chạy cho cùng kết quả (929 ms / 931 ms). `submit` biến người phát nhanh thành người phát chậm bằng tốc độ người nhận — an toàn về dữ liệu, nhưng nếu người phát là thread xử lý request HTTP thì request đó cũng chậm theo. `offer` với handler trả `false` là chiến lược **bỏ** — hợp với dữ liệu mà giá trị mới thay thế giá trị cũ (giá chứng khoán, vị trí GPS), sai hoàn toàn với giao dịch.

## Demo RxJS: 100 sự kiện mỗi 1 ms, xử lý 10 ms

Chạy bằng Node với RxJS 7.8.2:

```js title="bp.mjs"
const xuLyCham = (x) => timer(10).pipe(map(() => x));
interval(1).pipe(take(100), concatMap(xuLyCham), toArray());   // đổi concatMap thành từng operator
```

```text
concatMap (xếp hàng): nhận 100/100 sau 1026 ms
mergeMap (song song không giới hạn): nhận 100/100 sau 128 ms
mergeMap(fn, 4): nhận 100/100 sau 262 ms
exhaustMap (bỏ khi bận): nhận 12/100 sau 125 ms
switchMap (huỷ cái cũ): nhận 1/100 sau 124 ms
```

(Chạy lại: 1029 / 122 / 260 / 11 / 124 ms — số phần tử nhận được của `exhaustMap` dao động theo bộ hẹn giờ.)

| Operator | Khi người nhận bận | Dùng cho |
|---|---|---|
| `concatMap` | Xếp hàng trong bộ nhớ, giữ thứ tự | Lưu từng thay đổi theo đúng thứ tự |
| `mergeMap` | Chạy song song tất cả | Việc độc lập, số lượng nhỏ — nguy hiểm nếu nguồn không giới hạn (100 request HTTP cùng lúc) |
| `mergeMap(fn, n)` | Song song tối đa n, còn lại xếp hàng | Gọi API có giới hạn đồng thời |
| `exhaustMap` | **Bỏ** sự kiện mới khi đang bận | Nút "Thanh toán" bấm nhiều lần, nút đăng nhập |
| `switchMap` | **Huỷ** việc cũ, chạy việc mới | Ô tìm kiếm gõ tới đâu tìm tới đó |

`concatMap` không có backpressure thật: nguồn vẫn phát với tốc độ của nó, hàng đợi nằm trong operator. Với nguồn vô hạn, hàng đợi lớn mãi.

## So sánh phương án

| | Observer thường | `Flow` / Reactive Streams | RxJS |
|---|---|---|---|
| Người nhận điều tiết tốc độ | Không | Có (`request(n)`) | Không (chọn bằng operator) |
| Chiến lược khi quá tải | Tự viết | Chặn / bỏ / bộ đệm, chọn khi phát | `concatMap`, `exhaustMap`, `throttleTime`, `bufferTime`... |
| Lỗi | Tuỳ cài đặt | `onError` kết thúc luồng | `error` kết thúc luồng, `catchError` để tiếp tục |
| Môi trường | Mọi nơi | JVM: Reactor, RxJava, R2DBC | Trình duyệt, Node, Angular |

## Tính năng mới theo phiên bản

- **Java 9**: `java.util.concurrent.Flow` và `SubmissionPublisher` (JEP 266); `java.util.Observable` bị deprecated.
- **Java 11**: `HttpClient` dùng `Flow.Publisher` cho body (`BodyPublishers`, `BodySubscribers`).
- **Java 21**: virtual thread làm code chặn rẻ trở lại — nhiều ứng dụng không cần reactive nữa, nhưng bài toán "người nhận chậm" vẫn còn, chỉ chuyển sang dạng giới hạn đồng thời (`Semaphore`).
- **RxJS 7**: `lastValueFrom`/`firstValueFrom` thay cho `toPromise()`; Angular 16+ có `toSignal`/`toObservable` nối signals với RxJS.

:::senior Góc nhìn senior
Mỗi hàng đợi trong hệ thống — bộ đệm của publisher, `concatMap`, queue của executor, topic Kafka — cần có **giới hạn** và **chính sách khi đầy**. Hàng đợi không giới hạn chỉ dời sự cố từ "chậm" sang "hết bộ nhớ" vào lúc tải cao nhất. Khi review, hỏi: "nếu người nhận chậm đi 10 lần thì cái gì đầy trước, và nó làm gì khi đầy?".
:::

:::quiz Người nhận dùng `request(1)` và xử lý 10 ms/phần tử, bộ đệm 8. Phát 100 phần tử bằng `submit`. Điều gì xảy ra?
- [ ] Mất 92 phần tử
- [x] Người nhận nhận đủ 100; người phát bị chặn, mất khoảng 1 giây để phát xong
- [ ] `submit` ném exception khi bộ đệm đầy
- [ ] Bộ đệm tự lớn lên vô hạn

Đã chạy: 931 ms, 100/100. `submit` chờ khi bộ đệm của subscriber đầy.
:::

:::exercise Chọn operator cho ba màn hình Angular
Chọn operator RxJS và giải thích: (1) ô tìm kiếm khách hàng gọi API theo từng chữ gõ; (2) nút "Duyệt khoản vay" người dùng hay bấm hai lần; (3) đồng bộ danh sách 500 hồ sơ lên server, server chỉ chịu 5 request đồng thời và thứ tự không quan trọng.
???
1. **`switchMap`** (kèm `debounceTime(300)` và `distinctUntilChanged()`): chỉ kết quả của từ khoá mới nhất có ý nghĩa; request cũ bị huỷ để kết quả cũ không đè lên kết quả mới. Đã đo: `switchMap` chỉ giữ 1/100 — đúng ý cho tìm kiếm.
2. **`exhaustMap`**: trong lúc request duyệt đang chạy, các lần bấm tiếp theo bị bỏ — tránh duyệt hai lần. Vẫn cần **idempotency** phía server, vì người dùng có thể mở hai tab. `switchMap` ở đây là sai: huỷ request phía trình duyệt không huỷ được việc server đã làm.
3. **`mergeMap(fn, 5)`**: song song tối đa 5, còn lại xếp hàng. Đã đo với 4 luồng: 100 việc 10 ms xong trong 262 ms. `mergeMap` không giới hạn sẽ bắn 500 request cùng lúc; `concatMap` thì đúng nhưng chậm gấp 5 lần.
:::
