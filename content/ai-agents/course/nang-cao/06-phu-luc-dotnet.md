---
title: "Phụ lục — Code mẫu .NET (C#) của khóa học"
summary: "Khóa học có bản C# cho nhiều bài: chạy một file .cs bằng dotnet run, tạo agent bằng AsAIAgent, tool bằng AIFunctionFactory, session, output có cấu trúc bằng JSON schema, RAG với FileSearch của Foundry, và workflow tuần tự, fan-out/fan-in trong Microsoft.Agents.AI.Workflows."
type: lesson
level: intermediate
lastReviewed: 2026-11-19
tags: [ai-agents, dotnet, csharp, microsoft-agent-framework]
related: [ai-agents/course/nen-tang/cai-dat-khoa-hoc, ai-agents/course/nang-cao/microsoft-agent-framework, ai-agents/course/ke-hoach-da-agent/multi-agent]
changelog:
  - date: 2026-11-19
    note: "Viết lại câu hỏi trắc nghiệm cho đủ dữ kiện khi xem riêng ở trang Luyện tập (kèm code/dữ liệu cần thiết, bỏ tham chiếu kiểu ở trên, Bước N)."
---

:::note Nguồn
Tổng hợp từ các file `*-dotnet-agent-framework.cs` / `.md` và thư mục `workflows-agent-framework/dotNET/` của [AI Agents for Beginners](https://github.com/microsoft/ai-agents-for-beginners) (Microsoft, MIT License). Môi trường biên soạn **không có .NET SDK**, nên code C# trong bài **chưa chạy thử**. Mình đọc code và đối chiếu với bản Python tương ứng. Tên gói và API dùng đúng như trong repo gốc; phiên bản có thể khác khi bạn đọc bài này.
:::

## Chạy một file `.cs` đơn lẻ

Từ .NET 10, có thể chạy thẳng một file C# mà không cần tạo project. Dependency khai báo bằng chỉ thị `#:package` ngay đầu file:

```csharp
#!/usr/bin/dotnet run
#:package Microsoft.Extensions.AI@10.4.1
#:package Microsoft.Agents.AI.OpenAI@1.1.0
#:package Azure.AI.OpenAI@2.1.0
#:package Azure.Identity@1.13.1
```

```bash
dotnet --list-sdks                  # cần .NET 10 trở lên
export AZURE_OPENAI_ENDPOINT="https://<resource>.openai.azure.com"
export AZURE_OPENAI_DEPLOYMENT="gpt-5-mini"
az login                            # AzureCliCredential lấy token từ đây
dotnet run 01-dotnet-agent-framework.cs
```

Bản .NET dùng **Azure OpenAI trực tiếp** (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`), không qua project Foundry như bản Python. Một số file (bài 5, 8) đọc `.env` bằng gói `DotNetEnv`.

## Bảng đối chiếu Python ↔ C#

| Khái niệm | Python (MAF) | C# (Microsoft.Agents.AI) |
|---|---|---|
| Client | `FoundryChatClient(...)` | `new AzureOpenAIClient(new Uri(endpoint), new AzureCliCredential()).GetChatClient(deployment)` |
| Tạo agent | `provider.as_agent(name=..., instructions=..., tools=[...])` | `.AsAIAgent(instructions: ..., tools: [...])` hoặc `.AsAIAgent(ChatClientAgentOptions)` |
| Tool | Hàm Python + `@tool`, docstring làm mô tả | Hàm `static` + `[Description("...")]`, đăng ký qua `AIFunctionFactory.Create(Ham)` |
| Mô tả tham số | `Annotated[str, "..."]` | `[Description("...")] string location` |
| Chạy | `await agent.run(...)` | `await agent.RunAsync(...)` |
| Streaming | `agent.run(..., stream=True)` | `await foreach (var u in agent.RunStreamingAsync(...))` |
| Hội thoại nhiều lượt | `agent.create_session()` | `AgentSession session = await agent.CreateSessionAsync();` |
| Output có cấu trúc | `options={"response_format": Model}` | `ChatOptions.ResponseFormat = ChatResponseFormatJson.ForJsonSchema(AIJsonUtilities.CreateJsonSchema(typeof(Model)), ...)` |
| Workflow | `WorkflowBuilder(start_executor=a).add_edge(a, b)` | `new WorkflowBuilder(a).AddEdge(a, b).Build()` |
| Chạy workflow | `await workflow.run(...)` | `await InProcessExecution.RunStreamingAsync(workflow, input)` |

## Bài 1: agent du lịch đầu tiên

```csharp
[Description("Provides a random vacation destination.")]
static string GetRandomDestination()
{
    var destinations = new List<string> { "Paris, France", "Tokyo, Japan", "New York City, USA", "Sydney, Australia",
        "Rome, Italy", "Barcelona, Spain", "Cape Town, South Africa", "Rio de Janeiro, Brazil", "Bangkok, Thailand", "Vancouver, Canada" };
    return destinations[new Random().Next(destinations.Count)];
}

var azureEndpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT")
    ?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT is not set.");
var deployment = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT") ?? "gpt-5-mini";
var azureClient = new AzureOpenAIClient(new Uri(azureEndpoint), new AzureCliCredential());

AIAgent agent = azureClient.GetChatClient(deployment).AsAIAgent(
    instructions: "You are a helpful AI Agent that can help plan vacations for customers at random destinations",
    tools: [AIFunctionFactory.Create(GetRandomDestination)]);

await foreach (var update in agent.RunStreamingAsync("Plan me a day trip"))
    Console.Write(update);
```

`[Description]` trên hàm và trên tham số đóng vai trò của docstring và `Annotated` trong Python: đó là thứ model đọc để quyết định gọi tool.

## Bài 2, 3: session và nhiều tool

- **Bài 2:** hai lượt "Plan me a day trip" rồi "I don't like that destination. Plan me another vacation." trong **cùng một `AgentSession`**, nên agent nhớ điểm đến vừa gợi ý và đổi sang nơi khác.
- **Bài 3:** thêm tool `SaveUserPreference` cạnh `GetRandomDestination`. Ba lượt trong một session: chào, nêu sở thích ("luxury travel and cultural experiences"), xin gợi ý. Agent dùng sở thích đã lưu để gợi ý.

## Bài 4: nhiều tool có tham số

Ba tool:
- `GetRandomDestination()`;
- `GetWeather([Description("The city and country...")] string location)`: tra dict thời tiết giả theo tên thành phố, không có thì trả "Mild conditions, around 20°C";
- `GetDestinationInfo(string destination, string category = "all")`: điểm tham quan, ẩm thực, mẹo.

Tham số có giá trị mặc định (`category = "all"`) được `AIFunctionFactory` đưa vào schema là **không bắt buộc**.

## Bài 5: RAG bằng File Search của Foundry (Persistent Agents)

Bản .NET làm RAG **phía server**, khác bản Python dùng dict trong bộ nhớ:
1. upload file `document.md` (giới thiệu công ty Contoso Travel: tour cao cấp, bảo hiểm du lịch…);
2. tạo **vector store** từ file đó;
3. tạo `PersistentAgent` có tool `FileSearchToolDefinition` gắn vector store;
4. hỏi *"Can you explain Contoso's travel insurance coverage?"*.

```csharp
PersistentAgent agentModel = await persistentAgentsClient.Administration.CreateAgentAsync(
    azure_foundry_model_id,
    name: "DotNetRAGAgent",
    tools: [new FileSearchToolDefinition()],
    instructions: """
        You are an AI assistant designed to answer user questions using only the information retrieved from the provided document(s).
        - If a user's question cannot be answered using the retrieved context, you must clearly respond:
          "I'm sorry, but the uploaded document does not contain the necessary information to answer that question."
        - Do not answer from general knowledge or reasoning...
        """,
    toolResources: new() { FileSearch = new() { VectorStoreIds = { fileStore.Id } } });

AIAgent agent = await persistentAgentsClient.GetAIAgentAsync(agentModel.Id);
AgentThread thread = agent.GetNewThread();
Console.WriteLine(await agent.RunAsync("Can you explain Contoso's travel insurance coverage?", thread));
```

Instructions đặt **ranh giới grounding rất chặt**: chỉ trả lời từ tài liệu; hỏi ngoài phạm vi (vd "Neural Network là gì?") thì trả đúng câu từ chối định sẵn. File này ghim các gói **bản preview cũ** (`1.0.0-preview.251001.3`) và dùng `GetNewThread()` thay vì `CreateSessionAsync()`. Đây là ví dụ cho việc API MAF đổi tên giữa các phiên bản (xem Bài 14).

## Bài 7: planner với output có cấu trúc

```csharp
ChatClientAgentOptions agentOptions = new()
{
    Name = AGENT_NAME,
    Description = AGENT_INSTRUCTIONS,
    ChatOptions = new()
    {
        ResponseFormat = ChatResponseFormatJson.ForJsonSchema(
            schema: AIJsonUtilities.CreateJsonSchema(typeof(TravelPlan)),
            schemaName: "TravelPlan",
            schemaDescription: "Travel Plan with main_task and subtasks")
    }
};
AIAgent agent = azureClient.GetChatClient(deployment).AsAIAgent(agentOptions);
Console.WriteLine(await agent.RunAsync("Create a travel plan for a family of 4, with 2 kids, from Singapore to Melbourne"));

public class TravelPlan { /* main_task, subtasks: List<Plan> */ }
```

`AIJsonUtilities.CreateJsonSchema(typeof(TravelPlan))` sinh JSON schema từ class C#, tương đương việc truyền model Pydantic ở Python.

:::warning `Description` không phải `Instructions`
Ở bài 7 và bài 8, chỉ dẫn hệ thống được gán vào **`Description`** của `ChatClientAgentOptions`. `Description` là mô tả agent dành cho bên ngoài (vd để agent khác hay orchestrator biết agent này làm gì); nó không phải system prompt. Bài 2 thì truyền đúng qua tham số `instructions:`.

Nếu agent bài 7 hay bài 8 không theo đúng vai, hãy kiểm tra phiên bản gói bạn dùng có thuộc tính `Instructions` trong options không (hoặc dùng overload `AsAIAgent(instructions: ..., name: ...)`), rồi chuyển chỉ dẫn sang đó.
:::

## Bài 8: workflow

**08-dotnet (FrontDesk → Concierge):**

```csharp
var workflow = new WorkflowBuilder(frontdeskAgent).AddEdge(frontdeskAgent, reviewerAgent).Build();

StreamingRun run = await InProcessExecution.RunStreamingAsync(workflow, new ChatMessage(ChatRole.User, "I would like to go to Paris."));
await run.TrySendMessageAsync(new TurnToken(emitEvents: true));     // "trao lượt" để agent bắt đầu xử lý
await foreach (WorkflowEvent evt in run.WatchStreamAsync())
    if (evt is AgentResponseUpdateEvent update) Console.Write(update.Data);
```

Điểm khác Python: agent trong workflow C# **nhận message rồi chờ** cho đến khi nhận **`TurnToken`** mới bắt đầu xử lý.

**dotNET/03 (song song, fan-out + fan-in có barrier):**

```csharp
var workflow = new WorkflowBuilder(startExecutor)
    .AddFanOutEdge(startExecutor, targets: [researcherAgent, plannerAgent])
    .AddFanInBarrierEdge(sources: [researcherAgent, plannerAgent], aggregationExecutor)
    .Build();

public class ConcurrentStartExecutor() : Executor<string>("ConcurrentStartExecutor")
{
    [MessageHandler]
    public override async ValueTask HandleAsync(string message, IWorkflowContext context, CancellationToken ct = default)
    {
        await context.SendMessageAsync(new ChatMessage(ChatRole.User, message));   // phát message cho mọi agent
        await context.SendMessageAsync(new TurnToken(emitEvents: true));          // rồi trao lượt để chúng chạy
    }
}
// ConcurrentAggregationExecutor gom message (có lock), đủ 2 kết quả thì yield output
```

So với bản Python cùng bài, bản C# có thêm **fan-in barrier**: chờ **cả hai** agent xong rồi mới gộp kết quả. Các file khác trong `dotNET/` tương ứng với bản Python: 01 basic, 02 sequential (Sales → Price → Quote), 04 conditional (cần Foundry và Bing).

## Phụ: Azure AI Search bằng .NET (`AzureSearch.cs`)

```bash
dotnet run ./AzureSearch.cs
```

File dùng `#:package Azure.Search.Documents@11.*` và `Azure.Identity`, xác thực bằng `DefaultAzureCredential` (dùng phiên `az login`). Nó tạo index `sample-index` (trường `id` là khoá, `content` tìm được) rồi upload hai tài liệu mẫu, giống bản Python ở Bài 0.

:::quiz Trong C#, thứ gì đóng vai trò của docstring và `Annotated[...]` của Python để model hiểu tool?
- [ ] Comment `//` phía trên hàm
- [x] Thuộc tính `[Description("...")]` trên hàm và trên từng tham số, đăng ký qua `AIFunctionFactory.Create`
- [ ] Tên file `.cs`
- [ ] `ChatClientAgentOptions.Description`

`AIFunctionFactory` đọc `[Description]` để sinh schema tool. `ChatClientAgentOptions.Description` là mô tả của **agent**, không phải của tool.
:::

:::quiz Trong workflow C# (Microsoft Agent Framework) dưới đây, vì sao phải gửi `TurnToken` sau khi gửi message?
```csharp
var workflow = new WorkflowBuilder(frontdeskAgent).AddEdge(frontdeskAgent, reviewerAgent).Build();

StreamingRun run = await InProcessExecution.RunStreamingAsync(workflow, new ChatMessage(ChatRole.User, "I would like to go to Paris."));
await run.TrySendMessageAsync(new TurnToken(emitEvents: true));
await foreach (WorkflowEvent evt in run.WatchStreamAsync())
    if (evt is AgentResponseUpdateEvent update) Console.Write(update.Data);
```

- [ ] Để xác thực với Azure
- [x] Agent trong workflow nhận và xếp hàng message, nhưng chỉ bắt đầu xử lý khi nhận turn token
- [ ] Để giới hạn số token output
- [ ] Không bắt buộc, chỉ để log

`ConcurrentStartExecutor` cũng làm đúng hai bước: phát `ChatMessage`, rồi phát `TurnToken(emitEvents: true)`.
:::

:::exercise Chuyển agent bài 4 sang C#
Viết bằng C# (dạng một file chạy bằng `dotnet run`) agent có hai tool:
- `GetWeather(string location)`: trả thời tiết giả cho "Hanoi" và "Tokyo", mặc định "Mild";
- `GetFlightInfo(string origin, string destination)`.

Yêu cầu:
1. dùng `[Description]` cho hàm và tham số;
2. tạo agent bằng `AsAIAgent(instructions:, tools:)`;
3. chạy hai lượt trong cùng một `AgentSession` (lượt 2 hỏi tiếp về "thành phố đó");
4. chỉ dẫn hệ thống truyền qua `instructions:`, **không** qua `Description`.
???
```csharp
#!/usr/bin/dotnet run
#:package Microsoft.Extensions.AI@10.*
#:package Microsoft.Agents.AI.OpenAI@1.*-*
#:package Azure.AI.OpenAI@2.1.0
#:package Azure.Identity@1.13.1

using System.ComponentModel;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Azure.AI.OpenAI;
using Azure.Identity;

[Description("Gets the current weather for a city.")]
static string GetWeather([Description("City name, e.g. 'Hanoi'")] string location) =>
    location.ToLower() switch
    {
        var l when l.Contains("hanoi") => "Hanoi: Cloudy, 24°C",
        var l when l.Contains("tokyo") => "Tokyo: Sunny, 18°C",
        _ => $"{location}: Mild, around 20°C",
    };

[Description("Gets flight information between two airports.")]
static string GetFlightInfo([Description("Origin IATA code, e.g. HAN")] string origin,
                            [Description("Destination IATA code, e.g. NRT")] string destination) =>
    $"{origin}-{destination}: VN310, departs 00:30, arrives 07:45, $420";

var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT")
    ?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT is not set.");
var deployment = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT") ?? "gpt-5-mini";

AIAgent agent = new AzureOpenAIClient(new Uri(endpoint), new AzureCliCredential())
    .GetChatClient(deployment)
    .AsAIAgent(
        instructions: "You are a travel assistant. Use the tools for weather and flights. Be concise.",
        tools: [AIFunctionFactory.Create(GetWeather), AIFunctionFactory.Create(GetFlightInfo)]);

AgentSession session = await agent.CreateSessionAsync();
Console.WriteLine(await agent.RunAsync("Find me a flight from HAN to NRT.", session));
Console.WriteLine(await agent.RunAsync("What's the weather like in that city?", session));   // "that city" = Tokyo nhờ session
```

Code này viết theo đúng API trong các file mẫu của khóa (bài 1, 2, 4) và **chưa được biên dịch** ở đây. Nếu gói bạn cài có API khác (vd `GetNewThread` thay `CreateSessionAsync`), đối chiếu với file mẫu cùng phiên bản gói.
:::

**Quay lại:** [Bài 14 — Microsoft Agent Framework](/ai-agents/course/nang-cao/microsoft-agent-framework)
