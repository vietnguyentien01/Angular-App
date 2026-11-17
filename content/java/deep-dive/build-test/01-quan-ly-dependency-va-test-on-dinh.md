---
title: "Quản lý dependency và test ổn định — nearest wins, BOM, enforcer, vòng đời instance và test chập chờn"
summary: "Tái hiện việc Maven âm thầm hạ version một thư viện vì quy tắc nearest wins, sửa bằng dependencyManagement và chặn bằng enforcer (có bẫy mặc định bỏ qua scope test); rồi quan sát vòng đời instance của JUnit và tạo một test chập chờn do state static. Chạy trên Maven 3.9.11, JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [java, maven, dependency, junit, flaky-test, ci]
related: [java/consolidate/build-test/viet-test-voi-junit, java/review/build-test/maven-va-junit-co-ban]
---

## Tóm tắt nhanh

- Hai đường dẫn kéo về hai version của cùng thư viện → Maven chọn version **gần gốc nhất** (*nearest wins*), **không** phải version mới nhất, và không báo lỗi.
- Kiểm soát version bằng **`dependencyManagement`** và **BOM** (Spring Boot, JUnit, Jackson…). Chặn xung đột trong CI bằng **maven-enforcer** `dependencyConvergence`.
- JUnit tạo **instance mới cho mỗi test**: field được làm mới, `static` thì không. State `static` dùng chung là nguyên nhân hàng đầu của test phụ thuộc thứ tự.
- Test chập chờn (flaky) gần như luôn do **thời gian thật, ngẫu nhiên không seed, state dùng chung, thứ tự, hoặc mạng**. Loại bỏ nguyên nhân, đừng thêm `retry`.

## Cơ chế: Maven chọn version thế nào

Maven dựng cây dependency rồi với mỗi `groupId:artifactId` chỉ giữ **một** version: cái nằm ở độ sâu nhỏ nhất. Cùng độ sâu thì cái khai báo trước thắng.

Tái hiện: `assertj-core 3.27.7` cần `byte-buddy 1.18.3`. Thêm trực tiếp `byte-buddy 1.14.0` (vd do một thư viện khác cần, hoặc ai đó copy từ dự án cũ):

```text
$ mvn dependency:tree -Dverbose
+- org.assertj:assertj-core:jar:3.27.7:test
|  \- (net.bytebuddy:byte-buddy:jar:1.18.3:test - omitted for conflict with 1.14.0)
\- net.bytebuddy:byte-buddy:jar:1.14.0:test
```

AssertJ giờ chạy với byte-buddy cũ hơn version nó được build. Lỗi (nếu có) chỉ lộ ra lúc chạy: `NoSuchMethodError`, `ClassNotFoundException`, hay tệ hơn là hành vi sai. Ở dự án lớn, đây là nguồn gốc của rất nhiều sự cố kiểu "chạy trên máy em được".

### Sửa: dependencyManagement

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.junit</groupId>
      <artifactId>junit-bom</artifactId>
      <version>6.1.3</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
    <dependency>                                    <!-- một nơi quyết định version cho cả dự án -->
      <groupId>net.bytebuddy</groupId>
      <artifactId>byte-buddy</artifactId>
      <version>1.18.3</version>
    </dependency>
  </dependencies>
</dependencyManagement>
```

`dependencyManagement` không thêm dependency, nó chỉ **ép version** mỗi khi thư viện đó xuất hiện ở bất kỳ đâu trong cây. BOM (`<scope>import</scope>`) là một `dependencyManagement` đóng gói sẵn. Spring Boot parent/BOM quản lý version cho hàng trăm thư viện — khi dùng Spring Boot, hạn chế ghi đè version.

### Chặn trong CI: enforcer

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-enforcer-plugin</artifactId>
  <version>3.7.0</version>
  <executions>
    <execution>
      <id>kiem-tra-dependency</id>
      <goals><goal>enforce</goal></goals>
      <configuration>
        <rules>
          <dependencyConvergence><excludedScopes/></dependencyConvergence>
          <requireMavenVersion><version>3.9</version></requireMavenVersion>
        </rules>
      </configuration>
    </execution>
  </executions>
</plugin>
```

Đã chạy với xung đột ở trên:

```text
[ERROR] Dependency convergence error for net.bytebuddy:byte-buddy:jar:1.18.3. Paths to dependency are:
[ERROR] +-vn.hoc:so-chi-tieu:jar:1.0.0-SNAPSHOT
[ERROR]   +-org.assertj:assertj-core:jar:3.27.7:test
[ERROR]     +-net.bytebuddy:byte-buddy:jar:1.18.3:test
[ERROR] and
[ERROR] +-vn.hoc:so-chi-tieu:jar:1.0.0-SNAPSHOT
[ERROR]   +-net.bytebuddy:byte-buddy:jar:1.14.0:test
[INFO] BUILD FAILURE
```

Bẫy: với `<dependencyConvergence/>` (không cấu hình), enforcer 3.7.0 **báo passed** cho đúng xung đột này, vì mặc định nó bỏ qua scope `test` (và `provided`). Phải ghi `<excludedScopes/>` rỗng như trên. Sau khi thêm `dependencyManagement`, `mvn verify` chạy rule *passed* và 32 test xanh.

## Vòng đời instance trong JUnit

In ra trong `@BeforeEach` một bộ đếm `static` và một bộ đếm field (cả hai tăng 1 mỗi lần), 8 test trong một class:

```text
[BeforeAll]
[BeforeEach] gioiHanThoiGian() static=1 field=1
[BeforeEach] chiaDeu("100000", 3) → phần đầu "33334" static=2 field=1
[BeforeEach] chiaDeu("10", 4) → phần đầu "3" static=3 field=1
[BeforeEach] a() static=4 field=1
[BeforeEach] b() static=5 field=1
[BeforeEach] nhieuAssertCung() static=6 field=1
[BeforeEach] ghiFileTam(Path) static=7 field=1
[BeforeEach] motNguoiNhanCaHoaDon() static=8 field=1     ← test trong @Nested cũng chạy @BeforeEach của class ngoài
```

- `field` luôn là 1: mỗi test một instance mới (`@TestInstance(Lifecycle.PER_METHOD)`, mặc định).
- Thứ tự **không** theo thứ tự khai báo (`a`, `b` được khai báo đầu tiên). Thuật toán mặc định cố định nhưng không hiển nhiên — đừng phụ thuộc vào nó.
- `@TempDir` cấp một thư mục tạm riêng (tên bắt đầu bằng `junit`) và xoá sau test.

## Một test chập chờn

```java bad
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ThuTuTest {
    static final List<String> GIO_HANG = new ArrayList<>();      // dùng chung giữa các test

    @Test @Order(1) void themSanPham() { GIO_HANG.add("Nồi chiên"); assertThat(GIO_HANG).hasSize(1); }
    @Test @Order(2) void gioHangMoiPhaiRong() { assertThat(GIO_HANG).isEmpty(); }
}
// Order(1) cho themSanPham: Failures: 1 — Expecting empty but was: ["Nồi chiên"]
// đổi lại Order:            Failures: 0
```

Trong dự án thật không ai đặt `@Order` — thứ tự thay đổi khi thêm test, đổi tên method, chạy song song, hay chạy riêng một test trong IDE. Kết quả là test "lúc xanh lúc đỏ". Sửa: state thuộc về instance (field), hoặc dọn trong `@BeforeEach`.

Các nguồn chập chờn khác và cách loại bỏ:

| Nguyên nhân | Dấu hiệu | Cách sửa |
|---|---|---|
| Giờ thật (`LocalDate.now()`) | Fail vào cuối tháng, nửa đêm, khi CI chạy ở UTC | Tiêm `Clock` |
| Ngẫu nhiên | Fail không lặp lại được | `new Random(seed)`, in seed khi fail |
| `Thread.sleep` chờ việc bất đồng bộ | Fail khi máy CI chậm | Chờ theo điều kiện (Awaitility), hoặc thiết kế cho test đồng bộ được |
| State dùng chung (static, DB, file) | Fail khi đổi thứ tự / chạy song song | Dữ liệu riêng mỗi test, transaction rollback, `@TempDir` |
| Mạng, dịch vụ ngoài | Fail khi mạng chậm | Fake/WireMock; test tích hợp thật tách thành job riêng |
| `HashMap`/`HashSet` thứ tự lặp | Fail sau khi nâng JDK | So sánh không theo thứ tự (`containsExactlyInAnyOrder`) |

## So sánh phương án

| Việc | Cách |
|---|---|
| Một version cho cả dự án nhiều module | `dependencyManagement` ở parent POM |
| Đồng bộ version một họ thư viện | Import BOM |
| Phát hiện xung đột | `mvn dependency:tree -Dverbose`, enforcer `dependencyConvergence` |
| Build lặp lại được | Ghi rõ version plugin, `requireMavenVersion`, Maven Wrapper (`mvnw`) |
| Test nhanh trong CI | Unit test chạy ở `test`, test tích hợp (Failsafe, `*IT`) ở `verify` |
| Chạy test song song | `junit.jupiter.execution.parallel.enabled=true` trong `junit-platform.properties`, **sau khi** đã loại bỏ state dùng chung |

## Tính năng mới theo phiên bản

- **JUnit 5.0** (2017): Jupiter API, `@ParameterizedTest`, `@Nested`. **JUnit 5.4**: `@TempDir`, `@Order`.
- **JUnit 6.0** (2025): yêu cầu Java 17, đồng bộ version giữa Platform/Jupiter/Vintage, tên hiển thị của test tham số đặt chuỗi trong ngoặc kép.
- **Maven 4** đang ở giai đoạn release candidate. Trên Maven Central, `maven-compiler-plugin` bản mới nhất là `4.0.0-beta-5` (dành cho Maven 4) — với Maven 3.9 hãy dùng dòng 3.x (bài này dùng 3.16.0).

:::senior Góc nhìn senior
Trong dự án nhiều module ở ngân hàng/bảo hiểm, một **parent POM** của công ty (hoặc của dự án) với `dependencyManagement`, `pluginManagement`, enforcer và Maven Wrapper đáng giá hơn mọi tài liệu hướng dẫn: nó biến quy ước thành thứ CI kiểm tra được. Với test chập chờn, quy tắc của team nên là: test flaky được xem như bug mức cao — sửa hoặc xoá, không `@Disabled` vô thời hạn và không cấu hình chạy lại cho tới khi xanh.
:::

:::quiz `A → B → X:2.0` và dự án khai báo trực tiếp `X:1.0`. Maven dùng version nào của X?
- [ ] 2.0 — luôn chọn version mới nhất
- [x] 1.0 — khai báo trực tiếp gần gốc hơn
- [ ] Báo lỗi xung đột
- [ ] Cả hai

Quy tắc *nearest wins*. Đã tái hiện với byte-buddy: `omitted for conflict with 1.14.0`.
:::

:::quiz Một class test có field `int dem = 0` và `@BeforeEach void setUp() { dem++; }`. Trong test thứ ba được chạy, `dem` bằng bao nhiêu?
- [x] 1
- [ ] 3
- [ ] 0
- [ ] Tuỳ thứ tự

Mặc định mỗi test chạy trên một instance mới. Đã đo: field luôn là 1, field `static` thì tăng dần 1…8.
:::

:::exercise Đặt hàng rào cho dự án
Dự án của bạn có 5 module, mỗi module tự ghi version Jackson và JUnit, và hay gặp `NoSuchMethodError` sau khi ai đó thêm thư viện. Đề xuất các thay đổi trong parent POM để: (1) mọi module dùng cùng version Jackson, JUnit; (2) CI fail ngay khi có xung đột version, kể cả thư viện test; (3) mọi người build bằng cùng phiên bản Maven.
???
1. Trong parent POM, `dependencyManagement` import `com.fasterxml.jackson:jackson-bom` và `org.junit:junit-bom` (`<type>pom</type><scope>import</scope>`); xoá `<version>` của các dependency đó trong module con.
2. `pluginManagement` ghi version cho compiler, surefire, enforcer; thêm execution enforcer với `<dependencyConvergence><excludedScopes/></dependencyConvergence>` (rỗng để kiểm tra cả scope `test`) và `<requireMavenVersion>`. Lỗi xung đột sẽ có dạng *Dependency convergence error for … Paths to dependency are: …* như trong bài.
3. Thêm Maven Wrapper (`mvn wrapper:wrapper`), commit `mvnw`, `.mvn/wrapper/maven-wrapper.properties`; CI và mọi người chạy `./mvnw verify`.

Khi enforcer báo xung đột, chọn version trong `dependencyManagement` (thường là version mới hơn mà các thư viện đều tương thích), không dùng `<exclusions>` tràn lan.
:::
