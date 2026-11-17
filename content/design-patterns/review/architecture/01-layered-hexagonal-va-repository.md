---
title: "Layered, Hexagonal và Repository — tổ chức code ứng dụng enterprise"
summary: "Kiến trúc nhiều tầng (controller → service → repository) và hexagonal (ports & adapters) khác nhau ở hướng phụ thuộc: trong hexagonal, nghiệp vụ không import gì của DB hay HTTP. Repository là port lưu trữ. jdeps xác nhận package domain chỉ phụ thuộc java.base. Đã chạy trên JDK 25."
type: card
level: core
version: 25
lastReviewed: 2026-11-16
tags: [design-patterns, architecture, hexagonal, layered, repository, ports-and-adapters]
related: [design-patterns/consolidate/architecture/hexagonal-port-adapter-thuc-chien, design-patterns/deep-dive/architecture/unit-of-work-outbox-va-saga]
---

## Tóm tắt nhanh

- **Layered** (nhiều tầng): `controller → service → repository → DB`. Mỗi tầng chỉ gọi tầng dưới. Đơn giản, quen thuộc, mặc định của hầu hết dự án Spring.
- Điểm yếu của layered: service (nghiệp vụ) **phụ thuộc** vào repository (kỹ thuật) — entity JPA, `JdbcTemplate`, client HTTP lọt dần vào nghiệp vụ.
- **Hexagonal** (ports & adapters): nghiệp vụ ở giữa, định nghĩa **port** (interface) cho thứ nó cần; **adapter** (DB, REST, Kafka, CLI) implement port hoặc gọi vào nghiệp vụ. Phụ thuộc **chỉ hướng vào trong**.
- **Repository**: port lưu trữ với ngôn ngữ của domain (`tim(ma)`, `luu(hoSo)`), che câu SQL và ORM.
- Không phải dự án nào cũng cần hexagonal. CRUD đơn giản: layered là đủ.

## Ví dụ nhanh (đã chạy trên JDK 25)

```text
vn.hoc.vay
 ├─ domain     HoSoVay (record), DuyetVay (use case), Ports.KhoHoSo / TraCuuTinDung / ThongBao
 ├─ adapter    KhoBoNho, KhoPostgres (implements Ports.KhoHoSo)
 └─ app        Main — lắp adapter vào use case (Spring: @Configuration)
```

```java title="Port do domain sở hữu"
public final class Ports {
    public interface KhoHoSo { Optional<HoSoVay> tim(String ma); void luu(HoSoVay hs); }
    public interface TraCuuTinDung { int nhomNo(String cccd); long tongTraNoThang(String cccd); }
    public interface ThongBao { void gui(String ma, String noiDung); }
}
```

```java title="Use case chỉ biết port"
public final class DuyetVay {
    public DuyetVay(KhoHoSo kho, TraCuuTinDung cic, ThongBao thongBao) { ... }
    public HoSoVay xuLy(String ma) { ... }     // quy tắc: nợ nhóm ≥ 3 → từ chối, DTI > 50% → từ chối
}
```

Phụ thuộc thật trong bytecode (`jdeps -verbose:package out`, rút gọn):

```text
vn.hoc.vay.domain   -> java.lang, java.util, java.util.function     (chỉ java.base)
vn.hoc.vay.adapter  -> java.sql, vn.hoc.vay.domain
vn.hoc.vay.app      -> vn.hoc.vay.adapter, vn.hoc.vay.domain
```

`domain` không có `java.sql` — đổi Postgres sang Oracle hay sang gọi API không đụng vào quy tắc duyệt vay.

## Bảng chọn nhanh

| Dự án | Chọn |
|---|---|
| CRUD quản trị, ít quy tắc | Layered (controller → service → Spring Data repository) |
| Quy tắc nghiệp vụ nhiều, sống lâu (tính phí, duyệt vay, bảo hiểm) | Hexagonal cho phần lõi đó |
| Nhiều cửa vào cùng nghiệp vụ (REST, batch, message) | Hexagonal: mỗi cửa là một adapter vào |
| Nhiều hệ thống ngoài hay đổi (đối tác, core banking) | Port + adapter cho từng hệ thống |
| Microservice nhỏ một việc | Layered gọn, hoặc hexagonal "mỏng" |

## Một lỗi hay gặp: entity JPA làm model domain

```java bad
@Entity class HoSoVay { @Id Long id; @OneToMany List<TaiSan> taiSan; ... setter cho mọi field ... }
// service nhận/trả entity, controller serialize entity ra JSON
```

Một class phải phục vụ ba chủ: ORM (cần constructor rỗng, setter, lazy loading), API (field nào lộ ra ngoài), nghiệp vụ (bất biến, kiểm tra). Kết quả: `LazyInitializationException` khi serialize, field nội bộ lộ ra API, quy tắc bị bỏ qua qua setter. Ít nhất hãy tách **DTO** cho API; với lõi nghiệp vụ phức tạp, tách model domain khỏi entity và để adapter chuyển đổi.

:::version Java 17 / 21 / 25
Record (Java 16) làm model domain bất biến và DTO gọn; sealed (Java 17) mô hình trạng thái/kết quả của use case. Java 25 không có tính năng riêng cho kiến trúc; ranh giới được ép bằng Maven module, JPMS hoặc test kiến trúc (bài *Coupling, cohesion và ranh giới module*).
:::

:::interview Hexagonal architecture giải quyết vấn đề gì so với layered?
Trong layered, tầng nghiệp vụ phụ thuộc tầng truy cập dữ liệu, nên chi tiết kỹ thuật (ORM, SQL, client HTTP) dần lọt vào quy tắc nghiệp vụ, và test nghiệp vụ cần DB. Hexagonal đảo chiều: nghiệp vụ định nghĩa port (interface) cho thứ nó cần, adapter kỹ thuật implement port. Kết quả: nghiệp vụ test được bằng adapter giả trong vài mili giây, đổi công nghệ chỉ thay adapter, và có nhiều cửa vào (REST, batch, message) cho cùng use case. Cái giá: thêm interface, thêm lớp chuyển đổi.
:::

:::quiz Trong hexagonal, interface `KhoHoSo` (port lưu trữ) nên nằm ở đâu?
- [ ] Trong package adapter, cạnh `KhoPostgres`
- [x] Trong package domain — nghiệp vụ sở hữu port, adapter implement nó
- [ ] Trong package app
- [ ] Không cần interface

Port nằm ở domain thì phụ thuộc hướng vào trong: `adapter -> domain`. Đặt ở adapter thì domain phải import adapter — quay lại layered.
:::

:::quiz Dấu hiệu nào cho thấy ranh giới hexagonal đang bị vi phạm?
- [ ] Adapter import class của domain
- [x] Class trong domain import `org.springframework.jdbc` hoặc `java.net.http`
- [ ] App lắp adapter vào use case
- [ ] Domain có record

`jdeps` hoặc test kiến trúc phát hiện được: package domain chỉ nên phụ thuộc `java.base` (và thư viện thuần như validation).
:::
