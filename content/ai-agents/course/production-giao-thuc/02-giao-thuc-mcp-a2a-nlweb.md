---
title: "Bài 11 — Giao thức agentic: MCP, A2A và NLWeb"
summary: "Ba giao thức chuẩn hoá hệ agent: MCP nối LLM với tool và dữ liệu (host, client, server; tools, resources, prompts); A2A cho agent của các tổ chức khác nhau cộng tác (Agent Card, Executor, Artifact, Event Queue); NLWeb đưa giao diện ngôn ngữ tự nhiên vào website và biến nó thành MCP server."
type: lesson
level: intermediate
lastReviewed: 2026-11-17
tags: [ai-agents, mcp, a2a, nlweb, protocols]
related: [ai-agents/course/cong-cu-tri-thuc/tool-use, ai-agents/course/ke-hoach-da-agent/multi-agent, claude-code/deep-dive/extending/mcp-va-plugin]
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 11 Agentic Protocols](https://github.com/microsoft/ai-agents-for-beginners/tree/main/11-agentic-protocols) (Microsoft, MIT License).
:::

Agent càng phổ biến thì càng cần giao thức để **chuẩn hoá, bảo mật và hỗ trợ đổi mới mở**. Bài này giới thiệu ba giao thức:

- **MCP** cho agent truy cập tool và dữ liệu bên ngoài;
- **A2A** cho các agent giao tiếp và cộng tác với nhau;
- **NLWeb** đưa giao diện ngôn ngữ tự nhiên vào bất kỳ website nào, để agent khám phá và tương tác với nội dung.

**Mục tiêu:**
- **nhận diện** mục đích và lợi ích của từng giao thức;
- **giải thích** cách mỗi giao thức hỗ trợ tương tác giữa LLM, tool và agent;
- **phân biệt** vai trò của từng giao thức trong hệ agentic phức tạp.

## Model Context Protocol (MCP)

**MCP** là chuẩn mở cho ứng dụng cung cấp context và tool cho LLM theo cách thống nhất, như một **"bộ chuyển đổi vạn năng"** để agent nối tới nhiều nguồn dữ liệu và tool một cách nhất quán.

### Thành phần

MCP theo kiến trúc **client-server**:

- **Host**: ứng dụng LLM (vd trình soạn code như VS Code), khởi tạo kết nối tới MCP server.
- **Client**: thành phần trong host, giữ kết nối **một-một** với từng server.
- **Server**: chương trình nhẹ, phơi ra các năng lực cụ thể.

Ba **primitive** cốt lõi, tức năng lực mà MCP server cung cấp:

| Primitive | Là gì | Ví dụ |
|---|---|---|
| **Tools** | Hành động hoặc hàm agent gọi được. Server công bố tên, mô tả và schema input/output của từng tool. | `get_weather`, `purchase_product` |
| **Resources** | Dữ liệu **chỉ đọc** client lấy khi cần; dạng text (code, JSON) hoặc nhị phân (ảnh, PDF). | Nội dung file, bản ghi database, file log |
| **Prompts** | Template prompt định sẵn, cho workflow phức tạp hơn. | Prompt "review PR theo checklist" |

### Lợi ích

- **Khám phá tool động:** agent nhận danh sách tool kèm mô tả từ server ngay lúc chạy. API truyền thống thường phải code tích hợp tĩnh, API đổi là phải sửa code. MCP theo kiểu **"tích hợp một lần"**, linh hoạt hơn.
- **Tương thích nhiều LLM:** MCP chạy với nhiều model khác nhau, dễ đổi model lõi để thử hiệu năng.
- **Bảo mật chuẩn hoá:** có phương thức xác thực chuẩn, dễ mở rộng khi thêm server. Đơn giản hơn quản lý đủ loại key và kiểu xác thực của từng API.

### Ví dụ: đặt vé qua MCP

1. **Kết nối:** trợ lý AI (MCP client) nối tới MCP server của hãng hàng không.
2. **Khám phá tool:** client hỏi "Bạn có tool gì?". Server trả về `search flights`, `book flights`.
3. **Gọi tool:** bạn nói "Tìm chuyến bay từ Portland đi Honolulu". LLM xác định cần gọi `search flights`, truyền tham số điểm đi và điểm đến cho server.
4. **Thực thi và trả kết quả:** server (đóng vai lớp bọc) gọi API đặt vé nội bộ của hãng, nhận dữ liệu (vd JSON) và gửi lại trợ lý.
5. **Tương tác tiếp:** trợ lý trình bày các chuyến; bạn chọn xong thì trợ lý gọi `book flight` trên cùng server để hoàn tất.

## Agent-to-Agent Protocol (A2A)

MCP nối LLM với **tool**. **A2A** tiến thêm một bước: cho **các agent** giao tiếp và cộng tác, xuyên tổ chức, môi trường và tech stack, để cùng hoàn thành một task.

### Thành phần

- **Agent Card**: giống danh sách tool của MCP server, nhưng cho agent. Gồm:
  - tên agent;
  - **mô tả các task chung** nó làm;
  - **danh sách skill cụ thể** kèm mô tả, để agent khác (hay người) biết khi nào và vì sao gọi nó;
  - **endpoint URL** hiện tại;
  - **phiên bản** và **năng lực** (streaming, push notification…).
- **Agent Executor**: **chuyển ngữ cảnh cuộc chat của người dùng** cho agent từ xa để nó hiểu task. Trong A2A server, agent dùng **LLM riêng** để parse request và chạy task bằng **tool nội bộ của nó**.
- **Artifact**: khi agent từ xa làm xong, sản phẩm được đóng gói thành artifact, gồm **kết quả**, **mô tả việc đã làm**, và **text context** gửi qua giao thức. Gửi xong artifact thì kết nối đóng tới khi cần lại.
- **Event Queue**: xử lý cập nhật và chuyển message. Đặc biệt quan trọng ở production, để **kết nối không bị đóng trước khi task xong**, nhất là task chạy lâu.

### Lợi ích

- **Cộng tác tốt hơn:** agent của nhiều nhà cung cấp và nền tảng tương tác, chia sẻ ngữ cảnh, tự động hoá xuyên các hệ vốn rời rạc.
- **Tự do chọn model:** mỗi agent A2A tự chọn LLM phục vụ request của mình, tối ưu hoặc fine-tune theo agent. Khác với một số kịch bản MCP chỉ có một kết nối LLM.
- **Xác thực tích hợp:** xác thực nằm ngay trong giao thức.

### Ví dụ: đặt trọn chuyến đi qua A2A

1. Người dùng nói với "Travel Agent" (A2A client/agent): *"Đặt trọn chuyến đi Honolulu tuần sau: vé bay, khách sạn, thuê xe."*
2. **Điều phối:** Travel Agent dùng LLM để suy luận và thấy cần tới các agent chuyên trách.
3. **Giao tiếp giữa agent:** qua A2A, nó nối tới "Airline Agent", "Hotel Agent", "Car Rental Agent", do **các công ty khác nhau** xây.
4. **Giao việc:** gửi task cụ thể ("tìm vé đi Honolulu", "đặt khách sạn", "thuê xe"). Mỗi agent chạy LLM riêng, dùng tool riêng (bản thân có thể là MCP server).
5. **Gom kết quả:** Travel Agent tổng hợp thông tin vé, xác nhận khách sạn, đặt xe, rồi trả lời người dùng dạng chat.

## Natural Language Web (NLWeb)

Website lâu nay là cách chính để người dùng truy cập thông tin trên internet. NLWeb đưa **giao diện ngôn ngữ tự nhiên** vào website, cho cả người lẫn agent.

### Thành phần

- **NLWeb Application** (code dịch vụ lõi): xử lý câu hỏi ngôn ngữ tự nhiên, nối các phần của nền tảng để tạo câu trả lời. Là **động cơ** cho tính năng ngôn ngữ tự nhiên của website.
- **NLWeb Protocol**: bộ quy tắc cơ bản cho tương tác ngôn ngữ tự nhiên với website. Trả **JSON** (thường dùng Schema.org). Mục tiêu là tạo nền đơn giản cho "AI Web", như HTML đã giúp chia sẻ tài liệu trên mạng.
- **MCP Server**: mỗi bản cài NLWeb **cũng là một MCP server**, chia sẻ tool (như phương thức `ask`) và dữ liệu cho hệ AI khác. Website nhờ vậy thành một phần của "hệ sinh thái agent".
- **Embedding model**: chuyển nội dung website thành **vector** (embedding) mang ngữ nghĩa để so sánh và tìm kiếm. Bạn chọn model embedding.
- **Vector database**: lưu embedding. Khi có câu hỏi, NLWeb tra để nhanh chóng ra danh sách kết quả xếp theo độ tương đồng. Hỗ trợ Qdrant, Snowflake, Milvus, Azure AI Search, Elasticsearch.

### Ví dụ: website du lịch chạy NLWeb

1. **Nạp dữ liệu:** catalog sẵn có (chuyến bay, mô tả khách sạn, tour) được định dạng theo Schema.org hoặc nạp qua RSS. NLWeb tạo embedding và lưu vào vector DB local hoặc remote.
2. **Người dùng hỏi:** thay vì bấm menu, gõ *"Tìm khách sạn hợp gia đình ở Honolulu có hồ bơi cho tuần sau"*.
3. **NLWeb xử lý:** gửi câu hỏi cho LLM để hiểu, **đồng thời** tìm trong vector DB.
4. **Kết quả chính xác:** LLM diễn giải kết quả, chọn khớp nhất theo "hợp gia đình", "hồ bơi", "Honolulu", rồi viết câu trả lời. Điểm then chốt: câu trả lời **dẫn tới khách sạn có thật trong catalog**, không bịa.
5. **Agent tương tác:** vì NLWeb là MCP server, một agent du lịch bên ngoài có thể gọi `ask("Are there any vegan-friendly restaurants in the Honolulu area recommended by the hotel?")` và nhận JSON có cấu trúc.

## So sánh nhanh

| | MCP | A2A | NLWeb |
|---|---|---|---|
| Nối cái gì | LLM/agent ↔ **tool và dữ liệu** | Agent ↔ **agent** (khác tổ chức) | Người hoặc agent ↔ **nội dung website** |
| Đơn vị công bố | Danh sách tool, resource, prompt | **Agent Card** | Phương thức `ask` (qua MCP) + JSON Schema.org |
| Ai chạy LLM | Host (phía client) | **Mỗi agent tự chạy LLM riêng** | Dịch vụ NLWeb của website |
| Kết quả | Kết quả tool | **Artifact** | Câu trả lời dựa trên catalog thật |

:::senior Liên hệ Claude Code
Claude Code là một **MCP host**: `claude mcp add` tạo client nối tới server, tool của server hiện ra cùng tool có sẵn (xem [MCP và plugin](/claude-code/deep-dive/extending/mcp-va-plugin)). Khi phỏng vấn, câu "MCP khác function calling thế nào?" trả lời được ngay:
- function calling là cơ chế *trong một lần gọi model*;
- MCP là *giao thức chuẩn* để khám phá và gọi tool **từ bên ngoài ứng dụng**, tích hợp một lần, dùng với nhiều model.
:::

:::quiz Trong MCP, primitive nào là dữ liệu chỉ đọc mà client lấy khi cần, như nội dung file hay bản ghi database?
- [ ] Tools
- [x] Resources
- [ ] Prompts
- [ ] Agent Card

Tools là hành động, Prompts là template, Resources là dữ liệu chỉ đọc (text hoặc nhị phân). Agent Card thuộc A2A.
:::

:::quiz Một agent đặt vé của hãng hàng không A cần nhờ agent khách sạn của công ty B (công ty B tự chạy LLM và tool riêng) làm một phần việc. Giao thức nào phù hợp nhất?
- [ ] MCP
- [x] A2A
- [ ] NLWeb
- [ ] REST thường, không cần giao thức

A2A sinh ra cho agent của các tổ chức khác nhau cộng tác: Agent Card để khám phá, Executor chuyển ngữ cảnh, Artifact trả kết quả, mỗi bên tự chọn LLM.
:::

:::quiz Vì sao câu trả lời của NLWeb ít bị "bịa"?
- [ ] Vì NLWeb dùng model lớn nhất
- [x] Vì câu trả lời dựa trên kết quả tìm trong vector database chứa catalog thật của website
- [ ] Vì NLWeb không dùng LLM
- [ ] Vì NLWeb chỉ trả HTML

LLM chỉ diễn giải và định dạng kết quả tìm được từ dữ liệu của chính website (grounding), nên câu trả lời trỏ tới mục có thật.
:::

:::exercise Viết Agent Card và danh sách tool MCP cho một dịch vụ của bạn
Chọn một dịch vụ, vd "Sổ chi tiêu" trong Lab 15 của môn Claude Code.
1. Viết danh sách **3 tool MCP** (tên, mô tả, schema input) và **1 resource**.
2. Viết một **Agent Card** (dạng JSON) nếu dịch vụ được công bố như agent A2A: name, description, skills (≥ 2), url, version, capabilities.
3. Một câu: khi nào bạn chọn công bố bằng MCP, khi nào bằng A2A?
???
**1. MCP**

```json
{
  "tools": [
    { "name": "add_expense", "description": "Thêm một khoản chi",
      "inputSchema": { "type": "object", "required": ["amount", "category", "date"],
        "properties": { "amount": { "type": "integer", "minimum": 1 }, "category": { "type": "string" },
                        "date": { "type": "string", "format": "date" }, "note": { "type": "string" } } } },
    { "name": "list_expenses", "description": "Liệt kê khoản chi theo tháng",
      "inputSchema": { "type": "object", "required": ["month"], "properties": { "month": { "type": "string", "pattern": "^\\d{4}-\\d{2}$" } } } },
    { "name": "monthly_summary", "description": "Tổng chi theo danh mục trong một tháng",
      "inputSchema": { "type": "object", "required": ["month"], "properties": { "month": { "type": "string" } } } }
  ],
  "resources": [ { "uri": "expenses://categories", "name": "Danh mục chi tiêu", "mimeType": "application/json" } ]
}
```

**2. Agent Card**

```json
{
  "name": "Budget Agent",
  "description": "Theo dõi chi tiêu cá nhân và đưa nhận xét ngân sách hằng tháng",
  "url": "https://example.com/a2a/budget",
  "version": "1.0.0",
  "capabilities": { "streaming": true, "pushNotifications": false },
  "skills": [
    { "id": "record-expense", "name": "Ghi khoản chi", "description": "Ghi chi tiêu từ câu tự nhiên, vd 'ăn trưa 45k hôm qua'" },
    { "id": "budget-review", "name": "Nhận xét ngân sách", "description": "So chi tiêu tháng với ngân sách, chỉ ra danh mục vượt" }
  ]
}
```

**3. Chọn giao thức**
- **MCP**: khi bên gọi tự suy luận và chỉ cần hành động hoặc dữ liệu của bạn (tool rời rạc, tất định).
- **A2A**: khi dịch vụ của bạn tự cần LLM để hiểu yêu cầu mơ hồ và tự quyết nhiều bước (vd "nhận xét ngân sách"), rồi trả về một artifact.

Agent A2A vẫn có thể dùng MCP bên trong.
:::

**Bài trước:** [Bài 10](/ai-agents/course/production-giao-thuc/agent-trong-production) · **Bài tiếp theo:** [Bài 12 — Context engineering](/ai-agents/course/production-giao-thuc/context-engineering)
