import { Component, inject } from '@angular/core';
import { AuthService } from './core/auth/auth.service';
import { CloudSyncService } from './core/sync/cloud-sync.service';
import { ThemeService } from './core/theme/theme.service';
import { LoginPage } from './features/login/login-page';
import { Shell } from './layout/shell';

@Component({
  selector: 'app-root',
  imports: [Shell, LoginPage],
  template: `
    @if (!auth.ready() || (auth.signedIn() && !cloud.loaded())) {
      <div class="grid min-h-dvh place-items-center text-sm text-slate-500" role="status">
        {{ auth.signedIn() ? 'Đang tải tiến độ của bạn…' : 'Đang tải…' }}
      </div>
    } @else if (auth.enabled && !auth.signedIn()) {
      <app-login-page />
    } @else {
      <app-shell />
    }
  `,
})
export class App {
  // Khởi tạo sớm để áp dụng theme ngay khi app chạy.
  private readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly cloud = inject(CloudSyncService);
}
