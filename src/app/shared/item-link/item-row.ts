import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ItemSummary } from '../../core/content/content.models';
import { ProgressService } from '../../core/progress/progress.service';
import { Icon } from '../icon/icon';

export const TYPE_LABEL: Record<ItemSummary['type'], string> = {
  lesson: 'Bài học',
  card: 'Thẻ ôn',
  cheatsheet: 'Cheat sheet',
};
export const LEVEL_LABEL: Record<ItemSummary['level'], string> = {
  core: 'Core',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

export const itemRoute = (item: Pick<ItemSummary, 'subject' | 'section' | 'topic' | 'slug'>) => [
  '/',
  item.subject,
  item.section,
  item.topic,
  item.slug,
];

/** Một dòng bài học trong danh sách, kèm trạng thái tiến độ. */
@Component({
  selector: 'app-item-row',
  imports: [RouterLink, Icon],
  host: { class: 'block' },
  template: `
    <a
      [routerLink]="route()"
      class="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60"
    >
      <span class="mt-0.5" [class]="statusClass()" [attr.aria-label]="statusLabel()">
        <app-icon [name]="statusIcon()" [size]="18" />
      </span>
      <span class="min-w-0 flex-1">
        <span
          class="block font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
          >{{ item().title }}</span
        >
        @if (showSummary()) {
          <span class="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">{{
            item().summary
          }}</span>
        }
        <span class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span class="badge">{{ typeLabel() }}</span>
          <span>{{ levelLabel() }}</span>
          <span class="inline-flex items-center gap-1"
            ><app-icon name="clock" [size]="12" /> {{ item().minutes }} phút</span
          >
        </span>
      </span>
      <app-icon name="chevron-right" [size]="18" class="mt-1 text-slate-400" />
    </a>
  `,
})
export class ItemRow {
  private readonly progress = inject(ProgressService);
  readonly item = input.required<ItemSummary>();
  readonly showSummary = input(true);

  protected readonly route = computed(() => itemRoute(this.item()));
  protected readonly typeLabel = computed(() => TYPE_LABEL[this.item().type]);
  protected readonly levelLabel = computed(() => LEVEL_LABEL[this.item().level]);
  private readonly status = computed(() => this.progress.status(this.item()));
  protected readonly statusIcon = computed(() =>
    this.status() === 'done'
      ? 'check-circle'
      : this.status() === 'in-progress'
        ? 'half-circle'
        : 'circle',
  );
  protected readonly statusClass = computed(() =>
    this.status() === 'done'
      ? 'text-emerald-500'
      : this.status() === 'in-progress'
        ? 'text-amber-500'
        : 'text-slate-300 dark:text-slate-600',
  );
  protected readonly statusLabel = computed(() =>
    this.status() === 'done' ? 'Đã học' : this.status() === 'in-progress' ? 'Đang học' : 'Chưa học',
  );
}
