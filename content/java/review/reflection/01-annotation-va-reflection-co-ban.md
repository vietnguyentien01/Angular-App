---
title: "Annotation và reflection cơ bản — khai báo, retention, đọc field và gọi method lúc chạy"
summary: "Nhắc nhanh annotation có sẵn (@Override, @Deprecated, @FunctionalInterface), tự khai báo annotation với @Retention và @Target, đọc annotation và field/method bằng reflection, getFields so với getDeclaredFields, setAccessible và InvocationTargetException. Mọi output đã chạy trên JDK 21."
type: card
level: core
version: 21
lastReviewed: 2026-11-21
tags: [java, annotation, reflection]
related: [java/consolidate/reflection/tu-viet-validator-bang-annotation, java/deep-dive/reflection/dynamic-proxy-methodhandle-va-hieu-nang]
---

## Tóm tắt nhanh

- **Annotation** là siêu dữ liệu gắn vào code (`@Override`, `@Transactional`, `@NotBlank`). Bản thân nó không làm gì — phải có **ai đó đọc**: compiler, công cụ sinh code (Lombok, MapStruct), hoặc framework lúc chạy (Spring, JPA, Jackson).
- Muốn đọc lúc chạy, annotation phải có **`@Retention(RetentionPolicy.RUNTIME)`**. Không ghi gì thì mặc định là `CLASS` — có trong file `.class` nhưng reflection **không thấy**.
- **Reflection** = đọc cấu trúc class và gọi code lúc chạy qua `Class`, `Field`, `Method`, `Constructor`.
- `getFields()` chỉ trả field `public` (kể cả kế thừa); `getDeclaredFields()` trả mọi field khai báo trong class đó (cả `private`, không gồm lớp cha).
- `Method.invoke` bọc exception của method thật trong **`InvocationTargetException`** — lấy lỗi gốc bằng `getCause()`.

## Ví dụ nhanh (đã chạy trên JDK 21)

```java title="Khai báo annotation"
@Retention(RetentionPolicy.RUNTIME)                       // đọc được lúc chạy
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT}) // chỉ gắn lên field và thành phần record
@interface DoDai {
    int max();                                            // thuộc tính bắt buộc
    String thongBao() default "quá dài";                  // có giá trị mặc định
}

@Target(ElementType.FIELD) @interface MacDinhClass {}     // không ghi Retention → CLASS
```

```java title="Đọc bằng reflection"
class KhachHangDto {
    @DoDai(max = 10) String hoTen;
    @MacDinhClass String ghiChu;
    private String cccd = "001";
    public int tuoi;
    private String anCccd() { return cccd.replaceAll(".", "*"); }
}

Field f = KhachHangDto.class.getDeclaredField("hoTen");
DoDai d = f.getAnnotation(DoDai.class);
d.max();                       // 10
d.thongBao();                  // "quá dài"

KhachHangDto.class.getDeclaredField("ghiChu").isAnnotationPresent(MacDinhClass.class);   // false — retention CLASS

KhachHangDto.class.getFields();          // [tuoi]                      — chỉ public
KhachHangDto.class.getDeclaredFields();  // [hoTen, ghiChu, cccd, tuoi] — mọi field của class này

Method m = KhachHangDto.class.getDeclaredMethod("anCccd");
m.setAccessible(true);                   // cho phép gọi method private
m.invoke(new KhachHangDto());            // "***"

try {
    DichVu.class.getDeclaredMethod("nem").invoke(null);    // static method ném IllegalStateException("lỗi thật")
} catch (InvocationTargetException e) {
    e.getCause();                        // java.lang.IllegalStateException: lỗi thật
}
```

```java title="Annotation có sẵn hay dùng"
@Override public String toString() { … }          // compiler báo lỗi nếu không override gì
@Deprecated(since = "2.0", forRemoval = true)     // nơi gọi nhận cảnh báo [removal] … marked for removal
@FunctionalInterface interface TinhPhi { long tinh(long t); }   // thêm method thứ hai → Unexpected @FunctionalInterface annotation
@SuppressWarnings("unchecked")                    // tắt một loại cảnh báo, đặt ở phạm vi nhỏ nhất
```

## Bảng chọn nhanh

| `@Retention` | Có trong `.class` | Reflection đọc được | Ai dùng |
|---|---|---|---|
| `SOURCE` | Không | Không | Compiler, annotation processor (`@Override`, Lombok `@Getter`) |
| `CLASS` (mặc định) | Có | **Không** | Công cụ phân tích bytecode |
| `RUNTIME` | Có | Có | Spring, JPA, Jackson, Bean Validation, JUnit |

| Muốn | Dùng |
|---|---|
| Lấy object `Class` | `KhachHang.class`, `obj.getClass()`, `Class.forName("vn.hoc.KhachHang")` |
| Field/method của chính class (cả private) | `getDeclaredFields()`, `getDeclaredMethod(ten, kieuThamSo…)` |
| Field/method public, kể cả kế thừa | `getFields()`, `getMethods()` |
| Tạo object | `cls.getDeclaredConstructor().newInstance()` (không dùng `cls.newInstance()` — deprecated) |
| Đọc annotation | `isAnnotationPresent`, `getAnnotation`, `getAnnotationsByType` (annotation lặp) |
| Thành phần record | `cls.getRecordComponents()` |

## Lỗi hay gặp: quên `@Retention(RUNTIME)`

```java bad
@Target(ElementType.FIELD)
@interface BatBuoc {}                  // retention mặc định CLASS
// validator đọc isAnnotationPresent(BatBuoc.class) → luôn false, không kiểm tra gì, không báo lỗi gì
```

```java good
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
@interface BatBuoc {}
```

Đã chạy thử: annotation không ghi retention gắn trên field `ghiChu` → `isAnnotationPresent` trả `false`. Lỗi này không có exception, không có cảnh báo — chỉ có "validation không chạy".

:::version 21 Java 8 / 17 / 21
- Annotation lặp (`@Repeatable`) và annotation trên kiểu (`ElementType.TYPE_USE`, vd `List<@NonNull String>`): Java 8.
- `@Deprecated(since, forRemoval)`: Java 9. `ElementType.RECORD_COMPONENT` và `getRecordComponents()`: Java 16.
- Java 16+ (JEP 396) và 17 (JEP 403) **đóng** reflection vào phần nội bộ của JDK: `setAccessible(true)` trên `String.value` ném `InaccessibleObjectException` — xem bài *Module (JPMS)*.
:::

:::interview Annotation hoạt động thế nào? Vì sao gắn `@Transactional` mà Spring "biết" để mở transaction?
Annotation chỉ là siêu dữ liệu lưu trong file `.class` (nếu retention là `CLASS` hoặc `RUNTIME`). Nó không chứa logic. Framework phải chủ động đọc nó: khi khởi động, Spring quét các bean, dùng reflection kiểm tra method nào có `@Transactional`, rồi tạo **proxy** bọc bean đó. Lời gọi từ bên ngoài đi vào proxy trước; proxy mở transaction, gọi method thật, rồi commit hoặc rollback. Vì vậy `@Transactional` không có tác dụng khi method tự gọi method khác trong cùng class (gọi qua `this`, không qua proxy) — bài chuyên sâu tái hiện điều này.
:::

:::quiz Annotation `@BatBuoc` chỉ có `@Target(ElementType.FIELD)`, không có `@Retention`. Gọi `field.isAnnotationPresent(BatBuoc.class)` lúc chạy trả về gì?
- [ ] `true`
- [x] `false`
- [ ] Ném `IllegalStateException`
- [ ] Lỗi biên dịch vì thiếu `@Retention`

Retention mặc định là `CLASS`: annotation nằm trong file `.class` nhưng JVM không giữ để reflection đọc. Đã chạy thử trên JDK 21.
:::

:::quiz Class có `public int tuoi`, `private String cccd` và kế thừa `public String ma` từ lớp cha. `getDeclaredFields()` trả về những field nào?
- [ ] `tuoi`, `ma`
- [x] `tuoi`, `cccd`
- [ ] `tuoi`, `cccd`, `ma`
- [ ] Chỉ `tuoi`

`getDeclaredFields()` lấy mọi field (kể cả private) **khai báo trong chính class đó**, không gồm lớp cha. `getFields()` thì lấy field public, có cả kế thừa: `tuoi`, `ma`.
:::

:::quiz `method.invoke(obj)` mà method bên trong ném `IllegalStateException`. Code gọi bắt được exception gì?
- [ ] `IllegalStateException`
- [x] `InvocationTargetException`, với `getCause()` là `IllegalStateException`
- [ ] `ReflectiveOperationException` không có cause
- [ ] `RuntimeException`

Reflection luôn bọc lỗi của method được gọi. Quên `getCause()` khi log là lý do hay gặp của những dòng log "InvocationTargetException: null" vô nghĩa.
:::
