---
title: "Anti-pattern thường gặp — God class, Service Locator, Singleton có state, primitive obsession, lạm dụng kế thừa"
summary: "Anti-pattern là lời giải trông hợp lý nhưng gây hại về sau. Nhắc nhanh các anti-pattern hay gặp nhất trong dự án Java enterprise, dấu hiệu nhận ra và hướng sửa, kèm ví dụ primitive obsession: đổi chỗ CCCD và số điện thoại mà compiler im lặng. Đã chạy trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, anti-pattern, code-smell, refactoring, primitive-obsession]
related: [design-patterns/consolidate/anti-patterns/god-class-va-service-locator, design-patterns/deep-dive/anti-patterns/over-engineering-va-khi-nao-khong-dung-pattern]
---

## TL;DR

| Anti-pattern | Dấu hiệu | Hướng sửa |
|---|---|---|
| **God class** | `DonHangService` 3.000 dòng, 25 phụ thuộc, ai cũng sửa | Tách theo lý do thay đổi (SRP) |
| **Service Locator** | `Registry.get(X.class)` giữa method | Constructor injection |
| **Singleton có state thay đổi** | `static Map` cache dùng chung, `getInstance()` khắp nơi | Bean do container quản lý, state có giới hạn |
| **Primitive obsession** | `String cccd, String sdt, long soTien` khắp nơi | Value object (`record Cccd`) |
| **Lạm dụng kế thừa** | `BaseService` 5 tầng, lớp con ghi đè để "tắt" hành vi | Composition, Strategy |
| **Anemic domain** | Entity chỉ có getter/setter, mọi quy tắc nằm rải trong service | Đưa quy tắc về object sở hữu dữ liệu |
| **Magic string/number** | `if (trangThai.equals("3"))`, `* 0.105` | Enum, hằng có tên, cấu hình |
| **Over-engineering** | Factory của Factory, interface chỉ có một cài đặt "phòng khi cần" | YAGNI, rule of three |
| **Copy-paste** | Cùng quy tắc tính phí ở 4 chỗ, sửa thiếu 1 | Gom vào một nơi |

## Ví dụ nhanh: primitive obsession (đã chạy trên JDK 25)

```java bad
static String moTaiKhoanCu(String cccd, String soDienThoai) { ... }

String cccd = "001203004567", sdt = "0901234567";
moTaiKhoanCu(sdt, cccd);
// TK cho CCCD 0901234567, OTP gửi tới 001203004567
```

Mã OTP gửi tới một "số điện thoại" 12 chữ số, hồ sơ mở với CCCD sai — compiler không có lý do để phản đối, vì cả hai đều là `String`.

```java good
record Cccd(String so) { Cccd { if (!so.matches("\\d{12}")) throw new IllegalArgumentException("CCCD phải 12 số: " + so); } }
record SoDienThoai(String so) { SoDienThoai { if (!so.matches("0\\d{9}")) throw new IllegalArgumentException("SĐT không hợp lệ: " + so); } }

static String moTaiKhoan(Cccd cccd, SoDienThoai sdt) { ... }

moTaiKhoan(new Cccd(cccd), new SoDienThoai(sdt));
// TK cho CCCD 001203004567, OTP gửi tới 0901234567
moTaiKhoan(new SoDienThoai(sdt), new Cccd(cccd));
// error: method moTaiKhoan ... cannot be applied to given types; required: Cccd,SoDienThoai
new Cccd(sdt);
// CCCD phải 12 số: 0901234567
```

Kiểm tra định dạng nằm ở **một chỗ** (constructor của record); mọi `Cccd` trong hệ thống đều đã hợp lệ.

## Bảng chọn nhanh: sửa ngay hay để sau

| Tình huống | Làm gì |
|---|---|
| Anti-pattern trong code bạn đang sửa | Dọn trong phạm vi thay đổi, có test |
| God class mà mọi tính năng đều đụng tới | Lên kế hoạch tách dần, mỗi PR tách một phần |
| Code cũ ổn định, không ai sửa | Để yên — refactor không mang lại gì |
| Primitive obsession ở ranh giới hệ thống (API, DB) | Đổi sang value object ngay sau khi nhận dữ liệu vào |

## Một lỗi hay gặp: "sửa" anti-pattern bằng anti-pattern khác

God class được "tách" thành `DonHangHelper`, `DonHangUtil`, `DonHangManager` — mỗi cái chứa một đống method `static` không có lý do gộp chung. Kết quả vẫn là một God class, chỉ chia ra nhiều file. Tách theo **lý do thay đổi** (tính giá, giao hàng, thông báo), không theo số dòng.

:::version Java 8 / 16 / 25
Record (Java 16) làm value object gần như miễn phí — lý do lớn nhất để dừng primitive obsession. Sealed (Java 17) thay chuỗi trạng thái "magic". Java 25 không có gì riêng, nhưng compact source file giúp viết nhanh một ví dụ tái hiện anti-pattern để thuyết phục đội trong code review.
:::

:::interview Anti-pattern khác code smell thế nào?
Code smell là **dấu hiệu** (hàm dài, nhiều tham số cùng kiểu, switch theo loại) gợi ý có vấn đề thiết kế. Anti-pattern là một **lời giải lặp lại** mà người ta chủ động chọn vì trông hợp lý (Service Locator "cho tiện", Singleton "cho nhanh"), nhưng có hậu quả xấu đã biết. Smell thường là triệu chứng của anti-pattern: God class biểu hiện qua smell "class quá lớn" và "quá nhiều phụ thuộc".
:::

:::quiz Hàm `chuyenTien(String tuTaiKhoan, String denTaiKhoan, long soTien)`. Anti-pattern nào khiến lỗi đổi chỗ hai tài khoản lọt qua compiler?
- [ ] God class
- [x] Primitive obsession
- [ ] Service Locator
- [ ] Over-engineering

Hai tham số cùng kiểu `String`. Với `record SoTaiKhoan(String so)` thì vẫn cùng kiểu — cần tham số có tên (record `LenhChuyen(tu, den, soTien)` hoặc builder) để tránh đổi chỗ.
:::

:::quiz Class `TaiKhoan` chỉ có getter/setter; quy tắc "không rút quá số dư" nằm trong 3 service khác nhau. Đây là anti-pattern gì?
- [ ] Singleton có state
- [x] Anemic domain model
- [ ] Lạm dụng kế thừa
- [ ] Magic number

Quy tắc nên nằm trong `TaiKhoan.rut(soTien)` — object sở hữu dữ liệu tự bảo vệ bất biến của nó, không ai gọi `setSoDu` bỏ qua kiểm tra được.
:::
