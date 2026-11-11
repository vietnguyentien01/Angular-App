import type { Routes } from '@angular/router';

/**
 * Route theo mô hình nội dung: /:subject/:section/:topic/:slug.
 * Route cố định (updates, settings) phải đứng trước route động.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Tổng quan · Learning Hub',
    loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
  },
  {
    path: 'updates',
    title: 'Frontend mới · Learning Hub',
    loadComponent: () => import('./features/updates/updates-page').then((m) => m.UpdatesPage),
  },
  {
    path: 'updates/:id',
    loadComponent: () =>
      import('./features/updates/update-detail-page').then((m) => m.UpdateDetailPage),
  },
  {
    path: 'settings',
    title: 'Cài đặt · Learning Hub',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  {
    path: ':subject',
    title: 'Môn học · Learning Hub',
    loadComponent: () => import('./features/subject/subject-page').then((m) => m.SubjectPage),
  },
  {
    path: ':subject/:section',
    title: 'Learning Hub',
    loadComponent: () => import('./features/subject/section-page').then((m) => m.SectionPage),
  },
  {
    path: ':subject/:section/:topic/:slug',
    loadComponent: () => import('./features/lesson/lesson-page').then((m) => m.LessonPage),
  },
  {
    path: '**',
    title: 'Không tìm thấy · Learning Hub',
    loadComponent: () => import('./shared/page-state/page-state').then((m) => m.PageState),
  },
];
