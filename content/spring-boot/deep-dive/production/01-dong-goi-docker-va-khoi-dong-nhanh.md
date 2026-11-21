---
title: "Đóng gói Docker và khởi động nhanh — extract jar, image nhiều layer, CDS trên Java 21"
summary: "Từ fat jar 60 MB tới image Docker chạy non-root: tách jar bằng jarmode tools, Dockerfile multi-stage để layer thư viện được cache, giới hạn bộ nhớ theo container, và CDS của Java 21 giảm thời gian khởi động từ 6,0 s xuống 2,7 s. Đo thật trên Boot 4.1.2, JDK 21."
level: advanced
version: 4
lastReviewed: 2026-11-21
tags: [spring-boot, docker, cds, startup, container, java-21]
related: [spring-boot/review/production/actuator-health-va-metric, spring-boot/consolidate/production/log-metric-va-graceful-shutdown]
changelog:
  - date: 2026-11-21
    note: "Chuyển mốc sang Java 21: đo lại toàn bộ trên JDK 21 và eclipse-temurin:21-jre; tăng tốc khởi động bằng CDS (Java 21) thay cho AOT cache (JDK 24+, chuyển vào ghi chú nâng cấp); sửa lệnh huấn luyện thành -Dspring.context.exit=onRefresh."
---

## Tóm tắt nhanh

- `mvn package` tạo **fat jar** (ứng dụng + mọi thư viện, ở đây 60 MB). Chạy được ngay, nhưng không tối ưu cho Docker và khởi động chậm nhất.
- `java -Djarmode=tools -jar app.jar extract` tách jar thành `app.jar` + thư mục `lib/`. Khởi động nhanh hơn ~20% và cho phép tách **layer Docker**: thư viện (59,9 MB) ít đổi, code ứng dụng (16,4 kB) đổi mỗi lần build.
- Dockerfile **multi-stage**, chạy bằng user **không phải root**, `ENTRYPOINT` dạng mảng để Java là PID 1 và nhận `SIGTERM` (graceful shutdown chạy đúng).
- Trong container, đặt bộ nhớ heap theo **tỷ lệ** (`-XX:MaxRAMPercentage=75`), không cứng `-Xmx`.
- **CDS** (Class Data Sharing, có sẵn trên Java 21): chạy "huấn luyện" một lần với `-XX:ArchiveClassesAtExit` để lưu các class đã nạp; lần chạy sau dùng archive. Đo được **6,0 s → 2,7 s** (trong Docker: 5,0 s → 2,7 s).
- Huấn luyện bằng **system property** `-Dspring.context.exit=onRefresh`. Viết thành tham số chương trình (`--spring.context.exit=…`) thì ứng dụng **không thoát** (đã thử) và bước build treo.

## Cơ chế: vì sao khởi động Spring Boot chậm

Khi khởi động, JVM phải đọc, kiểm tra (verify) và liên kết hàng nghìn class từ ~100 jar; Spring quét annotation, đánh giá điều kiện auto-configuration và tạo bean. Phần lớn công việc này **lặp lại y hệt** ở mỗi lần khởi động. Có ba hướng giảm:

| Hướng | Làm gì | Đánh đổi |
|---|---|---|
| Extract jar | Bỏ lớp "jar lồng jar", class loader đọc file jar thường | Gần như không có |
| CDS (Java 21) | Lưu sẵn class đã nạp và kiểm tra vào một file archive | Cần bước huấn luyện, archive gắn với đúng JDK và đúng classpath |
| AOT cache (JDK 24+) | Như CDS, thêm class đã liên kết và profile của method | Chỉ có từ JDK 24 — xem ghi chú nâng cấp cuối bài |
| Native image (GraalVM) | Biên dịch trước thành file thực thi | Build lâu, hạn chế reflection/proxy, debug khó hơn |

Bài này đi theo hai hướng đầu vì chúng không đổi cách viết code.

## Bước 1: fat jar và extract

Đo trên máy 4 CPU, JDK 21.0.12, ứng dụng `don-hang-api` (web, JPA, Flyway, Security, Actuator, Validation) nối PostgreSQL 16, lấy số `Started DonHangApplication in … seconds`:

```text
fat jar (java -jar target/don-hang-api-0.0.1-SNAPSHOT.jar):  6.382  5.735  5.972 s
```

```bash
java -Djarmode=tools -jar target/don-hang-api-0.0.1-SNAPSHOT.jar extract --destination ext
ls ext          # don-hang-api-0.0.1-SNAPSHOT.jar  lib/   (lib có 87 jar)
java -jar ext/don-hang-api-0.0.1-SNAPSHOT.jar
```

```text
jar đã extract:                                             4.845  4.980  4.569 s
```

`app.jar` sau extract chỉ chứa code của bạn và một `MANIFEST.MF` với `Class-Path: lib/…`, nên JVM nạp thư viện như classpath bình thường.

## Bước 2: Dockerfile nhiều layer, non-root

```dockerfile title="Dockerfile"
FROM eclipse-temurin:21-jre AS build
WORKDIR /build
COPY target/don-hang-api-0.0.1-SNAPSHOT.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --destination ext

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 ungdung
WORKDIR /app
COPY --from=build /build/ext/lib/ lib/          # layer lớn, ít đổi → được cache
COPY --from=build /build/ext/app.jar app.jar    # layer nhỏ, đổi mỗi lần build
USER 10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

Kết quả đã chạy:

```text
$ docker history don-hang-api:1 (rút gọn)
ENTRYPOINT ["java" "-XX:MaxRAMPercentage=75" …]   0B
USER 10001                                        0B
COPY /build/ext/app.jar app.jar                   16.4kB
COPY /build/ext/lib/ lib/                         59.9MB

$ docker run --network host -e SPRING_DATASOURCE_URL=… don-hang-api:1
Starting DonHangApplication … with PID 1
Started DonHangApplication in 5.111 seconds      (3 lần: 5.111  5.008  4.974 s)

$ docker exec <id> id
uid=10001(ungdung) gid=999(ungdung) groups=999(ungdung)
$ curl -s localhost:8080/actuator/health
{"groups":["liveness","readiness"],"status":"UP"}

$ docker stop <id>                                (135 ms)
Commencing graceful shutdown. Waiting for active requests to complete
Graceful shutdown complete
```

Những điểm quyết định:

- **Thứ tự `COPY`**: thư viện trước, code sau. Sửa một dòng code → chỉ layer 16 kB build và push lại; registry và node đã có layer 60 MB.
- **`ENTRYPOINT` dạng mảng (exec form)**: Java là PID 1 nên nhận thẳng `SIGTERM` từ `docker stop`/Kubernetes. Dạng chuỗi (`ENTRYPOINT java -jar app.jar`) chạy qua `/bin/sh -c`, shell nhận tín hiệu và có thể không chuyển cho Java → hết thời gian chờ thì bị `SIGKILL`, mất graceful shutdown.
- **Non-root**: lỗ hổng trong ứng dụng không cho kẻ tấn công quyền root trong container. Nhiều cluster (Pod Security `restricted`) từ chối container chạy root.
- **Image JRE**, không phải JDK: không cần `javac` lúc chạy. Image 593 MB phần lớn là hệ điều hành + JRE; có thể giảm thêm bằng base image nhỏ hơn hoặc `jlink`, nhưng đó là tối ưu sau.
- **Bí mật qua biến môi trường/secret**, không `COPY` file `application-prod.yml` có mật khẩu vào image.

Spring Boot cũng có `mvn spring-boot:build-image` (Cloud Native Buildpacks) tạo image nhiều layer, non-root mà không cần Dockerfile — hợp khi đội không muốn tự bảo trì Dockerfile.

## Bước 3: bộ nhớ trong container

JVM đọc giới hạn của cgroup (container) chứ không đọc RAM của máy. Mặc định heap tối đa chỉ **25%** giới hạn container — thường quá ít cho ứng dụng web. Ngược lại, đặt `-Xmx` bằng đúng giới hạn container sẽ bị `OOMKilled`, vì JVM còn dùng bộ nhớ ngoài heap: metaspace, stack các thread, code cache, buffer của Netty/NIO, GC.

| Cách đặt | Container 1 GiB | Rủi ro |
|---|---|---|
| Mặc định | heap tối đa ~256 MiB | Heap nhỏ, GC dày |
| `-Xmx1g` | heap tối đa 1 GiB | Tổng > 1 GiB → OOMKilled |
| `-XX:MaxRAMPercentage=75` | heap tối đa ~768 MiB | Còn ~256 MiB cho phần ngoài heap |

Dùng tỷ lệ thì đổi `resources.limits.memory` trong Kubernetes không phải sửa image.

## Bước 4: CDS trên Java 21

Huấn luyện một lần (thường làm trong bước build image): ứng dụng khởi động tới khi tạo xong context rồi thoát, JVM ghi mọi class đã nạp ra file archive.

```bash
java -XX:ArchiveClassesAtExit=app.jsa -Dspring.context.exit=onRefresh -jar ext/don-hang-api-0.0.1-SNAPSHOT.jar
# … vài dòng [warning][cds] Preload Warning: Verification failed for … (class không dùng tới, bỏ qua được)
ls -la app.jsa     # 97026048 byte ≈ 97 MB
```

```bash bad
java -XX:ArchiveClassesAtExit=app.jsa -jar app.jar --spring.context.exit=onRefresh
# đã thử: ứng dụng khởi động xong rồi CHẠY TIẾP (Started … in 4.987 seconds), không bao giờ thoát
```

`spring.context.exit` là **system property** của Spring Framework, phải truyền bằng `-D` trước `-jar`. Viết thành tham số chương trình thì Spring Boot chỉ coi nó là một property cấu hình bình thường, ứng dụng chạy mãi và bước `RUN` trong Dockerfile treo.

Chạy với archive:

```bash
java -XX:SharedArchiveFile=app.jsa -jar ext/don-hang-api-0.0.1-SNAPSHOT.jar
```

```text
fat jar:             6.382  5.735  5.972 s
jar đã extract:      4.845  4.980  4.569 s
extract + CDS:       2.761  2.702  3.155 s
```

Bật `-Xlog:class+load` thấy **16.374 / 17.022** class (96%) được nạp từ archive (`source: shared objects file`) thay vì đọc, giải nén và kiểm tra lại từ jar.

Điều kiện để archive được dùng:

- **Cùng bản JDK** lúc huấn luyện và lúc chạy → huấn luyện trong chính image chạy.
- **Cùng classpath**, các jar không đổi → đó là lý do phải extract. Đã thử dùng `app.jsa` (tạo từ bản extract) để chạy **fat jar**: ứng dụng **không khởi động được** (`NoClassDefFoundError: org/slf4j/helpers/NOPLogger`), trong khi fat jar chạy bình thường khi không có archive. Archive phải được tạo và dùng với đúng một cách chạy.
- Archive ~97 MB làm image lớn hơn (593 MB → 715 MB); đổi lại khởi động nhanh hơn ~2 lần.

```dockerfile title="Dockerfile.cds"
FROM eclipse-temurin:21-jre AS build
WORKDIR /build
COPY target/don-hang-api-0.0.1-SNAPSHOT.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --destination ext

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 ungdung
WORKDIR /app
COPY --from=build /build/ext/lib/ lib/
COPY --from=build /build/ext/app.jar app.jar
# huấn luyện CDS: khởi động tới khi tạo xong context rồi thoát, ghi class đã nạp vào app.jsa
RUN java -XX:ArchiveClassesAtExit=app.jsa -Dspring.context.exit=onRefresh -jar app.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:SharedArchiveFile=app.jsa", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

```text
$ docker build --network host -t don-hang-api:cds -f Dockerfile.cds .
$ docker history don-hang-api:cds    → RUN java -XX:ArchiveClassesAtExit…   96.4MB
$ docker run --network host don-hang-api:cds
Started DonHangApplication in 2.693 seconds      (3 lần: 2.693  2.709  2.673 s; không CDS: ~5,0 s)
```

Lúc huấn luyện ứng dụng khởi động **thật**: Flyway có thể migrate, Hibernate kết nối DB, bean có thể gọi dịch vụ ngoài. Ở trên bước build dùng `--network host` để tới được PostgreSQL. Trong CI thật, dùng một profile riêng cho bước này (DB tạm bằng Testcontainers/service container, hoặc tắt các bean gọi ra ngoài), và không bao giờ trỏ bước build vào DB production.

Khi nào đáng làm: autoscaling cần pod mới sẵn sàng nhanh, job ngắn chạy theo lịch, môi trường serverless. Một service chạy liên tục vài tuần thì 2–3 giây khởi động ít quan trọng hơn kích thước image.

## So sánh phương án

| Nhu cầu | Chọn |
|---|---|
| Chạy thử, máy chủ truyền thống | Fat jar + `java -jar` |
| Docker/Kubernetes thông thường | Extract + Dockerfile nhiều layer, non-root (hoặc `build-image`) |
| Cần khởi động nhanh, vẫn JVM đầy đủ | Thêm CDS (Java 21); khi lên JDK 24+ chuyển sang AOT cache |
| Khởi động tính bằng mili giây, bộ nhớ rất thấp | GraalVM native image (chấp nhận build lâu, giới hạn reflection) |

:::senior Góc nhìn senior
Một image tốt cho production là image mà đội vận hành không phải hỏi gì: chạy non-root, nhận `SIGTERM` đúng, cấu hình qua biến môi trường, có health check (`/actuator/health/liveness`, `/readiness`), log JSON ra stdout, bộ nhớ theo tỷ lệ. Tối ưu thời gian khởi động (CDS, AOT cache, native) chỉ làm sau khi đo được nó là vấn đề — ví dụ HPA scale-out không kịp lúc cao điểm.
:::

:::version 24+ Khi nâng lên JDK 24 / 25: AOT cache
JDK 24 (JEP 483) và JDK 25 (JEP 514, 515) mở rộng CDS thành **AOT cache**: ngoài class đã nạp còn lưu class đã liên kết và profile của method, nên khởi động và warmup nhanh hơn nữa. Đổi hai cờ, phần còn lại của Dockerfile giữ nguyên:

```dockerfile
RUN java -XX:AOTCacheOutput=app.aot -Dspring.context.exit=onRefresh -jar app.jar
ENTRYPOINT ["java", "-XX:AOTCache=app.aot", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

Cùng điều kiện như CDS: đúng bản JDK, đúng classpath, phải extract jar; file cache lớn hơn archive CDS. Các cờ `-XX:AOTCache*` không có trên JDK 21 — bài này chưa đo lại AOT cache vì máy đo chỉ có JDK 21.
:::

:::quiz Vì sao trong Dockerfile phải `COPY lib/` trước rồi mới `COPY app.jar`?
- [ ] Java yêu cầu thư viện có mặt trước
- [x] Layer thư viện (60 MB) ít thay đổi nên được Docker cache; sửa code chỉ build lại layer `app.jar` (16 kB)
- [ ] Để image nhỏ hơn
- [ ] Để chạy được bằng user non-root

Docker build lại mọi layer kể từ layer đầu tiên thay đổi. Đặt phần hay đổi ở cuối.
:::

:::quiz `docker stop` chờ 10 giây rồi container bị kill, log không có "Graceful shutdown complete". Nguyên nhân khả dĩ nhất?
- [ ] Thiếu `server.shutdown=graceful` — mặc định là immediate
- [x] `ENTRYPOINT` dạng chuỗi chạy qua shell, shell là PID 1 nên `SIGTERM` không tới Java
- [ ] Chạy bằng user non-root nên không nhận tín hiệu
- [ ] Do `MaxRAMPercentage`

Từ Boot 3.4 graceful là mặc định. Với exec form, Java là PID 1 (`with PID 1` trong log) và `docker stop` xong trong ~0,1–0,2 s (đo trên JDK 21).
:::

:::exercise Tính bộ nhớ cho container
Pod có `limits.memory: 768Mi`. Ứng dụng có ~200 thread (Tomcat + pool), metaspace đo được ~120 MB. Chọn `MaxRAMPercentage` và giải thích. Nếu pod vẫn bị `OOMKilled` trong khi log không có `OutOfMemoryError`, bạn kiểm tra gì?
???
Phần ngoài heap ước tính: metaspace ~120 MB, stack 200 thread (mỗi thread tối đa 1 MB nhưng thường dùng vài trăm kB, ước ~100 MB), code cache ~50 MB, GC và buffer vài chục MB → khoảng 300 MB. Còn lại ~470 MB cho heap, tức khoảng **60%** (`-XX:MaxRAMPercentage=60`, heap tối đa ~460 MiB). 75% (576 MiB heap) để lại chỉ ~190 MiB — dễ vượt giới hạn.

`OOMKilled` không kèm `OutOfMemoryError` nghĩa là **container** vượt giới hạn, không phải heap đầy. Kiểm tra: `jcmd <pid> VM.native_memory summary` (chạy với `-XX:NativeMemoryTracking=summary`) để xem phần nào ngoài heap tăng; số thread (`jvm.threads.live` trên actuator); direct buffer (`jvm.buffer.memory.used`). Cách sửa: giảm tỷ lệ heap, giới hạn pool thread, hoặc tăng `limits.memory`.
:::
