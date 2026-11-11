import { NgComponentOutlet } from '@angular/common';
import { Component, input, resource } from '@angular/core';
import { DEMO_NAMES, type DemoName } from '../../plugins/demos/demo-names';
import { DEMO_REGISTRY } from '../../plugins/demos/demo-registry';

const isDemoName = (name: string): name is DemoName =>
  (DEMO_NAMES as readonly string[]).includes(name);

/** Lazy-load và hiển thị một demo tương tác theo tên. */
@Component({
  selector: 'app-demo-host',
  imports: [NgComponentOutlet],
  host: { class: 'not-prose my-6 block' },
  template: `
    <section
      class="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30"
    >
      <p
        class="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300"
      >
        Demo tương tác
      </p>
      @if (component.hasValue()) {
        <ng-container *ngComponentOutlet="component.value()" />
      } @else if (component.error()) {
        <p class="text-sm text-red-600">Không tải được demo “{{ name() }}”.</p>
      } @else {
        <p class="text-sm text-slate-500">Đang tải demo…</p>
      }
    </section>
  `,
})
export class DemoHost {
  readonly name = input.required<string>();

  protected readonly component = resource({
    params: () => this.name(),
    loader: ({ params }) => {
      if (!isDemoName(params)) return Promise.reject(new Error(`Demo không tồn tại: ${params}`));
      return DEMO_REGISTRY[params]();
    },
  });
}
