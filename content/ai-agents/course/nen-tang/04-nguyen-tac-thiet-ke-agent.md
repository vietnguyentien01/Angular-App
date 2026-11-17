---
title: "Bài 3 — Nguyên tắc thiết kế agentic (Agentic Design Principles)"
summary: "Bộ nguyên tắc UX lấy con người làm trung tâm của Microsoft cho agent: ba trục Space (không gian), Time (quá khứ, hiện tại, tương lai) và Core (chấp nhận bất định nhưng xây niềm tin), ba hướng dẫn minh bạch, kiểm soát, nhất quán, và cách áp dụng vào một agent du lịch."
type: lesson
level: core
lastReviewed: 2026-11-17
tags: [ai-agents, ux, design-principles, trust]
related: [ai-agents/course/nen-tang/kham-pha-agent-framework, ai-agents/course/cong-cu-tri-thuc/xay-agent-dang-tin-cay]
changelog:
  - date: 2026-11-17
    note: Bổ sung phần đọc notebook từng bước, file phụ của bài và tài liệu tham khảo.
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 03 Agentic Design Patterns](https://github.com/microsoft/ai-agents-for-beginners/tree/main/03-agentic-design-patterns) (Microsoft, MIT License).
:::

Có rất nhiều cách nghĩ về việc xây hệ thống agentic. Trong Generative AI, sự mơ hồ là *đặc tính*, không phải lỗi, nên kỹ sư thường khó biết bắt đầu từ đâu. Microsoft đưa ra bộ **nguyên tắc thiết kế UX lấy con người làm trung tâm**. Đây không phải kiến trúc bắt buộc mà là điểm xuất phát cho team đang định hình trải nghiệm agent.

Nhìn chung, agent nên:

- **mở rộng năng lực con người**: brainstorm, giải quyết vấn đề, tự động hoá…;
- **lấp khoảng trống kiến thức**: giúp nắm nhanh một lĩnh vực, dịch thuật…;
- **hỗ trợ cộng tác** theo cách mỗi người thích làm việc với người khác;
- **giúp ta thành phiên bản tốt hơn**: vd như huấn luyện viên hay người nhắc việc, giúp học cách điều hoà cảm xúc, chánh niệm, xây dựng sức bền tinh thần.

**Mục tiêu:** giải thích được các nguyên tắc thiết kế agentic, hướng dẫn áp dụng, và cách xây agent theo chúng.

## Ba trục nguyên tắc

### Agent (Space): không gian

Môi trường agent hoạt động, cả thế giới vật lý lẫn số.

- **Kết nối, không thay thế** (*connecting, not collapsing*): giúp kết nối con người với người khác, với sự kiện và với tri thức có thể hành động.
  - Agent nối sự kiện, tri thức và con người.
  - Agent kéo con người lại gần nhau, không sinh ra để thay thế hay coi nhẹ con người.
- **Dễ tiếp cận nhưng đôi khi vô hình**: agent chủ yếu chạy nền và chỉ "nhắc" khi phù hợp.
  - Người dùng được phép dễ dàng tìm và dùng agent trên mọi thiết bị, nền tảng.
  - Hỗ trợ input/output đa phương thức: âm thanh, giọng nói, văn bản…
  - Chuyển mượt giữa tiền cảnh và hậu cảnh, giữa chủ động và bị động, tuỳ nhu cầu agent cảm nhận được.
  - Có thể chạy ẩn, nhưng **đường đi xử lý nền và việc phối hợp với agent khác vẫn minh bạch và người dùng kiểm soát được**.

### Agent (Time): thời gian

Cách agent hoạt động theo thời gian.

- **Quá khứ: suy ngẫm lịch sử**, gồm cả trạng thái lẫn ngữ cảnh.
  - Kết quả phù hợp hơn nhờ phân tích dữ liệu lịch sử phong phú, không chỉ sự kiện, con người hay trạng thái.
  - Nối các sự kiện cũ và chủ động nhìn lại memory để xử lý tình huống hiện tại.
- **Hiện tại: gợi ý (nudge) hơn là thông báo.**
  - Khi có sự kiện, agent không dừng ở thông báo tĩnh. Nó đơn giản hoá luồng hoặc sinh tín hiệu động để hướng sự chú ý của người dùng đúng lúc.
  - Đưa thông tin theo bối cảnh môi trường, thay đổi xã hội và văn hoá, và theo ý định người dùng.
  - Tương tác có thể tăng dần độ phức tạp, giúp người dùng mạnh lên về lâu dài.
- **Tương lai: thích nghi và tiến hoá.**
  - Thích nghi với nhiều thiết bị, nền tảng, phương thức.
  - Thích nghi với hành vi và nhu cầu accessibility của người dùng; tuỳ biến tự do.
  - Được định hình và tiến hoá qua tương tác liên tục.

### Agent (Core): lõi

- **Chấp nhận sự bất định nhưng xây dựng niềm tin.**
  - Một mức bất định nhất định là điều được dự liệu; bất định là yếu tố then chốt của thiết kế agent.
  - Niềm tin và minh bạch là lớp nền.
  - **Con người quyết định khi nào agent bật/tắt, và trạng thái agent luôn hiển thị rõ.**

## Ba hướng dẫn khi áp dụng

1. **Minh bạch (Transparency):** cho người dùng biết có AI tham gia, nó hoạt động thế nào (kể cả hành động trước đó), và cách gửi phản hồi hay chỉnh sửa hệ thống.
2. **Kiểm soát (Control):** cho người dùng tuỳ biến, đặt sở thích, cá nhân hoá và kiểm soát hệ thống cùng các thuộc tính của nó, **kể cả quyền yêu cầu agent quên**.
3. **Nhất quán (Consistency):** trải nghiệm đa phương thức nhất quán giữa các thiết bị. Dùng UI/UX quen thuộc khi có thể (vd icon micro cho giọng nói), và giảm tải nhận thức (câu trả lời ngắn gọn, hình minh hoạ, nội dung "Tìm hiểu thêm").

## Áp dụng: thiết kế agent du lịch

1. **Minh bạch**
   - Nói rõ đây là agent dùng AI.
   - Có hướng dẫn bắt đầu: lời chào "Hello", prompt mẫu; ghi rõ trên trang sản phẩm.
   - Hiện danh sách prompt người dùng đã hỏi.
   - Chỉ rõ cách phản hồi: thumbs up/down, nút Send Feedback.
   - Nói rõ giới hạn sử dụng hay giới hạn chủ đề, nếu có.
2. **Kiểm soát**
   - Rõ cách người dùng chỉnh agent sau khi tạo, vd qua System Prompt.
   - Cho chọn độ dài câu trả lời, văn phong, và những chủ đề agent không nên bàn.
   - Cho xem và xoá file, dữ liệu, prompt và hội thoại cũ liên quan.
3. **Nhất quán**
   - Icon Share Prompt, đính kèm file hay ảnh, tag người hay vật phải chuẩn, dễ nhận ra.
   - Dùng icon kẹp giấy cho upload hay chia sẻ file với agent, icon ảnh cho upload hình.

:::tip Góc nhìn dev frontend
Ba hướng dẫn này phần lớn là **việc của frontend**:
- badge "AI" và trạng thái agent: đang chạy, đang chờ duyệt, đã tắt;
- lịch sử prompt và nút xoá dữ liệu;
- nút feedback;
- icon chuẩn;
- hiển thị streaming ngắn gọn.

Khi làm UI chat cho agent bằng Angular, hãy coi đây là checklist acceptance.
:::

## Code mẫu: instructions rõ ràng và output có cấu trúc

Rút gọn từ notebook [`03-python-agent-framework.ipynb`](https://github.com/microsoft/ai-agents-for-beginners/blob/main/03-agentic-design-patterns/code_samples/03-python-agent-framework.ipynb). Notebook minh hoạ hai ý. Một là `instructions` mô tả vai trò và quy trình **minh bạch**. Hai là trả về dữ liệu có cấu trúc (Pydantic), để UI hiển thị **nhất quán**.

```python
from typing import Annotated
from pydantic import BaseModel
from agent_framework import tool

agent = provider.as_agent(
    name="TravelConcierge",
    instructions="""You are a luxury travel concierge named Alex. Your role is to:
1. Understand the traveler's preferences (budget, climate, activities)
2. Check destination availability before making recommendations
3. Provide detailed, personalized travel suggestions
4. Always mention visa requirements and best travel seasons
Be warm, professional, and enthusiastic about travel.""",
)

class DestinationRecommendation(BaseModel):
    destination: str
    available: bool
    best_season: str
    highlights: list[str]
    estimated_budget_usd: int

@tool(approval_mode="never_require")
def get_destination_details(
    destination: Annotated[str, "The destination to look up"]
) -> DestinationRecommendation:
    """Get structured details about a vacation destination."""
    ...
```

## Đọc notebook từng bước: `03-python-agent-framework.ipynb`

Notebook áp ba design pattern vào một agent gợi ý du lịch.

**Cell 2–4: cài đặt và tạo client.**
- Cài `agent-framework azure-ai-projects azure-identity pydantic python-dotenv`.
- Kiểm tra hai biến môi trường, tạo `FoundryChatClient` với `DefaultAzureCredential()`.

**Pattern 1: instructions rõ ràng (cell 5).** Agent `TravelConcierge` (tên "Alex") có vai trò, quy trình 4 bước và giọng điệu được nêu từ đầu:
1. hiểu sở thích;
2. kiểm tra còn chỗ trước khi gợi ý;
3. gợi ý chi tiết, cá nhân hoá;
4. luôn nhắc visa và mùa đẹp nhất.

Câu hỏi thử: *"một tuần nghỉ có đồ ăn ngon và lịch sử, ngân sách khoảng 2.500 USD"*.

**Pattern 2: output có cấu trúc bằng Pydantic (cell 6–7).** Văn bản tự do hợp cho hội thoại, nhưng hệ thống hạ nguồn cần dữ liệu có cấu trúc. Model `DestinationRecommendation` (điểm đến, còn chỗ, mùa đẹp, điểm nổi bật, ngân sách ước tính) và `TravelRecommendations` (danh sách gợi ý + ghi chú cá nhân). Tool `get_destination_details` trả về chính object Pydantic. Barcelona, Tokyo còn chỗ; Cape Town hết chỗ; điểm lạ trả `available=False`, `best_season="Unknown"`.

Mấu chốt là truyền **`response_format`** khi chạy, để **buộc** model trả object đã validate:

```python
response = await structured_agent.run(
    "Recommend 3 destinations for a culture-loving traveler with a $2500 budget",
    options={"response_format": TravelRecommendations},
)
if response and response.value:
    result: TravelRecommendations = response.value      # object Pydantic, không phải chuỗi
    for rec in result.recommendations:
        print(rec.destination, "Available" if rec.available else "Not available", rec.best_season)
else:
    print("No validated structured response was returned.")
```

Nhánh `else` xử lý trường hợp model không trả được object hợp lệ. Đừng giả định lúc nào cũng có `response.value`.

**Pattern 3: agent một trách nhiệm (cell 8–9).** Chia việc phức tạp cho nhiều agent hẹp, theo nguyên tắc *separation of concerns*:
- `DestinationExpert` chỉ đánh giá điểm đến, kiểm tra còn chỗ, trả danh sách xếp hạng kèm ưu/nhược. Instructions ghi rõ **"KHÔNG bàn chuyện vé, khách sạn"**.
- `LogisticsPlanner` chỉ lập lịch trình từng ngày, gợi ý vé và khách sạn trong ngân sách, nhắc visa và bảo hiểm. Instructions ghi rõ **"KHÔNG gợi ý điểm đến"**.

Bước 1 chạy `DestinationExpert`. Bước 2 truyền kết quả bước 1 vào prompt của `LogisticsPlanner`.

**Cell 10 (tổng kết):**

| Pattern | Ý chính | Lợi ích |
|---|---|---|
| Instructions rõ ràng | Nêu persona, trách nhiệm, ràng buộc từ đầu | Hành vi nhất quán |
| Output có cấu trúc | Model Pydantic làm `response_format` | Kết quả đã validate, máy đọc được |
| Một trách nhiệm | Mỗi agent một việc | Dễ test, bảo trì, ghép nối |

Ba pattern ghép được với nhau: một agent hẹp vẫn có thể có instructions rõ và output có cấu trúc.

## Tài liệu tham khảo (theo bản gốc)

- *Practices for Governing Agentic AI Systems*, OpenAI: <https://openai.com/index/practices-for-governing-agentic-ai-systems/>
- The HAX Toolkit Project, Microsoft Research: <https://www.microsoft.com/en-us/haxtoolkit/>
- Responsible AI Toolbox: <https://responsibleaitoolbox.ai/>

:::quiz Nguyên tắc "con người quyết định khi nào agent bật/tắt, trạng thái agent luôn hiển thị rõ" thuộc trục nào?
- [ ] Space
- [ ] Time — Hiện tại
- [x] Core — chấp nhận bất định nhưng xây niềm tin
- [ ] Time — Tương lai

Đây là lớp lõi: chấp nhận agent có bất định, nên phải đặt niềm tin và quyền kiểm soát của con người làm nền.
:::

:::quiz Tính năng nào thể hiện hướng dẫn **Control** (kiểm soát)? (chọn nhiều)
- [x] Cho người dùng xoá hội thoại và file đã chia sẻ với agent
- [x] Cho chọn độ dài và văn phong câu trả lời
- [ ] Dùng icon kẹp giấy cho nút đính kèm
- [ ] Hiện badge "Được hỗ trợ bởi AI"

Xoá dữ liệu (kể cả quyền yêu cầu quên) và cá nhân hoá là Control. Icon chuẩn là Consistency, badge AI là Transparency.
:::

:::exercise Review UI của một agent theo ba hướng dẫn
Bạn được giao review màn hình chat của "Trợ lý đặt phòng" trong app công ty. Hiện tại màn hình chỉ có một ô nhập và vùng hiển thị câu trả lời. Liệt kê ít nhất 2 thay đổi cho mỗi hướng dẫn (Minh bạch, Kiểm soát, Nhất quán) và ghi component Angular bạn sẽ thêm.
???
**Minh bạch**
- Banner "Trợ lý AI, có thể sai, hãy kiểm tra trước khi xác nhận" (`<app-ai-disclaimer>`).
- Prompt mẫu khi trống (`<app-suggested-prompts>`).
- Hiện tool agent đã gọi, vd "Đã kiểm tra phòng trống" (`<app-agent-steps>`).
- Nút 👍/👎 mỗi câu trả lời (`<app-feedback>`).

**Kiểm soát**
- Trang cài đặt để chọn độ dài và văn phong.
- Lịch sử hội thoại, có nút xoá từng mục hoặc "Xoá toàn bộ dữ liệu".
- Nút dừng hoặc tắt agent; bước xác nhận trước khi đặt phòng thật (human-in-the-loop).

**Nhất quán**
- Icon kẹp giấy để đính kèm, micro cho giọng nói.
- Cùng component và token màu với phần còn lại của app.
- Câu trả lời ngắn kèm "Xem chi tiết".
- Hiển thị giống nhau trên mobile và desktop.
:::

**Bài trước:** [Bài 2](/ai-agents/course/nen-tang/kham-pha-agent-framework) · **Bài tiếp theo:** [Bài 4 — Tool use](/ai-agents/course/cong-cu-tri-thuc/tool-use)
