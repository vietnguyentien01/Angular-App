---
title: "Bài 13 — Memory cho AI Agent: các loại bộ nhớ, Mem0, Cognee và agent tự cải thiện"
summary: "Memory biến agent stateless thành stateful: bảy loại bộ nhớ (working, short-term, long-term, persona, episodic, entity, structured RAG), AgentSession của MAF, Mem0 và Cognee, Azure AI Search làm backend, và mẫu knowledge agent tự cải thiện."
type: lesson
level: intermediate
lastReviewed: 2026-11-17
tags: [ai-agents, memory, mem0, cognee, personalization]
related: [ai-agents/course/production-giao-thuc/context-engineering, ai-agents/course/cong-cu-tri-thuc/agentic-rag, claude-code/review/memory/claude-md-ngan-gon]
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 13 Agent Memory](https://github.com/microsoft/ai-agents-for-beginners/tree/main/13-agent-memory) (Microsoft, MIT License). Hàm `search_hotels` của notebook và lời giải bài tập **đã chạy thử** bằng Python 3.
:::

Hai lợi ích hay được nhắc nhất của agent là **gọi tool** để làm việc và **tốt dần lên theo thời gian**. Memory là nền của agent tự cải thiện, mang lại trải nghiệm tốt hơn cho người dùng.

**Hai notebook đi kèm:**
- [`13-agent-memory.ipynb`](https://github.com/microsoft/ai-agents-for-beginners/blob/main/13-agent-memory/13-agent-memory.ipynb): memory với Mem0 và Azure AI Search trên Microsoft Agent Framework.
- [`13-agent-memory-cognee.ipynb`](https://github.com/microsoft/ai-agents-for-beginners/blob/main/13-agent-memory/13-agent-memory-cognee.ipynb): memory có cấu trúc với Cognee: tự dựng knowledge graph có embedding, trực quan hoá graph, truy xuất thông minh.

**Mục tiêu:**
- phân biệt các loại memory: working, short-term, long-term, và dạng chuyên biệt như persona, episodic;
- triển khai memory ngắn và dài hạn với Microsoft Agent Framework (Mem0, Cognee, Whiteboard memory, Azure AI Search);
- hiểu nguyên lý agent tự cải thiện.

## Memory của agent là gì?

Cốt lõi, **memory là cơ chế cho agent giữ và nhớ lại thông tin**: chi tiết cuộc hội thoại, sở thích người dùng, hành động cũ, hay pattern đã học.

Không có memory, ứng dụng AI thường **stateless**: mỗi lần tương tác bắt đầu từ đầu. Người dùng phải lặp lại, agent "quên" ngữ cảnh và sở thích, trải nghiệm bực bội.

**Vì sao quan trọng:** trí thông minh của agent gắn chặt với khả năng nhớ và dùng thông tin cũ. Memory cho agent:
- **biết phản tư:** học từ hành động và kết quả cũ;
- **tương tác liền mạch:** giữ ngữ cảnh trong hội thoại;
- **chủ động và phản ứng đúng:** đoán nhu cầu, đáp ứng dựa trên lịch sử;
- **tự chủ:** hoạt động độc lập hơn nhờ tri thức đã lưu.

Mục tiêu là agent **đáng tin và giỏi hơn**.

## Các loại memory

| Loại | Là gì | Ví dụ agent du lịch |
|---|---|---|
| **Working memory** | "Giấy nháp" cho một task hay luồng suy nghĩ đang diễn ra, giữ thông tin tức thời để tính bước tiếp. Thường trích phần quan trọng nhất của hội thoại (yêu cầu, đề xuất, quyết định, hành động) dù lịch sử chat dài hay bị cắt. | "Tôi muốn đặt chuyến đi Paris" được giữ trong context tức thời để dẫn tương tác hiện tại. |
| **Short-term memory** | Thông tin trong **một cuộc hội thoại hoặc phiên**; cho agent tham chiếu lượt trước. | Hỏi "Vé đi Paris bao nhiêu?" rồi "Còn chỗ ở **ở đó** thì sao?", agent biết "ở đó" là Paris. |
| **Long-term memory** | Thông tin tồn tại **qua nhiều phiên**: sở thích, lịch sử, kiến thức chung. Quan trọng cho cá nhân hoá. | "Ben thích trượt tuyết và hoạt động ngoài trời, thích cà phê view núi, tránh dốc trượt khó vì chấn thương cũ." |
| **Persona memory** | Giúp agent giữ "tính cách" hoặc vai trò nhất quán: nhớ về chính nó. | Agent được thiết kế là "chuyên gia lên kế hoạch trượt tuyết", nên giọng và kiến thức theo đúng vai. |
| **Workflow / episodic memory** | Lưu **chuỗi bước** agent làm trong task phức tạp, kể cả thành công và thất bại, như nhớ những "tập" kinh nghiệm cụ thể. | Đặt một chuyến bay thất bại vì hết chỗ thì ghi lại, lần sau thử chuyến khác hoặc báo người dùng rõ hơn. |
| **Entity memory** | Trích và nhớ **thực thể** (người, nơi, vật) và sự kiện, tạo hiểu biết có cấu trúc. | Từ chuyện chuyến đi cũ trích "Paris", "Eiffel Tower", "dinner at Le Chat Noir". Lần sau gợi ý đặt lại Le Chat Noir. |
| **Structured RAG** | Trích thông tin dày đặc, có cấu trúc từ nhiều nguồn (hội thoại, email, ảnh) để tăng độ chính xác, độ phủ và tốc độ. Khác RAG cổ điển chỉ dựa độ tương đồng ngữ nghĩa, nó **tận dụng cấu trúc vốn có** của thông tin. | Parse chi tiết chuyến bay (điểm đến, ngày, giờ, hãng) từ email và lưu có cấu trúc, để hỏi chính xác "Tôi đã đặt chuyến nào đi Paris hôm thứ Ba?". |

### Short-term memory trong Microsoft Agent Framework

Trong Python SDK của MAF, short-term memory là **`AgentSession`**, tạo bằng `agent.create_session()`. Session giữ ngữ cảnh hội thoại khi được dùng lại, nhưng **không được lưu** khi session kết thúc hay app khởi động lại. Sự kiện và sở thích cần sống qua nhiều phiên phải dùng long-term memory (database, vector index hay kho lưu trữ bền vững khác).

```python
agent = client.as_agent(
    name="TravelMemoryAgent",
    instructions="You are a travel agent who remembers user preferences across conversations. "
                 "Track destinations mentioned, budget constraints, and travel dates.",
)

session = agent.create_session()
await agent.run("I love beach destinations and my budget is $3000", session=session)
await agent.run("What did I say my budget was?", session=session)      # nhớ: $3000

new_session = agent.create_session()
await agent.run("What is my budget?", session=new_session)              # không biết: phiên mới
```

### Long-term memory bằng tool

Notebook giả lập một kho sở thích bền vững bằng hai tool:

```python
preference_store: dict[str, list[str]] = {}

@tool(approval_mode="never_require")
def save_preference(user_id: Annotated[str, "User identifier"],
                    preference: Annotated[str, "A travel preference to remember"]) -> str:
    """Save a user travel preference to long-term memory."""
    preference_store.setdefault(user_id, []).append(preference)
    return f"✅ Stored: {preference}"

@tool(approval_mode="never_require")
def get_preferences(user_id: Annotated[str, "User identifier"]) -> str:
    """Retrieve all saved travel preferences for a user."""
    prefs = preference_store.get(user_id, [])
    return "Saved preferences:\n- " + "\n- ".join(prefs) if prefs else f"No saved preferences for {user_id}."
```

Trong instructions, agent được dặn: đầu cuộc hội thoại gọi `get_preferences()`, lưu sở thích mới bằng `save_preference()`, không gợi ý khách sạn vượt ngân sách. Ở phiên 1, Sarah kể kỷ niệm 10 năm cưới, thích lãng mạn, spa, cần chỗ ở **tiếp cận được cho người đi lại khó khăn**, ăn chay, **dị ứng hạt nặng**. Ở phiên 2 (session mới, không có working memory), agent vẫn gợi ý đúng vì đọc lại long-term memory.

:::warning Hai điều nên để ý khi chạy notebook
- Instructions bảo agent dùng `search_hotels()`, nhưng `tools=[save_preference, get_preferences]` **không có** `search_hotels`. Thêm nó vào danh sách tool nếu muốn agent thật sự tìm khách sạn.
- `search_hotels` khớp **cả cụm truy vấn** là chuỗi con, không tách từ. Mình chạy thử: `"spa"` ra Le Meurice và Aman Tokyo, nhưng `"romantic spa"` không khớp gì nên **rơi về 3 khách sạn đầu**, trong đó có Le Meurice giá 850 USD, vượt ngân sách 700–800 của Sarah. Lại thêm lý do để lọc ngân sách bằng code thay vì tin model (xem bài tập).
:::

## Triển khai và lưu memory

Quản lý memory là một quy trình có hệ thống:
- **tạo**;
- **lưu**;
- **truy xuất** (đặc biệt then chốt);
- **tích hợp**;
- **cập nhật**;
- và cả **"quên"** (xoá).

### Mem0

Lớp **memory bền vững**: agent nhớ tương tác liên quan, lưu sở thích và ngữ cảnh, học từ thành công và thất bại; agent stateless thành stateful. Mem0 chạy theo pipeline **hai pha**:
1. **Trích xuất:** message trong thread được gửi tới Mem0; một LLM tóm tắt lịch sử và trích memory mới.
2. **Cập nhật:** một LLM quyết định **thêm, sửa hay xoá** memory, lưu vào kho lai gồm vector, graph và key-value.

Mem0 hỗ trợ nhiều loại memory, có graph memory để quản lý quan hệ giữa thực thể.

### Cognee

Memory ngữ nghĩa **mã nguồn mở**. Nó biến dữ liệu có cấu trúc và không cấu trúc thành **knowledge graph truy vấn được, có embedding**.
- **Kiến trúc hai kho:** vector similarity + quan hệ graph. Agent hiểu không chỉ cái gì *giống nhau* mà còn khái niệm *liên quan nhau* thế nào.
- **Truy xuất lai:** pha trộn vector, cấu trúc graph và suy luận LLM, từ tra chunk thô tới hỏi đáp có hiểu graph.
- **Memory sống:** tiến hoá và lớn dần mà vẫn truy vấn được như một graph liên thông, cho cả ngữ cảnh phiên ngắn hạn lẫn memory dài hạn.

### Lưu memory bằng RAG

Ngoài công cụ chuyên dụng, có thể dùng **Azure AI Search làm backend** để lưu và lấy memory, nhất là Structured RAG: memory du lịch theo người dùng, catalog sản phẩm, tri thức chuyên ngành. Theo bản gốc, Structured RAG trên Azure AI Search cho độ chính xác và độ phủ "vượt trội" so với cắt chunk và embedding truyền thống.

## Agent tự cải thiện

Pattern phổ biến: thêm một **"knowledge agent"** riêng, quan sát cuộc hội thoại giữa người dùng và agent chính, để:

1. **nhận diện thông tin giá trị:** phần nào đáng lưu thành tri thức chung hay sở thích người dùng;
2. **trích và tóm tắt** điều cốt lõi;
3. **lưu vào knowledge base**, thường là vector database;
4. **bổ sung cho truy vấn sau:** người dùng hỏi mới thì knowledge agent lấy thông tin liên quan và **gắn vào prompt**, cho agent chính có ngữ cảnh (giống RAG).

**Tối ưu:**
- **Độ trễ:** dùng model rẻ, nhanh để kiểm tra nhanh xem thông tin có đáng lưu hay đáng lấy không; chỉ gọi quy trình trích xuất và truy xuất phức tạp khi cần.
- **Bảo trì knowledge base:** thông tin ít dùng chuyển sang **"cold storage"** để giảm chi phí.

:::senior Memory là dữ liệu cá nhân
Memory dài hạn chứa sở thích, sức khoẻ ("dị ứng hạt"), tình trạng đi lại. Ba yêu cầu:
- có **quyền quên** (xoá theo khoá hoặc toàn bộ người dùng), khớp hướng dẫn *Control* ở Bài 3;
- memory phải **cập nhật chứ không chỉ append**, kẻo sở thích cũ và mới đá nhau (context clash, Bài 12);
- dữ liệu nhạy cảm cần mã hoá và giới hạn truy cập (Bài 18).

Trong Claude Code, `CLAUDE.md` là long-term memory bạn **đọc và sửa được**, `/memory` để xem. Đó là thiết kế minh bạch đáng học.
:::

## Đọc notebook từng bước

### `13-agent-memory.ipynb`: session và kho sở thích

Các cell chính đã có ở mục "Short-term memory" và "Long-term memory bằng tool" phía trên. Trình tự đầy đủ:

1. **Cài đặt, tạo client.**
2. **Working memory bằng session:**
   - `TravelMemoryAgent` nhớ ngân sách 3.000 USD trong **cùng** session;
   - **session mới** thì không biết gì.
3. **Kho sở thích lâu dài giả lập** `preference_store` cùng ba tool:
   - `save_preference`;
   - `get_preferences`;
   - `search_hotels`, với 5 khách sạn: Le Meurice Paris, Four Seasons Maui, Aman Tokyo, Hotel Sacher Vienna, Fairmont Whistler.
4. **Kịch bản 1, Sarah lần đầu:** kỷ niệm 10 năm cưới, lãng mạn, spa, cần chỗ ở tiếp cận được, 700–800 USD/đêm. Sau đó báo ăn chay và **dị ứng hạt nặng**. Cell 15 in nội dung kho để kiểm tra agent đã lưu gì.
5. **Kịch bản 2, Sarah quay lại vài tuần sau** (session mới, working memory trống): agent đọc kho dài hạn để gợi ý; sau đó hỏi tiếp hoạt động cho trẻ em ở Maui.

**Bảng tổng kết của notebook:**

| Loại memory | Cơ chế trong MAF | Vòng đời |
|---|---|---|
| Working | `agent.create_session()` | Một cuộc hội thoại |
| Short-term | Ngữ cảnh tích luỹ trong thread | Một task hoặc phiên |
| Long-term | Kho ngoài, truy cập qua hàm `@tool` | Xuyên phiên |

### `13-agent-memory-cognee.ipynb`: trợ lý lập trình có memory dạng knowledge graph

Notebook dựng **trợ lý lập trình** dùng **Cognee** làm memory dài hạn.

| Loại memory | Cơ chế | Vòng đời |
|---|---|---|
| Working | `agent.create_session()` (MAF) | Một cuộc hội thoại |
| Short-term | Cache phiên của Cognee (Redis) | Một phiên |
| Long-term | Knowledge graph + vector của Cognee | Lâu dài |

Kiến trúc Cognee: dữ liệu thô (hồ sơ dev, tài liệu, hội thoại) → `cognify()` trích thực thể và quan hệ, tạo embedding → graph + vector → `search()` truy xuất lai.

**Cell 3–7: cài đặt.**
- Biến `LLM_API_KEY` cho Cognee, `CACHING=true`.
- Tạo `FoundryChatClient`.
- Cấu hình thư mục `.data_storage` và `.cognee_system`; `prune_data()` và `prune_system()` để **xoá sạch dữ liệu cũ** trước khi chạy.

**Cell 8–10: phần 1, xây knowledge base từ ba nguồn.**
- **Hồ sơ developer:** kỹ sư AI/Backend, FastAPI + Pydantic, asyncio/aiohttp, pytest-asyncio, từng deploy trên AWS, Azure, Google Cloud.
- **Zen of Python bản thực hành:** đẹp hơn xấu, tường minh hơn ngầm định, đơn giản hơn phức tạp, phẳng hơn lồng nhau; kèm type hint, context manager, dataclass.
- **Hội thoại cũ** về asyncio (semaphore giới hạn đồng thời, connection pooling), dataclass hay Pydantic (API thì chọn Pydantic), test async (pytest-asyncio), xử lý lỗi và log tập trung.

```python
await cognee.add(developer_intro, node_set=["developer_data"])
await cognee.add(human_agent_conversations, node_set=["developer_data"])
await cognee.add(python_zen_principles, node_set=["principles_data"])
await cognee.cognify()          # dựng knowledge graph
```

`node_set` gắn nhãn nhóm, để sau này tìm **chỉ trong một nhóm**.

**Cell 11–14: trực quan hoá và làm giàu memory.**
- `visualize_graph('./cognee_graph.html')` xuất graph tương tác để mở bằng trình duyệt.
- `memify()` phân tích graph, sinh "luật" (pattern, best practice, quan hệ giữa khái niệm).

**Cell 15–17: phần 2, agent MAF dùng Cognee qua tool.**

```python
@tool(approval_mode="never_require")
async def search_knowledge(query: Annotated[str, "Natural-language question to search the knowledge graph"]) -> str:
    """Search the Cognee knowledge graph for relevant developer knowledge, best practices, and past conversations."""
    results = await cognee.search(query_text=query, query_type=SearchType.GRAPH_COMPLETION)
    return str(results) if results else "No relevant knowledge found."

@tool(approval_mode="never_require")
async def search_principles(query: Annotated[str, "Question about Python principles or best practices"]) -> str:
    """Search only the Python principles subset of the knowledge graph."""
    from cognee.modules.engine.models.node_set import NodeSet
    results = await cognee.search(query_text=query, query_type=SearchType.GRAPH_COMPLETION,
                                  node_type=NodeSet, node_name=["principles_data"])
    return str(results) if results else "No relevant principles found."
```

`CodingAssistant` được dặn:
- dùng `search_knowledge()` cho câu hỏi chung, `search_principles()` cho câu về nguyên tắc Python;
- kết hợp với hiểu biết riêng;
- nhắc tới stack của developer (FastAPI, asyncio, Pydantic).

**Cell 18–23: working memory và long-term memory cùng lúc.**
- Session 1: hỏi về "AsyncWebScraper của tôi có hợp nguyên tắc Python không", rồi hỏi tiếp "dựa trên câu trả lời vừa rồi…" (dùng working memory).
- Session 2 (mới): hỏi hướng dẫn log cho incident review, và cách đặt tên biến. Graph vẫn còn nên agent vẫn trả lời được.

:::warning Hai điều nên sửa khi chạy notebook Cognee
- Giống notebook chính, `coding_agent = provider.as_agent(...)` **không truyền** `tools=[search_knowledge, search_principles]`. Instructions bảo dùng tool nhưng agent không có tool nào, nên câu trả lời chỉ dựa trên kiến thức sẵn có của model. Thêm `tools=[...]` vào lời gọi.
- `prune_data()` và `prune_system()` **xoá toàn bộ** memory Cognee trong thư mục cấu hình. Hợp cho demo, nhưng đừng chạy cell này trên dữ liệu thật.
:::

## Tài liệu tham khảo

- Mem0: <https://mem0.ai/>
- Cognee: <https://www.cognee.ai/>
- Azure AI Search: <https://learn.microsoft.com/azure/search/>

:::quiz Người dùng hỏi "Vé đi Paris bao nhiêu?" rồi "Còn chỗ ở ở đó?". Loại memory nào giúp agent hiểu "ở đó" là Paris?
- [ ] Long-term memory
- [x] Short-term memory (trong cùng phiên, như `AgentSession` của MAF)
- [ ] Persona memory
- [ ] Entity memory lưu trong vector DB

Ngữ cảnh trong cùng phiên là short-term memory. Mở session mới thì mất, trừ khi đã lưu vào long-term memory.
:::

:::quiz Pipeline của Mem0 gồm những pha nào?
- [ ] Chỉ lưu nguyên văn mọi message vào vector DB
- [x] Trích xuất (LLM tóm tắt và rút memory mới) rồi cập nhật (LLM quyết định thêm, sửa hay xoá memory)
- [ ] Nén context rồi xoá
- [ ] Huấn luyện lại model theo hội thoại

Pha cập nhật giúp memory không phình to và không mâu thuẫn: sở thích mới có thể sửa hoặc xoá cái cũ.
:::

:::quiz Agent ghi lại rằng lần trước đặt chuyến VN123 thất bại vì hết chỗ, để lần sau thử chuyến khác ngay. Đây là loại memory nào?
- [ ] Working memory
- [ ] Persona memory
- [x] Workflow / episodic memory
- [ ] Structured RAG

Episodic memory lưu chuỗi bước và kết quả (thành công, thất bại) của các "tập" kinh nghiệm để học từ chúng.
:::

:::exercise Long-term memory biết cập nhật, biết quên, và lọc bằng code
Notebook chỉ `append` sở thích dạng chuỗi. Viết `PreferenceMemory`:
1. `remember(user_id, key, value)`: lưu theo **khoá** (vd `max_price_per_night`, `must_have_tags`), trả về `"add"`, `"update"` hoặc `"noop"`, kèm ngày cập nhật.
2. `forget(user_id, key=None)`: xoá một khoá hoặc toàn bộ người dùng.
3. `recall(user_id)`: trả dict sở thích.

Rồi viết `filter_hotels(hotels, prefs)` **lọc ngân sách và tag bắt buộc bằng code**. Dùng danh sách 5 khách sạn của notebook, ngân sách 500 và tag `accessible`.
???
```python
from datetime import date

class PreferenceMemory:
    def __init__(self):
        self.store = {}          # user_id -> {key: {"value": ..., "updated": ...}}

    def remember(self, user_id, key, value, today=None):
        prefs = self.store.setdefault(user_id, {})
        old = prefs.get(key, {}).get("value")
        prefs[key] = {"value": value, "updated": (today or date.today()).isoformat()}
        if old is None:
            return "add"
        return "noop" if old == value else "update"

    def forget(self, user_id, key=None):
        if key is None:
            return self.store.pop(user_id, None) is not None
        return self.store.get(user_id, {}).pop(key, None) is not None

    def recall(self, user_id):
        return {k: v["value"] for k, v in self.store.get(user_id, {}).items()}

def filter_hotels(hotels, prefs):
    budget = prefs.get("max_price_per_night")
    need = set(prefs.get("must_have_tags", []))
    return [h["name"] for h in hotels
            if (budget is None or h["price"] <= budget) and need <= set(h["tags"])]
```

Chạy thử:

```text
remember max_price 800        -> add
remember must_have accessible -> add
remember max_price 500        -> update
remember max_price 500        -> noop
recall -> {'max_price_per_night': 500, 'must_have_tags': ['accessible']}
filter -> ['Hotel Sacher Vienna']
forget must_have_tags -> True, filter -> ['Hotel Sacher Vienna', 'Fairmont Whistler']
forget user -> True, recall -> {}
```

Lưu theo khoá thì ngân sách mới **thay** ngân sách cũ, không có hai con số mâu thuẫn. Lọc bằng code thì khách sạn vượt ngân sách không bao giờ tới tay model. `forget` hiện thực quyền quên.
:::

**Bài trước:** [Bài 12](/ai-agents/course/production-giao-thuc/context-engineering) · **Bài tiếp theo:** [Bài 14 — Microsoft Agent Framework](/ai-agents/course/nang-cao/microsoft-agent-framework)
