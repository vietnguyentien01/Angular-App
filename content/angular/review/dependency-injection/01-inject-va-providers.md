---
title: inject(), @Service và các loại provider
summary: Cách lấy dependency, đăng ký service singleton theo kiểu Angular 22, và 4 loại provider useClass/useValue/useFactory/useExisting.
type: card
level: core
version: 22
lastReviewed: 2026-11-11
tags: [di, inject, provider]
related: [angular/review/dependency-injection/injector-hierarchy, angular/consolidate/dependency-injection/injectiontoken-multi-factory]
---

## TL;DR

- `inject(Token)` — lấy dependency trong **injection context** (constructor, field initializer, factory của provider).
- `@Service()` — cách khuyến nghị từ Angular 22 để khai báo service **singleton tự đăng ký** (tương đương `@Injectable({ providedIn: 'root' })`).
- Provider trả lời câu hỏi: *"Khi ai đó xin Token này, đưa cho họ cái gì?"*

```ts title="user.service.ts"
@Service()
export class UserService {
  private readonly http = inject(HttpClient);
  readonly me = httpResource<User>(() => '/api/me');
}
```

## 4 loại provider

| Provider | Ý nghĩa | Ví dụ |
|---|---|---|
| `useClass` | Tạo instance của class khác | `{ provide: Logger, useClass: ConsoleLogger }` |
| `useValue` | Dùng giá trị có sẵn | `{ provide: API_URL, useValue: '/api' }` |
| `useFactory` | Gọi hàm để tạo (có thể `inject` bên trong) | `{ provide: Storage, useFactory: () => isBrowser() ? localStorage : memory }` |
| `useExisting` | Bí danh tới một token khác (cùng instance) | `{ provide: AbstractLogger, useExisting: ConsoleLogger }` |

:::version v16 Ở Angular 16 / 19
Code v16 thường dùng **constructor injection**: `constructor(private http: HttpClient) {}` và `@Injectable({ providedIn: 'root' })`. Cả hai vẫn chạy ở v22. `inject()` có từ v14 và là cách viết được khuyến nghị; `@Service()` là mới của v22.
:::

:::quiz Đâu là nơi KHÔNG gọi được `inject()`?
- [ ] Field initializer: `private http = inject(HttpClient)`
- [ ] Constructor
- [x] Bên trong method `onClick()` được gọi khi người dùng bấm nút
- [ ] Hàm `useFactory` của một provider

`inject()` chỉ chạy trong injection context — lúc Angular đang tạo đối tượng. Trong event handler thì context đã kết thúc → lỗi `NG0203`.
:::

:::quiz `{ provide: A, useExisting: B }` và `{ provide: A, useClass: B }` khác nhau thế nào?
- [ ] Không khác gì
- [x] `useExisting` trả về **cùng instance** đã đăng ký cho B; `useClass` tạo **instance mới** của B cho token A
- [ ] `useExisting` chỉ dùng cho giá trị nguyên thuỷ
- [ ] `useClass` không cho phép inject trong B

`useExisting` là bí danh. Với `useClass`, xin `A` và xin `B` sẽ ra hai object khác nhau.
:::

:::quiz Một service đánh dấu `@Service()` nhưng không ai `inject` nó. Nó có nằm trong bundle không?
- [ ] Có, luôn luôn
- [x] Không — service tự đăng ký kiểu này tree-shake được nếu không được dùng
- [ ] Chỉ khi build dev
- [ ] Tuỳ vào thứ tự import

Đây là lý do nên ưu tiên `@Service()` / `providedIn: 'root'` thay vì liệt kê trong `providers` của `app.config.ts`.
:::
