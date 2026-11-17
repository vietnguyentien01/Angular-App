---
title: "Bài 14 — Khám phá Microsoft Agent Framework: agent, tool, thread, middleware, memory và workflow"
summary: "Microsoft Agent Framework (MAF): năm kiểu điều phối, observability, bảo mật, durability, human-in-the-loop. Tạo và chạy agent, tool, thread, function và chat middleware, ba loại memory, workflow (executor, edge, event), và host agent LangGraph trên Foundry."
type: lesson
level: advanced
lastReviewed: 2026-11-17
tags: [ai-agents, microsoft-agent-framework, middleware, workflow, langgraph]
related: [ai-agents/course/nen-tang/kham-pha-agent-framework, ai-agents/course/ke-hoach-da-agent/multi-agent, claude-code/deep-dive/extending/hooks-thuc-chien]
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 14 Microsoft Agent Framework](https://github.com/microsoft/ai-agents-for-beginners/tree/main/14-microsoft-agent-framework) (Microsoft, MIT License). Lời giải bài tập (middleware chain) **đã chạy thử** bằng Python 3, không cần MAF.
:::

:::warning Tên API trong bài này
Đoạn code của bài 14 gốc dùng một số tên như `create_agent`, `ChatAgent`, `get_new_thread()`, `run_stream()`. Notebook ở các bài 1–13 lại dùng `provider.as_agent(...)`, `agent.create_session()` và `agent.run(..., stream=True)`. MAF đang phát triển nhanh, nên tên API có thể khác giữa các phiên bản. Khi tự code, hãy đối chiếu với [tài liệu MAF](https://learn.microsoft.com/en-us/agent-framework/overview/) đúng phiên bản bạn cài. **Khái niệm** trong bài thì không đổi.
:::

**Mục tiêu:** xây agent production bằng MAF, áp dụng các tính năng cốt lõi vào use case của bạn, và dùng pattern nâng cao: workflow, middleware, observability.

## MAF là gì?

**Microsoft Agent Framework** là framework hợp nhất của Microsoft để xây AI agent, đủ linh hoạt cho cả production lẫn nghiên cứu. Năm kiểu điều phối:

| Điều phối | Khi nào |
|---|---|
| **Sequential** | Workflow từng bước |
| **Concurrent** | Các agent làm task cùng lúc |
| **Group chat** | Agent cộng tác trên một task |
| **Handoff** | Agent chuyển task cho nhau khi task con xong |
| **Magentic** | Agent quản lý tạo và sửa task list, điều phối subagent để hoàn thành |

**Tính năng cho production:**
- **Observability** qua OpenTelemetry: mọi hành động (gọi tool, bước điều phối, luồng suy luận, hiệu năng) hiện trên dashboard Microsoft Foundry.
- **Bảo mật:** host agent trên Microsoft Foundry với kiểm soát theo vai trò, xử lý dữ liệu riêng tư, content safety có sẵn.
- **Durability:** thread và workflow có thể **tạm dừng, tiếp tục và phục hồi sau lỗi**, phù hợp quy trình chạy lâu.
- **Kiểm soát:** hỗ trợ workflow human-in-the-loop, đánh dấu task cần người duyệt.

**Tương thích:**
- **Không phụ thuộc cloud:** chạy trong container, on-prem, nhiều cloud.
- **Không phụ thuộc provider:** Azure OpenAI, OpenAI…
- **Chuẩn mở:** A2A và MCP để khám phá, dùng agent và tool khác.
- **Plugin và connector:** Microsoft Fabric, SharePoint, Pinecone, Qdrant.

## Khái niệm cốt lõi

### Tạo agent

Tạo agent cần: dịch vụ suy luận (LLM provider), instructions, và `name`.

```python
agent = AzureOpenAIChatClient(credential=AzureCliCredential()).create_agent(
    instructions="You are good at recommending trips to customers based on their preferences.",
    name="TripRecommender",
)
```

Có thể thay bằng Foundry Agent Service (`AzureAIAgentClient`), OpenAI Responses (`OpenAIResponsesClient`), OpenAI Chat Completion (`OpenAIChatClient`), provider tương thích OpenAI như MiniMax, hay **agent từ xa qua A2A**:

```python
agent = OpenAIChatClient(base_url="https://api.minimax.io/v1",
                         api_key=os.environ["MINIMAX_API_KEY"],
                         model_id="MiniMax-M3").create_agent(name="HelpfulAssistant",
                                                             instructions="You are a helpful assistant.")

agent = A2AAgent(name=agent_card.name, description=agent_card.description,
                 agent_card=agent_card, url="https://your-a2a-agent-host")
```

### Chạy agent

```python
result = await agent.run("What are good places to visit in Amsterdam?")
print(result.text)

async for update in agent.run_stream("What are the good places to visit in Amsterdam?"):
    if update.text:
        print(update.text, end="", flush=True)
```

Mỗi lần chạy có thể tuỳ chỉnh `max_tokens`, `tools` được phép gọi, thậm chí `model`. Hữu ích khi task cần model hoặc tool riêng.

### Tool

Khai báo khi tạo agent, **hoặc chỉ cho một lần chạy**:

```python
def get_attractions(location: Annotated[str, Field(description="The location to get the top tourist attractions for")]) -> str:
    """Get the top tourist attractions for a given location."""
    return f"The top attractions for {location} are."

agent = ChatAgent(chat_client=OpenAIChatClient(), instructions="You are a helpful assistant", tools=[get_attractions])

result = await agent.run("What's the best place to visit in Seattle?", tools=[get_attractions])  # chỉ lượt này
```

### Thread

Thread dùng cho hội thoại nhiều lượt. Có hai cách:
- `get_new_thread()` tạo thread lưu được theo thời gian;
- thread tự tạo khi chạy agent, chỉ sống trong lần chạy đó.

```python
thread = agent.get_new_thread()
response = await agent.run("Hello, how are you?", thread=thread)

serialized_thread = await thread.serialize()                        # lưu vào storage
resumed_thread = await agent.deserialize_thread(serialized_thread)  # nạp lại sau
```

### Middleware

Agent tương tác với tool và LLM. Middleware cho bạn **chen vào giữa** các tương tác đó để chạy hay ghi lại gì đó.

**Function middleware** chen giữa agent và tool, vd ghi log lời gọi hàm. `next` quyết định gọi middleware tiếp theo hay hàm thật.

```python
async def logging_function_middleware(
    context: FunctionInvocationContext,
    next: Callable[[FunctionInvocationContext], Awaitable[None]],
) -> None:
    print(f"[Function] Calling {context.function.name}")      # trước
    await next(context)                                         # middleware tiếp hoặc hàm thật
    print(f"[Function] {context.function.name} completed")    # sau
```

**Chat middleware** chen giữa agent và LLM; `context.messages` là các message gửi tới dịch vụ AI.

```python
async def logging_chat_middleware(context: ChatContext, next: Callable[[ChatContext], Awaitable[None]]) -> None:
    print(f"[Chat] Sending {len(context.messages)} messages to AI")
    await next(context)
    print("[Chat] AI response received")
```

### Memory

Như Bài 13, MAF có ba loại:

- **In-memory storage:** lưu trong thread lúc app chạy.
- **Persistent messages:** lịch sử hội thoại xuyên phiên, qua `chat_message_store_factory`.

```python
from agent_framework import ChatMessageStore

agent = ChatAgent(chat_client=OpenAIChatClient(), instructions="You are a Travel assistant.",
                  chat_message_store_factory=lambda: ChatMessageStore())
```

- **Dynamic memory:** thêm vào context **trước khi** agent chạy, lưu ở dịch vụ ngoài như Mem0.

```python
from agent_framework.mem0 import Mem0Provider

memory_provider = Mem0Provider(api_key="your-mem0-api-key", user_id="user_123", application_id="my_app")
agent = ChatAgent(chat_client=OpenAIChatClient(), instructions="You are a helpful assistant with memory.",
                  context_providers=memory_provider)
```

### Observability

```python
from agent_framework.observability import get_tracer, get_meter

tracer = get_tracer()
meter = get_meter()
with tracer.start_as_current_span("my_custom_span"):
    pass
counter = meter.create_counter("my_custom_counter")
counter.add(1, {"key": "value"})
```

## Workflow

Workflow là **các bước định sẵn** để hoàn thành task, với agent là thành phần trong các bước. Workflow cho điều khiển luồng tốt hơn, hỗ trợ **điều phối multi-agent** và **checkpointing** để lưu trạng thái.

- **Executor:** nhận message, làm việc được giao, sinh message output để đẩy workflow tiến lên. Executor có thể là agent hoặc logic tự viết.
- **Edge:** định nghĩa luồng message.

| Loại edge | Ý nghĩa | Ví dụ |
|---|---|---|
| **Direct** | Nối một-một | Planner → Reviewer |
| **Conditional** | Kích hoạt khi thoả điều kiện | Hết phòng thì chuyển sang executor gợi ý lựa chọn khác |
| **Switch-case** | Định tuyến theo điều kiện | Khách ưu tiên đi workflow riêng |
| **Fan-out** | Một message tới nhiều đích | Gửi yêu cầu cho agent vé, khách sạn, xe cùng lúc |
| **Fan-in** | Gom nhiều message về một đích | Tổng hợp ba kết quả thành lịch trình |

```python
from agent_framework import WorkflowBuilder

builder = WorkflowBuilder()
builder.add_edge(source_executor, target_executor)
builder.set_start_executor(source_executor)
workflow = builder.build()
```

- **Event** có sẵn để quan sát:
  - `WorkflowStartedEvent`, `WorkflowOutputEvent`, `WorkflowErrorEvent`;
  - `ExecutorInvokeEvent`, `ExecutorCompleteEvent`;
  - `RequestInfoEvent` (có request được phát ra).

## Pattern nâng cao

- **Ghép middleware:** xâu chuỗi nhiều handler (logging, auth, rate-limit) để kiểm soát chi tiết.
- **Checkpoint workflow:** dùng event và serialization để lưu và tiếp tục quy trình dài.
- **Chọn tool động:** RAG trên mô tả tool + đăng ký tool của MAF, chỉ đưa tool liên quan cho mỗi truy vấn (chống context confusion, Bài 12).
- **Handoff nhiều agent:** dùng edge và định tuyến điều kiện để chuyển giao giữa agent chuyên trách.

## Host agent LangChain / LangGraph trên Microsoft Foundry

MAF **tương thích với framework khác**. Agent đã viết bằng **LangChain** hay **LangGraph** có thể chạy như **hosted agent của Foundry**: Foundry lo runtime, session, scale, identity và endpoint giao thức, còn logic vẫn ở LangGraph. Dùng gói `langchain_azure_ai.agents.hosting`.

```bash
pip install -U "langchain-azure-ai[hosting]>=1.2.4" azure-identity
export FOUNDRY_PROJECT_ENDPOINT="https://<resource>.services.ai.azure.com/api/projects/<project>"
export FOUNDRY_MODEL_NAME="gpt-5-mini"
```

| Giao thức | Host class | Endpoint | Khi nào |
|---|---|---|---|
| **Responses** | `ResponsesHostServer` | `/responses` | Chat tương thích OpenAI, streaming, lịch sử, thread. **Mặc định khuyên dùng** cho agent hội thoại. |
| **Invocations** | `InvocationsHostServer` | `/invocations` | Cần JSON tuỳ biến, endpoint kiểu webhook, xử lý không hội thoại. |

```python
from langchain.agents import create_agent
from langchain_azure_ai.agents.hosting import ResponsesHostServer

def main() -> None:
    graph = create_agent(build_chat_model(), tools=[])   # ChatOpenAI trỏ tới endpoint Responses của project Foundry
    ResponsesHostServer(graph).run(port=int(os.environ.get("PORT", "8088")))
```

Chạy local bằng `python main.py`, rồi gửi request tới `http://localhost:8088/responses`.

- **Hội thoại:** client tiếp tục bằng `previous_response_id` hoặc `conversation` ID. Graph có LangGraph checkpointer thì Foundry gắn trạng thái vào checkpoint. Production dùng checkpointer bền vững; `MemorySaver` chỉ để test local.
- **Human-in-the-loop:** `interrupt()` của LangGraph được hiện thành item `function_call` hoặc `mcp_approval_request`; client tiếp tục bằng `function_call_output` hoặc `mcp_approval_response`.
- **Deploy:**
  1. `azd ext install azure.ai.agents`;
  2. `azd ai agent init -m <manifest>`;
  3. `azd ai agent run` (local, cần Docker);
  4. `azd provision` và `azd deploy`.

  Cần role **Foundry Project Manager**.

:::senior Middleware của MAF ≈ hook của Claude Code
Function middleware chạy *trước và sau* mỗi tool call, có thể chặn bằng cách không gọi `next`. Giống hệt `PreToolUse` và `PostToolUse` hook trong [Claude Code](/claude-code/deep-dive/extending/hooks-thuc-chien).

Pattern "onion" (mỗi lớp bọc lớp trong) cũng là pattern của interceptor `HttpClient` trong Angular và middleware Express. Hiểu một cái là hiểu cả ba.
:::

:::quiz Trong function middleware, chuyện gì xảy ra nếu middleware không gọi `await next(context)`?
- [ ] Framework tự gọi hàm thật sau khi middleware xong
- [x] Middleware phía sau và hàm tool thật không chạy; middleware có thể tự đặt kết quả, vd chặn tool nguy hiểm
- [ ] Ném exception bắt buộc
- [ ] Chỉ phần log sau bị bỏ qua

`next` quyết định đi tiếp vào trong. Không gọi là "ngắt mạch", và đó là cách làm guard hay cache ở tầng middleware.
:::

:::quiz Bạn cần gửi một yêu cầu cho ba agent (vé, khách sạn, xe) chạy song song, rồi gom kết quả cho agent tổng hợp. Dùng loại edge nào?
- [ ] Hai direct edge
- [x] Fan-out edge rồi fan-in edge
- [ ] Switch-case edge
- [ ] Conditional edge

Fan-out gửi một message tới nhiều đích, fan-in gom nhiều message về một đích.
:::

:::quiz Khi host agent LangGraph trên Foundry cho chat hội thoại, nên chọn giao thức nào?
- [x] Responses (`ResponsesHostServer`, endpoint `/responses`)
- [ ] Invocations (`InvocationsHostServer`)
- [ ] A2A
- [ ] Không cần giao thức

Responses API là API chính cho phát triển kiểu agent trên Foundry: tương thích OpenAI, có streaming, lịch sử, thread. Invocations dành cho JSON tuỳ biến hoặc kiểu webhook.
:::

:::exercise Tự cài một chuỗi function middleware
Không cần MAF. Mô phỏng cơ chế `next` bằng asyncio:
1. Dataclass `FunctionInvocationContext(name, args, result, meta)`.
2. Ba middleware:
   - `logging_mw` in trước và sau;
   - `timing_mw` ghi `meta["ms"]`;
   - `guard_mw` **chặn** `delete_booking` (đặt `result` là lỗi, không gọi `next`).
3. `compose(middlewares, func)` trả về hàm chạy cả chuỗi theo thứ tự onion.

Thử với `get_attractions` và `delete_booking`.
???
```python
import asyncio, time
from dataclasses import dataclass, field

@dataclass
class FunctionInvocationContext:
    name: str
    args: dict
    result: object = None
    meta: dict = field(default_factory=dict)

async def logging_mw(ctx, next):
    print(f"[log] -> {ctx.name}")
    await next(ctx)
    print(f"[log] <- {ctx.name} = {ctx.result!r}")

async def timing_mw(ctx, next):
    t = time.perf_counter()
    await next(ctx)
    ctx.meta["ms"] = round((time.perf_counter() - t) * 1000)

async def guard_mw(ctx, next):
    if ctx.name in {"delete_booking"}:
        ctx.result = {"error": f"{ctx.name} cần người duyệt"}
        return                                  # không gọi next → hàm thật không chạy
    await next(ctx)

def compose(middlewares, func):
    async def run(ctx):
        async def call(i, c):
            if i == len(middlewares):
                c.result = await func(c.name, c.args)
                return
            await middlewares[i](c, lambda c2: call(i + 1, c2))
        await call(0, ctx)
        return ctx
    return run

async def tools(name, args):
    await asyncio.sleep(0.01)
    return {"get_attractions": lambda a: f"Top attractions in {a['location']}",
            "delete_booking": lambda a: "deleted"}[name](args)

async def main():
    run = compose([logging_mw, timing_mw, guard_mw], tools)
    await run(FunctionInvocationContext("get_attractions", {"location": "Hanoi"}))
    await run(FunctionInvocationContext("delete_booking", {"id": 7}))

asyncio.run(main())
```

Output khi chạy thử:

```text
[log] -> get_attractions
[log] <- get_attractions = 'Top attractions in Hanoi'
[log] -> delete_booking
[log] <- delete_booking = {'error': 'delete_booking cần người duyệt'}
```

Thứ tự trong danh sách quan trọng. `guard_mw` đứng **sau** `logging_mw` nên lần bị chặn vẫn được log, đúng điều bạn muốn cho audit. Đặt guard lên đầu thì lần bị chặn sẽ không để lại dấu vết.
:::

**Bài trước:** [Bài 13](/ai-agents/course/production-giao-thuc/agent-memory) · **Bài tiếp theo:** [Bài 15 — Browser use](/ai-agents/course/nang-cao/browser-use)
