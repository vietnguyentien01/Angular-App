---
title: keyof, typeof, indexed access và satisfies
summary: Lấy kiểu từ giá trị có sẵn, truy cập kiểu của thuộc tính, phần tử mảng, và kiểm tra kiểu mà không làm mất thông tin.
type: card
level: core
version: 6
lastReviewed: 2026-11-11
tags: [typescript, keyof, typeof, satisfies]
related: [typescript/deep-dive/advanced/type-level-programming, typescript/review/generics/generics-va-utility-types]
---

## Bốn công cụ

```ts
const config = { api: '/api', retries: 3, features: ['export', 'audit'] as const };

type Config = typeof config;                 // kiểu của biến config
type Key = keyof Config;                     // 'api' | 'retries' | 'features'
type Retries = Config['retries'];            // number          — indexed access
type Feature = Config['features'][number];   // 'export' | 'audit' — phần tử của tuple/mảng
```

## `satisfies`

```ts
type Route = { path: string; title: string };

const routes = {
  home: { path: '/', title: 'Trang chủ' },
  cases: { path: '/cases', title: 'Hồ sơ' },
} satisfies Record<string, Route>;

routes.cases.path;     // ✓ TypeScript vẫn biết có key `cases`
// routes.reports;     // ✗ lỗi — key không tồn tại
```

So với `const routes: Record<string, Route> = …`: chú thích kiểu làm mất danh sách key cụ thể (mọi chuỗi đều là key hợp lệ), còn `satisfies` vừa kiểm tra vừa giữ kiểu chính xác.

:::quiz Với `const roles = ['admin', 'staff'] as const;`, `(typeof roles)[number]` là gì?
- [ ] `string`
- [x] `'admin' | 'staff'`
- [ ] `string[]`
- [ ] `number`

Không có `as const`, mảng sẽ bị nới thành `string[]` và kết quả là `string`.
:::

:::quiz `keyof { a: 1; b: 2 }` là gì?
- [ ] `1 | 2`
- [x] `'a' | 'b'`
- [ ] `string`
- [ ] `['a', 'b']`

`keyof` cho union các key; muốn union các value thì dùng `T[keyof T]`.
:::

:::quiz Với `const r: Record<string, Route> = {...}` (chú thích kiểu, không dùng satisfies), truy cập `r.khongTonTai` thì sao?
- [ ] Lỗi biên dịch
- [x] Không lỗi, kiểu là `Route` — dù lúc runtime là `undefined`
- [ ] Kiểu là `never`
- [ ] Kiểu là `unknown`

Đây là lý do nên dùng `satisfies`, hoặc bật `noUncheckedIndexedAccess` để kiểu thành `Route | undefined`.
:::
