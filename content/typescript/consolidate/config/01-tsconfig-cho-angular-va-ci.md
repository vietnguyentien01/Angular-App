---
title: tsconfig cho dự án Angular và kiểm tra kiểu trong CI
summary: Đọc tsconfig mà Angular CLI sinh ra, paths không cần baseUrl (TS 6), strictTemplates của Angular, và cách siết strict dần cho codebase cũ.
level: intermediate
version: 6
lastReviewed: 2026-11-11
tags: [typescript, tsconfig, angular, ci]
related: [typescript/review/config/tsconfig-va-typescript-6, angular/review/cli-project/cli-va-angular-json]
---

## Ba file tsconfig của Angular CLI

| File | Dùng cho |
|---|---|
| `tsconfig.json` | Cấu hình gốc dùng chung (`compilerOptions`, `angularCompilerOptions`) |
| `tsconfig.app.json` | Build app — `files`/`include` của code ứng dụng |
| `tsconfig.spec.json` | Unit test — thêm kiểu của test runner |

```json title="tsconfig.json do Angular CLI 22 sinh ra (chính project Learning Hub)"
{
  "compilerOptions": {
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  }
}
```

Để ý những gì **không có**:

- `"strict": true` — không cần ghi vì TypeScript 6 bật `strict` mặc định.
- `"strictTemplates": true` — không cần ghi vì Angular 22 bật mặc định (migration `ng update` thêm `strictTemplates: false` cho project cũ chưa khai báo, để giữ hành vi trước v22).

`strictTemplates` (thuộc `angularCompilerOptions`) kiểm tra kiểu **trong template**: binding, input, `$event`.

## Alias import không cần `baseUrl`

```json
"paths": {
  "@app/*": ["./src/app/*"],
  "@env/*": ["./src/environments/*"]
}
```

Kiểm chứng với tsc 6: `paths` với đường dẫn tương đối (`./…`) hoạt động mà không có `baseUrl` — vốn bị deprecated ở TS 6.

## Siết strict dần cho codebase cũ

1. Bật từng cờ một (`strictNullChecks` thường tốn công nhất), mỗi cờ một PR.
2. Dùng `// @ts-expect-error` có ghi chú cho chỗ chưa sửa kịp — dễ tìm lại, và tự báo khi đã hết lỗi.
3. Thêm bước `tsc --noEmit -p tsconfig.app.json` vào CI để không ai đưa lỗi mới vào.

:::quiz Bật `noPropertyAccessFromIndexSignature`, với `const env: Record<string, string>`, dòng nào lỗi?
```ts
env.API_URL;     // (1)
env['API_URL'];  // (2)
```

- [x] Chỉ (1)
- [ ] Chỉ (2)
- [ ] Cả hai
- [ ] Không dòng nào

Cờ này buộc dùng `obj['key']` cho key đến từ index signature — làm rõ rằng key có thể không tồn tại.
:::

:::quiz `strictTemplates` nằm ở đâu và kiểm tra gì?
- [ ] Trong `compilerOptions`, kiểm tra file `.ts`
- [x] Trong `angularCompilerOptions`, kiểm tra kiểu của binding trong template Angular
- [ ] Trong `angular.json`, kiểm tra CSS
- [ ] Không tồn tại

TypeScript không hiểu template; compiler Angular dịch template ra code kiểm tra kiểu riêng.
:::

:::exercise Lên kế hoạch bật `strictNullChecks`
Codebase 300 file chưa bật `strictNullChecks`, bật lên có ~1.200 lỗi. Đề xuất cách làm không chặn công việc của team.
???
- Đo trước: bật cờ ở nhánh riêng, đếm lỗi theo thư mục/feature.
- Cách 1 (phổ biến): bật cờ toàn project, thêm `// @ts-expect-error TODO(strict-null)` tự động cho mọi lỗi hiện có (có script/codemod), từ đó **code mới** bị kiểm tra ngay; mỗi sprint xoá dần các comment theo feature.
- Cách 2: tách tsconfig riêng cho các thư mục đã "sạch" và chạy kiểm tra strict cho chúng trong CI, mở rộng dần danh sách.
- Theo dõi số `@ts-expect-error TODO(strict-null)` còn lại như một chỉ số technical debt.
:::
