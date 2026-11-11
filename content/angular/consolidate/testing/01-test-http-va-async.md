---
title: Test HTTP, resource và code bất đồng bộ khi zoneless
summary: HttpTestingController, cái bẫy whenStable chờ request mãi không về, và fake timer cho debounce — rút ra từ chính test của app này.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [testing, http, async, zoneless]
related: [angular/review/testing/testbed-co-ban, angular/consolidate/testing/chien-luoc-test]
---

## Thiết lập

```ts
TestBed.configureTestingModule({
  providers: [provideHttpClient(), provideHttpClientTesting()],
});
const http = TestBed.inject(HttpTestingController);
```

## Bẫy thật: `whenStable()` treo test

Khi viết test cho Learning Hub, test đầu tiên bị **timeout 5 giây**:

```ts bad
const fixture = TestBed.createComponent(App); // App có httpResource tải manifest
await fixture.whenStable(); // ← treo ở đây
http.expectOne('data/manifest.json').flush(manifest);
```

Nguyên nhân: request của `httpResource` là một **pending task**. `whenStable()` chờ mọi pending task xong — nhưng request chỉ xong khi test gọi `flush()`, mà dòng `flush()` lại nằm sau `await`. Deadlock.

```ts good
const fixture = TestBed.createComponent(App);
TestBed.tick(); // chạy render/effect để request được gửi đi
http.expectOne('data/manifest.json').flush(manifest);
await fixture.whenStable(); // giờ mới chờ — request đã có kết quả
```

## Fake timer cho debounce

```ts
it('chỉ gọi API sau 300ms', async () => {
  vi.useFakeTimers();
  const fixture = TestBed.createComponent(SearchBox);
  fixture.componentInstance.query.set('ang');
  TestBed.tick();

  http.expectNone((r) => r.url.includes('/api/search'));
  await vi.advanceTimersByTimeAsync(300);
  http.expectOne((r) => r.url.includes('/api/search')).flush([]);
  vi.useRealTimers();
});
```

:::tip Luôn kiểm tra không còn request thừa
```ts
afterEach(() => TestBed.inject(HttpTestingController).verify());
```
`verify()` làm test fail nếu còn request chưa được `expectOne`/`flush` — bắt được bug gọi API thừa.
:::

:::quiz Vì sao `await fixture.whenStable()` trước `flush()` làm test treo?
- [ ] Vì Vitest không hỗ trợ async
- [x] `whenStable` chờ pending task (request HTTP), còn request chỉ hoàn tất khi `flush()` được gọi — mà `flush()` nằm sau `await`
- [ ] Vì `httpResource` không chạy trong test
- [ ] Vì thiếu `provideHttpClient()`

Thứ tự đúng: kích hoạt (tick) → flush → rồi mới `whenStable`.
:::

:::quiz `http.verify()` trong `afterEach` dùng để làm gì?
- [ ] Gửi request thật tới server
- [x] Đảm bảo không còn request nào chưa được xử lý — phát hiện code gọi API thừa hoặc ngoài dự kiến
- [ ] Xoá cache HttpClient
- [ ] Reset TestBed

Một request "dư" thường là dấu hiệu bug (subscribe 2 lần, thiếu `shareReplay`…).
:::

:::quiz Test một service gọi `retry({ count: 2 })` khi lỗi 500. Cần bao nhiêu lần `expectOne(...).flush(..., { status: 500 })` để thấy lỗi cuối cùng?
- [ ] 1
- [ ] 2
- [x] 3
- [ ] 0

1 lần gọi đầu + 2 lần retry = 3 request. Mỗi request phải được `expectOne` riêng.
:::

:::exercise Test cho `UserPanel`
`UserPanel` có `userId = input.required<string>()` và `user = httpResource<User>(() => '/api/users/' + this.userId())`, template hiển thị `user.value()?.name`. Viết test: đặt `userId = '7'`, trả về `{ name: 'Lan' }`, kiểm tra DOM có "Lan".
???
```ts
it('hiển thị tên user', async () => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);

  const fixture = TestBed.createComponent(UserPanel);
  fixture.componentRef.setInput('userId', '7');
  TestBed.tick(); // gửi request

  http.expectOne('/api/users/7').flush({ name: 'Lan' });
  await fixture.whenStable();

  expect(fixture.nativeElement.textContent).toContain('Lan');
  http.verify();
});
```
:::
