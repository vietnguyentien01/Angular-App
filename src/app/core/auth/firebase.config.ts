import type { FirebaseOptions } from 'firebase/app';

/**
 * Cấu hình web app của project Firebase (Project settings → General → Your apps → SDK setup).
 *
 * Các giá trị này là thông tin CÔNG KHAI (chúng nằm trong mọi trang web dùng Firebase);
 * bảo vệ dữ liệu là việc của Firestore Security Rules (xem docs/FIREBASE_SETUP.md).
 *
 * Để `null` thì app chạy ở chế độ không đăng nhập: tiến độ chỉ lưu trên trình duyệt.
 */
export const FIREBASE_CONFIG: FirebaseOptions | null = null;
