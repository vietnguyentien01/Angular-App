import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ItemSummary, Roadmap } from '../../core/content/content.models';
import { ContentService, contentUrl } from '../../core/content/content.service';
import { ProgressService } from '../../core/progress/progress.service';
import {
  RoadmapTasksService,
  computeStageProgress,
  taskKey,
} from '../../core/roadmap/roadmap-progress';
import { Icon } from '../../shared/icon/icon';
import { ItemRow, itemRoute } from '../../shared/item-link/item-row';
import { PageState } from '../../shared/page-state/page-state';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';

/** Lộ trình học theo chặng: mục tiêu, bài học, bài thực hành, cột mốc. */
@Component({
  selector: 'app-roadmap-page',
  imports: [RouterLink, Icon, ItemRow, PageState, ProgressBar],
  template: `
    @if (roadmap.hasValue() && view(); as v) {
      <div class="mx-auto max-w-4xl">
        <nav aria-label="Breadcrumb" class="text-sm text-slate-500">
          <a [routerLink]="['/', subject()]" class="hover:underline">{{ v.subjectTitle }}</a>
          <span class="mx-1">/</span>
          <span aria-current="page">Lộ trình</span>
        </nav>

        <header class="mt-2">
          <h1 class="inline-flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
            <app-icon name="route" [size]="28" /> {{ v.title }}
          </h1>
          <p class="mt-2 text-slate-600 dark:text-slate-400">{{ v.description }}</p>
          <div class="card mt-5 flex flex-wrap items-center gap-4 p-4">
            <div class="min-w-48 flex-1">
              <p class="mb-1 text-sm text-slate-500">
                Đã xong {{ v.completedStages }}/{{ v.stages.length }} chặng · {{ v.overall }}% tổng
                thể
              </p>
              <app-progress-bar [percent]="v.overall" [color]="v.color" label="Tiến độ lộ trình" />
            </div>
            @if (v.next; as next) {
              <a [routerLink]="route(next)" class="btn-primary">
                <app-icon name="chevron-right" [size]="16" /> Học tiếp: {{ next.title }}
              </a>
            } @else {
              <p class="text-sm font-medium text-emerald-600">
                Bạn đã hoàn thành mọi bài trong lộ trình 🎉
              </p>
            }
          </div>
        </header>

        <ol class="relative mt-8 space-y-4 border-l-2 border-slate-200 pl-6 dark:border-slate-800">
          @for (stage of v.stages; track stage.id; let i = $index) {
            <li class="relative">
              <span
                class="absolute -left-[2.15rem] top-4 grid size-8 place-items-center rounded-full border-2 text-sm font-bold"
                [class]="
                  stage.progress.complete
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : stage.id === v.currentId
                      ? 'border-indigo-500 bg-white text-indigo-600 dark:bg-slate-950'
                      : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950'
                "
                aria-hidden="true"
              >
                @if (stage.progress.complete) {
                  <app-icon name="check" [size]="16" />
                } @else {
                  {{ i + 1 }}
                }
              </span>

              <section
                class="card overflow-hidden"
                [class.ring-2]="stage.id === v.currentId"
                [class.ring-indigo-400]="stage.id === v.currentId"
              >
                <button
                  type="button"
                  class="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  [attr.aria-expanded]="open() === stage.id"
                  [attr.aria-controls]="'stage-' + stage.id"
                  (click)="toggle(stage.id)"
                >
                  <span class="min-w-0 flex-1">
                    <span class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>Chặng {{ i + 1 }}</span>
                      <span class="badge">{{ stage.duration }}</span>
                      @if (stage.id === v.currentId) {
                        <span class="rounded-full bg-indigo-600 px-2 py-0.5 font-medium text-white"
                          >Đang học</span
                        >
                      }
                    </span>
                    <span class="mt-1 block text-lg font-semibold">{{ stage.title }}</span>
                    <span class="mt-1 block text-sm text-slate-600 dark:text-slate-400">{{
                      stage.goal
                    }}</span>
                    <span class="mt-3 block max-w-md">
                      <span class="mb-1 block text-xs text-slate-500">
                        {{ stage.progress.lessonsDone }}/{{ stage.progress.lessonsTotal }} bài ·
                        {{ stage.progress.tasksDone }}/{{ stage.progress.tasksTotal }} thực hành ·
                        {{ stage.progress.percent }}%
                      </span>
                      <app-progress-bar
                        [percent]="stage.progress.percent"
                        [color]="v.color"
                        [label]="'Tiến độ ' + stage.title"
                      />
                    </span>
                  </span>
                  <app-icon
                    [name]="open() === stage.id ? 'chevron-down' : 'chevron-right'"
                    class="mt-1 text-slate-400"
                  />
                </button>

                @if (open() === stage.id) {
                  <div
                    [id]="'stage-' + stage.id"
                    class="space-y-6 border-t border-slate-100 p-4 dark:border-slate-800"
                  >
                    <div>
                      <h3 class="text-sm font-semibold">Sau chặng này bạn sẽ</h3>
                      <ul
                        class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300"
                      >
                        @for (o of stage.outcomes; track $index) {
                          <li>{{ o }}</li>
                        }
                      </ul>
                    </div>

                    <div>
                      <h3 class="text-sm font-semibold">Bài học ({{ stage.items.length }})</h3>
                      <div
                        class="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800"
                      >
                        @for (item of stage.items; track item.subject + item.id) {
                          <app-item-row [item]="item" [showSummary]="false" />
                        }
                      </div>
                    </div>

                    @if (stage.practice.length) {
                      <div>
                        <h3 class="text-sm font-semibold">Thực hành trên dự án thật</h3>
                        <ul class="mt-2 space-y-2">
                          @for (task of stage.practice; track $index; let ti = $index) {
                            <li>
                              <label
                                class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                              >
                                <input
                                  type="checkbox"
                                  class="mt-0.5 size-4 accent-emerald-600"
                                  [checked]="isTaskDone(stage.id, ti)"
                                  (change)="toggleTask(stage.id, ti)"
                                />
                                <span
                                  [class.line-through]="isTaskDone(stage.id, ti)"
                                  [class.text-slate-500]="isTaskDone(stage.id, ti)"
                                  >{{ task }}</span
                                >
                              </label>
                            </li>
                          }
                        </ul>
                      </div>
                    }

                    <div
                      class="flex gap-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950/30"
                    >
                      <app-icon name="flag" [size]="18" class="text-amber-600" />
                      <p><span class="font-semibold">Cột mốc:</span> {{ stage.milestone }}</p>
                    </div>
                  </div>
                }
              </section>
            </li>
          }
        </ol>
      </div>
    } @else {
      <app-page-state
        [loading]="roadmap.isLoading() || content.indexes.isLoading()"
        what="lộ trình"
      />
    }
  `,
})
export class RoadmapPage {
  protected readonly content = inject(ContentService);
  private readonly progress = inject(ProgressService);
  private readonly tasks = inject(RoadmapTasksService);

  readonly subject = input.required<string>();
  protected readonly roadmap = httpResource<Roadmap>(() => contentUrl.roadmap(this.subject()));

  protected readonly view = computed(() => {
    if (!this.roadmap.hasValue()) return undefined;
    const r = this.roadmap.value();
    const records = this.progress.records();
    const tasks = this.tasks.tasks();
    const stages = r.stages.map((s) => ({
      ...s,
      progress: computeStageProgress(r.subject, s, records, tasks),
    }));
    const current = stages.find((s) => !s.progress.complete);
    const next = current?.items.find((i) => records[`${i.subject}/${i.id}`]?.status !== 'done');
    const total = stages.reduce((n, s) => n + s.progress.lessonsTotal + s.progress.tasksTotal, 0);
    const done = stages.reduce((n, s) => n + s.progress.lessonsDone + s.progress.tasksDone, 0);
    const subj = this.content.subjects().find((s) => s.id === r.subject);
    return {
      title: r.title,
      description: r.description,
      subjectTitle: subj?.title ?? r.subject,
      color: subj?.color ?? '#4f46e5',
      stages,
      currentId: current?.id,
      next,
      completedStages: stages.filter((s) => s.progress.complete).length,
      overall: total ? Math.round((done / total) * 100) : 0,
    };
  });

  /** Mặc định mở chặng đang học; người dùng mở/đóng chặng khác được. */
  protected readonly open = linkedSignal<string | undefined, string | undefined>({
    source: () => this.view()?.currentId,
    computation: (current, previous) => previous?.value ?? current,
  });

  protected toggle(id: string): void {
    this.open.update((o) => (o === id ? undefined : id));
  }

  protected isTaskDone(stageId: string, index: number): boolean {
    return !!this.tasks.tasks()[taskKey(this.subject(), stageId, index)];
  }

  protected toggleTask(stageId: string, index: number): void {
    void this.tasks.toggle(taskKey(this.subject(), stageId, index));
  }

  protected route = (item: ItemSummary) => itemRoute(item);
}
