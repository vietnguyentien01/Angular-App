import { staleReason } from './staleness';

describe('staleReason', () => {
  const today = new Date('2026-11-11');

  it('báo cũ khi bài viết cho phiên bản cũ hơn', () => {
    expect(
      staleReason({ version: 19, lastReviewed: '2026-11-01' }, { currentVersion: 22 }, today),
    ).toEqual({
      kind: 'version',
      itemVersion: 19,
      currentVersion: 22,
    });
  });

  it('báo cũ khi quá 365 ngày chưa xem lại', () => {
    expect(staleReason({ lastReviewed: '2025-01-01' }, undefined, today)?.kind).toBe('age');
  });

  it('không báo khi bài còn mới', () => {
    expect(
      staleReason({ version: 22, lastReviewed: '2026-10-01' }, { currentVersion: 22 }, today),
    ).toBeUndefined();
  });
});
