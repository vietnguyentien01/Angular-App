import { Service, computed, inject, signal } from '@angular/core';
import type { ItemSummary } from '../content/content.models';
import {
  type ProgressRecord,
  type ProgressStatus,
  StorageService,
} from '../storage/storage.service';

export interface ProgressStats {
  done: number;
  inProgress: number;
  total: number;
  percent: number;
}

export const itemKey = (item: Pick<ItemSummary, 'subject' | 'id'>) => `${item.subject}/${item.id}`;

export function computeStats(
  items: readonly ItemSummary[],
  records: Readonly<Record<string, ProgressRecord>>,
): ProgressStats {
  let done = 0;
  let inProgress = 0;
  for (const item of items) {
    const status = records[itemKey(item)]?.status;
    if (status === 'done') done++;
    else if (status === 'in-progress') inProgress++;
  }
  const total = items.length;
  return { done, inProgress, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** Tiến độ học: trạng thái từng bài, lưu trong IndexedDB. */
@Service()
export class ProgressService {
  private readonly storage = inject(StorageService);
  private readonly _records = signal<Record<string, ProgressRecord>>({});
  private readonly _loaded = signal(false);

  readonly records = this._records.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /** Các bài mở gần đây, mới nhất trước. */
  readonly recent = computed(() =>
    Object.values(this._records())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6),
  );

  /** Mọi thao tác ghi đều chờ dữ liệu cũ được tải xong, tránh ghi đè trạng thái đã lưu. */
  private ready: Promise<void> = this.reload();

  async reload(): Promise<void> {
    this.ready = this.load();
    await this.ready;
  }

  private async load(): Promise<void> {
    const all = await this.storage.getAll<ProgressRecord>('progress');
    this._records.set(Object.fromEntries(all.map((r) => [r.key, r])));
    this._loaded.set(true);
  }

  status(item: Pick<ItemSummary, 'subject' | 'id'>): ProgressStatus | undefined {
    return this._records()[itemKey(item)]?.status;
  }

  stats(items: readonly ItemSummary[]): ProgressStats {
    return computeStats(items, this._records());
  }

  /** Khi mở một bài: đánh dấu "đang học" nếu chưa có trạng thái. */
  async markOpened(item: Pick<ItemSummary, 'subject' | 'id'>): Promise<void> {
    await this.ready;
    const current = this._records()[itemKey(item)];
    await this.write(itemKey(item), current?.status ?? 'in-progress');
  }

  async setStatus(
    item: Pick<ItemSummary, 'subject' | 'id'>,
    status: ProgressStatus,
  ): Promise<void> {
    await this.write(itemKey(item), status);
  }

  async toggleDone(item: Pick<ItemSummary, 'subject' | 'id'>): Promise<void> {
    await this.ready;
    await this.setStatus(item, this.status(item) === 'done' ? 'in-progress' : 'done');
  }

  private async write(key: string, status: ProgressStatus): Promise<void> {
    await this.ready;
    const record: ProgressRecord = { key, status, updatedAt: new Date().toISOString() };
    this._records.update((r) => ({ ...r, [key]: record }));
    await this.storage.put('progress', record);
  }
}
