import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ItemSummary } from '../../core/content/content.models';
import { ContentService } from '../../core/content/content.service';
import { ProgressService, computeStats } from '../../core/progress/progress.service';
import { UpdatesReadService } from '../../core/updates/updates-read.service';
import { Icon } from '../../shared/icon/icon';
import { ItemRow } from '../../shared/item-link/item-row';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import { RoadmapCard } from './roadmap-card';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, DatePipe, Icon, ItemRow, ProgressBar, RoadmapCard],
  template: `
    <div class="mx-auto max-w-5xl space-y-10">
      <header>
        <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Chào bạn, học gì hôm nay?</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Ôn lại nền tảng, củng cố bằng thực hành, rồi đi sâu và cập nhật cái mới.
        </p>
      </header>

      @if (roadmapSubjects().length) {
        <div class="grid gap-4 lg:grid-cols-2">
          @for (sid of roadmapSubjects(); track sid) {
            <app-roadmap-card [subject]="sid" />
          }
        </div>
      }

      @if (continueItems().length) {
        <section aria-labelledby="continue-heading">
          <h2 id="continue-heading" class="section-heading">Tiếp tục học</h2>
          <div class="card divide-y divide-slate-100 p-1 dark:divide-slate-800">
            @for (item of continueItems(); track item.id) {
              <app-item-row [item]="item" [showSummary]="false" />
            }
          </div>
        </section>
      }

      <section aria-labelledby="subjects-heading">
        <h2 id="subjects-heading" class="section-heading">Môn học</h2>
        <div class="grid gap-4 md:grid-cols-2">
          @for (s of subjectCards(); track s.id) {
            <a
              [routerLink]="['/', s.id]"
              class="card group p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div class="flex items-center gap-3">
                <span
                  class="grid size-10 place-items-center rounded-xl text-white"
                  [style.background-color]="s.color"
                >
                  <app-icon [name]="s.icon" />
                </span>
                <div class="min-w-0 flex-1">
                  <p
                    class="font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                  >
                    {{ s.title }}
                  </p>
                  <p class="text-sm text-slate-500">
                    {{ s.stats.done }}/{{ s.stats.total }} bài · {{ s.stats.percent }}%
                  </p>
                </div>
              </div>
              <ul class="mt-4 space-y-3">
                @for (sec of s.sections; track sec.id) {
                  <li>
                    <div class="mb-1 flex justify-between text-sm">
                      <span class="inline-flex items-center gap-1.5"
                        ><app-icon [name]="sec.icon" [size]="14" /> {{ sec.title }}</span
                      >
                      <span class="text-slate-500">{{ sec.stats.done }}/{{ sec.stats.total }}</span>
                    </div>
                    <app-progress-bar
                      [percent]="sec.stats.percent"
                      [color]="s.color"
                      [label]="'Tiến độ ' + sec.title"
                    />
                  </li>
                }
              </ul>
            </a>
          }
          <div
            class="card grid place-items-center border-dashed p-5 text-center text-sm text-slate-500"
          >
            <div>
              <p class="font-medium">Môn học tiếp theo</p>
              <p class="mt-1">
                Thêm thư mục mới trong <code>content/</code> là app tự hiện môn mới.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="updates-heading">
        <div class="flex items-baseline justify-between">
          <h2 id="updates-heading" class="section-heading">
            Frontend mới
            @if (updatesRead.unread() > 0) {
              <span
                class="ml-2 rounded-full bg-rose-500 px-2 py-0.5 align-middle text-xs font-semibold text-white"
                >{{ updatesRead.unread() }} mới</span
              >
            }
          </h2>
          <a
            routerLink="/updates"
            class="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >Xem tất cả</a
          >
        </div>
        <div class="card p-1">
          @for (u of latestUpdates(); track u.id) {
            <a
              [routerLink]="['/updates', u.id]"
              class="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            >
              <app-icon name="sparkles" [size]="18" class="mt-0.5 text-indigo-500" />
              <span class="min-w-0 flex-1">
                <span class="block font-medium">{{ u.title }}</span>
                <span class="block text-xs text-slate-500">{{ u.date | date: 'dd/MM/yyyy' }}</span>
              </span>
            </a>
          } @empty {
            <p class="px-4 py-6 text-sm text-slate-500">
              Chưa có bản tin nào. Bản tin kiến thức frontend mới sẽ được cập nhật tự động mỗi 2
              ngày.
            </p>
          }
        </div>
      </section>
    </div>
  `,
})
export class DashboardPage {
  private readonly content = inject(ContentService);
  private readonly progress = inject(ProgressService);

  protected readonly roadmapSubjects = computed(() =>
    this.content
      .subjects()
      .filter((s) => s.hasRoadmap)
      .map((s) => s.id),
  );
  protected readonly updatesRead = inject(UpdatesReadService);

  protected readonly subjectCards = computed(() => {
    const records = this.progress.records();
    return this.content.subjects().map((subject) => {
      const items = this.content.subjectIndex(subject.id)?.items ?? [];
      return {
        ...subject,
        stats: computeStats(items, records),
        sections: subject.sections.map((sec) => ({
          ...sec,
          stats: computeStats(
            items.filter((i) => i.section === sec.id),
            records,
          ),
        })),
      };
    });
  });

  protected readonly continueItems = computed(() =>
    this.progress
      .recent()
      .filter((r) => r.status === 'in-progress')
      .map((r) => this.content.findItem(r.key))
      .filter((i): i is ItemSummary => !!i)
      .slice(0, 4),
  );

  protected readonly latestUpdates = computed(() =>
    this.content.updates.hasValue() ? this.content.updates.value().updates.slice(0, 3) : [],
  );
}
