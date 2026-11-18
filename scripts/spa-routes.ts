/**
 * GitHub Pages chỉ phục vụ file tĩnh: mở thẳng /Angular-App/angular/review sẽ nhận 404.html
 * kèm mã HTTP 404 (trang vẫn chạy nhờ SPA fallback nhưng trình duyệt báo lỗi 404, và một số
 * trình duyệt/công cụ coi đó là trang lỗi).
 *
 * Script này tạo sẵn `<route>/index.html` (bản sao index.html) cho mọi route của app,
 * để GitHub Pages trả 200. Chạy sau `ng build`:
 *   tsx scripts/spa-routes.ts dist/learning-hub/browser
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'dist/learning-hub/browser';
const index = join(out, 'index.html');
if (!existsSync(index)) throw new Error(`Không thấy ${index}, hãy build trước.`);

interface Manifest {
  subjects: { id: string; sections: { id: string }[]; hasRoadmap: boolean }[];
}
interface SubjectIndex {
  items: { id: string }[];
}
interface UpdatesIndex {
  updates: { id: string }[];
}

const readJson = <T>(...p: string[]): T =>
  JSON.parse(readFileSync(join(out, 'data', ...p), 'utf8')) as T;

const routes = new Set<string>(['updates', 'settings']);
for (const s of readJson<Manifest>('manifest.json').subjects) {
  routes.add(s.id);
  routes.add(`${s.id}/practice`);
  if (s.hasRoadmap) routes.add(`${s.id}/roadmap`);
  for (const sec of s.sections) routes.add(`${s.id}/${sec.id}`);
  for (const item of readJson<SubjectIndex>(s.id, 'index.json').items)
    routes.add(`${s.id}/${item.id}`);
}
for (const u of readJson<UpdatesIndex>('updates', 'index.json').updates)
  routes.add(`updates/${u.id}`);

let created = 0;
for (const r of routes) {
  const dir = join(out, r);
  const target = join(dir, 'index.html');
  if (existsSync(target)) continue;
  mkdirSync(dir, { recursive: true });
  cpSync(index, target);
  created++;
}
console.log(`✓ Đã tạo ${created} trang route tĩnh (tổng ${routes.size} route).`);
