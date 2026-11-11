---
title: Viết .d.ts, declare module và mở rộng kiểu có sẵn
summary: Khai báo kiểu cho thư viện JS không có type, mở rộng kiểu toàn cục (Window), mở rộng module của thư viện, và khi nào cần skipLibCheck.
level: advanced
version: 6
lastReviewed: 2026-11-11
tags: [typescript, d-ts, declaration-merging, augmentation]
related: [typescript/review/config/tsconfig-va-typescript-6, typescript/review/objects/interface-type-va-structural-typing]
---

## Thư viện JS không có kiểu

```ts title="src/types/legacy-signature.d.ts"
declare module 'legacy-signature' {
  export interface SignOptions {
    certificateId: string;
    reason?: string;
  }
  export function sign(pdf: Blob, options: SignOptions): Promise<Blob>;
}
```

Chỉ cần nhanh để không lỗi import: `declare module 'legacy-signature';` (mọi thứ thành `any` — dùng tạm).

## Mở rộng kiểu toàn cục

```ts title="src/types/global.d.ts"
export {}; // biến file thành module để `declare global` hợp lệ

declare global {
  interface Window {
    __APP_CONFIG__?: { apiBaseUrl: string }; // biến do server nhúng vào index.html
  }
}
```

Nhờ declaration merging của `interface`, khai báo trên **gộp** vào `Window` có sẵn của `lib.dom.d.ts`.

## Mở rộng module của thư viện

Ví dụ: thư viện event bus dùng chung khai báo `interface AppEvents {}` rỗng, mỗi feature tự **thêm** sự kiện của mình:

```ts title="libs/shared/events.ts"
export interface AppEvents {}
export function emit<K extends keyof AppEvents>(type: K, payload: AppEvents[K]) { /* … */ }
```

```ts title="features/cases/events.ts"
import '@app/shared/events';

declare module '@app/shared/events' {
  interface AppEvents {
    'case:approved': { id: string; by: string };
  }
}
// Ở bất kỳ đâu: emit('case:approved', { id: '1', by: 'lan' }) — có kiểm tra kiểu đầy đủ
```

Nguyên tắc: `declare module '…'` phải dùng **đúng** đường dẫn/tên module, và chỉ **interface** mới gộp được. Kiểm chứng với tsc 6: khai báo lại một `type` alias trong `declare module` báo `TS2300: Duplicate identifier`.

## `skipLibCheck`

`skipLibCheck: true` bỏ qua kiểm tra lỗi **bên trong** các file `.d.ts` (của thư viện và của bạn). Tăng tốc biên dịch và tránh lỗi do xung đột kiểu giữa các thư viện, nhưng có thể che lỗi trong `.d.ts` tự viết — nên có một lần CI chạy không bật cờ này để kiểm tra file khai báo của dự án.

:::quiz Vì sao file `global.d.ts` ở trên cần `export {}`?
- [ ] Để export kiểu Window
- [x] `declare global` chỉ hợp lệ trong một **module**; `export {}` biến file thành module
- [ ] Để tree-shaking
- [ ] Không cần thiết

File không có import/export là "script" — trong đó mọi khai báo vốn đã là toàn cục.
:::

:::quiz Thư viện khai báo `export type Options = { a: string }`. Bạn có thể dùng `declare module` để thêm thuộc tính `b` vào `Options` không?
- [ ] Có
- [x] Không — chỉ `interface` mới gộp được; `type` alias không mở rộng được
- [ ] Có nếu bật `skipLibCheck`
- [ ] Chỉ trong `.d.ts`

Đây là một lý do thư viện công khai thường dùng `interface` cho kiểu cấu hình: để người dùng mở rộng được.
:::

:::exercise Gõ kiểu cho biến cấu hình toàn cục
Server nhúng `<script>window.__FEATURES__ = { export: true, audit: false }</script>` vào trang. Viết khai báo kiểu và một hàm `isFeatureOn(name)` chỉ nhận đúng tên feature.
???
```ts title="src/types/global.d.ts"
export {};
declare global {
  interface AppFeatures {
    export: boolean;
    audit: boolean;
  }
  interface Window {
    __FEATURES__?: Partial<AppFeatures>;
  }
}
```
```ts
export function isFeatureOn(name: keyof AppFeatures): boolean {
  return window.__FEATURES__?.[name] ?? false;
}
isFeatureOn('export'); // ✓
isFeatureOn('reports'); // ✗ lỗi biên dịch
```
`Partial` + `?? false` vì server có thể không gửi đủ cờ.
:::
