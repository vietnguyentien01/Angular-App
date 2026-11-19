---
title: "Bên trong một request Spring MVC — filter, DispatcherServlet, interceptor, API versioning và virtual thread"
summary: "Theo dấu một request qua filter, DispatcherServlet, HandlerMapping, interceptor, argument resolver, controller và message converter; thử API versioning mới của Spring Framework 7 qua header; và bật virtual thread cho Tomcat bằng một dòng cấu hình. Chạy thật trên Spring Boot 4.1.2."
level: advanced
version: 4
lastReviewed: 2026-11-19
tags: [spring-boot, spring-mvc, internals, api-versioning, virtual-threads]
related: [spring-boot/consolidate/web/xu-ly-loi-api-voi-problemdetail, spring-boot/deep-dive/security/security-filter-chain-va-cors]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

## Tóm tắt nhanh

- Request đi qua **Servlet filter** (Spring Security nằm ở đây) → **`DispatcherServlet`** → **HandlerMapping** chọn method → **interceptor** → **argument resolver** dựng tham số → controller → **message converter** (Jackson) ghi JSON.
- Filter thấy mọi request, kể cả request không tới controller; interceptor biết **handler** nào sẽ chạy. Logic theo endpoint (đo thời gian, kiểm tra header theo route) đặt ở interceptor; logic chung (log, security, CORS) đặt ở filter.
- Spring Framework 7 có **API versioning** sẵn: `@GetMapping(path = …, version = "2")` + cấu hình nơi đọc version (header, query, path, media type).
- `spring.threads.virtual.enabled=true` → mỗi request chạy trên một **virtual thread** (cần Java 21+).

## Cơ chế: theo dấu một request

```text
HTTP  ─► Tomcat ─► Filter chain (CharacterEncoding, Security, CORS, filter của bạn…)
                      └─► DispatcherServlet
                            ├─ HandlerMapping: URL + method + version → HandlerMethod
                            ├─ HandlerInterceptor.preHandle
                            ├─ HandlerAdapter:
                            │    ├─ argument resolver: @PathVariable, @RequestParam, @RequestBody (+ @Valid), Pageable…
                            │    ├─ gọi method controller
                            │    └─ return value handler + HttpMessageConverter (Jackson) → body
                            ├─ (exception?) HandlerExceptionResolver → @ExceptionHandler / ProblemDetail
                            └─ HandlerInterceptor.afterCompletion
```

Ghi log ở từng tầng với một filter và một interceptor tự viết (profile `lab-web` của dự án mẫu):

```java
@Component
class GhiLogFilter extends OncePerRequestFilter {
    @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) … {
        log.info("Filter trước — thread {}", Thread.currentThread());
        chain.doFilter(req, res);
        log.info("Filter sau — status {}", res.getStatus());
    }
}

@Override public void addInterceptors(InterceptorRegistry r) {
    r.addInterceptor(new HandlerInterceptor() {
        @Override public boolean preHandle(HttpServletRequest q, HttpServletResponse s, Object handler) {
            log.info("Interceptor preHandle — handler {}", handler); return true;
        }
        @Override public void afterCompletion(HttpServletRequest q, HttpServletResponse s, Object h, Exception ex) {
            log.info("Interceptor afterCompletion");
        }
    });
}
```

`GET /lab/xin-chao?ten=An` (đã chạy):

```text
Filter trước — thread Thread[#37,http-nio-8080-exec-1,5,main]
Interceptor preHandle — handler vn.hoc.donhang.lab.LuongRequestLab$LabController#xinChao(String)
Controller chạy
Interceptor afterCompletion
Filter sau — status 200
```

Filter chạy **trước** khi Spring biết handler là gì; interceptor nhận được `HandlerMethod` (đọc được annotation trên method). Response body đã được ghi trước `afterCompletion`, nên muốn sửa body thì phải dùng `ResponseBodyAdvice`, không phải interceptor.

## API versioning (Spring Framework 7)

```java
@GetMapping(path = "/khach-hang/{id}", version = "1")
Map<String, Object> v1(@PathVariable long id) { return Map.of("id", id, "hoTen", "Nguyễn An"); }

@GetMapping(path = "/khach-hang/{id}", version = "2")
Map<String, Object> v2(@PathVariable long id) { return Map.of("id", id, "ho", "Nguyễn", "ten", "An"); }
```

```yaml
spring:
  mvc:
    apiversion:
      use:
        header: API-Version
      default: "1"
```

```text
(không có header)  → 200 {"id":7,"hoTen":"Nguyễn An"}
API-Version: 1     → 200 {"id":7,"hoTen":"Nguyễn An"}
API-Version: 2     → 200 {"ho":"Nguyễn","id":7,"ten":"An"}
API-Version: 3     → 400 {"detail":"Invalid API version: '3.0.0'.", …}
```

Version được phân tích dạng *semantic version* (`3` thành `3.0.0`). Version là một điều kiện của HandlerMapping, giống method HTTP hay URL. Trước Spring 7, versioning phải tự làm bằng đường dẫn `/v2/...` hoặc điều kiện tuỳ biến. Cách đọc version (header, query, path segment, media type) là quyết định thiết kế — với API cho frontend Angular nội bộ, header hoặc path đều ổn; với API công khai, path (`/v2/`) dễ cache và dễ tài liệu hoá hơn.

## Virtual thread cho Tomcat

```text
spring.threads.virtual.enabled=false:  Filter trước — thread Thread[#37,http-nio-8080-exec-1,5,main]
spring.threads.virtual.enabled=true:   Filter trước — thread VirtualThread[#42,tomcat-handler-0]/runnable@ForkJoinPool-1-worker-1
```

Mặc định Tomcat có pool tối đa 200 thread; request thứ 201 chờ trong hàng đợi. Với virtual thread, mỗi request một thread rẻ, phù hợp ứng dụng chờ I/O nhiều (gọi DB, gọi dịch vụ khác). Giới hạn thật lúc đó nằm ở pool kết nối DB (HikariCP mặc định 10 kết nối) — xem môn Java, bài *Virtual thread và structured concurrency* về pinning và giới hạn tài nguyên.

## So sánh phương án

| Cần | Nơi đặt |
|---|---|
| Log mọi request, gắn traceId vào MDC | Filter |
| Xác thực, CORS | Filter (Spring Security) |
| Kiểm tra theo annotation trên method | Interceptor (`HandlerMethod.getMethodAnnotation`) |
| Sửa body trả về chung (bọc envelope) | `ResponseBodyAdvice` (hạn chế dùng) |
| Biến exception thành response | `@RestControllerAdvice` |
| Tham số tuỳ biến (vd `@NguoiDungHienTai`) | `HandlerMethodArgumentResolver` |
| Nhiều version của API | `version` trong mapping (Spring 7) hoặc path `/v2` |

## Tính năng mới theo phiên bản

- **Spring Framework 6 / Boot 3**: `ProblemDetail`, Jakarta EE 9+ (`jakarta.servlet`).
- **Boot 3.2**: `spring.threads.virtual.enabled`.
- **Spring Framework 7 / Boot 4**: API versioning trong `@RequestMapping` và cấu hình `spring.mvc.apiversion.*`; Jackson 3 là mặc định.

:::senior Góc nhìn senior
Hiểu luồng request giúp chọn đúng chỗ cho cross-cutting concern và debug nhanh: lỗi 401 trước khi vào controller → nhìn filter chain; tham số luôn `null` → argument resolver / tên tham số; JSON sai định dạng ngày → message converter (cấu hình Jackson). Với versioning, chiến lược quan trọng hơn kỹ thuật: thêm field là thay đổi tương thích (không cần version mới); đổi tên, xoá field, đổi nghĩa mới cần version — và cần lịch ngừng hỗ trợ version cũ.
:::

:::quiz Bạn cần đo thời gian xử lý của từng endpoint và gắn tên method controller vào metric. Đặt ở đâu?
- [ ] Servlet filter — vì chạy trước mọi thứ
- [x] HandlerInterceptor — có `HandlerMethod` để biết method nào đang chạy
- [ ] Trong từng method controller
- [ ] `@ControllerAdvice`

Filter chưa biết handler. Thực tế Spring Boot Actuator đã đo sẵn metric `http.server.requests` theo `uri` template (bài *Vận hành production*).
:::

:::quiz Ứng dụng Spring Boot 4 bật API versioning bằng header, endpoint `GET /khach-hang/{id}` chỉ có hai method `version = "1"` và `version = "2"`. Client gửi header `API-Version: 3`. Kết quả?
```yaml
spring:
  mvc:
    apiversion:
      use:
        header: API-Version
      default: "1"
```

- [ ] 404
- [ ] Rơi về version mặc định 1
- [x] 400 — *Invalid API version: '3.0.0'*
- [ ] 500

Đã chạy thử. Version không được hỗ trợ là lỗi của client.
:::
