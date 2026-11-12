---
title: Claude in Chrome cho dev frontend — debug console, kiểm tra form, so với mockup ngay trong trình duyệt thật
summary: "Kết nối Claude Code với trình duyệt Chrome/Edge của bạn để Claude mở localhost, thao tác form, đọc console và DOM, ghi GIF — dùng chung phiên đăng nhập của bạn. Cài đặt, quyền theo site, chi phí context, so sánh với Playwright MCP và /verify, cùng các rủi ro cần biết."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, chrome, browser, frontend, verification]
related: [claude-code/labs/labs/mcp-playwright-kiem-tra-giao-dien, claude-code/deep-dive/verification/kiem-chung-giao-dien]
---

## TL;DR

- **Claude in Chrome** = extension trình duyệt + `claude --chrome`. Claude mở tab mới trong Chrome **thật** của bạn, dùng chung trạng thái đăng nhập, thao tác hiển thị trực tiếp.
- Rất hợp cho dev Angular: tái hiện bug UI, đọc lỗi console, kiểm tra validation form, so giao diện với mockup — rồi sửa code ngay trong cùng phiên.
- Vì dùng phiên đăng nhập thật của bạn, hãy quản lý **quyền theo site** chặt chẽ.

## Điều kiện

- Google Chrome hoặc Microsoft Edge (Brave, Arc, Vivaldi, Opera cũng được nhận diện); **không** hỗ trợ trong WSL.
- Extension *Claude in Chrome* (bản 1.0.36+).
- Gói Anthropic trực tiếp (Pro, Max, Ultra, Team, Enterprise) và đăng nhập bằng `/login` — đăng nhập bằng API key hoặc token `setup-token` thì tích hợp bị tắt; không có qua Bedrock/Vertex/Foundry.

## Bắt đầu

```bash
claude --chrome
```

```text
/chrome
```

`/chrome` hiển thị trạng thái (*Status: Enabled*, *Extension: Installed*), quản lý quyền, kết nối lại, chọn trình duyệt khi có nhiều cái. Chọn **Enabled by default** để không cần `--chrome` — nhưng như vậy công cụ trình duyệt luôn chiếm context; nếu thấy tốn, tắt và chỉ bật khi cần (trong VS Code: gõ `@browser`).

Các tab Claude mở được gom vào một **tab group** của phiên; `/clear` đóng group đó.

## Quy trình cho dự án Angular

**Debug lỗi console**

```text
Mở http://localhost:4200/orders, đợi trang tải xong, đọc console và chỉ báo lỗi (error) và cảnh báo NG0 của Angular.
Với mỗi lỗi: nguyên nhân khả dĩ và file nguồn liên quan trong src/app. Chưa sửa.
```

Tài liệu khuyên: nói rõ **mẫu cần tìm** trong console thay vì xin toàn bộ log (log rất dài, tốn context).

**Kiểm tra validation form**

```text
Mở localhost:4200/register. Thử submit với: email sai định dạng, password 5 ký tự, để trống họ tên.
Kiểm tra thông báo lỗi hiện đúng dưới từng ô, nút Submit bị vô hiệu hoá, và focus chuyển tới ô lỗi đầu tiên.
Báo bảng: trường hợp | kỳ vọng | thực tế.
```

**So với mockup**

```text
[Image #1] là mockup của card sản phẩm. Mở localhost:4200/products, so sánh card đầu tiên với mockup:
khoảng cách, cỡ chữ, màu, trạng thái hover. Liệt kê khác biệt rồi sửa CSS trong product-card.component.css, kiểm tra lại.
```

**Ghi lại để chia sẻ**: nhờ Claude ghi GIF luồng tái hiện bug để đính kèm vào ticket.

## Quyền và an toàn

- Quyền theo site **kế thừa từ extension** — quản lý trong cài đặt extension: site nào Claude được duyệt, bấm, gõ.
- Hộp thoại quyền bắt đầu bằng *"Claude in Chrome wants to…"*, có lựa chọn cho phép mọi hành động trên site đó trong phiên.
- Gặp trang đăng nhập hoặc CAPTCHA, Claude **dừng và nhờ bạn** tự xử lý.
- Plan mode: vẫn hỏi trước khi ghi GIF hoặc mở tab mới.
- Tổ chức có thể chặn hẳn server `claude-in-chrome` qua managed MCP policy.

:::danger Trình duyệt thật = phiên đăng nhập thật
Claude dùng được mọi site bạn đang đăng nhập (email, hệ thống nội bộ, ngân hàng). Chỉ cho phép site cần cho task (vd `localhost`, môi trường dev); đừng cấp "cho phép mọi site". Trang web lạ có thể chứa prompt injection — đọc kỹ hành động Claude đề xuất sau khi nó vừa đọc nội dung từ một trang bên ngoài.
:::

## Chọn công cụ nào để kiểm tra giao diện?

| | Claude in Chrome | Playwright MCP (Lab 12) | `/verify`, `/run` |
|---|---|---|---|
| Trình duyệt | Chrome/Edge thật của bạn, có phiên đăng nhập | Trình duyệt do Playwright khởi chạy, sạch | Theo cách skill dạy cho dự án (có thể dùng một trong hai) |
| Hợp với | Debug tương tác, app cần đăng nhập SSO, so mockup | Kịch bản lặp lại được, CI, môi trường cô lập | Xác nhận "thay đổi này chạy thật" sau khi sửa |
| Rủi ro | Truy cập mọi site đã đăng nhập | Thấp hơn (profile riêng) | Tuỳ cấu hình |
| Cần | Extension + gói Anthropic | `npx` + Node | Skill `/run-skill-generator` để dạy cách chạy app |

:::senior Góc nhìn senior
Browser automation là **phép kiểm tra**, không phải bằng chứng duy nhất: một lần Claude "thấy" form chạy đúng không thay thế test tự động. Dùng Chrome để tái hiện và hiểu bug nhanh, rồi chốt hành vi bằng component test hoặc E2E để lỗi không quay lại.
:::

:::quiz Bạn đăng nhập Claude Code bằng `ANTHROPIC_API_KEY` và chạy `claude --chrome`, nhưng tích hợp không bật. Vì sao?
- [ ] Phải dùng Firefox
- [x] Chrome integration cần đăng nhập bằng `/login` với gói Anthropic trực tiếp; với API key hoặc token dài hạn nó bị tắt
- [ ] Phải bật plan mode
- [ ] Phải cài Playwright

Kiểm tra bằng `/chrome` và `/status`.
:::

:::quiz Vì sao không nên bật "Enabled by default" nếu ít dùng trình duyệt?
- [ ] Vì sẽ mở Chrome mỗi lần khởi động
- [x] Vì công cụ và chỉ dẫn của trình duyệt luôn được nạp, tốn context ở mọi phiên
- [ ] Vì nó tắt auto mode
- [ ] Vì chỉ chạy trên macOS

Bật khi cần bằng `--chrome` hoặc `@browser`.
:::

:::exercise Debug một lỗi UI thật bằng Chrome
Trong cc-lab (hoặc dự án của bạn), cố ý gây lỗi runtime: trong `TaskList`, đổi `store.visible()` thành `store.visibl()` ở template rồi chạy `ng serve` (lỗi build) — hoặc ném lỗi trong một handler click. Chạy `claude --chrome`, nhờ Claude mở trang, tái hiện, đọc console, tìm file gây lỗi và sửa, rồi kiểm tra lại trên trình duyệt.
???
Prompt mẫu: *"Mở localhost:4200, bấm checkbox của task đầu tiên, đọc console và chỉ báo error. Tìm nguyên nhân trong src/app/tasks, sửa, reload trang và xác nhận không còn lỗi."* Kỳ vọng: Claude đọc stack trace trong console, chỉ đúng file/dòng, sửa và xác nhận bằng một lần thao tác lại. Bước chốt (quan trọng): nhờ Claude viết một component test tái hiện lỗi để nó không quay lại.
:::

> Nguồn: *Use Claude Code with Chrome* — code.claude.com/docs/en/chrome (truy cập 12/11/2026).
