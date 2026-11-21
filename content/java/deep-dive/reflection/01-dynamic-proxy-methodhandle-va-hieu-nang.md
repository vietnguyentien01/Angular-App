---
title: "Dynamic proxy, MethodHandle và chi phí của reflection — cách Spring bọc bean, vì sao self-invocation mất @Transactional"
summary: "Tự viết một proxy kiểu @Transactional bằng java.lang.reflect.Proxy và tái hiện lỗi self-invocation; đo bằng JMH chi phí gọi trực tiếp, Method.invoke, MethodHandle và tra method mỗi lần trên JDK 21; annotation thực chất là proxy; so sánh reflection lúc chạy với annotation processing lúc biên dịch."
level: advanced
version: 21
lastReviewed: 2026-11-21
tags: [java, reflection, proxy, methodhandle, spring, performance]
related: [java/consolidate/reflection/tu-viet-validator-bang-annotation, java/deep-dive/jvm/gc-jit-va-do-hieu-nang]
---

## Tóm tắt nhanh

- `java.lang.reflect.Proxy` tạo lúc chạy một class cài **interface** cho trước; mọi lời gọi đi vào một `InvocationHandler`. Spring AOP dùng nó (hoặc sinh lớp con bằng CGLIB/ByteBuddy khi không có interface) để cài `@Transactional`, `@Cacheable`, `@Async`.
- **Self-invocation**: method của bean gọi method khác **trong cùng object** (`this.chuyen(…)`) thì không đi qua proxy → annotation bị bỏ qua. Đã tái hiện bên dưới.
- Đo bằng JMH trên JDK 21: `Method.invoke` giữ trong `static final` ~1,8 ns (gần gọi trực tiếp ~1 ns); giữ trong field thường ~7,9 ns; **tra `getMethod` mỗi lần** ~60 ns. Chi phí chính là **tra cứu**, không phải gọi.
- `MethodHandle` trong `static final` + `invokeExact` nhanh ngang gọi trực tiếp — đây là cách JDK 18+ cài lại `Method.invoke` bên dưới (JEP 416).
- Annotation đọc ra lúc chạy là một **object proxy** (`$Proxy…`) do JDK tạo. Annotation processing (Lombok, MapStruct, Dagger) thì làm việc **lúc biên dịch**: không tốn reflection lúc chạy.

## Cơ chế: một proxy kiểu `@Transactional`

```java title="Proxy tự viết"
@Retention(RetentionPolicy.RUNTIME) @Target(ElementType.METHOD) @interface GiaoDich {}

interface ChuyenTienService {
    void chuyen(String tu, String den, long tien);
    void chuyenNhieu(List<String> den, long tien);
}

class ChuyenTienImpl implements ChuyenTienService {
    @GiaoDich public void chuyen(String tu, String den, long tien) {
        System.out.println("  chuyển " + tien + " từ " + tu + " tới " + den);
    }
    public void chuyenNhieu(List<String> den, long tien) {
        for (String d : den) chuyen("A", d, tien);          // gọi this.chuyen — KHÔNG qua proxy
    }
}

@SuppressWarnings("unchecked")
static <T> T boc(T dich, Class<T> kieu) {
    InvocationHandler h = (proxy, m, args) -> {
        Method thuc = dich.getClass().getMethod(m.getName(), m.getParameterTypes());   // annotation nằm trên class cài đặt
        boolean tx = thuc.isAnnotationPresent(GiaoDich.class);
        if (tx) System.out.println("BEGIN");
        try {
            Object kq = m.invoke(dich, args);
            if (tx) System.out.println("COMMIT");
            return kq;
        } catch (InvocationTargetException e) {
            if (tx) System.out.println("ROLLBACK");
            throw e.getCause();                              // ném lỗi gốc, không ném lớp bọc
        }
    };
    return (T) Proxy.newProxyInstance(kieu.getClassLoader(), new Class<?>[]{kieu}, h);
}
```

Chạy trên JDK 21:

```text
s.getClass() → $Proxy0          s instanceof ChuyenTienImpl → false

-- gọi chuyen qua proxy:
BEGIN
  chuyển 100 từ A tới B
COMMIT
-- gọi chuyenNhieu qua proxy:
  chuyển 50 từ A tới B           ← không có BEGIN/COMMIT: lời gọi bên trong đi thẳng vào object thật
  chuyển 50 từ A tới C
```

Đây chính là lỗi kinh điển trong Spring: `chuyenNhieu` không có `@Transactional`, gọi `chuyen` có `@Transactional` trong cùng class → hai lần chuyển chạy **không** trong transaction, một lần lỗi thì lần trước không rollback.

Ba điểm rút ra từ đoạn code:

1. Proxy JDK chỉ cài **interface** — `s instanceof ChuyenTienImpl` là `false`. Inject theo class cài đặt (`@Autowired ChuyenTienImpl`) với proxy JDK sẽ lỗi; Spring Boot mặc định dùng proxy lớp con (CGLIB) để tránh việc này.
2. Proxy lớp con (CGLIB/ByteBuddy) override method public/protected không `final`. Method `private`, `final` hoặc `static` không bị chặn → `@Transactional` trên đó không có tác dụng.
3. Handler phải `throw e.getCause()`; ném `InvocationTargetException` ra ngoài thì code gọi nhận `UndeclaredThrowableException` khó hiểu.

```java bad
@Service class ChuyenTienService {
    public void chuyenNhieu(List<String> den, long tien) { for (var d : den) chuyen("A", d, tien); }
    @Transactional public void chuyen(String tu, String den, long tien) { … }
}
```

```java good
@Service class ChuyenTienService {
    @Transactional                                   // ranh giới transaction ở method được gọi từ bên ngoài
    public void chuyenNhieu(List<String> den, long tien) { for (var d : den) chuyen("A", d, tien); }
    void chuyen(String tu, String den, long tien) { … }
}
// hoặc tách chuyen sang một bean khác và inject vào
```

## Chi phí: JMH trên JDK 21

```java title="ReflectBench.java (rút gọn)"
static final Method GET = KhachHang.class.getMethod("getTen");
static final MethodHandle MH = MethodHandles.lookup().unreflect(GET);
static final Field F = …; // field "ten", đã setAccessible(true)
Method getKhongFinal;  MethodHandle mhKhongFinal;    // cùng giá trị nhưng là field thường của @State

@Benchmark Object goiTrucTiep()             { return kh.getTen(); }
@Benchmark Object methodInvokeStaticFinal() throws Exception { return GET.invoke(kh); }
@Benchmark Object methodInvokeField()       throws Exception { return getKhongFinal.invoke(kh); }
@Benchmark Object methodHandleStaticFinal() throws Throwable { return (String) MH.invokeExact(kh); }
@Benchmark Object methodHandleField()       throws Throwable { return (String) mhKhongFinal.invokeExact(kh); }
@Benchmark Object fieldGet()                throws Exception { return F.get(kh); }
@Benchmark Object timMethodMoiLan()         throws Exception { return KhachHang.class.getMethod("getTen").invoke(kh); }
```

```text
Benchmark                             Mode  Cnt   Score    Error  Units
ReflectBench.fieldGet                 avgt    5   0.918 ±  0.204  ns/op
ReflectBench.goiTrucTiep              avgt    5   0.964 ±  0.809  ns/op
ReflectBench.methodHandleField        avgt    5   3.892 ±  0.931  ns/op
ReflectBench.methodHandleStaticFinal  avgt    5   0.858 ±  0.419  ns/op
ReflectBench.methodInvokeField        avgt    5   7.860 ±  1.891  ns/op
ReflectBench.methodInvokeStaticFinal  avgt    5   1.761 ±  1.012  ns/op
ReflectBench.timMethodMoiLan          avgt    5  59.921 ± 14.445  ns/op
```

Cách đọc:

- **`static final` là chìa khoá.** JIT coi giá trị `static final` là hằng số, nên "nhìn xuyên" qua `MethodHandle`/`Method` tới method thật và inline nó — gần như không còn chi phí. Giữ trong field thường, JIT không chắc giá trị không đổi nên phải gọi gián tiếp: chậm hơn 4–8 lần.
- **Tra cứu đắt hơn gọi.** `getMethod` mỗi lần tốn ~60 ns: tìm theo tên, kiểm tra quyền, sao chép object `Method`. Đây là lý do mọi framework cache metadata (bài *Tự viết validator*).
- Với ứng dụng web, vài chục nano giây cho mỗi lời gọi gần như không bao giờ là điểm nghẽn so với một truy vấn DB (vài mili giây). Chỉ tối ưu khi đo thấy reflection trong profiler.

## MethodHandle

```java
MethodHandle mh = MethodHandles.lookup()
    .findVirtual(KhachHang.class, "getTen", MethodType.methodType(String.class));
String ten = (String) mh.invokeExact(kh);    // kiểu phải khớp chính xác: (KhachHang)String
```

| | `Method.invoke` | `MethodHandle` |
|---|---|---|
| Kiểm tra quyền | Mỗi lần gọi (trừ khi `setAccessible`) | Một lần, lúc `lookup` |
| Kiểu tham số | `Object...`, boxing | Có kiểu, `invokeExact` không boxing |
| Exception của method thật | Bọc trong `InvocationTargetException` | Ném thẳng ra |
| Dùng khi | Code framework đơn giản, ít gọi | Đường nóng, thư viện cần hiệu năng |

`invokeExact` khó dùng: sai một chút về kiểu (vd gán kết quả cho `Object` thay vì `String`) là `WrongMethodTypeException` lúc chạy. `invoke` (không exact) tự chuyển kiểu nhưng chậm hơn.

## Annotation là một proxy

```java
DoDai d = KhachHangDto.class.getDeclaredField("hoTen").getAnnotation(DoDai.class);
d.toString();            // @Ann.DoDai(thongBao="quá dài", max=10)
d.getClass().getName();  // $Proxy1 (số có thể khác)
```

Interface `DoDai` không có class cài đặt nào trong code của bạn. JDK đọc giá trị từ file `.class` và tạo một proxy cài interface đó; mỗi lần gọi `d.max()` là một lời gọi qua `InvocationHandler`. Vì vậy đọc annotation lặp đi lặp lại trong đường nóng cũng nên cache giá trị (vd chép `max()` vào metadata của bạn).

## Lúc chạy hay lúc biên dịch

| | Reflection lúc chạy | Annotation processing lúc biên dịch |
|---|---|---|
| Ví dụ | Spring, Hibernate, Jackson, JUnit | Lombok, MapStruct, Dagger, Micronaut, `record`-builder |
| Retention cần | `RUNTIME` | `SOURCE` là đủ |
| Lỗi phát hiện | Lúc khởi động / lúc chạy | Lúc build |
| Chi phí khởi động | Quét class, tạo proxy | Gần như không có |
| GraalVM native image | Cần khai báo metadata reflection | Chạy thẳng |
| Debug | Stack trace có `$Proxy`, `CGLIB$$` | Code sinh ra nằm trong `target/generated-sources`, đọc được |

Xu hướng mới (Micronaut, Quarkus, Spring AOT) dời càng nhiều việc càng tốt từ lúc chạy sang lúc build để khởi động nhanh và chạy được native image.

## Tính năng mới theo phiên bản

- **Java 1.3**: `java.lang.reflect.Proxy`. **Java 7**: `MethodHandle` (JSR 292).
- **Java 15**: hidden class (JEP 371) — nền cho lambda và các framework sinh class lúc chạy.
- **Java 16–17**: chặn reflection vào nội bộ JDK (JEP 396, 403).
- **Java 18**: `Method.invoke`/`Field.get` cài lại bằng method handle (JEP 416) — vì vậy `methodInvokeStaticFinal` trên JDK 21 chỉ ~1,8 ns.
- **Java 21**: không thay đổi gì ở phần này.

:::senior Góc nhìn senior
Khi một annotation của Spring "không chạy", kiểm tra theo thứ tự: object có phải bean do Spring tạo không (`new` thủ công thì không có proxy); lời gọi có đi từ **bên ngoài** bean vào không (self-invocation); method có `public`, không `final`/`static` không; annotation có đặt ở class cài đặt không. Bật log `org.springframework.transaction=DEBUG` để thấy transaction mở/đóng ở đâu. Đừng "sửa" self-invocation bằng cách tự inject chính mình hay `AopContext.currentProxy()` — tách trách nhiệm ra bean khác thường cho thiết kế rõ hơn.
:::

:::quiz Bean Spring `DonHangService` có `public void datNhieu()` (không annotation) gọi `this.dat()` có `@Transactional`. Controller gọi `datNhieu()`. Điều gì xảy ra?
- [ ] `dat()` chạy trong transaction như bình thường
- [x] `dat()` chạy **không** có transaction, vì lời gọi nội bộ không đi qua proxy
- [ ] Spring ném lỗi lúc khởi động
- [ ] Mỗi lần gọi `dat()` mở một transaction mới

Proxy chỉ chặn lời gọi đi vào từ bên ngoài. Đã tái hiện bằng proxy tự viết: `chuyen` gọi trực tiếp có BEGIN/COMMIT, gọi qua `chuyenNhieu` thì không.
:::

:::quiz Theo số đo JMH trên JDK 21, cách nào làm chậm nhất khi gọi `getTen()` qua reflection?
- [ ] `Method` giữ trong `static final`, gọi `invoke`
- [ ] `MethodHandle` trong field thường, gọi `invokeExact`
- [x] Gọi `KhachHang.class.getMethod("getTen")` mỗi lần rồi `invoke`
- [ ] `Field` trong `static final`, gọi `get`

~60 ns so với 1–8 ns của các cách còn lại. Chi phí nằm ở bước tra cứu; giữ `Method`/`MethodHandle` trong `static final` để JIT tối ưu được.
:::

:::exercise Proxy đo thời gian
Viết `static <T> T doThoiGian(T dich, Class<T> kieu)` dùng `Proxy` để in `tenMethod: X ms` sau mỗi lời gọi tới method có annotation `@DoThoiGian`. Lỗi của method thật phải được ném nguyên vẹn (không bọc).
???
```java
@Retention(RetentionPolicy.RUNTIME) @Target(ElementType.METHOD) @interface DoThoiGian {}

@SuppressWarnings("unchecked")
static <T> T doThoiGian(T dich, Class<T> kieu) {
    InvocationHandler h = (proxy, m, args) -> {
        Method thuc = dich.getClass().getMethod(m.getName(), m.getParameterTypes());
        if (!thuc.isAnnotationPresent(DoThoiGian.class)) return invoke(m, dich, args);
        long t = System.nanoTime();
        try {
            return invoke(m, dich, args);
        } finally {
            System.out.println(m.getName() + ": " + (System.nanoTime() - t) / 1_000_000 + " ms");
        }
    };
    return (T) Proxy.newProxyInstance(kieu.getClassLoader(), new Class<?>[]{kieu}, h);
}

private static Object invoke(Method m, Object dich, Object[] args) throws Throwable {
    try { return m.invoke(dich, args); }
    catch (InvocationTargetException e) { throw e.getCause(); }
}
```

`finally` bảo đảm in thời gian cả khi method lỗi. Trong thực tế: `getMethod` trong handler chạy ở mỗi lời gọi — nên tính trước một `Set<Method>` các method có annotation khi tạo proxy. Spring có sẵn cơ chế này qua `@Timed` của Micrometer.
:::
