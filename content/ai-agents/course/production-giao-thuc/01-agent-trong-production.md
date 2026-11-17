---
title: "Bài 10 — AI Agent trong production: observability, đánh giá và kiểm soát chi phí"
summary: "Biến agent từ hộp đen thành hộp kính: trace và span, vì sao observability bắt buộc ở production, các metric cần theo dõi, instrument bằng OpenTelemetry, đánh giá offline và online, lỗi thường gặp kèm cách xử lý, và ba cách giảm chi phí (model nhỏ, router, cache)."
type: lesson
level: intermediate
lastReviewed: 2026-11-17
tags: [ai-agents, observability, evaluation, opentelemetry, cost]
related: [ai-agents/course/cong-cu-tri-thuc/xay-agent-dang-tin-cay, ai-agents/course/nang-cao/deploy-agent-quy-mo-lon, claude-code/deep-dive/sessions/chi-phi-va-subagent]
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 10 AI Agents in Production](https://github.com/microsoft/ai-agents-for-beginners/tree/main/10-ai-agents-production) (Microsoft, MIT License). Lời giải bài tập **đã chạy thử** bằng Python 3, với giá token giả định.
:::

Khi agent đi từ prototype sang ứng dụng thật, việc hiểu hành vi, giám sát hiệu năng và đánh giá output có hệ thống trở nên quan trọng.

**Mục tiêu:**
- khái niệm cốt lõi của observability và đánh giá agent;
- kỹ thuật cải thiện hiệu năng, chi phí và hiệu quả;
- đánh giá cái gì và đánh giá thế nào;
- kiểm soát chi phí khi lên production;
- instrument agent xây bằng Microsoft Agent Framework.

Đích đến: biến agent "hộp đen" thành hệ thống minh bạch, quản lý được, đáng tin. Agent cũng phải an toàn và đáng tin cậy (xem Bài 6).

## Trace và span

Công cụ observability như Langfuse hay Microsoft Foundry thường biểu diễn một lần chạy agent bằng trace và span:

- **Trace**: một task trọn vẹn của agent từ đầu tới cuối, vd xử lý một câu hỏi của người dùng.
- **Span**: từng bước trong trace, vd gọi model, truy xuất dữ liệu.

Không có observability, agent như **hộp đen**: trạng thái và lập luận bên trong mờ mịt, khó chẩn đoán và tối ưu. Có observability, agent thành **hộp kính**, minh bạch, là nền để xây niềm tin và đảm bảo nó chạy đúng ý.

## Vì sao observability bắt buộc ở production

- **Debug và tìm nguyên nhân gốc:** khi agent lỗi hoặc ra output lạ, trace chỉ ra lỗi nằm ở đâu. Rất quan trọng với agent có nhiều lần gọi LLM, gọi tool và logic điều kiện.
- **Quản lý latency và chi phí:** LLM và API ngoài tính tiền theo token hoặc lượt gọi. Theo dõi chính xác giúp tìm thao tác quá chậm hay quá đắt để tối ưu prompt, chọn model hiệu quả hơn, hoặc thiết kế lại workflow.
- **Niềm tin, an toàn, tuân thủ:** trace là audit trail của hành động và quyết định, giúp phát hiện prompt injection, nội dung độc hại, xử lý sai dữ liệu cá nhân (PII). Vd xem trace để hiểu vì sao agent trả lời như vậy hoặc dùng một tool nào đó.
- **Vòng cải tiến liên tục:** dữ liệu observability là nền của phát triển lặp: thấy chỗ cần cải thiện, gom dữ liệu để fine-tune, kiểm chứng tác động của thay đổi. Insight từ đánh giá online quay lại phục vụ thử nghiệm offline.

## Metric cần theo dõi

| Metric | Ý nghĩa | Ví dụ hành động |
|---|---|---|
| **Latency** | Agent phản hồi nhanh cỡ nào, đo cho cả task lẫn từng bước. | Agent mất 20 giây cho các lần gọi model → dùng model nhanh hơn hoặc gọi song song. |
| **Chi phí** | Tiền cho mỗi lần chạy (token, API). | Gọi LLM 5 lần chỉ để tăng chất lượng chút ít → có đáng không, giảm số lần gọi hay dùng model rẻ hơn? Theo dõi thời gian thực để bắt chi phí tăng vọt (vd bug lặp API). |
| **Lỗi request** | Số request thất bại: lỗi API, tool call hỏng. | Fallback hoặc retry, vd provider A sập thì chuyển sang provider B. |
| **Phản hồi trực tiếp** | 👍/👎, 1–5 sao, bình luận. | Phản hồi tiêu cực lặp lại là dấu hiệu agent chạy sai. |
| **Phản hồi ngầm** | Hành vi: hỏi lại ngay bằng câu khác, lặp câu hỏi, bấm retry. | Người dùng hỏi đi hỏi lại một câu → agent chưa làm đúng. |
| **Độ chính xác** | Tần suất ra output đúng hoặc mong muốn; trước hết phải **định nghĩa thành công** là gì. | Gắn nhãn trace "succeeded" hoặc "failed". |
| **Đánh giá tự động** | LLM chấm output (hữu ích? chính xác?), hoặc thư viện mã nguồn mở. | RAGAS cho RAG agent; LLM Guard phát hiện ngôn từ độc hại hay prompt injection. |

Kết hợp nhiều metric mới phủ được "sức khoẻ" của agent. Notebook [`10-expense_claim-demo.ipynb`](https://github.com/microsoft/ai-agents-for-beginners/blob/main/10-ai-agents-production/code_samples/10-expense_claim-demo.ipynb) minh hoạ các metric này trên ví dụ thật.

## Instrument agent

Để có dữ liệu trace, cần **instrument** code: làm code phát ra trace và metric để nền tảng observability thu, xử lý và hiển thị.

**OpenTelemetry (OTel)** là chuẩn công nghiệp cho observability của LLM, gồm API, SDK và công cụ để sinh, thu và xuất telemetry. Nhiều thư viện bọc sẵn framework agent để xuất span OTel. **Microsoft Agent Framework tích hợp OpenTelemetry sẵn**:

```python
from agent_framework.observability import get_tracer, get_meter

tracer = get_tracer()
meter = get_meter()

with tracer.start_as_current_span("agent_run"):
    # việc chạy agent được trace tự động
    pass
```

**Tạo span thủ công.** Instrumentation tự động là nền tốt, nhưng thường bạn cần thêm logic riêng. Quan trọng hơn, bạn có thể **gắn thuộc tính** (tag, metadata) vào span: dữ liệu nghiệp vụ, kết quả trung gian, hay ngữ cảnh như `user_id`, `session_id`, `model_version`. Ví dụ với Langfuse Python SDK:

```python
from langfuse import get_client

langfuse = get_client()
span = langfuse.start_span(name="my-span")
span.end()
```

## Đánh giá agent

Observability cho ta metric. **Đánh giá** là phân tích dữ liệu đó (và chạy test) để biết agent làm tốt tới đâu và cải thiện thế nào. Cần đánh giá thường xuyên vì agent **không tất định** và có thể thay đổi (cập nhật, model trôi hành vi). Không đánh giá thì bạn không biết agent "thông minh" có thật sự làm tốt hay đã thoái lui.

### Đánh giá offline

Đánh giá trong môi trường kiểm soát, bằng **bộ dữ liệu test có đáp án**, không dùng truy vấn thật. Vd agent giải toán đố có bộ 100 bài biết đáp án (như GSM8K). Thường làm khi phát triển và **đặt trong CI/CD** để bắt regression.

- **Ưu:** lặp lại được, có metric chính xác rõ ràng nhờ ground truth.
- **Thách thức:** bộ test phải đủ rộng và luôn cập nhật. Agent có thể giỏi trên bộ test cố định nhưng gặp truy vấn rất khác ở production. Nên kết hợp bộ **smoke test** nhỏ để kiểm nhanh và bộ lớn để đo tổng quát.

### Đánh giá online

Đánh giá trong môi trường thật, khi người dùng đang dùng. Theo dõi tỷ lệ thành công, điểm hài lòng và các metric khác trên traffic thật.

- **Ưu:** bắt được điều không lường trước trong lab: **model drift** (hiệu quả giảm khi pattern input đổi), truy vấn bất ngờ không có trong dữ liệu test.
- **Cách làm:** thu phản hồi trực tiếp và ngầm, chạy **shadow test** hoặc **A/B test** (bản mới chạy song song để so).
- **Thách thức:** khó có nhãn hoặc điểm đáng tin cho tương tác thật; phải dựa vào phản hồi hay metric hạ nguồn (người dùng có bấm kết quả không).

### Kết hợp hai cách

Hai cách bổ trợ nhau. Nhiều team chạy vòng:

```text
đánh giá offline → deploy → giám sát online → gom ca lỗi mới → thêm vào bộ offline → tinh chỉnh agent → lặp lại
```

## Lỗi thường gặp

| Vấn đề | Cách xử lý |
|---|---|
| Agent làm task không nhất quán | Tinh chỉnh prompt, nói rõ mục tiêu. Xem có nên chia task con cho nhiều agent không. |
| Agent lặp vô hạn | Đặt **điều kiện dừng** rõ ràng để agent biết khi nào kết thúc. Task cần suy luận và lập kế hoạch phức tạp thì dùng model lớn chuyên reasoning. |
| Tool call chạy kém | Test và kiểm output của tool **bên ngoài hệ agent**. Tinh chỉnh tham số, prompt, tên tool. |
| Hệ multi-agent không ổn định | Prompt cho từng agent cụ thể và khác biệt rõ với nhau. Dựng hệ phân cấp với agent "routing" hoặc controller để chọn đúng agent. |

Có observability thì những vấn đề này dễ khoanh vùng hơn nhiều: trace chỉ đúng chỗ trong workflow phát sinh lỗi.

## Quản lý chi phí

- **Dùng model nhỏ (SLM):** Small Language Model làm tốt nhiều use case agentic và giảm chi phí đáng kể. Cách tốt nhất để biết là **dựng hệ đánh giá** so với model lớn. Dùng SLM cho việc đơn giản như phân loại ý định, trích tham số; để model lớn cho suy luận phức tạp.
- **Dùng router model:** dùng nhiều model, nhiều cỡ. Một LLM/SLM hoặc serverless function định tuyến request theo độ phức tạp: câu đơn giản cho model nhỏ, nhanh; chỉ dùng model lớn đắt tiền cho suy luận phức tạp.
- **Cache câu trả lời:** nhận diện request và task phổ biến, trả lời trước khi chúng đi vào hệ agent. Có thể dùng model cơ bản để đo độ giống của request mới với request đã cache. Giảm mạnh chi phí cho câu hỏi thường gặp và workflow phổ biến.

:::senior Liên hệ Claude Code
Trong Claude Code:
- `/cost` và `/usage` là metric chi phí;
- chọn model và effort chính là "router" thủ công;
- prompt caching là cache ở tầng model;
- OpenTelemetry cũng là cách Claude Code xuất metric cho team (xem [bài theo dõi team](/claude-code/deep-dive/getting-started/artifacts-projects-va-theo-doi-team)).

Câu hỏi phỏng vấn hay gặp: *"Làm sao biết agent của bạn chạy tốt ở production?"* Trả lời theo khung **trace → metric → offline eval trong CI → online eval → vòng phản hồi**.
:::

:::quiz Trace và span khác nhau thế nào?
- [ ] Trace là log lỗi, span là log thông thường
- [x] Trace là cả một task của agent từ đầu tới cuối; span là từng bước bên trong (gọi model, gọi tool, truy xuất)
- [ ] Span chứa nhiều trace
- [ ] Hai từ đồng nghĩa

Một trace chứa nhiều span lồng nhau. Gắn thuộc tính như `user_id`, `session_id` vào span để lọc và phân tích.
:::

:::quiz Người dùng liên tục hỏi lại cùng một câu bằng cách diễn đạt khác. Đây là loại tín hiệu gì?
- [ ] Lỗi request
- [ ] Phản hồi trực tiếp
- [x] Phản hồi ngầm (implicit feedback), dấu hiệu agent chưa đáp ứng đúng
- [ ] Latency cao

Không ai bấm 👎, nhưng hành vi hỏi lại, lặp truy vấn, bấm retry đều là tín hiệu agent đang trả lời sai hoặc chưa đủ.
:::

:::quiz Điểm mạnh riêng của đánh giá online so với offline là gì?
- [ ] Có ground truth nên đo chính xác tuyệt đối
- [x] Bắt được model drift và truy vấn bất ngờ không có trong bộ test
- [ ] Chạy được trong CI trước khi deploy
- [ ] Không cần người dùng thật

Offline: lặp lại được, có đáp án, hợp CI. Online: phản ánh thực tế. Ca lỗi tìm thấy online nên được thêm vào bộ test offline.
:::

:::exercise Tính metric từ danh sách span
Cho danh sách span (mỗi span có `trace`, `kind` là `llm` hoặc `tool`, `model`, `tokens`, `ms`, `error`) và bảng giá giả định `{"gpt-5-mini": 0.002, "gpt-5": 0.01}` USD / 1K token. Viết `summarize(spans)` trả về:
1. mỗi trace: tổng latency (giả sử các bước chạy tuần tự), chi phí, có lỗi không, và **nghi lặp vô hạn** nếu hơn 10 tool call;
2. p95 latency và tỷ lệ trace lỗi.

Dữ liệu test:
- t1: 2 lần gọi `gpt-5-mini` (1.200 và 800 token) + 1 tool;
- t2: `gpt-5` 3.000 token + 1 tool lỗi;
- t3: một lần gọi model nhỏ;
- t4: 12 lần gọi tool `search`.
???
```python
from collections import defaultdict
from statistics import quantiles

PRICE_PER_1K = {"gpt-5-mini": 0.002, "gpt-5": 0.01}

def summarize(spans, max_tool_calls=10):
    by_trace = defaultdict(list)
    for s in spans:
        by_trace[s["trace"]].append(s)
    report = {}
    for t, ss in by_trace.items():
        cost = sum(s.get("tokens", 0) / 1000 * PRICE_PER_1K.get(s.get("model"), 0) for s in ss)
        tool_calls = sum(1 for s in ss if s["kind"] == "tool")
        report[t] = {
            "latency_ms": sum(s["ms"] for s in ss),
            "cost_usd": round(cost, 4),
            "failed": any(s["error"] for s in ss),
            "loop_suspect": tool_calls > max_tool_calls,
        }
    lat = sorted(r["latency_ms"] for r in report.values())
    p95 = quantiles(lat, n=20, method="inclusive")[-1]
    error_rate = sum(r["failed"] for r in report.values()) / len(report)
    return report, p95, error_rate
```

Kết quả khi chạy với dữ liệu test:

```text
t1 {'latency_ms': 1900, 'cost_usd': 0.004, 'failed': False, 'loop_suspect': False}
t2 {'latency_ms': 5500, 'cost_usd': 0.03, 'failed': True, 'loop_suspect': False}
t3 {'latency_ms': 400, 'cost_usd': 0.001, 'failed': False, 'loop_suspect': False}
t4 {'latency_ms': 2400, 'cost_usd': 0.0, 'failed': False, 'loop_suspect': True}
p95_ms 5035.0 error_rate 0.25
```

Đọc kết quả:
- t2 đắt gấp 7,5 lần t1 và lỗi ở tool `book`, nên ưu tiên xem trace này;
- t4 không tốn token nhưng gọi `search` 12 lần, nghi lặp, nên cần điều kiện dừng.

Trong thực tế, platform như Langfuse hay Foundry tính sẵn các số này từ span OTel. Giá token ở đây là số giả định cho bài tập.
:::

**Bài trước:** [Bài 9](/ai-agents/course/ke-hoach-da-agent/metacognition) · **Bài tiếp theo:** [Bài 11 — Giao thức agentic](/ai-agents/course/production-giao-thuc/giao-thuc-mcp-a2a-nlweb)
