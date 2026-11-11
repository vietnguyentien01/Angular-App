import { Service, computed, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';

export interface QuizStat {
  correct: number;
  wrong: number;
  /** Kết quả lần làm gần nhất. */
  last: 'correct' | 'wrong';
  at: string;
}

const KEY = 'quiz.stats';

/**
 * Kết quả làm trắc nghiệm, khoá theo `${subject}/${itemId}#${quizId}`.
 * Dùng để hiện điểm và tạo chế độ "ôn lại câu đã sai".
 */
@Service()
export class QuizStatsService {
  private readonly storage = inject(StorageService);
  private readonly _stats = signal<Record<string, QuizStat>>({});
  private readonly ready = this.storage
    .get<Record<string, QuizStat>>('kv', KEY)
    .then((v) => this._stats.set(v ?? {}));

  readonly stats = this._stats.asReadonly();

  /** Các câu mà lần làm gần nhất bị sai. */
  readonly wrongKeys = computed(
    () =>
      new Set(
        Object.entries(this._stats())
          .filter(([, s]) => s.last === 'wrong')
          .map(([k]) => k),
      ),
  );

  get(key: string): QuizStat | undefined {
    return this._stats()[key];
  }

  async record(key: string, correct: boolean): Promise<void> {
    await this.ready;
    const prev = this._stats()[key];
    const next: QuizStat = {
      correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
      wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
      last: correct ? 'correct' : 'wrong',
      at: new Date().toISOString(),
    };
    this._stats.update((s) => ({ ...s, [key]: next }));
    await this.storage.put('kv', this._stats(), KEY);
  }
}
