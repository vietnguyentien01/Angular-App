---
title: "Bẫy của inner class và generic — giữ object ngoài trong bộ nhớ, raw type, name clash"
summary: "Đo inner class và anonymous class giữ cả object ngoài 1 MB trong bộ nhớ ra sao (và vì sao biên dịch --release 17 thì giữ, --release 21 thì không), raw type đẩy ClassCastException ra xa chỗ sai, lỗi name clash do type erasure, và cách viết generic method gọn. Chạy trên JDK 21."
level: intermediate
version: 21
lastReviewed: 2026-11-21
tags: [java, inner-class, generics, memory, pitfalls]
related: [java/review/class-nang-cao/nested-class-access-modifier-generic-method, java/consolidate/jvm/chan-doan-memory-leak-va-oom]
---

## Tóm tắt nhanh

- Inner class và anonymous class **có thể** giữ tham chiếu ẩn `this$0` tới object ngoài. Object nhỏ sống lâu (để trong cache, listener, `static List`) sẽ giữ luôn object ngoài lớn → rò rỉ bộ nhớ.
- Từ javac 18, nếu inner class **không dùng** gì của object ngoài thì không sinh `this$0` — nhưng chỉ khi biên dịch với `--release 18` trở lên. Dự án vẫn để `release 17` thì vẫn bị.
- **Raw type** (`List` không có `<…>`) tắt kiểm tra kiểu: dữ liệu sai lọt vào, rồi `ClassCastException` nổ ở chỗ **đọc ra**, cách xa chỗ ghi sai.
- Do type erasure: không overload được `f(List<String>)` và `f(List<Integer>)`, không `new T[]`, không `instanceof List<String>`.

## Cơ chế: `this$0`

Inner class cần một object ngoài để đọc field, nên javac thêm một field ẩn và một tham số constructor:

```text
$ javap -p 'Leak$DongDungOuter'
class Leak$DongDungOuter {
  final Leak this$0;              ← tham chiếu tới object Leak đã tạo ra nó
  Leak$DongDungOuter(Leak);
  java.lang.String nhan();
}
```

Chừng nào object `DongDungOuter` còn sống, object `Leak` (và mọi thứ nó giữ) cũng còn sống.

## Đo thử

```java title="Leak.java"
public class Leak {
    byte[] duLieuLon = new byte[1_000_000];          // mỗi Leak giữ 1 MB
    String ten = "báo cáo";

    class DongKhongDungOuter { int so = 1; }
    class DongDungOuter { String nhan() { return ten; } }   // dùng field của object ngoài
    static class DongStatic { int so = 1; }
    Runnable taoListener() { return new Runnable() { public void run() { System.out.println("xong"); } }; }
    Runnable taoLambda()   { return () -> System.out.println("xong"); }

    static List<Object> giu = new ArrayList<>();      // giữ 100 object nhỏ, bỏ object Leak
    // main: giu.add(new Leak().new DongDungOuter()) … 100 lần, System.gc(), in heap đang dùng
}
```

Kết quả trên JDK 21, `-Xmx256m`:

```text
                      javac --release 21     javac --release 17
inner-dung (dùng ten)        106 MB                106 MB
inner-khong (không dùng)       1 MB                106 MB
anon (anonymous class)         1 MB                106 MB
lambda                         1 MB                  1 MB
static nested                  1 MB                  1 MB
```

Ba điều rút ra:

1. Inner class **dùng** state của object ngoài thì luôn giữ object ngoài — đó là bản chất của nó, không phải lỗi.
2. Inner/anonymous class **không dùng** gì của object ngoài: javac 21 với `--release 21` bỏ `this$0` (đã kiểm tra bằng `javap`), nhưng với `--release 17` vẫn sinh. Nhiều dự án dùng JDK 21 nhưng `maven.compiler.release` vẫn là 17 — đừng dựa vào tối ưu này.
3. Lambda không bắt `this` nếu không dùng tới; `static` nested class không bao giờ giữ object ngoài.

```java bad
class ManHinhBaoCao {
    byte[] bieuDo = new byte[5_000_000];
    void dangKy(EventBus bus) {
        bus.subscribe(new Listener() {                 // anonymous class sống cùng bus
            public void onEvent(Event e) { veLai(); }  // dùng method của ManHinhBaoCao → giữ cả màn hình
        });
    }
}
// đóng màn hình nhưng không huỷ đăng ký → mỗi lần mở là thêm 5 MB không bao giờ được thu hồi
```

```java good
class ManHinhBaoCao implements AutoCloseable {
    private final Subscription sub;
    ManHinhBaoCao(EventBus bus) { sub = bus.subscribe(e -> veLai()); }
    @Override public void close() { sub.cancel(); }    // vòng đời rõ ràng: mở thì đăng ký, đóng thì huỷ
}
```

Gốc của lỗi là **vòng đời**: một object sống ngắn (màn hình, request) đăng ký vào một object sống lâu (bus, cache, `static`). Dùng lambda hay anonymous class đều bị nếu callback dùng tới object ngoài.

## Raw type

```java bad
List ds = new ArrayList<String>();   // raw type: compiler chỉ cảnh báo "unchecked"
ds.add(1);                            // lọt vào được
List<String> chuoi = ds;
String s = chuoi.get(0);              // ClassCastException ở ĐÂY, không phải ở dòng add
// class java.lang.Integer cannot be cast to class java.lang.String …
```

```java good
List<String> ds = new ArrayList<>();
ds.add(1);   // lỗi biên dịch: incompatible types: int cannot be converted to String
```

Raw type còn sót trong code cũ (trước Java 5) hoặc khi gọi API reflection. Bật `-Xlint:unchecked` (hoặc `-Werror` trong CI) để không có cảnh báo nào bị bỏ qua. Khi không biết kiểu, dùng `List<?>`: đọc ra được `Object`, nhưng không thêm phần tử được — an toàn hơn raw type.

## Giới hạn do type erasure

Đã biên dịch thử trên JDK 21:

```java bad
static void tong(List<String> a) {}
static void tong(List<Integer> a) {}
// error: name clash: tong(List<Integer>) and tong(List<String>) have the same erasure

static <T> T[] taoMang(int n) { return new T[n]; }
// error: generic array creation
```

```java good
static void tongChuoi(List<String> a) {}       // đặt tên khác
static void tongSo(List<Integer> a) {}

static <T> T[] taoMang(IntFunction<T[]> tao, int n) { return tao.apply(n); }
taoMang(String[]::new, 3);                     // String[3] — giống cách List.toArray(String[]::new) làm
```

## Pitfalls

- Inner class **không static** đặt làm `Comparator`/`Runnable` gửi cho thread pool hoặc cache → giữ object ngoài lâu hơn bạn nghĩ.
- Anonymous class `Serializable` (vd `new HashMap<>() {{ put(…); }}` — "double brace initialization") serialize luôn object ngoài, hoặc lỗi `NotSerializableException`. Dùng `Map.of(...)`.
- `protected` field cho lớp con "tiện" sửa trực tiếp → lớp cha mất kiểm soát bất biến. Ưu tiên `private` + method `protected`.
- Generic method nhận `List<Object>` tưởng là "nhận mọi list": `List<String>` **không** truyền vào được (generics bất biến). Dùng `List<?>` hoặc `<T> … List<T>`.
- `@SuppressWarnings("unchecked")` đặt trên cả class giấu mọi lỗi về sau. Đặt ở phạm vi nhỏ nhất (một biến, một method) kèm comment lý do.

:::senior Góc nhìn senior
Khi review, nhìn mọi chỗ "đăng ký" (listener, callback, scheduler, cache) và hỏi: object nào sống lâu hơn, ai huỷ đăng ký? Câu trả lời quan trọng hơn chuyện chọn lambda hay class. Với generic, quy tắc thực dụng: API public dùng wildcard theo PECS ở tham số, kiểu cụ thể ở giá trị trả về, không bao giờ trả raw type; còn trong code nội bộ, generic method nhỏ (`<T>` một chữ) dễ đọc hơn hệ thống bounded type lồng nhau nhiều tầng.
:::

:::version 21 Java 17 / 21
- Bỏ `this$0` khi inner class không dùng object ngoài: javac 18+ (JDK-8271623), áp dụng khi `--release` ≥ 18. Đo ở trên: `--release 17` vẫn giữ 106 MB.
- Raw type, type erasure: không đổi từ Java 5. Dự án Valhalla (generic chuyên biệt hoá) chưa có trong bản phát hành chính thức nào.
:::

:::interview Vì sao anonymous class có thể gây memory leak? Lambda có bị không?
Anonymous class và inner class khai báo trong instance method thường giữ một tham chiếu ẩn tới object bao quanh (`this$0`). Nếu object anonymous được đăng ký vào thứ sống lâu — event bus, cache, `static` collection, scheduler — thì object bao quanh (vd một màn hình hoặc một service tạm có dữ liệu lớn) không bao giờ được GC thu hồi. Lambda chỉ bắt `this` khi thân lambda dùng field hoặc method của object bao quanh; khi đó nó cũng giữ object như anonymous class. Cách sửa không nằm ở cú pháp mà ở vòng đời: huỷ đăng ký khi object ngắn hạn kết thúc (`AutoCloseable`), hoặc dùng static nested class chỉ giữ đúng dữ liệu cần thiết.
:::

:::quiz Dự án dùng JDK 21 nhưng `maven.compiler.release` là 17. Một anonymous class trong instance method **không** dùng field nào của object ngoài. Nó có giữ object ngoài không?
- [x] Có — với `--release 17` javac vẫn sinh `this$0`
- [ ] Không — JDK 21 luôn bỏ tham chiếu không dùng
- [ ] Chỉ khi chạy trên JVM 17
- [ ] Không bao giờ, anonymous class không có `this$0`

Đã đo: cùng code, `--release 17` giữ 106 MB, `--release 21` giữ 1 MB. Tối ưu này phụ thuộc mức `release` khi biên dịch, không phụ thuộc JVM chạy.
:::

:::quiz Đoạn nào biên dịch **lỗi**? (chọn nhiều)
- [x] Hai method `void f(List<String> a)` và `void f(List<Integer> a)` trong cùng class
- [x] `static <T> T[] tao(int n) { return new T[n]; }`
- [ ] `static <T> List<T> tao(int n) { return new ArrayList<>(n); }`
- [ ] `List<?> ds = List.of("a", 1); Object o = ds.get(0);`

Hai lỗi đầu do type erasure: `name clash … have the same erasure` và `generic array creation`. Đã biên dịch thử trên JDK 21.
:::

:::exercise Viết generic method nhóm theo key
Viết `static <T, K> Map<K, List<T>> nhomTheo(Collection<? extends T> ds, Function<? super T, ? extends K> layKey)` giữ thứ tự xuất hiện của key, không dùng Stream. Thử với `nhomTheo(List.of("an", "bình", "anh", "bảo"), s -> s.charAt(0))`.
???
```java
static <T, K> Map<K, List<T>> nhomTheo(Collection<? extends T> ds, Function<? super T, ? extends K> layKey) {
    Map<K, List<T>> kq = new LinkedHashMap<>();          // giữ thứ tự key xuất hiện
    for (T x : ds) kq.computeIfAbsent(layKey.apply(x), k -> new ArrayList<>()).add(x);
    return kq;
}
nhomTheo(List.of("an", "bình", "anh", "bảo"), s -> s.charAt(0));   // {a=[an, anh], b=[bình, bảo]}
```

Wildcard theo PECS: `ds` chỉ đọc ra (`? extends T`), `layKey` nhận `T` vào (`? super T`) và trả `K` ra (`? extends K`). Nhờ vậy truyền được `Function<Object, Character>` hay `List<String>` cho `T = CharSequence`. Đã chạy thử trên JDK 21.
:::
