import { Service, computed, inject, signal } from '@angular/core';
import { ContentService } from '../content/content.service';
import { StorageService } from '../storage/storage.service';

const KEY = 'updates.lastSeen';

/** Theo dõi bản tin "Tin tức mới" đã đọc tới đâu. */
@Service()
export class UpdatesReadService {
  private readonly storage = inject(StorageService);
  private readonly content = inject(ContentService);
  private readonly lastSeen = signal<string>('');

  readonly unread = computed(() => {
    const seen = this.lastSeen();
    const list = this.content.updates.hasValue() ? this.content.updates.value().updates : [];
    return list.filter((u) => u.id > seen).length;
  });

  constructor() {
    void this.reload();
  }

  /** Đọc lại từ IndexedDB (sau khi nhập sao lưu hoặc đồng bộ). */
  async reload(): Promise<void> {
    this.lastSeen.set((await this.storage.get<string>('kv', KEY)) ?? '');
  }

  isUnread(id: string): boolean {
    return id > this.lastSeen();
  }

  async markAllSeen(): Promise<void> {
    const list = this.content.updates.hasValue() ? this.content.updates.value().updates : [];
    const newest = list[0]?.id;
    if (!newest || newest <= this.lastSeen()) return;
    this.lastSeen.set(newest);
    await this.storage.put('kv', newest, KEY);
  }
}
