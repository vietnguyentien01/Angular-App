import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import type { QuizBlock } from '../../core/content/content.models';
import { QuizStatsService } from '../../core/quiz/quiz-stats.service';
import { TrustedContentHtmlPipe } from '../content/trusted-html.pipe';
import { Icon } from '../icon/icon';

type QuizData = Pick<QuizBlock, 'id' | 'question' | 'options' | 'explanation' | 'multiple'>;

/** Một câu trắc nghiệm tương tác: chọn đáp án → kiểm tra → xem giải thích. */
@Component({
  selector: 'app-quiz-card',
  imports: [TrustedContentHtmlPipe, Icon],
  host: { class: 'not-prose my-6 block' },
  template: `
    <section
      class="quiz rounded-xl border bg-white p-4 sm:p-5 dark:bg-slate-900"
      [class]="
        !submitted()
          ? 'border-sky-200 dark:border-sky-900'
          : isCorrect()
            ? 'border-emerald-400 dark:border-emerald-700'
            : 'border-rose-400 dark:border-rose-700'
      "
      [attr.aria-label]="'Câu hỏi trắc nghiệm' + (label() ? ' ' + label() : '')"
    >
      <div class="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span class="rounded bg-sky-600 px-1.5 py-0.5 font-semibold text-white">Trắc nghiệm</span>
        @if (label()) {
          <span class="text-slate-500">{{ label() }}</span>
        }
        @if (quiz().multiple) {
          <span class="text-slate-500">· Chọn tất cả đáp án đúng</span>
        }
        @if (stat(); as s) {
          <span class="ml-auto text-slate-500" title="Số lần đúng / sai trước đây"
            >✓ {{ s.correct }} · ✗ {{ s.wrong }}</span
          >
        }
      </div>

      <div class="content-prose quiz-body" [innerHTML]="quiz().question | trustedContentHtml"></div>

      <fieldset class="mt-3 space-y-2" [disabled]="submitted()">
        <legend class="sr-only">Đáp án</legend>
        @for (opt of quiz().options; track $index; let i = $index) {
          <label
            class="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors"
            [class]="optionClass(i)"
          >
            <input
              [type]="quiz().multiple ? 'checkbox' : 'radio'"
              [name]="groupName()"
              class="mt-0.5 size-4 accent-sky-600"
              [checked]="selected().has(i)"
              (change)="toggle(i)"
            />
            <span
              class="quiz-option min-w-0 flex-1"
              [innerHTML]="opt.html | trustedContentHtml"
            ></span>
            @if (submitted() && opt.correct) {
              <app-icon name="check" [size]="18" class="text-emerald-600" />
            }
          </label>
        }
      </fieldset>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        @if (!submitted()) {
          <button
            type="button"
            class="btn-primary"
            [disabled]="selected().size === 0"
            (click)="submit()"
          >
            Kiểm tra
          </button>
        } @else {
          <p
            class="text-sm font-semibold"
            [class]="isCorrect() ? 'text-emerald-600' : 'text-rose-600'"
            role="status"
          >
            {{ isCorrect() ? 'Chính xác!' : 'Chưa đúng — xem đáp án được đánh dấu ✓' }}
          </p>
          @if (retry()) {
            <button type="button" class="btn-secondary" (click)="reset()">Làm lại</button>
          }
        }
      </div>

      @if (submitted() && quiz().explanation) {
        <div class="content-prose mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <p class="!mt-0 font-semibold">Giải thích</p>
          <div [innerHTML]="quiz().explanation | trustedContentHtml"></div>
        </div>
      }
    </section>
  `,
})
export class QuizCard {
  private readonly stats = inject(QuizStatsService);

  readonly quiz = input.required<QuizData>();
  /** Khoá lưu kết quả: `${subject}/${itemId}#${quizId}`. */
  readonly statKey = input.required<string>();
  readonly label = input('');
  readonly retry = input(true);
  readonly answered = output<boolean>();

  /** Reset lựa chọn mỗi khi chuyển sang câu hỏi khác. */
  protected readonly selected = linkedSignal<string, Set<number>>({
    source: () => this.statKey(),
    computation: () => new Set<number>(),
  });
  protected readonly submitted = linkedSignal({
    source: () => this.statKey(),
    computation: () => false,
  });

  protected readonly groupName = computed(() => `quiz-${this.statKey()}`);
  protected readonly stat = computed(() => this.stats.stats()[this.statKey()]);
  protected readonly isCorrect = computed(() => {
    const sel = this.selected();
    return this.quiz().options.every((o, i) => o.correct === sel.has(i));
  });

  protected toggle(i: number): void {
    this.selected.update((prev) => {
      if (!this.quiz().multiple) return new Set([i]);
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    const ok = this.isCorrect();
    void this.stats.record(this.statKey(), ok);
    this.answered.emit(ok);
  }

  protected reset(): void {
    this.selected.set(new Set());
    this.submitted.set(false);
  }

  protected optionClass(i: number): string {
    const opt = this.quiz().options[i];
    const chosen = this.selected().has(i);
    if (!this.submitted()) {
      return chosen
        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60';
    }
    if (opt.correct) return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40';
    if (chosen) return 'border-rose-500 bg-rose-50 dark:bg-rose-950/40';
    return 'border-slate-200 opacity-70 dark:border-slate-700';
  }
}
