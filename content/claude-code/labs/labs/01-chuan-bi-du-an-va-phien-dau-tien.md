---
title: "Lab 01 — Chuẩn bị dự án thực hành cc-lab và phiên làm việc đầu tiên"
summary: "Tạo dự án Angular 22 cc-lab với module Tasks mẫu (đã kiểm chứng chạy được, có cài sẵn hai bug cho các lab sau), mở phiên Claude Code đầu tiên, hỏi về dự án, cho Claude sửa một thay đổi nhỏ, xem diff và commit."
type: lesson
level: core
lastReviewed: 2026-11-11
tags: [claude-code, lab, beginner, setup]
related: [claude-code/review/getting-started/phien-dau-tien, claude-code/labs/labs/claude-md-va-rules]
---

## Mục tiêu

- Có một dự án **riêng để thực hành** — sai thoải mái, không ảnh hưởng dự án thật.
- Làm quen vòng: hỏi → giao việc nhỏ → duyệt quyền → xem diff → commit.

**Thời gian:** 30–40 phút · **Cần:** Node 20+ (bản LTS mới), git, Claude Code đã đăng nhập.

## Bước 1 — Tạo dự án

```bash
npx -y @angular/cli@22 new cc-lab --style=css --ssr=false --defaults
cd cc-lab
npm test -- --watch=false     # 2 test mặc định phải xanh
```

## Bước 2 — Thêm module Tasks mẫu

Tạo thư mục `src/app/tasks/` và bốn file sau (copy nguyên văn — **đừng** sửa các chỗ trông như lỗi, chúng là bài tập của Lab 04).

```ts title="src/app/tasks/task.model.ts"
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  /** Hạn chót dạng YYYY-MM-DD */
  dueDate: string;
}
```

```ts title="src/app/tasks/task-filter.ts"
import { Task, TaskStatus } from './task.model';

/** Lọc task theo từ khoá trong tiêu đề (không phân biệt hoa thường) và theo trạng thái. */
export function filterTasks(tasks: Task[], query: string, status: TaskStatus | 'all' = 'all'): Task[] {
  return tasks.filter(
    (t) => t.title.includes(query) && (status === 'all' || t.status === status),
  );
}

/** Task quá hạn: hạn chót trước hôm nay và chưa xong. */
export function isOverdue(task: Task, today: string): boolean {
  return task.dueDate < today && task.status !== 'done';
}

/** Task có hạn trong khoảng [hôm nay, hôm nay + days] — tính cả hai đầu. */
export function dueWithin(tasks: Task[], today: string, days: number): Task[] {
  const end = addDays(today, days);
  return tasks.filter((t) => t.dueDate >= today && t.dueDate < end);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
```

```ts title="src/app/tasks/task-filter.spec.ts"
import { filterTasks, isOverdue } from './task-filter';
import { Task } from './task.model';

const tasks: Task[] = [
  { id: 1, title: 'Học Angular signals', status: 'doing', dueDate: '2026-11-10' },
  { id: 2, title: 'Viết unit test', status: 'todo', dueDate: '2026-11-20' },
  { id: 3, title: 'Review PR', status: 'done', dueDate: '2026-11-01' },
];

describe('filterTasks', () => {
  it('lọc theo từ khoá', () => {
    expect(filterTasks(tasks, 'Review').map((t) => t.id)).toEqual([3]);
  });

  it('lọc theo trạng thái', () => {
    expect(filterTasks(tasks, '', 'todo').map((t) => t.id)).toEqual([2]);
  });
});

describe('isOverdue', () => {
  it('task chưa xong và quá hạn', () => {
    expect(isOverdue(tasks[0], '2026-11-11')).toBe(true);
  });

  it('task đã xong thì không quá hạn', () => {
    expect(isOverdue(tasks[2], '2026-11-11')).toBe(false);
  });
});
```

```ts title="src/app/tasks/task-store.ts"
import { Injectable, computed, signal } from '@angular/core';
import { filterTasks } from './task-filter';
import { Task, TaskStatus } from './task.model';

@Injectable({ providedIn: 'root' })
export class TaskStore {
  private readonly tasks = signal<Task[]>([
    { id: 1, title: 'Học Angular signals', status: 'doing', dueDate: '2026-11-10' },
    { id: 2, title: 'Viết unit test', status: 'todo', dueDate: '2026-11-20' },
    { id: 3, title: 'Review PR', status: 'done', dueDate: '2026-11-01' },
  ]);
  readonly query = signal('');
  readonly status = signal<TaskStatus | 'all'>('all');

  readonly visible = computed(() => filterTasks(this.tasks(), this.query(), this.status()));
  readonly total = computed(() => this.tasks().length);

  add(title: string, dueDate: string): void {
    const id = Math.max(0, ...this.tasks().map((t) => t.id)) + 1;
    this.tasks.update((list) => [...list, { id, title, status: 'todo', dueDate }]);
  }

  toggleDone(id: number): void {
    this.tasks.update((list) =>
      list.map((t) => (t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t)),
    );
  }
}
```

```ts title="src/app/tasks/task-list.ts"
import { Component, inject } from '@angular/core';
import { TaskStore } from './task-store';

@Component({
  selector: 'app-task-list',
  template: `
    <label for="q">Tìm task</label>
    <input id="q" [value]="store.query()" (input)="store.query.set($any($event.target).value)" />
    <p>{{ store.visible().length }} / {{ store.total() }} task</p>
    <ul>
      @for (task of store.visible(); track task.id) {
        <li>
          <label>
            <input type="checkbox" [checked]="task.status === 'done'" (change)="store.toggleDone(task.id)" />
            {{ task.title }} — hạn {{ task.dueDate }}
          </label>
        </li>
      } @empty {
        <li>Không có task nào</li>
      }
    </ul>
  `,
})
export class TaskList {
  protected readonly store = inject(TaskStore);
}
```

Nối vào app: trong `src/app/app.ts` thêm `import { TaskList } from './tasks/task-list';` và `TaskList` vào `imports`; thay nội dung `src/app/app.html` bằng:

```html title="src/app/app.html"
<h1>Hello, {{ title() }}</h1>
<app-task-list />
<router-outlet />
```

Kiểm tra rồi commit trạng thái ban đầu:

```bash
npm test -- --watch=false   # 6 test xanh
npx ng build                # build thành công
git add -A && git commit -m "chore: seed tasks module for Claude Code labs"
```

## Bước 3 — Mở phiên đầu tiên

```bash
claude -n "lab01"
```

Đồng ý **tin tưởng thư mục** (đây là dự án của bạn). Chạy `/status` để chắc chắn đúng tài khoản.

## Bước 4 — Hỏi về dự án (chưa sửa gì)

Gõ lần lượt, đọc kỹ câu trả lời:

```text
Dự án này làm gì? Liệt kê các file trong src/app/tasks và vai trò của từng file.
```

```text
Khi người dùng gõ vào ô "Tìm task", dữ liệu đi qua những signal/computed nào trước khi danh sách cập nhật? Trích file và tên hàm.
```

```text
Lệnh nào để chạy test và build dự án này?
```

**Tự kiểm tra:** mở `task-store.ts`, đối chiếu câu trả lời thứ hai với code thật (`query` → `visible` → template).

## Bước 5 — Thay đổi nhỏ đầu tiên

```text
Trong TaskList, thêm dòng "Quá hạn" màu đỏ cạnh task đã quá hạn, dùng isOverdue có sẵn trong task-filter.ts với ngày hôm nay theo giờ máy dạng YYYY-MM-DD. Không sửa file nào khác ngoài task-list.ts. Sau khi sửa, chạy npm test -- --watch=false và npx ng build.
```

Khi Claude xin quyền sửa file hoặc chạy lệnh: đọc lệnh/diff rồi mới **Yes**. Thử một lần chọn **No**, nhấn `Tab`, gõ ghi chú *"chạy test trước khi build"* và xem Claude điều chỉnh.

## Bước 6 — Xem diff và commit

```text
/diff
```

```text
commit my changes with a descriptive message
```

Sau đó trên shell: `git log --oneline -3`.

## Checklist hoàn thành

- [ ] `cc-lab` chạy `npm test` và `ng build` thành công, commit seed đầu tiên đã có
- [ ] Đối chiếu được ít nhất một câu trả lời của Claude với code thật
- [ ] Có commit thêm nhãn "Quá hạn" do Claude làm, và bạn giải thích được từng dòng
- [ ] Đã thử chọn No kèm ghi chú bằng `Tab`

## Lỗi thường gặp

| Hiện tượng | Xử lý |
|---|---|
| Claude sửa thêm file khác | Bạn đã ghi "không sửa file nào khác" — chọn No, ghi chú lại phạm vi; hoặc `/rewind` → Restore code |
| Ngày "hôm nay" bị lệch múi giờ | Đó là một quyết định thiết kế thật — hỏi Claude: *"dùng giờ máy hay UTC? Trade-off?"* |
| Test hỏng vì chữ "Quá hạn" | Đọc test fail, nhờ Claude giải thích trước khi sửa |

:::quiz Ở Bước 4, Claude giải thích luồng dữ liệu của ô tìm kiếm. Cách đúng để biết câu trả lời có chính xác không?
- [ ] Hỏi lại Claude "bạn chắc không?"
- [x] Mở `task-store.ts` và `task-list.ts`, đối chiếu từng bước (`query` → `visible` → template) với code thật
- [ ] Tin vì Claude đã đọc file
- [ ] Chạy `ng build`

Câu trả lời của model phải được kiểm bằng nguồn thật — đó là thói quen cốt lõi khi học codebase với AI.
:::

:::quiz Prompt ở Bước 5 có câu "Không sửa file nào khác ngoài task-list.ts". Mục đích?
- [ ] Để Claude chạy nhanh hơn
- [x] Giới hạn phạm vi — mọi file khác bị đụng tới là dấu hiệu lệch hướng, dễ phát hiện khi đọc diff
- [ ] Vì Claude không sửa được nhiều file
- [ ] Để tiết kiệm token tuyệt đối

Ràng buộc phạm vi giúp diff nhỏ, dễ review và dễ phát hiện lệch hướng.
:::

:::quiz Vì sao lab yêu cầu commit trạng thái seed **trước** khi mở Claude?
- [ ] Vì Claude không chạy được khi có thay đổi chưa commit
- [x] Để luôn có điểm quay về bằng git — checkpoint của Claude không thay thế được git
- [ ] Để Claude đọc được lịch sử
- [ ] Không có lý do

Commit trước mỗi thử nghiệm là thói quen an toàn quan trọng nhất.
:::

:::exercise Thử thách mở rộng
Không dùng Claude: tự viết một test cho nhãn "Quá hạn" trong TaskList (render component, kiểm tra task id 1 có chữ "Quá hạn"). Sau đó nhờ Claude review test của bạn: *"Review test này, chỉ ra điểm yếu, đừng viết lại hộ."*
???
Gợi ý test: dùng `TestBed.createComponent(TaskList)`, `await fixture.whenStable()`, lấy `fixture.nativeElement.querySelectorAll('li')`, kiểm tra phần tử chứa "Học Angular signals" có text "Quá hạn". Điểm yếu Claude hay chỉ ra: test phụ thuộc ngày thật của máy (sẽ fail/sai trong tương lai) → nên cho component nhận "today" qua input/provider hoặc dùng `vi.useFakeTimers()` + `vi.setSystemTime(...)` để cố định ngày.
:::

> Nguồn: quy trình theo *Quickstart* — code.claude.com/docs/en/quickstart; dự án mẫu do Learning Hub soạn và đã kiểm chứng với Angular CLI 22.2.5 (6 test pass, build thành công).
