import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { cleanReloadParam, installChunkErrorListener } from './app/core/chunk-reload';

// Phải chạy trước bootstrap để router không thấy tham số chống cache.
cleanReloadParam();
installChunkErrorListener();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
