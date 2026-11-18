import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-login-page',
  imports: [Icon],
  host: { class: 'grid min-h-dvh place-items-center bg-slate-50 px-4 dark:bg-slate-950' },
  template: `
    <main class="card w-full max-w-sm p-8 text-center" aria-labelledby="login-heading">
      <span
        class="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-rose-500 text-white"
      >
        <app-icon name="book" [size]="26" />
      </span>
      <h1 id="login-heading" class="mt-5 text-2xl font-bold tracking-tight">Learning Hub</h1>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Đăng nhập để học tiếp đúng chỗ bạn dừng, trên mọi thiết bị. Tiến độ, kết quả trắc nghiệm và
        lộ trình được lưu theo tài khoản của bạn.
      </p>

      <button
        type="button"
        class="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        [disabled]="busy()"
        (click)="signIn()"
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" class="size-5">
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
          />
        </svg>
        {{ busy() ? 'Đang mở cửa sổ đăng nhập…' : 'Đăng nhập bằng Google' }}
      </button>

      @if (error(); as e) {
        <p class="mt-4 text-sm text-red-600" role="alert">{{ e }}</p>
      }

      <p class="mt-6 text-xs text-slate-500">
        App chỉ đọc tên, email và ảnh đại diện của tài khoản Google để hiển thị. Dữ liệu học tập của
        bạn chỉ bạn đọc được.
      </p>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | undefined>(undefined);

  protected async signIn(): Promise<void> {
    this.busy.set(true);
    this.error.set(undefined);
    try {
      await this.auth.signInWithGoogle();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
