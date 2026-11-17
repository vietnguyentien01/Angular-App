---
title: "Bài 9 — Metacognition: agent suy nghĩ về chính cách nó suy nghĩ"
summary: "Metacognition giúp agent tự đánh giá, tự sửa và đổi chiến lược: persona, tool, skill; lập kế hoạch 9 bước; Corrective RAG; nạp context trước; LLM re-rank; RAG là prompt hay tool; đánh giá độ liên quan; tìm theo ý định; sinh code và SQL làm tool; ví dụ agent tự đổi chiến lược."
type: lesson
level: advanced
lastReviewed: 2026-11-17
tags: [ai-agents, metacognition, reflection, corrective-rag, code-generation]
related: [ai-agents/course/cong-cu-tri-thuc/agentic-rag, ai-agents/course/ke-hoach-da-agent/planning-design, ai-agents/course/production-giao-thuc/agent-trong-production]
---

:::note Nguồn
Dịch và cô đọng từ [AI Agents for Beginners — 09 Metacognition](https://github.com/microsoft/ai-agents-for-beginners/tree/main/09-metacognition) (Microsoft, MIT License). Bài gốc rất dài (khoảng 7.600 từ, nhiều đoạn code lặp lại); bản dịch giữ mọi khái niệm và các ví dụ tiêu biểu. Ví dụ `HotelRecommendationAgent` **đã chạy thử** bằng Python 3.
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

Agent du lịch:
- thu sở thích;
- truy xuất `search_flights`, `search_hotels`, `search_attractions`;
- tạo gợi ý ban đầu;
- thu phản hồi;
- **chỉnh sở thích và truy xuất lại**;
- đánh giá liên tục.

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
```

**Trade-off:** nhanh nhưng tốn context và có thể cũ. Hợp với dữ liệu nhỏ, ổn định, hỏi thường xuyên. Dữ liệu lớn hoặc hay đổi thì nên truy xuất (Bài 12 nói kỹ về context).

## 4. Bootstrap kế hoạch bằng mục tiêu rồi mới lặp

Bắt đầu với **mục tiêu rõ ràng**, vd "tối đa hoá sự hài lòng của khách trong ngân sách", để mỗi vòng lặp đều tiến gần mục tiêu. Các bước:
1. xác định sở thích và ngân sách;
2. dựng kế hoạch ban đầu (vd chọn điểm đến hợp sở thích, cộng dồn chi phí không vượt ngân sách);
3. lặp để tinh chỉnh, mỗi vòng thay một lựa chọn bằng lựa chọn tốt hơn vẫn nằm trong ngân sách.

## 5. Dùng LLM để re-rank và chấm điểm

- **Retrieval:** lấy tập ứng viên theo truy vấn.
- **Re-ranking:** LLM đánh giá và xếp lại theo độ liên quan và chất lượng.
- **Scoring:** LLM gán điểm cho từng ứng viên để chọn tốt nhất.

Bản gốc có ví dụ gọi Azure OpenAI: gửi prompt chứa sở thích người dùng và danh sách điểm đến, yêu cầu model trả về danh sách đã xếp hạng kèm điểm.

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

Ngoài ra dùng NLP để trích thông tin chính từ truy vấn.

## 8. Tìm kiếm theo ý định (search with intent)

Hiểu **mục đích** đằng sau truy vấn, không chỉ khớp từ khoá. Ba loại ý định:

| Ý định | Ví dụ | Agent nên làm |
|---|---|---|
| **Informational** (tìm thông tin) | "Bảo tàng nào hay nhất ở Paris?" | Trả thông tin, tóm tắt |
| **Navigational** (điều hướng) | "Trang chính thức của Louvre" | Đưa đúng đường dẫn |
| **Transactional** (giao dịch) | "Đặt vé bay đi Paris" | Bắt đầu quy trình đặt, có xác nhận |

Kết hợp với ngữ cảnh (tương tác trước, sở thích), NLP (nhận diện thực thể, cảm xúc, phân tích truy vấn) và cá nhân hoá theo lịch sử.

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

**Nhận biết môi trường và suy luận theo schema:** agent đọc **schema của bảng** để đặt nền cho câu truy vấn. Có phản hồi thì nó suy luận xem trường nào trong schema cần cập nhật (vd "disliked: Eiffel Tower" thì thêm vào `avoid`), rồi sinh và chạy lại truy vấn.

**SQL như RAG:** truy vấn sinh động theo sở thích, dữ liệu trả về dùng để cá nhân hoá gợi ý. Bản gốc minh hoạ:

```sql
SELECT * FROM flights WHERE destination='Paris' AND dates='2025-04-01 to 2025-04-10' AND budget='moderate';
SELECT * FROM hotels WHERE destination='Paris' AND budget='moderate';
```

:::senior Code do agent sinh ra phải chạy trong hộp cát
Bản gốc ghép chuỗi SQL bằng f-string cho dễ hiểu. Ở production:
- dùng **tham số hoá** (`WHERE destination = $1`) hoặc để model sinh *bộ lọc có cấu trúc* rồi code của bạn dựng query;
- kết nối bằng **role chỉ đọc** (Bài 4);
- code khác SQL thì chạy trong **sandbox hoặc container** (Bài 6, Bài 18).

Đây cũng là lý do Claude Code có sandbox và permission cho lệnh Bash.
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

**Bài trước:** [Bài 8](/ai-agents/course/ke-hoach-da-agent/multi-agent) · **Bài tiếp theo:** [Bài 10 — Agent trong production](/ai-agents/course/production-giao-thuc/agent-trong-production)
