---
title: Kiến trúc dynamic form engine từ JSON Schema
summary: Case study low-code — schema cấu hình → model → field renderer cắm thêm được, rule hiển thị/validate bằng JSONLogic, auto-save nháp, và hiệu năng với form hàng trăm field.
level: advanced
version: 22
lastReviewed: 2026-11-11
tags: [forms, dynamic-form, json-schema, architecture, case-study]
related: [angular/consolidate/dependency-injection/injectiontoken-multi-factory, angular/consolidate/forms/validator-tu-viet, rxjs/consolidate/flattening/chon-dung-flattening]
---

## Các lớp của engine

```text
JSON Schema + UI schema (do BA cấu hình)
        │  parse / chuẩn hoá (hàm thuần, unit test)
        ▼
FieldConfig[]  { key, type, label, rules: { visible, required, … } }
        │
        ▼
Form model (signal) + form(model, schemaFromConfig)   ← validation & điều kiện
        │
        ▼
<app-dynamic-field> → tra FIELD_RENDERERS (multi provider) → component theo `type`
```

## 1. Renderer cắm thêm được

```ts
@Component({
  selector: 'app-dynamic-field',
  imports: [NgComponentOutlet],
  template: `<ng-container *ngComponentOutlet="renderer(); inputs: { config: config(), field: field() }" />`,
})
export class DynamicField {
  private readonly registry = new Map(inject(FIELD_RENDERERS).map((r) => [r.type, r.component]));
  readonly config = input.required<FieldConfig>();
  readonly field = input.required<FieldTree<unknown>>();
  protected readonly renderer = computed(() => this.registry.get(this.config().type) ?? UnknownField);
}
```

Thêm loại field mới (vd "bảng sửa được có import Excel") = viết component + `provideFieldRenderer(...)`, **không sửa engine**.

## 2. Rule từ cấu hình → schema của Signal Forms

```ts
function buildSchema(configs: FieldConfig[]) {
  return (p: SchemaPathTree<Record<string, unknown>>) => {
    for (const c of configs) {
      const path = p[c.key];
      if (c.rules.required) required(path, { when: (ctx) => evalRule(c.rules.required, ctx.valueOf(p)) });
      if (c.rules.visible) hidden(path, (ctx) => !evalRule(c.rules.visible, ctx.valueOf(p)));
    }
  };
}
// evalRule = jsonLogic.apply(rule, data) — rule do BA cấu hình
```

Vì mỗi rule đọc dữ liệu qua signal, khi field A đổi chỉ những rule **phụ thuộc A** được tính lại.

## 3. Auto-save nháp an toàn

```ts
toObservable(this.model)
  .pipe(
    debounceTime(1500),
    map((m) => ({ data: m, version: this.version() })),
    concatMap((draft) => this.api.saveDraft(draft)), // đúng thứ tự
    takeUntilDestroyed(),
  )
  .subscribe((res) => this.version.set(res.version));
```

Gửi kèm `version` để server từ chối bản cũ hơn (optimistic concurrency) khi người dùng mở cùng hồ sơ ở hai tab.

## 4. Hiệu năng với form lớn

- Chia form theo **section/step**, `@defer (on viewport)` cho section dưới màn hình.
- Renderer dùng signal input, OnPush mặc định → sửa 1 field không render lại 300 field khác.
- Tránh rule JSONLogic đọc **toàn bộ** model nếu chỉ cần vài field — rule càng hẹp, càng ít tính lại.

:::senior Góc nhìn Senior
Khi phỏng vấn system design "thiết kế form builder", hãy trình bày theo lớp như trên và nêu trade-off: tính linh hoạt cho BA vs. khả năng test/hiệu năng, versioning schema (form đã nộp theo schema cũ phải hiển thị được), và ranh giới validate client/server (server **luôn** validate lại).
:::

:::quiz Vì sao tra renderer qua multi provider thay vì `@switch (config.type)` trong engine?
- [ ] Vì `@switch` chậm
- [x] Thêm loại field mới không cần sửa engine; các team/micro frontend tự đăng ký renderer của mình
- [ ] Vì `@switch` không hỗ trợ string
- [ ] Để tránh change detection

Nguyên tắc open/closed — engine ổn định, phần mở rộng nằm ngoài.
:::

:::quiz Form đã nộp tháng trước theo schema v3, nay schema là v5. Mở lại hồ sơ cũ nên làm gì?
- [ ] Render bằng schema v5 mới nhất
- [x] Lưu kèm phiên bản schema khi nộp và render bằng đúng phiên bản đó (hoặc có bước migrate dữ liệu rõ ràng)
- [ ] Xoá hồ sơ cũ
- [ ] Ẩn các field không còn trong v5

Không versioning schema là nguồn bug "mở hồ sơ cũ bị lỗi / mất dữ liệu" kinh điển của hệ thống low-code.
:::

:::exercise Thiết kế FieldConfig
Đề xuất kiểu TypeScript cho `FieldConfig` hỗ trợ: text, number, date, select (có options tĩnh hoặc từ API), bảng (mảng các dòng, mỗi dòng có các cột là field con). Dùng discriminated union.
???
```ts
type Rule = Record<string, unknown>; // JSONLogic

interface BaseField {
  key: string;
  label: string;
  rules?: { required?: Rule | boolean; visible?: Rule; readonly?: Rule };
}

type FieldConfig =
  | (BaseField & { type: 'text'; maxLength?: number; pattern?: string })
  | (BaseField & { type: 'number'; min?: number; max?: number })
  | (BaseField & { type: 'date'; min?: string; max?: string })
  | (BaseField & { type: 'select'; options: { value: string; label: string }[] | { url: string } })
  | (BaseField & { type: 'table'; columns: FieldConfig[]; minRows?: number; maxRows?: number });
```
`type` là thuộc tính phân biệt — renderer và hàm build schema dùng `switch (c.type)` có exhaustive check. Bảng lồng `FieldConfig` đệ quy; với Signal Forms dùng `applyEach(p[c.key], rowSchema)` cho từng dòng.
:::
