---
title: "Bài 17 — Agent chạy local với Microsoft Foundry Local và Qwen"
summary: "Agent không gọi cloud lần nào: riêng tư, không tốn tiền token, chạy offline. SLM mạnh và yếu ở đâu (để SLM điều phối, tool làm việc nặng), Foundry Local với endpoint tương thích OpenAI, Qwen function calling, RAG local với Chroma, MCP local, định tuyến lai local và cloud."
type: lesson
level: advanced
lastReviewed: 2026-11-17
tags: [ai-agents, local, slm, foundry-local, qwen, privacy]
related: [ai-agents/course/nang-cao/deploy-agent-quy-mo-lon, ai-agents/course/cong-cu-tri-thuc/tool-use, ai-agents/course/nen-tang/cai-dat-khoa-hoc]
---

:::note Nguồn
Dịch từ [AI Agents for Beginners — 17 Creating Local AI Agents](https://github.com/microsoft/ai-agents-for-beginners/tree/main/17-creating-local-ai-agents) (Microsoft, MIT License), gồm knowledge check và assignment gốc. Tool `read_file` có sandbox và lời giải `find_todos` **đã chạy thử** bằng Python 3, gồm cả các ca `../`, đường dẫn tuyệt đối và symlink trỏ ra ngoài.
:::

Bài trước đưa agent **lên** cloud. Bài này đưa nó **xuống** một máy duy nhất. Cuối bài, bạn có một trợ lý kỹ thuật biết suy luận, gọi tool, đọc file và tìm tài liệu, **không có một lần gọi suy luận nào lên cloud**.

Vì sao cần vậy? Ba lý do gặp liên tục trong công việc thật:

- **Riêng tư:** code và tài liệu không rời khỏi máy. Không prompt, đoạn code hay dữ liệu khách hàng nào vượt qua ranh giới mạng.
- **Chi phí:** suy luận local không tính tiền theo token. Lặp cả ngày chỉ tốn tiền điện.
- **Offline:** trên máy bay, trong khu vực bảo mật, hay khi mất mạng, agent vẫn chạy.

Cái giá là bạn đổi model cloud hàng đầu lấy một **Small Language Model (SLM)** chạy trên CPU, GPU hoặc NPU. Bài này dạy xây agent **tốt trong giới hạn đó**, chứ không giả vờ giới hạn không tồn tại.

**Mục tiêu:**
- giải thích trade-off của SLM và chọn use case local phù hợp;
- chạy model Qwen bằng Foundry Local và nối qua endpoint tương thích OpenAI;
- xây agent gọi tool chạy hoàn toàn trên máy;
- thêm RAG local trên tài liệu của bạn bằng vector DB local (Chroma);
- nối agent với MCP server local và cân nhắc thiết kế lai.

**Cần:**
- máy dev **tối thiểu thực tế 8 GB RAM**, thoải mái từ 16 GB; GPU hay NPU giúp nhanh hơn nhưng không bắt buộc;
- Foundry Local;
- Python 3.12+ cùng `foundry-local-sdk` (2.x), `openai`, `chromadb`.

## SLM: công cụ đúng cho việc local

Model cloud hàng đầu có hàng trăm tỷ tham số và cả trung tâm dữ liệu phía sau. SLM có vài tỷ tham số và phải vừa RAM laptop.

| SLM giỏi | SLM yếu |
|---|---|
| Task có cấu trúc, phạm vi rõ: phân loại, trích xuất, tóm tắt một tài liệu đã biết | Suy luận mở, nhiều bước trên context lớn |
| **Gọi tool**: quyết định gọi hàm nào, tham số gì | Kiến thức thế giới rộng (thấy ít hơn, quên nhiều hơn) |
| Lặp nhanh, rẻ, riêng tư trên dữ liệu của bạn | |

Chiến lược thắng: **để SLM điều phối, để tool làm việc nặng.** Model không cần *biết* codebase của bạn; nó cần biết lúc nào gọi `read_file`, lúc nào gọi `search_docs`. Đó đúng là sở trường của SLM.

```text
Developer ──► Agent SLM local ──quyết định──► read_file / search_docs (RAG) / analyze_code
                    ▲                                    │
                    └────────── kết quả ─────────────────┘
              ──► Câu trả lời, hoàn toàn trên máy
```

## Microsoft Foundry Local

Runtime nhẹ, **tải, quản lý và phục vụ model ngay trên máy**. Tính năng quan trọng nhất: endpoint HTTP **tương thích OpenAI**. OpenAI SDK và OpenAI client của Agent Framework chạy với nó **chỉ cần đổi `base_url`**. Mọi điều đã học về xây agent đều dùng lại được; chỉ endpoint chuyển từ cloud về `localhost`.

Foundry Local còn **tự chọn bản build tốt nhất cho phần cứng** (CPU, CUDA/GPU hay NPU), nên bạn không phải tối ưu tay cho từng máy.

```bash
winget install Microsoft.FoundryLocal                     # Windows
# brew install microsoft/foundrylocal/foundrylocal        # macOS
foundry model run qwen2.5-7b
foundry service status
```

Endpoint local thường có dạng `http://localhost:PORT/v1`. Notebook dùng `foundry-local-sdk` để tải, nạp model, khởi động endpoint và **đọc URL từ SDK**, nên không phải viết cứng port.

## Vì sao là Qwen function calling?

Agent chỉ là agent khi gọi được tool. Nhiều SLM chat được nhưng sinh tool call **hỏng hoặc thất thường**. Model **Qwen** được huấn luyện cho function calling và sinh cấu trúc tool call đúng định dạng một cách nhất quán. Chính điều đó biến model chat local thành **agent** local.

Luồng vẫn là vòng tool calling quen thuộc, chỉ chạy trên máy:

```text
User: "auth.py làm gì?" ──► Qwen quyết định gọi read_file("auth.py") ──► tool trả nội dung ──► Qwen suy luận ──► giải thích
```

## RAG local

Tìm tài liệu là nơi agent local "kiếm cơm". Thay vì mong SLM thuộc lòng tài liệu framework của bạn, hãy embed tài liệu vào **vector DB local** và để agent lấy chunk liên quan khi cần.

Bài dùng **Chroma**: vector store nhúng, chạy trong process, không có server phải quản lý. Pipeline hoàn toàn local:

```text
Tài liệu/code ──► model embedding local ──► Chroma (trên đĩa)
Câu hỏi của agent ──► embed local ──► Chroma ──top-k chunk──► Qwen ──► câu trả lời có căn cứ
```

Đây vẫn là Agentic RAG của Bài 5, chỉ khác là mọi thành phần chạy trên máy bạn.

## MCP server local

MCP là **giao thức truyền tải**, không phải dịch vụ cloud. MCP server có thể chạy như process local qua `stdio`, cung cấp tool cho agent theo chuẩn. Bạn dùng lại được hệ sinh thái MCP server (truy cập filesystem, thao tác git, truy vấn database) hoàn toàn offline.

Tư thế bảo mật khác cloud nhưng **không biến mất**: MCP server local chạy với quyền của user bạn. Hãy:
- giới hạn thứ nó được chạm vào (một thư mục dự án, không phải cả thư mục home);
- coi output của nó là input cần validate.

## Pattern lai cloud và local

Local-first không có nghĩa local-only. Hệ thống trưởng thành định tuyến theo **độ nhạy cảm và độ khó**:

| Tình huống | Chạy ở đâu |
|---|---|
| Code hoặc dữ liệu nhạy cảm, hoặc đang offline | **SLM local** |
| Task đơn giản, phạm vi rõ | **SLM local** (rẻ, nhanh) |
| Suy luận khó nhiều bước trên dữ liệu không nhạy cảm | **Model cloud** |
| Mọi thứ, khi cloud sập | **SLM local** (xuống cấp nhẹ nhàng) |

Đây chính là **model routing** của Bài 16, chỉ là một trong các "model" giờ là máy của bạn. Thiết kế vững sẽ **fallback về local** khi cloud không khả dụng: agent giảm chất lượng chứ không chết hẳn.

## Lab: trợ lý kỹ thuật chạy local

Notebook `17-local-agent-foundry-local.ipynb` dựng trợ lý:
- gọi tool qua Qwen trên Foundry Local;
- liệt kê và đọc file trong thư mục dự án;
- đo metric cơ bản của file code;
- RAG local trên thư mục docs bằng Chroma;
- nối MCP server local (bỏ qua nhẹ nhàng nếu chưa cấu hình).

Không có suy luận cloud nào.

```python
from foundry_local_sdk import Configuration, FoundryLocalManager
from openai import OpenAI

FoundryLocalManager.initialize(Configuration(app_name="ai_agents_for_beginners"))
manager = FoundryLocalManager.instance
model = manager.catalog.get_model("qwen2.5-7b")
if not model.is_cached:
    model.download()          # chỉ lần đầu
model.load()

manager.start_web_service()
client = OpenAI(base_url=manager.urls[0].rstrip("/") + "/v1", api_key="not-required")
```

Tool là hàm Python thường, **bị giới hạn trong một thư mục dự án**:

```python
def read_file(path: str) -> str:
    """Read a file, but only inside the sandboxed project directory."""
    full = (PROJECT_ROOT / path).resolve()
    if PROJECT_ROOT not in full.parents and full != PROJECT_ROOT:
        return "Access denied: path is outside the project directory."
    return full.read_text(encoding="utf-8")
```

Kể cả chạy local, một tool đọc được đường dẫn tuỳ ý vẫn là rủi ro. Mình chạy thử với `PROJECT_ROOT` đã `resolve()`. Ba ca sau đều trả *Access denied*, vì `resolve()` đi theo symlink tới đích thật:
- `../secret.txt`;
- `/etc/hostname` (vì `PROJECT_ROOT / "/etc/hostname"` thành đường dẫn tuyệt đối);
- một **symlink trong dự án trỏ ra ngoài**.

:::warning Điều kiện để kiểm tra trên đúng
`PROJECT_ROOT` phải là đường dẫn **đã `resolve()`**. Nếu `PROJECT_ROOT` là đường dẫn tương đối hoặc đi qua symlink, phép so `in full.parents` sẽ so hai dạng đường dẫn khác nhau, và có thể chặn nhầm file hợp lệ.
:::

:::senior Agent local cho dev frontend
Use case thực tế:
- review code nội bộ, giải thích file, tìm TODO và tài liệu dự án **mà không gửi code công ty ra ngoài**;
- dùng khi chính sách bảo mật cấm cloud.

Claude Code thì chạy model trên cloud; với code nhạy cảm, hãy xem [quyền riêng tư dữ liệu](/claude-code/deep-dive/getting-started/du-lieu-va-quyen-rieng-tu) để biết dữ liệu đi đâu, rồi quyết định công cụ cho từng loại việc. Đó chính là "hybrid routing" ở cấp quy trình làm việc.
:::

:::quiz (Knowledge check 2) Nên chia việc giữa SLM và tool thế nào trong agent local?
- [ ] SLM tự làm mọi thứ, tool chỉ để dự phòng
- [x] SLM điều phối (chọn tool và tham số), tool làm việc nặng (đọc file, lấy tài liệu, tính toán)
- [ ] Tool quyết định, SLM chỉ định dạng output
- [ ] Không cần tool nếu model đủ lớn

SLM giỏi quyết định có phạm vi như chọn tool, nhưng yếu về kiến thức rộng và suy luận dài. Dựa vào tool là chơi đúng sở trường.
:::

:::quiz (Knowledge check 3 và 4) Điều gì cho phép dùng lại code agent cloud với Foundry Local, và vì sao chọn Qwen? (chọn nhiều)
- [x] Foundry Local mở endpoint HTTP tương thích OpenAI; chỉ cần đổi `base_url` và dùng API key giả local
- [x] Qwen được huấn luyện cho function calling nên sinh tool call đúng định dạng nhất quán
- [ ] Foundry Local tự dịch code Azure sang local
- [ ] Qwen là model duy nhất Foundry Local hỗ trợ

Endpoint tương thích giữ nguyên code; tool call đáng tin cậy biến model chat thành agent.
:::

:::quiz (Knowledge check 6) MCP server chạy trên máy bạn có tự động an toàn không?
- [ ] Có, vì không qua mạng
- [x] Không; nó chạy với quyền của user bạn, nên phải giới hạn phạm vi (một thư mục dự án) và validate output trước khi hành động
- [ ] Có, nếu dùng stdio
- [ ] Không, MCP local không bao giờ dùng được

Local giảm rủi ro lộ dữ liệu ra mạng, nhưng không giảm rủi ro một tool có quá nhiều quyền.
:::

:::exercise (Dựa trên assignment gốc) Tool find_todos có sandbox
Assignment gốc yêu cầu mở rộng trợ lý thành **trình review tài liệu local**:
1. index ≥ 5 file vào Chroma;
2. thêm tool `find_todos`;
3. hỏi 3 câu buộc agent kết hợp tool (một câu RAG thuần, một câu đọc file cụ thể, một câu tìm TODO);
4. đo thời gian từng câu trả lời;
5. viết đoạn ngắn: phần nào chuyển lên cloud, phần nào giữ local, vì sao.

Phần lõi bạn làm ngay được: viết `find_todos(subdir=".", max_results=50)`:
- quét `TODO` và `FIXME` (không phân biệt hoa thường) trong dự án;
- trả `file` (tương đối), `line`, `tag`, `text`;
- **giữ đúng sandbox như `read_file`**: từ chối `subdir` ra ngoài, và bỏ qua symlink trỏ ra ngoài dự án.
???
```python
import re
from pathlib import Path

PROJECT_ROOT = Path("my-project").resolve()      # luôn resolve()

def _inside(path: Path) -> bool:
    return path == PROJECT_ROOT or PROJECT_ROOT in path.parents

TODO_RE = re.compile(r"\b(TODO|FIXME)\b[:\s]*(.*)", re.IGNORECASE)

def find_todos(subdir: str = ".", max_results: int = 50) -> list[dict]:
    base = (PROJECT_ROOT / subdir).resolve()
    if not _inside(base):
        return [{"error": "Access denied"}]
    out = []
    for f in sorted(base.rglob("*")):
        real = f.resolve()
        if not f.is_file() or not _inside(real):
            continue                                  # bỏ symlink trỏ ra ngoài
        for i, line in enumerate(real.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            m = TODO_RE.search(line)
            if m:
                out.append({"file": str(f.relative_to(PROJECT_ROOT)), "line": i,
                            "tag": m.group(1).upper(), "text": m.group(2).strip(" ->")})
                if len(out) >= max_results:
                    return out
    return out
```

Chạy thử trên dự án tạm gồm `src/auth.py` (1 TODO, 1 FIXME), `README.md` (`<!-- todo: ... -->`), và symlink `link_out` trỏ tới file ngoài dự án có chứa TODO:

```text
{'file': 'README.md', 'line': 2, 'tag': 'TODO', 'text': 'viết hướng dẫn'}
{'file': 'src/auth.py', 'line': 2, 'tag': 'TODO', 'text': 'thêm rate limit'}
{'file': 'src/auth.py', 'line': 4, 'tag': 'FIXME', 'text': 'token hết hạn'}
find_todos("..") -> [{'error': 'Access denied'}]
```

Symlink ra ngoài bị bỏ qua, nên TODO trong file bí mật không lộ. `max_results` giữ output nhỏ, để không làm ngập context của SLM (Bài 12).

**Gợi ý cho đoạn hybrid:**
- *Giữ local:* index, tìm kiếm, đọc file, tìm TODO (dữ liệu nhạy cảm, việc có phạm vi rõ).
- *Cân nhắc cloud:* chỉ phần "viết báo cáo review tổng hợp", và chỉ khi đã che thông tin nhạy cảm.
:::

**Bài trước:** [Bài 16](/ai-agents/course/nang-cao/deploy-agent-quy-mo-lon) · **Bài tiếp theo:** [Bài 18 — Bảo mật AI agent](/ai-agents/course/nang-cao/bao-mat-ai-agent)
