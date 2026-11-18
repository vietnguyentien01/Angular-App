import { provideHttpClient } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { CloudSyncService } from './core/sync/cloud-sync.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Lưu tiến độ theo tài khoản (Firestore) khi đã cấu hình Firebase.
    provideAppInitializer(() => inject(CloudSyncService).start()),
    // Angular 22: FetchBackend là mặc định, không cần withFetch() (đã deprecated).
    provideHttpClient(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      withViewTransitions(),
    ),
  ],
};
