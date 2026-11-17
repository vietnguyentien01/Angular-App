---
title: "Dynamic proxy bên trong — java.lang.reflect.Proxy, self-invocation, exception bị bọc và giới hạn của proxy"
summary: "Tự viết proxy ghi nhật ký bằng java.lang.reflect.Proxy để hiểu @Transactional của Spring: self-invocation lọt qua proxy, toString/hashCode/equals cũng đi qua handler, checked exception bị bọc thành UndeclaredThrowableException, JDK proxy chỉ cho interface. Đã chạy trên JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, proxy, reflection, aop, spring]
related: [design-patterns/consolidate/structural/decorator-va-proxy-trong-thuc-te, spring-boot/deep-dive/transactions/proxy-isolation-va-khoa]
---

## Tóm tắt nhanh

- Viết decorator tay cho 50 interface là không thực tế. **Dynamic proxy** tạo class proxy **lúc chạy**: mọi lời gọi method đổ về một `InvocationHandler` duy nhất.
- JDK `Proxy` chỉ tạo được proxy cho **interface** (*… is not an interface*). Spring dùng CGLIB (tạo lớp con) khi cần proxy cho class — nên method `final`/`private` không bị chặn.
- **Self-invocation**: method của object thật gọi method khác của chính nó (`this.datHang()`) thì **không** đi qua proxy. Đây là lý do `@Transactional` trên method được gọi nội bộ "không chạy".
- `toString`, `hashCode`, `equals` cũng đi qua handler.
- Handler ném checked exception không có trong `throws` của method → người gọi nhận `UndeclaredThrowableException`. Và phải "mở" `InvocationTargetException` để exception gốc tới tay người gọi.

## Cơ chế: một handler cho mọi method

```java title="Proxy ghi nhật ký"
interface DichVuDonHang {
    String datHang(String ma);
    String datVaThongBao(String ma);
    void kiemTraKho(String ma) throws Exception;
}

class DichVuThat implements DichVuDonHang {
    public String datHang(String ma) { return "đã đặt " + ma; }
    public String datVaThongBao(String ma) { return datHang(ma) + " + đã báo"; }   // gọi nội bộ
    public void kiemTraKho(String ma) throws Exception { throw new Exception("hết hàng " + ma); }
}

static <T> T boc(T dich, Class<T> kieu) {
    InvocationHandler h = (proxy, m, args) -> {
        NHAT_KY.add("→ " + m.getName());
        try { return m.invoke(dich, args); }
        catch (InvocationTargetException e) { throw e.getCause(); }       // trả lại exception gốc
    };
    return (T) Proxy.newProxyInstance(kieu.getClassLoader(), new Class<?>[]{kieu}, h);
}
```

```text
class: $Proxy0, là DichVuThat? false
đã đặt DH1
đã đặt DH2 + đã báo
nhật ký: [→ datHang, → datVaThongBao]
```

Gọi `datVaThongBao` — bên trong nó gọi `datHang` — nhưng nhật ký chỉ có **một** dòng `datVaThongBao`. Proxy bọc **bên ngoài** object; khi đã vào trong `DichVuThat`, `this` là object thật, không phải proxy.

```text
caller ──► $Proxy0.datVaThongBao ──► handler ──► DichVuThat.datVaThongBao
                                                        │ this.datHang(...)   (không qua proxy)
                                                        ▼
                                                 DichVuThat.datHang
```

Nếu `datHang` có `@Transactional(propagation = REQUIRES_NEW)` trong Spring, transaction mới **không được mở** khi gọi từ `datVaThongBao`. Cách sửa: tách sang bean khác, hoặc gọi qua proxy (`self` được tiêm vào), hoặc dùng `TransactionTemplate`.

## Những chi tiết ít người biết

```text
toString/hashCode cũng qua handler: [→ toString, → hashCode]
exception gốc: java.lang.Exception: hết hàng DH3
datHang: java.lang.reflect.UndeclaredThrowableException / cause: java.io.IOException: mất mạng
proxy cho class: S3$DichVuThat is not an interface
```

- **`toString/hashCode/equals`** đi qua handler: handler làm việc nặng (mở transaction, gọi mạng) mà không loại trừ các method này thì một câu log `"dv=" + dv` cũng kích hoạt nó. Đặt proxy làm key của `HashMap` thì `hashCode` cũng chạy qua handler.
- **`InvocationTargetException`**: `Method.invoke` bọc mọi exception của method thật. Không mở ra (`getCause()`), người gọi nhận exception lạ thay vì `Exception: hết hàng`.
- **`UndeclaredThrowableException`**: `datHang` không khai báo `throws IOException`, nên JVM không thể để checked exception đó đi ra — nó bọc lại. Gặp exception này trong log Spring thường là do advice ném checked exception.
- **Chỉ interface**: muốn proxy cho class phải tạo **lớp con** lúc chạy (CGLIB, ByteBuddy). Lớp con không ghi đè được method `final`, `private`, `static` — gọi chúng là gọi thẳng object proxy (mà field của nó thường `null`).

## Chi phí

Đo thô 5 triệu lần gọi `datHang` (handler chỉ chuyển tiếp) trên JDK 25: chênh lệch giữa gọi trực tiếp và qua proxy chỉ cỡ vài nanosecond tới vài chục nanosecond mỗi lần, dao động mạnh theo lần đo vì JIT. So với một câu SQL (mili giây), chi phí proxy không đáng kể. Thứ tốn kém là **việc handler làm** (mở transaction, lấy kết nối), không phải cơ chế proxy. Muốn số đo tin cậy, dùng JMH (môn Java, bài *GC, JIT và đo hiệu năng*).

## So sánh phương án

| Cách | Áp dụng cho | Chặn self-invocation | Dùng ở đâu |
|---|---|---|---|
| Decorator viết tay | Interface cụ thể | Không | Vài điểm cần bọc, rõ ràng, dễ debug |
| JDK `Proxy` | Interface | Không | Spring khi bean có interface (tuỳ cấu hình), Retrofit, MyBatis mapper |
| Lớp con sinh lúc chạy (CGLIB/ByteBuddy) | Class không `final` | Không | Spring Boot mặc định (`proxyTargetClass=true`), Hibernate lazy proxy, Mockito |
| AspectJ weaving (lúc biên dịch/nạp class) | Mọi method, kể cả nội bộ | **Có** | Khi thật sự cần chặn self-invocation; cấu hình phức tạp hơn |

## Tính năng mới theo phiên bản

- **Java 1.3**: `java.lang.reflect.Proxy`.
- **Java 9+** (module): class proxy cho interface `public` được tạo trong một module động; trên JDK 25 tên class là `jdk.proxy1.$Proxy0` (đã kiểm tra). Interface không public thì proxy nằm cùng package với interface (như `$Proxy0` ở trên). Đừng viết code dựa vào tên class proxy.
- **Java 16–17**: đóng gói mạnh nội bộ JDK — thư viện sinh lớp con lúc chạy phải dùng API chính thức (`MethodHandles.Lookup.defineClass`, ByteBuddy) thay cho `sun.misc.Unsafe`. Đây là lý do cần bản Spring, Hibernate, Mockito đủ mới khi nâng JDK.

:::senior Góc nhìn senior
Mỗi khi thấy annotation "có phép thuật" (`@Transactional`, `@Cacheable`, `@Async`, `@Retryable`, `@PreAuthorize`), hãy nghĩ ngay: "đây là proxy — lời gọi của tôi có đi qua proxy không?". Ba câu hỏi kiểm tra: method có `public` và không `final` không; có được gọi từ **bean khác** không; object có được lấy từ container (không phải `new`) không. Phần lớn bug "annotation không có tác dụng" rơi vào một trong ba câu này.
:::

:::quiz `datVaThongBao` gọi `datHang` bên trong cùng class. Proxy ghi nhật ký được mấy dòng khi gọi `proxy.datVaThongBao("DH2")`?
- [x] 1 — chỉ `datVaThongBao`
- [ ] 2 — cả hai method
- [ ] 0
- [ ] Tuỳ JIT

Đã chạy: `nhật ký: [→ datHang, → datVaThongBao]` cho hai lời gọi riêng từ bên ngoài; lời gọi nội bộ `this.datHang` không qua proxy.
:::

:::exercise Đo thời gian cho mọi repository
Bạn có 20 interface repository và muốn log những lời gọi chạy quá 200 ms, ghi tên interface, tên method và thời gian. Viết một hàm `<T> T doThoiGian(T that, Class<T> kieu)` bằng dynamic proxy. Lưu ý những gì để không làm hỏng hành vi?
???
```java
@SuppressWarnings("unchecked")
static <T> T doThoiGian(T that, Class<T> kieu) {
    InvocationHandler h = (proxy, m, args) -> {
        if (m.getDeclaringClass() == Object.class) return m.invoke(that, args);   // toString/hashCode/equals
        long t0 = System.nanoTime();
        try {
            return m.invoke(that, args);
        } catch (InvocationTargetException e) {
            throw e.getCause();                               // giữ nguyên exception gốc
        } finally {
            long ms = (System.nanoTime() - t0) / 1_000_000;
            if (ms > 200) log.warn("{}.{} chạy {} ms", kieu.getSimpleName(), m.getName(), ms);
        }
    };
    return (T) Proxy.newProxyInstance(kieu.getClassLoader(), new Class<?>[]{kieu}, h);
}
```

Đã chạy trên JDK 25 với một `Repo` giả lập: `tim("cham")` (ngủ 250 ms) in `CHẬM Repo.tim chạy 250 ms`, `tim("loi")` ném đúng `IllegalStateException: không có loi`, class proxy là `jdk.proxy1.$Proxy0`.

Một bất ngờ khi chạy: `r.equals(r)` trả **`false`**. Handler chuyển `equals` sang object thật, thành `that.equals(proxy)` — object thật không bằng proxy. Proxy làm hỏng tính phản xạ của `equals`, nên `list.contains(r)` hay `set.remove(r)` sẽ sai. Nếu proxy có thể bị so sánh, xử lý riêng: `if (m.getName().equals("equals")) return proxy == args[0];`.

Lưu ý: (1) bỏ qua method của `Object` để log/`HashMap` không bị ảnh hưởng (và xử lý `equals` như trên); (2) mở `InvocationTargetException` để người gọi nhận đúng exception; (3) đo trong `finally` để lời gọi lỗi cũng được đo; (4) không ghi giá trị tham số vào log (có thể là dữ liệu cá nhân); (5) self-invocation bên trong repository không được đo. Trong Spring, cách tương đương là Micrometer `@Timed` hoặc `spring.jpa`/datasource proxy — đã có sẵn, không cần tự viết.
:::
