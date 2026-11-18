import { provideHttpClient } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  type NavigationError,
  provideRouter,
  withComponentInputBinding,
  withNavigationErrorHandler,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { isChunkLoadError, reloadForNewVersion } from './core/chunk-reload';
import { CloudSyncService } from './core/sync/cloud-sync.service';

/** Chunk của bản build cũ không còn (vừa deploy bản mới): tải lại đúng trang người dùng định mở. */
function onNavigationError(e: NavigationError): void {
  if (isChunkLoadError(e.error))
    reloadForNewVersion(new URL(e.url.replace(/^\//, ''), document.baseURI).href);
}

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
      withNavigationErrorHandler(onNavigationError),
    ),
  ],
};
