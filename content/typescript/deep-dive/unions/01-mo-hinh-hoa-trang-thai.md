---
title: Mô hình hoá trạng thái bằng discriminated union
summary: Làm cho trạng thái sai không thể biểu diễn — state machine của hồ sơ, Result type thay cho throw, và kiểm tra chuyển trạng thái hợp lệ ở tầng kiểu.
level: advanced
version: 6
lastReviewed: 2026-11-11
tags: [typescript, discriminated-union, state-machine, result]
related: [typescript/review/unions/narrowing, typescript/deep-dive/objects/branded-types]
---

## Boolean soup → union

```ts bad
interface RequestState<T> {
  loading: boolean;
  data?: T;
  error?: string;
}
// loading: true + data + error cùng lúc? TypeScript cho phép.
```

```ts good
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
```

Mỗi trạng thái chỉ mang đúng dữ liệu của nó — không thể có `data` khi đang `error`.

## State machine của hồ sơ

```ts
type CaseState =
  | { status: 'draft' }
  | { status: 'submitted'; submittedAt: string }
  | { status: 'approved'; approvedBy: string }
  | { status: 'rejected'; reason: string };

type Transitions = {
  draft: 'submitted';
  submitted: 'approved' | 'rejected';
  approved: never;
  rejected: 'draft';
};

function canMove<F extends CaseState['status']>(from: F, to: Transitions[F]) { /* … */ }

canMove('draft', 'submitted');   // ✓
canMove('draft', 'approved');    // ✗ lỗi: 'approved' không phải bước hợp lệ từ 'draft'
canMove('approved', 'draft');    // ✗ lỗi: Transitions['approved'] là never
```

## Result type

```ts
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

function parseAmount(raw: string): Result<number> {
  const n = Number(raw.replaceAll('.', ''));
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: 'Số tiền không hợp lệ' };
}

const r = parseAmount(input);
if (r.ok) save(r.value); else showError(r.error); // bắt buộc xử lý cả hai nhánh
```

So với `throw`: lỗi nằm **trong kiểu trả về**, người gọi không thể quên.

:::quiz Với `RequestState<T>` dạng union, đoạn nào lỗi?
```ts
function view(s: RequestState<string>) {
  if (s.status === 'loading') return s.data; // (1)
  if (s.status === 'success') return s.data; // (2)
}
```

- [x] Chỉ (1)
- [ ] Chỉ (2)
- [ ] Cả hai
- [ ] Không dòng nào

Trạng thái `loading` không có `data` — chính là điều ta muốn.
:::

:::quiz `canMove('submitted', 'rejected')` có hợp lệ không?
- [x] Có — `Transitions['submitted']` là `'approved' | 'rejected'`
- [ ] Không
- [ ] Chỉ khi F được truyền tường minh
- [ ] Lỗi vì `never`

`F` được suy ra là `'submitted'`, nên tham số `to` có kiểu `Transitions['submitted']`.
:::

:::exercise Thêm trạng thái "bổ sung hồ sơ"
Nghiệp vụ mới: từ `submitted` có thể chuyển sang `need_more_info` (kèm `request: string`), từ đó quay lại `submitted`. Cập nhật kiểu.
???
```ts
type CaseState =
  | { status: 'draft' }
  | { status: 'submitted'; submittedAt: string }
  | { status: 'need_more_info'; request: string }
  | { status: 'approved'; approvedBy: string }
  | { status: 'rejected'; reason: string };

type Transitions = {
  draft: 'submitted';
  submitted: 'approved' | 'rejected' | 'need_more_info';
  need_more_info: 'submitted';
  approved: never;
  rejected: 'draft';
};
```
Nếu khai báo `Transitions` là `{ [S in CaseState['status']]: CaseState['status'] }`-tương thích (vd dùng `satisfies Record<CaseState['status'], …>` cho object giá trị thật), quên thêm key cho trạng thái mới sẽ báo lỗi ngay — mọi `switch` có exhaustive check cũng sẽ báo chỗ cần xử lý.
:::
