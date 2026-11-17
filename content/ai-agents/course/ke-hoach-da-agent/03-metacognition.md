---
title: "Bài 9 — Metacognition: agent suy nghĩ về chính cách nó suy nghĩ"
summary: "Metacognition giúp agent tự đánh giá, tự sửa và đổi chiến lược: persona, tool, skill; lập kế hoạch 9 bước; Corrective RAG; nạp context trước; LLM re-rank; RAG là prompt hay tool; đánh giá độ liên quan; tìm theo ý định; sinh code và SQL làm tool; ví dụ agent tự đổi chiến lược."
type: lesson
level: advanced
lastReviewed: 2026-11-17
tags: [ai-agents, metacognition, reflection, corrective-rag, code-generation]
related: [ai-agents/course/cong-cu-tri-thuc/agentic-rag, ai-agents/course/ke-hoach-da-agent/planning-design, ai-agents/course/production-giao-thuc/agent-trong-production]
changelog:
  - date: 2026-11-17
    note: Viết đầy đủ bài 9 theo bản gốc; thêm phần đọc notebook từng bước và tài liệu tham khảo.
---

:::note Nguồn
Dịch đầy đủ từ [AI Agents for Beginners — 09 Metacognition](https://github.com/microsoft/ai-agents-for-beginners/tree/main/09-metacognition) (Microsoft, MIT License), kèm phần đọc notebook ở cuối bài.

Các đoạn code gốc chạy được không cần Azure đều **đã chạy thử** bằng Python 3: `bootstrap_plan`/`iterate_plan`, `identify_intent`, `generate_sql_query`, `HotelRecommendationAgent`. Kết quả chạy thử có vài chỗ lệch với lời giải thích của bản gốc; mình ghi ngay tại chỗ.

Các hàm như `search_flights`, `create_itinerary`, `search_web` chỉ là **giả định để minh hoạ**: bản gốc không định nghĩa chúng.
:::

:::note Từ viết tắt trong bài
- **RAG** (Retrieval-Augmented Generation): sinh câu trả lời có bổ sung dữ liệu truy xuất.
- **NLP** (Natural Language Processing): xử lý ngôn ngữ tự nhiên.
- **LLM** (Large Language Model): mô hình ngôn ngữ lớn.
:::

**Mục tiêu:**
1. Hiểu ý nghĩa của vòng lặp suy luận (reasoning loop) trong định nghĩa agent.
2. Dùng kỹ thuật lập kế hoạch và đánh giá để agent tự sửa lỗi.
3. Tự tạo agent biết sinh và chạy code để hoàn thành task.

## Metacognition là gì?

**Metacognition** là "suy nghĩ về chính suy nghĩ của mình", một quá trình nhận thức bậc cao gồm *tự nhận biết* và *tự điều chỉnh* quá trình nhận thức. Với AI agent, đó là khả năng:
- đánh giá và điều chỉnh hành động dựa trên sự tự nhận biết và kinh nghiệm cũ;
- theo dõi, điều tiết và thích nghi hành vi, giống cách ta "đọc tình hình" khi giải một bài toán.

Trong hệ agentic, metacognition giúp giải quyết:
- **Minh bạch:** agent giải thích được lập luận và quyết định;
- **Suy luận:** tổng hợp thông tin và ra quyết định vững hơn;
- **Thích nghi:** điều chỉnh theo môi trường mới và điều kiện thay đổi;
- **Nhận thức:** nhận diện và diễn giải dữ liệu môi trường chính xác hơn.

Metacognition thật sự là khi agent **suy luận về chính lập luận của nó**, vd:
- *"Mình ưu tiên vé rẻ vì… nhưng có thể đang bỏ lỡ chuyến bay thẳng, để kiểm tra lại."*
- Ghi nhận lý do đã chọn một tuyến đường.
- Nhận ra mình sai vì quá dựa vào sở thích lần trước của người dùng, nên **sửa chiến lược ra quyết định**, không chỉ sửa gợi ý cuối.
- Chẩn đoán pattern: *"Cứ khi người dùng nói 'đông quá', mình không chỉ bỏ vài điểm tham quan mà còn phải nhận ra cách chọn 'điểm nổi bật' của mình có vấn đề, nếu mình luôn xếp hạng theo độ phổ biến."*

**Vì sao quan trọng:**
- **Tự soi xét:** agent tự đánh giá hiệu quả và chỗ cần cải thiện.
- **Thích nghi:** đổi chiến lược theo kinh nghiệm và môi trường.
- **Sửa lỗi:** tự phát hiện và sửa sai.
- **Quản lý tài nguyên:** dùng thời gian và tài nguyên tính toán hợp lý nhờ lập kế hoạch và đánh giá.

## Thành phần của một agent

- **Persona:** tính cách và đặc điểm, quyết định cách agent tương tác với người dùng.
- **Tools:** năng lực và hàm agent thực hiện được.
- **Skills:** kiến thức và chuyên môn agent có.

Ba thứ này tạo thành một "đơn vị chuyên môn" làm được task cụ thể.

## Ví dụ: agent du lịch có metacognition

**Task:** giúp người dùng lên kế hoạch đi Paris.

**Các bước:**
1. hỏi sở thích (ngày, ngân sách, mối quan tâm như bảo tàng, ẩm thực, mua sắm);
2. truy xuất chuyến bay, chỗ ở, điểm tham quan, nhà hàng phù hợp;
3. đưa lịch trình cá nhân hoá;
4. hỏi phản hồi và điều chỉnh.

**Tài nguyên:** database đặt vé và khách sạn, thông tin điểm tham quan và nhà hàng ở Paris, dữ liệu phản hồi từ các lần trước.

**Kinh nghiệm và tự soi xét:**
- *Phân tích phản hồi:* gợi ý nào được thích, gợi ý nào không, rồi chỉnh cho lần sau.
- *Thích nghi:* người dùng từng nói ghét chỗ đông thì sau này tránh điểm nổi tiếng vào giờ cao điểm.
- *Sửa lỗi:* từng gợi ý khách sạn đã kín phòng thì học cách kiểm tra phòng trống kỹ hơn trước khi gợi ý.

```python
class Travel_Agent:
    def __init__(self):
        self.user_preferences = {}
        self.experience_data = []

    def gather_preferences(self, preferences):
        self.user_preferences = preferences

    def retrieve_information(self):
        flights = search_flights(self.user_preferences)
        hotels = search_hotels(self.user_preferences)
        attractions = search_attractions(self.user_preferences)
        return flights, hotels, attractions

    def generate_recommendations(self):
        flights, hotels, attractions = self.retrieve_information()
        return create_itinerary(flights, hotels, attractions)

    def adjust_based_on_feedback(self, feedback):
        self.experience_data.append(feedback)        # nhớ kinh nghiệm
        self.user_preferences = adjust_preferences(self.user_preferences, feedback)

travel_agent = Travel_Agent()
travel_agent.gather_preferences({"destination": "Paris", "dates": "2025-04-01 to 2025-04-10",
                                 "budget": "moderate", "interests": ["museums", "cuisine"]})
itinerary = travel_agent.generate_recommendations()
travel_agent.adjust_based_on_feedback({"liked": ["Louvre Museum"], "disliked": ["Eiffel Tower (too crowded)"]})
```

## 1. Lập kế hoạch trong agent

Bốn yếu tố: **task hiện tại**, **các bước**, **tài nguyên cần**, **kinh nghiệm**. Chín bước của agent du lịch:

| # | Bước | Ví dụ |
|---|---|---|
| 1 | Thu thập sở thích | "Bạn định đi khi nào? Ngân sách bao nhiêu? Thích hoạt động gì?" |
| 2 | Truy xuất thông tin | Chuyến bay trong ngân sách, khách sạn đúng vị trí và tiện nghi, điểm tham quan và quán ăn hợp sở thích. |
| 3 | Tạo gợi ý | Gom thành lịch trình cá nhân hoá. |
| 4 | Trình bày lịch trình | "Đây là lịch trình gợi ý cho chuyến Paris… Bạn thấy sao?" |
| 5 | Thu phản hồi | "Chuyến bay ổn không? Khách sạn hợp không? Muốn thêm hoặc bớt hoạt động nào?" |
| 6 | Điều chỉnh | Sửa vé, chỗ ở, hoạt động theo phản hồi. |
| 7 | Xác nhận cuối | "Mình đã chỉnh theo góp ý, mọi thứ ổn chứ?" |
| 8 | Đặt và xác nhận | Người dùng duyệt xong mới đặt; gửi thông tin xác nhận. |
| 9 | Hỗ trợ tiếp | "Cần gì trong chuyến đi cứ nhắn mình nhé!" |

## 2. Corrective RAG

**RAG** kết hợp hệ truy xuất với model sinh: khi có truy vấn, hệ truy xuất lấy tài liệu liên quan từ nguồn ngoài, rồi dùng chúng để bổ sung cho input của model, giúp câu trả lời chính xác và đúng ngữ cảnh hơn.

**Corrective RAG** dùng kỹ thuật RAG để **sửa lỗi và tăng độ chính xác**:
1. **Prompting technique:** prompt cụ thể để dẫn việc truy xuất.
2. **Tool:** thuật toán đánh giá độ liên quan của dữ liệu lấy về.
3. **Evaluation:** liên tục đánh giá hiệu quả và điều chỉnh.

Ví dụ agent tìm kiếm web:
- tạo câu truy vấn từ input người dùng;
- dùng NLP và ML để xếp hạng, lọc kết quả;
- phân tích phản hồi để sửa thông tin sai.

### Các bước Corrective RAG trong agent du lịch

1. **Tương tác ban đầu:** thu sở thích.

```python
preferences = {
    "destination": "Paris",
    "dates": "2025-04-01 to 2025-04-10",
    "budget": "moderate",
    "interests": ["museums", "cuisine"]
}
```

2. **Truy xuất thông tin:** chuyến bay, chỗ ở, điểm tham quan, nhà hàng.

```python
flights = search_flights(preferences)
hotels = search_hotels(preferences)
attractions = search_attractions(preferences)
```

3. **Tạo gợi ý ban đầu:** `itinerary = create_itinerary(flights, hotels, attractions)`.
4. **Thu phản hồi:** `feedback = {"liked": ["Louvre Museum"], "disliked": ["Eiffel Tower (too crowded)"]}`.
5. **Quy trình Corrective RAG**, gồm ba phần:
   - **Kỹ thuật prompt:** tạo truy vấn tìm kiếm mới dựa trên phản hồi.

```python
if "disliked" in feedback:
    preferences["avoid"] = feedback["disliked"]
```

   - **Tool:** xếp hạng và lọc kết quả mới, nhấn mạnh độ liên quan theo phản hồi.

```python
new_attractions = search_attractions(preferences)
new_itinerary = create_itinerary(flights, hotels, new_attractions)
```

   - **Đánh giá:** liên tục đánh giá độ liên quan và chính xác, điều chỉnh khi cần.

```python
def adjust_preferences(preferences, feedback):
    if "liked" in feedback:
        preferences["favorites"] = feedback["liked"]
    if "disliked" in feedback:
        preferences["avoid"] = feedback["disliked"]
    return preferences

preferences = adjust_preferences(preferences, feedback)
```

**Ví dụ tổng hợp:** khác class `Travel_Agent` ở đầu bài một điểm: sau khi chỉnh sở thích, nó **truy xuất và tạo lại lịch trình ngay**.

```python
class Travel_Agent:
    # gather_preferences, retrieve_information, generate_recommendations như trên
    def adjust_based_on_feedback(self, feedback):
        self.experience_data.append(feedback)
        self.user_preferences = adjust_preferences(self.user_preferences, feedback)
        new_itinerary = self.generate_recommendations()   # truy xuất lại với sở thích mới
        return new_itinerary

new_itinerary = travel_agent.adjust_based_on_feedback(
    {"liked": ["Louvre Museum"], "disliked": ["Eiffel Tower (too crowded)"]})
print("Updated Itinerary:", new_itinerary)
```

## 3. Nạp context trước (Pre-emptive Context Load)

Nạp sẵn context hay thông tin nền vào model **trước khi** xử lý truy vấn. Model có thông tin ngay từ đầu, trả lời nhanh mà không phải truy xuất giữa chừng.

```python
class TravelAgent:
    def __init__(self):
        self.context = {   # nạp sẵn điểm đến phổ biến
            "Paris": {"country": "France", "currency": "Euro", "language": "French", "attractions": ["Eiffel Tower", "Louvre Museum"]},
            "Tokyo": {"country": "Japan", "currency": "Yen", "language": "Japanese", "attractions": ["Tokyo Tower", "Shibuya Crossing"]},
        }

    def get_destination_info(self, destination):
        info = self.context.get(destination)
        if info:
            return f"{destination}: {info['country']}, {info['currency']}, {info['language']}, {', '.join(info['attractions'])}"
        return f"Sorry, we don't have information on {destination}."

travel_agent = TravelAgent()
print(travel_agent.get_destination_info("Paris"))
print(travel_agent.get_destination_info("Tokyo"))
```

Giải thích:
1. **Khởi tạo (`__init__`):** class nạp sẵn một dict thông tin các điểm đến phổ biến (Paris, Tokyo, bản gốc có thêm New York, Sydney): quốc gia, tiền tệ, ngôn ngữ, điểm tham quan chính.
2. **Lấy thông tin (`get_destination_info`):** khi người dùng hỏi một điểm đến, hàm lấy thông tin từ dict đã nạp sẵn.

Nhờ nạp trước, ứng dụng trả lời nhanh, không phải gọi nguồn ngoài lúc chạy.

**Trade-off:** nhanh nhưng tốn context và có thể cũ. Hợp với dữ liệu nhỏ, ổn định, hỏi thường xuyên. Dữ liệu lớn hoặc hay đổi thì nên truy xuất (Bài 12 nói kỹ về context).

## 4. Bootstrap kế hoạch bằng mục tiêu rồi mới lặp

Bắt đầu với **mục tiêu rõ ràng**, vd "tối đa hoá sự hài lòng của khách trong ngân sách", để mỗi vòng lặp đều tiến gần mục tiêu. Các bước:
1. xác định sở thích và ngân sách;
2. dựng kế hoạch ban đầu (vd chọn điểm đến hợp sở thích, cộng dồn chi phí không vượt ngân sách);
3. lặp để tinh chỉnh, mỗi vòng thay một lựa chọn bằng lựa chọn tốt hơn vẫn nằm trong ngân sách.

```python
class TravelAgent:
    def __init__(self, destinations):
        self.destinations = destinations

    def bootstrap_plan(self, preferences, budget):
        plan, total_cost = [], 0
        for destination in self.destinations:
            if total_cost + destination['cost'] <= budget and self.match_preferences(destination, preferences):
                plan.append(destination)
                total_cost += destination['cost']
        return plan

    def match_preferences(self, destination, preferences):
        for key, value in preferences.items():
            if destination.get(key) != value:
                return False
        return True

    def iterate_plan(self, plan, preferences, budget):
        for i in range(len(plan)):
            for destination in self.destinations:
                if destination not in plan and self.match_preferences(destination, preferences) \
                        and self.calculate_cost(plan, destination) <= budget:
                    plan[i] = destination
                    break
        return plan

    def calculate_cost(self, plan, new_destination):
        return sum(d['cost'] for d in plan) + new_destination['cost']

destinations = [
    {"name": "Paris", "cost": 1000, "activity": "sightseeing"},
    {"name": "Tokyo", "cost": 1200, "activity": "shopping"},
    {"name": "New York", "cost": 900, "activity": "sightseeing"},
    {"name": "Sydney", "cost": 1100, "activity": "beach"},
]
travel_agent = TravelAgent(destinations)
initial_plan = travel_agent.bootstrap_plan({"activity": "sightseeing"}, 2000)
refined_plan = travel_agent.iterate_plan(initial_plan, {"activity": "sightseeing"}, 2000)
```

Giải thích theo bản gốc:
- `bootstrap_plan` duyệt danh sách và thêm điểm đến khớp sở thích, còn nằm trong ngân sách;
- `match_preferences` kiểm tra khớp;
- `iterate_plan` thử thay từng điểm bằng lựa chọn tốt hơn;
- `calculate_cost` tính tổng chi phí khi thêm một điểm mới.

Mình chạy thử:

```text
Initial: ['Paris', 'New York'] 1900
Refined: ['Paris', 'New York']        ← không đổi gì
```

:::warning `iterate_plan` thực tế không bao giờ thay được gì
`calculate_cost(plan, destination)` cộng chi phí điểm mới vào **toàn bộ** kế hoạch, mà **không trừ** điểm định thay. Nên mọi lần thay đều bị coi là vượt ngân sách. Thêm hai điểm cần lưu ý:
- hàm sửa `plan` tại chỗ (`initial_plan is refined_plan` là `True`);
- không có tiêu chí "tốt hơn": nó chỉ lấy điểm đầu tiên hợp lệ.

Bài tập cuối bài yêu cầu sửa lỗi này.
:::

## 5. Dùng LLM để re-rank và chấm điểm

- **Retrieval:** lấy tập ứng viên theo truy vấn.
- **Re-ranking:** LLM đánh giá và xếp lại theo độ liên quan và chất lượng.
- **Scoring:** LLM gán điểm cho từng ứng viên để chọn tốt nhất.

**Kịch bản:** gợi ý điểm đến tốt nhất theo sở thích khách; LLM xếp lại và chấm điểm. Các bước:
1. thu sở thích;
2. lấy danh sách điểm đến tiềm năng;
3. nhờ LLM re-rank và chấm điểm.

Cần Azure subscription và tài nguyên Azure OpenAI.

```python
import requests

class TravelAgent:
    def __init__(self, destinations):
        self.destinations = destinations

    def get_recommendations(self, preferences, api_key, endpoint):
        prompt = self.generate_prompt(preferences)
        headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}
        payload = {"prompt": prompt, "max_tokens": 150, "temperature": 0.7}
        response = requests.post(endpoint, headers=headers, json=payload)
        response_data = response.json()
        return response_data['choices'][0]['text'].strip().split('\n')

    def generate_prompt(self, preferences):
        prompt = "Here are the travel destinations ranked and scored based on the following user preferences:\n"
        for key, value in preferences.items():
            prompt += f"{key}: {value}\n"
        prompt += "\nDestinations:\n"
        for destination in self.destinations:
            prompt += f"- {destination['name']}: {destination['description']}\n"
        return prompt

destinations = [
    {"name": "Paris", "description": "City of lights, known for its art, fashion, and culture."},
    {"name": "Tokyo", "description": "Vibrant city, famous for its modernity and traditional temples."},
    {"name": "New York", "description": "The city that never sleeps, with iconic landmarks and diverse culture."},
    {"name": "Sydney", "description": "Beautiful harbour city, known for its opera house and stunning beaches."},
]
preferences = {"activity": "sightseeing", "culture": "diverse"}
endpoint = 'https://your-endpoint.com/openai/deployments/your-deployment-name/completions?api-version=2022-12-01'
recommendations = TravelAgent(destinations).get_recommendations(preferences, 'your_azure_openai_api_key', endpoint)
```

Giải thích:
1. **Khởi tạo:** danh sách điểm đến có tên và mô tả.
2. **`get_recommendations`:** dựng prompt từ sở thích, gửi HTTP POST tới Azure OpenAI, nhận danh sách đã xếp hạng và chấm điểm.
3. **`generate_prompt`:** ghép sở thích và danh sách điểm đến thành prompt hướng model xếp hạng.
4. **Gọi API:** dùng thư viện `requests`.

Thay `your_azure_openai_api_key` và endpoint bằng giá trị thật.

:::warning Code này dùng API cũ
Endpoint `/completions` với `api-version=2022-12-01` và trường `choices[0].text` thuộc **Completions API cũ**, không khớp Responses API mà các bài khác dùng. Thêm hai vấn đề:
- API key đặt thẳng trong code, trái với hướng "keyless" ở Bài 0;
- output tách dòng tự do, không có điểm số có cấu trúc.

Khi làm thật, dùng `client.responses.create(...)` và yêu cầu output JSON theo schema (Bài 7), vd `[{"name": ..., "score": 0-10, "reason": ...}]`.
:::

## 6. RAG: kỹ thuật prompt hay tool?

| Khía cạnh | RAG như prompting technique | RAG như tool |
|---|---|---|
| Thủ công / tự động | Tự soạn prompt cho từng truy vấn | Quy trình truy xuất và sinh tự động |
| Kiểm soát | Kiểm soát nhiều hơn việc truy xuất | Gọn, tự động hoá |
| Linh hoạt | Prompt tuỳ biến theo nhu cầu | Hiệu quả cho quy mô lớn |
| Độ phức tạp | Phải viết và chỉnh prompt | Dễ tích hợp vào kiến trúc agent |

Ví dụ: "I want to visit museums in Paris."
- Kiểu **prompt**: bạn tự viết `"Find top museums in Paris"`, gọi `search_web`, rồi ghép kết quả.
- Kiểu **tool**: `self.rag_tool.retrieve_and_generate(user_input)` tự lo trọn.

## 7. Đánh giá độ liên quan (relevancy)

Bốn khái niệm:
- **Hiểu ngữ cảnh:** "nhà hàng ngon nhất Paris" phải xét loại món, ngân sách.
- **Chính xác:** đúng và mới, vd không gợi ý quán đã đóng cửa.
- **Ý định người dùng:** "khách sạn giá rẻ" thì ưu tiên giá phải chăng.
- **Vòng phản hồi:** dùng đánh giá của người dùng để cải thiện.

Kỹ thuật:

```python
def relevance_score(item, query):
    score = 0
    if item['category'] in query['interests']:
        score += 1
    if item['price'] <= query['budget']:
        score += 1
    if item['location'] == query['destination']:
        score += 1
    return score

def filter_and_rank(items, query):
    return sorted(items, key=lambda item: relevance_score(item, query), reverse=True)[:10]

def adjust_based_on_feedback(feedback, items):
    for item in items:
        if item['name'] in feedback['liked']:
            item['relevance'] += 1
        if item['name'] in feedback['disliked']:
            item['relevance'] -= 1
    return items
```

Ngoài ra dùng NLP để trích thông tin chính từ truy vấn: `processed_query = nlp(query)`.

**Ví dụ trong agent du lịch:** gộp các hàm trên vào class, xếp hạng khách sạn trước khi ghép lịch trình.

```python
class Travel_Agent:
    # gather_preferences, retrieve_information như trên
    def generate_recommendations(self):
        flights, hotels, attractions = self.retrieve_information()
        ranked_hotels = self.filter_and_rank(hotels, self.user_preferences)
        return create_itinerary(flights, ranked_hotels, attractions)

    def filter_and_rank(self, items, query):
        return sorted(items, key=lambda item: self.relevance_score(item, query), reverse=True)[:10]

    def relevance_score(self, item, query):
        score = 0
        if item['category'] in query['interests']:
            score += 1
        if item['price'] <= query['budget']:
            score += 1
        if item['location'] == query['destination']:
            score += 1
        return score
```

:::warning Kiểu dữ liệu không khớp
Trong ví dụ gốc, `preferences["budget"]` là chuỗi `"moderate"`. Phép so `item['price'] <= query['budget']` (số so với chuỗi) sẽ ném `TypeError` trong Python 3. Ngân sách cần là số (vd `200`), hoặc đổi `"moderate"` thành khoảng giá trước khi chấm điểm.
:::

## 8. Tìm kiếm theo ý định (search with intent)

Hiểu **mục đích** đằng sau truy vấn, không chỉ khớp từ khoá. Ba loại ý định:

| Ý định | Ví dụ | Agent nên làm |
|---|---|---|
| **Informational** (tìm thông tin) | "Bảo tàng nào hay nhất ở Paris?" | Trả thông tin, tóm tắt |
| **Navigational** (điều hướng) | "Trang chính thức của Louvre" | Đưa đúng đường dẫn |
| **Transactional** (giao dịch) | "Đặt vé bay đi Paris" | Bắt đầu quy trình đặt, có xác nhận |

Kết hợp với ngữ cảnh (tương tác trước, sở thích), NLP (nhận diện thực thể, cảm xúc, phân tích truy vấn) và cá nhân hoá theo lịch sử.

**Ví dụ trong agent du lịch:**

```python
def identify_intent(query):
    if "book" in query or "purchase" in query:
        return "transactional"
    elif "website" in query or "official" in query:
        return "navigational"
    else:
        return "informational"

def analyze_context(query, user_history):
    return {"current_query": query, "user_history": user_history}

def search_with_intent(query, preferences, user_history):
    intent = identify_intent(query)
    context = analyze_context(query, user_history)
    if intent == "informational":
        search_results = search_information(query, preferences)
    elif intent == "navigational":
        search_results = search_navigation(query)
    elif intent == "transactional":
        search_results = search_transaction(query, preferences)
    return personalize_results(search_results, user_history)

def search_information(query, preferences):
    return search_web(f"best {preferences['interests']} in {preferences['destination']}")

def search_navigation(query):
    return search_web(query)

def search_transaction(query, preferences):
    return search_web(f"book {query} to {preferences['destination']}")

def personalize_results(results, user_history):
    personalized = [result for result in results if result not in user_history]
    return personalized[:10]

preferences = {"destination": "Paris", "interests": ["museums", "cuisine"]}
user_history = ["Louvre Museum website", "Book flight to Paris"]
results = search_with_intent("best museums in Paris", preferences, user_history)
```

Mình chạy thử riêng `identify_intent`:

```text
'best museums in Paris'        -> informational
'Book a flight to Paris'       -> informational   ← chữ "Book" viết hoa nên không khớp "book"
'book a flight to Paris'       -> transactional
'Louvre official website'      -> navigational
'Facebook page of the Louvre'  -> transactional   ← "Facebook" chứa chuỗi "book"
```

Quy tắc theo từ khoá như vậy chỉ để minh hoạ. Làm thật thì dùng `query.lower()` và so **nguyên từ**, hoặc tốt hơn: để LLM phân loại ý định thành enum có cấu trúc (Bài 7). Phần cá nhân hoá loại bỏ kết quả đã có trong lịch sử, giữ 10 kết quả đầu.

## 9. Sinh code làm tool

**Agent sinh code** dùng model để viết rồi chạy code, giải bài toán và tự động hoá task:
- sinh đoạn code cho phân tích dữ liệu, web scraping, ML;
- dùng **SQL như một dạng RAG**;
- tạo và chạy code để giải bài toán cụ thể.

Ví dụ agent phân tích dữ liệu:
- **task:** tìm xu hướng trong dataset;
- **các bước:** nạp dataset, sinh SQL lọc và gom nhóm, chạy, rồi vẽ biểu đồ và rút insight;
- **tài nguyên:** dataset, công cụ phân tích, SQL;
- **kinh nghiệm:** dùng kết quả cũ để phân tích lần sau chính xác hơn.

Agent du lịch sinh code:
1. thu sở thích;
2. sinh code lấy dữ liệu bay, khách sạn, điểm tham quan;
3. chạy code;
4. ghép lịch trình;
5. nhận phản hồi và **sinh lại code** nếu cần.

**Từng bước (theo bản gốc):**

```python
def generate_code_to_fetch_data(preferences):
    code = f"""
def search_flights():
    import requests
    response = requests.get('https://api.example.com/flights', params={preferences})
    return response.json()
"""
    return code

def generate_code_to_fetch_hotels(preferences):
    code = f"""
def search_hotels():
    import requests
    response = requests.get('https://api.example.com/hotels', params={preferences})
    return response.json()
"""
    return code

def execute_code(code):
    exec(code)            # chạy code được sinh ra
    result = locals()
    return result

flights = execute_code(generate_code_to_fetch_data(preferences))
hotels = execute_code(generate_code_to_fetch_hotels(preferences))

def generate_itinerary(flights, hotels, attractions):
    return {"flights": flights, "hotels": hotels, "attractions": attractions}

def adjust_based_on_feedback(feedback, preferences):
    if "liked" in feedback:
        preferences["favorites"] = feedback["liked"]
    if "disliked" in feedback:
        preferences["avoid"] = feedback["disliked"]
    return preferences
# Sau phản hồi: sinh lại và chạy lại code với sở thích mới, rồi ghép lịch trình mới.
```

:::danger `exec()` code do model sinh ra là rủi ro bảo mật lớn nhất của bài
- `exec(code)` chạy **bất kỳ** code nào trong chính process của bạn, với toàn quyền.
- Code trong ví dụ chỉ *định nghĩa* hàm chứ không gọi nó. Vì vậy `locals()` trả về các biến cục bộ (gồm chuỗi code và hàm vừa định nghĩa), **không phải** dữ liệu chuyến bay.

Ở production:
- chạy code sinh ra trong **sandbox hoặc container** có giới hạn mạng, thời gian, bộ nhớ (vd Code Interpreter của Foundry ở Bài 4);
- hoặc tốt hơn: cho model sinh **tham số có cấu trúc** để code của bạn gọi API, thay vì sinh code.
:::

**Nhận biết môi trường và suy luận theo schema:** agent đọc **schema của bảng** để đặt nền cho câu truy vấn. Có phản hồi thì nó suy luận xem trường nào trong schema cần cập nhật (vd "disliked: Eiffel Tower" thì thêm vào `avoid`), rồi sinh và chạy lại truy vấn.

```python
schema = {
    "favorites": {"positive_adjustment": "increase", "negative_adjustment": "decrease", "default": "neutral"},
    "avoid": {"positive_adjustment": "decrease", "negative_adjustment": "increase", "default": "neutral"},
}

def adjust_based_on_feedback(feedback, preferences, schema):
    if "liked" in feedback:
        preferences["favorites"] = feedback["liked"]
    if "disliked" in feedback:
        preferences["avoid"] = feedback["disliked"]
    for field in schema:                    # suy luận theo schema để chỉnh các trường liên quan
        if field in preferences:
            preferences[field] = adjust_based_on_environment(feedback, field, schema)
    return preferences

def adjust_based_on_environment(feedback, field, schema):
    if field in feedback["liked"]:
        return schema[field]["positive_adjustment"]
    elif field in feedback["disliked"]:
        return schema[field]["negative_adjustment"]
    return schema[field]["default"]
```

Giải thích theo bản gốc:
- `schema` định nghĩa cách chỉnh từng trường sở thích theo phản hồi;
- `adjust_based_on_feedback` chỉnh sở thích theo phản hồi và schema;
- `adjust_based_on_environment` tuỳ biến mức chỉnh;
- sau đó hệ thống sinh và chạy lại truy vấn, ghép lịch trình mới.

(Để ý: vòng `for field in schema` ghi đè luôn `favorites` và `avoid` vừa gán bằng `"neutral"`, vì tên trường không nằm trong danh sách liked/disliked. Ví dụ này minh hoạ *ý tưởng* hơn là code dùng được.)

### SQL như một kỹ thuật RAG

SQL là công cụ mạnh để tương tác với database. Dùng trong RAG, SQL lấy dữ liệu liên quan để agent tạo câu trả lời hay hành động. Khái niệm chính:
- **Tương tác database:** truy vấn chuyến bay, khách sạn, điểm tham quan.
- **Tích hợp với RAG:** câu SQL sinh ra theo input và sở thích; dữ liệu trả về dùng để cá nhân hoá.
- **Sinh truy vấn động:** tuỳ biến theo ngân sách, ngày, sở thích.

**Ví dụ trong agent du lịch:**

```python
def generate_sql_query(table, preferences):
    query = f"SELECT * FROM {table} WHERE "
    conditions = []
    for key, value in preferences.items():
        conditions.append(f"{key}='{value}'")
    query += " AND ".join(conditions)
    return query

import sqlite3

def execute_sql_query(query, database="travel.db"):
    connection = sqlite3.connect(database)
    cursor = connection.cursor()
    cursor.execute(query)
    results = cursor.fetchall()
    connection.close()
    return results

def generate_recommendations(preferences):
    flights = execute_sql_query(generate_sql_query("flights", preferences))
    hotels = execute_sql_query(generate_sql_query("hotels", preferences))
    attractions = execute_sql_query(generate_sql_query("attractions", preferences))
    return {"flights": flights, "hotels": hotels, "attractions": attractions}
```

Câu SQL ví dụ của bản gốc:

```sql
SELECT * FROM flights WHERE destination='Paris' AND dates='2025-04-01 to 2025-04-10' AND budget='moderate';
SELECT * FROM hotels WHERE destination='Paris' AND budget='moderate';
SELECT * FROM attractions WHERE destination='Paris' AND interests='museums, cuisine';
```

Mình chạy thử `generate_sql_query` trên SQLite trong bộ nhớ:

```text
{"destination": "Paris", "budget": "moderate"}
  → SELECT * FROM hotels WHERE destination='Paris' AND budget='moderate'
{"interests": ["museums", "cuisine"]}
  → SELECT * FROM attractions WHERE interests='['museums', 'cuisine']'      ← list biến thành chuỗi lỗi cú pháp
{"destination": "x' OR '1'='1"}
  → SELECT * FROM hotels WHERE destination='x' OR '1'='1'                 ← SQL injection: trả về TẤT CẢ khách sạn
```

:::senior Code do agent sinh ra phải chạy trong hộp cát
Bản gốc ghép chuỗi SQL bằng f-string cho dễ hiểu. Ở production:
- dùng **tham số hoá** (`WHERE destination = $1`) hoặc để model sinh *bộ lọc có cấu trúc* rồi code của bạn dựng query;
- kết nối bằng **role chỉ đọc** (Bài 4);
- code khác SQL thì chạy trong **sandbox hoặc container** (Bài 6, Bài 18).

Đây cũng là lý do Claude Code có sandbox và permission cho lệnh Bash.

Phiên bản an toàn: **danh sách trắng** bảng và cột, giá trị luôn đi qua tham số `?`. Mình đã chạy thử: chuỗi tiêm `x' OR '1'='1` trả về `[]`, và `Paris` trả về đúng hai khách sạn.

```python
ALLOWED = {"hotels": {"destination", "budget"}}

def safe_query(table, prefs):
    cols = ALLOWED.get(table)
    if cols is None:
        raise ValueError("bảng không được phép")
    keys = [k for k in prefs if k in cols]                 # bỏ trường lạ
    where = " WHERE " + " AND ".join(f"{k} = ?" for k in keys) if keys else ""
    return f"SELECT name FROM {table}{where}", [prefs[k] for k in keys]

sql, params = safe_query("hotels", {"destination": "Paris"})
con.execute(sql, params).fetchall()     # [('A',), ('C',)]
```
:::

## 10. Ví dụ metacognition: agent đổi chiến lược chọn khách sạn

Agent chọn khách sạn theo một chiến lược, **tự xét lại** quyết định dựa trên phản hồi, rồi đổi chiến lược. Rút gọn từ bản gốc:

```python
class HotelRecommendationAgent:
    def __init__(self):
        self.previous_choices = []
        self.corrected_choices = []

    def recommend_hotel(self, hotels, strategy):
        if strategy == 'cheapest':
            recommended = min(hotels, key=lambda x: x['price'])
        elif strategy == 'highest_quality':
            recommended = max(hotels, key=lambda x: x['quality'])
        else:
            recommended = None
        self.previous_choices.append((strategy, recommended))
        return recommended

    def reflect_on_choice(self):
        if not self.previous_choices:
            return "No choices made yet."
        last_strategy, last_choice = self.previous_choices[-1]
        if self.get_user_feedback(last_choice) == "bad":
            new_strategy = 'highest_quality' if last_strategy == 'cheapest' else 'cheapest'
            self.corrected_choices.append((new_strategy, last_choice))
            return f"Reflecting on choice. Adjusting strategy to {new_strategy}."
        return "The choice was good. No need to adjust."

    def get_user_feedback(self, hotel):
        # giả lập: quá rẻ hoặc chất lượng < 7 là "bad"
        return "bad" if hotel['price'] < 100 or hotel['quality'] < 7 else "good"

hotels = [
    {'name': 'Budget Inn', 'price': 80, 'quality': 6},
    {'name': 'Comfort Suites', 'price': 120, 'quality': 8},
    {'name': 'Luxury Stay', 'price': 200, 'quality': 9},
]
agent = HotelRecommendationAgent()
print(agent.recommend_hotel(hotels, 'cheapest')['name'])
print(agent.reflect_on_choice())
print(agent.recommend_hotel(hotels, 'highest_quality')['name'])
```

Output khi chạy thử:

```text
Budget Inn
Reflecting on choice. Adjusting strategy to highest_quality.
Luxury Stay
```

Điểm mấu chốt: agent **đánh giá lựa chọn và cách ra quyết định trước đó**, rồi **điều chỉnh chiến lược** dựa trên sự phản tư. Đó là metacognition ở dạng đơn giản.

:::warning Một chỗ "ăn gian" trong ví dụ gốc
Bước 3 gọi `recommend_hotel(hotels, 'highest_quality')` với chiến lược **viết cứng**. Agent không thực sự dùng chiến lược mới mà `reflect_on_choice` vừa chọn, và cũng không lưu chiến lược hiện tại. Bài tập dưới sửa điều này.
:::

:::quiz Hành vi nào thể hiện metacognition rõ nhất?
- [ ] Agent gọi tool tìm chuyến bay rồi trả danh sách
- [ ] Agent bỏ tháp Eiffel khỏi lịch trình vì người dùng chê đông
- [x] Agent nhận ra cách nó chọn "điểm nổi bật" theo độ phổ biến là sai với người ghét chỗ đông, và đổi luôn cách xếp hạng
- [ ] Agent lưu lịch sử hội thoại

Bỏ một điểm là sửa *kết quả*. Metacognition là sửa *cách ra quyết định*, tức suy luận về chính lập luận của mình.
:::

:::quiz Truy vấn "Book a flight to Paris" thuộc loại ý định nào, và agent nên phản ứng ra sao?
- [ ] Informational; tóm tắt thông tin về Paris
- [ ] Navigational; đưa link trang hãng bay
- [x] Transactional; bắt đầu quy trình đặt vé, kèm bước xác nhận
- [ ] Không xác định; hỏi lại

Người dùng muốn thực hiện giao dịch. Vì là hành động có hệ quả, nên kèm bước xác nhận (human-in-the-loop, Bài 6).
:::

:::quiz Khi nào nên dùng pre-emptive context load thay vì truy xuất lúc chạy?
- [x] Dữ liệu nhỏ, ít thay đổi và được hỏi thường xuyên, như thông tin cơ bản của vài điểm đến phổ biến
- [ ] Dữ liệu tồn kho phòng khách sạn thay đổi từng phút
- [ ] Toàn bộ tài liệu nội bộ 10.000 trang
- [ ] Không bao giờ, luôn truy xuất là tốt nhất

Nạp trước giúp trả lời nhanh nhưng tốn context và dễ cũ. Dữ liệu lớn hoặc hay đổi nên truy xuất khi cần.
:::

:::exercise Sửa agent để nó thực sự dùng chiến lược sau khi phản tư
Viết lại agent sao cho:
1. agent **giữ chiến lược hiện tại** trong state;
2. `reflect(hotel, feedback)` ghi lịch sử, và khi `bad` thì chọn chiến lược kế tiếp **chưa từng bị đánh giá tệ** theo thứ tự `cheapest → best_value → highest_quality` (`best_value` = quality/price lớn nhất);
3. `recommend()` không gợi ý lại khách sạn đã bị chê.

Chạy 3 vòng với danh sách khách sạn trên và phản hồi giả lập giống bản gốc.
???
```python
class ReflectiveHotelAgent:
    STRATEGIES = {
        "cheapest": lambda hs: min(hs, key=lambda h: h["price"]),
        "highest_quality": lambda hs: max(hs, key=lambda h: h["quality"]),
        "best_value": lambda hs: max(hs, key=lambda h: h["quality"] / h["price"]),
    }

    def __init__(self, strategy="cheapest"):
        self.strategy = strategy
        self.history = []          # (strategy, hotel, feedback)

    def recommend(self, hotels):
        rejected = {h["name"] for _, h, f in self.history if f == "bad"}
        candidates = [h for h in hotels if h["name"] not in rejected]
        return self.STRATEGIES[self.strategy](candidates or hotels)

    def reflect(self, hotel, feedback):
        self.history.append((self.strategy, hotel, feedback))
        if feedback != "bad":
            return f"'{self.strategy}' ổn, giữ nguyên"
        bad = {s for s, _, f in self.history if f == "bad"}
        nxt = next((s for s in ["cheapest", "best_value", "highest_quality"] if s not in bad), self.strategy)
        msg = f"'{self.strategy}' cho kết quả tệ → đổi sang '{nxt}'"
        self.strategy = nxt
        return msg

def feedback(h):
    return "bad" if h["price"] < 100 or h["quality"] < 7 else "good"

agent = ReflectiveHotelAgent()
for _ in range(3):
    h = agent.recommend(hotels)
    print(h["name"], "|", agent.reflect(h, feedback(h)))
```

Output khi chạy thử:

```text
Budget Inn | 'cheapest' cho kết quả tệ → đổi sang 'best_value'
Comfort Suites | 'best_value' ổn, giữ nguyên
Comfort Suites | 'best_value' ổn, giữ nguyên
```

Agent giờ tự chuyển sang `best_value` và giữ nó vì kết quả tốt, không cần ai viết cứng chiến lược. Với agent LLM thật, "chiến lược" có thể là một đoạn trong system prompt được agent tự đề xuất sửa (và bạn duyệt).
:::

:::exercise Sửa `iterate_plan` để nó thực sự cải thiện kế hoạch
Viết lại `iterate_plan(plan, destinations, preferences, budget, score)` sao cho:
1. khi xét thay điểm thứ `i`, chi phí = tổng kế hoạch **trừ điểm đang bị thay** + điểm mới;
2. chỉ thay khi `score(mới) > score(cũ)`, và lặp tới khi không cải thiện được nữa;
3. không sửa danh sách đầu vào.

Thêm "Rome" (950, sightseeing, rating 4.7); các điểm khác có rating: Paris 4.6, New York 4.3, Tokyo 4.8, Sydney 4.5. Chạy từ kế hoạch Paris + New York, ngân sách 2000, `score` là rating.
???
```python
def iterate_plan(plan, destinations, preferences, budget, score):
    plan = list(plan)
    improved = True
    while improved:
        improved = False
        for i, current in enumerate(plan):
            others_cost = sum(d["cost"] for d in plan) - current["cost"]   # trừ điểm sắp thay
            for cand in destinations:
                if cand in plan or any(cand.get(k) != v for k, v in preferences.items()):
                    continue
                if others_cost + cand["cost"] <= budget and score(cand) > score(current):
                    plan[i] = cand
                    improved = True
                    break
    return plan
```

Kết quả chạy thử:

```text
['Paris', 'New York'] -> ['Rome', 'Paris'] 1950
```

Rome (4.7) thay Paris, rồi Paris (4.6) thay New York (4.3); tổng 1950 vẫn trong ngân sách. Đây là phần "lặp có mục tiêu" mà bản gốc mô tả nhưng code chưa làm được: mục tiêu (`score`) và ràng buộc (`budget`) được kiểm ở **mỗi** bước thay.
:::

## Đọc notebook từng bước: `09-python-agent-framework.ipynb`

Notebook minh hoạ hai mẫu metacognition **chạy bằng agent thật**: tự phục hồi lỗi bằng tool dự phòng, và tự đánh giá câu trả lời.

**Cell 2–4: cài đặt và tạo client.**
- Cài `agent-framework azure-ai-projects azure-identity python-dotenv`.
- Đọc `AZURE_AI_PROJECT_ENDPOINT` và `AZURE_AI_MODEL_DEPLOYMENT_NAME`; thiếu biến nào thì báo lỗi kèm tên biến.
- Tạo `FoundryChatClient(project_endpoint=..., model=..., credential=DefaultAzureCredential())`.

**Cell 5 (lý thuyết):** agent metacognitive có thể:
- **tự phản tư** về output và quá trình suy luận;
- **phát hiện lỗi** và phục hồi thay vì im lặng thất bại;
- **đánh giá** câu trả lời đã đủ và hữu ích chưa;
- **thích nghi** chiến lược khi cách đầu không được (vd chuyển sang hệ thống dự phòng).

**Cell 6–7: tool chính và tool dự phòng (fallback).**

```python
@tool(approval_mode="never_require")
def get_flight_times(destination: Annotated[str, "The destination city"]) -> str:
    """Get available flight times for a destination (primary source)."""
    flights = {"Paris": "Departures: 08:00, 12:30, 17:45 — from $350",
               "Tokyo": "Departures: 11:00, 23:30 — from $890",
               "Barcelona": "Departures: 07:15, 14:00, 19:30 — from $280"}
    if destination in flights:
        return flights[destination]
    raise Exception(f"404: No flights found for {destination} in primary system")

@tool(approval_mode="never_require")
def get_flight_times_backup(destination: Annotated[str, "The destination city"]) -> str:
    """Get available flight times from backup system (used when primary fails)."""
    backup_flights = {"Berlin": "Departures: 09:00, 16:00 — from $220",
                      "Sydney": "Departures: 22:00 — from $1200",
                      "New York City": "Departures: 06:00, 10:30, 15:00, 20:00 — from $450"}
    return backup_flights.get(destination, f"No flights found for {destination} in any system. Please try again later.")
```

Hệ chính phủ Paris, Tokyo, Barcelona; hệ dự phòng phủ Berlin, Sydney, New York City. Hệ chính **ném exception kiểu 404** khi không có dữ liệu, giống dịch vụ thật bị lỗi.

**Cell 8–9: agent tự phản tư và phục hồi lỗi.** Instructions yêu cầu:
1. thử hệ chính trước;
2. nếu lỗi 404 thì **thừa nhận lỗi** và thử hệ dự phòng;
3. luôn **giải thích minh bạch** chuyện gì đã xảy ra;
4. cả hai đều hỏng thì xin lỗi và gợi ý phương án khác;
5. sau mỗi câu trả lời, **tự đánh giá ngắn** xem đã đủ và hữu ích chưa.

Test 1 hỏi Paris (hệ chính có). Test 2 hỏi Berlin: hệ chính lỗi, agent phải chuyển sang hệ dự phòng và nói rõ điều đó.

**Cell 10–11: agent đánh giá riêng (self-evaluation).** `ResponseEvaluator` chấm câu trả lời theo ba tiêu chí, mỗi tiêu chí 1–5:
- **Completeness:** trả lời đủ mọi phần câu hỏi chưa;
- **Accuracy:** thông tin có đúng không;
- **Helpfulness:** người đi du lịch thấy hữu ích không.

Kèm một gợi ý cải thiện.

```python
eval_prompt = f"""Question: What flights are available to Paris?
Agent Response: {response}

Please evaluate the above response."""
evaluation = await evaluation_agent.run(eval_prompt)
```

:::warning Lỗi nhỏ trong notebook
Lúc chạy cell 11, biến `response` đang giữ câu trả lời của **Test 2 (Berlin)**, vì cell 9 gán lại `response` hai lần. Prompt đánh giá lại ghi câu hỏi về **Paris**, nên evaluator chấm một cặp hỏi–đáp không khớp. Hãy lưu riêng `response_paris` và `response_berlin`.

Ngoài ra evaluator được cấp cả hai tool tra chuyến bay. Điều đó cho phép nó **tự kiểm chứng** độ chính xác, đúng tinh thần maker-checker, nhưng cũng tốn thêm lượt gọi.
:::

**Cell 12 (tổng kết):** tự phản tư, phục hồi lỗi bằng fallback, và tự đánh giá bằng một agent riêng. Ba mẫu này làm agent bền vững, minh bạch và đáng tin hơn.

## Tài liệu tham khảo (theo bản gốc)

- Microsoft Agent Framework: <https://learn.microsoft.com/en-us/agent-framework/overview/>
- Notebook của bài: <https://github.com/microsoft/ai-agents-for-beginners/tree/main/09-metacognition/code_samples>

**Bài trước:** [Bài 8](/ai-agents/course/ke-hoach-da-agent/multi-agent) · **Bài tiếp theo:** [Bài 10 — Agent trong production](/ai-agents/course/production-giao-thuc/agent-trong-production)
