import type { QuizStat } from '../quiz/quiz-stats.service';
import type { ProgressRecord } from '../storage/storage.service';

/** Nội dung file JSON lưu trong GitHub Gist. Không chứa token hay cấu hình đồng bộ. */
export interface SyncSnapshot {
  app: 'learning-hub';
  format: 1;
  updatedAt: string;
  progress: Record<string, ProgressRecord>;
  quizStats: Record<string, QuizStat>;
  roadmapTasks: Record<string, boolean>;
  /** Thời điểm đổi trạng thái của từng bài thực hành lộ trình. */
  roadmapTasksAt: Record<string, string>;
  updatesLastSeen: string;
}

export function emptySnapshot(): SyncSnapshot {
  return {
    app: 'learning-hub',
    format: 1,
    updatedAt: '',
    progress: {},
    quizStats: {},
    roadmapTasks: {},
    roadmapTasksAt: {},
    updatesLastSeen: '',
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Đọc file từ Gist một cách phòng thủ: bỏ qua mọi phần sai kiểu thay vì làm hỏng dữ liệu. */
export function parseSnapshot(data: unknown): SyncSnapshot {
  const s = emptySnapshot();
  if (!isRecord(data) || data['app'] !== 'learning-hub') return s;
  if (typeof data['updatedAt'] === 'string') s.updatedAt = data['updatedAt'];
  if (isRecord(data['progress']))
    for (const [k, r] of Object.entries(data['progress']))
      if (
        isRecord(r) &&
        r['key'] === k &&
        (r['status'] === 'done' || r['status'] === 'in-progress') &&
        typeof r['updatedAt'] === 'string'
      )
        s.progress[k] = { key: k, status: r['status'], updatedAt: r['updatedAt'] };
  if (isRecord(data['quizStats']))
    for (const [k, q] of Object.entries(data['quizStats']))
      if (
        isRecord(q) &&
        typeof q['correct'] === 'number' &&
        typeof q['wrong'] === 'number' &&
        (q['last'] === 'correct' || q['last'] === 'wrong') &&
        typeof q['at'] === 'string'
      )
        s.quizStats[k] = { correct: q['correct'], wrong: q['wrong'], last: q['last'], at: q['at'] };
  if (isRecord(data['roadmapTasks']))
    for (const [k, v] of Object.entries(data['roadmapTasks']))
      if (typeof v === 'boolean') s.roadmapTasks[k] = v;
  if (isRecord(data['roadmapTasksAt']))
    for (const [k, v] of Object.entries(data['roadmapTasksAt']))
      if (typeof v === 'string') s.roadmapTasksAt[k] = v;
  if (typeof data['updatesLastSeen'] === 'string') s.updatesLastSeen = data['updatesLastSeen'];
  return s;
}

/** Giữ bản ghi có mốc thời gian mới hơn; bằng nhau thì giữ bản của `a`. */
function newestBy<T>(
  a: Record<string, T>,
  b: Record<string, T>,
  at: (v: T) => string,
): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    if (cur === undefined || at(v) > at(cur)) out[k] = v;
  }
  return out;
}

/**
 * Gộp dữ liệu hai thiết bị. Quy tắc theo từng loại dữ liệu:
 * - tiến độ bài học, kết quả quiz: bản ghi nào đổi sau cùng thì thắng;
 * - bài thực hành lộ trình: theo mốc thời gian từng ô; ô không có mốc (dữ liệu cũ) thì "đã làm" thắng;
 * - bản tin đã đọc: lấy id mới nhất.
 */
export function mergeSnapshots(a: SyncSnapshot, b: SyncSnapshot): SyncSnapshot {
  const roadmapTasks: Record<string, boolean> = {};
  const roadmapTasksAt: Record<string, string> = {};
  const keys = new Set([...Object.keys(a.roadmapTasks), ...Object.keys(b.roadmapTasks)]);
  for (const k of keys) {
    const atA = a.roadmapTasksAt[k] ?? '';
    const atB = b.roadmapTasksAt[k] ?? '';
    const inA = k in a.roadmapTasks;
    const inB = k in b.roadmapTasks;
    let value: boolean;
    if (inA && inB) {
      if (atA === atB) value = a.roadmapTasks[k] || b.roadmapTasks[k];
      else value = atA > atB ? a.roadmapTasks[k] : b.roadmapTasks[k];
    } else value = inA ? a.roadmapTasks[k] : b.roadmapTasks[k];
    roadmapTasks[k] = value;
    const at = atA > atB ? atA : atB;
    if (at) roadmapTasksAt[k] = at;
  }
  return {
    app: 'learning-hub',
    format: 1,
    updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt,
    progress: newestBy(a.progress, b.progress, (r) => r.updatedAt),
    quizStats: newestBy(a.quizStats, b.quizStats, (q) => q.at),
    roadmapTasks,
    roadmapTasksAt,
    updatesLastSeen: a.updatesLastSeen > b.updatesLastSeen ? a.updatesLastSeen : b.updatesLastSeen,
  };
}

/** So sánh nội dung (bỏ qua `updatedAt`) để biết có cần ghi lại hay không. */
export function sameContent(a: SyncSnapshot, b: SyncSnapshot): boolean {
  const strip = ({ updatedAt: _u, ...rest }: SyncSnapshot) => rest;
  return stableStringify(strip(a)) === stableStringify(strip(b));
}

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (isRecord(v))
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
      .join(',')}}`;
  return JSON.stringify(v);
}
