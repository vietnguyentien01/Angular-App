---
title: "Maven và JUnit cơ bản — cấu trúc dự án, pom.xml, scope, vòng đời build, test đầu tiên"
summary: "Nhắc nhanh cấu trúc thư mục Maven, pom.xml tối thiểu cho Java 25 với JUnit 6 và AssertJ, dependency scope, các lệnh mvn hay dùng, viết và đọc kết quả test. Dự án mẫu đã chạy với Maven 3.9 trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-16
tags: [java, maven, junit, testing, build]
related: [java/consolidate/build-test/viet-test-voi-junit, java/deep-dive/build-test/quan-ly-dependency-va-test-on-dinh]
---

## Tóm tắt nhanh

- Maven dùng **quy ước thay cho cấu hình**: code ở `src/main/java`, test ở `src/test/java`, kết quả ở `target/`.
- Một dependency = `groupId:artifactId:version` + **scope**. Thư viện test luôn để `<scope>test</scope>`.
- Lệnh hay dùng: `mvn test`, `mvn package`, `mvn verify`, `mvn dependency:tree`. Các phase chạy **nối tiếp**: `package` chạy cả `compile` và `test`.
- JUnit (Jupiter API): đánh dấu method bằng `@Test`, kiểm tra bằng `assertEquals` hoặc AssertJ `assertThat(...)`.
- Surefire chỉ chạy class có tên **`*Test`, `*Tests`, `Test*`, `*TestCase`**.

## Cấu trúc dự án

```text
so-chi-tieu/
├── pom.xml
├── src/main/java/vn/hoc/chitieu/ChiaHoaDon.java
├── src/test/java/vn/hoc/chitieu/ChiaHoaDonTest.java   ← cùng package với class được test
└── target/                                            ← sinh ra khi build, không commit
```

## pom.xml tối thiểu (đã chạy)

```xml title="pom.xml"
<project xmlns="http://maven.apache.org/POM/4.0.0" …>
  <modelVersion>4.0.0</modelVersion>
  <groupId>vn.hoc</groupId>
  <artifactId>so-chi-tieu</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <properties>
    <maven.compiler.release>25</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>

  <dependencyManagement>
    <dependencies>
      <dependency>                                  <!-- BOM: cố định version cho mọi module JUnit -->
        <groupId>org.junit</groupId>
        <artifactId>junit-bom</artifactId>
        <version>6.1.3</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>       <!-- không ghi version: lấy từ BOM -->
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.assertj</groupId>
      <artifactId>assertj-core</artifactId>
      <version>3.27.7</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.16.0</version>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.6.1</version>
      </plugin>
    </plugins>
  </build>
</project>
```

Luôn ghi rõ version của plugin. Không ghi thì Maven dùng version mặc định gắn với bản Maven đang cài — mỗi máy build một kiểu.

## Test đầu tiên

```java title="ChiaHoaDonTest.java"
class ChiaHoaDonTest {
    @Test
    @DisplayName("100.000 cho 3 người: người đầu nhận phần dư")
    void chiaCoDu() {
        List<BigDecimal> kq = ChiaHoaDon.chiaDeu(new BigDecimal("100000"), 3);
        assertThat(kq).containsExactly(new BigDecimal("33334"), new BigDecimal("33333"), new BigDecimal("33333"));
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1})
    void tuChoiSoNguoiKhongHopLe(int soNguoi) {
        assertThatThrownBy(() -> ChiaHoaDon.chiaDeu(BigDecimal.TEN, soNguoi))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("soNguoi");
    }
}
```

```text
$ mvn test
[INFO] Running vn.hoc.chitieu.ChiaHoaDonTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.191 s
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

Khi test sai, AssertJ chỉ rõ chỗ khác:

```text
Expecting actual:
  - element at index 0: expected "3" but was "4"
  - element at index 2: expected "4" but was "3"
```

## Bảng chọn nhanh

| Scope | Có lúc compile | Có lúc test | Có trong ứng dụng chạy thật | Ví dụ |
|---|---|---|---|---|
| `compile` (mặc định) | ✓ | ✓ | ✓ | thư viện nghiệp vụ, Jackson |
| `provided` | ✓ | ✓ | ✗ — môi trường chạy cung cấp | Servlet API, Lombok |
| `runtime` | ✗ | ✓ | ✓ | driver JDBC |
| `test` | ✗ (code chính) | ✓ | ✗ | JUnit, AssertJ, Mockito |

| Lệnh | Làm gì |
|---|---|
| `mvn test` | compile + chạy test |
| `mvn test -Dtest=ChiaHoaDonTest#chiaCoDu` | chạy một test |
| `mvn package` | … + đóng gói `target/so-chi-tieu-1.0.0-SNAPSHOT.jar` |
| `mvn verify` | … + kiểm tra tích hợp (dùng trong CI) |
| `mvn install` | … + cài vào `~/.m2` để module khác dùng |
| `mvn dependency:tree` | xem cây dependency |
| `mvn -DskipTests package` | đóng gói, bỏ qua chạy test (đừng dùng trong CI) |

## Lỗi hay gặp: class test không chạy

```java bad
class KiemTraLamTron {                     // tên không khớp mẫu của Surefire
    @Test void luonFail() { fail("test này lẽ ra phải chạy"); }
}
// mvn test vẫn BUILD SUCCESS — test fail không bao giờ được chạy
```

```java good
class LamTronTest { … }                    // hoặc cấu hình <includes> trong surefire
```

Đã thử: class `KiemTraLamTron` chứa `fail(...)` mà `mvn test` vẫn xanh. Sau khi thêm test mới, xem số `Tests run` có tăng không.

:::version Java 17 / 21 / 25
- **JUnit 6** (2025) yêu cầu Java **17+** (đã kiểm tra: class trong `junit-jupiter-api-6.1.3.jar` có major version 61 = Java 17). Dự án Java 8/11 dùng JUnit 5.x.
- API Jupiter (`@Test`, `@ParameterizedTest`, `assertThrows`…) giống JUnit 5, nên phần lớn test chỉ cần đổi version trong BOM. JUnit 4 (`org.junit.Test`) là API khác hẳn.
- `maven.compiler.release` đặt cả mức ngôn ngữ lẫn API của JDK; dùng nó thay cho cặp `source`/`target`.
:::

:::interview `mvn package` và `mvn install` khác nhau thế nào?
Cả hai đều chạy vòng đời build tới phase của mình: `package` dừng sau khi tạo file jar/war trong `target/`; `install` chạy thêm `verify` và `install`, chép artifact vào repository cục bộ `~/.m2/repository` để các dự án khác trên cùng máy khai báo dependency tới nó. `deploy` đẩy lên repository dùng chung (Nexus, Artifactory). Trong CI thường chạy `mvn verify`; `install` chỉ cần khi build nhiều dự án phụ thuộc nhau mà không dùng multi-module.
:::

:::quiz Driver JDBC PostgreSQL nên khai báo scope nào?
- [ ] `compile`
- [ ] `provided`
- [x] `runtime`
- [ ] `test`

Code chỉ dùng `java.sql` (hoặc JPA), không gọi trực tiếp class của driver; driver chỉ cần lúc chạy. Dùng `compile` cũng chạy được, nhưng `runtime` ngăn code vô tình phụ thuộc vào class riêng của driver.
:::

:::quiz Class `KiemTraLamTron` có một `@Test` luôn fail. `mvn test` cho kết quả gì?
- [ ] BUILD FAILURE
- [x] BUILD SUCCESS — Surefire không chạy class này vì tên không khớp mẫu mặc định
- [ ] Cảnh báo "test bị bỏ qua"
- [ ] Lỗi biên dịch

Mặc định Surefire chỉ tìm `**/Test*.java`, `**/*Test.java`, `**/*Tests.java`, `**/*TestCase.java`. Đã chạy thử.
:::

:::quiz Phase nào **không** được chạy khi gõ `mvn package`?
- [ ] compile
- [ ] test
- [x] install
- [ ] process-resources

Vòng đời mặc định chạy mọi phase **tới** phase được gọi: `validate → compile → test → package → verify → install → deploy`.
:::
