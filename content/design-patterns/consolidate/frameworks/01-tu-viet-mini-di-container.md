---
title: "Tự viết một DI container 60 dòng — để hiểu Spring và Angular làm gì khi khởi động"
summary: "Viết container đọc constructor bằng reflection, tạo phụ thuộc đệ quy, giữ singleton, báo lỗi thiếu cài đặt và vòng phụ thuộc A → B → C → A. Một lỗi thật: lấy theo interface và theo class trả về hai object khác nhau, sửa bằng khoá theo class cài đặt. Đã chạy trên JDK 25."
level: intermediate
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, dependency-injection, ioc, reflection, spring, angular]
related: [design-patterns/review/frameworks/pattern-trong-spring-angular-rxjs, spring-boot/consolidate/core/loi-di-va-cau-hinh-thuong-gap]
---

## TL;DR

- DI container = **registry** (kiểu → cách tạo) + **Factory** (tạo object, đệ quy tạo phụ thuộc) + **cache Singleton** + **phát hiện lỗi** (thiếu cài đặt, vòng phụ thuộc).
- Constructor injection làm phụ thuộc **hiện rõ**: container chỉ cần đọc kiểu tham số của constructor.
- Hai lỗi khởi động Spring/Angular hay gặp nhất — "không tìm thấy bean/provider" và "vòng phụ thuộc" — bạn sẽ tự viết ra trong bài này.
- Container thật còn làm nhiều hơn: scope (prototype, request), vòng đời (`@PostConstruct`, `@PreDestroy`), proxy (AOP), cấu hình có điều kiện, xử lý nhiều cài đặt cùng kiểu (`@Qualifier`, `@Primary`).

## Cơ chế: tạo đệ quy theo constructor

```text
lay(DichVuDatHang)
 ├─ constructor cần (KhoDonHang, ThongBao)
 ├─ lay(KhoDonHang) → cấu hình: KhoBoNho → constructor () → tạo, lưu singleton
 ├─ lay(ThongBao)   → cấu hình: ThongBaoLog → tạo, lưu singleton
 └─ new DichVuDatHang(kho, tb), lưu singleton
```

```java good title="Container.java"
final class Container {
    private final Map<Class<?>, Class<?>> cauHinh = new HashMap<>();   // interface → class cài đặt
    private final Map<Class<?>, Object> singleton = new HashMap<>();
    private final Deque<Class<?>> dangTao = new ArrayDeque<>();        // để phát hiện vòng

    <T> Container dangKy(Class<T> kieu, Class<? extends T> caiDat) { cauHinh.put(kieu, caiDat); return this; }

    <T> T lay(Class<T> kieu) {
        var co = singleton.get(kieu);
        if (co != null) return kieu.cast(co);
        Class<?> caiDat = cauHinh.getOrDefault(kieu, kieu);
        if (caiDat.isInterface()) throw new IllegalStateException("không có cài đặt cho " + kieu.getSimpleName());
        if (dangTao.contains(caiDat)) {
            var vong = new ArrayList<String>();
            for (var it = dangTao.descendingIterator(); it.hasNext(); ) vong.add(it.next().getSimpleName());
            vong.add(caiDat.getSimpleName());
            throw new IllegalStateException("vòng phụ thuộc: " + String.join(" → ", vong));
        }
        dangTao.push(caiDat);
        try {
            Constructor<?> c = caiDat.getDeclaredConstructors()[0];          // giả định: một constructor
            Object[] thamSo = Arrays.stream(c.getParameterTypes()).map(this::lay).toArray();
            c.setAccessible(true);
            Object obj = c.newInstance(thamSo);
            singleton.put(kieu, obj);
            return kieu.cast(obj);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("không tạo được " + caiDat.getSimpleName(), e);
        } finally {
            dangTao.pop();
        }
    }
}
```

## Demo (đã chạy trên JDK 25)

```java
var ct = new Container().dangKy(KhoDonHang.class, KhoBoNho.class).dangKy(ThongBao.class, ThongBaoLog.class);
var dv = ct.lay(DichVuDatHang.class);        // DichVuDatHang(KhoDonHang, ThongBao)
var bc = ct.lay(BaoCao.class);               // BaoCao(KhoDonHang)
dv.dat("DH1");
```

```text
tạo KhoBoNho
tạo ThongBaoLog
tạo DichVuDatHang
tạo BaoCao
  [thông báo] đã đặt DH1
cùng một kho? true, kho có [DH1]
```

`BaoCao` nhận **đúng** `KhoBoNho` mà `DichVuDatHang` đã dùng — singleton trong phạm vi container.

```text
không có cài đặt cho KhoDonHang                 ← container mới, quên dangKy
vòng phụ thuộc: A → B → C → A                    ← A(B), B(C), C(A)
```

So với Spring Boot: *Parameter 0 of constructor in … required a bean of type '…' that could not be found* và *The dependencies of some of the beans in the application context form a cycle* — cùng hai tình huống, thông báo dài hơn.

## Pitfalls

- **Khoá singleton theo kiểu được hỏi** (lỗi có thật trong code trên): `lay(KhoDonHang.class)` và `lay(KhoBoNho.class)` tạo **hai** `KhoBoNho` — xem bài tập.
- **Field injection** (`@Autowired` trên field): container phải tạo object trước rồi mới gán, phụ thuộc không hiện trong constructor, object tồn tại ở trạng thái thiếu phụ thuộc, test phải dùng reflection. Dùng constructor injection.
- **Vòng phụ thuộc "sửa" bằng `@Lazy` hoặc setter injection**: hết lỗi khởi động nhưng thiết kế vẫn vòng. Tách phần dùng chung ra class thứ ba hoặc đảo chiều bằng interface/sự kiện.
- **Map không thread-safe**: container này chỉ an toàn khi khởi tạo trên một thread. Spring tạo singleton lúc khởi động (một thread) rồi chỉ đọc.
- **`getDeclaredConstructors()[0]`**: class có nhiều constructor thì chọn ngẫu nhiên theo thứ tự reflection. Spring chọn constructor duy nhất, hoặc constructor có `@Autowired`.

:::senior Góc nhìn senior
Viết lại một thứ framework đã có không phải để dùng trong production, mà để **gỡ lỗi nhanh**: khi Spring báo lỗi khởi động 40 dòng, bạn biết nó đang ở bước nào (tìm cài đặt, tạo đệ quy, phát hiện vòng). Cùng ý tưởng cho Angular: `NullInjectorError: No provider for X` là bước "không có cài đặt cho X", và injector phân cấp (root → route → component) chỉ là nhiều `Container` lồng nhau, con hỏi cha khi không có.
:::

:::version Java 8 / 17 / 25
Reflection trên constructor có từ Java 1.1. Từ Java 9, `setAccessible(true)` vào class của module khác cần module đó `opens` package — lý do Spring/Hibernate cần cấu hình thêm khi ứng dụng dùng JPMS. Spring Boot 3+ cũng hỗ trợ AOT/native: phân tích phụ thuộc **lúc build** thay vì reflection lúc chạy.
:::

:::interview Vì sao constructor injection được khuyên dùng hơn field injection?
Phụ thuộc hiện rõ trong chữ ký constructor (nhiều tham số = class làm quá nhiều việc, dấu hiệu cần tách); field có thể `final`, object luôn ở trạng thái đầy đủ sau khi tạo; test đơn vị chỉ cần `new X(mock1, mock2)` mà không cần container hay reflection; vòng phụ thuộc bị phát hiện ngay lúc khởi động thay vì bị che đi.
:::

:::quiz Container tạo `A(B)`, `B(C)`, `C(A)`. Điều gì giúp nó báo được "A → B → C → A" thay vì `StackOverflowError`?
- [ ] Cache singleton
- [x] Ngăn xếp `dangTao` ghi các class đang được tạo; gặp lại một class trong ngăn xếp là có vòng
- [ ] `setAccessible(true)`
- [ ] Map `cauHinh`

Không có `dangTao`, `lay(A)` gọi `lay(B)` gọi `lay(C)` gọi `lay(A)`... vô hạn. Singleton chỉ được lưu **sau khi** tạo xong nên không chặn được vòng.
:::

:::quiz Với field injection, vì sao test đơn vị khó viết hơn?
- [ ] Field injection chậm hơn
- [x] Không có constructor nhận phụ thuộc, test phải dùng reflection hoặc khởi động container để gán mock
- [ ] Field không thể là interface
- [ ] Mockito không hỗ trợ field

Constructor injection cho phép `new DichVuDatHang(khoGia, thongBaoGia)` trong test thuần JUnit.
:::

:::exercise Sửa lỗi hai singleton
Với container ở trên, `ct.lay(KhoDonHang.class) == ct.lay(KhoBoNho.class)` cho kết quả gì? Giải thích và sửa.
???
Đã chạy:

```text
tạo KhoBoNho
tạo KhoBoNho
interface và class cùng object? false
```

Cache dùng **kiểu được hỏi** làm khoá: lần đầu lưu dưới `KhoDonHang`, lần hai hỏi `KhoBoNho` không thấy nên tạo mới. Hai object `KhoBoNho` nghĩa là dữ liệu ghi vào một cái không thấy ở cái kia. Sửa: khoá theo **class cài đặt**.

```java
<T> T lay(Class<T> kieu) {
    Class<?> caiDat = cauHinh.getOrDefault(kieu, kieu);
    var co = singleton.get(caiDat);                 // khoá theo cài đặt
    if (co != null) return kieu.cast(co);
    ...
    singleton.put(caiDat, obj);
    ...
}
```

Sau khi sửa: `tạo KhoBoNho` một lần, `interface và class cùng object? true`. Spring tránh lỗi này vì nó quản lý theo **bean** (tên + định nghĩa), còn kiểu chỉ dùng để tra cứu.
:::
