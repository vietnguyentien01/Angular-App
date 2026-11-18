# Bật đăng nhập Google và lưu tiến độ theo tài khoản (Firebase)

App chạy trên GitHub Pages (không có server), nên đăng nhập và lưu tiến độ dùng **Firebase Authentication** (Google) và **Cloud Firestore**. Gói miễn phí (Spark) dư cho dùng cá nhân, không cần thẻ.

Khi `FIREBASE_CONFIG` trong `src/app/core/auth/firebase.config.ts` còn là `null`, app chạy như trước: không cần đăng nhập, tiến độ chỉ lưu trên trình duyệt. Khi điền cấu hình, **bắt buộc đăng nhập** mới vào được app.

## 1. Tạo project (khoảng 5 phút)

1. Vào https://console.firebase.google.com → **Create a project** (vd `learning-hub`). Có thể tắt Google Analytics.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**, chọn email hỗ trợ, **Save**.
3. **Authentication → Settings → Authorized domains → Add domain**: `vietnguyentien01.github.io` (localhost đã có sẵn).
4. **Build → Firestore Database → Create database** → chọn location gần (vd `asia-southeast1`) → **Start in production mode**.
5. **Firestore → Rules**: dán nội dung file [`firestore.rules`](../firestore.rules) ở gốc repo → **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

   Quy tắc này đảm bảo mỗi người chỉ đọc/ghi được document `users/{uid}` của chính mình.
6. **Project settings (⚙) → General → Your apps → Web (`</>`)** → đặt tên app → **Register app** (không cần Hosting). Copy đối tượng `firebaseConfig`.

## 2. Đưa cấu hình vào app

Sửa `src/app/core/auth/firebase.config.ts`:

```ts
export const FIREBASE_CONFIG: FirebaseOptions | null = {
  apiKey: '...',
  authDomain: 'learning-hub-xxxx.firebaseapp.com',
  projectId: 'learning-hub-xxxx',
  storageBucket: 'learning-hub-xxxx.firebasestorage.app',
  messagingSenderId: '...',
  appId: '...',
};
```

Các giá trị này **công khai** theo thiết kế của Firebase (trình duyệt nào mở web cũng thấy); dữ liệu được bảo vệ bằng Security Rules ở bước 1.5. Có thể giới hạn thêm API key theo tên miền trong Google Cloud Console → APIs & Services → Credentials.

Commit và push lên `main`: GitHub Pages tự build và deploy.

## 3. Cách dữ liệu được lưu

- Mỗi tài khoản một document `users/{uid}` gồm trường `data` (JSON tiến độ bài học, kết quả trắc nghiệm, ô đã làm của lộ trình, bản tin đã đọc) và `updatedAt`.
- IndexedDB trên máy vẫn là bộ nhớ đệm: app mở nhanh và vẫn học được khi mất mạng; khi có mạng lại thì tự lưu lên.
- Nhiều thiết bị cùng đăng nhập: thay đổi trên máy này hiện trên máy kia sau vài giây (không cần tải lại). Hai máy sửa cùng một mục: lần sửa sau cùng thắng.
- Lần đầu đăng nhập trên một máy đã có tiến độ (học trước khi bật đăng nhập): tiến độ đó được gộp vào tài khoản.
- Đăng xuất: tiến độ được lưu lên tài khoản rồi xoá khỏi máy; đăng nhập tài khoản khác không thấy dữ liệu của tài khoản trước.

## 4. Thử ở máy dev bằng Firebase Emulator

Đặt `projectId` bắt đầu bằng `demo-` (vd `demo-learning-hub`, các trường khác điền tuỳ ý) rồi chạy app ở `localhost`: app tự nối Auth Emulator (`127.0.0.1:9099`) và Firestore Emulator (`127.0.0.1:8080`), và nút đăng nhập hỏi một email giả thay vì mở cửa sổ Google.

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-learning-hub
```
