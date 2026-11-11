---
title: Một bản build cho nhiều môi trường, proxy khi dev và phân tích bundle
summary: Tải config.json lúc khởi động bằng provideAppInitializer, proxy.conf.json để tránh CORS khi dev, và tìm nguyên nhân bundle phình to.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [cli, config, proxy, bundle]
related: [angular/review/cli-project/cli-va-angular-json, angular/deep-dive/performance/do-luong-profiling]
---

## 1. Cấu hình runtime: build một lần, chạy mọi môi trường

```json title="public/config.json (mỗi môi trường thay file này khi deploy)"
{ "apiBaseUrl": "https://api-uat.example.gov.vn", "sso": { "issuer": "https://sso-uat.example.gov.vn" } }
```

```ts title="app-config.ts"
export interface AppConfig {
  apiBaseUrl: string;
  sso: { issuer: string };
}

@Service()
export class AppConfigStore {
  private readonly _config = signal<AppConfig | undefined>(undefined);
  get config(): AppConfig {
    const c = this._config();
    if (!c) throw new Error('AppConfig chưa được tải');
    return c;
  }
  async load() {
    const res = await fetch('config.json', { cache: 'no-store' });
    this._config.set(await res.json());
  }
}

// app.config.ts
providers: [provideAppInitializer(() => inject(AppConfigStore).load())];
```

App chờ initializer xong mới bootstrap → mọi service đọc `config` an toàn. Một artifact đi qua dev → UAT → prod, đúng tinh thần "build once, deploy many".

## 2. Proxy khi dev

```json title="proxy.conf.json"
{
  "/api": { "target": "http://localhost:8080", "secure": false, "changeOrigin": true }
}
```

```json title="angular.json → serve.options"
"proxyConfig": "proxy.conf.json"
```

Trình duyệt gọi `http://localhost:4200/api/...` (cùng origin) → dev server chuyển tiếp tới backend. Không cần bật CORS trên backend chỉ để dev, và cookie/XSRF hoạt động giống production hơn.

## 3. Bundle phình — tìm nguyên nhân

```bash
ng build --stats-json
# mở dist/<app>/stats.json bằng esbuild bundle analyzer (esbuild.github.io/analyze)
```

Thủ phạm hay gặp: import cả thư viện (`lodash`, `moment` + mọi locale), thư viện chart/PDF/Excel nằm trong main bundle thay vì chunk lazy, icon set import toàn bộ.

:::quiz Vì sao dùng `cache: 'no-store'` khi tải `config.json`?
- [ ] Để tải nhanh hơn
- [x] Tránh trình duyệt/CDN trả bản cũ sau khi đổi cấu hình môi trường
- [ ] Bắt buộc với fetch
- [ ] Để bảo mật

Cấu hình đổi mà người dùng vẫn nhận bản cache cũ là lỗi rất khó debug.
:::

:::quiz Proxy của dev server giúp gì so với gọi thẳng `http://localhost:8080`?
- [ ] Backend chạy nhanh hơn
- [x] Request đi cùng origin với app → không bị CORS chặn khi dev, giống cấu hình reverse proxy trên production
- [ ] Tự mã hoá request
- [ ] Không cần backend

Proxy chỉ dành cho `ng serve`; production dùng reverse proxy (nginx…) hoặc API cùng domain.
:::

:::exercise Không lộ cấu hình nhạy cảm
Một đồng nghiệp đề xuất đưa `clientSecret` của SSO vào `config.json`. Bạn phản hồi thế nào?
???
`config.json` là file tĩnh, **ai cũng tải được** — mọi thứ trong bundle hay file public của SPA đều công khai. SPA là "public client": không được giữ secret. Dùng luồng Authorization Code + PKCE (không cần client secret), hoặc BFF giữ secret phía server. `config.json` chỉ chứa thông tin công khai (URL, client id, feature flag).
:::
