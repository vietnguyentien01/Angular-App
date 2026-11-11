import { Service, inject } from '@angular/core';
import { ProgressService } from '../progress/progress.service';
import { DB_VERSION, type ProgressRecord, StorageService } from '../storage/storage.service';

export interface BackupFile {
  app: 'learning-hub';
  dbVersion: number;
  exportedAt: string;
  progress: ProgressRecord[];
  kv: [string, unknown][];
}

export function isBackupFile(data: unknown): data is BackupFile {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Partial<BackupFile>;
  return (
    d.app === 'learning-hub' &&
    typeof d.dbVersion === 'number' &&
    Array.isArray(d.progress) &&
    d.progress.every(
      (p) => typeof p?.key === 'string' && (p.status === 'done' || p.status === 'in-progress'),
    ) &&
    Array.isArray(d.kv)
  );
}

/** Sao lưu / khôi phục toàn bộ dữ liệu cá nhân ra file JSON. */
@Service()
export class BackupService {
  private readonly storage = inject(StorageService);
  private readonly progress = inject(ProgressService);

  async export(): Promise<BackupFile> {
    return {
      app: 'learning-hub',
      dbVersion: DB_VERSION,
      exportedAt: new Date().toISOString(),
      progress: await this.storage.getAll<ProgressRecord>('progress'),
      kv: await this.storage.entries('kv'),
    };
  }

  async import(data: unknown): Promise<void> {
    if (!isBackupFile(data)) throw new Error('File không đúng định dạng sao lưu của Learning Hub.');
    if (data.dbVersion > DB_VERSION)
      throw new Error('File sao lưu được tạo từ phiên bản app mới hơn.');
    await this.storage.clear('progress');
    await this.storage.clear('kv');
    for (const record of data.progress) await this.storage.put('progress', record);
    for (const [key, value] of data.kv) await this.storage.put('kv', value, key);
    await this.progress.reload();
  }

  async reset(): Promise<void> {
    await this.storage.clear('progress');
    await this.storage.clear('kv');
    await this.progress.reload();
  }
}
