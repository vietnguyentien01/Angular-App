import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Importance } from '../../core/content/content.models';
import { ContentService } from '../../core/content/content.service';
import { UpdatesReadService } from '../../core/updates/updates-read.service';
import { Icon } from '../../shared/icon/icon';
import { PageState } from '../../shared/page-state/page-state';

export const IMPORTANCE: Record<Importance, { label: string; cls: string }> = {
  high: {
    label: 'Quan trọng',
    cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
  medium: {
    label: 'Đáng chú ý',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  low: {
    label: 'Tham khảo',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

@Component({
  selector: 'app-updates-page',
  imports: [RouterLink, DatePipe, Icon, PageState],
  template: `
    <div class="mx-auto max-w-3xl">
      <header>
        <h1 class="inline-flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
          <app-icon name="bell" [size]="26" /> Frontend mới
        </h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Bản tin kiến thức frontend được cập nhật tự động mỗi 2 ngày từ các nguồn chính thống
          (Angular, TypeScript, TC39, web.dev, trình duyệt…). Mỗi tin đều có link nguồn gốc.
        </p>
      </header>

      @if (content.updates.hasValue()) {
        <ol class="mt-8 space-y-4">
          @for (u of list(); track u.id) {
            <li>
              <a [routerLink]="[u.id]" class="card block p-5 transition hover:shadow-md">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <span class="font-mono text-slate-500">{{ u.date | date: 'dd/MM/yyyy' }}</span>
                  <span
                    class="rounded-full px-2 py-0.5 font-medium"
                    [class]="importance[u.importance].cls"
                    >{{ importance[u.importance].label }}</span
                  >
                  @if (u.unread) {
                    <span class="rounded-full bg-indigo-600 px-2 py-0.5 font-medium text-white"
                      >Mới</span
                    >
                  }
                </div>
                <p class="mt-2 text-lg font-semibold">{{ u.title }}</p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ u.summary }}</p>
                @if (u.tags.length) {
                  <p class="mt-3 flex flex-wrap gap-1.5">
                    @for (tag of u.tags; track tag) {
                      <span class="badge">#{{ tag }}</span>
                    }
                  </p>
                }
              </a>
            </li>
          } @empty {
            <li class="card p-8 text-center text-slate-500">
              <app-icon name="sparkles" [size]="28" class="text-indigo-400" />
              <p class="mt-3 font-medium">Chưa có bản tin nào</p>
              <p class="mt-1 text-sm">
                Bản tin đầu tiên sẽ xuất hiện ở đây sau lần cập nhật tự động kế tiếp.
              </p>
            </li>
          }
        </ol>
      } @else {
        <app-page-state [loading]="content.updates.isLoading()" what="bản tin" />
      }
    </div>
  `,
})
export class UpdatesPage {
  protected readonly content = inject(ContentService);
  private readonly read = inject(UpdatesReadService);
  protected readonly importance = IMPORTANCE;

  /** Chụp trạng thái "chưa đọc" khi vào trang, trước khi đánh dấu đã xem. */
  protected readonly list = computed(() =>
    this.content.updates.hasValue()
      ? this.content.updates
          .value()
          .updates.map((u) => ({ ...u, unread: untracked(() => this.read.isUnread(u.id)) }))
      : [],
  );

  constructor() {
    effect(() => {
      if (this.list().length) untracked(() => void this.read.markAllSeen());
    });
  }
}
