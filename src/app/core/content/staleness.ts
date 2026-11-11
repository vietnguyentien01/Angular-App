import type { ItemSummary, SubjectSummary } from './content.models';

export const STALE_AFTER_DAYS = 365;

export type StaleReason =
  { kind: 'version'; itemVersion: number; currentVersion: number } | { kind: 'age'; days: number };

/** Bài có thể đã cũ nếu viết cho phiên bản cũ hơn bản hiện tại, hoặc lâu chưa được xem lại. */
export function staleReason(
  item: Pick<ItemSummary, 'version' | 'lastReviewed'>,
  subject: Pick<SubjectSummary, 'currentVersion'> | undefined,
  today: Date,
): StaleReason | undefined {
  if (item.version && subject?.currentVersion && item.version < subject.currentVersion) {
    return { kind: 'version', itemVersion: item.version, currentVersion: subject.currentVersion };
  }
  const days = Math.floor((today.getTime() - new Date(item.lastReviewed).getTime()) / 86_400_000);
  if (days > STALE_AFTER_DAYS) return { kind: 'age', days };
  return undefined;
}
