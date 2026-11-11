---
title: tsconfig, các cờ strict và thay đổi của TypeScript 6
summary: Những cờ quan trọng nhất trong tsconfig, mặc định mới của TypeScript 6.0 và các tuỳ chọn bị deprecated trước TypeScript 7.
type: card
level: core
version: 6
lastReviewed: 2026-11-11
tags: [typescript, tsconfig, strict, typescript-6]
related: [typescript/deep-dive/config/d-ts-va-module-augmentation]
changelog:
  - date: 2026-11-11
    note: Kiểm chứng bằng tsc 6.0.3 — strict mặc định, danh sách deprecation.
---

## Gia đình `strict`

| Cờ (bật khi `strict: true`) | Bắt lỗi gì |
|---|---|
| `strictNullChecks` | Dùng giá trị có thể `null`/`undefined` |
| `noImplicitAny` | Tham số/biến không có kiểu và không suy ra được |
| `strictFunctionTypes` | Gán hàm có tham số không tương thích |
| `strictPropertyInitialization` | Thuộc tính class chưa được khởi tạo |
| `useUnknownInCatchVariables` | Biến `catch (e)` có kiểu `unknown` thay vì `any` |

## Cờ nên bật thêm (không nằm trong `strict`)

| Cờ | Tác dụng |
|---|---|
| `noUncheckedIndexedAccess` | `arr[i]` và `obj[key]` (index signature) có kiểu `T \| undefined` |
| `exactOptionalPropertyTypes` | `x?: string` không chấp nhận gán `undefined` tường minh |
| `noImplicitOverride` | Bắt buộc ghi `override` khi ghi đè method |

## TypeScript 6.0 — điều cần biết khi nâng cấp

Kiểm chứng bằng `tsc` 6.0.3:

- `strict` **bật mặc định** — biên dịch file không có tsconfig cũng báo lỗi implicit any và null.
- Các tuỳ chọn sau **bị deprecated và sẽ ngừng hoạt động ở TypeScript 7.0**: `target: "ES5"`, `moduleResolution: "node10"`, `baseUrl`, `outFile`, `module: "AMD"`, `esModuleInterop: false`. Tạm tắt cảnh báo bằng `"ignoreDeprecations": "6.0"` — nhưng nên chuyển đổi sớm.
- `tsc --init` sinh cấu hình hiện đại: `module: "nodenext"`, `target: "esnext"`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`…

:::warning `baseUrl` bị deprecated
Nhiều dự án Angular cũ dùng `baseUrl` + `paths` để import kiểu `app/shared/...`. Từ TS 6 nên khai báo `paths` với đường dẫn tương đối tới tsconfig (`"@app/*": ["./src/app/*"]`) mà không cần `baseUrl`.
:::

:::quiz Bật `noUncheckedIndexedAccess`, kiểu của `const x = list[0]` (với `list: string[]`) là gì?
- [ ] `string`
- [x] `string | undefined`
- [ ] `unknown`
- [ ] `never`

Phản ánh đúng thực tế: mảng có thể rỗng.
:::

:::quiz Dự án nâng lên TypeScript 6 báo lỗi `TS5101: Option 'baseUrl' is deprecated…`. Cách xử lý lâu dài?
- [ ] Hạ về TypeScript 5
- [ ] Thêm `"ignoreDeprecations": "6.0"` và quên đi
- [x] Bỏ `baseUrl`, viết lại `paths` với đường dẫn tương đối; chỉ dùng `ignoreDeprecations` tạm thời trong lúc chuyển đổi
- [ ] Xoá toàn bộ `paths`

Tuỳ chọn deprecated ở 6.0 sẽ ngừng hoạt động ở 7.0 — `ignoreDeprecations` chỉ là cầu nối.
:::

:::quiz `strict: true` có bao gồm `noUncheckedIndexedAccess` không?
- [ ] Có
- [x] Không — phải bật riêng
- [ ] Chỉ từ TypeScript 6
- [ ] Chỉ khi `target` là ESNext

Kiểm chứng với tsc 6.0.3: mặc định truy cập `arr[5]` vẫn có kiểu phần tử, không có `| undefined`.
:::
