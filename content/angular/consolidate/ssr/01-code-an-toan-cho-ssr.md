---
title: Viết code an toàn cho SSR
summary: Bọc API trình duyệt sau InjectionToken, chuyển dữ liệu server → client bằng TransferState, PendingTasks cho tác vụ server phải chờ, và tải thư viện chỉ chạy trên trình duyệt.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [ssr, platform, transferstate, pendingtasks]
related: [angular/review/ssr/ssr-ssg-hydration-co-ban, angular/deep-dive/ssr/incremental-hydration-va-render-mode]
---

## 1. Không chạm `window` trực tiếp

```ts bad
@Service()
export class ThemeService {
  readonly dark = signal(window.matchMedia('(prefers-color-scheme: dark)').matches); // crash trên server
}
```

```ts good
export const BROWSER_STORAGE = new InjectionToken<Storage | null>('BROWSER_STORAGE', {
  factory: () => (isPlatformBrowser(inject(PLATFORM_ID)) ? localStorage : null),
});

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT); // có trên cả server (DOM giả lập)
  readonly dark = signal(false);
  constructor() {
    afterNextRender(() => this.dark.set(matchMedia('(prefers-color-scheme: dark)').matches));
  }
}
```

## 2. Chuyển dữ liệu server → client

`HttpClient` đã có transfer cache mặc định cho GET. Với dữ liệu tự tính (không qua HttpClient):

```ts
const KEY = makeStateKey<Stats>('stats');

export class StatsPanel {
  private readonly state = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID)); // inject ở field, KHÔNG trong callback
  private readonly tasks = inject(PendingTasks);
  readonly stats = signal<Stats | undefined>(this.state.get(KEY, undefined));

  constructor() {
    if (this.stats()) return; // client: đã có dữ liệu do server gửi kèm HTML
    this.tasks.run(async () => {
      const s = await computeStats();
      this.stats.set(s);
      if (this.isServer) this.state.set(KEY, s); // server ghi vào HTML
    });
  }
}
```

## 3. Server phải chờ tác vụ bất đồng bộ

Khi zoneless, server không "đoán" được bạn đang chờ gì. Báo cho Angular bằng `PendingTasks`:

```ts
private readonly tasks = inject(PendingTasks);

load() {
  this.tasks.run(async () => {
    this.data.set(await fetchFromCache());
  }); // server đợi task xong mới serialize HTML
}
```

(`HttpClient`, `resource`, `httpResource` đã tự đăng ký pending task.)

## 4. Thư viện chỉ chạy trên trình duyệt

```ts
afterNextRender(async () => {
  const { default: Chart } = await import('chart.js/auto'); // không bị import khi render server
  this.chart = new Chart(this.canvas().nativeElement, this.config());
});
```

:::quiz Vì sao `inject(DOCUMENT)` an toàn trên server còn `window` thì không?
- [ ] `DOCUMENT` là Observable
- [x] Khi SSR, Angular cung cấp một DOM giả lập cho `DOCUMENT`; còn biến toàn cục `window` không tồn tại trong môi trường Node
- [ ] `window` bị cấm trong Angular
- [ ] Không khác

Dùng `DOCUMENT` thay vì `document` toàn cục là thói quen tốt cho cả SSR lẫn test.
:::

:::quiz Một service tự dùng `fetch` (không qua HttpClient) để lấy dữ liệu khi render server. Trang trả về thiếu dữ liệu. Nguyên nhân khả dĩ?
- [ ] `fetch` không chạy trên Node
- [x] Angular không biết phải chờ tác vụ đó; cần bọc bằng `PendingTasks.run()` (hoặc dùng HttpClient/resource)
- [ ] Thiếu `withEventReplay()`
- [ ] Do incremental hydration

HttpClient và resource tự báo pending task; code tự viết thì phải tự báo.
:::

:::exercise Rà soát SSR
Liệt kê các vấn đề khi bật SSR cho component sau và cách sửa:
```ts
export class Header {
  width = window.innerWidth;
  token = localStorage.getItem('token');
  ngOnInit() { setInterval(() => this.now = new Date(), 1000); }
}
```
???
1. `window.innerWidth` → crash trên server: đọc trong `afterNextRender`, lưu vào signal.
2. `localStorage` → crash trên server: dùng token `BROWSER_STORAGE` (null trên server) hoặc đọc sau render.
3. `setInterval` trong `ngOnInit` chạy cả trên server → server có thể không bao giờ "ổn định" và tốn tài nguyên; chỉ khởi động timer trên trình duyệt (`afterNextRender`) và dọn bằng `DestroyRef`.
4. `now` thay đổi theo thời gian → nội dung server và client khác nhau (nguy cơ hydration mismatch): chỉ render đồng hồ phía client.
:::
