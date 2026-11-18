import { DestroyRef, Service, effect, inject, signal, untracked } from '@angular/core';
import { ProgressService } from '../progress/progress.service';
import type { QuizStat } from '../quiz/quiz-stats.service';
import { QuizStatsService } from '../quiz/quiz-stats.service';
import { RoadmapTasksService } from '../roadmap/roadmap-progress';
import { type ProgressRecord, StorageService } from '../storage/storage.service';
import { UpdatesReadService } from '../updates/updates-read.service';
import { GistClient, GistError } from './gist-client';
import {
  type SyncSnapshot,
  emptySnapshot,
  mergeSnapshots,
  parseSnapshot,
  sameContent,
} from './sync-merge';

/**
 * Cấu hình đồng bộ nằm trong localStorage của thiết bị này, KHÔNG nằm trong IndexedDB:
 * token không bao giờ bị đưa vào file sao lưu hay vào chính Gist.
 */
const CONFIG_KEY = 'learning-hub.sync';
/** Chờ sau thay đổi cuối cùng rồi mới đẩy lên, để gom nhiều thao tác thành một lần ghi. */
const PUSH_DELAY_MS = 4000;
/** Kéo dữ liệu từ thiết bị khác định kỳ khi tab đang mở. */
const PULL_EVERY_MS = 5 * 60 * 1000;

interface SyncConfig {
  token: string;
  gistId: string;
  lastSyncAt?: string;
}

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

function readConfig(): SyncConfig | undefined {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return undefined;
    const c = JSON.parse(raw) as Partial<SyncConfig>;
    return typeof c.token === 'string' && typeof c.gistId === 'string'
      ? { token: c.token, gistId: c.gistId, lastSyncAt: c.lastSyncAt }
      : undefined;
  } catch {
    return undefined;
  }
}

function writeConfig(c: SyncConfig | undefined): void {
  try {
    if (c) localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    // localStorage bị chặn: đồng bộ chỉ sống trong phiên này.
  }
}

/** Đồng bộ tiến độ học giữa các thiết bị qua một GitHub Gist bí mật của người dùng. */
@Service()
export class SyncService {
  private readonly storage = inject(StorageService);
  private readonly progress = inject(ProgressService);
  private readonly quiz = inject(QuizStatsService);
  private readonly roadmap = inject(RoadmapTasksService);
  private readonly updatesRead = inject(UpdatesReadService);

  private config = readConfig();
  private running: Promise<void> | undefined;
  private again = false;
  private pushTimer: ReturnType<typeof setTimeout> | undefined;

  readonly state = signal<SyncState>(this.config ? 'idle' : 'off');
  readonly lastSyncAt = signal<string | undefined>(this.config?.lastSyncAt);
  readonly error = signal<string | undefined>(undefined);
  readonly gistUrl = signal<string | undefined>(
    this.config ? `https://gist.github.com/${this.config.gistId}` : undefined,
  );

  /** Bật các cơ chế tự đồng bộ. Gọi một lần khi app khởi động. */
  start(): void {
    const destroyRef = inject(DestroyRef);
    let firstRun = true;
    effect(() => {
      this.storage.writes();
      if (firstRun) {
        firstRun = false;
        return;
      }
      untracked(() => this.schedulePush());
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible') void this.syncNow();
      else if (this.pushTimer) {
        clearTimeout(this.pushTimer);
        this.pushTimer = undefined;
        void this.syncNow(); // rời tab: đẩy ngay thay đổi còn chờ
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.syncNow();
    }, PULL_EVERY_MS);
    destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    });

    void this.syncNow();
  }

  /** Kết nối bằng token: tìm Gist đồng bộ cũ (từ thiết bị khác) hoặc tạo mới, rồi đồng bộ ngay. */
  async connect(token: string): Promise<void> {
    const clean = token.trim();
    if (!clean) throw new Error('Hãy dán token GitHub.');
    this.state.set('syncing');
    this.error.set(undefined);
    try {
      const client = new GistClient(clean);
      const gistId =
        (await client.find()) ??
        (await client.create(JSON.stringify(await this.localSnapshot(), null, 2)));
      this.config = { token: clean, gistId };
      writeConfig(this.config);
      this.gistUrl.set(`https://gist.github.com/${gistId}`);
      this.state.set('idle');
    } catch (e) {
      this.state.set(this.config ? 'error' : 'off');
      throw e;
    }
    await this.syncNow();
  }

  /** Tắt đồng bộ trên thiết bị này. Dữ liệu local và Gist đều được giữ nguyên. */
  disconnect(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.config = undefined;
    writeConfig(undefined);
    this.state.set('off');
    this.error.set(undefined);
    this.gistUrl.set(undefined);
  }

  /** Đồng bộ một lần; gọi chồng nhau thì gộp thành một lần chạy tiếp theo. */
  syncNow(): Promise<void> {
    if (!this.config) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = undefined;
      if (this.again) {
        this.again = false;
        void this.syncNow();
      }
    });
    return this.running;
  }

  private schedulePush(): void {
    if (!this.config) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = undefined;
      void this.syncNow();
    }, PUSH_DELAY_MS);
  }

  private async run(): Promise<void> {
    const config = this.config;
    if (!config) return;
    this.state.set('syncing');
    try {
      const client = new GistClient(config.token);
      const raw = await client.read(config.gistId);
      let remote: SyncSnapshot;
      try {
        remote = raw ? parseSnapshot(JSON.parse(raw)) : emptySnapshot();
      } catch {
        remote = emptySnapshot(); // file bị sửa hỏng: ghi đè bằng bản gộp từ máy này
      }
      const local = await this.localSnapshot();
      const merged = mergeSnapshots(local, remote);
      if (!sameContent(merged, local)) await this.apply(merged);
      if (!raw || !sameContent(merged, remote)) {
        // Đọc lại sau khi áp: thay đổi người dùng làm trong lúc đồng bộ cũng được gộp vào.
        const toPush = mergeSnapshots(await this.localSnapshot(), merged);
        toPush.updatedAt = new Date().toISOString();
        await client.write(config.gistId, JSON.stringify(toPush, null, 2));
      }
      const now = new Date().toISOString();
      this.config = { ...config, lastSyncAt: now };
      writeConfig(this.config);
      this.lastSyncAt.set(now);
      this.error.set(undefined);
      this.state.set('idle');
    } catch (e) {
      this.error.set(e instanceof GistError ? e.message : 'Đồng bộ thất bại.');
      this.state.set('error');
    }
  }

  private async localSnapshot(): Promise<SyncSnapshot> {
    const records = await this.storage.getAll<ProgressRecord>('progress');
    return {
      ...emptySnapshot(),
      updatedAt: records.reduce((m, r) => (r.updatedAt > m ? r.updatedAt : m), ''),
      progress: Object.fromEntries(records.map((r) => [r.key, r])),
      quizStats: (await this.storage.get<Record<string, QuizStat>>('kv', 'quiz.stats')) ?? {},
      roadmapTasks: (await this.storage.get<Record<string, boolean>>('kv', 'roadmap.tasks')) ?? {},
      roadmapTasksAt:
        (await this.storage.get<Record<string, string>>('kv', 'roadmap.tasksAt')) ?? {},
      updatesLastSeen: (await this.storage.get<string>('kv', 'updates.lastSeen')) ?? '',
    };
  }

  /** Ghi bản gộp vào IndexedDB rồi cho các service đọc lại. */
  private async apply(target: SyncSnapshot): Promise<void> {
    await this.storage.muted(async () => {
      // Gộp thêm một lần với dữ liệu hiện tại để không đè thay đổi vừa xảy ra.
      const merged = mergeSnapshots(await this.localSnapshot(), target);
      const current = await this.storage.getAll<ProgressRecord>('progress');
      const byKey = new Map(current.map((r) => [r.key, r]));
      for (const r of Object.values(merged.progress)) {
        const cur = byKey.get(r.key);
        if (!cur || cur.status !== r.status || cur.updatedAt !== r.updatedAt)
          await this.storage.put('progress', r);
      }
      await this.storage.put('kv', merged.quizStats, 'quiz.stats');
      await this.storage.put('kv', merged.roadmapTasks, 'roadmap.tasks');
      await this.storage.put('kv', merged.roadmapTasksAt, 'roadmap.tasksAt');
      if (merged.updatesLastSeen)
        await this.storage.put('kv', merged.updatesLastSeen, 'updates.lastSeen');
    });
    await Promise.all([
      this.progress.reload(),
      this.quiz.reload(),
      this.roadmap.reload(),
      this.updatesRead.reload(),
    ]);
  }
}
