import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/content/content.service';
import { ProgressService, computeStats } from '../../core/progress/progress.service';
import { Icon } from '../../shared/icon/icon';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import { PageState } from '../../shared/page-state/page-state';

/** Trang môn học: 3 phần + ma trận kiến thức (chủ đề × phần). */
@Component({
  selector: 'app-subject-page',
  imports: [RouterLink, Icon, ProgressBar, PageState],
  template: `
    @if (index(); as index) {
      <div class="mx-auto max-w-5xl space-y-10">
        <header class="flex items-start gap-4">
          <span
            class="grid size-12 shrink-0 place-items-center rounded-2xl text-white"
            [style.background-color]="index.subject.color"
          >
            <app-icon [name]="index.subject.icon" [size]="24" />
          </span>
          <div class="min-w-0 flex-1">
            <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ index.subject.title }}</h1>
            <p class="mt-1 text-slate-600 dark:text-slate-400">{{ index.subject.description }}</p>
            <div class="mt-4 flex flex-wrap gap-3">
              @if (index.subject.hasRoadmap) {
                <a [routerLink]="['roadmap']" class="btn-secondary">
                  <app-icon name="route" [size]="16" /> Lộ trình lên Senior
                </a>
              }
            </div>
            @if (index.subject.quizCount) {
              <a [routerLink]="['practice']" class="btn-primary mt-4">
                <app-icon name="target" [size]="16" /> Luyện tập {{ index.subject.quizCount }} câu
                hỏi
              </a>
            }
          </div>
        </header>

        <section aria-labelledby="sections-heading">
          <h2 id="sections-heading" class="sr-only">Các phần</h2>
          <ol class="grid gap-4 md:grid-cols-3">
            @for (sec of sections(); track sec.id; let i = $index) {
              <li>
                <a
                  [routerLink]="[sec.id]"
                  class="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span class="text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >Phần {{ i + 1 }}</span
                  >
                  <span
                    class="mt-2 inline-flex items-center gap-2 text-lg font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                  >
                    <app-icon [name]="sec.icon" /> {{ sec.title }}
                  </span>
                  <span class="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-400">{{
                    sec.description
                  }}</span>
                  <span class="mt-4 block text-sm text-slate-500"
                    >{{ sec.stats.done }}/{{ sec.stats.total }} bài</span
                  >
                  <app-progress-bar
                    class="mt-1"
                    [percent]="sec.stats.percent"
                    [color]="index.subject.color"
                    [label]="'Tiến độ ' + sec.title"
                  />
                </a>
              </li>
            }
          </ol>
        </section>

        <section aria-labelledby="matrix-heading">
          <h2 id="matrix-heading" class="section-heading">Ma trận kiến thức</h2>
          <p class="-mt-2 mb-4 text-sm text-slate-500">
            Mỗi chủ đề đi qua 3 tầng. Ô càng đậm là bạn càng nắm vững.
          </p>
          <div class="card overflow-x-auto">
            <table class="w-full min-w-[32rem] text-sm">
              <thead>
                <tr class="border-b border-slate-200 text-left dark:border-slate-800">
                  <th scope="col" class="px-4 py-3 font-semibold">Chủ đề</th>
                  @for (sec of index.subject.sections; track sec.id) {
                    <th scope="col" class="px-4 py-3 font-semibold">{{ sec.title }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of matrix(); track row.topic.id) {
                  <tr class="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <th scope="row" class="px-4 py-3 text-left font-medium">
                      {{ row.topic.title }}
                      <span class="block text-xs font-normal text-slate-500">{{
                        row.topic.description
                      }}</span>
                    </th>
                    @for (cell of row.cells; track cell.section) {
                      <td class="px-4 py-3">
                        @if (cell.stats.total) {
                          <a
                            [routerLink]="[cell.section]"
                            [fragment]="row.topic.id"
                            class="inline-flex min-w-16 justify-center rounded-md px-2 py-1 font-medium"
                            [style.background-color]="cellColor(cell.stats.percent)"
                            [class.text-white]="cell.stats.percent >= 50"
                          >
                            {{ cell.stats.done }}/{{ cell.stats.total }}
                          </a>
                        } @else {
                          <span class="text-slate-400" title="Chưa có bài">—</span>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    } @else {
      <app-page-state
        [loading]="content.indexes.isLoading() || content.manifest.isLoading()"
        what="môn học"
      />
    }
  `,
})
export class SubjectPage {
  protected readonly content = inject(ContentService);
  private readonly progress = inject(ProgressService);

  readonly subject = input.required<string>();

  protected readonly index = computed(() => this.content.subjectIndex(this.subject()));

  protected readonly sections = computed(() => {
    const index = this.index();
    if (!index) return [];
    const records = this.progress.records();
    return index.subject.sections.map((sec) => ({
      ...sec,
      stats: computeStats(
        index.items.filter((i) => i.section === sec.id),
        records,
      ),
    }));
  });

  protected readonly matrix = computed(() => {
    const index = this.index();
    if (!index) return [];
    const records = this.progress.records();
    return index.topics.map((topic) => ({
      topic,
      cells: index.subject.sections.map((sec) => ({
        section: sec.id,
        stats: computeStats(
          index.items.filter((i) => i.section === sec.id && i.topic === topic.id),
          records,
        ),
      })),
    }));
  });

  protected cellColor(percent: number): string {
    if (percent === 0) return 'var(--matrix-empty)';
    return `color-mix(in oklab, ${this.index()?.subject.color ?? '#4f46e5'} ${25 + percent * 0.75}%, var(--matrix-empty))`;
  }
}
