import { Component, computed, inject, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import type { Roadmap } from '../../core/content/content.models';
import { contentUrl } from '../../core/content/content.service';
import { ProgressService } from '../../core/progress/progress.service';
import { RoadmapTasksService, computeStageProgress } from '../../core/roadmap/roadmap-progress';
import { Icon } from '../../shared/icon/icon';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';

/** Thẻ tóm tắt tiến độ lộ trình của một môn trên trang tổng quan. */
@Component({
  selector: 'app-roadmap-card',
  imports: [RouterLink, Icon, ProgressBar],
  template: `
    @if (card(); as r) {
      <section [attr.aria-labelledby]="headingId()" class="card overflow-hidden">
        <div
          class="flex flex-wrap items-center gap-4 bg-gradient-to-r from-indigo-600 to-rose-500 p-5 text-white"
        >
          <app-icon name="route" [size]="32" />
          <div class="min-w-0 flex-1">
            <h2 [id]="headingId()" class="text-lg font-semibold">{{ r.title }}</h2>
            <p class="text-sm text-white/85">
              @if (r.current; as c) {
                Chặng {{ r.currentIndex + 1 }}/{{ r.stageCount }}:
                <strong>{{ c.title }}</strong> · {{ r.currentPercent }}%
              } @else {
                Đã hoàn thành toàn bộ lộ trình 🎉
              }
            </p>
          </div>
          <a
            [routerLink]="['/', r.subject, 'roadmap']"
            class="rounded-lg bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25"
            >Xem lộ trình</a
          >
        </div>
        <div class="flex flex-wrap items-center gap-4 p-4">
          <div class="min-w-48 flex-1">
            <p class="mb-1 text-xs text-slate-500">Tổng thể {{ r.overall }}%</p>
            <app-progress-bar [percent]="r.overall" [label]="'Tiến độ ' + r.title" />
          </div>
          @if (r.next; as n) {
            <a [routerLink]="['/', n.subject, n.section, n.topic, n.slug]" class="btn-primary">
              <app-icon name="chevron-right" [size]="16" /> Học tiếp: {{ n.title }}
            </a>
          }
        </div>
      </section>
    }
  `,
})
export class RoadmapCard {
  readonly subject = input.required<string>();

  private readonly progress = inject(ProgressService);
  private readonly roadmapTasks = inject(RoadmapTasksService);
  private readonly roadmap = httpResource<Roadmap>(() => contentUrl.roadmap(this.subject()));

  protected readonly headingId = computed(() => `roadmap-heading-${this.subject()}`);

  protected readonly card = computed(() => {
    if (!this.roadmap.hasValue()) return undefined;
    const r = this.roadmap.value();
    const records = this.progress.records();
    const tasks = this.roadmapTasks.tasks();
    const progress = r.stages.map((s) => computeStageProgress(r.subject, s, records, tasks));
    const currentIndex = progress.findIndex((p) => !p.complete);
    const current = currentIndex >= 0 ? r.stages[currentIndex] : undefined;
    const totals = progress.reduce(
      (acc, p) => ({
        done: acc.done + p.lessonsDone + p.tasksDone,
        all: acc.all + p.lessonsTotal + p.tasksTotal,
      }),
      { done: 0, all: 0 },
    );
    return {
      subject: r.subject,
      title: r.title,
      stageCount: r.stages.length,
      current,
      currentIndex,
      currentPercent: currentIndex >= 0 ? progress[currentIndex].percent : 100,
      next: current?.items.find((i) => records[`${i.subject}/${i.id}`]?.status !== 'done'),
      overall: totals.all ? Math.round((totals.done / totals.all) * 100) : 0,
    };
  });
}
