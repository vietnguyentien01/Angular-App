import {
  Component,
  type ElementRef,
  afterRenderEffect,
  computed,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

/**
 * Demo: signal / computed / effect.
 * - `double` đếm số lần thực sự được tính lại.
 * - `isEven` cho thấy memoize: đổi 2 → 4 thì consumer phía sau không bị tính lại.
 * - effect ghi log trực tiếp vào DOM (đúng vai trò "đồng bộ ra ngoài").
 */
@Component({
  selector: 'app-signals-counter-demo',
  template: `
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="demo-btn" (click)="count.update(inc1)">+1</button>
          <button type="button" class="demo-btn" (click)="count.update(inc2)">+2</button>
          <button type="button" class="demo-btn" (click)="count.set(count())">
            set(cùng giá trị)
          </button>
          <button type="button" class="demo-btn-ghost" (click)="reset()">Reset</button>
        </div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
          <dt class="text-slate-500">count()</dt>
          <dd>{{ count() }}</dd>
          <dt class="text-slate-500">double()</dt>
          <dd>
            {{ double() }} <span class="text-xs text-slate-500">(tính {{ doubleRuns }} lần)</span>
          </dd>
          <dt class="text-slate-500">isEven()</dt>
          <dd>{{ isEven() }}</dd>
          <dt class="text-slate-500">label()</dt>
          <dd>
            {{ label() }} <span class="text-xs text-slate-500">(tính {{ labelRuns }} lần)</span>
          </dd>
        </dl>
        <p class="text-xs text-slate-500">
          Thử bấm <strong>+2</strong>: <code>isEven</code> giữ nguyên nên <code>label</code> không
          bị tính lại. Bấm <strong>set(cùng giá trị)</strong>: không có gì chạy lại.
        </p>
      </div>
      <div>
        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">effect log</p>
        <pre
          #log
          class="h-40 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300"
          aria-live="polite"
        ></pre>
      </div>
    </div>
  `,
})
export class SignalsCounterDemo {
  protected readonly count = signal(0);
  protected doubleRuns = 0;
  protected labelRuns = 0;

  protected readonly double = computed(() => {
    this.doubleRuns++;
    return this.count() * 2;
  });
  protected readonly isEven = computed(() => this.count() % 2 === 0);
  protected readonly label = computed(() => {
    this.labelRuns++;
    return this.isEven() ? 'chẵn' : 'lẻ';
  });

  private readonly log = viewChild.required<ElementRef<HTMLPreElement>>('log');
  private runs = 0;

  protected readonly inc1 = (c: number) => c + 1;
  protected readonly inc2 = (c: number) => c + 2;

  constructor() {
    // afterRenderEffect: chạy sau khi DOM đã render, nên viewChild chắc chắn có giá trị.
    afterRenderEffect(() => {
      const value = this.count();
      const el = untracked(this.log).nativeElement;
      el.textContent = `#${++this.runs} effect chạy: count = ${value}\n` + el.textContent;
    });
  }

  protected reset(): void {
    this.count.set(0);
  }
}
