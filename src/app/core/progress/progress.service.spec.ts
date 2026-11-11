import { TestBed } from '@angular/core/testing';
import type { ItemSummary } from '../content/content.models';
import { ProgressService, computeStats } from './progress.service';

const item = (id: string): ItemSummary => ({
  id,
  subject: 'angular',
  section: 'review',
  topic: 'signals',
  slug: id,
  title: id,
  summary: '',
  type: 'card',
  level: 'core',
  order: 1,
  minutes: 1,
  lastReviewed: '2026-11-11',
  tags: [],
});

describe('computeStats', () => {
  it('đếm số bài đã học / đang học và phần trăm', () => {
    const items = [item('a'), item('b'), item('c'), item('d')];
    const stats = computeStats(items, {
      'angular/a': { key: 'angular/a', status: 'done', updatedAt: '' },
      'angular/b': { key: 'angular/b', status: 'in-progress', updatedAt: '' },
    });
    expect(stats).toEqual({ done: 1, inProgress: 1, total: 4, percent: 25 });
  });

  it('trả 0% khi không có bài', () => {
    expect(computeStats([], {}).percent).toBe(0);
  });
});

describe('ProgressService', () => {
  it('mở bài → đang học; không ghi đè trạng thái đã học', async () => {
    const service = TestBed.inject(ProgressService);
    const a = item('a');

    await service.markOpened(a);
    expect(service.status(a)).toBe('in-progress');

    await service.toggleDone(a);
    expect(service.status(a)).toBe('done');

    await service.markOpened(a);
    expect(service.status(a)).toBe('done');
    expect(service.recent()[0].key).toBe('angular/a');
  });
});
