---
title: Thiết kế REST API — tài nguyên, method, status code
summary: "Quy ước REST mà phỏng vấn nào cũng hỏi: URL là danh từ số nhiều, method nói hành động, status code nói kết quả. Bảng method/idempotent/safe, các status code hay dùng, định dạng lỗi thống nhất và lỗi hay gặp khi trả 200 cho mọi thứ."
type: card
level: core
version: 26
lastReviewed: 2026-11-13
tags: [nodejs, rest, http, api-design]
related: [nodejs/consolidate/rest-api/viet-api-co-test, nodejs/deep-dive/rest-api/phan-trang-idempotency-va-versioning]
---

## TL;DR

- **URL là tài nguyên** (danh từ số nhiều): `/products`, `/products/42`, `/products/42/reviews`. Không viết `/getProducts`, `/deleteProduct?id=42`.
- **Method là hành động**: GET đọc, POST tạo, PUT thay toàn bộ, PATCH sửa một phần, DELETE xoá.
- **Status code là kết quả**: 2xx thành công, 4xx lỗi phía client, 5xx lỗi phía server.
- Lỗi luôn trả **cùng một định dạng JSON** để frontend xử lý chung.

## Ví dụ: API sản phẩm

| Việc | Request | Thành công |
|---|---|---|
| Danh sách, lọc, phân trang | `GET /api/products?category=gia-dung&page=2&limit=20` | `200` + mảng và thông tin trang |
| Xem một sản phẩm | `GET /api/products/42` | `200`; không có → `404` |
| Tạo | `POST /api/products` + body | `201` + header `Location: /api/products/43` |
| Sửa giá | `PATCH /api/products/42` + `{ "price": 1490000 }` | `200` + bản ghi mới |
| Xoá | `DELETE /api/products/42` | `204` (không body) |

```json title="Định dạng lỗi thống nhất"
{
  "error": "VALIDATION",
  "message": "Dữ liệu không hợp lệ",
  "details": [{ "field": "price", "message": "Phải là số nguyên dương" }]
}
```

## Bảng method

| Method | Safe (không đổi dữ liệu) | Idempotent (gọi N lần = 1 lần) |
|---|---|---|
| GET | ✓ | ✓ |
| PUT | ✗ | ✓ |
| DELETE | ✗ | ✓ |
| PATCH | ✗ | Không bắt buộc |
| POST | ✗ | ✗ — gọi 2 lần tạo 2 bản ghi |

## Status code hay dùng

| Code | Khi nào |
|---|---|
| 200 OK | Đọc/sửa thành công, có body |
| 201 Created | Tạo thành công (kèm `Location`) |
| 204 No Content | Thành công, không có body (DELETE) |
| 400 Bad Request | Body/query sai định dạng, validation fail |
| 401 Unauthorized | **Chưa xác thực** (thiếu/sai token) |
| 403 Forbidden | Đã xác thực nhưng **không có quyền** |
| 404 Not Found | Không có tài nguyên |
| 409 Conflict | Trùng (email đã tồn tại), xung đột phiên bản |
| 422 Unprocessable Content | Đúng định dạng nhưng sai nghiệp vụ (một số team dùng thay 400) |
| 429 Too Many Requests | Vượt rate limit |
| 500 Internal Server Error | Lỗi không lường trước — **không** lộ stack trace ra client |

## Lỗi hay gặp: luôn trả 200

```text bad
HTTP/1.1 200 OK
{ "success": false, "message": "Không tìm thấy" }
```

Frontend, cache, monitoring và retry đều dựa vào status code. Trả 200 cho lỗi làm interceptor HTTP không bắt được, dashboard lỗi luôn "xanh".

:::version HTTP và REST
Các quy ước này ổn định nhiều năm (RFC 9110 là đặc tả HTTP hiện hành). Status `422` đổi tên chính thức từ "Unprocessable Entity" sang "Unprocessable Content" trong RFC 9110; ý nghĩa không đổi.
:::

:::interview Khác nhau giữa PUT và PATCH? Giữa 401 và 403?
PUT **thay toàn bộ** tài nguyên bằng body gửi lên (trường nào thiếu coi như bị xoá/về mặc định) và là idempotent; PATCH chỉ **sửa các trường gửi lên**. 401 nghĩa là server chưa biết bạn là ai (thiếu hoặc sai token — đăng nhập lại); 403 nghĩa là server biết bạn là ai nhưng bạn không có quyền làm việc này (đăng nhập lại cũng vô ích).
:::

:::quiz Người dùng staff (đã đăng nhập) gọi `DELETE /api/products/42`, nhưng chỉ admin được xoá. Trả status nào?
- [ ] 401
- [x] 403
- [ ] 404
- [ ] 400

Đã xác thực (biết là ai) nhưng không đủ quyền → 403.
:::

:::quiz Method nào **không** idempotent?
- [ ] GET
- [ ] PUT
- [ ] DELETE
- [x] POST

Gửi lại `POST /orders` khi mạng chập chờn có thể tạo hai đơn — vì vậy cần idempotency key (bài Chuyên sâu).
:::

:::quiz Tạo sản phẩm thành công bằng `POST /api/products`. Response chuẩn nhất là?
- [ ] `200` + `{ "success": true }`
- [x] `201` + body sản phẩm mới + header `Location: /api/products/43`
- [ ] `204`
- [ ] `302` chuyển hướng

`201 Created` kèm `Location` cho client biết địa chỉ tài nguyên mới.
:::
