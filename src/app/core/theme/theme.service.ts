import { DOCUMENT, Service, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'lh-theme';

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly mode = signal<ThemeMode>(readStored());

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemDark.set(e.matches));

    // Side effect hợp lệ: đồng bộ state ra DOM và localStorage.
    effect(() => {
      const mode = this.mode();
      const dark = mode === 'dark' || (mode === 'system' && this.systemDark());
      this.document.documentElement.classList.toggle('dark', dark);
      this.document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      try {
        localStorage.setItem(KEY, mode);
      } catch {
        /* bỏ qua khi trình duyệt chặn storage */
      }
    });
  }

  cycle(): void {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    this.mode.update((m) => order[(order.indexOf(m) + 1) % order.length]);
  }
}
