---
title: "Bài 5 — Agentic RAG: agent tự lập kế hoạch truy xuất, tự kiểm và sửa truy vấn"
summary: "Agentic RAG là vòng lặp LLM gọi tool truy xuất, tự đánh giá kết quả, viết lại truy vấn và lặp tới khi đủ bằng chứng (kiểu maker-checker). Agent tự làm chủ quá trình suy luận, cơ chế tự sửa lỗi, giới hạn của agency, khi nào đáng dùng, và quản trị, minh bạch. Có ví dụ tool tìm kiếm được chạy thử."
type: lesson
level: intermediate
lastReviewed: 2026-11-17
tags: [ai-agents, rag, agentic-rag, retrieval, maker-checker]
related: [ai-agents/course/cong-cu-tri-thuc/tool-use, ai-agents/course/ke-hoach-da-agent/metacognition, ai-agents/course/production-giao-thuc/context-engineering]
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 05 Agentic RAG](https://github.com/microsoft/ai-agents-for-beginners/tree/main/05-agentic-rag) (Microsoft, MIT License). Hàm tìm kiếm trong mục code mẫu **đã chạy thử** bằng Python; phần gọi agent cần Microsoft Foundry.
:::

## Agentic RAG là gì?

**Agentic Retrieval-Augmented Generation** là một hướng đi mới: LLM không chỉ kéo thông tin từ nguồn ngoài mà còn **tự lập kế hoạch bước tiếp theo**.

RAG tĩnh chạy một lần theo kiểu "truy xuất rồi đọc", hoặc theo chuỗi prompt viết sẵn. Agentic RAG thì là **vòng lặp gọi LLM nhiều lần**, xen giữa là tool/function call và output có cấu trúc. Ở mỗi lượt, hệ thống:
- đánh giá kết quả đã có;
- quyết định có cần tinh chỉnh truy vấn không;
- gọi thêm tool nếu cần;
- lặp tới khi đạt lời giải thoả đáng.

Kiểu vận hành **"maker-checker"** (một bên làm, một bên kiểm) này giúp:
- câu trả lời đúng hơn;
- xử lý được truy vấn hỏng tới database có cấu trúc (vd NL2SQL);
- kết quả cân bằng, chất lượng cao.

Hệ thống có thể viết lại truy vấn thất bại, đổi phương pháp truy xuất, kết hợp nhiều tool (vector search trên Azure AI Search, SQL, API riêng) trước khi chốt câu trả lời. Vì thế **không cần framework điều phối quá phức tạp**: một vòng lặp tương đối đơn giản "gọi LLM → dùng tool → gọi LLM → …" đã cho ra output tinh vi và có căn cứ.

## Làm chủ quá trình suy luận

Điểm khiến một hệ thống "agentic" là nó **tự làm chủ quá trình suy luận**. RAG truyền thống thường cần con người vạch sẵn đường đi: lấy gì, lấy lúc nào. Hệ thống agentic tự quyết định cách tiếp cận dựa trên chất lượng thông tin nó tìm được.

Vd được yêu cầu lập chiến lược ra mắt sản phẩm, agent tự quyết:

1. Lấy báo cáo xu hướng thị trường mới qua **Bing Web Grounding**.
2. Tìm dữ liệu đối thủ liên quan qua **Azure AI Search**.
3. Đối chiếu số liệu bán hàng nội bộ trong quá khứ trên **Azure SQL Database**.
4. Tổng hợp thành chiến lược thống nhất qua **Azure OpenAI Service**.
5. Đánh giá chiến lược tìm lỗ hổng hay mâu thuẫn, và **truy xuất thêm một vòng** nếu cần.

Mọi bước (tinh chỉnh truy vấn, chọn nguồn, lặp tới khi "hài lòng") đều do model quyết định, không do người viết kịch bản trước.

## Vòng lặp, tool và memory

| Pha | Diễn ra gì |
|---|---|
| **Gọi ban đầu** | Mục tiêu của người dùng (user prompt) được đưa cho LLM. |
| **Gọi tool** | Thấy thiếu thông tin hay chỉ dẫn mơ hồ, model chọn tool hoặc cách truy xuất (vd hybrid search trên dữ liệu riêng, SQL) để lấy thêm ngữ cảnh. |
| **Đánh giá & tinh chỉnh** | Xem dữ liệu trả về đã đủ chưa. Chưa thì sửa truy vấn, thử tool khác, đổi cách tiếp cận. |
| **Lặp tới khi đủ** | Tới khi model thấy đủ rõ và đủ bằng chứng để trả lời có lập luận. |
| **Memory & state** | Nhờ giữ trạng thái qua các bước, hệ thống nhớ các lần thử trước và kết quả, tránh lặp vòng vô ích. |

Dần dần hệ thống có một sự hiểu "tiến hoá", xử lý được task nhiều bước mà không cần người liên tục can thiệp hay sửa prompt.

## Xử lý thất bại và tự sửa

Khi gặp ngõ cụt (tài liệu không liên quan, truy vấn hỏng), hệ thống có thể:

- **Lặp và truy vấn lại:** thử chiến lược tìm kiếm mới, viết lại câu truy vấn database, xem tập dữ liệu khác, thay vì trả lời kém giá trị.
- **Dùng tool chẩn đoán:** gọi thêm hàm để debug các bước suy luận hoặc xác nhận dữ liệu lấy về là đúng. Tool như **Azure AI Tracing** quan trọng cho observability.
- **Nhờ con người:** với việc rủi ro cao hoặc thất bại lặp lại, model báo mức bất định và xin hướng dẫn. Có phản hồi sửa của người rồi thì model áp dụng bài học đó cho phần còn lại.

## Giới hạn của agency

Agentic RAG **không phải AGI**. Năng lực "agentic" bị giới hạn trong tool, nguồn dữ liệu và chính sách mà developer cung cấp. Nó không tự phát minh tool hay bước ra ngoài phạm vi đã đặt; thế mạnh của nó là điều phối linh hoạt những gì đang có.

1. **Tự chủ trong một miền:** đạt mục tiêu người dùng trong miền đã biết, bằng cách viết lại truy vấn, chọn tool.
2. **Phụ thuộc hạ tầng:** khả năng tuỳ vào tool và dữ liệu developer tích hợp; không tự vượt ra ngoài.
3. **Tôn trọng guardrail:** nguyên tắc đạo đức, quy định tuân thủ, chính sách kinh doanh vẫn rất quan trọng. Sự tự do của agent luôn bị ràng buộc bởi biện pháp an toàn và giám sát (bản gốc thêm một chữ "hopefully?").

## Khi nào Agentic RAG đáng dùng

1. **Môi trường đặt độ đúng lên đầu:** kiểm tra tuân thủ, phân tích quy định, nghiên cứu pháp lý. Agent kiểm lại sự kiện, tra nhiều nguồn, viết lại truy vấn tới khi câu trả lời được thẩm định kỹ.
2. **Tương tác database phức tạp:** dữ liệu có cấu trúc, truy vấn hay lỗi hoặc cần chỉnh. Agent tự tinh chỉnh trên Azure SQL hay Microsoft Fabric OneLake cho khớp ý người dùng.
3. **Workflow kéo dài:** phiên dài, có thông tin mới xuất hiện. Agent liên tục đưa dữ liệu mới vào và đổi chiến lược khi hiểu bài toán hơn.

## Quản trị, minh bạch và niềm tin

- **Suy luận giải thích được:** agent cung cấp dấu vết kiểm toán gồm truy vấn đã chạy, nguồn đã tra, các bước suy luận. Azure AI Content Safety và Azure AI Tracing / GenAIOps giúp duy trì minh bạch.
- **Kiểm soát thiên lệch:** tinh chỉnh chiến lược truy xuất để có nguồn cân bằng, đại diện; định kỳ audit output (vd mô hình riêng trên Azure Machine Learning).
- **Con người giám sát:** với việc nhạy cảm, review của con người vẫn thiết yếu. Agentic RAG **bổ trợ** phán đoán của con người, không thay thế.

Không có tool ghi lại hành động rõ ràng thì debug một quy trình nhiều bước sẽ rất khó.

## Code mẫu: RAG agent và checker agent

Rút gọn từ notebook [`05-python-agent-framework.ipynb`](https://github.com/microsoft/ai-agents-for-beginners/blob/main/05-agentic-rag/code_samples/05-python-agent-framework.ipynb). Knowledge base nằm **trong bộ nhớ**, không cần Azure AI Search.

```python
TRAVEL_KNOWLEDGE_BASE = {
    "Barcelona": "... Best visited Mar-May or Sep-Nov. Known for Gaudí architecture, La Rambla, beaches. Average daily cost: $150-200.",
    "Tokyo": "... Best visited Mar-Apr (cherry blossoms) or Oct-Nov. Known for Shibuya, temples, sushi. Average daily cost: $200-250.",
    "Paris": "... Best visited Apr-Jun or Sep-Oct. Known for Eiffel Tower, Louvre, cuisine. Average daily cost: $180-250.",
    "Cape Town": "... Best visited Nov-Mar. Known for Table Mountain, wine regions, wildlife. Average daily cost: $100-150.",
}

@tool(approval_mode="never_require")
def search_travel_knowledge(query: Annotated[str, "The search query about a travel destination"]) -> str:
    """Search the travel knowledge base for destination information."""
    results = []
    for destination, info in TRAVEL_KNOWLEDGE_BASE.items():
        if query.lower() in destination.lower() or any(word in info.lower() for word in query.lower().split()):
            results.append(f"**{destination}**: {info}")
    return "\n\n".join(results) if results else "No matching destinations found in the knowledge base."

# RAG agent: luôn tìm trước khi trả lời
agent = client.as_agent(
    tools=[search_travel_knowledge], name="TravelRAGAgent",
    instructions="""You are a knowledgeable travel advisor. Before answering questions about destinations:
1. ALWAYS search the travel knowledge base first
2. Base your answers on retrieved information
3. If information is not in the knowledge base, say so clearly
4. Provide specific details like costs, best seasons, and highlights.""",
)

# Maker-checker: tìm, rồi tìm lại theo từng điểm đến để xác nhận
checker_agent = client.as_agent(
    tools=[search_travel_knowledge], name="TravelRAGCheckerAgent",
    instructions="""You are a meticulous travel advisor who double-checks recommendations.
1. Search for relevant destinations first
2. For each destination found, search again with the destination name to get full details
3. Compare the options using verified information
4. Present a final recommendation with specific costs, best travel times, and highlights
5. If any detail seems incomplete, search once more to confirm before responding.""",
)
response = await checker_agent.run("I have a $175/day budget and want to travel in April. Which destinations fit?")
```

Mình chạy riêng hàm tìm kiếm (không cần model) với vài truy vấn:

```text
'great architecture'      -> ['Barcelona']
'April'                   -> []
'Apr'                     -> ['Tokyo', 'Paris']
'budget travel in April'  -> ['Barcelona', 'Tokyo', 'Paris', 'Cape Town']
'a quiet place'           -> ['Barcelona', 'Tokyo', 'Paris', 'Cape Town']
```

Tìm theo từ khoá đơn giản rất "ồn": từ ngắn như `a`, `in` khớp mọi đoạn văn, còn `April` lại không khớp `Apr`. Đây chính là lý do cần vòng **đánh giá và truy vấn lại**: agent checker tìm lần hai bằng tên điểm đến cụ thể và so số liệu, thay vì tin kết quả lần đầu.

:::quiz Điều gì phân biệt Agentic RAG với RAG truyền thống?
- [ ] Agentic RAG dùng vector database, RAG thường thì không
- [x] Agentic RAG tự quyết chuỗi bước truy xuất: đánh giá kết quả, viết lại truy vấn, đổi tool và lặp tới khi đủ
- [ ] Agentic RAG không cần nguồn dữ liệu ngoài
- [ ] Agentic RAG chỉ gọi LLM một lần

Khác biệt cốt lõi là *làm chủ quá trình suy luận*: đường đi không bị viết cứng trước, model tự lặp "LLM → tool → LLM".
:::

:::quiz Với hàm `search_travel_knowledge` ở trên, truy vấn `"April"` trả về gì?
- [ ] Tokyo và Paris
- [ ] Cả bốn điểm đến
- [x] Không có kết quả: "No matching destinations found in the knowledge base."
- [ ] Lỗi exception

Dữ liệu ghi `Apr`, không phải `April`. Phép so khớp chuỗi con theo từng từ không hiểu từ đồng nghĩa hay viết tắt. Agent tốt sẽ thấy kết quả rỗng và thử lại bằng `Apr` hoặc tên điểm đến.
:::

:::quiz Theo khóa học, Agentic RAG KHÔNG làm được điều gì?
- [ ] Viết lại câu SQL bị lỗi
- [ ] Hỏi lại con người khi thất bại nhiều lần
- [x] Tự tạo tool mới hoặc truy cập nguồn dữ liệu developer chưa tích hợp
- [ ] Đổi từ vector search sang SQL

Agency bị giới hạn trong tool, dữ liệu và chính sách do developer cung cấp; agent chỉ điều phối linh hoạt những gì đang có.
:::

:::exercise Cải thiện tool tìm kiếm cho agent
Hàm `search_travel_knowledge` khớp quá rộng (`a`, `in` khớp mọi thứ) và quá hẹp (`April` không khớp `Apr`). Viết lại để:
1. bỏ từ dừng ngắn (độ dài ≤ 2) và vài từ phổ biến;
2. chuẩn hoá tên tháng đầy đủ về dạng 3 chữ;
3. trả về **điểm số** (số từ khớp) và sắp xếp giảm dần, để agent biết kết quả nào đáng tin.

Kiểm với `"budget travel in April"`.
???
```python
import re
MONTHS = {m.lower(): m[:3].lower() for m in ["January","February","March","April","May","June","July",
          "August","September","October","November","December"]}
STOP = {"the", "and", "for", "with", "travel", "place", "somewhere", "budget"}

def tokens(text):
    words = re.findall(r"[a-zà-ỹ]+", text.lower())
    return [MONTHS.get(w, w) for w in words if len(w) > 2 and w not in STOP]

def search(query):
    q = set(tokens(query))
    scored = []
    for dest, info in KB.items():
        words = set(tokens(dest + " " + info))
        score = len(q & words)
        if score:
            scored.append((score, dest))
    return sorted(scored, reverse=True)

print(search("budget travel in April"))  # [(1, 'Tokyo'), (1, 'Paris')]
print(search("great architecture"))      # [(1, 'Barcelona')]
```

Đã chạy với `KB` là dict ở trên: `"budget travel in April"` giờ chỉ ra Tokyo và Paris (đều có `Apr`), thay vì cả bốn. Trả về điểm số cho phép instructions của agent nói "nếu điểm cao nhất bằng 0 hoặc nhiều kết quả bằng điểm, hãy tìm lại cụ thể hơn". Đó là phần *checker* của vòng maker-checker. Ở production, bạn sẽ dùng hybrid search (BM25 + vector) thay vì tự viết.
:::

**Bài trước:** [Bài 4](/ai-agents/course/cong-cu-tri-thuc/tool-use) · **Bài tiếp theo:** [Bài 6 — Agent đáng tin cậy](/ai-agents/course/cong-cu-tri-thuc/xay-agent-dang-tin-cay)
