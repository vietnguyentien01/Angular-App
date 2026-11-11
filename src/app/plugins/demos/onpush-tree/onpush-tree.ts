import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  type ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';

interface Data {
  count: number;
}

/**
 * Đếm số lần template của một component thực sự được Angular kiểm tra.
 * Ghi thẳng vào DOM (không qua binding) để không gây ExpressionChangedAfterItHasBeenChecked.
 * Lưu ý: ở dev mode, Angular kiểm tra thêm một lượt (checkNoChanges) nên số đếm có thể gấp đôi.
 */
@Directive()
abstract class Probe {
  private checks = 0;
  private readonly counter = viewChild<ElementRef<HTMLElement>>('counter');
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  protected probe(): string {
    this.checks++;
    const counter = this.counter()?.nativeElement;
    const box = this.box()?.nativeElement;
    if (counter) counter.textContent = String(this.checks);
    if (box) {
      box.classList.remove('cd-flash');
      void box.offsetWidth; // khởi động lại animation
      box.classList.add('cd-flash');
    }
    return '';
  }
}

@Component({
  selector: 'app-cd-eager-child',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div #box class="cd-node" [attr.data-probe]="probe()">
      <p class="cd-title">Eager</p>
      <p>data.count = {{ data().count }}</p>
      <p class="cd-meta">được check: <span #counter>0</span> lần</p>
    </div>
  `,
})
class EagerChild extends Probe {
  readonly data = input.required<Data>();
}

@Component({
  selector: 'app-cd-onpush-child',
  template: `
    <div #box class="cd-node" [attr.data-probe]="probe()">
      <p class="cd-title">OnPush (input)</p>
      <p>data.count = {{ data().count }}</p>
      <p class="cd-meta">được check: <span #counter>0</span> lần</p>
    </div>
  `,
})
class OnPushChild extends Probe {
  readonly data = input.required<Data>();
}

@Component({
  selector: 'app-cd-signal-child',
  template: `
    <div #box class="cd-node" [attr.data-probe]="probe()">
      <p class="cd-title">OnPush (signal)</p>
      <p>tick() = {{ tick()() }}</p>
      <p class="cd-meta">được check: <span #counter>0</span> lần</p>
    </div>
  `,
})
class SignalChild extends Probe {
  readonly tick = input.required<() => number>();
}

/** Demo: thao tác nào làm component nào được change detection kiểm tra. */
@Component({
  selector: 'app-onpush-tree-demo',
  imports: [EagerChild, OnPushChild, SignalChild],
  template: `
    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        <button type="button" class="demo-btn" (click)="noop()">Click ở parent</button>
        <button type="button" class="demo-btn" (click)="replace()">Input: tham chiếu mới</button>
        <button type="button" class="demo-btn" (click)="mutate()">Input: mutate</button>
        <button type="button" class="demo-btn" (click)="bump()">Đổi signal (sau 1 giây)</button>
      </div>
      <div class="cd-node cd-root">
        <p class="cd-title">Parent (OnPush) · data.count thật = {{ data.count }}</p>
        <div class="mt-2 grid gap-2 sm:grid-cols-3">
          <app-cd-eager-child [data]="data" />
          <app-cd-onpush-child [data]="data" />
          <app-cd-signal-child [tick]="tick" />
        </div>
      </div>
      <p class="text-xs text-slate-500">
        Ô nhấp nháy = template vừa được kiểm tra. Thử <strong>mutate</strong>: con OnPush (input)
        vẫn hiện số cũ vì tham chiếu không đổi. Thử <strong>Đổi signal</strong>: lúc bấm, Eager nhấp
        nháy (click là event của parent); 1 giây sau signal đổi ngoài event → chỉ con đọc signal
        được kiểm tra.
      </p>
    </div>
  `,
})
export class OnPushTreeDemo {
  protected data: Data = { count: 0 };
  protected readonly tick = signal(0);

  protected noop(): void {
    // Không đổi gì: chỉ là một event trong template của parent.
  }

  protected replace(): void {
    this.data = { count: this.data.count + 1 };
  }

  protected mutate(): void {
    this.data.count++;
  }

  /**
   * Đổi signal NGOÀI event handler: bản thân cú click vẫn làm parent dirty,
   * nhưng 1 giây sau, khi signal đổi, chỉ view đọc signal được kiểm tra.
   */
  protected bump(): void {
    setTimeout(() => this.tick.update((t) => t + 1), 1000);
  }
}
