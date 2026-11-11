import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  type Observable,
  type OperatorFunction,
  Subject,
  Subscription,
  concatMap,
  exhaustMap,
  interval,
  map,
  mergeMap,
  switchMap,
  take,
  timer,
} from 'rxjs';

interface Marble {
  label: string;
  t: number;
  lane: number;
}

type Flatten = (project: (n: number) => Observable<string>) => OperatorFunction<number, string>;

const WINDOW_MS = 4000;
const LANES: { name: string; op: Flatten; note: string }[] = [
  { name: 'switchMap', op: (p) => switchMap(p), note: 'Huỷ inner cũ khi có click mới' },
  { name: 'mergeMap', op: (p) => mergeMap(p), note: 'Chạy song song tất cả' },
  { name: 'concatMap', op: (p) => concatMap(p), note: 'Xếp hàng, chạy lần lượt' },
  { name: 'exhaustMap', op: (p) => exhaustMap(p), note: 'Bỏ qua click khi đang bận' },
];
const COLORS = [
  '#6366f1',
  '#f43f5e',
  '#10b981',
  '#f59e0b',
  '#0ea5e9',
  '#a855f7',
  '#ec4899',
  '#84cc16',
];

/**
 * Demo: 4 toán tử flattening nhận cùng một luồng click.
 * Mỗi click n tạo inner observable phát n·a, n·b, n·c cách nhau 400ms.
 */
@Component({
  selector: 'app-rxjs-flattening-demo',
  template: `
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="demo-btn" (click)="click()">Click (phát {{ nextN() }})</button>
        <button type="button" class="demo-btn" (click)="burst()">3 click nhanh</button>
        <button type="button" class="demo-btn-ghost" (click)="reset()">Reset</button>
        <span class="text-xs text-slate-500"
          >Mỗi click tạo inner: <code>n·a → n·b → n·c</code> (cách 400ms)</span
        >
      </div>

      <div class="overflow-x-auto">
        <div class="min-w-[36rem] space-y-1.5">
          @for (lane of laneRows; track lane.index) {
            <div class="flex items-center gap-3">
              <div class="w-28 shrink-0 text-right">
                <p class="font-mono text-xs font-semibold">{{ lane.name }}</p>
                <p class="text-[10px] leading-tight text-slate-500">{{ lane.note }}</p>
              </div>
              <div
                class="relative h-8 flex-1 rounded bg-slate-100 dark:bg-slate-800"
                [attr.aria-label]="'Kết quả ' + lane.name"
              >
                <div class="absolute inset-x-0 top-1/2 h-px bg-slate-300 dark:bg-slate-600"></div>
                @for (m of marblesOf(lane.index); track $index) {
                  <span
                    class="absolute top-1/2 grid h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full px-1 font-mono text-[10px] font-semibold text-white shadow"
                    [style.left.%]="pos(m.t)"
                    [style.background-color]="color(m.label)"
                    >{{ m.label }}</span
                  >
                }
              </div>
            </div>
          }
        </div>
      </div>
      <p class="text-xs text-slate-500">
        Dòng trên cùng là các click. Thử “3 click nhanh”: <strong>switchMap</strong> chỉ hoàn thành
        inner cuối, <strong>exhaustMap</strong> chỉ chạy inner đầu, <strong>concatMap</strong> chạy
        đủ cả 3 nhưng tuần tự.
      </p>
    </div>
  `,
})
export class RxjsFlatteningDemo {
  private readonly destroyRef = inject(DestroyRef);
  private clicks$ = new Subject<number>();
  private subs = new Subscription();
  private t0: number | undefined;

  protected readonly laneRows = [
    { index: -1, name: 'click$', note: 'Luồng nguồn' },
    ...LANES.map((l, index) => ({ index, name: l.name, note: l.note })),
  ];
  protected readonly marbles = signal<Marble[]>([]);
  protected readonly nextN = signal(1);

  constructor() {
    this.wire();
    this.destroyRef.onDestroy(() => this.subs.unsubscribe());
  }

  private wire(): void {
    this.subs.unsubscribe();
    this.subs = new Subscription();
    this.clicks$ = new Subject<number>();
    const inner = (n: number) =>
      interval(400).pipe(
        take(3),
        map((i) => `${n}${'abc'[i]}`),
      );
    this.subs.add(this.clicks$.subscribe((n) => this.push(-1, String(n))));
    LANES.forEach((lane, index) => {
      this.subs.add(this.clicks$.pipe(lane.op(inner)).subscribe((v) => this.push(index, v)));
    });
  }

  private push(lane: number, label: string): void {
    const now = performance.now();
    this.t0 ??= now;
    this.marbles.update((list) => [...list, { lane, label, t: now - this.t0! }]);
  }

  protected click(): void {
    const n = this.nextN();
    this.nextN.set(n > 8 ? 1 : n + 1);
    this.clicks$.next(n);
  }

  protected burst(): void {
    this.click();
    this.subs.add(timer(150).subscribe(() => this.click()));
    this.subs.add(timer(300).subscribe(() => this.click()));
  }

  protected reset(): void {
    this.wire();
    this.t0 = undefined;
    this.marbles.set([]);
    this.nextN.set(1);
  }

  protected marblesOf(lane: number): Marble[] {
    return this.marbles().filter((m) => m.lane === lane);
  }

  protected pos(t: number): number {
    return Math.min(97, 3 + (t / WINDOW_MS) * 94);
  }

  protected color(label: string): string {
    return COLORS[(parseInt(label, 10) - 1) % COLORS.length];
  }
}
