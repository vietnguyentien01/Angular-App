---
title: Khi buộc phải bypass sanitizer — và cách làm an toàn (case study app này)
summary: Learning Hub cần hiển thị HTML có style của code highlight; cách thiết kế để bypass vẫn an toàn, kèm CSP, autoCsp và Trusted Types.
level: intermediate
version: 22
lastReviewed: 2026-11-11
tags: [security, sanitization, csp, trusted-types, case-study]
related: [angular/review/security/xss-va-sanitization, angular/consolidate/security/token-va-xsrf]
---

## Bài toán thật

Nội dung bài học được build từ Markdown; code được tô màu bằng Shiki, vốn dùng `style="--shiki-light:#…"` trên từng `<span>`. Đưa qua `[innerHTML]` thì Angular **xoá `style`** → code mất màu. Phải bypass sanitizer.

## Thiết kế để bypass vẫn an toàn

1. **Thu hẹp nguồn**: chỉ HTML do script build sinh ra mới được bypass, không bao giờ dữ liệu runtime từ người dùng/API.
2. **Chặn ở đầu vào**: script build **escape mọi HTML thô** trong Markdown và chặn link `javascript:` → HTML đầu ra chỉ gồm thẻ do marked + shiki tạo.
3. **Có test** cho lớp chặn đó (`<script>`, `onerror`, `javascript:` đều bị vô hiệu).
4. **Đặt tên rõ ràng**: pipe tên `trustedContentHtml` kèm chú thích "chỉ dùng cho HTML từ build-content".

```ts title="scripts/lib/markdown.ts (rút gọn)"
renderer: {
  html({ text }) {
    return escapeHtml(text); // HTML thô trong Markdown → text
  },
  link({ href, tokens }) {
    const safeHref = /^(https?:|mailto:|#|\/|\.)/i.test(href) ? href : '#';
    // ...
  },
}
```

```ts title="scripts/lib/markdown.test.ts"
it('escape HTML thô để nội dung luôn an toàn', () => {
  const out = html('Xin chào <script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.ok(!out.includes('<script>'));
  assert.ok(!out.includes('<img'));
});
```

## Lớp phòng thủ thứ hai: CSP và Trusted Types

| Cơ chế | Tác dụng | Trong Angular |
|---|---|---|
| **CSP** (Content-Security-Policy) | Trình duyệt chặn script không được phép (inline, domain lạ) | Nonce qua thuộc tính `ngCspNonce` trên root / token `CSP_NONCE`; tuỳ chọn build `security.autoCsp` (đang thử nghiệm, mặc định tắt) sinh CSP dạng hash |
| **Trusted Types** | Trình duyệt chặn gán chuỗi thường vào sink nguy hiểm (`innerHTML`…) | Angular tạo policy tên `angular` (giá trị đã sanitize) và `angular#unsafe-bypass` (giá trị từ `bypassSecurityTrust*`) |

```text
Content-Security-Policy: require-trusted-types-for 'script'; trusted-types angular angular#unsafe-bypass;
```

Bỏ `angular#unsafe-bypass` khỏi danh sách → mọi chỗ dùng `bypassSecurityTrust*` sẽ bị trình duyệt chặn. Đây là cách **kiểm kê** và cấm bypass ở cấp ứng dụng.

:::senior Góc nhìn Senior
Mỗi `bypassSecurityTrust*` trong codebase nên được coi như một "lỗ hổng tiềm năng có giấy phép": cần lý do, phạm vi hẹp, test, và người review hiểu rủi ro. Có thể thêm rule ESLint cấm gọi trực tiếp, chỉ cho phép qua một pipe/service được review.
:::

:::quiz Điều gì khiến việc bypass trong app này chấp nhận được?
- [ ] Vì app chỉ có một người dùng
- [x] Vì nguồn HTML bị giới hạn ở output của script build, và script đó escape mọi HTML thô + có test chứng minh
- [ ] Vì Shiki an toàn tuyệt đối
- [ ] Vì Angular sanitize lại sau khi bypass

Chú ý: bản tin tự động cũng đi qua cùng pipeline, nên lớp escape ở build là bắt buộc.
:::

:::quiz Bật Trusted Types với `trusted-types angular;` (không có `angular#unsafe-bypass`). Code gọi `bypassSecurityTrustHtml` sẽ?
- [ ] Chạy bình thường
- [x] Bị trình duyệt chặn khi giá trị được gán vào DOM
- [ ] Được Angular sanitize lại
- [ ] Lỗi biên dịch

Policy `angular#unsafe-bypass` chính là "cửa sau" cho bypass — không cho phép nó nghĩa là cấm bypass.
:::

:::exercise Review đoạn code
```ts
@Component({ template: `<div [innerHTML]="html()"></div>` })
export class Announcement {
  private sanitizer = inject(DomSanitizer);
  readonly raw = input.required<string>(); // từ API CMS, BA soạn bằng rich text editor
  readonly html = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.raw()));
}
```
Bạn góp ý gì?
???
- Nội dung CMS là dữ liệu **không tin cậy hoàn toàn** (tài khoản CMS có thể bị chiếm, editor có thể cho chèn HTML). Bypass ở đây mở đường cho stored XSS.
- Bỏ bypass, dùng `[innerHTML]="raw()"` để Angular sanitize. Nếu cần giữ một số định dạng bị loại bỏ (vd `style`), sanitize phía server bằng allowlist (DOMPurify / thư viện server) rồi mới cân nhắc bypass — và ghi rõ lý do.
- Thêm CSP để giảm thiệt hại nếu lọt.
:::
