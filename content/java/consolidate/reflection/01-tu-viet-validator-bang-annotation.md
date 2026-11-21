---
title: "Tự viết validator bằng annotation — đọc field lúc chạy, kế thừa, cache metadata và các bẫy"
summary: "Luyện tay: viết validator kiểu Bean Validation (@KhongRong, @DoDai, @KhoangGiaTri) bằng reflection, duyệt cả field lớp cha, cache bằng ClassValue (nhanh ~3 lần); rồi các bẫy: @Inherited chỉ áp cho class, annotation trên record, InaccessibleObjectException. Chạy trên JDK 21."
level: intermediate
version: 21
lastReviewed: 2026-11-21
tags: [java, annotation, reflection, validation, pitfalls]
related: [java/review/reflection/annotation-va-reflection-co-ban, java/deep-dive/reflection/dynamic-proxy-methodhandle-va-hieu-nang]
---

## Tóm tắt nhanh

- Một framework dựa trên annotation luôn có ba phần: **khai báo** annotation (`@Retention(RUNTIME)`), **gắn** lên code, và **bộ đọc** dùng reflection để làm việc thật.
- `getDeclaredFields()` không lấy field của lớp cha — phải tự đi lên `getSuperclass()`.
- Tra cứu reflection (`getDeclaredFields`, `getAnnotation`, `setAccessible`) tốn chi phí. Tính **một lần cho mỗi class** rồi cache (`ClassValue`): đo được nhanh hơn ~3 lần.
- `@Inherited` chỉ có tác dụng với annotation trên **class**. Annotation trên method/field **không** được kế thừa khi lớp con override.
- Annotation trên thành phần record chỉ "chảy" tới field, accessor hay tham số constructor nếu `@Target` cho phép.

## Cơ chế: framework đọc annotation thế nào

Bean Validation (`@NotBlank`, `@Size` của Hibernate Validator), Jackson (`@JsonProperty`), JPA (`@Column`) đều làm cùng một việc: lúc khởi động hoặc lần đầu gặp một class, chúng duyệt field/method bằng reflection, đọc annotation, dựng sẵn **metadata** (danh sách việc cần làm cho class đó) và cache lại. Mỗi lần xử lý object sau đó chỉ chạy theo metadata. Bài này tự viết lại quy trình đó ở quy mô nhỏ để thấy từng bước.

## Bài tập chính: validator

```java title="Annotation"
@Retention(RetentionPolicy.RUNTIME) @Target(ElementType.FIELD) @interface KhongRong {}
@Retention(RetentionPolicy.RUNTIME) @Target(ElementType.FIELD) @interface DoDai { int max(); }
@Retention(RetentionPolicy.RUNTIME) @Target(ElementType.FIELD) @interface KhoangGiaTri { long min(); long max(); }

record Loi(String truong, String thongBao) {}
```

```java good title="Validator.java"
final class Validator {
    // Mỗi class chỉ tính một lần: danh sách field có annotation, đã setAccessible
    private static final ClassValue<List<Field>> CAN_KIEM_TRA = new ClassValue<>() {
        @Override protected List<Field> computeValue(Class<?> c) {
            List<Field> ds = new ArrayList<>();
            for (Class<?> k = c; k != null && k != Object.class; k = k.getSuperclass())   // đi lên lớp cha
                for (Field f : k.getDeclaredFields())
                    if (!Modifier.isStatic(f.getModifiers()) && f.getAnnotations().length > 0) {
                        f.setAccessible(true);
                        ds.add(f);
                    }
            return List.copyOf(ds);
        }
    };

    static List<Loi> kiemTra(Object o) {
        List<Loi> loi = new ArrayList<>();
        for (Field f : CAN_KIEM_TRA.get(o.getClass())) {
            Object v;
            try { v = f.get(o); } catch (IllegalAccessException e) { throw new IllegalStateException(e); }

            if (f.isAnnotationPresent(KhongRong.class) && (v == null || v.toString().isBlank()))
                loi.add(new Loi(f.getName(), "không được rỗng"));
            DoDai d = f.getAnnotation(DoDai.class);
            if (d != null && v instanceof CharSequence s && s.length() > d.max())
                loi.add(new Loi(f.getName(), "tối đa " + d.max() + " ký tự"));
            KhoangGiaTri k = f.getAnnotation(KhoangGiaTri.class);
            if (k != null && v instanceof Number n && (n.longValue() < k.min() || n.longValue() > k.max()))
                loi.add(new Loi(f.getName(), "phải trong [" + k.min() + ", " + k.max() + "]"));
        }
        return loi;
    }
}
```

```java title="Dùng thử"
class NguoiDung { @KhongRong String email; }
class KhachHang extends NguoiDung {
    @KhongRong @DoDai(max = 10) String hoTen;
    @KhoangGiaTri(min = 18, max = 120) int tuoi;
}

Validator.kiemTra(new KhachHang("", "Nguyễn Văn Trường An", 15));
// [Loi[truong=hoTen, thongBao=tối đa 10 ký tự],
//  Loi[truong=tuoi, thongBao=phải trong [18, 120]],
//  Loi[truong=email, thongBao=không được rỗng]]    ← field của lớp cha cũng được kiểm tra
Validator.kiemTra(new KhachHang("an@vn", "An", 30));   // []
```

Trả về **danh sách lỗi** thay vì ném exception ở lỗi đầu tiên: người dùng sửa form một lần thay vì sửa từng lỗi (cùng ý với bài *Thiết kế exception*).

## Vì sao cache: số đo

Cùng validator, 1 triệu lần kiểm tra một object hợp lệ (sau 200.000 lần warmup), JDK 21:

```text
có cache (ClassValue):        119 ms, 164 ms
không cache (tra mỗi lần):    376 ms, 415 ms
```

```java bad
static List<Loi> kiemTra(Object o) {
    for (Field f : o.getClass().getDeclaredFields()) {   // mỗi lần gọi: sao chép mảng Field mới
        f.setAccessible(true);                            // mỗi lần gọi: kiểm tra quyền lại
        …
```

`getDeclaredFields()` trả về **bản sao mới** của mảng `Field` mỗi lần gọi (để code gọi không sửa được dữ liệu nội bộ của JVM). Trong API nhận hàng nghìn request mỗi giây, chi phí này cộng dồn. `ClassValue` là cache gắn với từng `Class`, thread-safe, và không giữ class lại khi classloader bị huỷ (an toàn khi redeploy trên server ứng dụng) — tốt hơn một `static Map<Class<?>, …>` tự viết.

## Bẫy khi đọc annotation

### `@Inherited` chỉ cho class

```java
@Retention(RUNTIME) @Inherited @interface CoKe {}
@Retention(RUNTIME) @interface KhongKe {}

@CoKe @KhongKe class Cha { @KhongKe public void m() {} }
class Con extends Cha { @Override public void m() {} }

Con.class.isAnnotationPresent(CoKe.class);                   // true
Con.class.isAnnotationPresent(KhongKe.class);                // false
Con.class.getMethod("m").isAnnotationPresent(KhongKe.class); // false — method override mất annotation
```

Đã chạy thử trên JDK 21. Đây là lý do tài liệu Spring khuyên đặt `@Transactional` trên **class cài đặt**, không trên interface: annotation trên method của interface không tự "kế thừa" sang method cài đặt theo quy tắc của Java — Spring phải tự viết logic tìm kiếm riêng.

### Annotation trên record

```java
@Retention(RUNTIME) @Target({ElementType.FIELD, ElementType.RECORD_COMPONENT}) @interface DoDai { int max(); }
record DangKy(String email, @DoDai(max = 5) String ma) {}

DangKy.class.getDeclaredField("ma").isAnnotationPresent(DoDai.class);           // true
DangKy.class.getRecordComponents()[1].isAnnotationPresent(DoDai.class);         // true
DangKy.class.getMethod("ma").isAnnotationPresent(DoDai.class);                  // false — @Target không có METHOD
```

Annotation viết trên thành phần record được javac chép sang field, accessor, tham số constructor — **chỉ những chỗ mà `@Target` cho phép**. Validator đọc field thì ổn; thư viện đọc getter (một số cấu hình Jackson) thì không thấy. Khi dùng record làm DTO với Bean Validation, các annotation `@NotBlank`, `@Size` đã khai báo target phù hợp; với annotation tự viết, nhớ liệt kê đủ target.

### Không mở được phần nội bộ của JDK

```java bad
Field v = String.class.getDeclaredField("value");
v.setAccessible(true);
// InaccessibleObjectException: Unable to make field private final byte[] java.lang.String.value accessible:
// module java.base does not "opens java.lang" to unnamed module @7671cb68
```

Validator duyệt field của lớp cha "tới khi gặp `Object`" là đúng — nếu duyệt cả vào class của JDK (vd DTO kế thừa `ArrayList`) sẽ gặp lỗi này. Thư viện cũ từng dùng mẹo này (vd một số bản cũ của Lombok, Mockito) và bị vỡ khi lên Java 17. Bài *Module (JPMS)* giải thích `--add-opens`.

## Pitfalls

- `field.get(o)` với field primitive trả về wrapper (`Integer`), field `null` trả `null` — xử lý cả hai, như `instanceof Number n` ở trên.
- Quên `Modifier.isStatic` → validator đọc cả hằng số `static` và bộ đếm dùng chung.
- Log `InvocationTargetException` mà không `getCause()` → log chỉ thấy "null".
- Dùng tên field làm key thông báo lỗi rồi đổi tên field khi refactor → API đổi theo. Bean Validation cho phép đặt `message` cố định trong annotation.
- `setAccessible(true)` trên field `final` rồi `set` → chạy được với class thường, nhưng với **record** và `static final` thì ném `IllegalAccessException`. Đừng viết framework dựa vào việc sửa field `final`.

:::senior Góc nhìn senior
Trong dự án thật, đừng tự viết validator — dùng Bean Validation (Hibernate Validator) với `@Valid` của Spring. Giá trị của bài tập này là hiểu cơ chế để debug: annotation "không có tác dụng" thường do retention sai, do đặt trên interface/method override, do framework đọc getter còn bạn gắn trên field (hoặc ngược lại), hoặc do object không đi qua proxy. Khi cần tự viết một cơ chế dựa trên annotation (audit, phân quyền, đánh dấu dữ liệu nhạy cảm để che log), luôn tách bước "dựng metadata một lần" khỏi bước "chạy theo metadata", và viết test cho cả lớp cha, record và field `null`.
:::

:::version 21 Java 8 / 17 / 21
- `ClassValue`: Java 7. Pattern `v instanceof CharSequence s`: Java 16. Record và `getRecordComponents()`: Java 16.
- Java 17: reflection vào nội bộ JDK bị chặn mặc định (JEP 403) — `--illegal-access` không còn tác dụng.
- Java 18 (JEP 416): `Method.invoke`, `Field.get` được viết lại bằng method handle, nhanh hơn khi đối tượng `Method`/`Field` được giữ trong field `static final` (bài chuyên sâu có số đo).
:::

:::interview Bean Validation (`@NotBlank`, `@Size`) chạy lúc nào? Vì sao thêm `@NotBlank` vào DTO mà Spring không báo lỗi?
Annotation chỉ là siêu dữ liệu; validator phải được gọi. Trong Spring MVC, validator chạy khi tham số controller có `@Valid` hoặc `@Validated` (vd `@RequestBody @Valid TaoDonRequest req`). Thiếu `@Valid` thì không ai đọc annotation, request lọt qua. Các lý do khác: thiếu dependency `spring-boot-starter-validation` (không có cài đặt Bean Validation), DTO lồng nhau mà field con thiếu `@Valid`, hoặc annotation gắn ở chỗ provider không đọc. Với service, dùng `@Validated` trên class để Spring tạo proxy kiểm tra tham số method.
:::

:::quiz Class `Con extends Cha`. `Cha` có `@KhongKe` (retention RUNTIME, không `@Inherited`) trên class và trên method `m()`. `Con` override `m()` mà không gắn gì. Đúng hay sai? (chọn nhiều)
- [x] `Con.class.isAnnotationPresent(KhongKe.class)` là `false`
- [x] `Con.class.getMethod("m").isAnnotationPresent(KhongKe.class)` là `false`
- [ ] Thêm `@Inherited` vào `KhongKe` thì `Con.m()` sẽ có annotation
- [ ] `Cha.class.getMethod("m").isAnnotationPresent(KhongKe.class)` là `false`

`@Inherited` chỉ áp dụng cho annotation trên class, không áp dụng cho method. Method override là một method mới, không mang annotation của method cha. Đã chạy thử trên JDK 21.
:::

:::quiz Vì sao validator nên cache danh sách field theo class thay vì gọi `getDeclaredFields()` mỗi lần?
- [ ] Vì `getDeclaredFields()` trả về thứ tự khác nhau mỗi lần
- [x] Vì mỗi lần gọi trả về một mảng `Field` mới (bản sao) và phải `setAccessible` lại, tốn chi phí
- [ ] Vì gọi nhiều lần sẽ ném `InaccessibleObjectException`
- [ ] Vì reflection không thread-safe

Đo được: 1 triệu lần kiểm tra tốn ~120–160 ms khi có cache, ~380–420 ms khi tra mỗi lần. `Field` lấy ra có thể dùng chung giữa các thread.
:::

:::exercise Thêm annotation `@Email`
Thêm `@Email` (retention RUNTIME, target FIELD) vào validator: field kiểu `String` khác `null` phải khớp mẫu đơn giản `^[^@\s]+@[^@\s]+\.[a-z]{2,}$`. Biên dịch regex **một lần**. Thử với `"an@vn"`, `"an@bank.vn"`, `null`.
???
```java
@Retention(RetentionPolicy.RUNTIME) @Target(ElementType.FIELD) @interface Email {}

private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$");

// trong vòng lặp kiemTra:
if (f.isAnnotationPresent(Email.class) && v instanceof String s && !EMAIL.matcher(s).matches())
    loi.add(new Loi(f.getName(), "email không hợp lệ"));
```

Kết quả: `"an@vn"` → lỗi (phần sau `@` không có dấu chấm), `"an@bank.vn"` → hợp lệ, `null` → không báo lỗi email (để `@KhongRong` lo việc bắt buộc — mỗi annotation một trách nhiệm, giống Bean Validation: `@Email` coi `null` là hợp lệ). `Pattern` đặt `static final` vì biên dịch regex tốn kém hơn nhiều so với so khớp — xem bài *Regex*.
:::
