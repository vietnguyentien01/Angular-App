import { DatePipe } from '@angular/common';
import { Component, inject, resource, signal } from '@angular/core';
import { BackupService } from '../../core/backup/backup.service';
import { ContentService } from '../../core/content/content.service';
import { StorageService } from '../../core/storage/storage.service';
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
          Tiến độ và ghi chú chỉ được lưu trong trình duyệt này (IndexedDB). Hãy xuất file sao lưu
          để chuyển sang máy khác.
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

  protected async reset(): Promise<void> {
    if (!confirm('Xoá toàn bộ tiến độ và dữ liệu cá nhân? Không thể hoàn tác.')) return;
    await this.backup.reset();
    this.message.set({ ok: true, text: 'Đã xoá dữ liệu.' });
  }
}
