---
title: "Đóng gói Docker và khởi động nhanh — extract jar, image nhiều layer, AOT cache của JDK 25"
summary: "Từ fat jar 64 MB tới image Docker chạy non-root: tách jar bằng jarmode tools, Dockerfile multi-stage để layer thư viện được cache, giới hạn bộ nhớ theo container, và AOT cache của JDK 25 giảm thời gian khởi động từ 7,9 s xuống 2,8 s. Đo thật trên Boot 4.1.2."
level: advanced
version: 4
lastReviewed: 2026-11-16
tags: [spring-boot, docker, aot-cache, startup, container, java-25]
related: [spring-boot/review/production/actuator-health-va-metric, spring-boot/consolidate/production/log-metric-va-graceful-shutdown]
---

## Tóm tắt nhanh

- `mvn package` tạo **fat jar** (ứng dụng + mọi thư viện, ở đây 64 MB). Chạy được ngay, nhưng không tối ưu cho Docker và khởi động chậm nhất.
- `java -Djarmode=tools -jar app.jar extract` tách jar thành `app.jar` + thư mục `lib/`. Khởi động nhanh hơn ~13% và cho phép tách **layer Docker**: thư viện (64,2 MB) ít đổi, code ứng dụng (119 kB) đổi mỗi lần build.
- Dockerfile **multi-stage**, chạy bằng user **không phải root**, `ENTRYPOINT` dạng mảng để Java là PID 1 và nhận `SIGTERM` (graceful shutdown chạy đúng).
- Trong container, đặt bộ nhớ heap theo **tỷ lệ** (`-XX:MaxRAMPercentage=75`), không cứng `-Xmx`.
- **AOT cache** (JEP 483/514/515, JDK 24–25): chạy "huấn luyện" một lần để tạo cache class đã nạp và liên kết; lần chạy sau dùng cache. Đo được **7,9 s → 2,8 s**.

## Cơ chế: vì sao khởi động Spring Boot chậm

Khi khởi động, JVM phải đọc, kiểm tra (verify) và liên kết hàng nghìn class từ ~100 jar; Spring quét annotation, đánh giá điều kiện auto-configuration và tạo bean. Phần lớn công việc này **lặp lại y hệt** ở mỗi lần khởi động. Có ba hướng giảm:

| Hướng | Làm gì | Đánh đổi |
|---|---|---|
| Extract jar | Bỏ lớp "jar lồng jar", class loader đọc file jar thường | Gần như không có |
| AOT cache (JDK 25) | Lưu sẵn class đã nạp + liên kết, profile của method | Cần bước huấn luyện, cache gắn với đúng JDK và đúng classpath |
| Native image (GraalVM) | Biên dịch trước thành file thực thi | Build lâu, hạn chế reflection/proxy, debug khó hơn |

Bài này đi theo hai hướng đầu vì chúng không đổi cách viết code.

## Bước 1: fat jar và extract

Đo trên máy 4 CPU, ứng dụng `don-hang-api` (web, JPA, Flyway, Security, Actuator) nối PostgreSQL, lấy số `Started DonHangApplication in … seconds`:

```text
fat jar (java -jar target/don-hang-api-0.0.1-SNAPSHOT.jar):  7.918  8.010  7.871 s
```

```bash
java -Djarmode=tools -jar target/don-hang-api-0.0.1-SNAPSHOT.jar extract --destination ext
ls ext          # don-hang-api-0.0.1-SNAPSHOT.jar  lib/   (lib có 103 jar)
java -jar ext/don-hang-api-0.0.1-SNAPSHOT.jar
```

```text
jar đã extract:                                             6.914  7.219  6.206 s
```

`app.jar` sau extract chỉ chứa code của bạn và một `MANIFEST.MF` với `Class-Path: lib/…`, nên JVM nạp thư viện như classpath bình thường.

## Bước 2: Dockerfile nhiều layer, non-root

```dockerfile title="Dockerfile"
FROM eclipse-temurin:25-jre AS build
WORKDIR /build
COPY target/don-hang-api-0.0.1-SNAPSHOT.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --destination ext

FROM eclipse-temurin:25-jre
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
COPY /build/ext/app.jar app.jar                   119kB
COPY /build/ext/lib/ lib/                         64.2MB

$ docker run --network host -e SPRING_DATASOURCE_URL=… -e JWT_KHOA=… don-hang-api:1
Starting DonHangApplication … with PID 1
Started DonHangApplication in 6.242 seconds

$ docker exec <id> id
uid=10001(ungdung) gid=… 
$ curl -s localhost:8080/actuator/health
{"status":"UP"}

$ time docker stop <id>
Commencing graceful shutdown. Waiting for active requests to complete
Graceful shutdown complete
real    0m0.4s
```

Những điểm quyết định:

- **Thứ tự `COPY`**: thư viện trước, code sau. Sửa một dòng code → chỉ layer 119 kB build và push lại; registry và node đã có layer 64 MB.
- **`ENTRYPOINT` dạng mảng (exec form)**: Java là PID 1 nên nhận thẳng `SIGTERM` từ `docker stop`/Kubernetes. Dạng chuỗi (`ENTRYPOINT java -jar app.jar`) chạy qua `/bin/sh -c`, shell nhận tín hiệu và có thể không chuyển cho Java → hết thời gian chờ thì bị `SIGKILL`, mất graceful shutdown.
- **Non-root**: lỗ hổng trong ứng dụng không cho kẻ tấn công quyền root trong container. Nhiều cluster (Pod Security `restricted`) từ chối container chạy root.
- **Image JRE**, không phải JDK: không cần `javac` lúc chạy. Image 597 MB phần lớn là hệ điều hành + JRE; có thể giảm thêm bằng base image nhỏ hơn hoặc `jlink`, nhưng đó là tối ưu sau.
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

## Bước 4: AOT cache của JDK 25

Huấn luyện một lần (thường làm trong bước build image), dùng cờ `--spring.context.exit=onRefresh` để ứng dụng tạo xong context rồi thoát:

```bash
java -XX:AOTCacheOutput=app.aot -jar ext/don-hang-api-0.0.1-SNAPSHOT.jar --spring.context.exit=onRefresh
# … AOTCache creation is complete: app.aot 144928768 bytes
```

Chạy với cache:

```bash
java -XX:AOTCache=app.aot -jar ext/don-hang-api-0.0.1-SNAPSHOT.jar
```

```text
fat jar:             7.918  8.010  7.871 s
jar đã extract:      6.914  7.219  6.206 s
extract + AOT cache: 2.952  2.648  2.806 s
```

Điều kiện để cache được dùng (sai thì JVM không dùng cache — ứng dụng vẫn chạy nhưng chậm như cũ, nên hãy kiểm tra lại số `Started … in`):

- **Cùng bản JDK** lúc huấn luyện và lúc chạy → huấn luyện trong chính image chạy.
- **Cùng classpath**, các jar không đổi → đó là lý do phải extract (fat jar lồng jar không dùng được AOT cache).
- Cache khoảng 145 MB, làm image lớn hơn; đổi lại khởi động nhanh hơn ~2,8 lần.

Trong Dockerfile, thêm một bước huấn luyện ở stage cuối (sau `COPY`), trỏ tới DB thật hoặc tắt các phần cần kết nối ngoài khi huấn luyện, rồi đổi `ENTRYPOINT` thành `["java", "-XX:AOTCache=app.aot", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]`. Lưu ý: lúc huấn luyện ứng dụng khởi động thật — Flyway có thể migrate, bean có thể gọi dịch vụ ngoài; dùng profile riêng cho bước này.

Khi nào đáng làm: autoscaling cần pod mới sẵn sàng nhanh, job ngắn chạy theo lịch, môi trường serverless. Một service chạy liên tục vài tuần thì 5 giây khởi động ít quan trọng hơn kích thước image.

## So sánh phương án

| Nhu cầu | Chọn |
|---|---|
| Chạy thử, máy chủ truyền thống | Fat jar + `java -jar` |
| Docker/Kubernetes thông thường | Extract + Dockerfile nhiều layer, non-root (hoặc `build-image`) |
| Cần khởi động nhanh, vẫn JVM đầy đủ | Thêm AOT cache (JDK 25) |
| Khởi động tính bằng mili giây, bộ nhớ rất thấp | GraalVM native image (chấp nhận build lâu, giới hạn reflection) |

:::senior Góc nhìn senior
Một image tốt cho production là image mà đội vận hành không phải hỏi gì: chạy non-root, nhận `SIGTERM` đúng, cấu hình qua biến môi trường, có health check (`/actuator/health/liveness`, `/readiness`), log JSON ra stdout, bộ nhớ theo tỷ lệ. Tối ưu thời gian khởi động (AOT cache, native) chỉ làm sau khi đo được nó là vấn đề — ví dụ HPA scale-out không kịp lúc cao điểm.
:::

:::quiz Vì sao trong Dockerfile phải `COPY lib/` trước rồi mới `COPY app.jar`?
- [ ] Java yêu cầu thư viện có mặt trước
- [x] Layer thư viện (64 MB) ít thay đổi nên được Docker cache; sửa code chỉ build lại layer `app.jar` (119 kB)
- [ ] Để image nhỏ hơn
- [ ] Để chạy được bằng user non-root

Docker build lại mọi layer kể từ layer đầu tiên thay đổi. Đặt phần hay đổi ở cuối.
:::

:::quiz `docker stop` chờ 10 giây rồi container bị kill, log không có "Graceful shutdown complete". Nguyên nhân khả dĩ nhất?
- [ ] Thiếu `server.shutdown=graceful` — mặc định là immediate
- [x] `ENTRYPOINT` dạng chuỗi chạy qua shell, shell là PID 1 nên `SIGTERM` không tới Java
- [ ] Chạy bằng user non-root nên không nhận tín hiệu
- [ ] Do `MaxRAMPercentage`

Từ Boot 3.4 graceful là mặc định. Với exec form, Java là PID 1 (`with PID 1` trong log) và `docker stop` xong trong 0,4 s.
:::

:::exercise Tính bộ nhớ cho container
Pod có `limits.memory: 768Mi`. Ứng dụng có ~200 thread (Tomcat + pool), metaspace đo được ~120 MB. Chọn `MaxRAMPercentage` và giải thích. Nếu pod vẫn bị `OOMKilled` trong khi log không có `OutOfMemoryError`, bạn kiểm tra gì?
???
Phần ngoài heap ước tính: metaspace ~120 MB, stack 200 thread (mỗi thread tối đa 1 MB nhưng thường dùng vài trăm kB, ước ~100 MB), code cache ~50 MB, GC và buffer vài chục MB → khoảng 300 MB. Còn lại ~470 MB cho heap, tức khoảng **60%** (`-XX:MaxRAMPercentage=60`, heap tối đa ~460 MiB). 75% (576 MiB heap) để lại chỉ ~190 MiB — dễ vượt giới hạn.

`OOMKilled` không kèm `OutOfMemoryError` nghĩa là **container** vượt giới hạn, không phải heap đầy. Kiểm tra: `jcmd <pid> VM.native_memory summary` (chạy với `-XX:NativeMemoryTracking=summary`) để xem phần nào ngoài heap tăng; số thread (`jvm.threads.live` trên actuator); direct buffer (`jvm.buffer.memory.used`). Cách sửa: giảm tỷ lệ heap, giới hạn pool thread, hoặc tăng `limits.memory`.
:::
