import type { ItemSummary } from '../content/content.models';
import { computeStageProgress, taskKey } from './roadmap-progress';

const item = (id: string) => ({ id, subject: 'angular' }) as ItemSummary;

describe('computeStageProgress', () => {
  const stage = { id: 's1', items: [item('a'), item('b'), item('c')], practice: ['viết ADR'] };

  it('tính cả bài học và bài thực hành', () => {
    const p = computeStageProgress(
      'angular',
      stage,
      {
        'angular/a': { key: 'angular/a', status: 'done', updatedAt: '' },
        'angular/b': { key: 'angular/b', status: 'in-progress', updatedAt: '' },
      },
      { [taskKey('angular', 's1', 0)]: true },
    );
    expect(p).toEqual({
      lessonsDone: 1,
      lessonsTotal: 3,
      tasksDone: 1,
      tasksTotal: 1,
      percent: 50,
      complete: false,
    });
  });

  it('hoàn thành khi xong hết', () => {
    const records = Object.fromEntries(
      ['a', 'b', 'c'].map((k) => [
        `angular/${k}`,
        { key: `angular/${k}`, status: 'done' as const, updatedAt: '' },
      ]),
    );
    expect(computeStageProgress('angular', stage, records, { 'angular/s1#0': true }).complete).toBe(
      true,
    );
  });
});
