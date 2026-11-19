---
title: "Bài 18 — Bảo mật AI Agent bằng biên nhận mật mã (cryptographic receipts)"
summary: "Audit trail mà kiểm toán viên kiểm được mà không phải tin bạn: receipt JSON ký Ed25519 trên JSON chuẩn hoá (RFC 8785), xác minh offline bằng khoá đã ghim, phát hiện sửa và ký lại, chuỗi hash, receipt chứng minh và không chứng minh điều gì, chữ ký người duyệt, checklist production."
type: lesson
level: advanced
lastReviewed: 2026-11-19
tags: [ai-agents, security, audit, ed25519, receipts, compliance]
related: [ai-agents/course/cong-cu-tri-thuc/xay-agent-dang-tin-cay, ai-agents/course/nang-cao/browser-use, claude-code/deep-dive/automation/bao-mat-va-quy-dinh-team]
changelog:
  - date: 2026-11-17
    note: Bổ sung phần đọc notebook từng bước, file phụ của bài và tài liệu tham khảo.
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 18 Securing AI Agents](https://github.com/microsoft/ai-agents-for-beginners/tree/main/18-securing-ai-agents) (Microsoft, MIT License), gồm knowledge check và bài thực hành gốc. Bản gốc dùng PyNaCl và gói `jcs`. Lời giải bài tập ở đây viết lại bằng thư viện `cryptography` (Ed25519), dùng `json.dumps(sort_keys=True)` thay cho JCS, và **đã chạy thử** bằng Python 3. Cách chuẩn hoá này chỉ khớp RFC 8785 với payload gồm chuỗi, số nguyên, bool, null; production hãy dùng thư viện JCS thật.
:::

**Bài này gồm:**
- vì sao audit trail của agent quan trọng cho tuân thủ, debug và niềm tin;
- receipt mật mã là gì, khác dòng log không ký thế nào;
- tạo receipt có chữ ký cho một tool call bằng Python thuần;
- xác minh offline và phát hiện bị sửa;
- nối chuỗi receipt để xoá hay đảo thứ tự là lộ;
- receipt **chứng minh** gì và **không** chứng minh gì.

## Vấn đề: audit trail của agent

Bạn deploy agent cho Contoso Travel: đọc yêu cầu, gọi API chuyến bay, đặt chỗ thay khách. Quý trước agent xử lý 50.000 lượt đặt. Hôm nay kiểm toán viên tới hỏi: *"Cho tôi xem agent đã làm gì."* Bạn đưa file log. Họ hỏi câu khó hơn: ***"Làm sao tôi biết log này chưa bị sửa?"***

Phần lớn hệ agent hiện dựa vào:
- **log ứng dụng:** agent tự ghi, ai có quyền filesystem cũng sửa được;
- **dịch vụ log trên cloud:** chống sửa ở tầng nền tảng, nhưng chỉ khi kiểm toán viên tin nhà vận hành nền tảng;
- **transaction log của database:** hợp với thay đổi database, không hợp với tool call tuỳ ý.

Không cách nào trả lời câu hỏi kia mà không bắt kiểm toán viên **tin một ai đó** (bạn, cloud provider, hãng database). Dùng nội bộ thì thường chấp nhận được. Với workload bị quản lý (tài chính, y tế, những gì chịu EU AI Act) thì **không**.

Receipt mật mã thu hẹp vấn đề bằng cách làm một tuyên bố có chữ ký **kiểm chứng độc lập được**. Kiểm toán viên vẫn cần một lý do *ngoài băng* để tin khoá ký và thành phần tạo ra tuyên bố. Một khoá nhúng sẵn trong receipt chỉ chứng minh receipt **tự nhất quán**, không chứng minh danh tính người phát hành.

## Receipt mật mã là gì?

Một **object JSON ghi lại agent đã làm gì, kèm chữ ký số**:

```text
Agent gọi tool ──► dựng payload ──► chuẩn hoá JSON (RFC 8785) ──► ký Ed25519 ──► receipt có chữ ký ──► kiểm toán viên xác minh offline
```

```json
{
  "type": "agent.tool_call.v1",
  "agent_id": "contoso-travel-bot",
  "tool_name": "lookup_flights",
  "tool_args_hash": "sha256:a3f9c1...",
  "result_hash": "sha256:7b2e1d...",
  "policy_id": "contoso-travel-policy-v3",
  "timestamp": "2026-04-25T14:30:00Z",
  "sequence": 47,
  "previous_receipt_hash": "sha256:9d4e6a...",
  "signature": { "alg": "EdDSA", "sig": "c5af83...", "public_key": "8f3b2c..." }
}
```

Ba thuộc tính làm nên giá trị:

1. **Chữ ký:** gateway của agent ký bằng khoá riêng **Ed25519**. Ai có khoá công khai tương ứng đều xác minh offline được. Bên tin cậy phải **ghim khoá đó**, hoặc lấy từ registry đáng tin **bên ngoài receipt**. Sửa bất kỳ trường nào đã ký thì chữ ký vô hiệu.
2. **Mã hoá chuẩn (canonical):** trước khi ký, receipt được serialize theo **JSON Canonicalization Scheme** (JCS, RFC 8785). Hai bản cài đặt tạo cùng receipt logic sẽ ra **byte giống hệt**. Không chuẩn hoá thì mỗi serializer JSON cho một chữ ký khác nhau với cùng nội dung.
3. **Nối chuỗi hash:** trường `previous_receipt_hash` nối mỗi receipt với receipt trước, nên xoá hay đảo thứ tự là đứt chuỗi. Muốn phát hiện **cắt đuôi** hay việc chính người ký viết lại, cần thêm *chain head* đã ghim, một checkpoint có bên thứ ba chứng kiến, hoặc cam kết về tập đóng đã xác thực.

Ba bảo đảm thu được:
- **gắn với một khoá:** khoá này đã ký nội dung này (gắn với tổ chức hay con người cần liên kết khoá đáng tin);
- **toàn vẹn:** nội dung không đổi từ lúc ký;
- **thứ tự trong chuỗi đã xác minh:** receipt này nối với receipt trước kia.

## Tạo receipt bằng Python

Không cần thư viện đặc biệt; logic chỉ vài chục dòng. Bản gốc (PyNaCl + `jcs`):

```python
import json, hashlib, base64
from nacl import signing
from jcs import canonicalize   # RFC 8785

def b64url_nopad(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

def sha256_canonical(obj) -> str:
    return f"sha256:{hashlib.sha256(canonicalize(obj)).hexdigest()}"

signing_key = signing.SigningKey.generate()          # production: để trong key vault
verify_key = signing_key.verify_key
TRUSTED_PUBLIC_KEYS = {b64url_nopad(bytes(verify_key))}   # bên xác minh ghim ngoài băng

tool_args = {"origin": "SYD", "destination": "LAX"}
tool_result = [{"flight": "QF11", "price": 1850, "stops": 0}]
payload = {
    "type": "agent.tool_call.v1", "agent_id": "contoso-travel-bot", "tool_name": "lookup_flights",
    "tool_args_hash": sha256_canonical(tool_args), "result_hash": sha256_canonical(tool_result),
    "policy_id": "contoso-travel-policy-v3", "timestamp": "2026-04-25T14:30:00Z",
    "sequence": 0, "previous_receipt_hash": None,
}
signature_bytes = signing_key.sign(canonicalize(payload)).signature   # PureEdDSA tự băm bên trong
receipt = {**payload, "signature": {"alg": "EdDSA", "sig": b64url_nopad(signature_bytes),
                                    "public_key": b64url_nopad(bytes(verify_key))}}
```

## Xác minh và phát hiện bị sửa

```python
def verify_receipt(receipt: dict, trusted_public_key: str) -> bool:
    # trusted_public_key lấy từ NƠI KHÁC receipt. Không bao giờ dùng receipt["signature"]["public_key"].
    # Thất bại an toàn: input hỏng trả False chứ không ném lỗi.
    if not isinstance(receipt, dict) or not isinstance(trusted_public_key, str):
        return False
    sig_obj = receipt.get("signature")
    if not isinstance(sig_obj, dict) or sig_obj.get("alg") != "EdDSA":
        return False
    try:
        payload = {k: v for k, v in receipt.items() if k != "signature"}
        verify_key = signing.VerifyKey(b64url_decode(trusted_public_key))
        verify_key.verify(canonicalize(payload), b64url_decode(sig_obj["sig"]))
        return True
    except Exception:
        return False
```

Bản gốc dùng `b64url_decode` **nghiêm ngặt**: decode rồi encode lại, so với chuỗi gốc, chỉ chấp nhận đúng một dạng base64url không padding. Lý do: bộ decode của Python bỏ qua ký tự lạ, chấp nhận padding và bảng chữ `+/`.

Không gọi mạng, không cần dịch vụ xác minh. Có khoá của bên phát hành là xác minh **hoàn toàn local, offline**. Notebook minh hoạ bốn bước:
1. tạo receipt hợp lệ và xác minh đạt;
2. sửa một byte trường `tool_args_hash`;
3. xác minh lại, và nó **thất bại**;
4. sửa tiếp, nhưng lần này **ký lại bằng khoá do kẻ tấn công tạo** và nhúng khoá đó vào receipt.

Bước 4 đáng ngẫm nhất. Receipt đó **tự nhất quán**: chữ ký thật với nội dung và với khoá nó mang, nên xác minh đạt khi dùng khoá bên trong. Nó chỉ trượt khi kiểm bằng **khoá thật của bên phát hành**. Object `signature` nằm *ngoài* phần byte được ký, nên khoá dùng để xác minh phải đến từ nơi khác receipt.

## Nối chuỗi receipt cho agent nhiều bước

Một receipt bảo vệ một hành động; một **chuỗi** bảo vệ một trình tự. Mỗi receipt ghi hash của receipt trước. Muốn lặng lẽ xoá receipt 2, kẻ tấn công phải:
- sửa `previous_receipt_hash` của receipt 3, nhưng làm vậy hỏng chữ ký receipt 3; **hoặc**
- ký lại receipt 3 đã sửa, việc này cần **khoá riêng của agent**.

Nếu khoá riêng nằm trong key vault phần cứng, và bên xác minh kiểm mọi receipt bằng khoá công khai lấy độc lập (JWK Set đã công bố hoặc giá trị cấu hình đã ghim), thì không cách nào ở trên qua được mà không bị phát hiện.

## Receipt chứng minh gì, và KHÔNG chứng minh gì

Đây là phần quan trọng nhất của bài.

**Chứng minh:**
1. **Gắn với khoá:** một khoá cụ thể đã ký một payload cụ thể.
2. **Toàn vẹn:** payload không đổi từ lúc ký.
3. **Thứ tự trong một chuỗi được trình ra và đã xác minh.**

**KHÔNG chứng minh:**
1. **Đúng đắn:** hành động có phải hành động đúng không. Câu trả lời sai cũng được ký "sạch" y như câu đúng.
2. **Tuân thủ chính sách:** chính sách ghi trong `policy_id` có thật sự được đánh giá, hay có cho phép hành động này không. Receipt ghi điều được **tuyên bố**, không phải điều được **thực thi**.
3. **Danh tính ngoài khoá:** receipt nói "khoá này ký nội dung này", không nói "người này đã cho phép". Nối khoá với người hay tổ chức cần hạ tầng danh tính riêng.
4. **Input là thật:** agent nhận prompt bị thao túng rồi hành động, thì receipt ghi lại hành động đó một cách trung thực. Receipt nằm **sau** validate input, không thay thế nó (Bài 6).
5. **Đã thực thi hay tác động thật:** receipt sau lời gọi ghi điều bên phát hành *tuyên bố* đã xảy ra. Chứng minh việc được chấp nhận hay đối soát tác động bên ngoài cần bằng chứng từ chính bên thực thi.
6. **Đầy đủ:** thiếu một receipt có thể là bị chặn, bị bỏ sót, bị mất, hoặc chưa instrument. Sự vắng mặt chỉ thành bằng chứng trong một tập đóng đã xác thực.
7. **Thời gian đáng tin:** timestamp có ký chỉ chứng minh người ký đã ghi giá trị đó, không chứng minh nó đúng. Cần cơ quan thời gian riêng hoặc checkpoint có chứng kiến.

**Khoá trong receipt không phải khoá để xác minh.** Trường `public_key` trong ví dụ chỉ để ví dụ tự đủ. Bên xác minh **không bao giờ được tin nó**. Ai cũng có thể lấy receipt, sửa, ký bằng khoá tự tạo, nhúng khoá đó, và kết quả xác minh hoàn hảo *với chính nó*. Đó là lý do `verify_receipt` nhận khoá như một tham số.

Sai lầm hay gặp: nghĩ "có receipt" nghĩa là "đã được quản trị". **Không phải.** Receipt là nền móng; quản trị là hệ thống bạn xây trên nó.

## Gắn chữ ký người duyệt vào đúng hành động

Vì receipt hành động không bao giờ nói "con người đã cho phép", với hành động rủi ro cao (hoàn tiền, xoá, chuyển khoản) có thể thêm **chữ ký người duyệt** gắn với **đúng** hành động. Notebook `human-authorization-receipts.ipynb` thêm loại receipt `human.approval.v1`:
- **khoá người duyệt** ký toàn bộ hành động dạng chuẩn hoá và digest của nó;
- **khoá agent** ký một tuyên bố mang **cùng digest** và một `parent_approval_ref` (hash của receipt duyệt);
- một hàm `verify_chain` kiểm cả hai với **hai registry khoá ghim tách biệt**: code chung, nhưng thẩm quyền không bao giờ chung.

Điều thu được, phát biểu cẩn thận: *khoá người duyệt đã ghim đã ký đúng hành động này, và khoá agent sau đó ký một tuyên bố mang cùng digest.* Đó là bằng chứng hữu ích, nhưng **chưa chứng minh hành động đã thực thi**.

Muốn kiểm soát thực thi:
- approval phải được **giữ chỗ và tiêu thụ đúng một lần** tại ranh giới bên thực thi;
- kết quả không rõ từ provider phải được ghi là "không rõ", không tự retry mù.

Các fixture từ chối của notebook kiểm:
- sửa đổi, confused deputy, khoá giả ở cả hai phía, input hỏng;
- **thẩm quyền đã cũ:** chữ ký vẫn đúng nhưng chính sách đã đổi version, khoá người duyệt đã bị xoay ra khỏi registry, hoặc approval hết hạn;
- **tráo digest:** receipt hành động ký hợp lệ trỏ tới một approval *có thật* nhưng gắn với hành động *khác*.

## Production

Hai lựa chọn: tự xây trên primitive (PyNaCl và `jcs` là thư viện được bảo trì, đã audit), hoặc dùng thư viện receipt có sẵn với xoay khoá, xác minh hàng loạt, phân phối JWK Set. Bản gốc liệt kê:
- IETF Internet-Draft `draft-farley-acta-signed-receipts`; receipt "phẳng" của bài khác envelope của draft;
- Microsoft Agent Governance Toolkit (Tutorial 33, kết hợp chính sách Cedar);
- `protect-mcp` và `@veritasacta/verify` trên npm, để bọc MCP server bằng audit trail chống sửa;
- SDK Python `nobulex`;
- EMILIA Protocol.

Giống chọn tự viết JWT hay dùng thư viện: thư viện tiết kiệm thời gian và giảm bề mặt audit; tự viết buộc bạn hiểu mọi primitive.

**Checklist production:**
- [ ] **Đưa khoá ký khỏi laptop dev:** Azure Key Vault, AWS KMS hoặc HSM. Khoá riêng không bao giờ nằm trong source control hay ở dạng plaintext trên máy ứng dụng.
- [ ] **Thiết lập niềm tin khoá cho bên xác minh:** công bố khoá qua JWK Set hoặc registry; bên tin cậy ghim danh tính bên phát hành, bộ khoá và chính sách xoay khoá **ngoài** từng receipt.
- [ ] **Neo chuỗi ra ngoài:** định kỳ ghi hash chain head vào transparency log (Sigstore Rekor, RFC 3161 timestamp authority, hoặc hệ nội bộ thứ hai).
- [ ] **Lưu receipt bất biến:** blob storage append-only (Azure Storage immutability policy, S3 Object Lock).
- [ ] **Quyết định thời gian lưu:** mỗi receipt khoảng 500 byte; agent 10.000 lời gọi mỗi ngày tạo khoảng 1,8 GB mỗi năm.
- [ ] **Ghi rõ receipt không bao phủ gì:** runbook liệt kê các lớp còn lại: validate input, thực thi chính sách, rate limit, hạ tầng danh tính.

**Đi xa hơn:**
- *selective disclosure:* Merkle tree kiểu RFC 6962, để lộ từng trường cho từng kiểm toán viên;
- *thu hồi receipt* khi lộ khoá;
- *receipt hai chữ ký*: trước và sau khi thực thi;
- *payload giàu hơn*: lý do quyết định, bằng chứng, kết quả cổng duyệt;
- *conformance chéo* giữa nhiều ngôn ngữ;
- *di chuyển sang hậu lượng tử*: ML-DSA, cần định nghĩa đầy đủ profile, không chỉ đổi nhãn `alg`.

:::senior Liên hệ thực tế
Trong team dùng Claude Code, audit chủ yếu dựa vào OpenTelemetry, log và chính sách tổ chức ([bảo mật và quy định team](/claude-code/deep-dive/automation/bao-mat-va-quy-dinh-team)), tức "tin nền tảng". Receipt là bước tiếp theo khi kiểm toán viên **không được phép** tin bạn.

Câu phỏng vấn đáng chuẩn bị: *"Chữ ký số chứng minh gì và không chứng minh gì?"*. Trả lời theo đúng hai danh sách ở trên.
:::

## Đọc notebook từng bước

### `18-signed-receipts.ipynb`: bốn phần thực hành

**Cài đặt:** `pip install pynacl jcs` (giấy phép Apache-2.0 và MIT). Hai helper `b64url_nopad` và `sha256_canonical` giữ phần còn lại tập trung vào logic receipt.

**Phần 1: ký receipt đầu tiên.** Agent Contoso Travel vừa tra chuyến bay Sydney → Los Angeles.
1. Sinh cặp khoá Ed25519.
2. Dựng payload: ai làm, tool nào, tham số và kết quả (**dạng hash** để không lộ nội dung), chính sách nào, khi nào.
3. Chuẩn hoá bằng JCS, ký, gắn object chữ ký.
4. Xác minh: bỏ chữ ký, tính lại byte chuẩn hoá, kiểm bằng khoá công khai của bên phát hành.

Kết quả mong đợi:
- `Receipt is valid: True`;
- `Pre-hashed receipt valid: False`: một **đối chứng âm** cho quy tắc *ký thẳng byte JCS, không băm trước*;
- `Malformed receipts rejected: True`: input hỏng trả `False`, không ném lỗi.

**Phần 2: sửa receipt.**
- Đổi `policy_id`: byte chuẩn hoá đổi, chữ ký không còn khớp, xác minh ra `False`.
- Sửa riêng `public_key` trong object `signature`: **không** ảnh hưởng gì, vì object này không nằm trong phần được ký, và `verify_receipt` không đọc trường đó.
- Kẻ tấn công cẩn thận hơn **ký lại bằng khoá của chính họ**: xác minh bằng khoá trong receipt ra `True`, bằng khoá thật của bên phát hành ra `False`. Ba lệnh `assert` biến điều này thành kiểm tra tự động: cell báo lỗi nếu bản giả mạo từng xác minh được với khoá thật.

**Phần 3: chuỗi receipt.** Ba receipt nối bằng `previous_receipt_hash`. Sau đó sửa receipt **giữa** (đổi `tool_args_hash`, vd thời gian giữ chỗ dài hơn mức được duyệt):
- receipt 0 vẫn hợp lệ;
- receipt 1 **sai chữ ký**;
- receipt 2 **đứt liên kết**, vì hash trước nó tính trên receipt 1 bản gốc.

Kể cả khi kẻ tấn công ký lại receipt 1 bằng khoá của mình, chữ ký vẫn trượt với khoá thật, và liên kết ở receipt 2 vẫn lộ việc sửa.

**Phần 4: tự động ký mọi tool call.** Không nên trông vào việc mỗi người viết agent nhớ gọi `make_receipt`. Class `ReceiptedTool` bọc **bất kỳ** hàm tool nào: chạy hàm, rồi tạo receipt nối vào chuỗi.

```python
class ReceiptedTool:
    def __init__(self, name, fn, signing_key, verify_key, agent_id, policy_id):
        self.name, self.fn, self.receipts = name, fn, []
        ...
    def __call__(self, *args, **kwargs):
        result = self.fn(*args, **kwargs)
        previous_hash = receipt_hash(self.receipts[-1]) if self.receipts else None
        receipt = make_receipt(tool_name=self.name, tool_args={"args": list(args), "kwargs": kwargs},
                               tool_result=result, sequence=len(self.receipts),
                               previous_receipt_hash=previous_hash, ...)
        self.receipts.append(receipt)
        return result

receipted_lookup = ReceiptedTool(name="lookup_flights", fn=mock_lookup_flights, ...)
receipted_lookup(origin="SYD", destination="LAX", departure_date="2026-06-15")
```

Với Microsoft Agent Framework, bạn đăng ký hàm đã bọc làm tool cho `FoundryChatClient`. Notebook ghi phần này dưới dạng pseudocode.

:::tip Lần gọi lỗi không để lại dấu vết
`ReceiptedTool` chỉ ký **sau khi hàm chạy thành công**. Mình chép lại class này (dùng `cryptography`), gọi 3 lần, trong đó lần 2 ném `ValueError`:

```text
lỗi: unknown airport
số receipt: 2 | chuỗi: OK
```

Chuỗi vẫn "OK", nhưng **không có dấu vết** của lần gọi thất bại. Đây đúng là điểm 6 trong danh sách "không chứng minh": sự vắng mặt của receipt không phải bằng chứng. Muốn đầy đủ hơn, hãy ký cả receipt *thất bại* (`result_hash` là hash của thông tin lỗi, thêm trường `outcome: "error"`), hoặc tách receipt *trước* và *sau* khi thực thi.
:::

**Thử thách mở rộng:** thêm trường `request_id` (UUID để truy vết phân tán), ký, xác minh, rồi sửa trường đó và thấy thất bại.

**File kèm theo:**
- `sample_receipts/`: bốn fixture `01_valid_receipt.json`, `02_tampered_receipt.json`, `03_chain_three_receipts.json`, `04_resigned_receipt.json` (bản ký lại bằng khoá kẻ tấn công), cùng script `generate_fixtures.py` sinh chúng;
- `test_signed_receipts.py`: test tự động;
- `18-signed-receipts.execution-receipt.json`: ghi hash notebook, môi trường Python, số cell và các kiểm tra của lần chạy sạch gần nhất.

### `human-authorization-receipts.ipynb`: gắn chữ ký người duyệt vào đúng hành động

Notebook kiểm tra hai tuyên bố có chữ ký:
- một khoá **người duyệt** đã ghim ký một hành động chính xác;
- một khoá **agent** đã ghim ký một tuyên bố mang cùng hành động đó.

Nó **không** gọi provider, **không** tiêu thụ approval, **không** chứng minh việc thực thi. Khoá sinh ra chỉ đóng vai khoá đã đăng ký riêng; notebook không làm WebAuthn, không chứng minh có người thật ngồi trước máy.

- **Hành động chuẩn hoá** là đơn vị được duyệt. Đó là một object đầy đủ (vd `action_type: "refund.issue"`, số tiền, đơn hàng…) và digest của nó, chứ không phải nhãn mơ hồ như "duyệt hoàn tiền". Object và digest cho phép kiểm tra khoá người duyệt đã ký *hành động nào*, nhưng không cho biết người đó đã *thấy* hay *hiểu* gì.
- **Một envelope, hai thẩm quyền:**
  - *approval receipt*: khoá người duyệt ký toàn bộ hành động, digest, version chính sách, thời điểm cấp và hết hạn;
  - *agent receipt*: khoá agent ký cùng digest, kết quả tuyên bố, thời điểm, và `parent_approval_ref` (hash của approval).
- **`verify_chain` chỉ đọc:** kiểm hai chữ ký, gắn kết hành động chuẩn hoá, độ mới của chính sách và khoá, hạn dùng. Kết quả so với hành động và **thời điểm xác minh được truyền vào** (ví dụ dùng `NOW = "2026-07-08T15:05:00Z"`).
- **Các ca bị từ chối**, mỗi ca một lý do riêng: sửa đổi, tráo digest, chữ ký giả ở từng phía, receipt hỏng, chính sách hay khoá đã cũ, approval hết hạn. Xác minh lại nhiều lần cho cùng kết quả. Nhưng **xác minh lặp lại được không phải chống replay**: bên thực thi phải tự từ chối lần gửi trùng.

**Kết luận của notebook.**
- *Chứng minh được:* với khoá và chính sách đã ghim, khoá người duyệt đã ký đúng hành động chuẩn hoá này, và khoá agent đã ký một tuyên bố khớp, gắn với approval đó.
- *Không chứng minh:* có người thật thấy và duyệt, khoá được bảo vệ an toàn, timestamp đáng tin, hay provider đã thực thi. Kết quả chỉ là **tuyên bố do agent ký**, không phải xác nhận của provider.

## Tài liệu tham khảo (theo bản gốc)

- IETF Internet-Draft *Signed Decision Receipts for Machine-to-Machine Access Control*: <https://datatracker.ietf.org/doc/draft-farley-acta-signed-receipts/>
- RFC 8032, Ed25519: <https://www.rfc-editor.org/rfc/rfc8032>
- RFC 8785, JSON Canonicalization Scheme: <https://www.rfc-editor.org/rfc/rfc8785>
- RFC 6962, Certificate Transparency (Merkle tree): <https://www.rfc-editor.org/rfc/rfc6962>
- Bộ test vector chung: <https://github.com/ScopeBlind/agent-governance-testvectors>
- PyNaCl: <https://pynacl.readthedocs.io/>

:::quiz (Knowledge check 1) Kiểm toán viên chỉ có khoá công khai. Họ có xác minh receipt offline được không?
- [x] Được: xác minh chỉ cần khoá công khai và phần byte đã ký; nhưng khoá phải được lấy và ghim độc lập với receipt
- [ ] Không, phải gọi dịch vụ xác minh của bên phát hành
- [ ] Không, cần cả khoá riêng
- [ ] Được, dùng luôn `public_key` nằm trong receipt

Sau khi đã thiết lập niềm tin khoá, không cần gọi mạng. Dùng khoá công khai nhúng sẵn trong receipt để tự xác minh là sai lầm: kẻ giả mạo có thể ký bằng khoá của chính họ rồi nhúng khoá đó vào.
:::

:::quiz (Knowledge check 3) Vì sao receipt chứa `tool_args_hash` và `result_hash` thay vì nguyên văn tham số và kết quả? (chọn nhiều)
- [x] Để không lộ nội dung (PII, dữ liệu kinh doanh) khi lưu trữ hay truyền receipt; kiểm toán viên so hash với bản lưu riêng
- [x] Để receipt có kích thước cố định, nhỏ, bất kể input và output lớn đến đâu
- [ ] Vì Ed25519 chỉ ký được chuỗi hash
- [ ] Để model đọc nhanh hơn

Hash vừa bảo vệ riêng tư vừa giữ receipt gọn (khoảng 500 byte).
:::

:::quiz (Knowledge check 5) Một receipt xác minh hợp lệ. Nó chứng minh hành động của agent là đúng và tuân thủ chính sách không?
- [ ] Có, vì chữ ký hợp lệ
- [ ] Có, nếu `policy_id` khớp chính sách hiện tại
- [x] Không; nó chỉ chứng minh gắn với khoá, toàn vẹn và liên kết với receipt trước. Không chứng minh đúng đắn, đã thực thi, chính sách đã được đánh giá, timestamp đáng tin hay tập bản ghi đầy đủ
- [ ] Không, receipt không chứng minh gì cả

Đây là ranh giới quan trọng nhất của bài: receipt là nền móng, không phải quản trị.
:::

:::exercise (Bài thực hành gốc, mục 1–3) Ký, sửa, ký giả và nối chuỗi receipt
Dùng `cryptography` (Ed25519) và `json.dumps(sort_keys=True, separators=(",", ":"))` làm bản chuẩn hoá đơn giản:
1. viết `sign_receipt(key, payload)` và `verify_receipt(receipt, trusted_public_key)` (thất bại an toàn, trả False);
2. sửa `policy_id` rồi xác minh lại;
3. **ký lại** receipt đã sửa bằng khoá của kẻ tấn công, xác minh bằng (a) khoá trong receipt và (b) khoá đã ghim;
4. tạo chuỗi 3 receipt có `sequence` và `previous_receipt_hash`; viết `verify_chain`; thử xoá phần tử giữa, đảo thứ tự, và cắt đuôi.
???
```python
import base64, hashlib, json
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

def canonicalize(obj) -> bytes:   # gần đúng RFC 8785 cho chuỗi, số nguyên, bool, null
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()

b64u = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")
b64u_dec = lambda s: base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
sha256_canonical = lambda o: "sha256:" + hashlib.sha256(canonicalize(o)).hexdigest()
pub_b64 = lambda k: b64u(k.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw))

def sign_receipt(key, payload):
    return {**payload, "signature": {"alg": "EdDSA", "sig": b64u(key.sign(canonicalize(payload))),
                                     "public_key": pub_b64(key)}}

def verify_receipt(receipt, trusted_public_key):
    try:
        sig = receipt["signature"]
        if sig.get("alg") != "EdDSA":
            return False
        payload = {k: v for k, v in receipt.items() if k != "signature"}
        Ed25519PublicKey.from_public_bytes(b64u_dec(trusted_public_key)).verify(
            b64u_dec(sig["sig"]), canonicalize(payload))
        return True
    except (InvalidSignature, KeyError, ValueError, TypeError, AttributeError):
        return False

def verify_chain(chain, trusted_key):
    prev = None
    for i, r in enumerate(chain):
        if not verify_receipt(r, trusted_key):
            return f"chữ ký sai ở vị trí {i}"
        if r["sequence"] != i:
            return f"sequence lệch ở vị trí {i} (có {r['sequence']})"
        if r["previous_receipt_hash"] != prev:
            return f"đứt chuỗi ở vị trí {i}"
        prev = sha256_canonical(r)
    return "OK"
```

Kết quả khi chạy (khoá sinh ngẫu nhiên mỗi lần, nên kết quả True/False không đổi):

```text
1 hợp lệ: True
2 sửa policy_id: False
3 ký lại bằng khoá kẻ tấn công, kiểm bằng khoá trong receipt: True    ← tự nhất quán!
3 … kiểm bằng khoá đã ghim: False
4 chuỗi gốc: OK
4 xoá phần tử giữa: sequence lệch ở vị trí 1 (có 2)
4 đảo thứ tự: sequence lệch ở vị trí 0 (có 1)
4 cắt đuôi: OK   ← cần chain head đã ghim mới phát hiện
```

Dòng cuối minh hoạ đúng điều bản gốc cảnh báo: chuỗi hash phát hiện xoá giữa và đảo thứ tự, nhưng **cắt bớt receipt cuối** thì vẫn "OK". Cần neo chain head ra ngoài (transparency log) mới bắt được.

*Thử thách mở rộng của bản gốc:*
- thêm trường `request_id`, xác nhận receipt vẫn xác minh được, sửa trường đó và thấy thất bại;
- băm chuẩn hoá hai receipt rồi nhúng digest vào receipt thứ ba, tạo một "inclusion proof" một bước.
:::

**Bài trước:** [Bài 17](/ai-agents/course/nang-cao/agent-chay-local) · **Phụ lục:** [Code mẫu .NET (C#)](/ai-agents/course/nang-cao/phu-luc-dotnet) · Bạn đã hoàn thành khóa học. Xem [lộ trình](/ai-agents/roadmap) để ôn lại theo chặng.
