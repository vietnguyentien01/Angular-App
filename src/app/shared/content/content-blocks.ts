import { Component, input } from '@angular/core';
import type { ContentBlock } from '../../core/content/content.models';
import { ContentLinksDirective } from './content-links.directive';
import { DemoHost } from './demo-host';
import { TrustedContentHtmlPipe } from './trusted-html.pipe';

/** Render danh sách block nội dung: HTML đã build sẵn xen kẽ demo tương tác. */
@Component({
  selector: 'app-content-blocks',
  imports: [TrustedContentHtmlPipe, DemoHost, ContentLinksDirective],
  host: { class: 'block' },
  template: `
    <div class="content-prose" appContentLinks>
      @for (block of blocks(); track $index) {
        @switch (block.kind) {
          @case ('html') {
            <div [innerHTML]="block.html | trustedContentHtml"></div>
          }
          @case ('demo') {
            <app-demo-host [name]="block.name" />
          }
        }
      }
    </div>
  `,
})
export class ContentBlocks {
  readonly blocks = input.required<ContentBlock[]>();
}
