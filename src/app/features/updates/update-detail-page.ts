import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import type { UpdateDetail } from '../../core/content/content.models';
import { ContentService, contentUrl } from '../../core/content/content.service';
import { ContentBlocks } from '../../shared/content/content-blocks';
import { Icon } from '../../shared/icon/icon';
import { PageState } from '../../shared/page-state/page-state';
import { IMPORTANCE } from './updates-page';

@Component({
  selector: 'app-update-detail-page',
  imports: [RouterLink, DatePipe, Icon, ContentBlocks, PageState],
  template: `
    @if (detail.hasValue()) {
      @let u = detail.value();
      <article class="mx-auto max-w-3xl">
        <a
          routerLink="/updates"
          class="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
        >
          <app-icon name="chevron-left" [size]="14" /> Frontend mới
        </a>
        <header class="mt-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="font-mono text-slate-500">{{ u.date | date: 'dd/MM/yyyy' }}</span>
            <span
              class="rounded-full px-2 py-0.5 font-medium"
              [class]="importance[u.importance].cls"
              >{{ importance[u.importance].label }}</span
            >
          </div>
          <h1 class="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{{ u.title }}</h1>
          <p class="mt-2 text-lg text-slate-600 dark:text-slate-400">{{ u.summary }}</p>
        </header>

        <app-content-blocks class="mt-8" [blocks]="u.blocks" />

        @if (relatedTopics().length) {
          <section class="mt-10" aria-labelledby="rt-heading">
            <h2 id="rt-heading" class="section-heading">Chủ đề liên quan trong app</h2>
            <ul class="flex flex-wrap gap-2">
              @for (t of relatedTopics(); track t.key) {
                <li>
                  <a
                    [routerLink]="['/', t.subject, t.section]"
                    [fragment]="t.topic"
                    class="badge hover:underline"
                    >{{ t.label }}</a
                  >
                </li>
              }
            </ul>
          </section>
        }

        <section
          class="mt-10 rounded-lg bg-slate-50 p-4 dark:bg-slate-900"
          aria-labelledby="src-heading"
        >
          <h2 id="src-heading" class="font-semibold">Nguồn</h2>
          <ul class="mt-2 space-y-1 text-sm">
            @for (s of u.sources; track s.url) {
              <li>
                <a
                  [href]="s.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {{ s.title }} <app-icon name="external" [size]="12" />
                </a>
              </li>
            }
          </ul>
        </section>
      </article>
    } @else {
      <app-page-state [loading]="detail.isLoading()" what="bản tin" />
    }
  `,
})
export class UpdateDetailPage {
  private readonly content = inject(ContentService);
  private readonly title = inject(Title);
  protected readonly importance = IMPORTANCE;

  readonly id = input.required<string>();
  protected readonly detail = httpResource<UpdateDetail>(() => contentUrl.update(this.id()));

  protected readonly relatedTopics = computed(() => {
    if (!this.detail.hasValue()) return [];
    return this.detail.value().relatedTopics.map((key) => {
      const [subject, topic] = key.split('/');
      const index = this.content.subjectIndex(subject);
      const first = index?.items.find((i) => i.topic === topic);
      const topicTitle = index?.topics.find((t) => t.id === topic)?.title ?? topic;
      return {
        key,
        subject,
        topic,
        section: first?.section ?? index?.subject.sections[0]?.id ?? '',
        label: `${index?.subject.title ?? subject} › ${topicTitle}`,
      };
    });
  });

  constructor() {
    effect(() => {
      if (this.detail.hasValue())
        this.title.setTitle(`${this.detail.value().title} · Learning Hub`);
    });
  }
}
