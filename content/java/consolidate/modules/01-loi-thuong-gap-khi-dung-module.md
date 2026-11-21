---
title: "Lỗi thường gặp với module khi nâng lên Java 17/21 — InaccessibleObjectException, --add-opens, API nội bộ, split package"
summary: "Luyện tay với lỗi hay gặp khi đưa dự án cũ lên Java 17/21: InaccessibleObjectException và --add-opens (dòng lệnh, Surefire, manifest Add-Opens chỉ có tác dụng với java -jar), IllegalAccessError khi dùng API nội bộ, tìm bằng jdeps, JAXB đã bị gỡ, automatic module, split package."
level: intermediate
version: 21
lastReviewed: 2026-11-21
tags: [java, jpms, module, migration, pitfalls]
related: [java/review/modules/module-info-va-module-path-co-ban, java/deep-dive/modules/ben-trong-jpms-jlink-va-runtime-nho-gon]
---

## Tóm tắt nhanh

- Dự án Java 8 lên Java 17/21 hầu như **không cần** viết `module-info.java`. Các lỗi gặp phải đến từ việc JDK **tự đóng** phần nội bộ của nó (JEP 403), kể cả khi ứng dụng chạy trên classpath.
- `InaccessibleObjectException … does not "opens java.lang" to unnamed module`: có thư viện dùng reflection vào nội bộ JDK. Cách đúng: **nâng thư viện**. Tạm thời: `--add-opens java.base/java.lang=ALL-UNNAMED`.
- `IllegalAccessError … does not export sun.security.util`: code đã biên dịch **dùng trực tiếp** class nội bộ của JDK. Tìm hết bằng `jdeps --jdk-internals`.
- `ClassNotFoundException: javax.xml.bind.JAXBContext`: JAXB, JAX-WS, CORBA bị **gỡ khỏi JDK** từ Java 11. Thêm dependency riêng (và chuyển sang `jakarta.*`).
- Jar không có `module-info` đặt trên module path thành **automatic module** với tên đoán từ tên file — tên này có thể đổi. Hai module export cùng một package → lỗi **split package**.

## Cơ chế: vì sao code chạy trên classpath vẫn bị chặn

Code trên classpath nằm trong *unnamed module*. Unnamed module **đọc** được mọi module, nhưng chỉ truy cập được những package mà module đó `exports`/`opens`. `java.base` không export `sun.*`, `jdk.internal.*` và không `opens java.lang`, `java.util`… cho ai cả. Từ Java 16–17 quy tắc này được áp dụng thật thay vì chỉ cảnh báo. Ứng dụng của bạn không đổi gì, nhưng thư viện bên trong (Lombok, Mockito, Gson, Kryo, Groovy, một số driver và agent cũ) từng "lách" vào nội bộ JDK thì vỡ.

## Tái hiện: reflection vào `String`

```java title="DocString.java"
public class DocString {
    public static void main(String[] a) throws Exception {
        var f = String.class.getDeclaredField("value");
        f.setAccessible(true);
        System.out.println("đọc được String.value: " + ((byte[]) f.get("Việt")).length + " byte");
    }
}
```

Chạy trên JDK 21:

```text
$ java -cp mfo DocString
InaccessibleObjectException: Unable to make field private final byte[] java.lang.String.value accessible:
  module java.base does not "opens java.lang" to unnamed module @42a57993

$ java --add-opens java.base/java.lang=ALL-UNNAMED -cp mfo DocString
đọc được String.value: 8 byte

$ java -jar ds2.jar             # manifest có dòng "Add-Opens: java.base/java.lang"
đọc được String.value: 8 byte

$ java -cp ds2.jar DocString    # cùng jar, nhưng không chạy bằng -jar
InaccessibleObjectException: … does not "opens java.lang" to unnamed module @55f96302
```

Thuộc tính `Add-Opens` (và `Add-Exports`) trong `MANIFEST.MF` chỉ được đọc khi chạy bằng **`java -jar`**. Fat jar của Spring Boot chạy bằng `java -jar` nên dùng được; chạy bằng `-cp` (một số Dockerfile, IDE) thì không.

## Đặt `--add-opens` ở đâu

```xml title="pom.xml — test chạy trong JVM riêng của Surefire"
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <configuration>
    <argLine>--add-opens java.base/java.lang=ALL-UNNAMED</argLine>
  </configuration>
</plugin>
```

```bash title="Dockerfile / script chạy"
java --add-opens java.base/java.lang=ALL-UNNAMED -jar app.jar
# hoặc qua biến môi trường mà JVM tự đọc:
JDK_JAVA_OPTIONS="--add-opens java.base/java.lang=ALL-UNNAMED"
```

```bash bad
java --illegal-access=permit -jar app.jar
# Java 17+: OpenJDK 64-Bit Server VM warning: Ignoring option --illegal-access=permit; support was removed in 17.0
```

Mỗi `--add-opens` là một **món nợ kỹ thuật**: ghi lại thư viện nào cần nó và vì sao, và bỏ đi khi nâng thư viện. Không thêm hàng loạt `--add-opens` cho mọi package "cho chắc" — đó là tắt lớp bảo vệ của JDK.

## API nội bộ trong code của bạn

```java bad
System.out.println(new sun.security.util.HexDumpEncoder().encode("Việt".getBytes()));
// biên dịch: cần --add-exports java.base/sun.security.util=ALL-UNNAMED
// chạy:      IllegalAccessError: class Noi (in unnamed module) cannot access class sun.security.util.HexDumpEncoder
//            (in module java.base) because module java.base does not export sun.security.util to unnamed module
```

```bash good
$ jdeps --jdk-internals noi
noi -> java.base
   Noi   -> sun.security.util.HexDumpEncoder   JDK internal API (java.base)
```

Chạy `jdeps --jdk-internals` trên jar của ứng dụng **và** thư mục `lib/` (mọi dependency) trước khi nâng JDK — nó liệt kê từng chỗ dùng API nội bộ kèm gợi ý thay thế cho các API phổ biến (vd `sun.misc.BASE64Encoder` → `java.util.Base64`). Lưu ý `sun.misc.Unsafe` nằm trong module `jdk.unsupported`, **vẫn** được export — jdeps không báo, nhưng các method truy cập bộ nhớ của nó đang dần bị loại bỏ ở các bản JDK sau 21.

## Module bị gỡ khỏi JDK

```text
$ java Jx.java      # Class.forName("javax.xml.bind.JAXBContext")
ClassNotFoundException: javax.xml.bind.JAXBContext
$ java --list-modules | grep xml.bind      # JDK 21: không có
```

Java 11 (JEP 320) gỡ `java.xml.bind` (JAXB), `java.xml.ws` (JAX-WS), `java.activation`, `java.corba`, `java.transaction`. Code Java 8 dùng JAXB để đọc XML (rất phổ biến khi tích hợp với hệ thống ngân hàng, bảo hiểm qua SOAP) phải thêm dependency:

```xml
<dependency>
  <groupId>jakarta.xml.bind</groupId>
  <artifactId>jakarta.xml.bind-api</artifactId>
</dependency>
<dependency>
  <groupId>org.glassfish.jaxb</groupId>
  <artifactId>jaxb-runtime</artifactId>
</dependency>
```

Bản Jakarta mới đổi package `javax.xml.bind` → `jakarta.xml.bind` — phải sửa import (Spring Boot 3+ cũng dùng `jakarta.*`).

## Automatic module và split package

```text
$ jar --describe-module --file lib2/thu-vien-cu-1.4.2.jar
No module descriptor found. Derived automatic module.
thu.vien.cu@1.4.2 automatic
```

Jar không có `module-info.class` đặt trên module path trở thành **automatic module**: export và opens mọi package, đọc mọi module. Tên lấy từ thuộc tính `Automatic-Module-Name` trong manifest, không có thì **đoán từ tên file** (`thu-vien-cu-1.4.2.jar` → `thu.vien.cu`). `requires thu.vien.cu;` sẽ vỡ khi thư viện thêm `Automatic-Module-Name` khác hoặc đổi tên file. Khi viết thư viện dùng chung trong công ty, luôn đặt `Automatic-Module-Name`.

```java bad
module m.a { exports vn.hoc.chung; }
module m.b { exports vn.hoc.chung; }
module m.c { requires m.a; requires m.b; }
// error: module m.c reads package vn.hoc.chung from both m.a and m.b
```

Trên classpath, hai jar chứa cùng package (vd hai bản của một thư viện, hoặc `javax.annotation` có ở nhiều jar) không báo lỗi — class nào nạp trước thì thắng, lỗi lộ ra lúc chạy theo cách khó đoán. Module path phát hiện ngay. Sửa: đổi package, gộp hai module, hoặc loại jar trùng (`mvn dependency:tree`).

## Pitfalls

- Thêm `module-info.java` vào ứng dụng Spring Boot "cho hiện đại" → phải `opens` mọi package có bean, entity, DTO cho Spring/Hibernate/Jackson, và nhiều thư viện chưa có tên module ổn định. Lợi ích thường không đáng.
- `--add-opens` đặt trong `JAVA_OPTS` nhưng script khởi động không truyền biến đó cho `java`. Kiểm tra bằng `jcmd <pid> VM.command_line`.
- Test chạy được trong IDE (IDE tự thêm cờ) nhưng fail trên CI — cờ phải nằm trong `pom.xml`/`build.gradle`.
- Nâng JDK mà không nâng Lombok, Mockito, ByteBuddy, Jacoco: lỗi kiểu `Unsupported class file major version 65` (Java 21) hoặc `InaccessibleObjectException`. Nâng chúng trước.
- `requires` một module chỉ cần lúc biên dịch (annotation) → lúc chạy thiếu module đó là không khởi động được. Dùng `requires static`.

:::senior Góc nhìn senior
Khi lên kế hoạch nâng Java 8/11 lên 21 cho một hệ thống lớn: (1) chạy `jdeps --jdk-internals` và `jdeps --multi-release 21 -s` trên toàn bộ jar để có danh sách việc; (2) nâng build tool, plugin và các thư viện "chạm vào bytecode" (Lombok, Mockito, ByteBuddy, AspectJ, Jacoco) trước; (3) chạy test trên JDK mới với `maven.compiler.release` vẫn ở bản cũ, rồi mới nâng `release`; (4) mỗi `--add-opens` còn lại phải có ticket để gỡ. Không cần chuyển sang module path — mục tiêu là chạy sạch trên classpath của JDK mới.
:::

:::version 21 Java 8 / 11 / 17 / 21
- Java 9: JPMS, `--add-opens`, `--add-exports`. Java 11: gỡ JAXB, JAX-WS, CORBA (JEP 320).
- Java 16: chặn mặc định (JEP 396). Java 17: bỏ `--illegal-access` (JEP 403).
- Java 21: không đổi về module; cờ `--add-opens` vẫn là cách duy nhất để mở nội bộ JDK.
:::

:::interview Nâng ứng dụng từ Java 8 lên 17 gặp `InaccessibleObjectException`. Bạn xử lý thế nào?
Đọc thông báo để biết module/package nào bị chặn và stack trace để biết **ai** đang reflection vào đó — gần như luôn là một thư viện (Lombok, Mockito, Gson, Kryo, agent APM cũ…) chứ không phải code nghiệp vụ. Cách sửa đúng là nâng thư viện đó lên bản hỗ trợ Java 17. Nếu chưa nâng được, thêm `--add-opens <module>/<package>=ALL-UNNAMED` đúng package bị báo — ở mọi nơi JVM chạy (script khởi động, `argLine` của Surefire, manifest `Add-Opens` nếu chạy `java -jar`) — và ghi lại để gỡ sau. `--illegal-access` không còn tác dụng từ Java 17. Chạy `jdeps --jdk-internals` để tìm trước các chỗ dùng API nội bộ khác.
:::

:::quiz Fat jar có `Add-Opens: java.base/java.lang` trong `MANIFEST.MF`. Chạy bằng cách nào thì thuộc tính này **có** tác dụng?
- [x] `java -jar app.jar`
- [ ] `java -cp app.jar vn.hoc.Main`
- [ ] Cả hai
- [ ] Không cách nào, phải dùng `--add-opens`

Đã chạy thử trên JDK 21: `java -jar` đọc được `String.value`, còn `java -cp` cùng jar đó ném `InaccessibleObjectException`. Manifest chỉ được xử lý cho jar chính của `-jar`.
:::

:::quiz Code Java 8 dùng `javax.xml.bind.JAXBContext`, chạy trên JDK 21 báo `ClassNotFoundException`. Nguyên nhân?
- [ ] Thiếu `--add-opens java.xml/javax.xml.bind`
- [x] Module `java.xml.bind` đã bị gỡ khỏi JDK từ Java 11; phải thêm JAXB như một dependency riêng
- [ ] JAXB chỉ chạy trên module path
- [ ] Cần `requires java.xml.bind` trong `module-info.java`

`java --list-modules` trên JDK 21 không có `java.xml.bind`. Thêm `jakarta.xml.bind-api` + `jaxb-runtime` (và đổi import sang `jakarta.xml.bind` nếu dùng bản mới).
:::

:::exercise Lập danh sách việc trước khi nâng JDK
Cho thư mục `build/lib/` chứa jar của ứng dụng và mọi dependency. Viết các lệnh để: (1) liệt kê mọi chỗ dùng API nội bộ JDK; (2) liệt kê module JDK mà ứng dụng cần; (3) kiểm tra jar nào có tên module ổn định (`Automatic-Module-Name` hoặc `module-info`).
???
```bash
# 1. API nội bộ, cho cả ứng dụng và dependency
jdeps --jdk-internals --multi-release 21 build/lib/*.jar
# noi.jar -> java.base
#    Noi   -> sun.security.util.HexDumpEncoder   JDK internal API (java.base)

# 2. Module JDK mà ứng dụng cần (cũng là đầu vào cho jlink ở bài chuyên sâu)
jdeps --print-module-deps --ignore-missing-deps --multi-release 21 --class-path 'build/lib/*' build/lib/app.jar
# với noi.jar trong bài: java.base
# (jar đã có module-info thì dùng --module-path thay cho --class-path)

# 3. Tên module của từng jar
for j in build/lib/*.jar; do
  printf '%s: ' "$(basename "$j")"
  jar --describe-module --file "$j" 2>&1 | grep -v -e '^No module' -e '^$' | head -1
done
# phi.jar: vn.hoc.phi jar:file:…!/module-info.class      ← có module-info
# thu-vien-cu-1.4.2.jar: thu.vien.cu@1.4.2 automatic     ← tên đoán từ tên file, chưa ổn định
# noi.jar: Unable to derive module descriptor …          ← có class ở package mặc định, không dùng được trên module path
```

Đã chạy cả ba lệnh trên JDK 21 với các jar mẫu trong bài.

Kết quả bước 1 là danh sách việc phải sửa hoặc thư viện phải nâng; bước 2 cho biết ứng dụng có dùng module đã bị gỡ hay không (vd cần `java.xml.bind`); bước 3 chỉ quan trọng nếu bạn định chuyển sang module path hoặc dùng jlink.
:::
