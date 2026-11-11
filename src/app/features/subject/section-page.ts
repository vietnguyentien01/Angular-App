import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/content/content.service';
import { ProgressService, computeStats } from '../../core/progress/progress.service';
import { Icon } from '../../shared/icon/icon';
import { ItemRow } from '../../shared/item-link/item-row';
import { PageState } from '../../shared/page-state/page-state';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';

/** Trang một phần (vd "Ôn lại Core"): danh sách chủ đề và bài. */
@Component({
  selector: 'app-section-page',
  imports: [RouterLink, Icon, ItemRow, PageState, ProgressBar],
  template: `
    @if (view(); as v) {
      <div class="mx-auto max-w-4xl space-y-8">
        <nav aria-label="Breadcrumb" class="text-sm text-slate-500">
          <a [routerLink]="['/', v.subject.id]" class="hover:underline">{{ v.subject.title }}</a>
          <span class="mx-1">/</span>
          <span aria-current="page">{{ v.section.title }}</span>
        </nav>

        <header>
          <h1 class="inline-flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
            <app-icon [name]="v.section.icon" [size]="28" /> {{ v.section.title }}
          </h1>
          <p class="mt-2 text-slate-600 dark:text-slate-400">{{ v.section.description }}</p>
          <div class="mt-4 max-w-sm">
            <p class="mb-1 text-sm text-slate-500">
              {{ v.stats.done }}/{{ v.stats.total }} bài đã học
            </p>
            <app-progress-bar [percent]="v.stats.percent" [color]="v.subject.color" />
          </div>
        </header>

        <nav aria-label="Các phần khác" class="flex flex-wrap gap-2">
          @for (s of v.subject.sections; track s.id) {
            <a
              [routerLink]="['/', v.subject.id, s.id]"
              class="rounded-full border px-3 py-1 text-sm"
              [class]="
                s.id === v.section.id
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
              "
              [attr.aria-current]="s.id === v.section.id ? 'page' : null"
              >{{ s.title }}</a
            >
          }
        </nav>

        @for (group of v.groups; track group.topic.id) {
          <section
            [id]="group.topic.id"
            class="scroll-mt-20"
            [attr.aria-labelledby]="'t-' + group.topic.id"
          >
            <h2 [id]="'t-' + group.topic.id" class="section-heading">{{ group.topic.title }}</h2>
            <p class="-mt-2 mb-3 text-sm text-slate-500">{{ group.topic.description }}</p>
            <div class="card divide-y divide-slate-100 p-1 dark:divide-slate-800">
              @for (item of group.items; track item.id) {
                <app-item-row [item]="item" />
              } @empty {
                <p class="px-4 py-5 text-sm text-slate-500">
                  Nội dung cho chủ đề này ở phần “{{ v.section.title }}” đang được biên soạn.
                </p>
              }
            </div>
          </section>
        }
      </div>
    } @else {
      <app-page-state
        [loading]="content.indexes.isLoading() || content.manifest.isLoading()"
        what="phần học"
      />
    }
  `,
})
export class SectionPage {
  protected readonly content = inject(ContentService);
  private readonly progress = inject(ProgressService);

  readonly subject = input.required<string>();
  readonly section = input.required<string>();

  protected readonly view = computed(() => {
    const index = this.content.subjectIndex(this.subject());
    const section = index?.subject.sections.find((s) => s.id === this.section());
    if (!index || !section) return undefined;
    const items = index.items.filter((i) => i.section === section.id);
    return {
      subject: index.subject,
      section,
      stats: computeStats(items, this.progress.records()),
      groups: index.topics.map((topic) => ({
        topic,
        items: items.filter((i) => i.topic === topic.id),
      })),
    };
  });
}
