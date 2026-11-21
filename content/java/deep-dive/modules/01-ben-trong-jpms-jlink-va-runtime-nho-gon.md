---
title: "Bên trong JPMS, ServiceLoader và jlink — module graph, readability, runtime 43 MB thay cho JDK 286 MB"
summary: "JVM dựng module graph và kiểm tra readability/accessibility thế nào, ServiceLoader với uses/provides để cắm cài đặt, jdeps tìm phụ thuộc, jlink tạo runtime chỉ gồm module cần (43 MB so với JDK 286 MB, khởi động không nhanh hơn), và khi nào nên dùng module path. Đo trên JDK 21."
level: advanced
version: 21
lastReviewed: 2026-11-21
tags: [java, jpms, module, jlink, serviceloader, internals]
related: [java/consolidate/modules/loi-thuong-gap-khi-dung-module, java/deep-dive/reflection/dynamic-proxy-methodhandle-va-hieu-nang]
---

## Tóm tắt nhanh

- Lúc khởi động, JVM đọc mọi `module-info.class` trên module path và dựng **module graph**: ai `requires` ai, gồm cả `requires transitive`. Thiếu module hay trùng package → lỗi ngay, trước khi `main` chạy.
- Hai câu hỏi JVM kiểm tra ở mỗi lần truy cập: **readability** (module A có đọc module B không) và **accessibility** (B có `exports`/`opens` package đó cho A không). Cả hai đúng thì quy tắc `public`/`private` cũ mới được xét tiếp.
- **`ServiceLoader`** + `uses`/`provides`: module dùng dịch vụ không cần biết (và không truy cập được) class cài đặt; thêm/bớt cài đặt chỉ bằng cách thêm/bớt jar.
- **jlink** tạo một runtime chứa đúng các module cần: ứng dụng mẫu cần 5 module JDK, runtime **43 MB** (chỉ `java.base`: 39 MB) so với JDK đầy đủ **286 MB**. Thời gian khởi động **không** nhanh hơn (151 ms so với 134 ms).
- jlink cần **mọi** jar là module thật (có `module-info`). Ứng dụng classpath (đa số Spring Boot) dùng jlink theo cách khác: `jdeps --print-module-deps` rồi `jlink --add-modules` chỉ cho phần JDK.

## Module graph và hai lớp kiểm tra

```text
vn.hoc.app ──requires──► vn.hoc.phi ──requires transitive──► java.sql ──► java.logging, java.xml, java.transaction.xa
     │                        │
     └──(đọc ngầm qua transitive)──────────────────────────► java.sql
mọi module ──requires mandated──► java.base
```

`jar --describe-module` cho thấy đúng những gì JVM đọc:

```text
$ jar --describe-module --file lib/phi.jar
vn.hoc.phi jar:file:///…/lib/phi.jar!/module-info.class
exports vn.hoc.phi.api
requires java.base mandated
requires java.sql transitive
contains vn.hoc.phi.noibo          ← có trong module nhưng không export
```

Khi `vn.hoc.app` truy cập một class:

1. **Readability** — `vn.hoc.app` có đọc module chứa class đó không? (`requires` trực tiếp, hoặc qua `requires transitive`). Không → `package X is not visible … does not read it`.
2. **Accessibility** — module kia có `exports` package đó (cho mọi người hoặc riêng cho `vn.hoc.app`) không? Không → `… which does not export it`. Với reflection sâu, phải là `opens`.
3. Rồi mới tới `public`/`protected`/`private` như trước Java 9.

Kiểm tra lúc chạy được đọc bằng API `Module`:

```java
Main.class.getModule().getName();                                   // "vn.hoc.app" (trên classpath: null)
Main.class.getModule().canRead(java.sql.Date.class.getModule());    // true — nhờ requires transitive
ModuleLayer.boot().findModule("vn.hoc.momo").isPresent();           // true
```

Tối ưu đáng kể nhất: JVM biết package nào thuộc module nào, nên tìm class theo package → module thay vì quét lần lượt từng jar như classpath.

## ServiceLoader: cắm cài đặt

```java title="Module API"
module vn.hoc.thanhtoan { exports vn.hoc.thanhtoan; }
public interface CongThanhToan { String ten(); String thanhToan(long tien); }
```

```java title="Hai module cài đặt — không export gì"
module vn.hoc.momo  { requires vn.hoc.thanhtoan; provides vn.hoc.thanhtoan.CongThanhToan with vn.hoc.momo.MoMo; }
module vn.hoc.vnpay { requires vn.hoc.thanhtoan; provides vn.hoc.thanhtoan.CongThanhToan with vn.hoc.vnpay.VnPay; }
```

```java title="Module dùng dịch vụ"
module vn.hoc.shop { requires vn.hoc.thanhtoan; uses vn.hoc.thanhtoan.CongThanhToan; }

for (CongThanhToan c : ServiceLoader.load(CongThanhToan.class))
    System.out.println(c.ten() + " → " + c.thanhToan(150_000));
```

Chạy trên JDK 21:

```text
$ java -p svo -m vn.hoc.shop/vn.hoc.shop.Shop
VNPAY → VNPAY trừ 150000
MoMo → MoMo trừ 150000
Class.forName("vn.hoc.momo.MoMo")…newInstance() → IllegalAccessException   ← shop không tự tạo được MoMo

$ java -p svo2 -m vn.hoc.shop/vn.hoc.shop.Shop      # bỏ thư mục vn.hoc.vnpay khỏi module path
MoMo → MoMo trừ 150000
```

- `vn.hoc.shop` không `requires vn.hoc.momo`, không biết tên class `MoMo`. JVM tìm mọi module `provides` dịch vụ đó trên module path.
- Package cài đặt không export: chỉ `ServiceLoader` tạo được object (gọi constructor không tham số, hoặc method `public static provider()`), code khác thì không — đóng gói chặt hơn classpath.
- Thứ tự duyệt không được bảo đảm (ở trên VNPAY ra trước). Cần chọn theo tên thì dùng `ServiceLoader.load(…).stream().filter(…)`.
- Trên classpath, `ServiceLoader` đọc file `META-INF/services/vn.hoc.thanhtoan.CongThanhToan` thay cho `provides`. Chính JDK dùng cơ chế này cho driver JDBC (`java.sql.Driver`), `FileSystemProvider`, `CharsetProvider`.

## jdeps: biết mình cần gì

```text
$ jdeps --module-path lib -s lib/app.jar
vn.hoc.app -> java.base
vn.hoc.app -> java.sql
vn.hoc.app -> vn.hoc.phi

$ jdeps --print-module-deps --module-path lib lib/app.jar
java.base,vn.hoc.phi
```

`-s` (summary) in phụ thuộc ở mức module; `--print-module-deps` in danh sách dạng dùng được ngay cho `jlink --add-modules`. `--jdk-internals` tìm chỗ dùng API nội bộ (bài *Lỗi thường gặp với module*).

## jlink: runtime nhỏ gọn

```bash
jlink --module-path lib:$JAVA_HOME/jmods \
      --add-modules vn.hoc.app \
      --output rt \
      --strip-debug --no-header-files --no-man-pages --compress=zip-6 \
      --launcher phi=vn.hoc.app/vn.hoc.app.Main
```

```text
$ du -sh rt                       $ rt/bin/java --list-modules
43M  rt                           java.base@21.0.12.1
                                  java.logging@21.0.12.1
$ du -sh $JAVA_HOME               java.sql@21.0.12.1
286M /usr/lib/jvm/java-21-…       java.transaction.xa@21.0.12.1
                                  java.xml@21.0.12.1
$ rt/bin/phi                      vn.hoc.app
phí 20.000.000: 4000, …           vn.hoc.phi
```

jlink tự kéo theo cả các module mà `java.sql` cần (`java.logging`, `java.xml`, `java.transaction.xa`). Runtime chỉ có `java.base` vẫn tốn 39 MB — phần lớn là bản thân JVM (`libjvm.so`), nên jlink giảm được nhiều nhất khi ứng dụng chỉ cần ít module. Thời gian khởi động (đo một lần, cùng máy): runtime jlink **151 ms**, JDK đầy đủ **134 ms** — không khác biệt đáng kể. Muốn khởi động nhanh hơn thì nhìn sang CDS/AppCDS (Java 21), AOT cache (Java 24+) hoặc GraalVM native image.

Yêu cầu và giới hạn:

- Cần thư mục `jmods` của JDK (một số bản JDK đóng gói theo hệ điều hành tách riêng gói `jmods`; từ JDK 24 có thể bật chế độ jlink không cần `jmods`).
- Mọi module trong ảnh phải là **module thật**. Automatic module (jar không có `module-info`) không đưa vào jlink được.
- Runtime tạo ra chỉ chạy trên **cùng hệ điều hành và kiến trúc** với `jmods` dùng để tạo nó.

Với ứng dụng classpath (đa số Spring Boot): tạo runtime chỉ gồm module JDK cần, rồi chạy fat jar bằng runtime đó:

```bash
MODS=$(jdeps --print-module-deps --ignore-missing-deps --multi-release 21 --class-path 'BOOT-INF/lib/*' app.jar)
jlink --add-modules "$MODS",jdk.crypto.ec --output /opt/jre --strip-debug --no-header-files --no-man-pages
/opt/jre/bin/java -jar app.jar
```

`jdeps` không thấy được các module chỉ nạp qua reflection hoặc `ServiceLoader` (vd `jdk.crypto.ec` cho TLS, `jdk.localedata` cho định dạng tiếng Việt) — thiếu chúng thì ứng dụng chạy nhưng lỗi ở chỗ bất ngờ. Luôn chạy test tích hợp trên chính runtime đã jlink.

## Khi nào dùng module path

| Tình huống | Gợi ý |
|---|---|
| Ứng dụng Spring Boot, server ứng dụng | Ở classpath. Dùng jlink chỉ để thu nhỏ JDK trong image Docker nếu cần |
| Thư viện dùng chung trong công ty | Thêm `Automatic-Module-Name` (tối thiểu), hoặc `module-info` thật nếu muốn ẩn package nội bộ |
| Ứng dụng desktop (JavaFX), CLI phân phối cho người dùng | Module + jlink (+ `jpackage` để tạo bộ cài) |
| Hệ thống plugin | `ServiceLoader` (chạy cả trên classpath), hoặc `ModuleLayer` riêng cho mỗi plugin |
| Cần ẩn API nội bộ khỏi đồng đội | `exports` chọn lọc — compiler chặn thay cho quy ước "đừng dùng package internal" |

## Tính năng mới theo phiên bản

- **Java 9**: JPMS (JEP 261), JDK chia module (JEP 200), jlink (JEP 282), `jdeps --jdk-internals`.
- **Java 11**: gỡ các module Java EE và CORBA (JEP 320). **Java 14**: `jpackage` (chính thức ở Java 16).
- **Java 16–17**: đóng nội bộ JDK (JEP 396, 403).
- **Java 21**: không thay đổi gì ở JPMS; 69 module trong JDK.
- **Khi nâng lên Java 24+**: jlink không cần `jmods` (JEP 493, tuỳ chọn khi build JDK), AOT cache cho khởi động nhanh hơn.

:::senior Góc nhìn senior
Giá trị lớn nhất của JPMS với đa số đội enterprise không phải là viết `module-info.java`, mà là **JDK đã được module hoá**: nó cho phép đóng nội bộ JDK (an toàn và dễ nâng cấp hơn), cho phép jlink thu nhỏ image, và buộc các thư viện cũ phải sạch hơn. Khi thiết kế thư viện nội bộ, hãy coi package như ranh giới API thật — `api` export, `internal` không — dù hôm nay chạy trên classpath; thêm `Automatic-Module-Name` để người dùng module path không phụ thuộc vào tên file jar. Với image Docker, so sánh jlink với base image JRE có sẵn (vd `eclipse-temurin:21-jre`) trước khi tự duy trì một runtime riêng.
:::

:::quiz Module `vn.hoc.shop` có `uses CongThanhToan` nhưng không `requires vn.hoc.momo`. `vn.hoc.momo` có `provides CongThanhToan with MoMo` và không export package nào. Điều gì đúng? (chọn nhiều)
- [x] `ServiceLoader.load(CongThanhToan.class)` trong shop trả về được object `MoMo`
- [x] Shop không thể tự `new MoMo()` hay tạo bằng reflection
- [ ] Phải export package `vn.hoc.momo` thì `ServiceLoader` mới tìm được
- [ ] Thứ tự các cài đặt trả về luôn theo thứ tự trên module path

Đã chạy trên JDK 21: ServiceLoader tìm được cả MoMo và VNPAY, còn `Class.forName(...).newInstance()` từ shop ném `IllegalAccessException`. Thứ tự không được bảo đảm.
:::

:::quiz Tạo runtime bằng `jlink` cho ứng dụng chỉ cần `java.base` và `java.sql`, so với chạy bằng JDK đầy đủ. Lợi ích chính là gì?
- [ ] Khởi động nhanh hơn nhiều lần
- [x] Kích thước runtime nhỏ hơn nhiều (43 MB so với 286 MB của JDK đầy đủ)
- [ ] Chạy nhanh hơn nhờ tối ưu toàn chương trình
- [ ] Không cần JVM nữa

Đo trên JDK 21: runtime 43 MB so với JDK 286 MB; khởi động 151 ms so với 134 ms — không khác biệt. jlink vẫn dùng HotSpot JVM; muốn bỏ JVM và khởi động cực nhanh thì đó là GraalVM native image, một công nghệ khác.
:::

:::exercise Thêm cổng thanh toán mới
Trong ví dụ ServiceLoader, thêm cổng `ZaloPay` mà **không sửa** module `vn.hoc.shop` hay `vn.hoc.thanhtoan`. Viết `module-info.java` và class cài đặt, lệnh biên dịch và chạy. Sau đó cho shop chọn cổng theo tên truyền vào từ dòng lệnh.
???
```java title="sv/vn.hoc.zalopay/module-info.java"
module vn.hoc.zalopay {
    requires vn.hoc.thanhtoan;
    provides vn.hoc.thanhtoan.CongThanhToan with vn.hoc.zalopay.ZaloPay;
}
```

```java title="sv/vn.hoc.zalopay/vn/hoc/zalopay/ZaloPay.java"
package vn.hoc.zalopay;
public class ZaloPay implements vn.hoc.thanhtoan.CongThanhToan {
    public String ten() { return "ZaloPay"; }
    public String thanhToan(long t) { return "ZaloPay trừ " + t; }
}
```

```bash
javac -d svo --module-source-path sv $(find sv -name "*.java")
java -p svo -m vn.hoc.shop/vn.hoc.shop.Shop      # in thêm dòng "ZaloPay → ZaloPay trừ 150000"
```

Chọn theo tên trong shop:

```java
String can = a.length > 0 ? a[0] : "MoMo";
CongThanhToan cong = ServiceLoader.load(CongThanhToan.class).stream()
    .map(ServiceLoader.Provider::get)
    .filter(c -> c.ten().equalsIgnoreCase(can))
    .findFirst()
    .orElseThrow(() -> new IllegalArgumentException("không có cổng " + can));
```

`stream()` (Java 9) cho phép xem `Provider::type` trước khi tạo object — hữu ích khi tạo cài đặt tốn kém. Mỗi cổng là một jar riêng: triển khai cổng mới chỉ là thêm jar vào module path, không build lại shop.
:::
