import { DestroyRef, Service, effect, inject, signal, untracked } from '@angular/core';
import type { Firestore, Unsubscribe } from 'firebase/firestore';
import { AuthService, USE_EMULATORS } from '../auth/auth.service';
import { ProgressService } from '../progress/progress.service';
import type { QuizStat } from '../quiz/quiz-stats.service';
import { QuizStatsService } from '../quiz/quiz-stats.service';
import { RoadmapTasksService } from '../roadmap/roadmap-progress';
import { type ProgressRecord, StorageService } from '../storage/storage.service';
import { UpdatesReadService } from '../updates/updates-read.service';
import {
  type SyncSnapshot,
  emptySnapshot,
  mergeSnapshots,
  parseSnapshot,
  sameContent,
} from './sync-merge';

/** uid của người dùng sở hữu dữ liệu IndexedDB trên thiết bị này. */
const OWNER_KEY = 'learning-hub.owner';
/** Gom các thay đổi liên tiếp thành một lần ghi lên Firestore. */
const PUSH_DELAY_MS = 1500;

export type CloudState = 'off' | 'loading' | 'saved' | 'saving' | 'error';

function readOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(uid: string | null): void {
  try {
    if (uid) localStorage.setItem(OWNER_KEY, uid);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // localStorage bị chặn: bỏ qua, dữ liệu vẫn đúng trong phiên này.
  }
}

/**
 * Lưu tiến độ học theo tài khoản: document `users/{uid}` trong Firestore.
 * IndexedDB vẫn là bộ nhớ đệm trên máy (app chạy nhanh, dùng được khi mất mạng),
 * Firestore là bản gốc dùng chung giữa các thiết bị, cập nhật theo thời gian thực.
 */
@Service()
export class CloudSyncService {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly progress = inject(ProgressService);
  private readonly quiz = inject(QuizStatsService);
  private readonly roadmap = inject(RoadmapTasksService);
  private readonly updatesRead = inject(UpdatesReadService);

  readonly state = signal<CloudState>('off');
  /** false cho tới khi dữ liệu của tài khoản đã được nạp về máy sau khi đăng nhập. */
  readonly loaded = signal(!this.auth.enabled);

  private uid: string | null = null;
  private unsubscribe: Unsubscribe | undefined;
  private pushTimer: ReturnType<typeof setTimeout> | undefined;
  private lastRemote: SyncSnapshot = emptySnapshot();
  private queue: Promise<void> = Promise.resolve();
  private firestore: Promise<Firestore> | undefined;

  /** Gọi một lần khi app khởi động (trong injection context). */
  start(): void {
    if (!this.auth.enabled) return;
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const user = this.auth.user();
      untracked(() => this.enqueue(() => this.switchUser(user?.uid ?? null)));
    });

    let first = true;
    effect(() => {
      this.storage.writes();
      if (first) {
        first = false;
        return;
      }
      untracked(() => this.schedulePush());
    });

    const flush = () => {
      if (document.visibilityState === 'hidden' && this.pushTimer) {
        clearTimeout(this.pushTimer);
        this.pushTimer = undefined;
        this.enqueue(() => this.push());
      }
    };
    document.addEventListener('visibilitychange', flush);
    destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', flush);
      this.unsubscribe?.();
    });
  }

  /** Đăng xuất: đẩy nốt thay đổi chưa lưu, xoá dữ liệu cá nhân khỏi máy rồi mới thoát. */
  async signOut(): Promise<void> {
    await this.flush();
    await this.auth.signOut();
    await this.queue;
  }

  /** Lưu nốt thay đổi còn chờ của tài khoản hiện tại lên Firestore. */
  async flush(): Promise<void> {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = undefined;
      await this.enqueue(() => this.push());
    }
    await this.queue;
  }

  /**
   * Chuyển sang tài khoản Google khác mà không cần đăng xuất: lưu nốt tiến độ của tài khoản
   * hiện tại rồi mở cửa sổ chọn tài khoản. Đóng cửa sổ thì vẫn ở tài khoản cũ.
   * Khi uid đổi, `switchUser` xoá dữ liệu tài khoản cũ khỏi máy và nạp dữ liệu tài khoản mới.
   */
  async switchAccount(): Promise<void> {
    await this.flush();
    await this.auth.signInWithGoogle();
  }

  /** Xoá toàn bộ tiến độ của tài khoản (trên máy và trên Firestore). */
  resetAll(): Promise<void> {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = undefined;
    return this.enqueue(async () => {
      await this.clearLocal();
      this.lastRemote = emptySnapshot();
      await this.push();
    });
  }

  /** Chạy các thao tác đồng bộ lần lượt, không chồng lên nhau. */
  private enqueue(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(task).catch(() => this.state.set('error'));
    return this.queue;
  }

  private async db(): Promise<Firestore> {
    this.firestore ??= Promise.all([this.auth.app(), import('firebase/firestore')]).then(
      ([app, { getFirestore, connectFirestoreEmulator }]) => {
        const db = getFirestore(app);
        if (USE_EMULATORS) connectFirestoreEmulator(db, '127.0.0.1', 8080);
        return db;
      },
    );
    return this.firestore;
  }

  private async switchUser(uid: string | null): Promise<void> {
    if (uid === this.uid) return;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.uid = uid;
    this.lastRemote = emptySnapshot();

    if (!uid) {
      // Đăng xuất: không để lại tiến độ của tài khoản trên máy.
      if (readOwner()) await this.clearLocal();
      writeOwner(null);
      this.state.set('off');
      this.loaded.set(false);
      return;
    }

    this.loaded.set(false);
    this.state.set('loading');
    const owner = readOwner();
    // Máy đang chứa dữ liệu của tài khoản khác: xoá trước khi nạp dữ liệu của tài khoản này.
    // Máy chưa có chủ (dữ liệu học trước khi có đăng nhập): giữ lại và gộp vào tài khoản.
    if (owner && owner !== uid) await this.clearLocal();
    writeOwner(uid);

    const [db, { doc, onSnapshot }] = await Promise.all([this.db(), import('firebase/firestore')]);
    const ref = doc(db, 'users', uid);
    let first = true;
    await new Promise<void>((resolve) => {
      this.unsubscribe = onSnapshot(
        ref,
        (snap) => {
          if (snap.metadata.hasPendingWrites) return; // tiếng vọng từ chính lần ghi của máy này
          const data = snap.data()?.['data'];
          let remote = emptySnapshot();
          try {
            remote = typeof data === 'string' ? parseSnapshot(JSON.parse(data)) : emptySnapshot();
          } catch {
            remote = emptySnapshot();
          }
          if (first) {
            // Lần đầu chạy ngay trong tác vụ switchUser đang giữ hàng đợi (tránh tự chờ chính mình).
            first = false;
            this.lastRemote = remote;
            void this.pullAndMerge(remote, true)
              .catch(() => this.state.set('error'))
              .finally(() => {
                this.loaded.set(true);
                resolve();
              });
            return;
          }
          // Thiết bị khác vừa ghi: gộp về máy.
          this.enqueue(async () => {
            this.lastRemote = remote;
            await this.pullAndMerge(remote, false);
          });
        },
        () => {
          this.state.set('error');
          this.loaded.set(true); // vẫn cho học bằng dữ liệu trên máy
          resolve();
        },
      );
    });
  }

  /** Gộp dữ liệu từ Firestore vào máy; nếu máy có dữ liệu mới hơn thì ghi ngược lên. */
  private async pullAndMerge(remote: SyncSnapshot, pushIfNewer: boolean): Promise<void> {
    const local = await this.localSnapshot();
    const merged = mergeSnapshots(local, remote);
    if (!sameContent(merged, local)) await this.apply(merged);
    if (pushIfNewer && !sameContent(merged, remote)) await this.push();
    else this.state.set('saved');
  }

  private schedulePush(): void {
    if (!this.uid) return;
    this.state.set('saving');
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = undefined;
      this.enqueue(() => this.push());
    }, PUSH_DELAY_MS);
  }

  private async push(): Promise<void> {
    const uid = this.uid;
    if (!uid) return;
    this.state.set('saving');
    const merged = mergeSnapshots(await this.localSnapshot(), this.lastRemote);
    merged.updatedAt = new Date().toISOString();
    const [db, { doc, setDoc, serverTimestamp }] = await Promise.all([
      this.db(),
      import('firebase/firestore'),
    ]);
    await setDoc(doc(db, 'users', uid), {
      data: JSON.stringify(merged),
      updatedAt: serverTimestamp(),
    });
    this.lastRemote = merged;
    this.state.set('saved');
  }

  private async clearLocal(): Promise<void> {
    await this.storage.muted(async () => {
      await this.storage.clear('progress');
      await this.storage.clear('kv');
    });
    await this.reloadAll();
  }

  private reloadAll(): Promise<unknown> {
    return Promise.all([
      this.progress.reload(),
      this.quiz.reload(),
      this.roadmap.reload(),
      this.updatesRead.reload(),
    ]);
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
      const current = new Map(
        (await this.storage.getAll<ProgressRecord>('progress')).map((r) => [r.key, r]),
      );
      for (const r of Object.values(merged.progress)) {
        const cur = current.get(r.key);
        if (!cur || cur.status !== r.status || cur.updatedAt !== r.updatedAt)
          await this.storage.put('progress', r);
      }
      await this.storage.put('kv', merged.quizStats, 'quiz.stats');
      await this.storage.put('kv', merged.roadmapTasks, 'roadmap.tasks');
      await this.storage.put('kv', merged.roadmapTasksAt, 'roadmap.tasksAt');
      if (merged.updatesLastSeen)
        await this.storage.put('kv', merged.updatesLastSeen, 'updates.lastSeen');
    });
    await this.reloadAll();
  }
}
