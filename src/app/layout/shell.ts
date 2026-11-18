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
  host: {
    class: 'block min-h-dvh',
    '(document:keydown.escape)': 'menuOpen.set(false); accountOpen.set(false)',
  },
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
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            (click)="accountOpen.set(!accountOpen())"
            aria-haspopup="menu"
            [attr.aria-expanded]="accountOpen()"
            aria-controls="account-menu"
            [attr.aria-label]="'Tài khoản: ' + u.email"
          >
            @if (u.photoUrl) {
              <img
                [src]="u.photoUrl"
                alt=""
                width="28"
                height="28"
                referrerpolicy="no-referrer"
                class="size-7 rounded-full"
              />
            } @else {
              <span
                class="grid size-7 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
                aria-hidden="true"
                >{{ u.name.charAt(0).toUpperCase() }}</span
              >
            }
            <span class="hidden max-w-40 truncate text-sm font-medium md:inline">{{ u.name }}</span>
          </button>
          @if (accountOpen()) {
            <div
              class="fixed inset-0 z-40"
              (click)="accountOpen.set(false)"
              aria-hidden="true"
            ></div>
            <div
              id="account-menu"
              role="menu"
              class="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <div class="px-3 py-2">
                <p class="truncate text-sm font-semibold">{{ u.name }}</p>
                <p class="truncate text-xs text-slate-500">{{ u.email }}</p>
              </div>
              <hr class="my-1 border-slate-200 dark:border-slate-700" />
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-slate-800"
                [disabled]="switching()"
                (click)="switchAccount()"
              >
                <app-icon name="refresh" [size]="16" />
                {{ switching() ? 'Đang mở cửa sổ chọn tài khoản…' : 'Chuyển tài khoản' }}
              </button>
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                (click)="signOut()"
              >
                <app-icon name="log-out" [size]="16" /> Đăng xuất
              </button>
              @if (accountError(); as err) {
                <p class="px-3 py-2 text-xs text-red-600" role="alert">{{ err }}</p>
              }
            </div>
          }
        </div>
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
  protected readonly accountOpen = signal(false);
  protected readonly switching = signal(false);
  protected readonly accountError = signal<string | undefined>(undefined);

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

  protected async switchAccount(): Promise<void> {
    this.switching.set(true);
    this.accountError.set(undefined);
    try {
      await this.cloud.switchAccount();
      this.accountOpen.set(false);
    } catch (e) {
      this.accountError.set((e as Error).message);
    } finally {
      this.switching.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    this.accountOpen.set(false);
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
