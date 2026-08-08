# Design — `ai-credentials` (BYO AI credentials, single-provider)

> Brainstorm 2026-08-08 qua `superpowers:brainstorming`.
> Hiện thực **phần 1/2 của Goal 6** (`project-goals.md` §6.2). Phần 2 — multi-provider compare — là feature riêng `multi-provider-compare`, xem §10.

## 1. Vấn đề & phạm vi

Hôm nay mọi lần match đều chạy bằng **một key OpenRouter duy nhất của hệ thống** (`OPENROUTER_API_KEY`), hard-wire thành một instance `OpenAI` dựng ở constructor của `AiService`. User không cắm được key của mình, không chọn được provider, không biết key còn sống hay không.

Feature này cho user **tự quản lý credential AI của họ** và **chạy match bằng credential đã chọn**, với key hệ thống làm fallback.

### Trong phạm vi

- Model `AiCredential` (per-user, key mã hoá AES-256-GCM at-rest) + CRUD API.
- **Test connection**: ping thật cả chat lẫn embeddings, lưu trạng thái lần test cuối.
- Trang `/ai-credentials` quản lý credential; modal "thêm nhanh" dùng lại được ở wizard.
- Wizard step 3: khối **"Chạy bằng"** chọn credential (hoặc key hệ thống) cho lần match này.
- `MatchResult` snapshot lại `provider` / `chatModel` / `embedModel` / `credentialId` đã dùng.
- Provider whitelist: `openrouter`, `openai`, `gemini` (ADR #10).

### Ngoài phạm vi (cố ý)

| Hoãn | Lý do |
|---|---|
| `MatchRun` + `MatchResult.runId` / `status` / `errorCode` | Match ở feature này vẫn synchronous, **một** provider: lỗi trả HTTP error và **không** tạo row → `status` sẽ là cột hằng số. Ba field này chỉ có nghĩa khi có nhiều kết quả song song → thuộc `multi-provider-compare`. |
| Multi-select provider, progressive reveal, partial success | Feature `multi-provider-compare`. |
| Provider không OpenAI-compatible (Anthropic, Voyage) | ADR #10 loại vì thiếu embeddings API — engine hybrid cần cả 2 capability. |
| Theo dõi quota / billing hộ user | `project-goals.md` §5 Non-Goals. Chỉ phản ánh lỗi provider trả về. |
| Cột `isDefault` trên credential | Wizard chọn tường minh mỗi lần chạy; mặc định suy ra từ `lastUsedAt`. |

### Điều kiện tiên quyết còn hiệu lực

ADR #9 vẫn nguyên: mock user dùng chung nghĩa là **mọi caller đọc được cùng credential** → **KHÔNG deploy public trước khi Auth/SSO xong**. Feature này làm precondition đó nặng hơn (giờ có secret của user trong DB), không nới nó ra.

## 2. Sự thật kỹ thuật đã verify

Open question trong `project-goals.md` §12 — *"Gemini có endpoint OpenAI-compatible phủ cả embeddings không?"* — **đã xác nhận CÓ** (2026-08-08, https://ai.google.dev/gemini-api/docs/openai):

- Base URL `https://generativelanguage.googleapis.com/v1beta/openai/`
- Phủ `/chat/completions`, `/embeddings`, `/models`
- Embed model: `gemini-embedding-001`

→ Cả 3 provider trong whitelist đều lái được bằng **một SDK `openai` duy nhất**. Khác biệt giữa chúng là **dữ liệu** (baseURL + tên model mặc định), không phải hành vi. **Không thêm dependency mới.**

## 3. Quyết định thiết kế

| # | Quyết định | Lý do |
|---|---|---|
| D1 | Tách Goal 6 làm **2 feature tuần tự** | Feature này ship độc lập có giá trị ngay; khối bảo mật (crypto + secret của user) được review riêng, không lẫn với khối đồng thời (parallel + partial success). |
| D2 | Provider = **bảng mô tả const**, không phải strategy class | ADR #10 chốt whitelist toàn provider OpenAI-compatible → 3 class sẽ giống hệt nhau. Strategy pattern là trả tiền trước cho thứ goal đang cố ý loại trừ. |
| D3 | Test connection **ping cả chat + embed** (2 call nhỏ song song) | Engine hybrid cần **cả hai** capability. Test một cái sẽ cho "ok" giả — key có quyền chat nhưng không có quyền embeddings vẫn pass. |
| D4 | Model = **ô nhập tự do**, để trống = mặc định của provider | OpenRouter có hàng trăm model → whitelist hard-code là giới hạn giả và phải sửa code mỗi lần provider ra model mới. Test connection chính là cơ chế xác minh tên model. |
| D5 | Credential **sửa được**, kể cả thay key | Key hết hạn / bị lộ là chuyện thật. Xoá-rồi-tạo-lại sẽ set `MatchResult.credentialId = NULL` (ON DELETE SET NULL) → mất attribution của lịch sử match. |
| D6 | Credential **chưa test / test fail vẫn chạy được**, chỉ cảnh báo | Test xanh hôm qua không đảm bảo hôm nay còn quota. Chặn cứng tạo cảm giác an toàn giả mà vẫn không ngăn được lỗi thật lúc chạy. |
| D7 | `CREDENTIAL_ENCRYPTION_KEY` **optional lúc boot, 503 lúc gọi** | Đồng bộ pattern `AiService` hiện có → test/CI/e2e không cần khoá thật, mọi endpoint khác chạy bình thường. **Không bao giờ tự sinh khoá tạm** — ciphertext cũ sẽ không giải được sau restart. |
| D8 | Sau khi lưu credential (create, hoặc edit có đổi key/model) → **tự chạy test một lần** | Để `lastTestStatus` không ở trạng thái "chưa biết" một cách vô cớ. Kết quả hiện ngay trong modal trước khi đóng. |

## 4. Kiến trúc backend

### 4.1 Module layout

`AiService` đang nằm trong `modules/matching/`, nhưng test connection cũng cần nó. Giữ nguyên vị trí sẽ tạo vòng `AiCredentialsModule → MatchingModule → AiCredentialsModule`. Tách ra:

```
src/common/crypto/
  credential-crypto.service.ts   MỚI — AES-256-GCM, isConfigured()
  crypto.module.ts               MỚI

src/modules/ai/                  MỚI — module hạ tầng, KHÔNG có controller
  providers.ts                   PROVIDERS const + AiRuntimeConfig + resolveModels()
  ai.service.ts                  CHUYỂN từ modules/matching/ — bỏ client ở constructor
  ai.service.spec.ts             chuyển kèm
  ai.module.ts
  i18n-messages.ts               tAi(), namespace `ai.*`

src/modules/ai-credentials/      MỚI
  ai-credentials.controller.ts
  ai-credentials.service.ts
  ai-credentials.module.ts
  dto/create-ai-credential.dto.ts
  dto/update-ai-credential.dto.ts
  dto/ai-credential.dto.ts
  dto/test-result.dto.ts
  dto/provider-info.dto.ts
  i18n-messages.ts               tCred(), namespace `aiCredentials.*`

src/modules/matching/            SỬA — bỏ ai.service.*, import AiModule + AiCredentialsModule
```

Đồ thị phụ thuộc một chiều: `Matching → {Ai, AiCredentials}` · `AiCredentials → {Ai, Crypto}` · `Ai → ∅`.

i18n key `matching.errors.notConfigured` / `matching.errors.aiFailed` **chuyển** sang `ai.errors.*` (file mới `src/i18n/{en,vi}/ai.json`). `matching.json` giữ lại `documentNotOwned`, `invalidDocumentKind`, `matchNotFound`.

### 4.2 Bảng provider

```ts
// src/modules/ai/providers.ts
export const PROVIDERS = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultChatModel: "openai/gpt-4o-mini",
    defaultEmbedModel: "openai/text-embedding-3-small"
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultChatModel: "gpt-4o-mini",
    defaultEmbedModel: "text-embedding-3-small"
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultChatModel: "gemini-2.5-flash",
    defaultEmbedModel: "gemini-embedding-001"
  }
} as const satisfies Record<AiProvider, ProviderDescriptor>;
```

`AiRuntimeConfig = { provider, apiKey, baseUrl, chatModel, embedModel }` — **type nội bộ**, chứa plaintext key, không bao giờ là DTO.

`AiService` đổi chữ ký: `embed(text, cfg)`, `generateReport(cv, jd, scores, cfg)`, thêm `ping(cfg)`. Client `new OpenAI({ apiKey, baseURL })` dựng **trong từng lời gọi** — không instance nào giữ key. `systemRuntimeConfig()` đọc env `OPENROUTER_*` (503 nếu chưa cấu hình), giữ nguyên hành vi hiện tại.

### 4.3 Mã hoá

`CredentialCryptoService`:

- Khoá từ env `CREDENTIAL_ENCRYPTION_KEY`, **base64 giải ra đúng 32 byte**. Sai độ dài = coi như chưa cấu hình.
- `encrypt(plain) → { ciphertext, iv, tag }`; IV **12 byte ngẫu nhiên mỗi lần ghi**, không tái dùng.
- `decrypt({ ciphertext, iv, tag }) → string`; tag sai → `createDecipheriv` throw → không nuốt lỗi.
- `isConfigured()`; chưa cấu hình → mọi endpoint credential trả **503 i18n**.
- Env đọc qua `ConfigService` (rule `config.md`: không `process.env` trong service).

### 4.4 Prisma schema — migration `add_ai_credential`

```prisma
enum AiProvider   { openrouter openai gemini }
enum AiTestStatus { ok invalid_key no_quota model_unavailable unreachable }

model AiCredential {
  id             String        @id @default(uuid())
  userId         String
  user           User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider       AiProvider
  label          String
  encryptedKey   Bytes
  keyIv          Bytes
  keyTag         Bytes
  keyLast4       String
  chatModel      String?
  embedModel     String?
  lastTestStatus AiTestStatus?
  lastTestedAt   DateTime?
  lastUsedAt     DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  matchResults   MatchResult[]

  @@unique([userId, label])
  @@index([userId])
}
```

`MatchResult` thêm: `credentialId String?` (FK → `AiCredential`, `onDelete: SetNull`), `provider AiProvider`, `chatModel String`, `embedModel String`.

**Backfill row cũ**: migration `ADD COLUMN ... DEFAULT 'openrouter' / 'openai/gpt-4o-mini' / 'openai/text-embedding-3-small'`, sau đó `DROP DEFAULT` để mọi write về sau buộc phải ghi tường minh. Xấp xỉ đúng vì mọi match trước feature này đều chạy qua OpenRouter. `credentialId` để `NULL` = chạy bằng key hệ thống.

`seed.ts` không đổi (mock user đã có; không seed credential vì không có key thật để seed).

### 4.5 API

Prefix `api/v1`.

| Verb | Path | Body | Trả về |
|---|---|---|---|
| `GET` | `/ai-credentials` | — | `AiCredentialDto[]`, sort `createdAt desc` |
| `POST` | `/ai-credentials` | `{ provider, label, apiKey, chatModel?, embedModel? }` | `201 AiCredentialDto` |
| `PATCH` | `/ai-credentials/:id` | `{ label?, apiKey?, chatModel?, embedModel? }` | `AiCredentialDto` |
| `DELETE` | `/ai-credentials/:id` | — | `204` |
| `POST` | `/ai-credentials/:id/test` | — | `TestResultDto` |
| `GET` | `/ai-credentials/providers` | — | `ProviderInfoDto[]` |
| `POST` | `/match` | **+ `credentialId?`** | `MatchResultDto` (+ 4 field mới) |

- `AiCredentialDto` = `id, provider, label, keyLast4, chatModel, embedModel, lastTestStatus, lastTestedAt, lastUsedAt, createdAt`. **Không field nào chứa key.**
- `ProviderInfoDto` = `{ id, label, defaultChatModel, defaultEmbedModel }`, đọc thẳng từ `PROVIDERS` — bảng provider chỉ tồn tại một chỗ, FE không hard-code lại placeholder.
- `PATCH` có `apiKey` → re-encrypt với IV mới + `keyLast4` mới. Đổi `apiKey` / `chatModel` / `embedModel` → reset `lastTestStatus = null`, `lastTestedAt = null`.
- `GET /ai-credentials/providers` khai báo **trước** route `:id` trong controller để `providers` không bị nuốt thành param.

### 4.6 Test connection

`Promise.allSettled([ping chat, ping embed])`, dùng lại `AI_TIMEOUT_MS = 20_000` hiện có.

- chat: `chat.completions.create({ model, max_tokens: 5, messages: [{ role: "user", content: "ping" }] })`
- embed: `embeddings.create({ model, input: "ping" })`

`TestResultDto = { status, chat, embed, testedAt }` — DB chỉ lưu `status` tổng hợp (ERD có một cột), response mang chi tiết để UI nói được *"chat OK, embed model không tồn tại"*.

Ánh xạ lỗi provider → `AiTestStatus` (severity giảm dần; tổng hợp lấy cái nặng nhất):

| Tín hiệu từ provider | Status |
|---|---|
| HTTP 401 / 403 | `invalid_key` |
| HTTP 402 / 429 | `no_quota` |
| HTTP 404, hoặc 400 có chữ `model` trong message | `model_unavailable` |
| timeout, DNS/socket error, 5xx | `unreachable` |

### 4.7 Luồng match

```ts
const runtime = dto.credentialId
  ? await this.credentials.getRuntimeConfig(dto.credentialId)  // 404 nếu không thuộc user; 503 nếu thiếu khoá mã hoá
  : this.ai.systemRuntimeConfig();                             // env OPENROUTER_*; 503 nếu chưa cấu hình

const result = await this.run(cvDoc.rawText, jdDoc.rawText, runtime);

const created = await this.prisma.matchResult.create({
  data: { /* …scores, report… */
    credentialId: dto.credentialId ?? null,
    provider: runtime.provider,
    chatModel: runtime.chatModel,
    embedModel: runtime.embedModel }
});

// Dấu audit, cố ý NẰM NGOÀI transaction ghi kết quả: gộp chung sẽ roll back
// một match đã tính xong (và user đã trả tiền cho nó) chỉ vì cập nhật một mốc
// thời gian thất bại.
if (dto.credentialId) await this.credentials.markUsed(dto.credentialId);
```

User chưa có credential nào → không truyền `credentialId` → **hành vi hôm nay không đổi**.

## 5. Bất biến bảo mật (là acceptance criteria, không phải lời khuyên)

1. `encryptedKey` / `keyIv` / `keyTag` **không xuất hiện trong bất kỳ DTO nào**. Query list/read dùng `select` tường minh. Đúng **một** method — `getRuntimeConfig(id)` — được đọc 3 cột đó và giải mã.
2. `AiRuntimeConfig` là type nội bộ: không `@ApiProperty`, không `JSON.stringify`, không trả ra controller.
3. **Không log body lỗi của provider.** Các `catch` trong `AiService` giữ dạng `catch { throw ... }` như hiện tại — response provider có thể echo lại key trong message.
4. Swagger: `apiKey` đánh `writeOnly: true`, example là placeholder, không phải key thật.
5. `POST /:id/test` gắn `@Throttle` chặt hơn global (**10 req/phút**) — nếu không, app thành oracle kiểm tra key hộ người khác.
6. Ràng buộc input (khớp đúng với các giá trị BVA ở §7 row 6):
   - `apiKey` — `@IsString() @Length(20, 400) @Matches(/^\S+$/)`; regex chặn whitespace/newline (header injection).
   - `label` — `@IsString() @Length(1, 60)`, trim trước khi validate.
   - `chatModel` / `embedModel` — `@IsOptional() @IsString() @Length(0, 120)`; **chuỗi rỗng là hợp lệ và có nghĩa**: nó vừa là "dùng mặc định của provider" khi tạo, vừa là cách **xoá** override đã có khi PATCH. Service trim rồi lưu blank thành `null`. **Không** có rule no-whitespace ở đây (khác `apiKey`): 2 giá trị này đi vào JSON body chứ không vào header, và tên model sai chỉ khiến provider trả `model_unavailable` — đúng đường phản hồi mà thiết kế muốn.
     > *(sửa 2026-08-08 sau BE e2e)* Bản đầu đặt `@Length(1, 120)` + no-whitespace. Điều đó làm **mọi lần sửa credential từ UI trả 400**, vì form gửi `chatModel: ""` khi ô trống, và cũng khiến override đã lưu **không xoá được**.
   - `provider` — `@IsEnum(AiProvider)`.
   - `credentialId` trên `POST /match` — `@IsOptional() @IsUUID()`.
7. Mọi query `findFirst({ where: { id, userId } })` với `userId` từ `CurrentUserService`. Label trùng → **409** bắt bằng unique constraint (`P2002`), không check-then-insert (race).
8. FE **không bao giờ render key gốc**; ô key khi sửa để trống, chỉ hiện `••••1234`.

## 6. Kiến trúc frontend

```
src/routes/_app/ai-credentials.tsx                       route mỏng
src/views/AiCredentials/index.tsx
src/views/AiCredentials/mains/CredentialList/index.tsx   header + Add + list + empty state
src/views/AiCredentials/components/CredentialRow/index.tsx
src/components/CredentialFormModal/index.tsx             DÙNG CHUNG page + wizard → src/components/
src/components/TestStatusTag/index.tsx                   dùng ở cả 2 nơi
src/views/Wizard/components/RunWithSelector/index.tsx    khối "Chạy bằng" ở StepReview
src/requests/aiCredentials.ts                            + query-key factory
src/hooks/useAiCredentials.ts                            list/create/update/delete/test + useProviders
src/types/AiCredentials/index.ts
```

- Sidebar thêm mục `/ai-credentials`, icon `KeyRound` (Lucide, theo `icon-map.md`).
- `useWizardStore` thêm `credentialId: string | null` + `setCredentialId`; `reset()` đưa về `null`.
- `MatchResultDto` phía FE thêm 4 field → `StepResult` hiện dòng "Chạy bằng: OpenRouter · gpt-4o-mini".

### UX

**Trang `/ai-credentials`** — cùng ngôn ngữ với `DocumentLibrary`: mỗi dòng gồm tag provider, label, `••••1234`, model override (hoặc chữ "mặc định"), `TestStatusTag` + thời gian test tương đối, và 3 action **Test / Sửa / Xoá**. Empty state nói rõ chưa có credential nào → match đang chạy bằng key hệ thống.

**Modal form** (dùng chung create/edit): `Select` provider đổi placeholder 2 ô model theo `PROVIDERS`; `Input.Password` cho key, `autoComplete="off"`. Khi **sửa**, ô key để trống kèm chú thích *"Để trống để giữ key hiện tại"*. Lưu xong → tự chạy test một lần (D8), kết quả hiện trong modal trước khi đóng.

**Xoá** → `Popconfirm`, không chặn. FK là `ON DELETE SET NULL` và `MatchResult` đã snapshot provider/model, nên lịch sử match cũ vẫn đọc được — câu confirm nói đúng điều đó.

**Step 3 — khối "Chạy bằng"**: `Select` liệt kê credential (label · provider · `••••1234` · chấm trạng thái) + mục "Key hệ thống"; nút "+ Thêm credential" mở `CredentialFormModal`. Mặc định chọn credential có `lastUsedAt` mới nhất; chưa có credential nào → "Key hệ thống". Credential chưa test / test fail vẫn chọn được, kèm cảnh báo (D6).

Ngay dưới selector là **thông báo quyền riêng tư bắt buộc** (`project-goals.md` §7): nêu đích danh nhà cung cấp mà nội dung CV/JD sẽ được gửi tới trong lần chạy này. Đi qua i18n, có cả `en` + `vi`.

## 7. E2E Scenario Matrix

Gate mặc định `A+B`; scenario có mutation ghi `A only` để gate B (MCP walk) chỉ verify read/render, tránh contamination.

| # | Category | Trạng thái | Scenario + giá trị dẫn xuất | Gate |
|---|---|---|---|---|
| 1 | Happy path | ✅ | (a) `/ai-credentials` rỗng → thấy empty state + nút Add. (b) Tạo credential `openrouter` label `"OpenRouter cá nhân"` → dòng mới hiện `••••` + 4 ký tự cuối, tự chạy test. (c) Bấm Test trên dòng có sẵn → `TestStatusTag` đổi trạng thái + mốc thời gian. (d) Wizard step 3 → "Chạy bằng" mặc định chọn credential `lastUsedAt` mới nhất → chạy match → step 4 hiện "Chạy bằng: OpenRouter · gpt-4o-mini". | (b)(c) A only · (a)(d) A+B |
| 2 | AuthN | N/A | Chưa có auth — app chạy như đã đăng nhập bằng mock user (`project-goals.md` §3). Không có màn login để test redirect/401. Sẽ thành ✅ ở Roadmap #6 (Auth/SSO). | — |
| 3 | AuthZ | N/A ở E2E FE | Không có phân quyền theo role trên feature này. Per-user isolation (credential của user khác → 404) **không** test được qua FE vì chỉ tồn tại một mock user → cover ở BE e2e `ai-credentials.e2e-spec.ts` (§8). | — |
| 4 | Validation | ✅ | **[EP]** `apiKey`: `valid` · `empty` · `too-short (19 ký tự)` · `có khoảng trắng giữa` · `chỉ khoảng trắng`. `label`: `valid` · `empty` · `trùng label đã có`. **[DT]** kết hợp — `label trùng + apiKey hợp lệ` → 409 hiện trên ô label; `label hợp lệ + apiKey 19 ký tự` → chặn client-side, **không** gọi API; `label trùng + apiKey 19 ký tự` → **assert lỗi client (apiKey) thắng, request không được bắn đi**. `provider` là Select nên không nhập bậy được → N/A phần enum. | A only |
| 5 | Empty / null | ✅ | List rỗng → empty state nêu đang dùng key hệ thống. `chatModel`/`embedModel` = `null` → render chữ "mặc định", **không** phải ô trống hay `null`. `lastTestStatus` = `null` → tag "Chưa test". `lastTestedAt`/`lastUsedAt` = `null` → "—", không phải `Invalid Date`. Step 3 khi chưa có credential → dropdown chỉ có "Key hệ thống" và đó là lựa chọn mặc định. | A+B |
| 6 | Boundary | ✅ | **[BVA]** `apiKey` length: `19` (min−1 → reject) · `20` (min → accept) · `400` (max → accept) · `401` (max+1 → reject). `label` length: `0` (reject) · `1` (accept) · `60` (accept) · `61` (reject). Không phân trang (số credential của một user là hàng đơn vị) → phần pagination **N/A**. | A only |
| 7 | Filter / search | N/A | Trang không có filter/search/sort — danh sách ngắn, sort cố định `createdAt desc`. Không có query param nào cần persist vào URL. | — |
| 8 | Data rendering | ✅ | `provider` enum → nhãn người đọc ("OpenRouter" / "OpenAI" / "Google Gemini"), **không** phải chuỗi enum thô. `lastTestStatus` enum → nhãn + màu qua `TestStatusTag`, không phải `invalid_key`. `lastTestedAt` → thời gian tương đối ("2 phút trước"), không phải ISO. Key → đúng dạng `••••1234`, và **assert DOM không chứa key gốc ở bất kỳ đâu**. | A+B |
| 9 | i18n | ✅ | Render **cả `en` và `vi`** cho: tiêu đề trang + empty state, nhãn 3 action, mọi nhãn/placeholder trong modal, 5 giá trị của `TestStatusTag`, nội dung `Popconfirm` xoá, **thông báo quyền riêng tư ở step 3**, và message lỗi validation. Bắt lỗi thiếu key dịch. | A+B |
| 10 | Error / loading | ✅ | `GET /ai-credentials` trả 500 → error UI, không phải trang trắng. Thiếu `CREDENTIAL_ENCRYPTION_KEY` → 503 → thông báo "chưa cấu hình" rõ ràng thay vì lỗi chung chung. Test connection trả `invalid_key` → tag đỏ + không crash. Đang load list → skeleton. Match với credential vừa bị xoá → 404 hiển thị được. | A+B (mock qua route interception) |
| 11 | Mutation safety | ✅ | **[ST]** vòng đời: `tạo (chưa test)` → `test → ok` → `sửa đổi key` → **trạng thái test phải reset về "Chưa test"** (transition hợp lệ) → `xoá`. **Invalid transition (bắt buộc)**: chọn credential ở step 3, xoá nó ở route khác, rồi bấm Run match → BE trả 404, UI báo lỗi và **không** tạo `MatchResult` mồ côi. Double-submit: bấm Lưu 2 lần nhanh → chỉ 1 credential được tạo (nút disable khi pending). Toàn bộ credential tạo trong test bị xoá ở `afterAll`. | A only |
| 12 | Accessibility | ✅ | Modal: focus vào ô đầu khi mở, `Esc` đóng, focus trả về nút đã kích hoạt. Mọi input có label liên kết (chọn bằng `getByLabel`, không phải CSS selector). `Popconfirm` thao tác được bằng bàn phím. Select "Chạy bằng" có accessible name. Thứ tự tab trên một dòng: Test → Sửa → Xoá. | A+B |

**Error-guessing pass** (làm inline, không dispatch subagent vì người dùng không yêu cầu bản "thorough"): đã gộp vào matrix — paste key có khoảng trắng thừa (row 4), double-submit (row 11), thao tác trên credential đã bị xoá ở nơi khác (row 11), reset trạng thái test sau khi rotate key (row 11), `Invalid Date` khi field thời gian null (row 5), và assert DOM không rò key gốc (row 8).

## 8. Kiểm thử

**BE unit**
- `credential-crypto.service.spec` — encrypt→decrypt khứ hồi; sửa 1 byte ciphertext → decrypt throw; sửa tag → throw; IV khác nhau giữa 2 lần ghi cùng plaintext; khoá sai độ dài → `isConfigured() === false`.
- `providers.spec` — resolve model mặc định theo provider; override thắng mặc định; ô rỗng coi như không override.
- `ai-credentials.service.spec` — ownership; 409 khi label trùng; PATCH đổi key/model reset trạng thái test; **assert DTO không chứa `encryptedKey`/`keyIv`/`keyTag`**.
- `ai.service.spec` — cập nhật cho config per-request; ánh xạ HTTP status → `AiTestStatus` (401→`invalid_key`, 429→`no_quota`, 404→`model_unavailable`, timeout→`unreachable`).
- `matching.service.spec` — snapshot provider/model vào `MatchResult`; không truyền `credentialId` → dùng system config.

**BE e2e** — `test/ai-credentials.e2e-spec.ts`: CRUD đầy đủ; 404 với id của user khác (**đây là nơi cover row 3**); 503 khi thiếu khoá mã hoá; và một assertion đọc **toàn bộ response body dạng chuỗi** để chắc chắn không chứa key gốc. SDK `openai` được mock — không có network thật.

**FE unit (Vitest)** — render trang + empty state; validation của `CredentialFormModal`; `RunWithSelector` chọn đúng mặc định trong 3 trạng thái (không có credential / có nhiều credential / credential đã chọn bị xoá).

**FE E2E (Playwright)** — một test cho mỗi scenario ✅ ở §7, đặt tại `client/e2e/ai-credentials/`. Provider thật được chặn bằng route interception — E2E **không** gọi API AI thật.

## 9. Thay đổi ngoài code

- `.env.example` (server): thêm `CREDENTIAL_ENCRYPTION_KEY=` kèm chú thích cách sinh (`openssl rand -base64 32`).
- `docs/erd.md`: đánh dấu phần nào của `AiCredential` + `MatchResult` đã implement ở feature này, phần nào (`MatchRun`, `runId`, `status`, `errorCode`) còn 📝 chờ `multi-provider-compare`.
- `docs/project-goals.md`: §12 xoá 2 open question của Goal 6 đã được feature này chốt — Gemini embeddings (đã verify, §2) và model list per-provider (đã chốt D4). Open question còn lại của Goal 6 ("cap số provider mỗi lần chạy") **giữ nguyên** vì thuộc `multi-provider-compare`. Roadmap #3 đổi trạng thái sang "đang làm / spec đã có".
- README (server + client): nếu đổi setup/env → `readme-maintainer` ở step 4.8.

## 10. Feature kế tiếp — `multi-provider-compare`

Feature này cố ý dựng sẵn nền cho nó: `PROVIDERS` là dữ liệu nên gọi song song N config chỉ là vòng lặp; `AiRuntimeConfig` per-request nên không có state dùng chung giữa các lần chạy; `MatchResult` đã snapshot provider/model nên nhiều kết quả trong một run phân biệt được nhau. Phần còn thiếu đúng bằng những gì §1 hoãn: bảng `MatchRun`, 3 cột `runId`/`status`/`errorCode`, multi-select ở step 3, và progressive reveal ở step 4.

Roadmap #4 (CV rewrite assistant) và #5 (Cover letter generator) cũng dùng lại nền này: cả hai đều là lời gọi chat qua một provider, nên chúng tiêu thụ đúng `AiRuntimeConfig` + `getRuntimeConfig()` mà feature này dựng, thay vì tự đọc env. Đó là nội dung của ghi chú "phụ thuộc mềm #3" trong Roadmap.
