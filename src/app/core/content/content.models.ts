/**
 * Kiểu dữ liệu của nội dung đã được build (public/data/**).
 * File này được dùng chung bởi app và script `scripts/build-content.ts`,
 * nên KHÔNG import gì từ Angular ở đây.
 */

export type ItemType = 'lesson' | 'card' | 'cheatsheet';
export type Level = 'core' | 'intermediate' | 'advanced';
export type Importance = 'high' | 'medium' | 'low';

export interface SectionMeta {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface SubjectSummary {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  /** Phiên bản hiện tại của công nghệ (vd: 22 cho Angular) — dùng để cảnh báo bài cũ. */
  currentVersion?: number;
  sections: (SectionMeta & { itemCount: number })[];
  topicCount: number;
  itemCount: number;
}

export interface Manifest {
  schemaVersion: 1;
  generatedAt: string;
  subjects: SubjectSummary[];
  updateCount: number;
  latestUpdate?: string;
}

export interface ItemSummary {
  /** `${section}/${topic}/${slug}` — duy nhất trong một môn học. */
  id: string;
  subject: string;
  section: string;
  topic: string;
  slug: string;
  title: string;
  summary: string;
  type: ItemType;
  level: Level;
  order: number;
  minutes: number;
  version?: number;
  lastReviewed: string;
  tags: string[];
}

export interface TopicMeta {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export interface SubjectIndex {
  subject: SubjectSummary;
  topics: TopicMeta[];
  items: ItemSummary[];
}

export type ContentBlock = { kind: 'html'; html: string } | { kind: 'demo'; name: string };

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface ChangelogEntry {
  date: string;
  note: string;
}

export interface ItemDetail extends ItemSummary {
  blocks: ContentBlock[];
  toc: TocEntry[];
  related: string[];
  changelog: ChangelogEntry[];
}

export interface UpdateSource {
  title: string;
  url: string;
}

export interface UpdateSummary {
  id: string;
  date: string;
  title: string;
  summary: string;
  importance: Importance;
  tags: string[];
  /** Tham chiếu dạng `subject/topic`, vd `angular/signals`. */
  relatedTopics: string[];
}

export interface UpdateDetail extends UpdateSummary {
  blocks: ContentBlock[];
  sources: UpdateSource[];
}

export interface UpdatesIndex {
  updates: UpdateSummary[];
}
