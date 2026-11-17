---
title: "Bài 4 — Tool Use Design Pattern: function calling, MCP tool và toolset"
summary: "Tool là code agent thực thi để hành động. Sáu khối xây dựng của pattern, vòng function calling với Responses API (model trả tool call, không phải câu trả lời), tool trong Microsoft Agent Framework, tool từ MCP server, toolset của Foundry Agent Service, và giữ an toàn khi LLM sinh SQL."
type: lesson
level: intermediate
lastReviewed: 2026-11-17
tags: [ai-agents, tool-use, function-calling, mcp, security]
related: [ai-agents/course/nen-tang/kham-pha-agent-framework, ai-agents/course/production-giao-thuc/giao-thuc-mcp-a2a-nlweb, claude-code/deep-dive/extending/mcp-va-plugin]
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 04 Tool Use](https://github.com/microsoft/ai-agents-for-beginners/tree/main/04-tool-use) (Microsoft, MIT License). Code gọi model cần Azure OpenAI hoặc Foundry. Lời giải bài tập cuối bài dùng model giả lập và **đã chạy thử** bằng Python 3.
:::

Tool mở rộng năng lực của agent: thay vì chỉ có vài hành động giới hạn, thêm tool là agent làm được rất nhiều việc. Bài này trả lời: pattern Tool Use là gì, dùng cho trường hợp nào, cần những khối xây dựng gì, và cần lưu ý gì để agent đáng tin cậy.

## Tool Use Design Pattern là gì?

Pattern này trao cho LLM khả năng **tương tác với tool bên ngoài** để đạt mục tiêu. Tool là code agent có thể thực thi để hành động. Nó có thể là hàm đơn giản như máy tính, hoặc lời gọi API bên thứ ba như tra giá cổ phiếu hay dự báo thời tiết. Trong ngữ cảnh agent, tool được thực thi **khi model sinh ra lời gọi hàm** (model-generated function call).

## Dùng cho trường hợp nào?

- **Lấy thông tin động:** truy vấn API hoặc database để có dữ liệu mới, vd query SQLite để phân tích, lấy giá cổ phiếu, thời tiết.
- **Chạy và diễn giải code:** giải toán, tạo báo cáo, mô phỏng.
- **Tự động hoá workflow:** nối với bộ lập lịch, email, data pipeline.
- **Hỗ trợ khách hàng:** làm việc với CRM, hệ thống ticket, knowledge base.
- **Tạo và sửa nội dung:** kiểm tra ngữ pháp, tóm tắt, đánh giá content safety.

## Các khối xây dựng

| Khối | Vai trò |
|---|---|
| **Function/Tool schema** | Định nghĩa tool: tên, mục đích, tham số bắt buộc, output mong đợi. Nhờ đó LLM biết có tool nào và tạo request hợp lệ. |
| **Function execution logic** | Quyết định gọi tool nào, khi nào, theo ý định người dùng và ngữ cảnh. Có thể là planner, router hoặc luồng điều kiện. |
| **Message handling** | Quản lý luồng giữa input người dùng, câu trả lời LLM, tool call và tool output. |
| **Tool integration framework** | Hạ tầng nối agent với tool, từ hàm đơn giản tới dịch vụ ngoài phức tạp. |
| **Error handling & validation** | Xử lý tool lỗi, validate tham số, xử lý phản hồi bất ngờ. |
| **State management** | Theo dõi ngữ cảnh, các lần gọi tool trước, dữ liệu lâu dài để nhất quán qua nhiều lượt. |

## Function calling từng bước

Function calling là cách chính để LLM dùng tool. "Function" và "tool" thường dùng thay nhau, vì hàm chính là tool agent dùng. Cơ chế:

1. Gửi cho LLM một **schema mô tả mọi hàm** có sẵn, kèm yêu cầu người dùng.
2. LLM chọn hàm phù hợp nhất và **trả về tên hàm + tham số**.
3. Code của bạn gọi hàm, gửi kết quả lại cho LLM.
4. LLM dùng kết quả để trả lời người dùng.

Bạn cần: (1) một model **hỗ trợ function calling**, (2) schema mô tả hàm, (3) code của từng hàm. Ví dụ lấy giờ hiện tại ở một thành phố:

**Bước 1: khởi tạo client** cho Azure OpenAI **Responses API**. Endpoint `/openai/v1/` ổn định, không cần `api_version`.

```python
client = OpenAI(
    base_url=f"{os.environ['AZURE_OPENAI_ENDPOINT'].rstrip('/')}/openai/v1/",
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
)
deployment_name = os.environ["AZURE_OPENAI_DEPLOYMENT"]
```

**Bước 2: schema của hàm**, rồi gửi kèm câu hỏi.

```python
tools = [{
    "type": "function",
    "name": "get_current_time",
    "description": "Get the current time in a given location",
    "parameters": {
        "type": "object",
        "properties": {"location": {"type": "string", "description": "The city name, e.g. San Francisco"}},
        "required": ["location"],
    },
}]

messages = [{"role": "user", "content": "What's the current time in San Francisco"}]
response = client.responses.create(
    model=deployment_name, input=messages, tools=tools, tool_choice="auto", store=False,
)
messages += response.output     # giữ tool call trong hội thoại cho lượt sau
print(response.output)
```

```text
[ResponseFunctionToolCall(arguments='{"location":"San Francisco"}', call_id='call_pOsK...', name='get_current_time', type='function_call')]
```

:::warning Điểm hay bị hiểu nhầm
Thứ model trả về ở lượt đầu là **một tool call**, *không phải* câu trả lời. Model chỉ nói "hãy gọi `get_current_time` với `location=San Francisco`". Chạy hàm là việc của **code của bạn**.
:::

**Bước 3: code của hàm và vòng xử lý tool call.**

```python
def get_current_time(location):
    """Get the current time for a given location"""
    location_lower = location.lower()
    for key, timezone in TIMEZONE_DATA.items():
        if key in location_lower:
            current_time = datetime.now(ZoneInfo(timezone)).strftime("%I:%M %p")
            return json.dumps({"location": location, "current_time": current_time})
    return json.dumps({"location": location, "current_time": "unknown"})

tool_calls = [item for item in response.output if item.type == "function_call"]
for tool_call in tool_calls:
    if tool_call.name == "get_current_time":
        args = json.loads(tool_call.arguments)
        messages.append({
            "type": "function_call_output",
            "call_id": tool_call.call_id,           # nối kết quả với đúng lời gọi
            "output": get_current_time(location=args.get("location")),
        })

final_response = client.responses.create(model=deployment_name, input=messages, tools=tools, store=False)
print(final_response.output_text)   # The current time in San Francisco is 09:24 AM.
```

Function calling là trái tim của hầu hết thiết kế tool use, nhưng tự viết từ đầu khá vất vả. Đó là lý do có framework (Bài 2).

## Tool use với framework

### Microsoft Agent Framework

MAF là framework mã nguồn mở. Bạn định nghĩa tool bằng decorator `@tool`. Framework tự serialize hàm và tham số thành schema, và tự lo phần qua lại giữa model với code. MAF cũng cho dùng tool dựng sẵn như File Search, Code Interpreter qua `FoundryChatClient`.

```python
@tool(approval_mode="never_require")
def get_current_time(location: str) -> str:
    """Get the current time for a given location"""
    ...

agent = provider.as_agent(name="TimeAgent", instructions="Use available tools to answer questions.", tools=get_current_time)
response = await agent.run("What time is it?")
```

### Tool từ MCP server

Tool không nhất thiết là hàm trong code của bạn. Một server nói **Model Context Protocol** (MCP, xem Bài 11) công bố tool kèm schema, và framework nạp chúng giống hệt hàm có decorator. `MCPStreamableHTTPTool` nối tới server qua HTTP, đọc schema tool, rồi đưa cho model cùng các tool local.

Ví dụ dưới dùng server tìm kiếm web của Keenable. Theo bản gốc, server này miễn phí, không cần tài khoản hay key (giới hạn tần suất theo IP). Như mọi tool từ xa, **câu truy vấn model viết ra sẽ được gửi tới server đó**.

```python
from agent_framework import MCPStreamableHTTPTool

web_search = MCPStreamableHTTPTool(name="Keenable web search", url="https://api.keenable.ai/mcp")

async with web_search:          # kết nối = nạp schema tool của server
    agent = provider.as_agent(
        name="ResearchAgent",
        instructions="Use available tools to answer questions.",
        tools=[web_search],
    )
    response = await agent.run("What is new in the latest Python release?")
    print(response.text)
```

Server có hai tool, `search_web_pages` và `fetch_page_content`. Khi cần thông tin mới, model gọi `search_web_pages`, nhận tiêu đề, URL, đoạn trích, rồi viết câu trả lời. Vẫn là vòng lặp như `get_current_time`.

### Microsoft Foundry Agent Service

Dịch vụ được quản lý hoàn toàn, bảo mật cấp doanh nghiệp, không phải tự lo compute và storage. So với gọi thẳng LLM API:

- **Tự gọi tool:** không phải parse tool call, gọi tool, xử lý kết quả; mọi thứ chạy ở server.
- **Dữ liệu được quản lý an toàn:** dùng **thread** để lưu trạng thái hội thoại thay vì tự quản.
- **Tool có sẵn** để nối với nguồn dữ liệu: Bing, Azure AI Search, Azure Functions.

| Nhóm tool | Gồm |
|---|---|
| **Knowledge tools** | Grounding with Bing Search, File Search, Azure AI Search |
| **Action tools** | Function Calling, Code Interpreter, tool định nghĩa bằng OpenAPI, Azure Functions |

Các tool gộp thành một **`toolset`**. Ví dụ: agent trả lời về dữ liệu bán hàng của công ty Contoso. Model tự chọn giữa hàm `fetch_sales_data_using_sqlite_query` của bạn và Code Interpreter dựng sẵn.

```python
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import ToolSet, FunctionTool, CodeInterpreterTool
from azure.identity import DefaultAzureCredential
from fetch_sales_data_functions import fetch_sales_data_using_sqlite_query

project_client = AIProjectClient.from_connection_string(
    credential=DefaultAzureCredential(), conn_str=os.environ["PROJECT_CONNECTION_STRING"],
)
toolset = ToolSet()
toolset.add(FunctionTool(fetch_sales_data_using_sqlite_query))
toolset.add(CodeInterpreterTool())

agent = project_client.agents.create_agent(
    model="gpt-5-mini", name="my-agent", instructions="You are helpful agent", toolset=toolset,
)
```

## Lưu ý để agent đáng tin cậy

Mối lo phổ biến với SQL do LLM sinh ra là bảo mật: SQL injection, hay hành động phá hoại như xoá hoặc sửa database. Lo ngại này có cơ sở, nhưng giảm được hiệu quả bằng **cấu hình quyền truy cập database**:

- Đặt database ở chế độ **read-only**. Với PostgreSQL hay Azure SQL, gán cho app **role chỉ có SELECT**.
- Chạy app trong môi trường an toàn.
- Trong doanh nghiệp, dữ liệu thường được trích từ hệ thống vận hành sang **database read-only hoặc data warehouse** có schema dễ hiểu, và app chỉ có quyền đọc.

```sql title="Role chỉ đọc cho agent (PostgreSQL)"
CREATE ROLE agent_ro LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE shop TO agent_ro;
GRANT USAGE ON SCHEMA public TO agent_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_ro;
```

:::senior Chặn bằng quyền, đừng chặn bằng prompt
"Đừng bao giờ chạy DROP TABLE" trong instructions chỉ là chỉ dẫn mềm; prompt injection có thể vượt qua. Quyền ở database là **chỉ dẫn cứng**. Cùng tư duy như permission rule và hook trong [Claude Code](/claude-code/deep-dive/guardrails/sandbox-va-prompt-injection). Bài 18 đi sâu vào bảo mật agent.
:::

**Code mẫu:** [04-python-agent-framework.ipynb](https://github.com/microsoft/ai-agents-for-beginners/blob/main/04-tool-use/code_samples/04-python-agent-framework.ipynb).

:::quiz Sau lời gọi `client.responses.create(...)` đầu tiên có kèm `tools`, `response.output` chứa gì khi model quyết định dùng tool?
- [ ] Câu trả lời "The current time in San Francisco is 09:24 AM"
- [x] Một item `function_call` gồm tên hàm, `arguments` dạng JSON và `call_id`
- [ ] Kết quả của `get_current_time` do Azure chạy hộ
- [ ] Schema của tool

Model chỉ *yêu cầu* gọi hàm. Code của bạn chạy hàm, thêm `function_call_output` với đúng `call_id`, rồi gọi model lần hai để có câu trả lời.
:::

:::quiz Cách nào hiệu quả nhất để ngăn agent sinh SQL làm hỏng dữ liệu?
- [ ] Viết thật kỹ trong instructions: "Không bao giờ dùng DELETE hay DROP"
- [ ] Dùng model lớn hơn
- [x] Cho app kết nối bằng role chỉ có quyền SELECT, tốt nhất trên bản sao read-only hoặc data warehouse
- [ ] Tắt function calling

Khóa học khuyên chặn ở tầng quyền database. Chỉ dẫn trong prompt có thể bị vượt qua; quyền SELECT thì không.
:::

:::quiz Vì sao phải gửi lại `call_id` khi trả kết quả tool cho model?
- [ ] Để Azure tính phí đúng
- [x] Để model ghép kết quả với đúng lời gọi, nhất là khi một lượt có nhiều tool call
- [ ] Vì `call_id` là API key tạm
- [ ] Không bắt buộc, chỉ để log

Một lượt có thể sinh nhiều `function_call`. `call_id` nối từng `function_call_output` với lời gọi tương ứng.
:::

:::exercise Tự viết vòng lặp tool calling
Viết hàm `run(user_text, model)` lặp tối đa 5 lượt:
- gọi `model(messages)`;
- nếu output có `function_call` thì chạy tool tương ứng trong dict `TOOLS` và thêm `function_call_output` (kèm `call_id`);
- nếu không có tool call thì trả về text.

Yêu cầu thêm:
- tool không tồn tại hoặc ném exception thì trả `{"error": ...}` cho model, **không crash**;
- quá 5 lượt thì báo lỗi.

Thử với một `fake_model` giả lập: lượt 1 trả tool call `get_current_time(location="Hanoi")`, lượt 2 trả câu trả lời từ kết quả tool.
???
```python
import json
from datetime import datetime
from zoneinfo import ZoneInfo

TIMEZONE_DATA = {"tokyo": "Asia/Tokyo", "san francisco": "America/Los_Angeles", "hanoi": "Asia/Ho_Chi_Minh"}

def get_current_time(location: str) -> str:
    loc = location.lower()
    for key, tz in TIMEZONE_DATA.items():
        if key in loc:
            return json.dumps({"location": location,
                               "current_time": datetime.now(ZoneInfo(tz)).strftime("%I:%M %p")})
    return json.dumps({"location": location, "current_time": "unknown"})

TOOLS = {"get_current_time": get_current_time}

def fake_model(messages):
    outputs = [m for m in messages if isinstance(m, dict) and m.get("type") == "function_call_output"]
    if not outputs:
        return [{"type": "function_call", "call_id": "call_1", "name": "get_current_time",
                 "arguments": json.dumps({"location": "Hanoi"})}]
    data = json.loads(outputs[-1]["output"])
    return [{"type": "message", "text": f"Bây giờ ở {data['location']} là {data['current_time']}."}]

def run(user_text, model=fake_model, max_turns=5):
    messages = [{"role": "user", "content": user_text}]
    for _ in range(max_turns):
        output = model(messages)
        messages += output
        calls = [o for o in output if o["type"] == "function_call"]
        if not calls:
            return next(o["text"] for o in output if o["type"] == "message")
        for c in calls:
            fn = TOOLS.get(c["name"])
            try:
                result = fn(**json.loads(c["arguments"])) if fn else json.dumps({"error": f"unknown tool {c['name']}"})
            except Exception as e:
                result = json.dumps({"error": str(e)})
            messages.append({"type": "function_call_output", "call_id": c["call_id"], "output": result})
    raise RuntimeError("quá số lượt cho phép")

print(run("Mấy giờ rồi ở Hà Nội?"))   # Bây giờ ở Hanoi là 10:41 PM.  (giờ tuỳ lúc chạy)
print(get_current_time("Paris"))       # {"location": "Paris", "current_time": "unknown"}
```

Đã chạy bằng Python 3. Muốn dùng model thật, thay `fake_model` bằng hàm gọi `client.responses.create(..., input=messages, tools=tools)` rồi đổi `response.output` sang dict. Giới hạn `max_turns` chặn vòng lặp vô hạn khi model cứ gọi tool mãi. Đây là guardrail tối thiểu cho mọi agent loop.
:::

**Bài trước:** [Bài 3](/ai-agents/course/nen-tang/nguyen-tac-thiet-ke-agent) · **Bài tiếp theo:** [Bài 5 — Agentic RAG](/ai-agents/course/cong-cu-tri-thuc/agentic-rag)
