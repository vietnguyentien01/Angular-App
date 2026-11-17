---
title: "Bài 1 — Giới thiệu AI Agent và các trường hợp nên dùng"
summary: "AI Agent là hệ thống cho LLM thực sự làm việc nhờ tool và tri thức: môi trường, sensor, actuator, tool, memory. Bảy loại agent qua ví dụ agent đặt vé du lịch, khi nào nên và không nên dùng agent, ba khối nền: phát triển agent, agentic pattern, agentic framework."
type: lesson
level: core
lastReviewed: 2026-11-17
tags: [ai-agents, llm, agent-types, microsoft-agent-framework]
related: [ai-agents/course/nen-tang/cai-dat-khoa-hoc, ai-agents/course/nen-tang/kham-pha-agent-framework, claude-code/deep-dive/principles/ben-trong-claude-code]
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 01 Intro to AI Agents](https://github.com/microsoft/ai-agents-for-beginners/tree/main/01-intro-to-ai-agents) (Microsoft, MIT License). Code mẫu cần project Microsoft Foundry (xem Bài 0).
:::

## Bài này gồm

- AI Agent là gì, và các loại agent.
- Loại việc nào hợp với AI Agent.
- Các khối xây dựng cốt lõi khi thiết kế một giải pháp agentic.

**Mục tiêu:** sau bài này bạn giải thích được agent khác gì một giải pháp AI thông thường, biết khi nào nên (và không nên) dùng agent, và phác được thiết kế agentic cơ bản cho một bài toán thật.

## AI Agent là gì?

> **AI Agent là hệ thống giúp LLM thực sự *làm việc*, bằng cách trao cho nó tool và tri thức để tác động lên thế giới, chứ không chỉ trả lời prompt.**

Phân tích từng phần:

- **Hệ thống**: agent không phải một thứ đơn lẻ mà là nhiều phần phối hợp. Cốt lõi có ba phần:
  - **Environment** (môi trường): không gian agent hoạt động. Với agent đặt vé du lịch, đó là chính nền tảng đặt vé.
  - **Sensor** (cảm biến): cách agent đọc trạng thái hiện tại của môi trường, vd kiểm tra phòng trống, giá vé máy bay.
  - **Actuator** (cơ cấu chấp hành): cách agent hành động, vd đặt phòng, gửi xác nhận, huỷ đặt chỗ.
- **Large Language Model**: agent có từ trước LLM, nhưng LLM khiến agent hiện đại mạnh mẽ. LLM hiểu ngôn ngữ tự nhiên, suy luận theo ngữ cảnh, và biến một yêu cầu mơ hồ thành kế hoạch hành động cụ thể.
- **Thực hiện hành động**: không có hệ thống agent, LLM chỉ sinh văn bản. Trong hệ thống agent, LLM *thực thi* từng bước: truy vấn database, gọi API, gửi tin nhắn.
- **Truy cập tool**: agent dùng được tool nào phụ thuộc (1) môi trường nó chạy và (2) những gì developer cho phép. Agent du lịch có thể tìm chuyến bay nhưng không sửa được hồ sơ khách hàng; tất cả tuỳ bạn nối những gì.
- **Memory + tri thức**: agent có thể có bộ nhớ ngắn hạn (cuộc hội thoại hiện tại) và dài hạn (database khách hàng, các lần tương tác trước). Vd agent du lịch "nhớ" bạn thích ghế cạnh cửa sổ.

## Các loại AI Agent

| Loại agent | Làm gì | Ví dụ agent du lịch |
|---|---|---|
| **Simple Reflex** | Theo quy tắc cứng: không memory, không lập kế hoạch. | Thấy email phàn nàn → chuyển cho chăm sóc khách hàng. Hết. |
| **Model-Based Reflex** | Giữ một mô hình nội bộ về thế giới và cập nhật khi có thay đổi. | Theo dõi lịch sử giá vé, cảnh báo tuyến bay bỗng tăng giá. |
| **Goal-Based** | Có mục tiêu và tự tìm cách đạt từng bước. | Đặt trọn chuyến (vé, xe, khách sạn) từ chỗ bạn đang ở tới điểm đến. |
| **Utility-Based** | Không chỉ tìm *một* lời giải mà tìm lời giải *tốt nhất* bằng cách cân trade-off. | Cân chi phí và sự tiện lợi để chọn chuyến điểm cao nhất theo sở thích của bạn. |
| **Learning** | Tốt dần lên nhờ học từ phản hồi. | Điều chỉnh gợi ý lần sau dựa trên khảo sát sau chuyến đi. |
| **Hierarchical** | Agent cấp cao chia việc thành task con và giao cho agent cấp dưới. | Yêu cầu "huỷ chuyến" tách thành huỷ vé bay, huỷ khách sạn, huỷ thuê xe, mỗi phần do một sub-agent làm. |
| **Multi-Agent System (MAS)** | Nhiều agent độc lập cùng làm (hoặc cạnh tranh). | Hợp tác: agent riêng cho khách sạn, chuyến bay, giải trí. Cạnh tranh: nhiều agent tranh nhau lấp phòng khách sạn với giá tốt nhất. |

## Khi nào nên dùng AI Agent

Bạn *có thể* dùng agent không có nghĩa lúc nào cũng *nên* dùng. Agent phát huy ở:

- **Bài toán mở**: không lập trình trước được các bước; cần LLM tự tìm đường đi.
- **Quy trình nhiều bước**: cần dùng tool qua nhiều lượt, không chỉ một lần tra cứu hay sinh văn bản.
- **Cải thiện theo thời gian**: muốn hệ thống thông minh dần nhờ phản hồi người dùng hoặc tín hiệu từ môi trường.

Khi nào *không* nên dùng agent được bàn kỹ hơn ở [Bài 6 — Agent đáng tin cậy](/ai-agents/course/cong-cu-tri-thuc/xay-agent-dang-tin-cay).

:::tip Góc nhìn dev frontend
Một form có các bước cố định (nhập → validate → gọi API) **không cần agent**: code thường rẻ hơn, nhanh hơn, dễ test hơn. Agent đáng tiền khi đường đi phụ thuộc nội dung yêu cầu, vd "lên lịch trình 3 ngày ở Đà Nẵng hợp ngân sách 5 triệu".
:::

## Nền tảng của giải pháp agentic

### Phát triển agent

Việc đầu tiên khi xây agent là định nghĩa nó *làm được gì*: tool, hành động, hành vi. Khóa học dùng **Microsoft Foundry Agent Service** làm nền tảng chính. Dịch vụ này hỗ trợ:

- model từ nhiều nhà cung cấp như OpenAI, Mistral, Meta (Llama);
- dữ liệu có bản quyền từ đối tác như Tripadvisor;
- định nghĩa tool chuẩn OpenAPI 3.0.

### Agentic pattern

Ta giao tiếp với LLM bằng prompt. Với agent, bạn không thể tự viết tay mọi prompt, vì agent phải hành động qua nhiều bước. **Agentic pattern** là các chiến lược dùng lại được để prompt và điều phối LLM theo cách mở rộng được và đáng tin cậy hơn. Khóa học được xếp theo các pattern phổ biến và hữu ích nhất.

### Agentic framework

**Agentic framework** cho developer template, tool và hạ tầng dựng sẵn để xây agent. Framework giúp:

- nối tool và năng lực vào agent;
- quan sát agent đang làm gì (và debug khi nó sai);
- phối hợp nhiều agent.

Khóa học tập trung vào **Microsoft Agent Framework (MAF)** để xây agent sẵn sàng cho production.

## Code mẫu: agent du lịch đầu tiên

Rút gọn từ notebook [`01-python-agent-framework.ipynb`](https://github.com/microsoft/ai-agents-for-beginners/blob/main/01-intro-to-ai-agents/code_samples/01-python-agent-framework.ipynb). Notebook chạy được `await` ở top-level.

```python
import os, dotenv
from agent_framework import tool
from agent_framework.foundry import FoundryChatClient
from azure.identity import AzureCliCredential

dotenv.load_dotenv(dotenv.find_dotenv())
provider = FoundryChatClient(
    project_endpoint=os.getenv("AZURE_AI_PROJECT_ENDPOINT"),
    model=os.getenv("AZURE_AI_MODEL_DEPLOYMENT_NAME"),
    credential=AzureCliCredential(),
)

@tool(approval_mode="never_require")
def get_destinations() -> list[str]:
    """Get a list of popular vacation destinations."""
    return ["Barcelona", "Paris", "Berlin", "Tokyo", "Sydney", "Bali"]

agent = provider.as_agent(
    name="TravelAgent",
    instructions=(
        "You are a helpful travel agent. Help users find their perfect vacation "
        "destination based on their preferences. Use the get_destinations tool "
        "to see available destinations."
    ),
    tools=[get_destinations],
)

response = await agent.run("I'm looking for a warm beach destination. What do you recommend?")
print(response)

# Streaming: in dần từng phần
async for chunk in agent.run("Tell me about Tokyo as a travel destination", stream=True):
    print(chunk, end="", flush=True)
```

Đối chiếu với định nghĩa ở trên:
- **environment** là danh sách điểm đến;
- **sensor/actuator** là tool `get_destinations`;
- **LLM** quyết định khi nào gọi tool;
- `instructions` định hình hành vi.

Docstring của hàm chính là mô tả tool mà LLM đọc để quyết định dùng nó.

:::quiz Theo định nghĩa của khóa học, điều gì phân biệt AI Agent với một LLM chỉ trả lời prompt?
- [ ] Agent dùng model lớn hơn
- [x] Agent được trao tool và tri thức để thực hiện hành động trong môi trường
- [ ] Agent luôn có bộ nhớ dài hạn
- [ ] Agent không cần prompt

Điểm cốt lõi là *hành động*: LLM trong hệ thống agent có thể thực thi bước như gọi API, truy vấn dữ liệu, thay vì chỉ sinh văn bản. Memory là thành phần có thể có, không bắt buộc.
:::

:::quiz Yêu cầu "huỷ chuyến đi" được tách thành huỷ vé bay, huỷ khách sạn, huỷ thuê xe, mỗi phần giao cho một sub-agent. Đây là loại agent nào?
- [ ] Simple Reflex
- [ ] Utility-Based
- [x] Hierarchical
- [ ] Learning

Agent cấp cao chia việc và **giao xuống** agent cấp dưới: đó là hierarchical agent.
:::

:::quiz Trường hợp nào KHÔNG cần dùng AI Agent? (chọn nhiều)
- [x] Form đăng ký có các bước cố định và quy tắc validate rõ ràng
- [ ] Lập lịch trình du lịch theo sở thích và ngân sách thay đổi
- [x] Chuyển đổi định dạng ngày tháng trong một file CSV
- [ ] Hỗ trợ khách hàng cần tra nhiều hệ thống qua nhiều lượt

Agent hợp với bài toán mở, nhiều bước, cần thích nghi. Việc có thuật toán xác định thì code thường rẻ, nhanh và dễ test hơn.
:::

:::exercise Phác thiết kế agent cho một bài toán thật
Chọn một bài toán ở công việc của bạn (vd trợ lý tra cứu đơn hàng cho CSKH). Viết ra:
1. Environment, sensor, actuator.
2. Danh sách tool, và tool nào **không** nên cho agent.
3. Memory ngắn hạn và dài hạn cần gì.
4. Nó thuộc loại agent nào trong bảng.
5. Một lý do bài toán này *thật sự* cần agent thay vì code thường.
???
Ví dụ trợ lý tra cứu đơn hàng:
1. **Environment:** hệ thống đơn hàng và vận chuyển. **Sensor:** `get_order(id)`, `get_shipment_status(code)`. **Actuator:** `create_ticket(...)`, `send_email(...)`.
2. **Tool nên có:** đọc đơn hàng, tình trạng giao hàng, tạo ticket. **Không nên cho:** `refund_order` hay sửa địa chỉ mà không có người duyệt (xem human-in-the-loop ở Bài 6).
3. **Ngắn hạn:** hội thoại hiện tại và mã đơn đang bàn. **Dài hạn:** lịch sử ticket của khách, ngôn ngữ ưa dùng.
4. **Loại agent:** goal-based (mục tiêu: giải quyết thắc mắc của khách), có thể nâng lên hierarchical nếu tách agent vận chuyển và agent thanh toán.
5. **Vì sao cần agent:** câu hỏi của khách không theo mẫu; số bước tra cứu tuỳ tình huống (đơn bị tách, giao lại, đổi trả…).
:::

**Bài trước:** [Bài 0 — Cài đặt](/ai-agents/course/nen-tang/cai-dat-khoa-hoc) · **Bài tiếp theo:** [Bài 2 — Khám phá agent framework](/ai-agents/course/nen-tang/kham-pha-agent-framework)
