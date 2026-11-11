import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import type { Manifest } from './core/content/content.models';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('hiển thị tên app và môn học từ manifest trên sidebar', async () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    // Không dùng whenStable ở đây: request đang chờ cũng được tính là "chưa ổn định".
    TestBed.tick();

    const manifest: Manifest = {
      schemaVersion: 1,
      generatedAt: '2026-11-11T00:00:00Z',
      updateCount: 0,
      subjects: [
        {
          id: 'angular',
          title: 'Angular',
          description: 'd',
          icon: 'angular',
          color: '#dd0031',
          order: 1,
          sections: [
            { id: 'review', title: 'Ôn lại Core', description: 'd', icon: 'refresh', itemCount: 3 },
          ],
          topicCount: 1,
          itemCount: 3,
        },
      ],
    };
    http.expectOne('data/manifest.json').flush(manifest);
    http.match('data/updates/index.json').forEach((r) => r.flush({ updates: [] }));
    await Promise.resolve();
    TestBed.tick();
    http
      .match('data/angular/index.json')
      .forEach((r) => r.flush({ subject: manifest.subjects[0], topics: [], items: [] }));
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Learning Hub');
    expect(text).toContain('Angular');
    expect(text).toContain('Ôn lại Core');
  });
});
