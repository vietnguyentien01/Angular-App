---
title: Characterization test khi migrate hệ thống legacy
summary: Đảm bảo hệ thống mới "cho kết quả giống hệt" hệ thống cũ bằng cách ghi lại hành vi hiện tại thành test — kỹ thuật then chốt khi rebuild trên Angular mới.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [testing, migration, legacy, case-study]
related: [angular/consolidate/testing/chien-luoc-test, angular/deep-dive/change-detection/angular-22-thay-doi-mac-dinh]
---

## Ý tưởng

Khi viết lại một hệ thống cũ (vd nghiệp vụ bảo hiểm, kế toán), yêu cầu thường là **"kết quả phải giống hệt hệ thống cũ"** — kể cả những chỗ "kỳ lạ" mà người dùng đã quen. Characterization test không hỏi *"đúng là gì?"* mà ghi lại *"hiện tại nó làm gì?"*.

## Quy trình

1. **Thu thập input thật** (đã ẩn danh): payload form, file import, tham số tính phí.
2. **Chạy qua hệ thống cũ**, lưu output (kết quả tính toán, payload gửi API, file xuất) thành file "golden".
3. **Viết test** chạy cùng input qua code mới và so sánh với golden.
4. Khi khác nhau: điều tra — bug của hệ thống mới, hay bug cũ mà nghiệp vụ muốn giữ? **Ghi quyết định lại**.

```ts title="premium-calculator.characterization.spec.ts"
import cases from './fixtures/premium-cases.json'; // [{ input, legacyOutput }]

describe('Tính phí bảo hiểm — khớp hệ thống cũ', () => {
  for (const c of cases) {
    it(`case ${c.id}`, () => {
      expect(calculatePremium(c.input)).toEqual(c.legacyOutput);
    });
  }
});
```

## Mẹo thực tế

- Tách logic nghiệp vụ khỏi component thành **hàm thuần** → test nhanh, không cần TestBed.
- So sánh số tiền cẩn thận: làm tròn, số thập phân (`0.1 + 0.2`) — hệ thống cũ làm tròn ở bước nào?
- Với action/button nghiệp vụ, so sánh **payload gửi lên API** thay vì so giao diện.
- Giữ bộ golden trong repo, review thay đổi golden như review code.

:::senior Góc nhìn Senior
Đây là câu chuyện rất mạnh cho phỏng vấn Senior: *"Khi migrate luồng X từ hệ thống cũ, tôi dựng bộ characterization test N case từ dữ liệu thật, phát hiện M khác biệt trước khi lên production"*. Nó cho thấy bạn quản lý **rủi ro**, không chỉ viết code.
:::

:::quiz Characterization test khác unit test thông thường ở điểm nào?
- [ ] Nó chạy chậm hơn
- [x] Kỳ vọng được lấy từ hành vi hiện tại của hệ thống cũ, không phải từ đặc tả "đúng"
- [ ] Nó chỉ dùng cho backend
- [ ] Nó không cần input

Mục tiêu là phát hiện **khác biệt**, rồi để con người quyết định khác biệt nào được chấp nhận.
:::

:::quiz Phát hiện hệ thống cũ làm tròn phí sai (thiếu 1 đồng). Nên làm gì?
- [ ] Âm thầm sửa đúng trong hệ thống mới
- [ ] Âm thầm giữ sai cho giống
- [x] Báo BA/nghiệp vụ, ghi quyết định (giữ hay sửa), cập nhật golden và tài liệu theo quyết định đó
- [ ] Xoá case đó khỏi bộ test

Sai lệch tiền bạc là quyết định nghiệp vụ, không phải quyết định của dev.
:::
