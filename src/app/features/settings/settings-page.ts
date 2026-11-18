import { DatePipe } from '@angular/common';
import { Component, inject, resource, signal } from '@angular/core';
import { BackupService } from '../../core/backup/backup.service';
import { ContentService } from '../../core/content/content.service';
import { StorageService } from '../../core/storage/storage.service';
import { SyncService } from '../../core/sync/sync.service';
import { type ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-settings-page',
  imports: [DatePipe, Icon],
  template: `
    <div class="mx-auto max-w-2xl space-y-8">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Cài đặt & dữ liệu</h1>

      <section class="card p-5" aria-labelledby="theme-heading">
        <h2 id="theme-heading" class="font-semibold">Giao diện</h2>
        <div
          class="mt-3 inline-flex rounded-lg border border-slate-200 p-1 dark:border-slate-700"
          role="radiogroup"
          aria-label="Chế độ màu"
        >
          @for (opt of themeOptions; track opt.value) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="theme.mode() === opt.value"
              (click)="theme.mode.set(opt.value)"
              class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm"
              [class]="
                theme.mode() === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              "
            >
              <app-icon [name]="opt.icon" [size]="16" /> {{ opt.label }}
            </button>
          }
        </div>
      </section>

      <section class="card p-5" aria-labelledby="data-heading">
        <h2 id="data-heading" class="font-semibold">Dữ liệu cá nhân</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tiến độ được lưu trong trình duyệt này (IndexedDB). Muốn học tiếp trên máy khác: bật
          <strong>Đồng bộ giữa các thiết bị</strong> bên dưới, hoặc xuất file sao lưu rồi nhập ở máy
          kia (nhập sẽ thay toàn bộ dữ liệu của máy đó).
        </p>
        @if (volatile.value()) {
          <p
            class="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            role="note"
          >
            Trình duyệt đang chặn IndexedDB (có thể do chế độ ẩn danh) — dữ liệu sẽ mất khi tải lại
            trang.
          </p>
        }
        <div class="mt-4 flex flex-wrap gap-3">
          <button type="button" class="btn-primary" (click)="exportData()">
            <app-icon name="download" [size]="16" /> Xuất sao lưu
          </button>
          <label class="btn-secondary cursor-pointer">
            <app-icon name="upload" [size]="16" /> Nhập sao lưu
            <input
              type="file"
              accept="application/json,.json"
              class="sr-only"
              (change)="importData($event)"
            />
          </label>
          <button type="button" class="btn-danger" (click)="reset()">
            <app-icon name="trash" [size]="16" /> Xoá toàn bộ
          </button>
        </div>
        @if (message(); as m) {
          <p
            class="mt-3 text-sm"
            [class]="m.ok ? 'text-emerald-600' : 'text-red-600'"
            role="status"
          >
            {{ m.text }}
          </p>
        }
      </section>

      <section class="card p-5" aria-labelledby="sync-heading">
        <h2 id="sync-heading" class="font-semibold">Đồng bộ giữa các thiết bị</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tiến độ bài học, kết quả trắc nghiệm, ô đã làm trong lộ trình và bản tin đã đọc được lưu
          vào một <strong>GitHub Gist bí mật</strong> trong tài khoản của bạn. Kết nối cùng một
          token ở mọi thiết bị: app tự gộp dữ liệu (bản đổi sau cùng thắng) khi mở app, khi quay lại
          tab và vài giây sau mỗi thay đổi.
        </p>

        @if (sync.state() === 'off') {
          <details class="mt-3 text-sm">
            <summary class="cursor-pointer font-medium text-indigo-600 dark:text-indigo-400">
              Cách tạo token (một lần, khoảng 1 phút)
            </summary>
            <ol class="mt-2 list-decimal space-y-1 pl-5 text-slate-600 dark:text-slate-400">
              <li>
                Mở
                <a
                  class="underline"
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noopener"
                  >GitHub → Fine-grained personal access token</a
                >.
              </li>
              <li>Đặt tên (vd "Learning Hub sync") và thời hạn (vd 1 năm).</li>
              <li>
                Ở <em>Repository access</em> chọn <strong>Public repositories</strong> (không cần
                repo nào). Ở <em>Account permissions</em> → <strong>Gists</strong> chọn
                <strong>Read and write</strong>. Không bật quyền nào khác.
              </li>
              <li>
                Bấm Generate token, copy rồi dán vào ô dưới. Dùng lại token này ở thiết bị khác.
              </li>
            </ol>
          </details>
          <form class="mt-4 flex flex-wrap gap-3" (submit)="connect($event)">
            <label class="sr-only" for="sync-token">GitHub token</label>
            <input
              id="sync-token"
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="github_pat_…"
              class="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <button type="submit" class="btn-primary" [disabled]="connecting()">
              <app-icon name="refresh" [size]="16" />
              {{ connecting() ? 'Đang kết nối…' : 'Bật đồng bộ' }}
            </button>
          </form>
          <p class="mt-3 text-xs text-slate-500">
            Token chỉ được lưu trong trình duyệt của thiết bị này (localStorage), không nằm trong
            file sao lưu hay trong Gist, và chỉ được gửi tới api.github.com. Thu hồi bất cứ lúc nào
            ở trang token của GitHub.
          </p>
        } @else {
          <div class="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span
              class="rounded-full px-2.5 py-0.5 font-medium"
              [class]="
                sync.state() === 'error'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              "
              role="status"
            >
              @switch (sync.state()) {
                @case ('syncing') {
                  Đang đồng bộ…
                }
                @case ('error') {
                  Lỗi đồng bộ
                }
                @default {
                  Đã bật đồng bộ
                }
              }
            </span>
            @if (sync.lastSyncAt(); as at) {
              <span class="text-slate-500">Lần cuối: {{ at | date: 'HH:mm:ss dd/MM/yyyy' }}</span>
            }
            @if (sync.gistUrl(); as url) {
              <a
                class="text-indigo-600 underline dark:text-indigo-400"
                [href]="url"
                target="_blank"
                rel="noopener"
                >Xem Gist</a
              >
            }
          </div>
          @if (sync.error(); as err) {
            <p class="mt-2 text-sm text-red-600" role="alert">{{ err }}</p>
          }
          <div class="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              class="btn-primary"
              [disabled]="sync.state() === 'syncing'"
              (click)="sync.syncNow()"
            >
              <app-icon name="refresh" [size]="16" /> Đồng bộ ngay
            </button>
            <button type="button" class="btn-secondary" (click)="disconnect()">
              Tắt đồng bộ trên thiết bị này
            </button>
          </div>
        }
        @if (syncMessage(); as m) {
          <p
            class="mt-3 text-sm"
            [class]="m.ok ? 'text-emerald-600' : 'text-red-600'"
            role="status"
          >
            {{ m.text }}
          </p>
        }
      </section>

      <section
        class="card p-5 text-sm text-slate-600 dark:text-slate-400"
        aria-labelledby="about-heading"
      >
        <h2 id="about-heading" class="font-semibold text-slate-900 dark:text-slate-100">
          Về nội dung
        </h2>
        @if (content.manifest.hasValue()) {
          <p class="mt-2">
            Nội dung được build lúc
            {{ content.manifest.value().generatedAt | date: 'HH:mm dd/MM/yyyy' }}.
          </p>
          <p>
            {{ content.manifest.value().subjects.length }} môn học ·
            {{ content.manifest.value().updateCount }} bản tin.
          </p>
        }
      </section>
    </div>
  `,
})
export class SettingsPage {
  protected readonly theme = inject(ThemeService);
  protected readonly content = inject(ContentService);
  private readonly backup = inject(BackupService);
  private readonly storage = inject(StorageService);
  protected readonly sync = inject(SyncService);
  protected readonly connecting = signal(false);
  protected readonly syncMessage = signal<{ ok: boolean; text: string } | undefined>(undefined);

  protected readonly volatile = resource({ loader: () => this.storage.volatile });
  protected readonly message = signal<{ ok: boolean; text: string } | undefined>(undefined);
  protected readonly themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'system', label: 'Hệ thống', icon: 'monitor' },
    { value: 'light', label: 'Sáng', icon: 'sun' },
    { value: 'dark', label: 'Tối', icon: 'moon' },
  ];

  protected async exportData(): Promise<void> {
    const data = await this.backup.export();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-hub-${data.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.message.set({ ok: true, text: `Đã xuất ${data.progress.length} bản ghi tiến độ.` });
  }

  protected async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      await this.backup.import(JSON.parse(await file.text()));
      this.message.set({ ok: true, text: 'Đã khôi phục dữ liệu từ file sao lưu.' });
    } catch (e) {
      this.message.set({
        ok: false,
        text: e instanceof SyntaxError ? 'File không phải JSON hợp lệ.' : (e as Error).message,
      });
    }
  }

  protected async connect(event: Event): Promise<void> {
    event.preventDefault();
    const input = (event.target as HTMLFormElement).querySelector<HTMLInputElement>('#sync-token');
    this.connecting.set(true);
    this.syncMessage.set(undefined);
    try {
      await this.sync.connect(input?.value ?? '');
      if (input) input.value = '';
      this.syncMessage.set({
        ok: true,
        text: 'Đã bật đồng bộ. Dán cùng token ở thiết bị khác để học tiếp ở đó.',
      });
    } catch (e) {
      this.syncMessage.set({ ok: false, text: (e as Error).message });
    } finally {
      this.connecting.set(false);
    }
  }

  protected disconnect(): void {
    if (!confirm('Tắt đồng bộ trên thiết bị này? Dữ liệu trên máy và trong Gist vẫn được giữ.'))
      return;
    this.sync.disconnect();
    this.syncMessage.set({ ok: true, text: 'Đã tắt đồng bộ trên thiết bị này.' });
  }

  protected async reset(): Promise<void> {
    const warn =
      this.sync.state() === 'off'
        ? ''
        : '\n\nĐồng bộ đang bật: dữ liệu sẽ được tải lại từ Gist. Muốn xoá hẳn, tắt đồng bộ và xoá Gist trước.';
    if (!confirm('Xoá toàn bộ tiến độ và dữ liệu cá nhân? Không thể hoàn tác.' + warn)) return;
    await this.backup.reset();
    this.message.set({ ok: true, text: 'Đã xoá dữ liệu.' });
  }
}
