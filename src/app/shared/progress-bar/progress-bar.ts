import { Component, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  host: { class: 'block' },
  template: `
    <div
      class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      role="progressbar"
      [attr.aria-valuenow]="percent()"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-label]="label()"
    >
      <div
        class="h-full rounded-full transition-[width] duration-500"
        [style.width.%]="percent()"
        [style.background-color]="color()"
      ></div>
    </div>
  `,
})
export class ProgressBar {
  readonly percent = input.required<number>();
  readonly color = input('#4f46e5');
  readonly label = input('Tiến độ');
}
