---
title: "Node.js vá 16 lỗ hổng bảo mật (11/11/2026): nâng cấp server SSR và CI"
date: 2026-11-12
summary: "Node.js phát hành bản vá bảo mật cho cả ba nhánh 22.x, 24.x, 26.x, sửa 16 CVE (7 mức high), chủ yếu ở HTTP/2, HTTPS và TLS. Server Angular SSR và môi trường CI nên nâng lên 22.23.5 / 24.22.3 / 26.13.1."
importance: high
tags: [nodejs, security, ssr]
relatedTopics: [angular/ssr, angular/security]
sources:
  - title: Node.js — November 11, 2026 Security Releases
    url: https://nodejs.org/en/blog/vulnerability/november-2026-security-releases
---

## Có gì mới

Ngày 2026-11-11, Node.js phát hành bản vá bảo mật cho các nhánh đang được hỗ trợ:

| Nhánh | Bản đã vá |
|---|---|
| 22.x | `v22.23.5` |
| 24.x | `v24.22.3` |
| 26.x (Active LTS) | `v26.13.1` |

Đợt này sửa **16 CVE**: 7 mức **high**, 6 **medium**, 3 **low**. Các nhóm chính:

- **HTTP/2:** client không cần xác thực có thể làm sập server (abort, use-after-free, NULL dereference khi hủy `respondWithFile()`). Có lỗi làm session không bao giờ được dọn, gây rò bộ nhớ và file descriptor. Có lỗi gửi nhầm vùng nhớ đã giải phóng cho client. Ngoài ra `maxSessionMemory` không giới hạn được dữ liệu đang xếp hàng.
- **HTTPS:** lỗi re-entrancy khi ghi TLS độ dài 0 có thể làm lộ heap của server. Theo thông báo, `node:http` dạng cleartext không bị ảnh hưởng.
- **TLS / mTLS:**
  - Bypass xác thực client certificate qua TLS 1.2 renegotiation.
  - SNI context chỉ có CA bị "fail open" về CA mặc định.
  - `https.Agent` dùng lại TLS session giữa các policy khác nhau, dẫn tới bypass kiểm tra certificate.
- **Khác:**
  - Lộ credential của proxy trong thông báo lỗi `ERR_PROXY_INVALID_CONFIG`.
  - Ba lỗi mức low liên quan Permission Model và `zlib`.

Thông báo cũng nhắc: các phiên bản End-of-Life **luôn** bị ảnh hưởng mỗi khi có đợt security release.

## Vì sao quan trọng

- **Angular SSR** (`@angular/ssr` + Express / Node) chạy trực tiếp trên Node. Nếu server terminate TLS hoặc bật HTTP/2 ngay trong Node, thay vì để reverse proxy làm, nhóm lỗi high ở trên ảnh hưởng trực tiếp tới khả năng sẵn sàng và rò rỉ dữ liệu.
- **Ngân hàng, chính phủ** hay dùng **mTLS** giữa BFF / SSR server và backend. Lỗi bypass client certificate và lỗi tái sử dụng TLS session trong `https.Agent` thuộc đúng loại mà audit bảo mật sẽ hỏi.
- **CI/CD và dev server:** máy build vẫn chạy Node. Lỗi lộ credential proxy trong log CI đáng chú ý ở mạng nội bộ phải đi qua proxy có xác thực.

## Ví dụ

```bash
# Kiểm tra phiên bản đang chạy trên server SSR / runner CI
node -v

# Ví dụ với nvm: nâng lên bản đã vá của nhánh đang dùng
nvm install 26.13.1
```

```dockerfile title="Dockerfile"
# Trước
FROM node:26.13.0-alpine
# Sau — pin đúng bản đã vá
FROM node:26.13.1-alpine
```

## Việc nên làm

- **Áp dụng ngay:** nâng Node trên server SSR, image Docker và runner CI lên `22.23.5`, `24.22.3` hoặc `26.13.1` theo nhánh đang dùng.
- Kiểm tra xem server SSR có tự terminate TLS / HTTP/2 hoặc dùng mTLS bằng `https.Agent` không. Nếu có, ưu tiên nâng cấp những server đó trước.
- Rà lại log CI có lỗi `ERR_PROXY_INVALID_CONFIG`. Nếu credential proxy đã lọt vào log, hãy đổi credential đó.
- Còn chạy Node đã End-of-Life thì lên kế hoạch chuyển sang nhánh LTS đang được hỗ trợ.
