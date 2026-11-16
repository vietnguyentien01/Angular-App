---
title: "Coupling, cohesion và ranh giới module — để compiler giữ kiến trúc thay cho code review"
summary: "Coupling và cohesion đo thế nào trong thực tế, hướng phụ thuộc đúng, và ba mức ép ranh giới trong Java: package-private, JPMS module-info (compiler từ chối import package không export, từ chối vòng phụ thuộc) và jdeps để xem phụ thuộc thật. Đã chạy trên JDK 25."
level: advanced
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, coupling, cohesion, jpms, modularity, architecture]
related: [design-patterns/review/principles/solid-va-composition, design-patterns/consolidate/architecture/hexagonal-port-adapter-thuc-chien]
---

## TL;DR

- **Coupling** (kết dính giữa các phần): sửa A thì phải sửa B bao nhiêu. **Cohesion** (gắn kết bên trong): các thứ trong một module có cùng lý do thay đổi không. Mục tiêu: coupling thấp, cohesion cao.
- Phần lớn pattern (Strategy, Adapter, Facade, Observer, Hexagonal) là cách **giảm coupling** ở một điểm cụ thể.
- Ranh giới kiến trúc chỉ giữ được lâu khi **công cụ ép** nó, không chỉ dựa vào code review: `package-private`, **JPMS** (`module-info.java` với `exports`), hoặc test kiến trúc.
- JPMS: compiler báo *package … is not visible* khi import package không được export, và *cyclic dependence* khi hai module phụ thuộc vòng.
- `jdeps` cho biết phụ thuộc **thật** giữa các package/module trong bytecode.

## Cơ chế: các loại coupling

| Loại (từ chặt tới lỏng) | Ví dụ | Hệ quả |
|---|---|---|
| Nội dung | Class A đọc/ghi field của B qua reflection hoặc biết thứ tự gọi nội bộ của B | B đổi chi tiết là A hỏng |
| Dữ liệu dùng chung | Hai service cùng ghi một bảng DB | Đổi schema phải phối hợp mọi bên |
| Kiểu cụ thể | `OrderService` nhận `JdbcOrderRepository` | Không thay được khi test |
| Interface | `OrderService` nhận `OrderRepository` | Đổi cài đặt tự do |
| Thông điệp/sự kiện | `OrderService` phát `DonHangDaTao`, bên khác tự nghe | Bên phát không biết bên nghe (nhưng khó lần theo luồng) |

Coupling **không phải** càng lỏng càng tốt: sự kiện lỏng nhất nhưng làm luồng xử lý khó đọc, khó debug. Chọn mức lỏng vừa đủ cho chỗ **hay thay đổi**.

**Hướng phụ thuộc**: phụ thuộc nên chỉ về phía thứ **ổn định hơn**. Quy tắc nghiệp vụ (tính phí, trạng thái đơn hàng) ổn định hơn chi tiết kỹ thuật (Postgres, Kafka, REST của đối tác) — nên nghiệp vụ không import chi tiết kỹ thuật. Đó là Dependency Inversion, và là nền của kiến trúc Hexagonal.

## Mức 1: package-private

Bỏ `public` là cách rẻ nhất để giấu chi tiết:

```java title="a/TinhGia.java"
package a;
class TinhGia { long tinh(int n, long g) { return n * g; } }   // không public
```

```text
b/Main.java:2: error: TinhGia is not public in a; cannot be accessed from outside package
public class Main { public static void main(String[] x) { new a.TinhGia(); } }
                                                               ^
```

Giới hạn: chỉ có hai mức (cùng package hoặc public cho tất cả). Khi module có nhiều package con cần gọi nhau, bạn buộc phải `public`, và lúc đó mọi người dùng được.

## Mức 2: JPMS module

```text
src/
  donhang/
    module-info.java                    module donhang { exports vn.hoc.donhang.api; }
    vn/hoc/donhang/api/DatHang.java     public — API của module
    vn/hoc/donhang/noibo/TinhGia.java   public, nhưng package không export
  ungdung/
    module-info.java                    module ungdung { requires donhang; }
    vn/hoc/ungdung/Main.java
```

```bash
javac -d out --module-source-path src -m donhang,ungdung
java -p out -m ungdung/vn.hoc.ungdung.Main
# tổng: 1080000
```

`TinhGia` là `public` để `DatHang` (package khác cùng module) dùng được, nhưng module khác import nó thì:

```text
src/ungdung/vn/hoc/ungdung/Main.java:4: error: package vn.hoc.donhang.noibo is not visible
import vn.hoc.donhang.noibo.TinhGia;
                     ^
  (package vn.hoc.donhang.noibo is declared in module donhang, which does not export it)
1 error
```

Thêm `requires ungdung;` vào `donhang` để tạo vòng:

```text
src/ungdung/module-info.java:2: error: cyclic dependence involving donhang
    requires donhang;
             ^
src/donhang/module-info.java:2: error: cyclic dependence involving ungdung
    requires ungdung;
             ^
2 errors
```

Vòng phụ thuộc giữa module là dấu hiệu hai phần thực ra là một, hoặc thiếu một interface để đảo chiều. Classpath bình thường không bao giờ báo lỗi này.

## Mức 3: xem phụ thuộc thật bằng jdeps

```text
$ jdeps --module-path out -verbose:package -m donhang
donhang -> java.base
   vn.hoc.donhang.api      -> java.lang               java.base
   vn.hoc.donhang.api      -> vn.hoc.donhang.noibo    donhang
   vn.hoc.donhang.noibo    -> java.lang               java.base

$ jdeps --module-path out -verbose:package -m ungdung
ungdung -> donhang
   vn.hoc.ungdung          -> vn.hoc.donhang.api      donhang
```

Chạy `jdeps` trên jar của dự án (`jdeps -verbose:package --multi-release 25 app.jar`) để tìm package nghiệp vụ đang import `org.springframework.jdbc` hay `java.net.http` — vi phạm hướng phụ thuộc lộ ra ngay.

## So sánh phương án ép ranh giới

| Cách | Ép bằng | Ưu | Nhược |
|---|---|---|---|
| Quy ước + review | Con người | Không tốn gì | Mòn dần sau vài năm và vài lượt người |
| package-private | Compiler | Rẻ, có sẵn | Chỉ một package |
| Maven multi-module | Build (thiếu dependency là không biên dịch) | Rõ ràng, phổ biến | Nhiều `pom.xml`, chỉ chặn ở mức module |
| JPMS `module-info` | Compiler + JVM | Chặn được package trong module, chặn vòng | Thư viện cũ, reflection của framework cần `opens` |
| Test kiến trúc (ArchUnit, Spring Modulith) | Test | Quy tắc linh hoạt (tầng, tên, vòng package) | Chỉ chạy khi test chạy |

Trong dự án Spring Boot, cách hay dùng là **Maven multi-module** cho ranh giới lớn (domain, adapter) kết hợp **test kiến trúc** cho quy tắc chi tiết; JPMS ít gặp trong ứng dụng vì framework dùng reflection nhiều.

## Tính năng mới theo phiên bản

- **Java 9**: JPMS (`module-info.java`), `jdeps` hỗ trợ module, `jlink` tạo runtime nhỏ chỉ gồm module cần dùng.
- **Java 16–17**: đóng gói mạnh nội bộ JDK (JEP 396, 403) — reflection vào `sun.*` bị chặn mặc định. Đây chính là ranh giới module áp dụng cho JDK.
- **Java 25**: *module import declarations* (JEP 511) — `import module java.base;` để import mọi package mà một module export; tiện cho script và ví dụ, không thay đổi quy tắc export.

:::senior Góc nhìn senior
Đo coupling bằng câu hỏi thực tế: "Thêm một loại giao dịch mới phải sửa bao nhiêu file, bao nhiêu module, bao nhiêu đội?" và "Test được quy tắc tính phí mà không cần DB không?". Khi hai module luôn thay đổi cùng nhau trong mọi pull request, ranh giới đang đặt sai chỗ — gộp chúng lại tốt hơn cố giữ một interface không ai cần.
:::

:::quiz Module `donhang` export `vn.hoc.donhang.api`, còn class `TinhGia` nằm trong `vn.hoc.donhang.noibo` và là `public`. Module `ungdung` (`requires donhang`) import `TinhGia`. Kết quả?
- [ ] Biên dịch được vì `TinhGia` là public
- [x] Lỗi biên dịch: package `vn.hoc.donhang.noibo` is not visible
- [ ] Biên dịch được, lỗi lúc chạy
- [ ] Cảnh báo nhưng vẫn chạy

Với JPMS, `public` chỉ có nghĩa "public trong các package được export". Đã chạy với `javac` JDK 25.
:::

:::exercise Đảo chiều phụ thuộc để phá vòng
Module `donhang` gọi `ThongBao.gui(...)` trong module `thongbao`; module `thongbao` lại cần `DonHang` của `donhang` để định dạng nội dung tin nhắn → vòng phụ thuộc. Đề xuất cách phá vòng.
???
Đảo chiều một phía bằng interface do **phía ổn định hơn** sở hữu. `donhang` (nghiệp vụ) định nghĩa port:

```java
// trong donhang, package được export
public interface KenhThongBao { void gui(String nguoiNhan, String noiDung); }
```

`donhang` tự định dạng nội dung (nó hiểu `DonHang`) rồi gọi `KenhThongBao`. `thongbao` `requires donhang` và implement `KenhThongBao` bằng SMS/email; nó không cần biết `DonHang` nữa. Lúc khởi động, ứng dụng (hoặc Spring) nối implementation vào. Kết quả: `thongbao → donhang`, không còn chiều ngược lại.

Cách khác: `donhang` phát sự kiện `DonHangDaTao(ma, email, tongTien)` — một record nhỏ trong package export — và `thongbao` lắng nghe. Lỏng hơn, nhưng luồng khó lần theo hơn.
:::
