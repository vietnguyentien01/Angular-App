---
title: "Bài 12 — Context engineering cho AI Agent"
summary: "Context engineering là đảm bảo agent có đúng thông tin cho bước tiếp theo trong context window có hạn: khác prompt engineering ra sao, năm loại context, chiến lược quản lý (scratchpad, memory, nén, cô lập), kiểm tra context, và bốn kiểu hỏng: poisoning, distraction, confusion, clash."
type: lesson
level: intermediate
lastReviewed: 2026-11-17
tags: [ai-agents, context-engineering, context-window, compression, memory]
related: [ai-agents/course/production-giao-thuc/agent-memory, ai-agents/course/cong-cu-tri-thuc/agentic-rag, claude-code/consolidate/sessions/context-window-va-checkpoint]
changelog:
  - date: 2026-11-17
    note: Bổ sung phần đọc notebook từng bước, file phụ của bài và tài liệu tham khảo.
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 12 Context Engineering](https://github.com/microsoft/ai-agents-for-beginners/tree/main/12-context-engineering) (Microsoft, MIT License). Lời giải bài tập **đã chạy thử** bằng Python 3.
:::

Muốn agent đáng tin cậy, phải hiểu độ phức tạp của ứng dụng mà agent phục vụ. Cần agent **quản lý thông tin hiệu quả**, vượt ra ngoài prompt engineering.

**Mục tiêu:**
- **định nghĩa** context engineering và phân biệt với prompt engineering;
- **nhận diện** các thành phần context trong ứng dụng LLM;
- **áp dụng** chiến lược viết, chọn, nén và cô lập context;
- **nhận ra** các kiểu hỏng context (poisoning, distraction, confusion, clash) và cách giảm thiểu.

## Context engineering là gì?

Với agent, context là thứ dẫn dắt việc lập kế hoạch và hành động. **Context engineering** là thực hành đảm bảo agent có **đúng thông tin để làm bước tiếp theo** của task. Context window có giới hạn, nên người xây agent phải dựng hệ thống và quy trình để **thêm, bớt và cô đọng** thông tin trong đó.

**Prompt engineering vs context engineering:**
- Prompt engineering tập trung vào **một bộ chỉ dẫn tĩnh** để dẫn agent bằng luật.
- Context engineering quản lý **tập thông tin động** (kể cả prompt ban đầu) để agent luôn có đủ thứ cần **theo thời gian**, theo cách **lặp lại được và đáng tin cậy**.

## Các loại context

| Loại | Gồm |
|---|---|
| **Instructions** | "Luật" của agent: prompt, system message, few-shot example, mô tả tool. Chỗ prompt engineering gặp context engineering. |
| **Knowledge** | Sự kiện, dữ liệu từ database, memory dài hạn; tích hợp RAG nếu cần nhiều kho tri thức. |
| **Tools** | Định nghĩa hàm, API, MCP server agent gọi được, **cùng kết quả** trả về. |
| **Conversation history** | Hội thoại đang diễn ra; càng dài càng chiếm chỗ trong context window. |
| **User preferences** | Điều học được về sở thích của người dùng theo thời gian, dùng khi ra quyết định quan trọng. |

## Chiến lược

### Lập kế hoạch

1. **Xác định rõ kết quả:** "Khi agent làm xong, thế giới trông như thế nào?" Người dùng nhận được thay đổi, thông tin hay câu trả lời gì?
2. **Lập bản đồ context:** "Agent cần thông tin gì để làm task này?" Thông tin đó nằm ở đâu?
3. **Tạo context pipeline:** "Agent lấy thông tin đó bằng cách nào?" Qua RAG, MCP server, tool khác…

### Quản lý context trong thực tế

1. **Agent scratchpad:** agent ghi chú thông tin liên quan tới task và tương tác **trong một phiên**. Ghi chú nằm **ngoài context window** (file hoặc object lúc chạy), lấy lại khi cần.
2. **Memories:** lưu và lấy thông tin **xuyên nhiều phiên**: tóm tắt, sở thích người dùng, phản hồi để cải thiện (Bài 13).
3. **Nén context:** khi context gần chạm giới hạn, dùng tóm tắt và cắt tỉa: chỉ giữ phần liên quan nhất hoặc bỏ tin nhắn cũ.
4. **Hệ multi-agent:** mỗi agent có context window riêng, nên bản thân việc chia agent đã là context engineering. Phải thiết kế context được chia sẻ và chuyển giữa các agent thế nào.
5. **Môi trường sandbox:** chạy code hoặc xử lý tài liệu lớn tốn rất nhiều token. Hãy chạy trong sandbox và **chỉ đọc kết quả** cùng thông tin liên quan, thay vì nhét tất cả vào context.
6. **Runtime state object:** container thông tin cho từng tình huống. Với task phức tạp, lưu kết quả từng task con, để context chỉ gắn với task con đang làm.

### Kiểm tra context (inspecting context)

Sau khi áp một chiến lược, hãy kiểm tra **lần gọi model tiếp theo thực sự nhận được gì**. Câu hỏi debug hữu ích:

> Agent nạp **quá nhiều** context, **sai** context, hay **thiếu** context nó cần?

Không cần log nguyên prompt, output tool hay nội dung memory. Ở production, ưu tiên **bản ghi kiểm tra nhỏ** chỉ gồm số đếm, id, hash và nhãn chính sách:

- **Selection:** bao nhiêu chunk, tool, memory ứng viên được xét, bao nhiêu được chọn, quy tắc hay điểm nào loại phần còn lại.
- **Compression:** khoảng nguồn hoặc trace id, id bản tóm tắt, ước lượng token trước và sau, và nội dung gốc có bị loại khỏi lần gọi sau không.
- **Isolation:** task con nào chạy ở agent, phiên hay sandbox riêng; bản tóm tắt có giới hạn nào được trả về; output tool lớn có nằm ngoài context agent cha không.
- **Memory và RAG:** lưu id tài liệu, id memory, điểm, id được chọn, trạng thái che dữ liệu, thay vì toàn văn.
- **An toàn và riêng tư:** ưu tiên hash, id, nhóm token, nhãn chính sách hơn là prompt, tham số tool, kết quả tool hay nội dung memory nhạy cảm.

Mục tiêu **không phải giữ nhiều context hơn**, mà là để lại đủ bằng chứng cho developer biết chiến lược nào đã chạy và nó có đổi lần gọi model sau đúng ý không.

## Ví dụ: "Book me a trip to Paris."

- Agent chỉ dùng prompt engineering: *"OK, bạn muốn đi Paris khi nào?"*, chỉ xử lý đúng câu hỏi lúc đó.
- Agent có context engineering, trước khi trả lời đã:
  - **xem lịch** của bạn để biết ngày rảnh (dữ liệu thời gian thực);
  - **nhớ sở thích cũ** (memory dài hạn): hãng bay ưa thích, ngân sách, thích bay thẳng;
  - **xác định tool** đặt vé và khách sạn khả dụng.

  Rồi mới trả lời: *"Chào [Tên]! Mình thấy bạn rảnh tuần đầu tháng 10. Mình tìm vé bay thẳng tới Paris của [Hãng ưa thích] trong ngân sách quen thuộc [Ngân sách] nhé?"*

## Bốn kiểu hỏng context

| Kiểu hỏng | Là gì | Cách xử lý | Ví dụ đặt vé |
|---|---|---|---|
| **Context poisoning** (đầu độc) | Ảo giác hoặc lỗi lọt vào context và bị tham chiếu lặp lại; agent theo đuổi mục tiêu bất khả hay chiến lược vô nghĩa. | **Validate** trước khi thêm vào memory dài hạn; **cách ly** (quarantine). Nghi bị đầu độc thì mở thread context mới. | Agent bịa một chuyến **bay thẳng từ sân bay nhỏ địa phương tới thành phố quốc tế xa**. Chi tiết này được lưu, và khi đặt vé agent cứ tìm tuyến không tồn tại. Cách sửa: **kiểm tra chuyến bay và tuyến bằng API thật** trước khi đưa vào context; sai thì cách ly. |
| **Context distraction** (phân tâm) | Context quá lớn khiến model bám vào lịch sử tích luỹ thay vì kiến thức đã học, nên hành động lặp hoặc vô ích. Có thể sai **trước cả khi** đầy context window. | **Tóm tắt context** định kỳ, giữ chi tiết quan trọng, bỏ lịch sử thừa, để "reset" sự tập trung. | Bàn mãi về các điểm đến mơ ước, kể chi tiết chuyến phượt 2 năm trước. Khi hỏi "tìm vé rẻ tháng sau", agent vẫn hỏi về đồ phượt. Cách sửa: sau N lượt, **tóm tắt phần gần và liên quan** (ngày, điểm đến hiện tại), dùng bản tóm tắt cho lần gọi sau. |
| **Context confusion** (rối) | Context thừa, thường là **quá nhiều tool**, khiến model trả lời kém hoặc gọi tool không liên quan. Model nhỏ đặc biệt dễ bị. | **Quản lý "tool loadout"** bằng RAG: lưu mô tả tool trong vector DB, chỉ chọn tool liên quan nhất cho từng task. Bản gốc dẫn nghiên cứu khuyên **dưới 30 tool**. | Có hàng chục tool (`book_flight`, `rent_car`, `currency_converter`…). Hỏi "đi lại trong Paris thế nào?" thì agent gọi nhầm `book_flight` trong Paris. Cách sửa: RAG trên mô tả tool, chỉ đưa `public_transport_info`, `rent_car`. |
| **Context clash** (xung đột) | Thông tin mâu thuẫn trong context dẫn tới suy luận thiếu nhất quán. Hay xảy ra khi thông tin đến dần và giả định sai ban đầu còn nằm lại. | **Pruning** (bỏ thông tin cũ hoặc mâu thuẫn khi có thông tin mới) và **offloading** (scratchpad riêng để xử lý mà không làm rối context chính). | Lúc đầu nói "bay hạng phổ thông", sau đổi "chuyến này đi thương gia". Cả hai còn trong context thì agent rối. Cách sửa: chỉ dẫn mới **ghi đè** chỉ dẫn cũ, hoặc dùng scratchpad để chốt sở thích cuối cùng. |

Notebook [`12-chat_summarization.ipynb`](https://github.com/microsoft/ai-agents-for-beginners/blob/main/12-context-engineering/code_samples/12-chat_summarization.ipynb) minh hoạ tóm tắt hội thoại. File `vacation_agent_scratchpad.md` là ví dụ một scratchpad.

:::senior Bạn đã dùng context engineering mỗi ngày với Claude Code
- `/compact` là nén context.
- `/clear` là mở thread mới khi bị đầu độc.
- Subagent là cô lập: output lớn không vào context chính.
- `CLAUDE.md` và auto memory là memory xuyên phiên.
- File `plan.md` trong Lab 14 là scratchpad.
- Giới hạn số MCP server đang bật là quản lý tool loadout.

Xem lại [Context & checkpoint](/claude-code/consolidate/sessions/context-window-va-checkpoint).
:::

## Đọc notebook từng bước: `12-chat_summarization.ipynb`

**Cell 4: tạo client.**

**Cell 5 (lý thuyết): vì sao phải quản lý context.** Mỗi LLM có context window hữu hạn. Khi hội thoại kéo dài:
- **số token tăng tuyến tính** theo mỗi tin nhắn và câu trả lời;
- **token prompt chiếm phần lớn chi phí**, vì toàn bộ lịch sử được gửi lại mỗi lượt;
- cuối cùng hội thoại **vượt context window**: model cắt bớt hoặc báo lỗi.

| Chiến lược | Cách làm | Trade-off |
|---|---|---|
| **Truncation** (cắt) | Bỏ tin nhắn cũ nhất | Mất ngữ cảnh ban đầu |
| **Summarization** (tóm tắt) | Cô đọng tin nhắn cũ thành tóm tắt | Mất vài chi tiết nhưng giữ ý chính |
| **Scratchpad / bộ nhớ ngoài** | Lưu sự kiện quan trọng ngoài hội thoại | Tốn lượt gọi tool, nhưng sống sót qua mọi lần rút gọn |

Notebook kết hợp **tóm tắt** với **tool scratchpad**.

**Cell 6–7: agent có ý thức về context.** Instructions dặn:
1. khi hội thoại dài thì tóm tắt ngữ cảnh trước thành ý chính;
2. theo dõi sở thích người dùng đã nêu;
3. tham chiếu quyết định cũ mà không lặp lại toàn bộ chi tiết.

**Cell 8–11: mô phỏng hội thoại dài sáu lượt trong một session.**
1. Đi Nhật, thích sushi, đền chùa, nhiếp ảnh.
2. Ngân sách 3.000 USD, đi một mình 10 ngày vào tháng 4.
3. "Dựa trên mọi điều tôi đã kể, đừng bỏ lỡ điều gì?" (kiểm tra agent còn nhớ).
4. Chỗ ở: thích lữ quán truyền thống (ryokan).
5. **Đổi ý:** đi tháng 10 để ngắm lá đỏ.
6. "Tóm tắt toàn bộ kế hoạch."

Lượt 6 kiểm tra **context clash** (Bài 12): agent phải nói **tháng 10**, không phải tháng 4.

**Cell 12–14: mẫu tóm tắt bằng tool.**
1. Agent nhận ra sự kiện quan trọng.
2. Gọi tool tóm tắt để lưu lại.
3. Tin nhắn cũ có thể bỏ an toàn vì bản tóm tắt đã giữ phần quan trọng.

```python
@tool(approval_mode="never_require")
def summarize_preferences(conversation_notes: str) -> str:
    """Summarize accumulated user preferences into a compact format."""
    return f"[SUMMARY] User preferences recorded: {conversation_notes}"
```

Agent `SummarizingTravelAgent` có quy tắc:
- gom được vài sở thích thì gọi tool;
- khi được hỏi lại thì dùng bản tóm tắt;
- sở thích đổi thì cập nhật bản tóm tắt.

Thử với chuyến Hy Lạp: hải sản, lịch sử, nhảy đảo, 4.000 USD, hai tuần, đi cùng bạn đời vào tháng 6. Sau đó hỏi *"top 3 hòn đảo nên đến"*.

:::tip Tool này chưa thật sự "lưu" gì
`summarize_preferences` chỉ **trả lại** chuỗi, không ghi vào đâu. Bản tóm tắt chỉ nằm trong lịch sử hội thoại (dưới dạng kết quả tool), nên vẫn mất nếu lịch sử bị cắt. Muốn đúng nghĩa scratchpad, hãy ghi ra file hoặc object ngoài, như `ContextManager` trong bài tập ở trên, hoặc `PreferenceMemory` ở Bài 13.
:::

**File `vacation_agent_scratchpad.md`:** ví dụ một scratchpad thật mà agent ghi ra, có hai mục và dấu thời gian:

```markdown
# Agent Scratchpad
## User Preferences
- [2025-09-16 16:30:39] Budget: $3000 per person for a week
- [2025-09-16 16:30:39] Enjoys water sports, exploring local markets, and trying authentic cuisine
- [2025-09-16 16:30:39] Loves beach destinations with great food and culture
## Completed Tasks
- [2025-09-16 16:30:52] Created Greek Islands itinerary for beach vacation
- [2025-09-16 16:30:46] Created Bali itinerary for beach vacation
```

Tách *sở thích* khỏi *việc đã làm*, kèm thời gian, giúp agent (hoặc bạn khi debug) biết thông tin nào mới nhất.

:::quiz Agent có 80 tool và hay gọi nhầm tool không liên quan, nhất là khi dùng model nhỏ. Đây là kiểu hỏng nào, và cách sửa theo khóa học?
- [ ] Context poisoning; validate dữ liệu
- [ ] Context clash; pruning
- [x] Context confusion; dùng RAG trên mô tả tool để chỉ đưa tool liên quan nhất cho mỗi task
- [ ] Context distraction; tóm tắt hội thoại

Quá nhiều tool làm model rối. Quản lý "tool loadout" bằng truy xuất có chọn lọc; bản gốc khuyên giữ dưới 30 tool.
:::

:::quiz Theo khóa học, bản ghi kiểm tra context ở production nên chứa gì?
- [ ] Toàn văn prompt và output tool để debug cho dễ
- [x] Số đếm, id, hash, ước lượng token trước và sau, nhãn chính sách; không chứa nội dung nhạy cảm
- [ ] Không cần ghi gì, chỉ cần xem câu trả lời cuối
- [ ] Nội dung memory của người dùng

Mục tiêu là đủ bằng chứng để biết chiến lược nào đã chạy, mà không lưu dữ liệu nhạy cảm.
:::

:::quiz Người dùng nói "bay phổ thông", 20 lượt sau đổi thành "đi thương gia", và agent tìm cả hai loại vé. Kiểu hỏng nào?
- [x] Context clash
- [ ] Context confusion
- [ ] Context poisoning
- [ ] Context distraction

Hai chỉ dẫn mâu thuẫn cùng nằm trong context. Sửa bằng pruning (chỉ dẫn mới ghi đè cũ) hoặc scratchpad chốt sở thích cuối.
:::

:::exercise Viết một context manager nhỏ: pruning, nén và bản ghi kiểm tra
Viết class `ContextManager`:
1. `set_pref(key, value)`: sở thích mới **ghi đè** cũ (chống clash), trả về giá trị cũ.
2. `add(msg)`: thêm tin nhắn. Khi tổng token ước lượng (len/4) vượt `budget_tokens`, thì **tóm tắt mọi tin trừ `keep_last` tin cuối** (chống distraction), và ghi một bản ghi kiểm tra gồm số tin bị nén, token trước và sau, hash nguồn (không lưu nội dung).
3. `build()`: trả `["PREFERENCES: ...", *history]` cho lần gọi model tiếp theo.

Thử với `budget_tokens=40`, `keep_last=2`, đổi `cabin` từ `economy` sang `business`.
???
```python
import hashlib

def est_tokens(text: str) -> int:
    return max(1, len(text) // 4)          # ước lượng thô

class ContextManager:
    def __init__(self, budget_tokens=40, keep_last=2, summarize=None):
        self.prefs = {}
        self.history = []
        self.budget = budget_tokens
        self.keep_last = keep_last
        self.summarize = summarize or (lambda msgs: f"[tóm tắt {len(msgs)} tin cũ]")  # thay bằng LLM
        self.inspections = []

    def set_pref(self, key, value):
        old = self.prefs.get(key)
        self.prefs[key] = value
        return old

    def add(self, msg):
        self.history.append(msg)
        total = sum(est_tokens(m) for m in self.history)
        if total > self.budget and len(self.history) > self.keep_last:
            old, recent = self.history[:-self.keep_last], self.history[-self.keep_last:]
            self.history = [self.summarize(old)] + recent
            self.inspections.append({
                "event": "compress", "messages_in": len(old),
                "tokens_before": total, "tokens_after": sum(est_tokens(m) for m in self.history),
                "source_hash": hashlib.sha256("\n".join(old).encode()).hexdigest()[:12],
            })

    def build(self):
        prefs = "; ".join(f"{k}={v}" for k, v in self.prefs.items())
        return [f"PREFERENCES: {prefs}"] + self.history
```

Chạy với 4 tin, trong đó tin thứ 2 là đoạn kể chuyện phượt dài:

```text
old cabin: economy
PREFERENCES: cabin=business
[tóm tắt 2 tin cũ]
Thêm: mình thích bay thẳng.
Tìm vé rẻ cho tháng sau nhé.
[{'event': 'compress', 'messages_in': 1, 'tokens_before': 44, 'tokens_after': 41, ...},
 {'event': 'compress', 'messages_in': 2, 'tokens_before': 48, 'tokens_after': 17, ...}]
```

Sở thích nằm **ngoài** lịch sử (runtime state), nên không bao giờ bị nén mất và không mâu thuẫn. Bản ghi kiểm tra chỉ có số và hash, đúng khuyến nghị của bài. Với model thật, hàm `summarize` gọi LLM và nên giữ ngày, điểm đến, ngân sách.
:::

**Bài trước:** [Bài 11](/ai-agents/course/production-giao-thuc/giao-thuc-mcp-a2a-nlweb) · **Bài tiếp theo:** [Bài 13 — Memory](/ai-agents/course/production-giao-thuc/agent-memory)
