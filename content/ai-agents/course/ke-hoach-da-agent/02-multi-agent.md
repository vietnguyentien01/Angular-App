---
title: "Bài 8 — Multi-Agent Design Pattern: khi nào cần nhiều agent, các khối xây dựng và pattern"
summary: "Nhiều agent đáng dùng khi việc lớn, phức tạp hoặc cần chuyên môn khác nhau: chuyên môn hoá, dễ scale, chịu lỗi. Sáu khối xây dựng, quan sát tương tác giữa agent, ba pattern (group chat, hand-off, collaborative filtering), kịch bản hoàn tiền, và workflow tuần tự bằng WorkflowBuilder."
type: lesson
level: intermediate
lastReviewed: 2026-11-17
tags: [ai-agents, multi-agent, orchestration, workflow, hand-off]
related: [ai-agents/course/ke-hoach-da-agent/planning-design, ai-agents/course/nang-cao/microsoft-agent-framework, claude-code/labs/labs/workflow-nhieu-agent]
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 08 Multi-Agent](https://github.com/microsoft/ai-agents-for-beginners/tree/main/08-multi-agent) (Microsoft, MIT License), gồm cả bài tập, lời giải và knowledge check gốc. Code workflow cần Microsoft Foundry.
:::

Khi dự án có nhiều agent, bạn phải tính tới multi-agent design pattern. Nhưng chuyển sang nhiều agent lúc nào, và lợi ích là gì, thì không phải lúc nào cũng rõ.

> *Multi-agent là design pattern cho phép nhiều agent làm việc cùng nhau để đạt một mục tiêu chung.*

Pattern này được dùng rộng rãi trong robotics, hệ tự hành, tính toán phân tán.

## Khi nào nên dùng nhiều agent

- **Khối lượng lớn:** chia thành task nhỏ giao cho nhiều agent để xử lý song song, xong nhanh hơn, vd xử lý dữ liệu lớn.
- **Task phức tạp:** chia thành task con, mỗi agent chuyên một khía cạnh, vd xe tự lái có agent dẫn đường, agent phát hiện vật cản, agent giao tiếp với xe khác.
- **Chuyên môn đa dạng:** mỗi agent một chuyên môn, xử lý tốt hơn một agent ôm hết, vd y tế có agent chẩn đoán, agent phác đồ điều trị, agent theo dõi bệnh nhân.

## Lợi ích so với một agent

- **Chuyên môn hoá:** một agent làm mọi thứ dễ bị rối khi gặp task phức tạp, có thể làm việc nó không giỏi nhất.
- **Khả năng mở rộng:** thêm agent dễ hơn nhồi thêm vào một agent.
- **Chịu lỗi:** một agent hỏng, các agent khác vẫn chạy.

Ví dụ đặt chuyến đi:
- **Một agent** phải có tool cho mọi bước (tìm vé, đặt khách sạn, thuê xe), thành một hệ nguyên khối khó bảo trì, khó scale.
- **Hệ nhiều agent** có agent riêng cho vé, khách sạn, xe, nên module hoá, dễ bảo trì và mở rộng.

Giống như văn phòng du lịch gia đình (một người lo hết) so với chuỗi nhượng quyền (mỗi bộ phận một việc).

## Các khối xây dựng

| Khối | Câu hỏi phải trả lời | Ví dụ đặt chuyến đi |
|---|---|---|
| **Giao tiếp giữa agent** | *Agent nào chia sẻ thông tin gì, bằng cách nào?* | Agent vé báo ngày bay cho agent khách sạn để đặt đúng ngày. |
| **Cơ chế phối hợp** | *Agent phối hợp hành động thế nào?* | Người dùng muốn khách sạn gần sân bay (sở thích), xe chỉ thuê được ở sân bay (ràng buộc); agent khách sạn và agent xe phải phối hợp. |
| **Kiến trúc agent** | *Agent ra quyết định và học từ tương tác thế nào?* | Agent vé dùng mô hình ML gợi ý chuyến theo sở thích cũ. |
| **Quan sát tương tác** | *Làm sao thấy agent nào đang làm gì?* | Log, công cụ trực quan hoá, metric hiệu năng. |
| **Pattern multi-agent** | *Tập trung, phi tập trung hay lai?* | Chọn theo use case. |
| **Human-in-the-loop** | *Khi nào agent phải hỏi người?* | Người dùng muốn khách sạn agent chưa gợi ý; xác nhận trước khi đặt. |

## Quan sát tương tác giữa các agent

Khả năng quan sát là thiết yếu để debug, tối ưu và đảm bảo hệ thống hiệu quả. Vd một dashboard hiện trạng thái từng agent, sở thích và ràng buộc của người dùng, các tương tác: ngày đi, chuyến bay agent vé gợi ý, khách sạn agent khách sạn gợi ý, xe agent thuê xe gợi ý.

- **Log và giám sát:** mỗi hành động của agent có một log entry gồm agent nào, làm gì, lúc nào, kết quả ra sao.
- **Trực quan hoá:** đồ thị luồng thông tin giữa agent giúp thấy nút thắt, chỗ kém hiệu quả.
- **Metric hiệu năng:** thời gian hoàn thành task, số task mỗi đơn vị thời gian, độ chính xác của gợi ý.

## Ba pattern cụ thể

### Group chat

Nhiều agent trò chuyện với nhau. Use case: cộng tác nhóm, hỗ trợ khách hàng, mạng xã hội. Mỗi agent như một thành viên, gửi và nhận tin trong nhóm, phản hồi agent khác. Có thể triển khai **tập trung** (mọi tin qua server trung tâm) hoặc **phi tập trung** (trao đổi trực tiếp).

### Hand-off (chuyển giao)

Agent chuyển task cho nhau theo **quy tắc định trước**. Mỗi agent là một task hoặc một bước trong workflow. Use case: hỗ trợ khách hàng, quản lý task, tự động hoá workflow.

### Collaborative filtering (lọc cộng tác)

Nhiều agent cùng đưa ra gợi ý, mỗi agent đóng góp theo chuyên môn. Vd gợi ý mua cổ phiếu nào: agent **chuyên ngành**, agent **phân tích kỹ thuật**, agent **phân tích cơ bản** cùng hợp sức cho gợi ý toàn diện hơn.

## Kịch bản: quy trình hoàn tiền

**Agent riêng cho quy trình hoàn tiền:**
- **Customer agent:** đại diện khách, khởi động yêu cầu hoàn tiền.
- **Seller agent:** đại diện người bán, xử lý hoàn tiền.
- **Payment agent:** hoàn tiền vào phương thức thanh toán của khách.
- **Resolution agent:** giải quyết vấn đề phát sinh.
- **Compliance agent:** đảm bảo tuân thủ quy định và chính sách.

**Agent dùng chung cho cả doanh nghiệp:**
- **Shipping:** gửi hàng trả về; cũng dùng cho giao hàng thường.
- **Feedback:** thu phản hồi bất cứ lúc nào.
- **Escalation:** chuyển vấn đề lên cấp hỗ trợ cao hơn, dùng được cho mọi quy trình.
- **Notification:** báo khách ở từng giai đoạn.
- **Analytics:** phân tích dữ liệu.
- **Audit:** kiểm toán xem quy trình làm đúng chưa.
- **Reporting:** tạo báo cáo.
- **Knowledge:** duy trì knowledge base về hoàn tiền và các mảng khác.
- **Security:** đảm bảo an toàn quy trình.
- **Quality:** đảm bảo chất lượng.

## Code mẫu: workflow tuần tự với WorkflowBuilder

Rút gọn từ notebook [`08-python-agent-framework.ipynb`](https://github.com/microsoft/ai-agents-for-beginners/blob/main/08-multi-agent/code_samples/08-python-agent-framework.ipynb). Planner lập lịch trình → Concierge review và bổ sung → BudgetReviewer kiểm ngân sách.

```python
from agent_framework import AgentResponseUpdate, WorkflowBuilder

planner_agent = client.as_agent(
    name="TravelPlanner",
    instructions="You are a travel planning specialist. Create detailed trip itineraries based on the traveler's preferences. Include daily schedules, must-see attractions, and logistical tips.",
)
concierge_agent = client.as_agent(
    name="TravelConcierge",
    instructions="You are a travel concierge who reviews and enhances trip plans. Review the plan for completeness, add local insider tips, suggest restaurants, and identify potential issues.",
)
budget_agent = client.as_agent(
    name="BudgetReviewer",
    instructions="You are a budget-conscious travel advisor. Review the proposed trip plan against the traveler's stated budget. Flag anything that risks exceeding the budget and suggest cost-saving alternatives.",
)

workflow = (WorkflowBuilder(start_executor=planner_agent)
            .add_edge(planner_agent, concierge_agent)
            .add_edge(concierge_agent, budget_agent)
            .build())

last_author = None
async for event in workflow.run("Plan a 5-day trip to Paris for a food-loving couple on a $3000 budget.", stream=True):
    if event.type == "output" and isinstance(event.data, AgentResponseUpdate):
        if event.data.author_name != last_author:
            last_author = event.data.author_name
            print(f"\n=== 🤖 {last_author} ===")
        print(event.data.text, end="", flush=True)
```

Mỗi `add_edge` nối output của agent trước thành input của agent sau. Thêm một bước review là thêm một cạnh, không phải sửa agent cũ. Thư mục `code_samples/workflows-agent-framework` của bản gốc có thêm workflow điều kiện (dùng Bing grounding, xem Bài 0).

:::senior Liên hệ Claude Code
- Chuỗi subagent explorer → implementer → reviewer trong [Lab 14](/claude-code/labs/labs/workflow-nhieu-agent) là workflow tuần tự như trên.
- Ba subagent điều tra song song là collaborative filtering.
- Agent team với task list là group chat có điều phối.

Tiêu chí chọn giống hệt: tách agent khi **vai trò, tool hoặc quyền** khác nhau, không phải chỉ vì "nhiều việc".
:::

:::quiz (Knowledge check gốc) Kịch bản nào hợp nhất với hệ multi-agent?
- [ ] Bot hỗ trợ trả lời câu hỏi thường gặp từ một knowledge base và vài tool
- [x] Quy trình hoàn tiền cần vai trò riêng cho fraud, payment và compliance, mỗi vai trò có tool riêng, và kết quả phải được phối hợp
- [ ] Cùng một yêu cầu phân loại đơn giản đến hàng nghìn lần mỗi giờ

Nhiều agent hữu ích khi có vai trò chuyên môn riêng, tool hoặc quyền riêng, và các bước chuyển giao cần phối hợp. Khối lượng lớn các request giống nhau chủ yếu là bài toán **scale**, tự nó không đòi hỏi multi-agent.
:::

:::quiz (Knowledge check gốc) Khi nào một agent đơn thường là lựa chọn tốt hơn?
- [x] Task xử lý được bằng một bộ instructions và tool, không cần chuyển giao chuyên môn
- [ ] Agent có quyền dùng nhiều hơn một tool
- [ ] Workflow cần vai trò tách biệt với quyền khác nhau và audit trail độc lập

Một agent dễ test, quan sát và vận hành hơn. Có nhiều tool **không** tự động đòi nhiều agent; vai trò với quyền và yêu cầu audit khác nhau mới là lý do.
:::

:::quiz Trong pattern hand-off, agent chuyển task cho nhau dựa trên gì?
- [ ] Bỏ phiếu giữa mọi agent
- [x] Quy tắc định trước; mỗi agent là một task hoặc bước trong workflow
- [ ] Ngẫu nhiên để cân bằng tải
- [ ] Người dùng chọn agent ở mỗi bước

Hand-off là chuyển giao theo luật. Group chat là trao đổi tự do trong nhóm; collaborative filtering là cùng đóng góp gợi ý.
:::

:::exercise (Bài tập gốc) Thiết kế hệ multi-agent cho quy trình hỗ trợ khách hàng
Xác định các agent, vai trò, trách nhiệm và cách chúng tương tác. Tính cả agent riêng cho quy trình hỗ trợ lẫn agent dùng chung cho các mảng khác của doanh nghiệp.

*Gợi ý:* nghĩ theo từng giai đoạn của quy trình hỗ trợ, và những agent mà hệ thống nào cũng cần. Bạn có thể cần nhiều agent hơn bạn nghĩ.
???
Lời giải gốc của khóa học:

- **Customer agent:** đại diện khách, khởi động yêu cầu hỗ trợ.
- **Support agent:** trực tiếp hỗ trợ khách.
- **Escalation agent:** chuyển lên cấp cao hơn.
- **Resolution agent:** giải quyết vấn đề phát sinh.
- **Feedback agent:** thu phản hồi.
- **Notification agent:** gửi thông báo ở từng giai đoạn.
- **Analytics agent:** phân tích dữ liệu hỗ trợ.
- **Audit agent:** kiểm toán xem quy trình làm đúng chưa.
- **Reporting agent:** tạo báo cáo.
- **Knowledge agent:** duy trì knowledge base.
- **Security agent:** bảo đảm an toàn.
- **Quality agent:** bảo đảm chất lượng.
- **Compliance agent:** tuân thủ quy định và chính sách.
- **Training agent:** đào tạo nhân viên hỗ trợ cách giúp khách.

"Nhiều hơn hay ít hơn bạn nghĩ?" Thực tế, hãy bắt đầu bằng ít agent nhất: Support + Knowledge + Escalation (có người duyệt). Chỉ tách thêm agent khi một vai trò cần **tool hoặc quyền riêng** (vd Payment) hay **audit riêng** (Compliance). Các agent như Analytics hay Reporting thường là job nền, không cần là agent hội thoại.
:::

**Bài trước:** [Bài 7](/ai-agents/course/ke-hoach-da-agent/planning-design) · **Bài tiếp theo:** [Bài 9 — Metacognition](/ai-agents/course/ke-hoach-da-agent/metacognition)
