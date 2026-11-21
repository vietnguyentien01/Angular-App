---
title: "Module (JPMS) cơ bản — module-info.java, requires, exports, opens, module path và classpath"
summary: "Nhắc nhanh Java Platform Module System: module-info.java với requires, requires transitive, exports, opens; biên dịch và chạy bằng --module-path; package không export thì biên dịch lỗi, không opens thì reflection lỗi; classpath (unnamed module) so với module path. Mọi output đã chạy trên JDK 21."
type: card
level: core
version: 21
lastReviewed: 2026-11-21
tags: [java, jpms, module, module-info]
related: [java/consolidate/modules/loi-thuong-gap-khi-dung-module, java/deep-dive/modules/ben-trong-jpms-jlink-va-runtime-nho-gon]
---

## Tóm tắt nhanh

- **Module** (Java 9, JPMS — Java Platform Module System) là một nhóm package có tên, khai báo trong `module-info.java`: cần module nào (`requires`), cho bên ngoài dùng package nào (`exports`), cho bên ngoài reflection vào package nào (`opens`).
- `public` không còn nghĩa là "ai cũng dùng được": class `public` trong package **không export** thì module khác **không biên dịch được** khi dùng nó.
- `exports` chỉ mở cho **truy cập bình thường**. Framework cần reflection vào field `private` (Jackson, Hibernate, Spring) thì package phải được **`opens`**.
- JDK tự nó đã chia thành ~70 module (`java.base`, `java.sql`, `java.net.http`…). `java --list-modules` trên JDK 21 liệt kê 69 module.
- Phần lớn ứng dụng Spring Boot vẫn chạy trên **classpath** — mọi class nằm trong một *unnamed module* đọc được mọi thứ. Hiểu JPMS vẫn cần thiết vì JDK dùng nó để **chặn truy cập vào phần nội bộ** của JDK.

## Ví dụ nhanh (đã chạy trên JDK 21)

```text
src/
  vn.hoc.phi/
    module-info.java
    vn/hoc/phi/api/TinhPhi.java        ← được export
    vn/hoc/phi/noibo/BangPhi.java      ← không export
  vn.hoc.app/
    module-info.java
    vn/hoc/app/Main.java
```

```java title="src/vn.hoc.phi/module-info.java"
module vn.hoc.phi {
    exports vn.hoc.phi.api;          // chỉ package này được dùng từ bên ngoài
    requires transitive java.sql;    // ai requires vn.hoc.phi cũng tự đọc được java.sql
}
```

```java title="src/vn.hoc.app/module-info.java"
module vn.hoc.app {
    requires vn.hoc.phi;
}
```

```bash
javac -d out --module-source-path src -m vn.hoc.app,vn.hoc.phi
java --module-path out -m vn.hoc.app/vn.hoc.app.Main
# phí 20.000.000: 4000, áp dụng từ 2026-01-01
# module: vn.hoc.app, đọc java.sql? true
```

```java title="Dùng package không export → lỗi biên dịch"
import vn.hoc.phi.noibo.BangPhi;
// error: package vn.hoc.phi.noibo is not visible
//   (package vn.hoc.phi.noibo is declared in module vn.hoc.phi, which does not export it)
```

```java title="Reflection vào package không opens → lỗi lúc chạy"
var f = Class.forName("vn.hoc.phi.noibo.BangPhi").getDeclaredField("TY_LE");
f.setAccessible(true);
// InaccessibleObjectException: Unable to make field private static final java.math.BigDecimal
//   vn.hoc.phi.noibo.BangPhi.TY_LE accessible: module vn.hoc.phi does not "opens vn.hoc.phi.noibo" to module vn.hoc.app
```

```bash title="Cùng code, chạy trên classpath"
java -cp out/vn.hoc.app:out/vn.hoc.phi vn.hoc.app.Main
# module: null           ← unnamed module, module-info.java bị bỏ qua
# đọc TY_LE: 0.0002      ← không còn ranh giới nào giữa code của bạn
```

## Bảng chọn nhanh

| Từ khoá trong `module-info.java` | Nghĩa |
|---|---|
| `requires X;` | Module này dùng module X (lúc biên dịch và lúc chạy) |
| `requires transitive X;` | Như trên, và ai `requires` module này cũng tự đọc được X (vì API của mình lộ kiểu của X) |
| `requires static X;` | Chỉ cần lúc biên dịch, lúc chạy có thể không có (vd annotation của Lombok, JSR 305) |
| `exports p;` | Code ở module khác dùng được class `public` trong package `p` |
| `exports p to M;` | Chỉ module `M` dùng được (*qualified export*) |
| `opens p;` | Cho phép reflection sâu (kể cả `private`) vào `p` lúc chạy |
| `open module X { … }` | Mở mọi package cho reflection (hay dùng cho module ứng dụng với Spring/Hibernate) |
| `uses S;` / `provides S with Impl;` | Dùng / cung cấp dịch vụ qua `ServiceLoader` |

| | Classpath (`-cp`) | Module path (`-p`) |
|---|---|---|
| `module-info.java` | Bị bỏ qua | Có hiệu lực |
| Ranh giới giữa các jar | Không có | `exports`/`opens` được kiểm tra |
| Thiếu một dependency | Lỗi lúc chạy (`NoClassDefFoundError`) khi lần đầu dùng | Lỗi **ngay lúc khởi động** |
| Hai jar cùng package | Class nào nạp trước thì thắng | Lỗi (split package) |
| Phổ biến | Hầu hết ứng dụng Spring Boot, server ứng dụng | Thư viện, ứng dụng desktop, runtime tạo bằng jlink |

## Lỗi hay gặp: `requires` mà không `transitive`

```java bad
module vn.hoc.phi2 { exports vn.hoc.phi2; requires java.sql; }   // API trả về java.sql.Date
module vn.hoc.app2 { requires vn.hoc.phi2; }
// trong app2: java.sql.Date d = vn.hoc.phi2.P.ngay();
// error: package java.sql is not visible
//   (package java.sql is declared in module java.sql, but module vn.hoc.app2 does not read it)
```

```java good
module vn.hoc.phi2 { exports vn.hoc.phi2; requires transitive java.sql; }
```

Đã biên dịch thử trên JDK 21. Quy tắc: kiểu của module X xuất hiện trong **API public** của bạn (tham số, kiểu trả về, lớp cha) thì `requires transitive X`. Chỉ dùng bên trong cài đặt thì `requires X`.

:::version 21 Java 8 / 9 / 17 / 21
- JPMS: **Java 9** (JEP 261, Project Jigsaw). Java 8 không có module; mọi thứ là classpath.
- Java 9–15: truy cập reflection vào nội bộ JDK chỉ bị **cảnh báo** (`--illegal-access=permit`). Java 16 (JEP 396) chặn mặc định; **Java 17** (JEP 403) bỏ hẳn tuỳ chọn `--illegal-access` — chỉ còn `--add-opens`.
- Java 21: không đổi gì ở JPMS. JDK có 69 module (đã đếm bằng `java --list-modules`).
:::

:::interview `exports` và `opens` khác nhau thế nào?
`exports p` cho phép module khác dùng các class và thành viên `public`/`protected` của package `p` một cách bình thường, kiểm tra lúc **biên dịch** và lúc chạy. `opens p` cho phép **reflection sâu** vào `p` lúc chạy — gọi `setAccessible(true)` trên field/method `private` — nhưng không cho biên dịch code dùng trực tiếp package đó. Framework như Jackson, Hibernate, Spring cần `opens` với package chứa entity/DTO/bean để đọc ghi field private; code của bạn gọi API cần `exports`. Một package có thể vừa `exports` vừa `opens`, hoặc dùng `open module` để mở toàn bộ cho reflection.
:::

:::quiz Module `vn.hoc.phi` chỉ `exports vn.hoc.phi.api`. Module `vn.hoc.app` (có `requires vn.hoc.phi`) import một class `public` trong `vn.hoc.phi.noibo`. Kết quả?
- [ ] Biên dịch được vì class là `public`
- [x] Lỗi biên dịch: package vn.hoc.phi.noibo is not visible
- [ ] Biên dịch được, lỗi lúc chạy
- [ ] Chỉ cảnh báo

Với module, `public` chỉ có nghĩa "public trong những package được export". Đã biên dịch thử trên JDK 21. Chạy trên classpath thì ranh giới này biến mất.
:::

:::quiz Spring/Hibernate báo `InaccessibleObjectException … does not "opens vn.hoc.domain"` khi ứng dụng chạy trên module path. Sửa thế nào? (chọn nhiều)
- [ ] Thêm `exports vn.hoc.domain;`
- [x] Thêm `opens vn.hoc.domain;` (hoặc `opens vn.hoc.domain to org.hibernate.orm.core;`)
- [x] Khai báo `open module …` cho module ứng dụng
- [ ] Đổi mọi field thành `public`

Reflection sâu cần `opens`, `exports` không đủ. `opens … to <module>` giới hạn đúng framework cần. Đổi field thành `public` phá đóng gói và vẫn không giúp nếu framework gọi `setAccessible` trên package không mở.
:::
