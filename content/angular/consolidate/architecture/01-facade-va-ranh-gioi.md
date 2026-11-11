---
title: Facade với signals và giữ ranh giới module bằng lint
summary: Ẩn chi tiết state/API sau một facade, component chỉ đọc signal và gọi method; dùng ESLint để ranh giới không bị phá theo thời gian.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [architecture, facade, signals, eslint]
related: [angular/review/architecture/cau-truc-feature, angular/deep-dive/architecture/nx-monorepo]
---

## Facade

```ts title="features/cases/data-access/case-list.facade.ts"
@Injectable() // provide ở route của feature
export class CaseListFacade {
  private readonly api = inject(CaseApi);

  // state riêng tư
  private readonly filter = signal<CaseFilter>({ q: '', status: 'all', page: 1 });

  // chỉ lộ ra dạng đọc
  readonly query = this.filter.asReadonly();
  readonly result = rxResource({
    params: () => this.filter(),
    stream: ({ params }) => this.api.search(params),
  });
  readonly cases = computed(() => this.result.value()?.items ?? []);
  readonly total = computed(() => this.result.value()?.total ?? 0);

  // hành động có tên nghiệp vụ
  search(q: string) {
    this.filter.update((f) => ({ ...f, q, page: 1 }));
  }
  goToPage(page: number) {
    this.filter.update((f) => ({ ...f, page }));
  }
}
```

```ts title="features/cases/pages/case-list-page.ts"
export class CaseListPage {
  protected readonly facade = inject(CaseListFacade);
  // template: facade.cases(), facade.result.isLoading(), (search)="facade.search($event)"
}
```

Lợi ích: đổi cách lấy dữ liệu (RxJS → `httpResource`, thêm cache, chuyển sang NgRx SignalStore) **không ảnh hưởng** component.

## Giữ ranh giới bằng lint

```js title="eslint.config.js (với Nx)"
'@nx/enforce-module-boundaries': ['error', {
  depConstraints: [
    { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:ui', 'type:data-access', 'type:util'] },
    { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:ui', 'type:util'] },
    { sourceTag: 'scope:cases', onlyDependOnLibsWithTags: ['scope:cases', 'scope:shared'] },
  ],
}]
```

Không dùng Nx: rule `no-restricted-imports` với pattern như `@app/features/*/!(index)` chặn import xuyên vào nội bộ feature.

:::quiz Vì sao facade chỉ lộ `query = filter.asReadonly()` chứ không lộ `filter`?
- [ ] Để nhanh hơn
- [x] Component không thể `set` state trực tiếp — mọi thay đổi đi qua method có tên nghiệp vụ, dễ kiểm soát và log
- [ ] Vì signal không được public
- [ ] Bắt buộc với `rxResource`

Một chỗ duy nhất được phép thay đổi state → dễ debug.
:::

:::quiz `search(q)` reset `page` về 1. Nếu để component tự `set` page thì rủi ro gì?
- [ ] Không rủi ro
- [x] Mỗi màn hình có thể quên reset → tìm kiếm mới nhưng vẫn ở trang 7, hiện "không có kết quả"
- [ ] Lỗi biên dịch
- [ ] Memory leak

Quy tắc nghiệp vụ đặt ở facade thì mọi nơi dùng đều đúng.
:::

:::exercise Thêm "xoá bộ lọc" và trạng thái rỗng
Thêm vào facade: method `reset()` đưa filter về mặc định, và `computed` `isEmpty` = đã tải xong, không lỗi, và không có kết quả.
???
```ts
private readonly initial: CaseFilter = { q: '', status: 'all', page: 1 };
private readonly filter = signal<CaseFilter>(this.initial);

reset() {
  this.filter.set(this.initial);
}

readonly isEmpty = computed(
  () => this.result.status() === 'resolved' && this.cases().length === 0,
);
```
`status() === 'resolved'` loại trừ trạng thái đang tải và lỗi, tránh hiện "không có dữ liệu" trong lúc loading.
:::
