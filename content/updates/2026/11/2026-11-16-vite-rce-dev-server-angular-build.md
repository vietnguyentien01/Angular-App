---
title: "Vite vá lỗ hổng RCE mức Critical ở dev server: Angular 22.2.7 vẫn kéo bản Vite bị ảnh hưởng"
date: 2026-11-16
summary: "Advisory GHSA-p4f5-76q4-ffq7 (Critical, CVSS 9.1): gửi HTTP request tới Vite dev server có thể chạy code tuỳ ý, khi dev server mở ra mạng bằng --host. Đã vá ở Vite 8.3.7, 8.2.5, 8.1.7, 7.3.8, 6.4.6. @angular/build 22.2.7 vẫn ghim vite 8.3.5, còn 22.3.0-rc.0 đã lên 8.3.8."
importance: high
tags: [vite, security, angular-cli, dev-server]
relatedTopics: [angular/cli-project, angular/security]
sources:
  - title: Vite Security Advisory — Remote code execution using __vite-browser-external virtual module (GHSA-p4f5-76q4-ffq7)
    url: https://github.com/vitejs/vite/security/advisories/GHSA-p4f5-76q4-ffq7
  - title: Vite — Releases
    url: https://github.com/vitejs/vite/releases
  - title: Angular CLI — Releases
    url: https://github.com/angular/angular-cli/releases
---

## Có gì mới

Ngày 2026-11-10, Vite công bố advisory **GHSA-p4f5-76q4-ffq7** — *Remote code execution using `__vite-browser-external` virtual module*:

- Mức **Critical**, CVSS v4 **9.1**. Advisory ghi "No known CVE" (chưa có mã CVE).
- Cơ chế: resolver của Vite đưa một module ID lấy từ URL vào virtual module `__vite-browser-external:<suffix>` và `__vite-optional-peer-dep:<suffix>` **mà không escape**. Kẻ tấn công chèn được code vào module đó bằng một HTTP request tới dev server.
- Hậu quả theo advisory: **đọc file** ngoài danh sách `server.fs.allow` (ví dụ file bí mật ngoài project), và **chạy code phía server**, vì Vite dùng `eval` khi xử lý `new Worker` và `import.meta.glob`.
- Điều kiện: chỉ ảnh hưởng ứng dụng **mở dev server ra mạng** bằng `--host` hoặc option `server.host`. Không cần đăng nhập, không cần người dùng thao tác.

| Nhánh Vite | Bị ảnh hưởng | Bản vá |
|---|---|---|
| 8.3 | 8.3.0 – 8.3.6 | 8.3.7 |
| 8.2 | 8.2.0 – 8.2.4 | 8.2.5 |
| 8.0 – 8.1 | 8.0.0 – 8.1.6 | 8.1.7 |
| 7.x | 7.0.0 – 7.3.7 | 7.3.8 |
| 4.x – 6.x | 4.0.0 – 6.4.5 | 6.4.6 |

Với Vite 8, advisory cho biết đoạn code lỗi nằm trong binary của **Rolldown**: Vite 8.3.7 và 8.2.5 dùng bản sửa trong Rolldown 1.2.17.

## Vì sao quan trọng

Angular CLI dùng Vite cho `ng serve` (qua `@angular/build`). Kiểm tra bằng `npm view` ngày 2026-11-16:

| Gói | `vite` được ghim | Trong dải bị ảnh hưởng? |
|---|---|---|
| `@angular/build@22.2.7` (tag `latest`) | `8.3.5` (kèm `rolldown@1.2.16`) | Có |
| `@angular/build@22.3.0-rc.0` (tag `next`) | `8.3.8` | Không |
| `@angular/build@21.2.30` (`v21-lts`) | `7.3.7` | Có |
| `@angular/build@20.3.43` (`v20-lts`) | `7.3.7` | Có |

Angular ghim **chính xác** phiên bản Vite, nên `npm update` không tự kéo bản vá. Advisory không nói gì riêng về Angular. Bản tin này **chưa** kiểm chứng tấn công thật qua `ng serve`; nhưng phiên bản Vite nằm trong dải bị ảnh hưởng, và tình huống dễ gặp trong dự án enterprise thì có thật:

- `ng serve --host 0.0.0.0` để test trên điện thoại, máy ảo hoặc cho đồng nghiệp xem qua mạng LAN.
- Dev server chạy trong **container** hoặc **dev container**/Codespaces, buộc phải lắng nghe `0.0.0.0`.
- Môi trường demo hay QA chạy `ng serve` thay vì build production.

Thêm nữa: `npm audit` **chưa báo** lỗi này. Ngày 2026-11-16, trang advisory toàn cục `github.com/advisories/GHSA-p4f5-76q4-ffq7` vẫn trả 404, và `npm audit` trên một dự án Angular 22.2.6 (vite 8.3.5) không liệt kê nó. Pipeline dựa hoàn toàn vào `npm audit` hay Dependabot sẽ không cảnh báo.

## Ví dụ

Kiểm tra phiên bản Vite thật sự được cài:

```bash
npm ls vite
# +-- @angular/build@22.2.6
# | `-- vite@8.3.5        ← nằm trong dải 8.3.0 – 8.3.6
```

Trong lúc chờ Angular CLI phát hành bản patch nâng Vite, có thể ép phiên bản bằng `overrides` trong `package.json`:

```json
{
  "overrides": {
    "vite": "8.3.8"
  }
}
```

```bash
npm install
npm ls vite
# | `-- vite@8.3.8 overridden
```

Đã thử trên dự án Angular 22.2.6 của Learning Hub: sau khi override, `ng build` và `ng serve` đều chạy bình thường (trang trả về 200). Với Angular 20/21 (Vite 7), cách tương tự là `"vite": "7.3.8"` (bản vá cùng nhánh; chưa thử trên dự án Angular 20/21). Override là biện pháp tạm thời: gỡ nó khi `@angular/build` tự ghim bản đã vá, để không lệch phiên bản Vite mà Angular đã kiểm thử.

## Việc nên làm

- **Áp dụng ngay:**
  - Không mở dev server ra mạng nếu không thật cần: bỏ `--host 0.0.0.0` và `"host"` trong `angular.json` ở máy dev.
  - Nếu bắt buộc phải mở (container, máy test thiết bị), dùng `overrides` như trên.
  - Không bao giờ dùng `ng serve` cho môi trường demo, QA hay staging truy cập được từ mạng: deploy bản `ng build`.
- **Theo dõi:** bản patch tiếp theo của `@angular/build` 22.2.x và các nhánh LTS 20/21 có nâng Vite hay không (xem trang Releases của Angular CLI). Khi nâng, gỡ `overrides`.
- **Quy trình:** bổ sung theo dõi trang Security Advisories của Vite cho các dự án dùng Angular CLI. Lỗi này cho thấy `npm audit` có thể chậm vài ngày so với advisory gốc.

:::quiz Dự án dùng `@angular/build@22.2.7`, dev chạy `ng serve` mặc định (chỉ `localhost`) trên laptop. Theo advisory, mức rủi ro thế nào?
- [ ] Bị ảnh hưởng nặng như khi mở ra mạng
- [x] Không thoả điều kiện của advisory — chỉ ảnh hưởng khi dev server mở ra mạng bằng `--host`/`server.host`; vẫn nên vá khi có bản Angular nâng Vite
- [ ] Bị ảnh hưởng cả bản build production
- [ ] Đã được `npm audit` cảnh báo

Advisory nêu rõ điều kiện "explicitly exposes the Vite dev server to the network". Bản build production (`ng build`) không chạy Vite dev server.
:::
