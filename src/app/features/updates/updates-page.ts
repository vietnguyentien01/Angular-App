import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Importance, UpdateCategory } from '../../core/content/content.models';
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

export const CATEGORY: Record<UpdateCategory, { label: string; cls: string }> = {
  frontend: {
    label: 'Frontend',
    cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  },
  ai: {
    label: 'AI',
    cls: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  },
  'xu-huong': {
    label: 'Xu hướng',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
};

type Filter = 'all' | UpdateCategory;

@Component({
  selector: 'app-updates-page',
  imports: [RouterLink, DatePipe, Icon, PageState],
  template: `
    <div class="mx-auto max-w-3xl">
      <header>
        <h1 class="inline-flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
          <app-icon name="bell" [size]="26" /> Tin tức mới
        </h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Bản tin về frontend, AI và xu hướng công nghệ, cập nhật tự động mỗi 2 ngày từ các nguồn
          chính thống (Angular, TypeScript, trình duyệt, Anthropic, các hãng AI, khảo sát
          developer…). Mỗi tin đều có link nguồn gốc.
        </p>
      </header>

      <div class="mt-6 flex flex-wrap gap-2" role="group" aria-label="Lọc theo nhóm tin">
        @for (f of filters; track f.value) {
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-sm font-medium transition"
            [class]="
              filter() === f.value
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            "
            [attr.aria-pressed]="filter() === f.value"
            (click)="filter.set(f.value)"
          >
            {{ f.label }} <span class="opacity-70">({{ count(f.value) }})</span>
          </button>
        }
      </div>

      @if (content.updates.hasValue()) {
        <ol class="mt-6 space-y-4">
          @for (u of visible(); track u.id) {
            <li>
              <a [routerLink]="[u.id]" class="card block p-5 transition hover:shadow-md">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <span class="font-mono text-slate-500">{{ u.date | date: 'dd/MM/yyyy' }}</span>
                  <span
                    class="rounded-full px-2 py-0.5 font-medium"
                    [class]="category[u.category].cls"
                    >{{ category[u.category].label }}</span
                  >
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
              <p class="mt-3 font-medium">Chưa có bản tin nào trong nhóm này</p>
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
  protected readonly category = CATEGORY;
  protected readonly filter = signal<Filter>('all');
  protected readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'frontend', label: 'Frontend' },
    { value: 'ai', label: 'AI' },
    { value: 'xu-huong', label: 'Xu hướng' },
  ];

  /** Chụp trạng thái "chưa đọc" khi vào trang, trước khi đánh dấu đã xem. */
  protected readonly list = computed(() =>
    this.content.updates.hasValue()
      ? this.content.updates
          .value()
          .updates.map((u) => ({ ...u, unread: untracked(() => this.read.isUnread(u.id)) }))
      : [],
  );

  protected readonly visible = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.list() : this.list().filter((u) => u.category === f);
  });

  protected count(f: Filter): number {
    return f === 'all' ? this.list().length : this.list().filter((u) => u.category === f).length;
  }

  constructor() {
    effect(() => {
      if (this.list().length) untracked(() => void this.read.markAllSeen());
    });
  }
}
