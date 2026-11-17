---
title: "Bài 0 — Cài đặt khóa học: clone repo, Python, Microsoft Foundry và az login"
summary: "Chuẩn bị môi trường để chạy code mẫu của khóa học: shallow/sparse clone, Python 3.12+ và venv, project Microsoft Foundry có model đã deploy, đăng nhập keyless bằng az login, file .env, các provider thay thế (Foundry Local, MiniMax, Novita) và lỗi SSL trên macOS."
type: lesson
level: core
lastReviewed: 2026-11-17
tags: [ai-agents, setup, microsoft-foundry, python, azure]
related: [ai-agents/course/nen-tang/gioi-thieu-ai-agent]
---

:::note Nguồn
Dịch và biên soạn từ [AI Agents for Beginners — 00 Course Setup](https://github.com/microsoft/ai-agents-for-beginners/tree/main/00-course-setup) của Microsoft (MIT License). Code mẫu cần tài khoản Azure và project Microsoft Foundry; Learning Hub **chưa chạy thử** code trong khóa này. Mỗi bài liên kết về notebook gốc để bạn tự chạy.
:::

## Tóm tắt nhanh

- Code của khóa học là **Jupyter Notebook** Python (`*-python-agent-framework.ipynb`), một số bài có thêm bản .NET.
- Code dùng **Microsoft Agent Framework (MAF)** với `FoundryChatClient`. Client này nối tới **Microsoft Foundry Agent Service V2** (Responses API) qua **Microsoft Foundry**.
- Cần chuẩn bị: Python 3.12+, Azure CLI, một Azure subscription, và một project Foundry đã deploy model (vd `gpt-5-mini`).
- Xác thực **không dùng key**: chạy `az login`, rồi notebook dùng `AzureCliCredential` hoặc `DefaultAzureCredential`. File `.env` chỉ chứa endpoint và tên model.

## 1. Clone hoặc fork repo

Fork repo để có bản riêng mà chạy, thử và sửa code. Repo đầy đủ khá nặng (khoảng 3 GB nếu tải toàn bộ lịch sử), nên khi đi workshop hoặc chỉ cần vài bài, hãy dùng **shallow clone**.

```bash
# Chỉ lấy commit mới nhất (tải ít)
git clone --depth 1 https://github.com/<ten-ban>/ai-agents-for-beginners.git

# Một nhánh cụ thể
git clone --depth 1 --branch <ten-nhanh> https://github.com/<ten-ban>/ai-agents-for-beginners.git
```

**Sparse clone** chỉ tải những thư mục bạn chọn (cần Git 2.25+):

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/<ten-ban>/ai-agents-for-beginners.git
cd ai-agents-for-beginners
git sparse-checkout set 00-course-setup 01-intro-to-ai-agents
```

Có thể xoá `.git` để lấy lại dung lượng nếu chỉ cần file. Việc này **không hoàn tác được**: bạn mất mọi chức năng Git (`rm -rf .git`).

**GitHub Codespaces** giúp bạn khỏi tải nặng về máy. Tạo Codespace, rồi trong terminal của Codespace chạy lệnh shallow hoặc sparse ở trên để chỉ kéo các bài cần học.

:::tip Mẹo
- Muốn sửa và commit thì clone **fork của bạn**, đừng clone repo gốc.
- Cần thêm lịch sử hay thư mục thì `git fetch` hoặc sửa danh sách `sparse-checkout`.
:::

## 2. Yêu cầu

- **Python 3.12+**. Tạo venv bằng đúng phiên bản này để `requirements.txt` cài đúng gói:

```bash
python -m venv venv
source venv/bin/activate        # zsh/bash
# venv\Scripts\activate         # Command Prompt trên Windows
```

- **.NET 10+** nếu chạy mẫu .NET. Kiểm tra bằng `dotnet --list-sdks`.
- **Azure CLI** để xác thực.
- **Azure Subscription** để dùng Microsoft Foundry và Foundry Agent Service.
- **Project Microsoft Foundry** có model đã deploy.

Cài các gói Python từ thư mục gốc của repo, nên làm trong venv:

```bash
pip install -r requirements.txt
```

Trong VS Code, chọn đúng interpreter Python của venv.

## 3. Thiết lập Microsoft Foundry

**Bước 1: Tạo project.** Bạn tạo project trực tiếp, không cần hub.
1. Vào `ai.azure.com` và đăng nhập.
2. Chọn **Create project**.
3. Trong project, deploy một model (vd `gpt-5-mini`) tại **Models + Endpoints → Deploy model**.

**Bước 2: Lấy hai giá trị.**
- **Project Endpoint**: ở trang **Overview**.
- **Model Deployment Name**: ở **Models + Endpoints**.

**Bước 3: Đăng nhập.**

```bash
az login
# Trong Codespace hoặc máy không có trình duyệt:
az login --use-device-code
az account show      # kiểm tra đã đăng nhập đúng subscription
```

:::senior Vì sao dùng `az login` thay vì API key?
Notebook xác thực bằng `AzureCliCredential` hoặc `DefaultAzureCredential` (gói `azure-identity`). Thông tin đăng nhập đến từ phiên Azure CLI, nên **không có key hay secret nào nằm trong `.env`**. Đây là best practice *keyless connection* của Microsoft. Cùng tư duy với việc không commit secret trong dự án frontend/backend của bạn.
:::

**Bước 4: Tạo `.env`.**

```bash
cp .env.example .env
```

```bash title=".env"
AZURE_AI_PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
AZURE_AI_MODEL_DEPLOYMENT_NAME=gpt-5-mini
```

| Biến | Lấy ở đâu |
|---|---|
| `AZURE_AI_PROJECT_ENDPOINT` | Foundry portal → project → **Overview** |
| `AZURE_AI_MODEL_DEPLOYMENT_NAME` | Foundry portal → **Models + Endpoints** → tên model đã deploy |

Với đa số bài, chừng đó là đủ.

**Bước 5:** `pip install -r requirements.txt`.

## 4. Thiết lập tuỳ chọn theo bài

| Bài | Cần thêm | Ghi chú |
|---|---|---|
| 5 (Agentic RAG), 16 | Azure AI Search *(tuỳ chọn)* | Mặc định chạy với **knowledge base trong bộ nhớ**, không cần tài nguyên Azure thêm. Notebook bài 16 chỉ chuyển sang Azure AI Search khi đặt **cả hai** biến `AZURE_SEARCH_SERVICE_ENDPOINT` và `AZURE_SEARCH_API_KEY` (xác thực bằng admin key). |
| 6, 8 | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_KEY` (tuỳ chọn) | Gọi thẳng Azure OpenAI qua **Responses API**: endpoint `/openai/v1/` ổn định, không cần `api-version`. GitHub Models trước đây đã ngừng hỗ trợ. |
| 8 (workflow có điều kiện) | `BING_CONNECTION_ID` | Connection Bing grounding trong Foundry: **Management → Connected resources**. |

Với code production của riêng bạn, Microsoft khuyên dùng **RBAC qua Entra ID** cho Azure AI Search thay vì admin key, vì admin key có toàn quyền ghi và dễ lộ qua `.env`:

```bash
az search service update --name <search> --resource-group <rg> --auth-options aadOrApiKey
az role assignment create --assignee <ban> --role "Search Service Contributor" --scope <search-id>
az role assignment create --assignee <ban> --role "Search Index Data Contributor" --scope <search-id>
```

## 5. Provider thay thế (tương thích OpenAI)

`OpenAIChatClient` của Agent Framework làm việc với **mọi endpoint tương thích OpenAI**, nên bạn có thể thay Azure OpenAI bằng:

| Provider | Biến môi trường | Ghi chú |
|---|---|---|
| **MiniMax** | `MINIMAX_API_KEY`, `MINIMAX_BASE_URL` (`https://api.minimax.io/v1`), `MINIMAX_MODEL_ID` | Context lớn, tới 204K token. Mẫu dùng `OpenAIChatClient` (vd workflow đặt khách sạn ở bài 14) tự nhận khi có `MINIMAX_API_KEY`. |
| **Novita AI** | `NOVITA_API_KEY`, `NOVITA_BASE_URL` (`https://api.novita.ai/openai/v1`), `NOVITA_MODEL_ID` | Host nhiều model open-source. Mẫu **không** tự đọc biến `NOVITA_*`: bạn tự truyền vào `OpenAIChatClient`. |
| **Foundry Local** | (không cần key) | Chạy model **ngay trên máy**, không cần cloud. |

Tên và khả dụng của model thay đổi theo thời gian; kiểm tra trang của từng provider.

Foundry Local:

```bash
winget install Microsoft.FoundryLocal     # Windows
brew install foundrylocal                 # macOS
foundry model list
foundry model run phi-4-mini
```

```python
from agent_framework.openai import OpenAIChatClient

chat_client = OpenAIChatClient(
    base_url=f"{endpoint}/v1",    # endpoint local do Foundry Local SDK trả về
    api_key="not-required",       # Foundry Local không kiểm tra key
    model=model.id,
)
agent = chat_client.as_agent(
    name="LocalAgent",
    instructions="You are a helpful assistant running fully on-device.",
)
```

Foundry Local chỉ mở endpoint **Chat Completions**. Cần đủ tính năng Responses API (hội thoại có trạng thái…) thì dùng Azure OpenAI hoặc project Foundry. Bài 17 đi sâu vào agent chạy local.

## 6. Lỗi thường gặp: SSL trên macOS

```text
ssl.SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate in certificate chain
```

Thử lần lượt:

1. Chạy script cài chứng chỉ của Python (cách khuyên dùng): `/Applications/Python\ 3.XX/Install\ Certificates.command`.
2. Dùng `truststore`: `pip install truststore`, rồi đặt ở đầu notebook:

```python
import truststore
truststore.inject_into_ssl()
```

3. Tắt kiểm tra chứng chỉ (`connection_verify=False`). Bản gốc có ghi cách này cho notebook bài 6.

:::danger Đừng tắt kiểm tra SSL ở production
`connection_verify=False` bỏ qua xác thực chứng chỉ. Chỉ dùng tạm khi dev, và ưu tiên hai cách đầu.
:::

:::quiz Notebook của khóa học xác thực với Microsoft Foundry bằng cách nào theo mặc định?
- [ ] Đặt `AZURE_API_KEY` trong `.env`
- [x] Dùng phiên `az login` qua `AzureCliCredential` hoặc `DefaultAzureCredential`
- [ ] Token GitHub Models
- [ ] Không cần xác thực

Khóa học theo hướng *keyless*: `.env` chỉ chứa endpoint và tên model, còn credential lấy từ phiên Azure CLI.
:::

:::quiz Bạn chạy notebook bài 16 và chỉ đặt `AZURE_SEARCH_SERVICE_ENDPOINT`. Điều gì xảy ra?
- [ ] Notebook báo lỗi thiếu key
- [ ] Notebook dùng Entra ID để gọi Azure AI Search
- [x] Notebook vẫn dùng knowledge base trong bộ nhớ
- [ ] Notebook tự tạo index mới

Notebook bài 16 chỉ chuyển sang Azure AI Search khi có **cả** endpoint **và** `AZURE_SEARCH_API_KEY`; thiếu một trong hai thì vẫn dùng bản in-memory.
:::

:::exercise Chuẩn bị môi trường tối thiểu
Sparse clone chỉ hai thư mục `00-course-setup` và `01-intro-to-ai-agents`, tạo venv Python 3.12, rồi viết file `.env` cho project Foundry của bạn. Liệt kê các lệnh theo thứ tự, và lệnh kiểm tra rằng bạn đã đăng nhập đúng subscription.
???
```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/<ten-ban>/ai-agents-for-beginners.git
cd ai-agents-for-beginners
git sparse-checkout set 00-course-setup 01-intro-to-ai-agents
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
az login            # hoặc az login --use-device-code
az account show     # kiểm tra subscription
cp .env.example .env
# sửa .env: AZURE_AI_PROJECT_ENDPOINT và AZURE_AI_MODEL_DEPLOYMENT_NAME
```

`requirements.txt` nằm ở thư mục gốc. Với sparse checkout ở chế độ cone, các file ở thư mục gốc luôn được checkout.
:::

**Bài tiếp theo:** [Bài 1 — Giới thiệu AI Agent](/ai-agents/course/nen-tang/gioi-thieu-ai-agent)
