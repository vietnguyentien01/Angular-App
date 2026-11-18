import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { CloudSyncService } from '../core/sync/cloud-sync.service';
import { ThemeService } from '../core/theme/theme.service';
import { Icon } from '../shared/icon/icon';
import { SidebarNav } from './sidebar-nav';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, Icon, SidebarNav],
  host: { class: 'block min-h-dvh', '(document:keydown.escape)': 'menuOpen.set(false)' },
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      (click)="skipToMain($event)"
    >
      Bỏ qua tới nội dung
    </a>

    <header
      class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85"
    >
      <button
        type="button"
        class="icon-btn lg:hidden"
        (click)="menuOpen.set(!menuOpen())"
        [attr.aria-expanded]="menuOpen()"
        aria-controls="sidebar"
        aria-label="Mở menu"
      >
        <app-icon [name]="menuOpen() ? 'x' : 'menu'" />
      </button>
      <a routerLink="/" class="flex items-center gap-2 font-bold tracking-tight">
        <span
          class="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-rose-500 text-white"
        >
          <app-icon name="book" [size]="16" />
        </span>
        Learning Hub
      </a>
      <span class="flex-1"></span>
      <button
        type="button"
        class="icon-btn"
        (click)="theme.cycle()"
        [attr.aria-label]="'Giao diện: ' + themeLabel()"
        [title]="'Giao diện: ' + themeLabel()"
      >
        <app-icon [name]="themeIcon()" />
      </button>
      @if (auth.user(); as u) {
        <span class="hidden text-xs text-slate-500 sm:inline" role="status">{{
          cloudLabel()
        }}</span>
        @if (u.photoUrl) {
          <img
            [src]="u.photoUrl"
            alt=""
            width="28"
            height="28"
            referrerpolicy="no-referrer"
            class="size-7 rounded-full"
          />
        }
        <span class="hidden max-w-40 truncate text-sm font-medium md:inline" [title]="u.email">{{
          u.name
        }}</span>
        <button
          type="button"
          class="icon-btn"
          (click)="signOut()"
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <app-icon name="log-out" />
        </button>
      }
    </header>

    <div class="flex">
      @if (menuOpen()) {
        <div
          class="fixed inset-0 top-14 z-20 bg-slate-900/40 lg:hidden"
          (click)="menuOpen.set(false)"
          aria-hidden="true"
        ></div>
      }
      <aside
        id="sidebar"
        class="fixed inset-y-0 left-0 top-14 z-20 w-72 -translate-x-full border-r border-slate-200 bg-white transition-transform lg:sticky lg:h-[calc(100dvh-3.5rem)] lg:translate-x-0 dark:border-slate-800 dark:bg-slate-950"
        [class.translate-x-0]="menuOpen()"
        [attr.inert]="menuHidden() ? '' : null"
      >
        <app-sidebar-nav (navigate)="menuOpen.set(false)" />
      </aside>

      <main
        id="main"
        tabindex="-1"
        class="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-10"
      >
        <router-outlet />
      </main>
    </div>
  `,
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly cloud = inject(CloudSyncService);
  protected readonly menuOpen = signal(false);

  protected readonly cloudLabel = computed(
    () =>
      ({
        off: '',
        loading: 'Đang tải…',
        saving: 'Đang lưu…',
        saved: 'Đã lưu',
        error: 'Chưa lưu được (đang offline?)',
      })[this.cloud.state()],
  );

  protected async signOut(): Promise<void> {
    if (!confirm('Đăng xuất? Tiến độ đã được lưu vào tài khoản của bạn.')) return;
    await this.cloud.signOut();
  }

  /** Trên mobile, menu đóng thì không cho focus vào (inert). Trên desktop luôn hiện. */
  private readonly isDesktop = signal(
    typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches,
  );
  protected readonly menuHidden = computed(() => !this.isDesktop() && !this.menuOpen());

  protected readonly themeIcon = computed(
    () => ({ light: 'sun', dark: 'moon', system: 'monitor' })[this.theme.mode()],
  );
  protected readonly themeLabel = computed(
    () => ({ light: 'Sáng', dark: 'Tối', system: 'Theo hệ thống' })[this.theme.mode()],
  );

  constructor() {
    if (typeof matchMedia === 'function') {
      matchMedia('(min-width: 1024px)').addEventListener('change', (e) =>
        this.isDesktop.set(e.matches),
      );
    }
  }

  protected skipToMain(event: Event): void {
    event.preventDefault();
    document.getElementById('main')?.focus();
  }
}
