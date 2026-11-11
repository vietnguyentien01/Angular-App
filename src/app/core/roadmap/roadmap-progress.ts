import { Service, inject, signal } from '@angular/core';
import type { RoadmapStage } from '../content/content.models';
import { itemKey } from '../progress/progress.service';
import type { ProgressRecord } from '../storage/storage.service';
import { StorageService } from '../storage/storage.service';

export interface StageProgress {
  lessonsDone: number;
  lessonsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  /** Bài học và bài thực hành có trọng số như nhau. */
  percent: number;
  complete: boolean;
}

export const taskKey = (subject: string, stageId: string, index: number) =>
  `${subject}/${stageId}#${index}`;

export function computeStageProgress(
  subject: string,
  stage: Pick<RoadmapStage, 'id' | 'items' | 'practice'>,
  records: Readonly<Record<string, ProgressRecord>>,
  tasks: Readonly<Record<string, boolean>>,
): StageProgress {
  const lessonsDone = stage.items.filter((i) => records[itemKey(i)]?.status === 'done').length;
  const tasksDone = stage.practice.filter((_, i) => tasks[taskKey(subject, stage.id, i)]).length;
  const total = stage.items.length + stage.practice.length;
  const done = lessonsDone + tasksDone;
  return {
    lessonsDone,
    lessonsTotal: stage.items.length,
    tasksDone,
    tasksTotal: stage.practice.length,
    percent: total ? Math.round((done / total) * 100) : 0,
    complete: total > 0 && done === total,
  };
}

const KEY = 'roadmap.tasks';

/** Trạng thái các bài thực hành (checkbox) của lộ trình, lưu trong IndexedDB. */
@Service()
export class RoadmapTasksService {
  private readonly storage = inject(StorageService);
  private readonly _tasks = signal<Record<string, boolean>>({});
  private readonly ready = this.storage
    .get<Record<string, boolean>>('kv', KEY)
    .then((v) => this._tasks.set(v ?? {}));

  readonly tasks = this._tasks.asReadonly();

  async toggle(key: string): Promise<void> {
    await this.ready;
    this._tasks.update((t) => ({ ...t, [key]: !t[key] }));
    await this.storage.put('kv', this._tasks(), KEY);
  }
}
