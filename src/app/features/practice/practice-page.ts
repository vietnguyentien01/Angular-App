import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { QuizBank, QuizEntry } from '../../core/content/content.models';
import { ContentService, contentUrl } from '../../core/content/content.service';
import { QuizStatsService } from '../../core/quiz/quiz-stats.service';
import { Icon } from '../../shared/icon/icon';
import { PageState } from '../../shared/page-state/page-state';
import { QuizCard } from '../../shared/quiz/quiz-card';

type Mode = 'random' | 'wrong' | 'unseen';

export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Luyện tập: lấy câu hỏi từ toàn bộ bài học của một môn. */
@Component({
  selector: 'app-practice-page',
  imports: [RouterLink, FormsModule, Icon, PageState, QuizCard],
  template: `
    @if (bank.hasValue() && subjectInfo(); as subj) {
      <div class="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" class="text-sm text-slate-500">
          <a [routerLink]="['/', subj.id]" class="hover:underline">{{ subj.title }}</a>
          <span class="mx-1">/</span>
          <span aria-current="page">Luyện tập</span>
        </nav>
        <h1
          class="mt-2 inline-flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl"
        >
          <app-icon name="target" [size]="28" /> Luyện tập {{ subj.title }}
        </h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          {{ total() }} câu hỏi từ tất cả bài học. Kết quả được lưu lại để ôn những câu bạn từng làm
          sai.
        </p>

        @if (session().length === 0) {
          <section class="card mt-6 space-y-5 p-5" aria-labelledby="setup-heading">
            <h2 id="setup-heading" class="font-semibold">Tạo lượt luyện tập</h2>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="mb-1 block font-medium">Phần</span>
                <select class="field" [ngModel]="section()" (ngModelChange)="section.set($event)">
                  <option value="">Tất cả các phần</option>
                  @for (s of subj.sections; track s.id) {
                    <option [value]="s.id">{{ s.title }}</option>
                  }
                </select>
              </label>
              <label class="block text-sm">
                <span class="mb-1 block font-medium">Chủ đề</span>
                <select class="field" [ngModel]="topic()" (ngModelChange)="topic.set($event)">
                  <option value="">Tất cả chủ đề</option>
                  @for (t of topics(); track t.id) {
                    <option [value]="t.id">{{ t.title }}</option>
                  }
                </select>
              </label>
            </div>

            <div role="radiogroup" aria-label="Chế độ" class="grid gap-2 sm:grid-cols-3">
              @for (m of modes; track m.value) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="mode() === m.value"
                  (click)="mode.set(m.value)"
                  class="rounded-lg border p-3 text-left text-sm"
                  [class]="
                    mode() === m.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                  "
                >
                  <span class="block font-medium">{{ m.label }}</span>
                  <span class="text-xs text-slate-500">{{ m.count(this) }} câu</span>
                </button>
              }
            </div>

            <label class="block text-sm">
              <span class="mb-1 block font-medium">Số câu: {{ size() }}</span>
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                class="w-full accent-indigo-600"
                [ngModel]="size()"
                (ngModelChange)="size.set(+$event)"
              />
            </label>

            <button
              type="button"
              class="btn-primary"
              [disabled]="pool().length === 0"
              (click)="start()"
            >
              Bắt đầu ({{ min(size(), pool().length) }} câu)
            </button>
            @if (pool().length === 0) {
              <p class="text-sm text-slate-500" role="status">
                Không có câu hỏi nào khớp bộ lọc này.
              </p>
            }
          </section>
        } @else if (index() < session().length) {
          @let q = session()[index()];
          <div class="mt-6">
            <div class="mb-2 flex items-center justify-between text-sm text-slate-500">
              <span>Câu {{ index() + 1 }}/{{ session().length }}</span>
              <span>Đúng {{ correctCount() }}</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                class="h-full bg-indigo-500 transition-[width]"
                [style.width.%]="(index() / session().length) * 100"
              ></div>
            </div>
            <app-quiz-card
              [quiz]="q"
              [statKey]="q.subject + '/' + q.key"
              [label]="q.itemTitle"
              [retry]="false"
              (answered)="onAnswered($event)"
            />
            <div class="flex flex-wrap items-center justify-between gap-3">
              <a
                [routerLink]="['/', q.subject, q.section, q.topic, slugOf(q)]"
                class="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Mở bài “{{ q.itemTitle }}”
              </a>
              <button
                type="button"
                class="btn-primary"
                [disabled]="!answeredCurrent()"
                (click)="next()"
              >
                {{ index() + 1 === session().length ? 'Xem kết quả' : 'Câu tiếp' }}
              </button>
            </div>
          </div>
        } @else {
          <section class="card mt-6 p-6 text-center" aria-live="polite">
            <p
              class="text-5xl font-bold"
              [class]="
                score() >= 80
                  ? 'text-emerald-600'
                  : score() >= 50
                    ? 'text-amber-500'
                    : 'text-rose-600'
              "
            >
              {{ score() }}%
            </p>
            <p class="mt-2 font-medium">Đúng {{ correctCount() }}/{{ session().length }} câu</p>
            <p class="mt-1 text-sm text-slate-500">
              @if (score() === 100) {
                Xuất sắc! Thử chế độ khác hoặc phần nâng cao hơn.
              } @else {
                Các câu sai đã được lưu — chọn chế độ “Ôn câu đã sai” để làm lại.
              }
            </p>
            <div class="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" class="btn-primary" (click)="start()">Lượt mới</button>
              <button type="button" class="btn-secondary" (click)="session.set([])">
                Đổi bộ lọc
              </button>
            </div>
          </section>
        }
      </div>
    } @else {
      <app-page-state [loading]="bank.isLoading() || content.manifest.isLoading()" what="câu hỏi" />
    }
  `,
})
export class PracticePage {
  protected readonly content = inject(ContentService);
  private readonly stats = inject(QuizStatsService);

  readonly subject = input.required<string>();

  protected readonly bank = httpResource<QuizBank>(() => contentUrl.quizzes(this.subject()));
  protected readonly subjectInfo = computed(() =>
    this.content.subjects().find((s) => s.id === this.subject()),
  );
  protected readonly topics = computed(
    () => this.content.subjectIndex(this.subject())?.topics ?? [],
  );

  protected readonly section = signal('');
  protected readonly topic = signal('');
  protected readonly mode = signal<Mode>('random');
  protected readonly size = signal(10);

  protected readonly session = signal<QuizEntry[]>([]);
  protected readonly index = signal(0);
  protected readonly correctCount = signal(0);
  protected readonly answeredCurrent = signal(false);

  private readonly all = computed(() => (this.bank.hasValue() ? this.bank.value().quizzes : []));
  protected readonly total = computed(() => this.all().length);

  private readonly filtered = computed(() =>
    this.all().filter(
      (q) =>
        (!this.section() || q.section === this.section()) &&
        (!this.topic() || q.topic === this.topic()),
    ),
  );
  private statKey = (q: QuizEntry) => `${q.subject}/${q.key}`;
  private readonly wrongPool = computed(() =>
    this.filtered().filter((q) => this.stats.wrongKeys().has(this.statKey(q))),
  );
  private readonly unseenPool = computed(() =>
    this.filtered().filter((q) => !this.stats.stats()[this.statKey(q)]),
  );

  protected readonly pool = computed(() =>
    this.mode() === 'wrong'
      ? this.wrongPool()
      : this.mode() === 'unseen'
        ? this.unseenPool()
        : this.filtered(),
  );
  protected readonly score = computed(() =>
    this.session().length ? Math.round((this.correctCount() / this.session().length) * 100) : 0,
  );

  protected readonly modes: { value: Mode; label: string; count: (p: PracticePage) => number }[] = [
    { value: 'random', label: 'Ngẫu nhiên', count: (p) => p.filtered().length },
    { value: 'unseen', label: 'Câu chưa làm', count: (p) => p.unseenPool().length },
    { value: 'wrong', label: 'Ôn câu đã sai', count: (p) => p.wrongPool().length },
  ];

  protected readonly min = Math.min;

  protected start(): void {
    this.session.set(shuffle(this.pool()).slice(0, this.size()));
    this.index.set(0);
    this.correctCount.set(0);
    this.answeredCurrent.set(false);
  }

  protected onAnswered(correct: boolean): void {
    this.answeredCurrent.set(true);
    if (correct) this.correctCount.update((n) => n + 1);
  }

  protected next(): void {
    this.index.update((i) => i + 1);
    this.answeredCurrent.set(false);
  }

  protected slugOf(q: QuizEntry): string {
    return q.itemId.split('/').at(-1) ?? '';
  }
}
