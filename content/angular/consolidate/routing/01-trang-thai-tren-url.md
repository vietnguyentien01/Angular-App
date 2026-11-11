---
title: Lưu trạng thái màn hình lên URL — bộ lọc, phân trang, tab
summary: Đồng bộ bộ lọc với query params bằng signal input, queryParamsHandling, replaceUrl — để F5, chia sẻ link và nút Back hoạt động đúng.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [routing, query-params, state]
related: [angular/review/routing/route-co-ban, angular/consolidate/routing/loi-thuong-gap-routing]
---

## Vì sao đưa state lên URL?

- **F5** không mất bộ lọc / trang đang xem.
- **Chia sẻ link** cho đồng nghiệp đúng màn hình đang thấy.
- Nút **Back** của trình duyệt quay về bộ lọc trước.

## Đọc: query param → input → resource

```ts title="case-list.ts"
export class CaseList {
  private readonly router = inject(Router);

  // withComponentInputBinding(): ?q=...&status=...&page=...
  // Khi param vắng, router gán `undefined` (không dùng giá trị mặc định của input!) → tự xử lý trong transform
  readonly q = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly status = input<CaseStatus | undefined>();
  readonly page = input(1, { transform: (v: string | undefined) => numberAttribute(v, 1) });

  readonly cases = httpResource<Page<Case>>(() => ({
    url: '/api/cases',
    params: { q: this.q(), page: this.page(), ...(this.status() ? { status: this.status()! } : {}) },
  }));

  // Ghi: đổi URL, input sẽ tự cập nhật theo
  setFilter(patch: Partial<{ q: string; status: string | null; page: number }>) {
    void this.router.navigate([], {
      queryParams: { page: 1, ...patch }, // đổi bộ lọc → về trang 1
      queryParamsHandling: 'merge', // giữ các param khác
      replaceUrl: 'q' in patch, // gõ từng ký tự không tạo hàng chục mục history
    });
  }
}
```

Một nguồn sự thật duy nhất: **URL**. Component không giữ bản sao bộ lọc trong signal riêng → không bao giờ lệch.

| Option của `navigate` | Ý nghĩa |
|---|---|
| `queryParamsHandling: 'merge'` | Gộp với query params hiện có |
| `queryParamsHandling: 'preserve'` | Giữ nguyên query params hiện có, bỏ qua `queryParams` truyền vào |
| `queryParams: { status: null }` | `null` → xoá param khỏi URL |
| `replaceUrl: true` | Thay mục history hiện tại thay vì thêm mới |

:::quiz Người dùng đang ở `?q=abc&page=3`, gọi `navigate([], { queryParams: { status: 'open' }, queryParamsHandling: 'merge' })`. URL mới?
- [ ] `?status=open`
- [x] `?q=abc&page=3&status=open`
- [ ] `?q=abc&page=3`
- [ ] Không đổi

`merge` giữ param cũ và thêm/ghi đè param mới. (Ví dụ `setFilter` ở trên còn chủ động đặt `page: 1`.)
:::

:::quiz Vì sao dùng `replaceUrl` khi người dùng gõ ô tìm kiếm?
- [ ] Để URL ngắn hơn
- [x] Để mỗi ký tự không tạo một mục history — bấm Back không phải lùi qua "a", "an", "ang"…
- [ ] Để tránh gọi API
- [ ] Bắt buộc với query params

Kết hợp thêm debounce trước khi `navigate` để không cập nhật URL quá dày.
:::

:::quiz Với `page = input(1, { transform: numberAttribute })` và `withComponentInputBinding()`, mở URL KHÔNG có `?page=`. `page()` bằng?
- [ ] `1` — giá trị mặc định của input
- [ ] `'1'`
- [x] `NaN`
- [ ] `undefined`

Đã kiểm chứng trên Angular 22: khi param vắng, router **gán `undefined`** cho input (để xoá giá trị cũ khi điều hướng), nên giá trị mặc định `1` bị ghi đè; `numberAttribute(undefined)` trả về fallback mặc định của nó là `NaN`. Sửa: `transform: (v) => numberAttribute(v, 1)`. Tương tự, `input('')` cho query param vắng sẽ thành `undefined`.
:::

:::exercise Tab đồng bộ với URL
Màn hình chi tiết có 3 tab: `info`, `history`, `files`. Viết code để tab đang chọn lấy từ `?tab=`, mặc định `info`, và bấm tab thì cập nhật URL mà không tạo mục history mới.
???
```ts
type Tab = 'info' | 'history' | 'files';
const TABS: Tab[] = ['info', 'history', 'files'];

export class CaseDetail {
  private readonly router = inject(Router);
  readonly tab = input<Tab, string | undefined>('info', {
    transform: (v) => (TABS.includes(v as Tab) ? (v as Tab) : 'info'),
  });

  selectTab(tab: Tab) {
    void this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
```
`transform` đảm bảo giá trị lạ trên URL (`?tab=xyz`) không làm vỡ giao diện.
:::
