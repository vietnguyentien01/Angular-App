import { emptySnapshot, mergeSnapshots, parseSnapshot, sameContent } from './sync-merge';

const snap = (patch: Partial<ReturnType<typeof emptySnapshot>>) => ({
  ...emptySnapshot(),
  ...patch,
});

describe('mergeSnapshots', () => {
  it('giữ trạng thái bài học đổi sau cùng ở mỗi thiết bị', () => {
    const laptop = snap({
      progress: {
        'angular/a': { key: 'angular/a', status: 'done', updatedAt: '2026-11-18T10:00:00Z' },
        'rxjs/b': { key: 'rxjs/b', status: 'in-progress', updatedAt: '2026-11-18T08:00:00Z' },
      },
    });
    const phone = snap({
      progress: {
        'angular/a': { key: 'angular/a', status: 'in-progress', updatedAt: '2026-11-18T09:00:00Z' },
        'rxjs/b': { key: 'rxjs/b', status: 'done', updatedAt: '2026-11-18T11:00:00Z' },
        'sql/c': { key: 'sql/c', status: 'in-progress', updatedAt: '2026-11-18T12:00:00Z' },
      },
    });
    const m = mergeSnapshots(laptop, phone);
    expect(m.progress['angular/a'].status).toBe('done');
    expect(m.progress['rxjs/b'].status).toBe('done');
    expect(m.progress['sql/c'].status).toBe('in-progress');
    expect(mergeSnapshots(phone, laptop).progress).toEqual(m.progress);
  });

  it('kết quả quiz mới hơn thắng, bản tin đã đọc lấy id mới nhất', () => {
    const a = snap({
      quizStats: { k: { correct: 1, wrong: 0, last: 'correct', at: '2026-11-18T10:00:00Z' } },
      updatesLastSeen: '2026-11-16-a',
    });
    const b = snap({
      quizStats: { k: { correct: 1, wrong: 1, last: 'wrong', at: '2026-11-18T11:00:00Z' } },
      updatesLastSeen: '2026-11-18-b',
    });
    const m = mergeSnapshots(a, b);
    expect(m.quizStats['k'].last).toBe('wrong');
    expect(m.updatesLastSeen).toBe('2026-11-18-b');
  });

  it('bài thực hành lộ trình: theo mốc thời gian; không có mốc thì "đã làm" thắng', () => {
    const a = snap({
      roadmapTasks: { t1: true, t2: true, t3: false },
      roadmapTasksAt: { t1: '2026-11-18T10:00:00Z' },
    });
    const b = snap({
      roadmapTasks: { t1: false, t3: true, t4: true },
      roadmapTasksAt: { t1: '2026-11-18T11:00:00Z' },
    });
    const m = mergeSnapshots(a, b);
    expect(m.roadmapTasks).toEqual({ t1: false, t2: true, t3: true, t4: true });
    expect(m.roadmapTasksAt['t1']).toBe('2026-11-18T11:00:00Z');
  });
});

describe('parseSnapshot', () => {
  it('bỏ qua dữ liệu sai kiểu thay vì làm hỏng dữ liệu', () => {
    const s = parseSnapshot({
      app: 'learning-hub',
      progress: {
        ok: { key: 'ok', status: 'done', updatedAt: 'x' },
        bad: { key: 'khac', status: 'done', updatedAt: 'x' },
        bad2: { key: 'bad2', status: 'xong', updatedAt: 'x' },
      },
      roadmapTasks: { a: true, b: 'yes' },
    });
    expect(Object.keys(s.progress)).toEqual(['ok']);
    expect(s.roadmapTasks).toEqual({ a: true });
    expect(parseSnapshot({ app: 'khac' })).toEqual(emptySnapshot());
    expect(parseSnapshot(null)).toEqual(emptySnapshot());
  });
});

describe('sameContent', () => {
  it('bỏ qua updatedAt và thứ tự khoá', () => {
    const a = snap({ updatedAt: '1', roadmapTasks: { x: true, y: false } });
    const b = snap({ updatedAt: '2', roadmapTasks: { y: false, x: true } });
    expect(sameContent(a, b)).toBe(true);
    expect(sameContent(a, snap({ roadmapTasks: { x: false } }))).toBe(false);
  });
});
