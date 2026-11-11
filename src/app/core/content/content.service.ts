import { HttpClient, httpResource } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, map, of } from 'rxjs';
import type { ItemSummary, Manifest, SubjectIndex, UpdatesIndex } from './content.models';

/** Đường dẫn tương đối để chạy đúng cả ở local lẫn GitHub Pages (base href /Angular-App/). */
export const contentUrl = {
  manifest: () => 'data/manifest.json',
  subject: (subject: string) => `data/${subject}/index.json`,
  item: (subject: string, id: string) => `data/${subject}/items/${id}.json`,
  updates: () => 'data/updates/index.json',
  update: (id: string) => `data/updates/${id}.json`,
};

/**
 * Nguồn dữ liệu nội dung (đã build sẵn thành JSON tĩnh).
 * Index (danh sách bài, không có nội dung) của mọi môn được tải một lần và dùng chung
 * cho sidebar, dashboard và các trang. Nội dung từng bài được tải riêng khi mở.
 */
@Service()
export class ContentService {
  private readonly http = inject(HttpClient);

  readonly manifest = httpResource<Manifest>(contentUrl.manifest);
  readonly updates = httpResource<UpdatesIndex>(contentUrl.updates);

  readonly subjects = computed(() =>
    this.manifest.hasValue() ? this.manifest.value().subjects : [],
  );

  readonly indexes = rxResource({
    params: () =>
      this.manifest.hasValue() ? this.manifest.value().subjects.map((s) => s.id) : undefined,
    stream: ({ params: ids }) =>
      ids.length === 0
        ? of({} as Record<string, SubjectIndex>)
        : forkJoin(ids.map((id) => this.http.get<SubjectIndex>(contentUrl.subject(id)))).pipe(
            map(
              (list) =>
                Object.fromEntries(list.map((index) => [index.subject.id, index])) as Record<
                  string,
                  SubjectIndex
                >,
            ),
          ),
  });

  private readonly itemsByKey = computed(() => {
    const out = new Map<string, ItemSummary>();
    if (!this.indexes.hasValue()) return out;
    for (const index of Object.values(this.indexes.value())) {
      for (const item of index.items) out.set(`${item.subject}/${item.id}`, item);
    }
    return out;
  });

  subjectIndex(id: string): SubjectIndex | undefined {
    return this.indexes.hasValue() ? this.indexes.value()[id] : undefined;
  }

  /** Tìm bài theo khoá `${subject}/${itemId}`. */
  findItem(key: string): ItemSummary | undefined {
    return this.itemsByKey().get(key);
  }
}
