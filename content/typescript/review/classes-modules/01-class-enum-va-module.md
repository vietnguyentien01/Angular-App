---
title: Class, enum và module
summary: private vs #private, parameter property, abstract/implements; enum hay union literal; import type và verbatimModuleSyntax.
type: card
level: core
version: 6
lastReviewed: 2026-11-11
tags: [typescript, class, enum, module]
related: [typescript/consolidate/classes-modules/enum-vs-union]
---

## Class

```ts
abstract class Repository<T> {
  constructor(protected readonly baseUrl: string) {} // parameter property: khai báo + gán trong một dòng
  abstract get(id: string): Promise<T>;
}

class CaseRepo extends Repository<Case> implements Disposable {
  #cache = new Map<string, Case>(); // private thật của JavaScript (runtime)
  private retries = 3;              // private của TypeScript (chỉ lúc biên dịch)
  async get(id: string) { … }
  [Symbol.dispose]() { this.#cache.clear(); }
}
```

| | `private x` | `#x` |
|---|---|---|
| Kiểm tra lúc | Biên dịch | Runtime |
| Truy cập bằng `obj['x']` / ép kiểu | Được (lách được) | Không thể |

## Enum hay union literal?

```ts
enum Status { Draft = 'draft', Approved = 'approved' } // sinh ra object JS lúc runtime
type StatusU = 'draft' | 'approved';                     // chỉ tồn tại lúc biên dịch

const STATUS = { Draft: 'draft', Approved: 'approved' } as const; // vừa có giá trị runtime, vừa có type
type StatusC = (typeof STATUS)[keyof typeof STATUS];           // 'draft' | 'approved'
```

Nhiều team chọn union literal hoặc object `as const` thay cho enum: không sinh code lạ, tương thích tốt với `isolatedModules`/esbuild, và dữ liệu JSON từ API là chuỗi thường.

## Module

```ts
import type { Case } from './case.model'; // chỉ import kiểu — bị xoá hoàn toàn khi biên dịch
import { CaseApi, type CaseFilter } from './case.api';
```

Với `verbatimModuleSyntax` (được `tsc --init` của TS 6 bật sẵn), import chỉ dùng làm kiểu **bắt buộc** phải ghi `type` — tránh import thừa lúc runtime.

:::quiz `enum Dir { Up, Down }` — `Dir.Down` có giá trị gì?
- [ ] `'Down'`
- [x] `1`
- [ ] `0`
- [ ] `undefined`

Enum số bắt đầu từ 0 và tự tăng. Enum số còn có "reverse mapping": `Dir[1] === 'Down'`.
:::

:::quiz Khác biệt chính giữa `private x` và `#x`?
- [ ] Không khác
- [x] `#x` là private thật lúc runtime (không truy cập được từ ngoài bằng bất kỳ cách nào); `private` chỉ được kiểm tra lúc biên dịch
- [ ] `private` nhanh hơn
- [ ] `#x` chỉ dùng với static

Sau khi biên dịch, `private x` là thuộc tính bình thường trên object.
:::

:::quiz `import type { Case } from './case'` có tạo import trong JavaScript đầu ra không?
- [ ] Có
- [x] Không — bị xoá hoàn toàn vì chỉ dùng cho kiểu
- [ ] Chỉ khi dùng `Case` làm giá trị
- [ ] Tuỳ trình duyệt

Giúp tránh import vòng và import tốn chi phí lúc runtime khi chỉ cần kiểu.
:::
