import { Component, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ContentService } from '../core/content/content.service';
import { UpdatesReadService } from '../core/updates/updates-read.service';
import { Icon } from '../shared/icon/icon';

@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, Icon],
  host: { class: 'flex h-full flex-col' },
  template: `
    <nav class="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Điều hướng chính">
      <ul class="space-y-1">
        <li>
          <a
            routerLink="/"
            routerLinkActive="nav-active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="nav-link"
            (click)="navigate.emit()"
          >
            <app-icon name="home" [size]="18" /> Tổng quan
          </a>
        </li>
        <li>
          <a
            routerLink="/updates"
            routerLinkActive="nav-active"
            class="nav-link"
            (click)="navigate.emit()"
          >
            <app-icon name="bell" [size]="18" />
            <span class="flex-1">Frontend mới</span>
            @if (updatesRead.unread() > 0) {
              <span
                class="rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white"
                [attr.aria-label]="updatesRead.unread() + ' bản tin chưa đọc'"
              >
                {{ updatesRead.unread() }}
              </span>
            }
          </a>
        </li>
      </ul>

      <div>
        <p
          class="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          Môn học
        </p>
        <ul class="space-y-3">
          @for (subject of content.subjects(); track subject.id) {
            <li>
              <a
                [routerLink]="['/', subject.id]"
                routerLinkActive="nav-active"
                [routerLinkActiveOptions]="{ exact: true }"
                class="nav-link font-semibold"
                (click)="navigate.emit()"
              >
                <span
                  class="grid size-6 place-items-center rounded-md text-white"
                  [style.background-color]="subject.color"
                >
                  <app-icon [name]="subject.icon" [size]="14" />
                </span>
                {{ subject.title }}
              </a>
              <ul
                class="mt-1 space-y-0.5 border-l border-slate-200 pl-2 ml-5 dark:border-slate-700"
              >
                @if (subject.hasRoadmap) {
                  <li>
                    <a
                      [routerLink]="['/', subject.id, 'roadmap']"
                      routerLinkActive="nav-active"
                      class="nav-link text-sm"
                      (click)="navigate.emit()"
                    >
                      <app-icon name="route" [size]="16" />
                      <span class="flex-1">Lộ trình</span>
                    </a>
                  </li>
                }
                @for (section of subject.sections; track section.id) {
                  <li>
                    <a
                      [routerLink]="['/', subject.id, section.id]"
                      routerLinkActive="nav-active"
                      class="nav-link text-sm"
                      (click)="navigate.emit()"
                    >
                      <app-icon [name]="section.icon" [size]="16" />
                      <span class="flex-1">{{ section.title }}</span>
                      <span class="text-xs text-slate-400">{{ section.itemCount }}</span>
                    </a>
                  </li>
                }
                @if (subject.quizCount) {
                  <li>
                    <a
                      [routerLink]="['/', subject.id, 'practice']"
                      routerLinkActive="nav-active"
                      class="nav-link text-sm"
                      (click)="navigate.emit()"
                    >
                      <app-icon name="target" [size]="16" />
                      <span class="flex-1">Luyện tập</span>
                      <span class="text-xs text-slate-400">{{ subject.quizCount }}</span>
                    </a>
                  </li>
                }
              </ul>
            </li>
          } @empty {
            @if (content.manifest.isLoading()) {
              <li class="px-3 text-sm text-slate-400">Đang tải…</li>
            }
          }
        </ul>
      </div>
    </nav>

    <div class="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
      <a
        routerLink="/settings"
        routerLinkActive="nav-active"
        class="nav-link"
        (click)="navigate.emit()"
      >
        <app-icon name="settings" [size]="18" /> Cài đặt & dữ liệu
      </a>
    </div>
  `,
})
export class SidebarNav {
  protected readonly content = inject(ContentService);
  protected readonly updatesRead = inject(UpdatesReadService);
  readonly navigate = output();
}
