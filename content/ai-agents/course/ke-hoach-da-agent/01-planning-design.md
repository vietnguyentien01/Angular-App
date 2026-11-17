---
title: "Bài 7 — Planning Design Pattern: đặt mục tiêu, chia task và output có cấu trúc"
summary: "Agent cần mục tiêu rõ ràng rồi chia việc phức tạp thành task con. Planner trả về kế hoạch JSON có cấu trúc (Pydantic) để định tuyến tới agent chuyên trách, điều phối đa agent qua semantic router và group chat manager, và lập lại kế hoạch khi kết quả hoặc phản hồi người dùng thay đổi."
type: lesson
level: intermediate
lastReviewed: 2026-11-17
tags: [ai-agents, planning, structured-output, pydantic, orchestration]
related: [ai-agents/course/ke-hoach-da-agent/multi-agent, ai-agents/course/cong-cu-tri-thuc/tool-use, claude-code/consolidate/workflows/explore-plan-code]
changelog:
  - date: 2026-11-17
    note: Bổ sung phần đọc notebook từng bước, file phụ của bài và tài liệu tham khảo.
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 07 Planning Design](https://github.com/microsoft/ai-agents-for-beginners/tree/main/07-planning-design) (Microsoft, MIT License). Phần parse và định tuyến kế hoạch bằng Pydantic **đã chạy thử** (Python 3, pydantic 2.13). Phần gọi planner cần Microsoft Foundry.
:::

**Bài này gồm:**
- đặt mục tiêu tổng thể rõ ràng, chia task phức tạp thành task nhỏ dễ quản lý;
- dùng output có cấu trúc để câu trả lời đáng tin và máy đọc được;
- cách tiếp cận hướng sự kiện để xử lý task động và input bất ngờ.

**Mục tiêu:**
- xác định mục tiêu cho agent;
- chia task thành chuỗi task con hợp lý;
- trang bị đúng tool và quyết định khi nào dùng;
- đánh giá kết quả task con và lặp để cải thiện output cuối.

## Đặt mục tiêu và chia task

Phần lớn task thực tế quá phức tạp để làm trong một bước. Agent cần một mục tiêu ngắn gọn để dẫn hướng việc lập kế hoạch và hành động. Ví dụ:

```text
"Generate a 3-day travel itinerary."
```

Phát biểu thì đơn giản, nhưng vẫn cần làm rõ. Mục tiêu càng rõ, agent (và người cộng tác) càng tập trung đúng kết quả, vd một lịch trình đầy đủ có lựa chọn chuyến bay, gợi ý khách sạn và hoạt động.

### Chia nhỏ task (task decomposition)

Task lớn dễ quản lý hơn khi chia thành task con hướng mục tiêu. Với lịch trình du lịch:

- đặt vé máy bay;
- đặt khách sạn;
- thuê xe;
- cá nhân hoá.

Mỗi task con do một agent hay quy trình chuyên trách xử lý: agent săn vé rẻ, agent đặt khách sạn… Một agent điều phối "hạ nguồn" gom kết quả thành lịch trình thống nhất cho người dùng.

Cách chia module này cho phép **cải tiến dần**: thêm agent gợi ý món ăn hay hoạt động địa phương, rồi tinh chỉnh lịch trình theo thời gian.

### Output có cấu trúc

LLM có thể sinh output có cấu trúc (vd JSON) để agent hay dịch vụ hạ nguồn dễ parse và xử lý. Điều này đặc biệt hữu ích với multi-agent: nhận kế hoạch xong là thực thi được ngay.

```python
from enum import Enum
from typing import List
from pydantic import BaseModel

class AgentEnum(str, Enum):
    FlightBooking = "flight_booking"
    HotelBooking = "hotel_booking"
    CarRental = "car_rental"
    ActivitiesBooking = "activities_booking"
    DestinationInfo = "destination_info"
    DefaultAgent = "default_agent"
    GroupChatManager = "group_chat_manager"

class TravelSubTask(BaseModel):
    task_details: str
    assigned_agent: AgentEnum      # giao task cho agent nào

class TravelPlan(BaseModel):
    main_task: str
    subtasks: List[TravelSubTask]
    is_greeting: bool

system_prompt = """You are a planner agent.
    Your job is to decide which agents to run based on the user's request.
    Below are the available agents specialized in different tasks:
    - FlightBooking: For booking flights and providing flight information
    - HotelBooking: For booking hotels and providing hotel information
    - CarRental: For booking cars and providing car rental information
    - ActivitiesBooking: For booking activities and providing activity information
    - DestinationInfo: For providing information about destinations
    - DefaultAgent: For handling general requests"""

user_message = "Create a travel plan for a family of 2 kids from Singapore to Melbourne"
response = client.create_response(input=user_message, instructions=system_prompt)
pprint(json.loads(response.output_text))
```

Output trong bản gốc:

```json
{
  "is_greeting": "False",
  "main_task": "Plan a family trip from Singapore to Melbourne.",
  "subtasks": [
    { "assigned_agent": "flight_booking", "task_details": "Book round-trip flights from Singapore to Melbourne." },
    { "assigned_agent": "hotel_booking", "task_details": "Find family-friendly hotels in Melbourne." },
    { "assigned_agent": "car_rental", "task_details": "Arrange a car rental suitable for a family of four in Melbourne." },
    { "assigned_agent": "activities_booking", "task_details": "List family-friendly activities in Melbourne." },
    { "assigned_agent": "destination_info", "task_details": "Provide information about Melbourne as a travel destination." }
  ]
}
```

Dùng output này để định tuyến theo `assigned_agent` và tóm tắt kế hoạch cho người dùng.

:::tip Đừng chỉ `json.loads`, hãy validate
`json.loads` chỉ kiểm tra JSON hợp lệ. `TravelPlan.model_validate_json(...)` kiểm cả **schema**: `assigned_agent` phải thuộc enum, `is_greeting` phải là bool.

Mình chạy thử:
- `"is_greeting": "False"` (chuỗi) được Pydantic ép thành `False` kiểu `bool`;
- `"assigned_agent": "spa_booking"` ném `ValidationError` tại `('subtasks', 1, 'assigned_agent')`, loại lỗi `enum`.

Agent hạ nguồn nhờ vậy không bao giờ nhận tên agent bịa.
:::

## Planner điều phối nhiều agent

Ví dụ: một **Semantic Router Agent** nhận yêu cầu "I need a hotel plan for my trip". Planner sẽ:

1. **Nhận yêu cầu** và dựa trên system prompt (có danh sách agent khả dụng) để sinh kế hoạch có cấu trúc.
2. **Liệt kê agent và tool**: *agent registry* giữ danh sách agent (bay, khách sạn, thuê xe, hoạt động) và hàm/tool của từng agent.
3. **Định tuyến kế hoạch**: một task con thì gửi thẳng cho agent chuyên trách; nhiều task con thì phối hợp qua **group chat manager**.
4. **Tóm tắt kết quả** cho dễ hiểu.

Notebook: [07-python-agent-framework.ipynb](https://github.com/microsoft/ai-agents-for-beginners/blob/main/07-planning-design/code_samples/07-python-agent-framework.ipynb).

## Lập kế hoạch lặp (iterative planning)

Có task cần qua lại hoặc **lập lại kế hoạch** vì kết quả task con này ảnh hưởng task sau. Vd khi đặt vé, agent gặp định dạng dữ liệu bất ngờ thì phải đổi chiến lược trước khi sang đặt khách sạn. Phản hồi người dùng (vd thích chuyến bay sớm hơn) cũng có thể kích hoạt lập lại **một phần** kế hoạch.

```python
# giống code trước, kèm lịch sử người dùng và kế hoạch hiện tại
response = client.create_response(
    input=user_message,
    instructions=system_prompt,
    context=f"Previous travel plan - {TravelPlan}",
)
# ... lập lại kế hoạch và gửi task cho agent tương ứng
```

Để lập kế hoạch toàn diện hơn, bản gốc giới thiệu **Magentic One**: hệ multi-agent tổng quát cho task phức tạp, đạt kết quả ấn tượng trên nhiều benchmark agentic. Orchestrator của nó tạo kế hoạch theo task, giao cho agent, **theo dõi tiến độ** và lập lại kế hoạch khi cần.

## Tóm tắt

Planner chọn động trong số agent đã định nghĩa: output của nó chia task và giao agent để thực thi; mỗi agent được giả định có tool cần thiết. Ngoài ra có thể ghép thêm pattern như reflection, summarizer, round-robin chat.

:::senior Liên hệ Claude Code
Quy trình [explore → plan → code](/claude-code/consolidate/workflows/explore-plan-code) và Plan mode chính là planning pattern có **người duyệt kế hoạch** trước khi thực thi. Agent team với task list có phụ thuộc (Lab 14) là planner + registry + group chat manager.
:::

## Đọc notebook từng bước: `07-python-agent-framework.ipynb`

Notebook làm phiên bản đầy đủ hơn đoạn code trong bài: **planner có ưu tiên và phụ thuộc**, rồi **concierge thực thi** kế hoạch bằng tool.

**Cell 2–4: cài đặt và tạo client** (`FoundryChatClient`, `DefaultAzureCredential`).

**Cell 5–6: chia nhỏ task.** Mỗi task con giao cho một agent chuyên trách, có độ ưu tiên và thứ tự phụ thuộc. Lợi ích:
- **rõ ràng:** mỗi task con một trách nhiệm;
- **song song:** task con độc lập chạy cùng lúc được;
- **đáng tin cậy:** lỗi khoanh trong từng task con;
- **theo dõi ngân sách.**

```python
class TravelSubTask(BaseModel):
    task_id: int
    description: str
    assigned_agent: str        # "flight_agent", "hotel_agent", "activity_agent"
    priority: str              # "high", "medium", "low"
    dependencies: list[int] = []

class TravelPlan(BaseModel):
    destination: str
    trip_duration_days: int
    subtasks: list[TravelSubTask]
    total_estimated_budget_usd: int
    notes: str
```

So với bản trong bài, schema này có thêm `task_id`, `priority`, `dependencies` và ước tính ngân sách tổng.

**Cell 7–8: planner ("lễ tân") trả `TravelPlan`.**

```python
planning_agent = client.as_agent(
    name="TravelPlanner",
    instructions="""You are a travel planning agent. When given a travel request:
1. Break it into specific subtasks (flights, hotels, activities, logistics)
2. Assign each subtask to the appropriate specialist agent
3. Set priorities and identify dependencies between tasks
4. Estimate the total budget""",
)
result = await planning_agent.run(
    "Plan a 7-day trip to Paris for a couple interested in art, cuisine, and history. Budget around $5000.",
    options={"response_format": TravelPlan},
)
plan = result.value
for task in plan.subtasks:
    print(f"  [{task.priority}] {task.task_id}. {task.description} → {task.assigned_agent}")
```

**Cell 9–10: concierge thực thi bằng tool chuyên trách.** Ba tool:
- `book_flight(destination, departure_date, return_date)`;
- `reserve_hotel(city, check_in, check_out, guests)`;
- `book_activity(activity_name, date, participants)`.

Mỗi tool trả về chuỗi xác nhận giả. Kế hoạch được chuyển thành danh sách dòng `- [priority] id. mô tả (agent, deps)` rồi đưa cho agent `Concierge`, với chỉ dẫn *"làm lần lượt theo thứ tự, tôn trọng phụ thuộc, tóm tắt kết quả"*.

:::tip Thứ tự phụ thuộc nên do code đảm bảo
Notebook để LLM tự "tôn trọng phụ thuộc". Bạn có thể chắc chắn hơn bằng cách sắp xếp topo ngay trong code, với `graphlib` có sẵn trong Python. Mình chạy thử:

```python
from graphlib import TopologicalSorter
order = list(TopologicalSorter({t.task_id: t.dependencies for t in plan.subtasks}).static_order())
# {1: [], 2: [1], 3: [1], 4: [2, 3]}  →  [1, 2, 3, 4]
# phụ thuộc vòng {1: [2], 2: [1]}      →  CycleError [1, 2, 1]  → yêu cầu planner lập lại kế hoạch
```

Ngoài ra, tool đặt chỗ thật nên khai báo `approval_mode="always_require"` (Bài 4). Mã xác nhận dùng `hash()` cũng đổi theo từng process (xem Bài 4).
:::

**Cell 11 (tổng kết):**
1. **chia nhỏ task:** planner tách yêu cầu thành task con có ưu tiên và phụ thuộc;
2. **output có cấu trúc:** `response_format` trả `TravelPlan` đã validate;
3. **thực thi kế hoạch:** concierge đi qua task con bằng tool chuyên trách.

### Bản .NET

`07-dotnet-agent-framework` làm cùng luồng planner → concierge bằng C#; xem [Phụ lục .NET](/ai-agents/course/nang-cao/phu-luc-dotnet).

## Tài liệu tham khảo (theo bản gốc)

- Magentic-One, hệ multi-agent tổng quát của Microsoft Research: <https://www.microsoft.com/en-us/research/articles/magentic-one-a-generalist-multi-agent-system-for-solving-complex-tasks/>

:::quiz Vì sao planner nên trả kế hoạch dạng JSON theo schema (Pydantic) thay vì văn bản tự do?
- [ ] Vì JSON ngắn hơn nên rẻ hơn
- [x] Để agent hoặc dịch vụ hạ nguồn parse, validate và định tuyến tự động theo `assigned_agent`
- [ ] Vì model không viết được văn bản dài
- [ ] Để người dùng đọc dễ hơn

Output có cấu trúc là "hợp đồng" giữa planner và executor. Validate theo schema giúp chặn tên agent không tồn tại.
:::

:::quiz Planner trả `{"is_greeting": "False", ...}` và bạn parse bằng `TravelPlan.model_validate_json`. Giá trị `plan.is_greeting` là gì?
- [ ] Chuỗi `"False"`, nên `if plan.is_greeting:` vẫn đúng
- [x] `False` kiểu `bool`, vì Pydantic (chế độ lax mặc định) ép chuỗi `"False"` thành bool
- [ ] `ValidationError`
- [ ] `None`

Đã chạy với pydantic 2.13. Nếu chỉ `json.loads` rồi kiểm `if data["is_greeting"]:`, chuỗi `"False"` là truthy, và bạn sẽ coi mọi yêu cầu là lời chào. Thêm một lý do để validate bằng schema.
:::

:::exercise Định tuyến kế hoạch và lập lại khi kế hoạch sai schema
Dùng `TravelPlan` ở trên, viết:
1. `route(plan, handlers)`:
   - nếu `is_greeting` thì trả lời chào;
   - còn lại, mỗi task con gọi handler theo `assigned_agent`;
   - agent chưa có handler thì ghi `[default]`, không crash.
2. `parse_or_replan(raw_json, replan, max_attempts=2)`:
   - parse lỗi schema thì gọi `replan(thông_báo_lỗi)` để planner trả JSON mới;
   - hết lượt thì báo lỗi.
???
```python
from pydantic import ValidationError

HANDLERS = {
    AgentEnum.FlightBooking: lambda t: f"[flight] {t}",
    AgentEnum.HotelBooking: lambda t: f"[hotel] {t}",
}

def route(plan, handlers=HANDLERS):
    if plan.is_greeting:
        return ["Xin chào! Bạn muốn đi đâu?"]
    out = []
    for st in plan.subtasks:
        h = handlers.get(st.assigned_agent)
        out.append(h(st.task_details) if h
                   else f"[default] chưa có agent cho {st.assigned_agent.value}: {st.task_details}")
    return out

def parse_or_replan(raw_json, replan, max_attempts=2):
    for _ in range(max_attempts):
        try:
            return TravelPlan.model_validate_json(raw_json)
        except ValidationError as e:
            raw_json = replan(str(e))      # gửi lỗi cho planner để nó sửa
    raise RuntimeError("planner không trả được kế hoạch hợp lệ")
```

Chạy thử với kế hoạch hai task `flight_booking` và `car_rental`, khi chỉ có handler bay và khách sạn:

```text
['[flight] Book flights', '[default] chưa có agent cho car_rental: Find hotels']
```

`replan` thật sẽ gọi lại planner, kèm thông báo lỗi của Pydantic trong `context`. Đó là vòng **iterative planning** ở mức nhỏ nhất.
:::

**Bài trước:** [Bài 6](/ai-agents/course/cong-cu-tri-thuc/xay-agent-dang-tin-cay) · **Bài tiếp theo:** [Bài 8 — Multi-agent](/ai-agents/course/ke-hoach-da-agent/multi-agent)
