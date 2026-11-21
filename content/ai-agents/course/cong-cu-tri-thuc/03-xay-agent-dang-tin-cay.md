---
title: "Bài 6 — Xây AI Agent đáng tin cậy: system message framework, mối đe doạ và human-in-the-loop"
summary: "An toàn là agent làm đúng như thiết kế. System message framework bốn bước, năm mối đe doạ (đổi chỉ dẫn, truy cập hệ thống nhạy cảm, quá tải, đầu độc knowledge base, lỗi lan truyền) kèm cách giảm thiểu, và cổng duyệt human-in-the-loop theo mức rủi ro."
type: lesson
level: intermediate
lastReviewed: 2026-11-19
tags: [ai-agents, safety, security, system-prompt, human-in-the-loop]
related: [ai-agents/course/nen-tang/nguyen-tac-thiet-ke-agent, ai-agents/course/nang-cao/bao-mat-ai-agent, claude-code/deep-dive/guardrails/sandbox-va-prompt-injection]
changelog:
  - date: 2026-11-17
    note: Bổ sung phần đọc notebook từng bước, file phụ của bài và tài liệu tham khảo.
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 06 Building Trustworthy Agents](https://github.com/microsoft/ai-agents-for-beginners/tree/main/06-building-trustworthy-agents) (Microsoft, MIT License). Hàm `classify_risk` trong bài lấy từ notebook `06-human-in-the-loop.ipynb` và **đã chạy thử** bằng Python.
:::

**Bài này gồm:** cách xây và deploy agent an toàn, hiệu quả; các lưu ý bảo mật quan trọng; cách giữ quyền riêng tư dữ liệu và người dùng.

## An toàn (Safety)

*An toàn* nghĩa là agent hoạt động **đúng như thiết kế**. Người xây ứng dụng agentic có phương pháp và công cụ để tối đa hoá điều đó.

### System message framework

Ai từng xây app LLM đều biết system prompt (system message) quan trọng thế nào: nó đặt luật chung, chỉ dẫn và nguyên tắc cho cách LLM tương tác với người dùng và dữ liệu. Với agent, system prompt còn quan trọng hơn, vì agent cần chỉ dẫn rất cụ thể để hoàn thành task được giao.

Để tạo system prompt **mở rộng được** cho một hay nhiều agent, dùng framework bốn bước:

**Bước 1: Meta system message.** LLM dùng prompt này để *sinh* system prompt cho các agent. Thiết kế nó như một template để tạo nhiều agent hiệu quả.

```text
You are an expert at creating AI agent assistants.
You will be provided a company name, role, responsibilities and other
information that you will use to provide a system prompt for.
To create the system prompt, be descriptive as possible and provide a structure that a system using an LLM can better understand the role and responsibilities of the AI assistant.
```

**Bước 2: Prompt cơ bản** mô tả agent: vai trò, các task, trách nhiệm khác.

```text
You are a travel agent for Contoso Travel that is great at booking flights for customers. To help customers you can perform the following tasks: lookup available flights, book flights, ask for preferences in seating and times for flights, cancel any previously booked flights and alert customers on any delays or cancellations of flights.
```

**Bước 3: Đưa cho LLM.** Đặt meta system message làm system message, prompt cơ bản làm input. Kết quả là system message có cấu trúc tốt hơn hẳn. Rút gọn:

```markdown
**Company Name:** Contoso Travel
**Role:** Travel Agent Assistant

**Objective:** You are an AI-powered travel agent assistant for Contoso Travel, specializing in booking flights...

**Key Responsibilities:**
1. **Flight Lookup:** search flights by destination, dates, preferences; list times, airlines, layovers, pricing.
2. **Flight Booking:** book with correct details; confirm itinerary and confirmation numbers.
3. **Customer Preference Inquiry:** ask about seating (aisle, window, extra legroom) and preferred times; record for future.
4. **Flight Cancellation:** cancel per company policy; explain refunds or extra steps.
5. **Flight Monitoring:** alert in real time about delays, cancellations, changes via email or SMS.

**Tone and Style:** friendly, professional, approachable; clear and tailored.
**User Interaction Instructions:** respond promptly and accurately; conversational yet professional; empathetic and proactive.
**Additional Notes:** stay updated on airline policies and travel restrictions; avoid jargon.
```

**Bước 4: Lặp và cải thiện.** Giá trị của framework là:
- tạo system message cho nhiều agent dễ hơn;
- cải thiện chúng dần theo thời gian.

Hiếm khi system message đúng ngay lần đầu cho toàn bộ use case. Sửa nhỏ prompt cơ bản rồi chạy lại qua hệ thống giúp bạn **so sánh và đánh giá** kết quả.

:::tip Liên hệ với Claude Code
Đây chính là cách bạn nên viết `CLAUDE.md` hay mô tả subagent: bắt đầu từ bản ngắn, nhờ model mở rộng thành cấu trúc rõ ràng, rồi lặp dựa trên hành vi quan sát được.
:::

## Hiểu các mối đe doạ

| Mối đe doạ | Mô tả | Giảm thiểu |
|---|---|---|
| **Task và chỉ dẫn** | Kẻ tấn công cố đổi chỉ dẫn hoặc mục tiêu của agent qua prompt hoặc input bị thao túng. | Validate và lọc input để phát hiện prompt nguy hiểm trước khi agent xử lý. Kiểu tấn công này thường cần tương tác nhiều lần, nên **giới hạn số lượt hội thoại** cũng giúp chặn. |
| **Truy cập hệ thống quan trọng** | Agent có quyền vào hệ thống chứa dữ liệu nhạy cảm; kẻ tấn công xâm phạm kênh giữa agent và dịch vụ, trực tiếp hoặc gián tiếp moi thông tin qua agent. | Cấp quyền **theo nhu cầu tối thiểu**. Kênh giao tiếp phải an toàn. Áp dụng xác thực và kiểm soát truy cập. |
| **Quá tải tài nguyên và dịch vụ** | Lợi dụng việc agent gọi tool để dồn lượng lớn request vào dịch vụ, gây sập hệ thống hoặc chi phí cao. | Chính sách **giới hạn số request** agent được gửi tới mỗi dịch vụ. Giới hạn số lượt và request tới chính agent. |
| **Đầu độc knowledge base** | Không tấn công agent mà tấn công knowledge base và dịch vụ agent dùng: làm sai dữ liệu, dẫn tới câu trả lời thiên lệch hoặc sai. | **Kiểm định định kỳ** dữ liệu agent dùng. Bảo vệ quyền truy cập; chỉ người tin cậy được sửa. |
| **Lỗi lan truyền (cascading errors)** | Lỗi do kẻ tấn công gây ra làm hỏng các hệ thống khác nối với agent; tấn công lan rộng, khó truy vết. | Cho agent chạy trong **môi trường giới hạn**, vd container Docker. Có **fallback và retry** khi một hệ thống báo lỗi. |

## Human-in-the-loop

Một cách hiệu quả khác là **đưa con người vào vòng lặp**: người dùng có thể phản hồi cho agent ngay khi agent đang chạy. Về bản chất, người dùng đóng vai một agent trong hệ multi-agent, có quyền **duyệt hoặc dừng** tiến trình.

```python
provider = FoundryChatClient(
    project_endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    credential=AzureCliCredential(),
)
response = provider.create_response(
    input="Write a 4-line poem about the ocean.",
    instructions="You are a helpful assistant. Ask for user approval before finalizing.",
)
print(response.output_text)
user_input = input("Do you approve? (APPROVE/REJECT): ")
if user_input == "APPROVE":
    print("Response approved.")
else:
    print("Response rejected. Revising...")
```

### Cổng duyệt trước hành động, theo mức rủi ro

Notebook [`06-human-in-the-loop.ipynb`](https://github.com/microsoft/ai-agents-for-beginners/blob/main/06-building-trustworthy-agents/code_samples/06-human-in-the-loop.ipynb) đi xa hơn: **phân loại rủi ro** trước mỗi hành động, ghi **audit log**, và chỉ chặn chờ người duyệt với hành động rủi ro cao.

```python
LOW_RISK_KEYWORDS = {"look", "lookup", "search", "fetch", "read", "query", "view", "get", "list", "weather", "summarize"}
HIGH_RISK_KEYWORDS = {"send", "email", "post", "publish", "charge", "pay", "transfer", "delete", "drop", "cancel", "refund"}
MEDIUM_RISK_KEYWORDS = {"cache", "schedule", "reminder", "book", "reserve", "update", "increment", "log"}

def classify_risk(action: str) -> str:
    text = action.lower()
    if any(kw in text for kw in HIGH_RISK_KEYWORDS):   # xét mức nặng nhất trước
        return "high"
    if any(kw in text for kw in LOW_RISK_KEYWORDS):
        return "low"
    if any(kw in text for kw in MEDIUM_RISK_KEYWORDS):
        return "medium"
    return "medium"   # không nhận ra → medium (vào hàng chờ review), KHÔNG phải low

def tiered_gate(action: str, attempt: int = 0) -> dict:
    tier = classify_risk(action)
    if tier in ("low", "medium"):
        return {"decision": "approve", "risk_tier": tier}   # medium: duyệt gộp sau
    return gate_action(action, tier, attempt=attempt)       # high: chặn, hỏi người
```

Các quyết định đáng chú ý trong thiết kế:
- **Mặc định an toàn:** người duyệt không nhập gì, hoặc nhập sai, thì là `deny`.
- **Hành động lạ vào `medium`**, không phải `low`: danh sách từ khoá "chỉ đọc" luôn có điểm mù.
- Mỗi quyết định được ghi vào file JSONL để audit.

Mình chạy thử `classify_risk`:

```text
Look up refund policy      -> high     ("refund" xét trước "look")
Update weather cache       -> low      ("weather" nằm trong nhóm low)
Generate PDF report        -> medium   (không khớp gì → mặc định)
Read customer profile      -> low
Repay invoice              -> high     ("pay" là chuỗi con của "repay")
Target audience analysis   -> low      ("get" là chuỗi con của "target"!)
```

:::warning Heuristic theo chuỗi con dễ sai
"Target audience analysis" thành `low` chỉ vì chứa `get`. Với code thật:
- so theo **tên tool** (`delete_order`) chứ không theo câu mô tả;
- gán mức rủi ro **ngay trong định nghĩa tool**;
- coi từ khoá chỉ là lớp phụ.

Claude Code làm theo cách đó: permission rule viết theo tên tool và pattern lệnh.
:::

## Đọc notebook từng bước

### `06-system-message-framework.ipynb`: sinh system message bằng meta prompt

Notebook này gọi thẳng **Azure OpenAI Responses API** qua endpoint `/openai/v1/`, không qua project Foundry. Cần `AZURE_OPENAI_ENDPOINT` và `AZURE_OPENAI_DEPLOYMENT` (Bài 0).

**Cell 0–1: xác thực không dùng key.** Token lấy từ `az login` qua `get_bearer_token_provider`; OpenAI SDK nhận **hàm** cấp token thay cho API key.

```python
token_provider = get_bearer_token_provider(DefaultAzureCredential(),
                                           "https://cognitiveservices.azure.com/.default")
client = OpenAI(base_url=f"{endpoint.rstrip('/')}/openai/v1/", api_key=token_provider)
```

**Cell 2–3: bước 1–3 của framework trong một lần gọi.** Ba biến `role`, `company`, `responsibility` tạo prompt cơ bản. Meta system message đi ở vai trò `system`.

```python
role, company, responsibility = "travel agent", "contoso travel", "booking flights"
response = client.responses.create(
    model=deployment,
    input=[
        {"role": "system", "content": "You are an expert at creating AI agent assistants. ..."},
        {"role": "user", "content": f"You are {role} at {company} that is responsible for {responsibility}."},
    ],
    temperature=1.0, max_output_tokens=1000, top_p=1.0, store=False,
)
print(response.output_text)        # system message có cấu trúc, như ví dụ Contoso ở trên
```

Đổi ba biến này là có system message cho agent khác: đúng ý "mở rộng được" của framework.

### `06-human-in-the-loop.ipynb`: cổng duyệt trước hành động, phân tầng rủi ro, audit log

Đoạn `APPROVE/REJECT` trong bài hỏi người dùng **sau khi** agent đã trả lời. Bản production thường cần thêm ba thứ:

**Mẫu 1: cổng duyệt *trước* hành động (pre-action gate).**

| | Duyệt sau (đoạn code trong bài) | Cổng trước (notebook) |
|---|---|---|
| Duyệt lúc nào | Sau khi agent đã tạo output | Trước khi có tác dụng phụ |
| Chi phí LLM khi bị từ chối | Đã trả | Chỉ trả cho *đề xuất*, không cho hành động |
| Tác dụng phụ không hoàn tác được | Có thể đã xảy ra (email đã gửi) | Được chặn |
| Rõ ràng khi audit | Chỉ là một lệnh `print` | Bản ghi JSON có thời gian, hành động, lý do |

Hàm `gate_action(action, risk_tier, attempt)` trả về `approve`, `deny` hoặc `escalate`. Không có input, hoặc input sai, thì mặc định **`deny`**.

Ở `DEMO_MODE = True`, notebook chạy không cần nhập tay: hành động `high` bị từ chối ở lần 0 và **được duyệt theo kịch bản** ở lần 1, chỉ để thấy cơ chế vòng lặp. Notebook nói rõ đây **không phải** phân loại lại dựa trên bản sửa. Muốn thật thì đặt `DEMO_MODE = False` và cần người vận hành.

**Mẫu 2: phân tầng rủi ro.**

| Tầng | Ví dụ | Luồng duyệt |
|---|---|---|
| `low` (chỉ đọc) | Tìm knowledge base, tra chuyến bay, đọc trang web công khai | Tự chạy, có log |
| `medium` (thay đổi rẻ) | Cache kết quả, tăng bộ đếm, đặt lời nhắc | Tự chạy, review gộp hằng ngày |
| `high` (ra ngoài hoặc không hoàn tác) | Gửi email, trừ tiền thẻ, đăng lên kênh công khai | **Chặn chờ người duyệt** |

Bộ phân loại dùng từ khoá để demo tất định và rẻ. Ở production, thay bằng bộ phân loại học máy hoặc **policy engine**. (Mục *Cổng duyệt trước hành động* ở trên đã chạy thử hàm này và chỉ ra lỗi so chuỗi con.)

**Mẫu 3: audit log và vòng sửa đề xuất.**
- **JSONL chỉ ghi thêm:** mỗi quyết định một dòng gồm timestamp, hành động, tầng, quyết định, lý do. Dễ grep, dễ đẩy sang kho log thật. Mỗi lần chạy ghi một file có timestamp riêng, không đụng log cũ.
- **Vòng sửa khi bị từ chối:** `propose_action(goal, prior_rejection)` nhờ LLM đề xuất **một** hành động. Bị `deny` thì lý do được đưa lại vào prompt để lần sau đề xuất khác.

```python
def run_with_revision(goal: str, max_revisions: int = 2) -> dict:
    prior_reason = None
    for attempt in range(max_revisions + 1):
        action = propose_action(goal, prior_rejection=prior_reason)
        decision = tiered_gate(action, attempt=attempt)
        decision["attempt"] = attempt
        log_decision(decision)
        if decision["decision"] == "approve":
            return decision
        prior_reason = decision["reason"]
    return {**decision, "final": "max_revisions_reached"}
```

**Demo cuối:** ba mục tiêu ở ba mức rủi ro:
- xem thời tiết Seattle (thấp);
- đặt lời nhắc check-in trước 24 giờ (trung bình);
- gửi email marketing về gói nâng cấp (cao).

Sau đó in audit log. Vì tầng được tính từ **câu đề xuất do LLM viết**, kết quả mỗi lần chạy có thể khác nhau.

**Tài liệu thêm trong notebook:** ba cách hiện thực cùng ý tưởng:
- LangChain bọc thành **tool** chờ người nhập;
- AutoGen dùng **agent đại diện người** (`UserProxyAgent`);
- Microsoft Agent Framework dùng **function-invocation middleware** (Bài 14).

## Tài liệu tham khảo (theo bản gốc)

- Responsible AI overview: <https://learn.microsoft.com/azure/ai-studio/responsible-use-of-ai-overview>
- Evaluation of generative AI models and applications: <https://learn.microsoft.com/azure/ai-studio/concepts/evaluation-approach-gen-ai>
- Safety system messages: <https://learn.microsoft.com/azure/ai-services/openai/concepts/system-message>

:::quiz Theo khóa học, cách nào giúp chống tấn công đổi chỉ dẫn (task and instruction)? (chọn nhiều)
- [x] Validate và lọc input trước khi agent xử lý
- [x] Giới hạn số lượt hội thoại
- [ ] Cho agent quyền admin để tự sửa lỗi
- [ ] Tắt log để kẻ tấn công không đọc được

Tấn công kiểu này thường cần nhiều lượt tương tác, nên lọc input và giới hạn số lượt đều hiệu quả.
:::

:::quiz Với hàm `classify_risk` dưới đây, `classify_risk("Target audience analysis")` trả về gì?
```python
LOW_RISK_KEYWORDS = {"look", "lookup", "search", "fetch", "read", "query", "view", "get", "list", "weather", "summarize"}
HIGH_RISK_KEYWORDS = {"send", "email", "post", "publish", "charge", "pay", "transfer", "delete", "drop", "cancel", "refund"}
MEDIUM_RISK_KEYWORDS = {"cache", "schedule", "reminder", "book", "reserve", "update", "increment", "log"}

def classify_risk(action: str) -> str:
    text = action.lower()
    if any(kw in text for kw in HIGH_RISK_KEYWORDS):
        return "high"
    if any(kw in text for kw in LOW_RISK_KEYWORDS):
        return "low"
    if any(kw in text for kw in MEDIUM_RISK_KEYWORDS):
        return "medium"
    return "medium"
```

- [ ] `"medium"`, vì không khớp từ khoá nào
- [x] `"low"`, vì `"get"` là chuỗi con của `"target"`
- [ ] `"high"`
- [ ] Ném exception

Kiểm tra `kw in text` là so chuỗi con, nên `get` khớp trong `target`. Đã chạy thử. Đây là lý do nên phân loại theo tên tool hoặc metadata thay vì từ khoá trong câu.
:::

:::quiz Agent dùng knowledge base nội bộ bắt đầu trả lời sai lệch dù prompt và model không đổi. Mối đe doạ nào đáng nghi nhất, và cách giảm thiểu?
- [ ] Quá tải dịch vụ; thêm rate limit
- [x] Đầu độc knowledge base; kiểm định dữ liệu định kỳ và chỉ cho người tin cậy sửa
- [ ] Lỗi lan truyền; chạy trong Docker
- [ ] Đổi chỉ dẫn; giới hạn số lượt

Đầu độc knowledge base nhắm vào dữ liệu agent dùng, không nhắm vào agent, nên agent và prompt có vẻ vẫn bình thường.
:::

:::exercise Thiết kế cổng duyệt cho agent CSKH
Agent CSKH có các tool: `get_order`, `search_faq`, `update_shipping_address`, `issue_refund`, `send_email_to_customer`, `delete_account`.
1. Gán mức rủi ro (low, medium, high) **theo tên tool**, và viết `RISK_BY_TOOL`.
2. Viết `gate(tool_name, args)` theo quy tắc:
   - tool lạ là `medium`;
   - `high` cần người duyệt, mặc định `deny` khi không có phản hồi;
   - `issue_refund` trên 2.000.000 ₫ luôn `escalate`.
3. Mỗi quyết định ghi một dòng JSON gồm thời gian, tool, mức, quyết định.
???
```python
import json
from datetime import datetime, timezone

RISK_BY_TOOL = {
    "get_order": "low", "search_faq": "low",
    "update_shipping_address": "medium",
    "issue_refund": "high", "send_email_to_customer": "high", "delete_account": "high",
}

def ask_human(tool, args):          # thay bằng UI duyệt thật
    try:
        raw = input(f"Duyệt {tool} {args}? approve/deny/escalate: ").strip().lower()
    except EOFError:
        raw = ""
    return raw if raw in {"approve", "deny", "escalate"} else "deny"

def gate(tool_name, args, log_path="gate_log.jsonl"):
    tier = RISK_BY_TOOL.get(tool_name, "medium")
    if tool_name == "issue_refund" and args.get("amount", 0) > 2_000_000:
        decision = "escalate"
    elif tier == "high":
        decision = ask_human(tool_name, args)
    else:
        decision = "approve"
    entry = {"ts": datetime.now(timezone.utc).isoformat(), "tool": tool_name,
             "risk_tier": tier, "decision": decision}
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return decision
```

Tool lạ (vd `export_all_customers`) rơi vào `medium` chứ không tự chạy như `low`. Không có input (EOF) hay input sai đều thành `deny`. Ở production, `ask_human` là một màn hình duyệt (frontend) với timeout; hết hạn cũng là `deny`.
:::

**Bài trước:** [Bài 5](/ai-agents/course/cong-cu-tri-thuc/agentic-rag) · **Bài tiếp theo:** [Bài 7 — Planning design](/ai-agents/course/ke-hoach-da-agent/planning-design)
