/**
 * Tên các demo tương tác. File này không import Angular để script build-content
 * có thể kiểm tra Markdown chỉ dùng demo đã đăng ký.
 */
export const DEMO_NAMES = ['signals-counter', 'rxjs-flattening', 'onpush-tree'] as const;
export type DemoName = (typeof DEMO_NAMES)[number];
