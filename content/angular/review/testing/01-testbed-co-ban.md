---
title: TestBed cơ bản với Vitest
summary: Tạo component trong test, truyền signal input, mock service bằng provider và đọc DOM — nhắc nhanh các API hay dùng.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [testing, testbed, vitest]
related: [angular/consolidate/testing/test-http-va-async]
---

## TL;DR

Từ Angular 21, project mới dùng **Vitest** làm test runner mặc định (`ng test`). API `TestBed` vẫn như cũ.

```ts title="rating.spec.ts"
describe('Rating', () => {
  it('hiển thị đúng số sao và phát giá trị khi bấm', async () => {
    const fixture = TestBed.createComponent(Rating);
    fixture.componentRef.setInput('max', 3); // set signal input từ bên ngoài
    await fixture.whenStable();

    const stars = fixture.nativeElement.querySelectorAll('button');
    expect(stars).toHaveLength(3);

    stars[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe(2);
  });
});
```

## Mock dependency

```ts
TestBed.configureTestingModule({
  providers: [{ provide: UserApi, useValue: { get: vi.fn().mockReturnValue(of(fakeUser)) } }],
});
```

| Cần | API |
|---|---|
| Đặt input | `fixture.componentRef.setInput('name', value)` |
| Chờ render/tác vụ async | `await fixture.whenStable()` |
| Chạy effect / CD đồng bộ | `TestBed.tick()` |
| Lấy service | `TestBed.inject(Service)` |
| Ghi đè import của component | `TestBed.overrideComponent(...)` |

:::quiz Vì sao không gán trực tiếp `fixture.componentInstance.max = 3` cho signal input?
- [ ] Vì chậm hơn
- [x] `max` là `InputSignal` chỉ đọc; phải dùng `componentRef.setInput()` để đi đúng đường của Angular (và đánh dấu component dirty)
- [ ] Vì TestBed cấm truy cập componentInstance
- [ ] Không có lý do, cả hai như nhau

`setInput` cũng hoạt động với `@Input()` truyền thống — nên dùng nó cho mọi loại input.
:::

:::quiz Trong app zoneless, sau khi click nút trong test, tại sao cần `await fixture.whenStable()` trước khi kiểm tra DOM?
- [ ] Không cần, DOM cập nhật đồng bộ
- [x] Change detection được lên lịch bất đồng bộ; `whenStable` chờ lượt render đó (và các tác vụ đang chờ) hoàn tất
- [ ] Để chờ HTTP thật
- [ ] Vì Vitest chạy song song

Không có Zone.js, test cũng "zoneless": phải chờ Angular render xong.
:::
