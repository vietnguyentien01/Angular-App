---
title: Review và bảo mật ở quy mô team — /code-review, Code Review trên GitHub, REVIEW.md, security guidance, Claude Security
summary: "Năm lớp kiểm tra code bằng Claude từ lúc đang gõ tới khi PR được mở: security guidance, /code-review và /security-review, plugin Claude Security, dịch vụ Code Review trên GitHub, tinh chỉnh bằng REVIEW.md — mỗi lớp bắt gì, chạy ở đâu và giới hạn của nó."
type: lesson
level: advanced
lastReviewed: 2026-11-12
tags: [claude-code, code-review, security, team, github]
related: [claude-code/consolidate/workflows/git-va-pull-request, claude-code/deep-dive/automation/bao-mat-va-quy-dinh-team]
---

## TL;DR

| Lớp | Khi nào chạy | Bắt gì | Ở đâu |
|---|---|---|---|
| **Security guidance plugin** | Tự động khi Claude đang viết code | Injection, deserialization không an toàn, DOM nguy hiểm… trong chính thay đổi của Claude | Phiên của bạn |
| **`/code-review`** | Khi bạn gọi, trước khi push | Bug về tính đúng đắn trong diff | Phiên của bạn |
| **`/security-review`** | Khi bạn gọi | Lỗ hổng trong diff của nhánh so với nhánh mặc định | Phiên của bạn |
| **Claude Security plugin** (`/claude-security`) | Theo yêu cầu: cả repo, một nhánh, một PR, một commit | Quét lỗ hổng nhiều agent, mô hình đe doạ, đề xuất patch | Phiên của bạn (tính vào usage) |
| **Code Review** (dịch vụ) | Mỗi PR trên GitHub (mở, mỗi lần push, hoặc khi được yêu cầu) | Bug có thể làm hỏng production, có bước xác minh để lọc báo nhầm | Hạ tầng Anthropic, gói Team/Enterprise |

Không lớp nào **duyệt** hay **chặn** merge thay bạn: "không có phát hiện" không có nghĩa code không lỗi.

## 1. Security guidance — bắt sớm nhất

```text
/plugin install security-guidance@claude-plugins-official
```

Cài xong là chạy tự động: Claude tự soát thay đổi của mình về các lỗi bảo mật phổ biến và sửa ngay trong phiên — giảm số vấn đề đến được PR. Cần Python trên `PATH` và repo git.

## 2. Review cục bộ trước khi push

```text
/code-review high
/security-review
```

Xem bài *Git và pull request* và *Lệnh cho quy trình code* cho đủ tuỳ chọn (`--fix`, `--comment`, PR#, `ultra`).

## 3. Quét lỗ hổng chuyên sâu: Claude Security

```text
/plugin install claude-security@claude-plugins-official
/claude-security
```

- Menu ba việc: **quét codebase**, **quét một tập thay đổi** (diff nhánh, PR, một commit), **đề xuất patch**.
- Quét cả repo: agent dựng bản đồ kiến trúc, mô hình đe doạ, săn lỗ hổng, rồi xác minh độc lập từng phát hiện.
- Repo lớn: chọn phạm vi (vd lớp API, code xác thực) thay vì cả cây.
- Kết quả ghi vào thư mục `CLAUDE-SECURITY-<thời-gian>/` trong repo; patch nằm trong `patches/`, **không bao giờ tự áp dụng** — bạn quyết định.
- Cần Python 3.9+, git (cho quét thay đổi và patch); chạy trên model của phiên, tính vào usage.

Dịp nên dùng với dự án Angular: trước release lớn, sau khi thêm luồng xác thực mới, khi tiếp nhận codebase cũ.

## 4. Code Review trên mọi PR (dịch vụ)

- Gói **Team/Enterprise**, repo trên GitHub (kể cả GitHub Enterprise Server). Owner của tổ chức Claude bật và chọn repo.
- Bốn bước: **Find** (nhiều agent đọc diff và code xung quanh) → **Verify** (lọc báo nhầm) → **Rank** (theo mức độ) → **Post** (comment inline + tóm tắt + check run *Claude Code Review*).
- Mức review: **Quick**, **Standard** (mặc định), **Deep** — càng kỹ càng tốn.
- Mặc định tập trung **tính đúng đắn**, không bắt lỗi format hay thiếu test.
- Check run **không** kết thúc ở trạng thái fail — quyết định merge vẫn ở người.
- Không có cho tổ chức bật Zero Data Retention, cấu hình HIPAA, hoặc dùng khoá mã hoá do khách hàng quản lý (CMEK).

## 5. Tinh chỉnh bằng CLAUDE.md và REVIEW.md

Dịch vụ Code Review đọc:

- **`CLAUDE.md`** ở gốc và ở thư mục cha của mỗi file thay đổi → thay đổi vi phạm quy tắc trong đó thành phát hiện.
- **`REVIEW.md`** ở gốc repo (và trong thư mục con khi nhánh mặc định được bảo vệ) → chỉ dẫn **riêng cho review**: cái gì là nghiêm trọng, bỏ qua gì, kiểm tra thêm gì.

```md title="REVIEW.md"
# Review instructions

## Mức Important ở repo này nghĩa là
- Lộ dữ liệu cá nhân (CCCD, số điện thoại, địa chỉ) ra log, URL hoặc localStorage.
- Gọi API không qua interceptor xác thực.
- Subscription/interval không được dọn dẹp trong component sống lâu.

## Bỏ qua
- File trong `libs/api-client/generated/` và `**/*.mock.ts`.
- Góp ý đặt tên và định dạng (Prettier/ESLint đã lo).

## Kiểm tra thêm
- Mọi `innerHTML`/`bypassSecurityTrust*` phải có comment giải thích nguồn dữ liệu an toàn.
- Route mới trong `apps/portal` phải có guard và text qua i18n.
```

:::note Hai công cụ đọc file khác nhau
Dịch vụ Code Review đọc cả `CLAUDE.md` và `REVIEW.md`; lệnh `/code-review` cục bộ là công cụ riêng, đọc khác. Đừng giả định cấu hình một bên tự áp cho bên kia — kiểm tra trang tài liệu của từng công cụ.
:::

`REVIEW.md` trong thư mục có tên kiểu `tests`, `fixtures`, `generated`, `vendor`, `node_modules`… **không** được áp dụng — đặt chỉ dẫn cho các thư mục đó ở `REVIEW.md` gốc.

## Thiết kế quy trình cho team

```text
Dev viết code (+ security guidance tự soát)
  → /code-review + /security-review trước khi push
  → PR: Code Review dịch vụ (hoặc workflow GitHub Actions, Lab 10) + CI (test, lint, build)
  → Người review đọc diff + phát hiện của Claude → quyết định merge
  → Trước release lớn: /claude-security quét phạm vi rủi ro
```

:::senior Góc nhìn senior
Đo hiệu quả review AI như đo một công cụ: theo dõi tỉ lệ phát hiện **đúng** / **báo nhầm** trong vài tuần, chỉnh `REVIEW.md` để giảm báo nhầm, và đừng giảm tiêu chuẩn review của người vì "đã có AI review". AI review tốt nhất khi nó gỡ bớt việc dò lỗi cơ học để người review dành thời gian cho thiết kế và rủi ro nghiệp vụ.
:::

:::quiz Dịch vụ Code Review trên GitHub báo "Code review found no issues". Điều này có nghĩa?
- [ ] PR an toàn để merge
- [x] Không có phát hiện ở mức review đó — không đảm bảo code không lỗi hay an toàn; người vẫn phải review và quyết định merge
- [ ] PR đã được tự động approve
- [ ] CI đã pass

Review không bao giờ approve hay chặn PR.
:::

:::quiz Bạn muốn Code Review coi việc ghi số CCCD ra console là mức nghiêm trọng và bỏ qua code sinh từ OpenAPI. Đặt ở đâu?
- [ ] `.claude/settings.json`
- [x] `REVIEW.md` ở gốc repo
- [ ] Một hook PostToolUse
- [ ] `package.json`

`REVIEW.md` là chỉ dẫn riêng cho review; quy tắc chung của dự án vẫn ở CLAUDE.md.
:::

:::exercise Thiết kế tầng review cho dự án của bạn
Viết: (1) `REVIEW.md` 15–25 dòng cho dự án Angular của bạn (định nghĩa mức nghiêm trọng theo nghiệp vụ, thứ bỏ qua, kiểm tra thêm); (2) quy trình 5 bước từ commit tới merge, ghi rõ lớp nào chạy ở bước nào và ai quyết định. Nếu team chưa có gói Team/Enterprise, thay dịch vụ Code Review bằng workflow GitHub Actions của Lab 10.
???
Gợi ý nội dung mức nghiêm trọng cho dự án chính phủ/ngân hàng: lộ dữ liệu cá nhân, bỏ qua kiểm tra quyền, dùng `bypassSecurityTrust*` không có lý do, thay đổi cấu hình môi trường production, xoá log audit. Bỏ qua: code sinh ra, file mock, format. Quy trình: (1) security guidance khi viết; (2) `/code-review` + `/security-review` trước push; (3) PR → review tự động + CI bắt buộc; (4) người review duyệt (branch protection yêu cầu ≥ 1 approve); (5) trước release: `/claude-security` quét lớp auth/API, patch đi qua PR riêng.
:::

> Nguồn: *Code Review*, *Customize Code Review*, *Review locally with /code-review*, *Catch security issues as Claude writes code*, *Scan your codebase for vulnerabilities* — code.claude.com/docs (truy cập 12/11/2026).
