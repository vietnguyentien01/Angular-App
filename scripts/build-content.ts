/**
 * Build nội dung: content/** (Markdown + JSON)  →  public/data/** (JSON cho app).
 *
 *   npm run content          build
 *   npm run content:check    chỉ validate, không ghi file
 *
 * Mọi lỗi định dạng đều làm script thoát với mã 1 → CI chặn deploy.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import matter from 'gray-matter';
import type { z } from 'zod';
import type {
  ItemDetail,
  ItemSummary,
  Manifest,
  QuizBank,
  QuizEntry,
  Roadmap,
  SubjectIndex,
  SubjectSummary,
  UpdateDetail,
  UpdateSummary,
} from '../src/app/core/content/content.models';
import { DEMO_NAMES } from '../src/app/plugins/demos/demo-names';
import { initHighlighter, renderMarkdown } from './lib/markdown';
import {
  itemFrontMatterSchema,
  roadmapSchema,
  subjectSchema,
  topicsSchema,
  updateFrontMatterSchema,
} from './lib/schemas';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'content');
const OUT = join(ROOT, 'public', 'data');
const CHECK_ONLY = process.argv.includes('--check');
/** Các đoạn route cố định dưới /:subject — không được dùng làm section id. */
const RESERVED_SECTION_IDS = ['practice', 'roadmap'];

const errors: string[] = [];
const rel = (p: string) => relative(ROOT, p);

function report(file: string, message: string) {
  errors.push(`  ✗ ${rel(file)}: ${message}`);
}

function parseWith<S extends z.ZodType>(
  schema: S,
  data: unknown,
  file: string,
): z.output<S> | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      report(file, `${issue.path.join('.') || '(gốc)'} — ${issue.message}`);
    }
    return undefined;
  }
  return result.data;
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    report(file, `JSON không hợp lệ: ${(e as Error).message}`);
    return undefined;
  }
}

async function listDirs(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  return (await readdir(dir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
}

async function listMarkdown(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
      out.push(join(entry.parentPath, entry.name));
    }
  }
  return out.sort();
}

function minutesFor(words: number): number {
  return Math.max(1, Math.round(words / 180));
}

function checkDemos(file: string, demos: string[]) {
  for (const name of demos) {
    if (!(DEMO_NAMES as readonly string[]).includes(name)) {
      report(file, `demo "${name}" chưa được đăng ký trong src/app/plugins/demos/demo-registry.ts`);
    }
  }
}

interface BuiltSubject {
  index: SubjectIndex;
  details: ItemDetail[];
  /** roadmap.json đã validate (chưa giải nghĩa item — cần index của mọi môn). */
  roadmap?: z.output<typeof roadmapSchema>;
}

async function buildSubject(subjectId: string): Promise<BuiltSubject | undefined> {
  const dir = join(CONTENT, subjectId);
  const subjectFile = join(dir, 'subject.json');
  const topicsFile = join(dir, 'topics.json');
  if (!existsSync(subjectFile)) {
    report(dir, 'thiếu subject.json');
    return undefined;
  }
  const subject = parseWith(subjectSchema, await readJson(subjectFile), subjectFile);
  const topics = parseWith(topicsSchema, await readJson(topicsFile), topicsFile);
  if (!subject || !topics) return undefined;
  if (subject.id !== subjectId)
    report(subjectFile, `id "${subject.id}" phải trùng tên thư mục "${subjectId}"`);

  const sectionIds = new Set(subject.sections.map((s) => s.id));
  for (const id of sectionIds) {
    if (RESERVED_SECTION_IDS.includes(id))
      report(subjectFile, `section id "${id}" bị trùng với route của app`);
  }
  const topicIds = new Set(topics.map((t) => t.id));
  const details: ItemDetail[] = [];

  for (const sectionId of await listDirs(dir)) {
    if (!sectionIds.has(sectionId)) {
      report(join(dir, sectionId), `section "${sectionId}" không có trong subject.json`);
      continue;
    }
    for (const topicId of await listDirs(join(dir, sectionId))) {
      const topicDir = join(dir, sectionId, topicId);
      if (!topicIds.has(topicId)) {
        report(topicDir, `topic "${topicId}" không có trong topics.json`);
        continue;
      }
      for (const file of await listMarkdown(topicDir)) {
        const name = basename(file, '.md');
        const match = /^(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(name);
        if (!match) {
          report(file, 'tên file phải có dạng "01-ten-bai.md"');
          continue;
        }
        const parsed = await readFrontMatter(file);
        if (!parsed) continue;
        const { data, content } = parsed;
        const fm = parseWith(itemFrontMatterSchema, data, file);
        if (!fm) continue;
        let rendered;
        try {
          rendered = renderMarkdown(content);
        } catch (e) {
          report(file, (e as Error).message.split('\n')[0]);
          continue;
        }
        checkDemos(file, rendered.demos);
        const slug = match[2];
        details.push({
          id: `${sectionId}/${topicId}/${slug}`,
          subject: subjectId,
          section: sectionId,
          topic: topicId,
          slug,
          title: fm.title,
          summary: fm.summary,
          type: fm.type,
          level: fm.level,
          order: fm.order ?? Number(match[1]),
          minutes: minutesFor(rendered.words),
          quizCount: rendered.quizzes.length,
          version: fm.version,
          lastReviewed: fm.lastReviewed,
          tags: fm.tags,
          related: fm.related,
          changelog: fm.changelog,
          blocks: rendered.blocks,
          toc: rendered.toc,
        });
      }
    }
  }

  // Thứ tự: theo section trong subject.json → topic trong topics.json → số thứ tự bài.
  const sectionOrder = (id: string) => subject.sections.findIndex((s) => s.id === id);
  const topicOrder = (id: string) => topics.findIndex((t) => t.id === id);
  details.sort(
    (a, b) =>
      sectionOrder(a.section) - sectionOrder(b.section) ||
      topicOrder(a.topic) - topicOrder(b.topic) ||
      a.order - b.order,
  );

  const summary: SubjectSummary = {
    ...subject,
    sections: subject.sections.map((s) => ({
      ...s,
      itemCount: details.filter((d) => d.section === s.id).length,
    })),
    topicCount: topics.length,
    itemCount: details.length,
    quizCount: details.reduce((n, d) => n + d.quizCount, 0),
    hasRoadmap: false,
  };
  const roadmapFile = join(dir, 'roadmap.json');
  const roadmap = existsSync(roadmapFile)
    ? parseWith(roadmapSchema, await readJson(roadmapFile), roadmapFile)
    : undefined;
  summary.hasRoadmap = !!roadmap;
  const items: ItemSummary[] = details.map(({ blocks, toc, related, changelog, ...rest }) => rest);
  return { index: { subject: summary, topics, items }, details, roadmap };
}

async function buildUpdates(topicKeys: Set<string>): Promise<UpdateDetail[]> {
  const dir = join(CONTENT, 'updates');
  const updates: UpdateDetail[] = [];
  const seen = new Set<string>();
  for (const file of await listMarkdown(dir)) {
    const id = basename(file, '.md');
    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      report(file, 'tên file phải có dạng "YYYY-MM-DD-ten-ban-tin.md"');
      continue;
    }
    if (seen.has(id)) report(file, `trùng id "${id}"`);
    seen.add(id);
    const parsed = await readFrontMatter(file);
    if (!parsed) continue;
    const { data, content } = parsed;
    const fm = parseWith(updateFrontMatterSchema, data, file);
    if (!fm) continue;
    if (!id.startsWith(fm.date)) report(file, `ngày trong tên file phải trùng "date: ${fm.date}"`);
    for (const t of fm.relatedTopics)
      if (!topicKeys.has(t)) report(file, `relatedTopics "${t}" không tồn tại`);
    let rendered;
    try {
      rendered = renderMarkdown(content);
    } catch (e) {
      report(file, (e as Error).message.split('\n')[0]);
      continue;
    }
    checkDemos(file, rendered.demos);
    updates.push({ id, ...fm, blocks: rendered.blocks });
  }
  return updates.sort((a, b) => b.id.localeCompare(a.id));
}

function quizBank(details: ItemDetail[]): QuizBank {
  const quizzes: QuizEntry[] = [];
  for (const d of details) {
    for (const block of d.blocks) {
      if (block.kind !== 'quiz') continue;
      const { kind, ...quiz } = block;
      quizzes.push({
        ...quiz,
        key: `${d.id}#${quiz.id}`,
        subject: d.subject,
        itemId: d.id,
        itemTitle: d.title,
        section: d.section,
        topic: d.topic,
        level: d.level,
      });
    }
  }
  return { quizzes };
}

async function readFrontMatter(file: string) {
  try {
    return matter(await readFile(file, 'utf8'));
  } catch (e) {
    report(file, `front-matter YAML không hợp lệ: ${(e as Error).message.split('\n')[0]}`);
    return undefined;
  }
}

async function writeJson(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data));
}

async function main() {
  await initHighlighter();

  const subjects: BuiltSubject[] = [];
  for (const id of await listDirs(CONTENT)) {
    if (id === 'updates') continue;
    const built = await buildSubject(id);
    if (built) subjects.push(built);
  }
  if (subjects.length === 0) errors.push('  ✗ content/: chưa có môn học nào');

  // Giải nghĩa item của lộ trình (có thể tham chiếu bài ở môn khác).
  const summaryByKey = new Map(
    subjects.flatMap((s) => s.index.items.map((i) => [`${i.subject}/${i.id}`, i] as const)),
  );
  const roadmaps = new Map<string, Roadmap>();
  for (const s of subjects) {
    if (!s.roadmap) continue;
    const sid = s.index.subject.id;
    const seenStage = new Set<string>();
    const stages = s.roadmap.stages.map((stage) => {
      if (seenStage.has(stage.id))
        errors.push(`  ✗ content/${sid}/roadmap.json: trùng stage id "${stage.id}"`);
      seenStage.add(stage.id);
      const items = stage.items.flatMap((key) => {
        const item = summaryByKey.get(key);
        if (!item)
          errors.push(
            `  ✗ content/${sid}/roadmap.json: stage "${stage.id}" — bài "${key}" không tồn tại`,
          );
        return item ? [item] : [];
      });
      return { ...stage, items };
    });
    roadmaps.set(sid, {
      subject: sid,
      title: s.roadmap.title,
      description: s.roadmap.description,
      stages,
    });
  }

  // Kiểm tra liên kết chéo giữa các bài.
  const allIds = new Set(subjects.flatMap((s) => s.details.map((d) => `${d.subject}/${d.id}`)));
  for (const s of subjects) {
    for (const d of s.details) {
      for (const r of d.related) {
        if (!allIds.has(r))
          errors.push(`  ✗ content/${d.subject}/${d.id}: related "${r}" không tồn tại`);
      }
    }
  }

  const topicKeys = new Set(
    subjects.flatMap((s) => s.index.topics.map((t) => `${s.index.subject.id}/${t.id}`)),
  );
  const updates = await buildUpdates(topicKeys);

  if (errors.length) {
    console.error(`\nNội dung có ${errors.length} lỗi:\n${errors.join('\n')}\n`);
    process.exit(1);
  }

  const itemCount = subjects.reduce((n, s) => n + s.details.length, 0);
  if (CHECK_ONLY) {
    console.log(
      `✓ Nội dung hợp lệ: ${subjects.length} môn, ${itemCount} bài, ${updates.length} bản tin.`,
    );
    return;
  }

  await rm(OUT, { recursive: true, force: true });
  const manifest: Manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    subjects: subjects.map((s) => s.index.subject).sort((a, b) => a.order - b.order),
    updateCount: updates.length,
    latestUpdate: updates[0]?.date,
  };
  await writeJson(join(OUT, 'manifest.json'), manifest);
  for (const s of subjects) {
    const sid = s.index.subject.id;
    await writeJson(join(OUT, sid, 'index.json'), s.index);
    await writeJson(join(OUT, sid, 'quizzes.json'), quizBank(s.details));
    const roadmap = roadmaps.get(sid);
    if (roadmap) await writeJson(join(OUT, sid, 'roadmap.json'), roadmap);
    for (const d of s.details) await writeJson(join(OUT, sid, 'items', `${d.id}.json`), d);
  }
  const updateSummaries: UpdateSummary[] = updates.map(({ blocks, sources, ...rest }) => rest);
  await writeJson(join(OUT, 'updates', 'index.json'), { updates: updateSummaries });
  for (const u of updates) await writeJson(join(OUT, 'updates', `${u.id}.json`), u);

  console.log(
    `✓ Đã build ${subjects.length} môn, ${itemCount} bài, ${updates.length} bản tin → ${rel(OUT)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
