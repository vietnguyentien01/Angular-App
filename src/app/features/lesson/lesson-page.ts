import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import type { ItemDetail, ItemSummary } from '../../core/content/content.models';
import { ContentService, contentUrl } from '../../core/content/content.service';
import { staleReason } from '../../core/content/staleness';
import { ProgressService } from '../../core/progress/progress.service';
import { ContentBlocks } from '../../shared/content/content-blocks';
import { Icon } from '../../shared/icon/icon';
import { LEVEL_LABEL, TYPE_LABEL, itemRoute } from '../../shared/item-link/item-row';
import { PageState } from '../../shared/page-state/page-state';

@Component({
  selector: 'app-lesson-page',
  imports: [RouterLink, DatePipe, Icon, ContentBlocks, PageState],
  template: `
    @if (detail.hasValue() && ctx(); as c) {
      @let item = detail.value();
      <div class="mx-auto flex max-w-6xl gap-10">
        <article class="min-w-0 max-w-3xl flex-1">
          <nav
            aria-label="Breadcrumb"
            class="flex flex-wrap items-center gap-1 text-sm text-slate-500"
          >
            <a [routerLink]="['/', c.subject.id]" class="hover:underline">{{ c.subject.title }}</a>
            <app-icon name="chevron-right" [size]="14" />
            <a [routerLink]="['/', c.subject.id, c.section.id]" class="hover:underline">{{
              c.section.title
            }}</a>
            <app-icon name="chevron-right" [size]="14" />
            <a
              [routerLink]="['/', c.subject.id, c.section.id]"
              [fragment]="item.topic"
              class="hover:underline"
              >{{ c.topicTitle }}</a
            >
          </nav>

          <header class="mt-4 border-b border-slate-200 pb-6 dark:border-slate-800">
            <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ item.title }}</h1>
            <p class="mt-2 text-lg text-slate-600 dark:text-slate-400">{{ item.summary }}</p>
            <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
              <span class="badge">{{ typeLabel(item.type) }}</span>
              <span>{{ levelLabel(item.level) }}</span>
              <span class="inline-flex items-center gap-1"
                ><app-icon name="clock" [size]="14" /> {{ item.minutes }} phút</span
              >
              @if (item.quizCount) {
                <span>{{ item.quizCount }} câu trắc nghiệm</span>
              }
              @if (item.version) {
                <span>Angular v{{ item.version }}</span>
              }
              <span>Xem lại: {{ item.lastReviewed | date: 'dd/MM/yyyy' }}</span>
            </div>
          </header>

          @if (stale(); as s) {
            <div
              class="mt-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              role="note"
            >
              <app-icon name="alert" [size]="18" />
              <p>
                @if (s.kind === 'version') {
                  Bài này viết cho v{{ s.itemVersion }}, bản hiện tại là v{{ s.currentVersion }}.
                  Một số chi tiết có thể đã thay đổi.
                } @else {
                  Bài này đã {{ s.days }} ngày chưa được xem lại — có thể đã cũ.
                }
              </p>
            </div>
          }

          <app-content-blocks
            class="mt-8"
            [blocks]="item.blocks"
            [keyPrefix]="item.subject + '/' + item.id"
          />

          @if (item.changelog.length) {
            <section
              class="mt-10 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900"
              aria-labelledby="changelog-heading"
            >
              <h2 id="changelog-heading" class="font-semibold">Lịch sử cập nhật</h2>
              <ul class="mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                @for (log of item.changelog; track $index) {
                  <li>
                    <span class="font-mono text-xs">{{ log.date }}</span> — {{ log.note }}
                  </li>
                }
              </ul>
            </section>
          }

          <div
            class="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-800"
          >
            <button
              type="button"
              (click)="toggleDone()"
              [class]="done() ? 'btn-success' : 'btn-primary'"
              [attr.aria-pressed]="done()"
            >
              <app-icon [name]="done() ? 'check-circle' : 'check'" [size]="18" />
              {{ done() ? 'Đã học xong' : 'Đánh dấu đã học' }}
            </button>
          </div>

          <nav class="mt-8 grid gap-3 sm:grid-cols-2" aria-label="Bài trước và bài sau">
            @if (c.prev; as p) {
              <a [routerLink]="route(p)" class="card p-4 hover:shadow-md">
                <span class="inline-flex items-center gap-1 text-xs text-slate-500"
                  ><app-icon name="chevron-left" [size]="14" /> Bài trước</span
                >
                <span class="mt-1 block font-medium">{{ p.title }}</span>
              </a>
            } @else {
              <span></span>
            }
            @if (c.next; as n) {
              <a [routerLink]="route(n)" class="card p-4 text-right hover:shadow-md">
                <span class="inline-flex items-center gap-1 text-xs text-slate-500"
                  >Bài sau <app-icon name="chevron-right" [size]="14"
                /></span>
                <span class="mt-1 block font-medium">{{ n.title }}</span>
              </a>
            }
          </nav>

          @if (related().length) {
            <section class="mt-10" aria-labelledby="related-heading">
              <h2 id="related-heading" class="section-heading">Liên quan (các tầng khác)</h2>
              <ul class="grid gap-3 sm:grid-cols-2">
                @for (r of related(); track r.id) {
                  <li>
                    <a [routerLink]="route(r)" class="card block p-4 hover:shadow-md">
                      <span class="text-xs text-slate-500">{{ sectionTitle(r) }}</span>
                      <span class="mt-1 block font-medium">{{ r.title }}</span>
                    </a>
                  </li>
                }
              </ul>
            </section>
          }
        </article>

        @if (item.toc.length > 1) {
          <aside class="sticky top-24 hidden h-fit w-56 shrink-0 xl:block" aria-label="Mục lục">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Trong bài này
            </p>
            <ul class="mt-3 space-y-2 border-l border-slate-200 text-sm dark:border-slate-800">
              @for (t of item.toc; track t.id) {
                <li [class.pl-3]="t.depth === 2" [class.pl-6]="t.depth === 3">
                  <a
                    [routerLink]="[]"
                    [fragment]="t.id"
                    class="text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                    >{{ t.text }}</a
                  >
                </li>
              }
            </ul>
          </aside>
        }
      </div>
    } @else {
      <app-page-state
        [loading]="detail.isLoading() || content.indexes.isLoading()"
        what="bài học"
      />
    }
  `,
})
export class LessonPage {
  protected readonly content = inject(ContentService);
  private readonly progress = inject(ProgressService);
  private readonly title = inject(Title);

  readonly subject = input.required<string>();
  readonly section = input.required<string>();
  readonly topic = input.required<string>();
  readonly slug = input.required<string>();

  private readonly itemId = computed(() => `${this.section()}/${this.topic()}/${this.slug()}`);
  protected readonly detail = httpResource<ItemDetail>(() =>
    contentUrl.item(this.subject(), this.itemId()),
  );

  private readonly index = computed(() => this.content.subjectIndex(this.subject()));

  protected readonly ctx = computed(() => {
    const index = this.index();
    const section = index?.subject.sections.find((s) => s.id === this.section());
    if (!index || !section) return undefined;
    const siblings = index.items.filter((i) => i.section === section.id);
    const pos = siblings.findIndex((i) => i.id === this.itemId());
    return {
      subject: index.subject,
      section,
      topicTitle: index.topics.find((t) => t.id === this.topic())?.title ?? this.topic(),
      prev: pos > 0 ? siblings[pos - 1] : undefined,
      next: pos >= 0 && pos < siblings.length - 1 ? siblings[pos + 1] : undefined,
    };
  });

  protected readonly related = computed(() =>
    this.detail.hasValue()
      ? this.detail
          .value()
          .related.map((key) => this.content.findItem(key))
          .filter((i): i is ItemSummary => !!i)
      : [],
  );

  protected readonly stale = computed(() =>
    this.detail.hasValue()
      ? staleReason(this.detail.value(), this.index()?.subject, new Date())
      : undefined,
  );

  protected readonly done = computed(
    () => this.progress.status({ subject: this.subject(), id: this.itemId() }) === 'done',
  );

  constructor() {
    // Side effect: cập nhật tiêu đề tab và ghi nhận bài vừa mở.
    effect(() => {
      if (!this.detail.hasValue()) return;
      const item = this.detail.value();
      this.title.setTitle(`${item.title} · Learning Hub`);
      untracked(() => void this.progress.markOpened(item));
    });
  }

  protected toggleDone(): void {
    void this.progress.toggleDone({ subject: this.subject(), id: this.itemId() });
  }

  protected route = itemRoute;
  protected typeLabel = (t: ItemSummary['type']) => TYPE_LABEL[t];
  protected levelLabel = (l: ItemSummary['level']) => LEVEL_LABEL[l];
  protected sectionTitle(item: ItemSummary): string {
    const index = this.content.subjectIndex(item.subject);
    const sec = index?.subject.sections.find((s) => s.id === item.section)?.title ?? item.section;
    return `${index?.subject.title ?? item.subject} · ${sec}`;
  }
}
