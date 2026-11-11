import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'chỉ dùng chữ thường, số và dấu "-"');

/** gray-matter đọc ngày YAML không có ngoặc kép thành Date → chuẩn hoá về YYYY-MM-DD. */
export const isoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'định dạng ngày YYYY-MM-DD'),
);

export const sectionSchema = z.strictObject({
  id,
  title: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
});

export const subjectSchema = z.strictObject({
  id,
  title: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  order: z.number().int(),
  currentVersion: z.number().int().positive().optional(),
  sections: z.array(sectionSchema).min(1),
});

export const topicsSchema = z
  .array(
    z.strictObject({
      id,
      title: z.string().min(1),
      description: z.string().min(1),
      icon: z.string().optional(),
    }),
  )
  .min(1);

export const itemFrontMatterSchema = z.strictObject({
  title: z.string().min(1),
  summary: z.string().min(1).max(300),
  type: z.enum(['lesson', 'card', 'cheatsheet']).default('lesson'),
  level: z.enum(['core', 'intermediate', 'advanced']),
  order: z.number().int().optional(),
  version: z.number().int().positive().optional(),
  lastReviewed: isoDate,
  tags: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  changelog: z.array(z.strictObject({ date: isoDate, note: z.string().min(1) })).default([]),
});

export const updateFrontMatterSchema = z.strictObject({
  title: z.string().min(1),
  date: isoDate,
  summary: z.string().min(1).max(400),
  importance: z.enum(['high', 'medium', 'low']),
  tags: z.array(z.string()).default([]),
  relatedTopics: z
    .array(z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'dạng "subject/topic"'))
    .default([]),
  sources: z
    .array(z.strictObject({ title: z.string().min(1), url: z.url({ protocol: /^https$/ }) }))
    .min(1, 'mỗi bản tin cần ít nhất 1 nguồn'),
});

export const roadmapSchema = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  stages: z
    .array(
      z.strictObject({
        id,
        title: z.string().min(1),
        duration: z.string().min(1),
        goal: z.string().min(1),
        outcomes: z.array(z.string().min(1)).min(1),
        items: z
          .array(
            z
              .string()
              .regex(
                /^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/,
                'dạng subject/section/topic/slug',
              ),
          )
          .min(1),
        practice: z.array(z.string().min(1)).default([]),
        milestone: z.string().min(1),
      }),
    )
    .min(1),
});
