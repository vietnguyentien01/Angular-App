---
title: Chiến lược test — test cái gì, ở tầng nào
summary: 'Từ "biết viết test" sang "thiết kế cách test cho cả dự án": tháp test, test hành vi thay vì chi tiết cài đặt, harness và Playwright.'
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [testing, strategy, playwright, harness]
related: [angular/consolidate/testing/test-http-va-async, angular/deep-dive/testing/characterization-test-khi-migrate]
---

## Tháp test cho một app Angular enterprise

| Tầng | Kiểm tra | Công cụ | Tỉ lệ |
|---|---|---|---|
| Unit | Hàm thuần, service, pipe, validator, custom operator | Vitest | Nhiều nhất |
| Component | Hành vi của một component với dependency giả | TestBed (+ CDK harness) | Vừa |
| E2E | Luồng nghiệp vụ quan trọng end-to-end | Playwright | Ít, chọn lọc |

## Test hành vi, không test chi tiết cài đặt

```ts bad
expect(component['items']().length).toBe(3); // phụ thuộc field private
expect(spyOn(component, 'recalculate')).toHaveBeenCalled();
```

```ts good
expect(screen.querySelectorAll('[data-testid="order-row"]')).toHaveLength(3);
expect(screen.textContent).toContain('Tổng: 1.200.000 ₫');
```

Test tốt **không vỡ** khi bạn refactor bên trong mà hành vi không đổi.

## Component Harness (CDK)

Harness là API test ổn định cho component UI — test không phụ thuộc cấu trúc DOM bên trong:

```ts
const loader = TestbedHarnessEnvironment.loader(fixture);
const select = await loader.getHarness(MatSelectHarness);
await select.open();
await select.clickOptions({ text: 'Đã duyệt' });
```

Khi xây design system nội bộ, viết harness cho component của mình để các team khác test dễ hơn.

## E2E với Playwright: chọn luồng nào?

Ưu tiên luồng **rủi ro cao + hay hỏng**: đăng nhập, nộp hồ sơ, thanh toán, import file. Không cố E2E mọi màn hình — chậm và dễ "flaky".

:::senior Góc nhìn Senior
Câu hỏi cần trả lời cho team không phải "coverage bao nhiêu %" mà là *"nếu luồng X hỏng, test nào sẽ báo?"*. Với mỗi bug production đã sửa, thêm một test tái hiện nó (regression test) — đây là cách coverage tăng ở đúng chỗ.
:::

:::quiz Đâu là dấu hiệu test đang kiểm tra chi tiết cài đặt?
- [ ] Test kiểm tra text hiển thị trên màn hình
- [x] Test vỡ khi đổi tên một method private dù giao diện và hành vi không đổi
- [ ] Test dùng `HttpTestingController`
- [ ] Test click vào nút

Test như vậy tạo chi phí bảo trì mà không bảo vệ hành vi thật.
:::

:::quiz Nên viết E2E Playwright cho luồng nào trước?
- [ ] Trang "Giới thiệu"
- [x] Nộp hồ sơ trực tuyến gồm nhiều bước, có upload file và gọi nhiều API
- [ ] Đổi giao diện sáng/tối
- [ ] Tooltip của một nút

Luồng nghiệp vụ cốt lõi, nhiều tích hợp là nơi E2E đáng giá nhất.
:::

:::exercise Lập kế hoạch test cho dynamic form engine
Bạn có engine render form từ JSON Schema, validate bằng JSONLogic, có auto-save nháp. Đề xuất test ở từng tầng.
???
- **Unit**: hàm chuyển JSON Schema → cấu hình field; từng rule JSONLogic (đúng/sai/biên); hàm tính toán (tổng tiền…); operator auto-save (marble test: debounce + concatMap).
- **Component**: mỗi loại field renderer (hiển thị, validate, disabled); engine với một schema nhỏ — nhập dữ liệu → hiện lỗi đúng chỗ → submit phát đúng payload.
- **E2E**: 2–3 form thật quan trọng nhất (nhiều bước, có upload), kiểm tra lưu nháp rồi mở lại vẫn còn dữ liệu.
- **Regression**: mỗi bug production về form → thêm test với schema tái hiện bug.
:::
