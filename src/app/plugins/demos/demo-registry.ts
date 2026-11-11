import type { Type } from '@angular/core';
import type { DemoName } from './demo-names';

/**
 * Đăng ký demo tương tác. Thêm demo mới:
 *   1. Tạo component trong `plugins/demos/<ten-demo>/`
 *   2. Thêm tên vào `demo-names.ts`
 *   3. Thêm loader ở đây
 *   4. Dùng trong Markdown: `:::demo ten-demo`
 * Mỗi demo được lazy-load thành chunk riêng.
 */
export const DEMO_REGISTRY: Record<DemoName, () => Promise<Type<unknown>>> = {
  'signals-counter': () =>
    import('./signals-counter/signals-counter').then((m) => m.SignalsCounterDemo),
};
