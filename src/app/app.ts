import { Component, inject } from '@angular/core';
import { ThemeService } from './core/theme/theme.service';
import { Shell } from './layout/shell';

@Component({
  selector: 'app-root',
  imports: [Shell],
  template: `<app-shell />`,
})
export class App {
  // Khởi tạo sớm để áp dụng theme ngay khi app chạy.
  private readonly theme = inject(ThemeService);
}
