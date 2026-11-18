import { Service, computed, signal } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import { FIREBASE_CONFIG } from './firebase.config';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoUrl: string | null;
}

/**
 * Chạy với Firebase Emulator khi phát triển: chỉ khi ở localhost VÀ projectId bắt đầu bằng `demo-`
 * (quy ước của Firebase cho project chỉ dùng emulator), nên cấu hình thật không bao giờ đi vào nhánh này.
 */
export const USE_EMULATORS =
  typeof location !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(location.hostname) &&
  !!FIREBASE_CONFIG?.projectId?.startsWith('demo-');

const toAppUser = (u: User): AppUser => ({
  uid: u.uid,
  name: u.displayName ?? u.email ?? 'Người dùng',
  email: u.email ?? '',
  photoUrl: u.photoURL,
});

/** Thông báo lỗi đăng nhập dễ hiểu cho các mã lỗi Firebase thường gặp. */
function loginErrorMessage(code: string): string {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Bạn đã đóng cửa sổ đăng nhập.';
    case 'auth/unauthorized-domain':
      return 'Tên miền này chưa được thêm vào Authorized domains của Firebase.';
    case 'auth/network-request-failed':
      return 'Không kết nối được tới máy chủ đăng nhập. Kiểm tra mạng rồi thử lại.';
    case 'auth/operation-not-allowed':
      return 'Đăng nhập bằng Google chưa được bật trong Firebase Authentication.';
    default:
      return 'Đăng nhập không thành công. Thử lại sau.';
  }
}

/**
 * Đăng nhập bằng tài khoản Google qua Firebase Authentication.
 * Firebase SDK được nạp trễ (dynamic import) để không làm nặng gói tải ban đầu.
 */
@Service()
export class AuthService {
  /** false khi chưa có cấu hình Firebase: app chạy không cần đăng nhập. */
  readonly enabled = FIREBASE_CONFIG !== null;

  private readonly _user = signal<AppUser | null>(null);
  private readonly _ready = signal(!this.enabled);
  readonly user = this._user.asReadonly();
  /** true khi đã biết trạng thái đăng nhập (có user hoặc chắc chắn chưa đăng nhập). */
  readonly ready = this._ready.asReadonly();
  readonly signedIn = computed(() => this._user() !== null);

  private auth: Promise<Auth> | undefined;
  private appPromise: Promise<FirebaseApp> | undefined;

  constructor() {
    if (this.enabled) void this.init();
  }

  /** Dùng chung FirebaseApp cho Auth và Firestore. */
  app(): Promise<FirebaseApp> {
    this.appPromise ??= import('firebase/app').then(({ initializeApp, getApps, getApp }) =>
      getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG!),
    );
    return this.appPromise;
  }

  private getAuth(): Promise<Auth> {
    this.auth ??= Promise.all([this.app(), import('firebase/auth')]).then(([app, m]) => {
      const auth = m.getAuth(app);
      auth.languageCode = 'vi';
      if (USE_EMULATORS)
        m.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      return auth;
    });
    return this.auth;
  }

  private async init(): Promise<void> {
    try {
      const [auth, { onAuthStateChanged }] = await Promise.all([
        this.getAuth(),
        import('firebase/auth'),
      ]);
      onAuthStateChanged(auth, (u) => {
        this._user.set(u ? toAppUser(u) : null);
        this._ready.set(true);
      });
    } catch {
      // Không tải được SDK (mất mạng): vẫn hiện màn đăng nhập để người dùng thử lại.
      this._ready.set(true);
    }
  }

  async signInWithGoogle(): Promise<void> {
    const [auth, m] = await Promise.all([this.getAuth(), import('firebase/auth')]);
    if (USE_EMULATORS) {
      // Auth Emulator chấp nhận id_token Google giả: dùng để test luồng đăng nhập ở máy dev.
      const email = prompt('Email tài khoản Google giả (emulator):', 'test@example.com');
      if (!email) throw new Error('Bạn đã đóng cửa sổ đăng nhập.');
      const fake = JSON.stringify({ sub: email, email, email_verified: true, name: email });
      await m.signInWithCredential(auth, m.GoogleAuthProvider.credential(fake));
      return;
    }
    const provider = new m.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await m.signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/popup-blocked') {
        await m.signInWithRedirect(auth, provider);
        return;
      }
      throw new Error(loginErrorMessage(code));
    }
  }

  async signOut(): Promise<void> {
    const [auth, { signOut }] = await Promise.all([this.getAuth(), import('firebase/auth')]);
    await signOut(auth);
  }
}
