---
title: "Pattern trong Spring, Angular và RxJS — nhận ra pattern để hiểu framework"
summary: "Framework là tập hợp pattern được gọt kỹ: DI container (Factory + Singleton registry), proxy cho @Transactional, template + callback cho JdbcTemplate, chain cho filter và interceptor, observer cho sự kiện, signals và RxJS. Bản đồ pattern ↔ API kèm một template callback chạy được trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, spring, angular, rxjs, framework, inversion-of-control]
related: [design-patterns/consolidate/frameworks/tu-viet-mini-di-container, design-patterns/deep-dive/frameworks/flow-va-backpressure-tu-observer-toi-rxjs]
---

## TL;DR

- **Inversion of Control** (IoC): thay vì code của bạn gọi thư viện, **framework gọi code của bạn** ("Hollywood principle: đừng gọi chúng tôi, chúng tôi sẽ gọi bạn"). Hầu hết pattern trong framework là các cách cụ thể của IoC.
- **DI container** (Spring `ApplicationContext`, Angular `Injector`) = Factory + registry Singleton + tự giải quyết phụ thuộc.
- **Proxy** đứng sau mọi annotation "có phép thuật": `@Transactional`, `@Cacheable`, `@Async`, `@PreAuthorize`.
- **Template + callback**: framework giữ phần lặp lại (mở/đóng tài nguyên, xử lý lỗi), bạn truyền phần thay đổi (`RowMapper`).
- **Chain of Responsibility**: `SecurityFilterChain`, `HandlerInterceptor`, `HttpInterceptorFn` của Angular.
- **Observer**: `ApplicationEvent`, RxJS `Observable`, Angular signals (`effect`, `computed`).

## Bản đồ pattern ↔ API

| Pattern | Spring | Angular | RxJS / JDK |
|---|---|---|---|
| Factory | `@Bean` method, `FactoryBean` | `useFactory` trong provider | `Executors.newFixedThreadPool` |
| Singleton (do container) | Bean scope mặc định | `providedIn: 'root'` | — |
| Proxy | AOP proxy (CGLIB/JDK) | — | `Proxy` |
| Decorator | `BeanPostProcessor` bọc bean | `HttpInterceptorFn` (bọc request) | `pipe(...)` operator |
| Template / callback | `JdbcTemplate`, `RestClient`, `TransactionTemplate` | — | `Collections.sort(list, cmp)` |
| Strategy | `PasswordEncoder`, `HandlerMethodArgumentResolver` | `RouteReuseStrategy`, `ErrorHandler` | `Comparator` |
| Chain | `SecurityFilterChain` | `HttpInterceptorFn` (`next(req)`) | — |
| Observer | `@EventListener` | signals, `EventEmitter`/`output()` | `Observable`, `Flow` |
| Adapter | `HandlerAdapter`, `HttpMessageConverter` | `ControlValueAccessor` | `from(promise)` |
| Front Controller | `DispatcherServlet` | `Router` | — |

## Ví dụ nhanh: template + callback (đã chạy trên JDK 25)

Đây là ý tưởng của `JdbcTemplate.query(sql, rowMapper)`, rút gọn:

```java title="query — khung cố định, callback thay đổi"
static <T> List<T> query(String sql, Function<String, T> rowMapper) {
    try (var kn = new KetNoi()) {                                   // luôn đóng kết nối
        return kn.truyVan(sql).stream().map(rowMapper).toList();
    } catch (IllegalStateException e) {
        throw new RuntimeException("DataAccessException: " + e.getMessage(), e);   // đổi lỗi kỹ thuật
    }
}

query("select ma, ten from khach_hang", d -> { var c = d.split("\\|"); return new KhachHang(c[0], c[1]); });
query("select sai", d -> d);
```

```text
[KhachHang[ma=K1, ten=An], KhachHang[ma=K2, ten=Bình]], kết nối đang mở: 0
DataAccessException: lỗi cú pháp SQL, kết nối đang mở: 0
```

Người gọi không bao giờ quên đóng kết nối hay bắt `SQLException`, vì họ không còn viết phần đó. Đây là Template Method dùng **composition** (truyền hàm) thay vì kế thừa.

## Bảng chọn nhanh: khi framework "không làm như mong đợi"

| Hiện tượng | Pattern bên dưới | Kiểm tra |
|---|---|---|
| `@Transactional`/`@Cacheable` không có tác dụng | Proxy | Gọi từ bean khác? Method `public`, không `final`? |
| Bean được tạo hai lần / không có bean | DI container | Có hai `@Bean` cùng kiểu? Component scan có quét package? |
| Interceptor Angular không chạy cho một request | Chain | Đăng ký trong `provideHttpClient(withInterceptors(...))`? Request đi qua `HttpClient`? |
| Listener chạy trước khi dữ liệu được commit | Observer | Dùng `@TransactionalEventListener(AFTER_COMMIT)`? |
| Subscription RxJS rò rỉ khi rời màn hình | Observer | Có huỷ (`takeUntilDestroyed`, `async` pipe)? |

## Một lỗi hay gặp: gọi `new` một class mà framework quản lý

```java bad
var dv = new DichVuDatHang(kho, tb);   // object ngoài container
dv.datHang(...);                       // @Transactional, @Async... không có tác dụng
```

Object tạo bằng `new` không đi qua container nên không có proxy, không được tiêm phụ thuộc, không có vòng đời. Lấy object từ container (tiêm qua constructor). Ngoại lệ hợp lý: test đơn vị không cần các tính năng đó.

:::version Spring Framework 7 / Angular 22
Spring Framework 7 (Boot 4) vẫn dùng các pattern này; điểm mới là `@Retryable`/`@ConcurrencyLimit` nằm sẵn trong core (vẫn là proxy) và HTTP interface client (`@ImportHttpServices`) — một Proxy sinh từ interface. Angular chuyển từ interceptor dạng class sang **hàm** (`HttpInterceptorFn`) và từ `EventEmitter` sang `output()`/signals — cùng pattern, cú pháp hàm.
:::

:::interview Inversion of Control và Dependency Injection khác nhau thế nào?
IoC là nguyên tắc rộng: quyền điều khiển luồng chuyển từ code của bạn sang framework — framework gọi controller, listener, callback của bạn. DI là **một cách** thực hiện IoC cho việc tạo object: thay vì class tự `new` phụ thuộc hoặc tự tìm (Service Locator), phụ thuộc được đưa vào từ ngoài (qua constructor). Template callback, event listener, filter chain cũng là IoC nhưng không phải DI.
:::

:::quiz `JdbcTemplate.query(sql, rowMapper)` là ví dụ của pattern nào?
- [ ] Singleton
- [x] Template Method (dạng callback): khung cố định, phần đổi dòng thành object do người gọi truyền vào
- [ ] Adapter
- [ ] Observer

Framework lo mở/đóng kết nối và đổi `SQLException`; bạn chỉ viết `RowMapper`. Đã chạy: kết nối luôn đóng, kể cả khi SQL lỗi.
:::

:::quiz Vì sao `@Transactional` không có tác dụng trên object tạo bằng `new DichVuDatHang(...)`?
- [ ] Vì thiếu `@Service`
- [x] Vì object không do container tạo nên không được bọc bởi proxy
- [ ] Vì constructor có tham số
- [ ] Vì transaction chỉ chạy trong test

Annotation chỉ là dữ liệu; proxy do container sinh ra mới là thứ đọc annotation và mở transaction.
:::
