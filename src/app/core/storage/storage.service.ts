import { Service } from '@angular/core';
import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

export type ProgressStatus = 'in-progress' | 'done';

export interface ProgressRecord {
  /** `${subject}/${itemId}` */
  key: string;
  status: ProgressStatus;
  updatedAt: string;
}

interface HubDB extends DBSchema {
  progress: { key: string; value: ProgressRecord; indexes: { byUpdatedAt: string } };
  kv: { key: string; value: unknown };
}

export type StoreName = 'progress' | 'kv';

const DB_NAME = 'learning-hub';
/**
 * Tăng số này khi thay đổi cấu trúc DB và thêm một nhánh migration trong `upgrade`.
 * Dữ liệu cũ của người dùng phải được giữ lại qua mọi lần nâng cấp.
 */
export const DB_VERSION = 1;

/**
 * Lưu trữ dữ liệu cá nhân trong IndexedDB.
 * Nếu trình duyệt không cho dùng IndexedDB (chế độ riêng tư, môi trường test),
 * tự chuyển sang bộ nhớ tạm để app vẫn chạy được.
 */
@Service()
export class StorageService {
  private readonly db: Promise<IDBPDatabase<HubDB> | undefined> = this.open();
  private readonly memory = {
    progress: new Map<string, unknown>(),
    kv: new Map<string, unknown>(),
  };

  /** true nếu dữ liệu chỉ nằm trong bộ nhớ (sẽ mất khi tải lại trang). */
  readonly volatile = this.db.then((db) => !db);

  private async open(): Promise<IDBPDatabase<HubDB> | undefined> {
    if (typeof indexedDB === 'undefined') return undefined;
    try {
      return await openDB<HubDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
          // Mỗi case là một bước migration, chạy nối tiếp (không có `break`).
          switch (oldVersion) {
            case 0: {
              const progress = db.createObjectStore('progress', { keyPath: 'key' });
              progress.createIndex('byUpdatedAt', 'updatedAt');
              db.createObjectStore('kv');
            }
          }
        },
      });
    } catch {
      return undefined;
    }
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.db;
    if (!db) return [...this.memory[store].values()] as T[];
    return (await db.getAll(store)) as T[];
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.db;
    if (!db) return this.memory[store].get(key) as T | undefined;
    return (await db.get(store, key)) as T | undefined;
  }

  async put(store: 'progress', value: ProgressRecord): Promise<void>;
  async put(store: 'kv', value: unknown, key: string): Promise<void>;
  async put(store: StoreName, value: unknown, key?: string): Promise<void> {
    const db = await this.db;
    if (!db) {
      this.memory[store].set(key ?? (value as ProgressRecord).key, value);
      return;
    }
    if (store === 'progress') await db.put('progress', value as ProgressRecord);
    else await db.put('kv', value, key);
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.db;
    if (!db) {
      this.memory[store].delete(key);
      return;
    }
    await db.delete(store, key);
  }

  async entries(store: 'kv'): Promise<[string, unknown][]> {
    const db = await this.db;
    if (!db) return [...this.memory.kv.entries()];
    const tx = db.transaction('kv');
    const keys = await tx.store.getAllKeys();
    const values = await tx.store.getAll();
    await tx.done;
    return keys.map((k, i) => [String(k), values[i]]);
  }

  async clear(store: StoreName): Promise<void> {
    const db = await this.db;
    if (!db) {
      this.memory[store].clear();
      return;
    }
    await db.clear(store);
  }
}
