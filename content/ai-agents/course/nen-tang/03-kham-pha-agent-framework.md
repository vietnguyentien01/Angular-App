---
title: "Bài 2 — Khám phá AI Agent framework: Microsoft Agent Framework và Foundry Agent Service"
summary: "Agent framework khác AI framework thường ở chỗ cho agent cộng tác, tự động hoá task nhiều bước và thích nghi theo ngữ cảnh. Ba cách prototype nhanh (component module, cộng tác, học thời gian thực), khái niệm cốt lõi của MAF và Foundry Agent Service (agent, thread, message), và khi nào chọn cái nào."
type: lesson
level: core
lastReviewed: 2026-11-17
tags: [ai-agents, framework, microsoft-agent-framework, foundry-agent-service]
related: [ai-agents/course/nen-tang/gioi-thieu-ai-agent, ai-agents/course/nang-cao/microsoft-agent-framework, claude-code/deep-dive/automation/agent-sdk-nhap-mon]
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 02 Explore Agentic Frameworks](https://github.com/microsoft/ai-agents-for-beginners/tree/main/02-explore-agentic-frameworks) (Microsoft, MIT License).
:::

AI agent framework là nền tảng phần mềm giúp việc tạo, deploy và quản lý AI agent đơn giản hơn. Framework cho developer component dựng sẵn, các lớp trừu tượng và tool, để họ tập trung vào phần đặc thù của ứng dụng thay vì giải lại những bài toán chung.

## Bài này gồm

- Agent framework là gì và giúp developer làm được gì.
- Team dùng chúng để prototype, lặp và cải thiện năng lực agent nhanh ra sao.
- Khác biệt giữa **Microsoft Agent Framework (MAF)** và **Microsoft Foundry Agent Service**.
- Có tích hợp thẳng tool trong hệ sinh thái Azure được không.

## Agent framework khác AI framework thường thế nào?

AI framework truyền thống giúp đưa AI vào app theo ba hướng:

- **Cá nhân hoá:** phân tích hành vi để gợi ý nội dung, vd Netflix gợi ý phim theo lịch sử xem.
- **Tự động hoá và hiệu suất:** chatbot xử lý câu hỏi thường gặp, giải phóng nhân viên cho việc khó hơn.
- **Trải nghiệm tốt hơn:** nhận dạng giọng nói, NLP, gõ dự đoán, vd Siri, Google Assistant.

Agent framework đi xa hơn: nó cho phép tạo agent **tương tác với người dùng, với agent khác và với môi trường** để đạt mục tiêu, có thể tự chủ, ra quyết định và thích nghi. Ba năng lực chính:

- **Cộng tác và điều phối agent:** nhiều agent làm việc, giao tiếp và phối hợp để giải bài toán phức tạp.
- **Tự động hoá và quản lý task:** cơ chế cho workflow nhiều bước, giao việc và quản lý task động giữa các agent.
- **Hiểu ngữ cảnh và thích nghi:** agent hiểu ngữ cảnh, thích nghi khi môi trường đổi, ra quyết định theo thông tin thời gian thực.

## Prototype, lặp và cải thiện nhanh

### 1. Dùng component dạng module

SDK như Microsoft Agent Framework có sẵn AI connector, định nghĩa tool, quản lý agent. Team lắp ghép chúng thành prototype chạy được mà không phải viết từ đầu. Ví dụ agent gọi tool đặt vé:

```python
import asyncio, os
from agent_framework import tool
from agent_framework.foundry import FoundryChatClient
from azure.identity import AzureCliCredential

@tool(approval_mode="never_require")
def book_flight(date: str, location: str) -> str:
    """Book travel given location and date."""
    return f"Travel was booked to {location} on {date}"

async def main():
    provider = FoundryChatClient(
        project_endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        credential=AzureCliCredential(),
    )
    agent = provider.as_agent(
        name="travel_agent",
        instructions="Help the user book travel. Use the book_flight tool when ready.",
        tools=[book_flight],
    )
    response = await agent.run("I'd like to go to New York on January 1, 2025")
    print(response)
    # Ví dụ output: Your flight to New York on January 1, 2025, has been successfully booked.

asyncio.run(main())
```

Bạn không viết parser nào. Model tự **trích** `date` và `location` từ câu tự nhiên dựa trên chữ ký hàm, rồi gọi tool. Bạn chỉ lo logic cấp cao.

### 2. Dùng công cụ cộng tác

Thiết kế agent theo vai trò rõ ràng (lấy dữ liệu, phân tích, ra quyết định), rồi cho chúng trao đổi thông tin để đạt mục tiêu chung:

```python
agent_retrieve = provider.as_agent(
    name="dataretrieval",
    instructions="Retrieve relevant data using available tools.",
    tools=[retrieve_tool],
)
agent_analyze = provider.as_agent(
    name="dataanalysis",
    instructions="Analyze the retrieved data and provide insights.",
    tools=[analyze_tool],
)

retrieval_result = await agent_retrieve.run("Retrieve sales data for Q4")
analysis_result = await agent_analyze.run(f"Analyze this data: {retrieval_result}")
print(analysis_result)
```

Agent chuyên trách thì hiệu quả và chất lượng task tốt hơn.

### 3. Học theo thời gian thực

Framework nâng cao cho phép tạo **vòng phản hồi**: agent phân tích phản hồi người dùng, dữ liệu môi trường và kết quả task, rồi cập nhật knowledge base, điều chỉnh cách ra quyết định và cải thiện dần theo thời gian.

## Microsoft Agent Framework (MAF)

MAF là SDK gọn để xây agent qua `FoundryChatClient`: model Azure OpenAI, tool calling tích hợp, quản lý hội thoại, bảo mật doanh nghiệp qua Azure identity. Dùng để xây agent production với tool, workflow nhiều bước và tích hợp doanh nghiệp.

Khái niệm cốt lõi:

- **Agent**: tạo bằng `provider.as_agent(name, instructions, tools)`. Agent xử lý tin nhắn người dùng, **tự gọi tool** theo ngữ cảnh, và giữ trạng thái hội thoại qua nhiều lượt.

```python
agent = provider.as_agent(name="my_agent", instructions="You are a helpful assistant.")
response = await agent.run("Hello, World!")
```

- **Tool**: hàm Python mà agent gọi tự động, đăng ký khi tạo agent.

```python
def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny, 72°F."

agent = provider.as_agent(name="weather_agent", instructions="Help users check the weather.", tools=[get_weather])
```

- **Điều phối nhiều agent**: agent chuyên môn khác nhau, nối kết quả của nhau.

```python
planner = provider.as_agent(name="planner", instructions="Break down complex tasks into steps.")
executor = provider.as_agent(name="executor", instructions="Execute the planned steps using available tools.", tools=[execute_tool])

plan = await planner.run("Plan a trip to Paris")
result = await executor.run(f"Execute this plan: {plan}")
```

- **Tích hợp Azure Identity**: `AzureCliCredential` hoặc `DefaultAzureCredential` cho xác thực keyless, không phải tự quản API key.

## Microsoft Foundry Agent Service

Ra mắt tại Microsoft Ignite 2024. Đây là **nền tảng và dịch vụ deploy** agent:
- model linh hoạt hơn, gọi thẳng được LLM open-source như Llama 3, Mistral, Cohere;
- cơ chế bảo mật và lưu trữ dữ liệu mạnh cho doanh nghiệp;
- chạy ngay với Microsoft Agent Framework.

Bản gốc ghi dịch vụ đang Public Preview, hỗ trợ Python và C#.

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

def get_specials() -> str:
    """Provides a list of specials from the menu."""
    return "Special Soup: Clam Chowder\nSpecial Salad: Cobb Salad\nSpecial Drink: Chai Tea"

def get_item_price(menu_item: str) -> str:
    """Provides the price of the requested menu item."""
    return "$9.99"

project_client = AIProjectClient.from_connection_string(
    credential=DefaultAzureCredential(), conn_str="your-connection-string",
)
agent = project_client.agents.create_agent(
    model="gpt-5-mini", name="Host",
    instructions="Answer questions about the menu.",
    tools=[get_specials, get_item_price],
)
thread = project_client.agents.create_thread()

for user_input in ["Hello", "What is the special soup?", "How much does that cost?", "Thank you"]:
    project_client.agents.create_message(thread_id=thread.id, role="user", content=user_input)
    project_client.agents.create_and_process_run(thread_id=thread.id, agent_id=agent.id)
    messages = project_client.agents.list_messages(thread_id=thread.id)
    print(f"# Agent: {messages.data[0].content[0].text.value}")
```

Khái niệm cốt lõi:

- **Agent**: trong Microsoft Foundry, agent như một microservice "thông minh". Nó trả lời câu hỏi (RAG), thực hiện hành động, hoặc tự động hoá trọn workflow, bằng cách kết hợp model sinh nội dung với tool truy cập dữ liệu thật. Ví dụ, agent có tool `code_interpreter` để chạy code.
- **Thread và message**: thread là một cuộc hội thoại giữa agent và người dùng. Nó theo dõi tiến trình, lưu ngữ cảnh và quản lý trạng thái. Bạn gửi message vào thread, gọi `create_and_process_run` để agent làm việc trên thread, rồi đọc message để xem kết quả. Message có thể là text, ảnh hoặc file, vd agent vẽ biểu đồ cột lợi nhuận và trả về file ảnh.
- **Tích hợp MAF**: xây agent bằng `FoundryChatClient`, deploy qua Agent Service cho production.

## Chọn cái nào?

| | Trọng tâm | Khái niệm chính | Dùng cho |
|---|---|---|---|
| **Microsoft Agent Framework** | SDK agent gọn, có tool calling | Agent, Tool, Azure Identity | Xây agent, tool use, workflow nhiều bước |
| **Microsoft Foundry Agent Service** | Model linh hoạt, bảo mật doanh nghiệp, sinh code, tool calling | Module, cộng tác, điều phối quy trình | Deploy agent an toàn, mở rộng được, linh hoạt |

- *"Tôi xây app agent production và muốn bắt đầu nhanh"* → **MAF**: API kiểu Python, vài dòng là có agent với tool và instructions.
- *"Tôi cần deploy doanh nghiệp, tích hợp Azure như Search và chạy code"* → **Foundry Agent Service**: có sẵn nhiều model, Azure AI Search, Bing Search, Azure Functions, dựng agent trên Foundry Portal và deploy quy mô lớn.
- *"Cho tôi một lựa chọn thôi"* → Bắt đầu bằng **MAF** để xây logic agent, rồi dùng **Foundry Agent Service** khi cần deploy và scale production.

**Tích hợp hệ sinh thái Azure?** Được. Foundry Agent Service được thiết kế để nối với Bing, Azure AI Search, Azure Functions và tích hợp sâu Microsoft Foundry. MAF cũng gọi được dịch vụ Azure từ trong tool, nhờ `FoundryChatClient` và Azure identity.

:::senior Đặt cạnh Claude Code
Cấu trúc này quen thuộc nếu bạn đã học [Agent SDK nhập môn](/claude-code/deep-dive/automation/agent-sdk-nhap-mon). Ở cả hai, *SDK* định nghĩa agent, tool và vòng lặp; còn *dịch vụ hoặc môi trường chạy* lo deploy, quyền và quan sát. Khi phỏng vấn, tách rõ hai lớp này: "SDK để viết logic agent, platform để vận hành nó".
:::

**Code mẫu đầy đủ:** [02-python-agent-framework.ipynb](https://github.com/microsoft/ai-agents-for-beginners/blob/main/02-explore-agentic-frameworks/code_samples/02-python-agent-framework.ipynb) và [bản Azure OpenAI Responses API](https://github.com/microsoft/ai-agents-for-beginners/blob/main/02-explore-agentic-frameworks/code_samples/02-python-agent-framework-azure-openai.ipynb).

:::quiz Trong ví dụ `book_flight`, ai tách "January 1, 2025" và "New York" ra khỏi câu người dùng?
- [ ] Một regex parser bạn tự viết
- [x] Model, dựa trên chữ ký và docstring của tool, sinh ra lời gọi tool với đúng tham số
- [ ] Azure AI Search
- [ ] Thread của Foundry Agent Service

Framework gửi schema của tool (tên, tham số, mô tả) cho model; model quyết định gọi tool và điền tham số. Đó là lý do docstring và type hint quan trọng.
:::

:::quiz Trong Foundry Agent Service, "thread" dùng để làm gì?
- [ ] Chạy agent song song trên nhiều CPU
- [x] Đại diện một cuộc hội thoại: lưu message, ngữ cảnh và trạng thái tương tác
- [ ] Định nghĩa tool cho agent
- [ ] Lưu API key

Thread là nơi chứa hội thoại. Bạn thêm message, chạy `create_and_process_run`, rồi đọc message trả về (text, ảnh, file).
:::

:::exercise Chọn MAF hay Foundry Agent Service
Với mỗi tình huống, chọn MAF, Foundry Agent Service hoặc cả hai, và giải thích một câu:
1. Hackathon 2 ngày, cần demo agent gọi 3 API nội bộ.
2. Ngân hàng cần agent trả lời từ tài liệu nội bộ, có Azure AI Search, kiểm soát bảo mật và scale cho 5.000 nhân viên.
3. Team muốn viết logic agent ở local, sau đó đưa lên môi trường doanh nghiệp.
???
1. **MAF**: vài dòng là có agent với tool; không cần hạ tầng.
2. **Foundry Agent Service** (logic có thể viết bằng MAF): cần Azure AI Search tích hợp sẵn, bảo mật doanh nghiệp và deploy quy mô lớn.
3. **Cả hai**: đúng lời khuyên của khóa học: viết bằng MAF để lặp nhanh, deploy và scale qua Foundry Agent Service.
:::

**Bài trước:** [Bài 1](/ai-agents/course/nen-tang/gioi-thieu-ai-agent) · **Bài tiếp theo:** [Bài 3 — Nguyên tắc thiết kế agent](/ai-agents/course/nen-tang/nguyen-tac-thiet-ke-agent)
