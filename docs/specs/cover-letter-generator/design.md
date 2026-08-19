# Design — `cover-letter-generator` (Roadmap #8, Goal 7b)

> Brainstorm 2026-08-09 qua `superpowers:brainstorming`.
> Nền tảng đã có sẵn và **được tái dùng nguyên vẹn**: `AiRuntimeConfig` dựng per-request, `AiCredentialsService.getRuntimeConfig()` (credential của user, key hệ thống là fallback), và bài học D3 của `multi-provider-compare` — **thất bại của provider được lưu thành row, không ném 503**. Xem `specs/ai-credentials/design.md` §10 + `specs/multi-provider-compare/design.md` §2.
>
> **Song song với Roadmap #6 (`cv-rewrite-assistant`, Goal 7a)**. Feature này **cố ý không đụng `Document`** — không thêm cột, không thêm migration lên bảng đó. Lineage `Document.parentId` là của 7a/Goal 9; cover letter không tham gia vào chuỗi đó (§2 D2).

## 1. Vấn đề & phạm vi

Hôm nay app **nói cho user biết CV của họ khớp JD tới đâu** rồi dừng. `project-goals.md` §6.4 muốn bước tiếp: từ đúng cặp CV↔JD đã chấm, sinh một **cover letter** nói đúng những điểm mạnh đã khớp — thay vì một lá thư chung chung mà bất kỳ ai cũng gửi được.

Đầu vào tự nhiên đã nằm sẵn trong `MatchResult`: `report.strengths` là danh sách "CV này khớp JD ở chỗ nào", và `report.gaps` là danh sách "CV này **không** có gì". Cả hai đều quý — cái thứ nhất là chất liệu để viết, cái thứ hai là **danh sách cấm** (§4).

### Trong phạm vi

- Model `CoverLetter` (bảng mới, độc lập `Document`) + migration `add_cover_letter`.
- `POST /cover-letters` sinh thư từ một `MatchResult` **thành công**, chạy bằng credential user chọn (fallback key hệ thống).
- `GET /cover-letters?matchResultId=…` liệt kê các bản đã sinh của cặp đó — nền cho việc **so bản này với bản kia**.
- `PATCH /cover-letters/:id` lưu bản user sửa tay tại chỗ; `DELETE /cover-letters/:id` bỏ bản không dùng.
- Tuỳ chọn khi sinh: **độ dài** (`short` | `standard`), **tone** (`formal` | `friendly`), **ngôn ngữ** (`en` | `vi`).
- **Grounding cứng theo ADR #13** — prompt nhận `gaps` làm danh sách **không được phép khẳng định**, và model phải trả về `omittedRequirements` để UI nói thẳng "lá thư này cố ý không nhận những thứ sau" (§4).
- FE: nút ở **step 4 (card kết quả thành công)** → modal sinh / sửa / copy / so bản.
- Thất bại provider → **row `status=failed` + `errorCode`**, HTTP 201 — cùng hợp đồng với `POST /match` sau D3.

### Ngoài phạm vi (cố ý)

| Hoãn | Lý do |
|---|---|
| Điểm vào từ **trang match history** (§6.4 có nhắc) | Trang `/history` **chưa tồn tại** (`unfinished-features.md`; sidebar chưa có link). Nút sẽ đi kèm trang đó khi nó được làm; đặt trước một nút không có chỗ đứng là code chết. |
| Export `.docx` / `.pdf` | §6.4 viết "copy / export". Copy vào clipboard + tải `.txt` phủ đúng nhu cầu "đem đi dán vào email/portal"; sinh file định dạng là một khối phụ thuộc riêng (`docx` writer) mà giá trị thêm gần bằng 0 khi user đằng nào cũng dán vào form tuyển dụng. |
| Sinh thư từ một `MatchResult` **failed** | Không có `report.strengths` thì không có chất liệu, và không có gì để grounding lên. Chặn ở service (400). |
| Nhiều provider song song cho cùng một lá thư | `multi-provider-compare` giải bài toán "so cách chấm điểm giữa các provider". So **văn phong** giữa các provider không phải câu hỏi user đang có; và họ vẫn sinh lần lượt được rồi so, vì bản nào cũng được lưu. |
| Nhật ký `DataDisclosure` cho call chat này | Goal 10 / Roadmap #5, cố ý độc lập (ADR #16). Khi Goal 10 về, nó chèn vào `AiService` một lần cho mọi call. |
| Diff / lineage với CV gốc | Cover letter **không phải** một phiên bản của CV. Xem D2. |

## 2. Quyết định thiết kế

| # | Quyết định | Lý do |
|---|---|---|
| **D1** | **CÓ lưu.** Bảng riêng `CoverLetter`, mỗi lần sinh là một row — **tự lưu, không có nút "Save"** | Đây là open question §12 của `project-goals.md`; đóng ở đây. Lập luận đầy đủ ở §3. |
| **D2** | `CoverLetter` **độc lập hoàn toàn** với `Document` và với lineage `parentId` | Cover letter không phải một phiên bản của CV: nó không đem đi match lại được (`kind` của nó không phải CV cũng không phải JD), không có "bản v2 tốt hơn bản v1" đo bằng điểm, và không ai muốn nó nằm lẫn trong thư viện CV. Nhét nó vào `Document` sẽ làm mọi query `kind IN (CV, JD)` và mọi màn library phải học thêm một loại thứ ba. **Cũng là điều kiện để feature này không giẫm chân Roadmap #6/#7 đang chạy song song.** |
| **D3** | Neo vào **`MatchResult`**, không phải cặp `(cvDocumentId, jdDocumentId)` | Lá thư được sinh từ `report.strengths` của **một lần chấm cụ thể**. Cùng một cặp CV↔JD chạy 2 provider ra 2 report khác nhau → 2 lá thư khác nhau, và người đọc phải biết bản này dựa trên report nào. `matchResultId` cũng cho ta `cvDocumentId`/`jdDocumentId` miễn phí. |
| **D4** | Provider lỗi → **lưu row `status=failed` + `errorCode`, HTTP 201** | Y hệt D3 của `multi-provider-compare`, vì cùng một lý do: user cần **thấy** cái gì hỏng và thử lại được, và một lần gửi CV ra ngoài rồi mới lỗi vẫn là một sự kiện có thật. 503 **giữ lại** cho lỗi *cấu hình* (thiếu key hệ thống, thiếu `CREDENTIAL_ENCRYPTION_KEY`) — đó là hỏng của hệ thống chứ không phải kết quả của một lần chạy. |
| **D5** | `gaps` được gửi vào prompt như **danh sách cấm**, không phải chất liệu | Đây là cách hiện thực ADR #13 mà **kiểm tra được**, chứ không phải một câu "đừng bịa nhé" thả vào system prompt. Xem §4. |
| **D6** | Model trả JSON `{ body, omittedRequirements }` | Biến ràng buộc grounding thành thứ **user nhìn thấy**. Model phải tự khai "yêu cầu nào của JD tôi không dám nhận vì CV không có" — và UI hiển thị đúng danh sách đó dưới lá thư. Nếu model bịa, danh sách này sẽ rỗng một cách đáng ngờ trong khi `gaps` thì dài — một tín hiệu user đọc được ngay. |
| **D7** | **Modal** ở step 4, không phải route riêng | Điểm vào theo §6.4 là "nút ở step 4". Một route `/cover-letter/$matchResultId` sẽ cần wizard store, cần đường quay lại, cần xử lý reload — trả tiền trước cho một trang không ai bookmark. Modal antd giữ user đúng chỗ họ đang đứng. |
| **D8** | `content` là **plain text**, không markdown/HTML | Đích đến của lá thư là ô soạn thảo của email hoặc form tuyển dụng. Markdown ở đó hiện ra dưới dạng `**dấu sao**`. Plain text cũng loại bỏ hẳn bề mặt XSS khi render (§7). |
| **D9** | `POST /cover-letters` gắn `@Throttle` **10 req/phút**, chặt hơn global 100/60s | Endpoint tiêu tiền AI. Cùng lý do `POST /ai-credentials/:id/test` đã bị siết. |

## 3. Open question §12 — "cover letter có cần lưu không?" → **CÓ LƯU**

Câu hỏi nguyên văn: *"Cover letter có cần lưu lịch sử để so nhiều bản không, hay chỉ generate-and-copy?"*

**Quyết định: lưu, bảng riêng `CoverLetter`, tự lưu mỗi lần sinh.**

### Vì sao không chọn generate-and-copy (phương án rẻ hơn)

Generate-and-copy nghe rẻ hơn: không migration, không endpoint CRUD, không bảng. Nhưng nó **rẻ với người viết code, không rẻ với người dùng**:

1. **Feature này có núm vặn, và núm vặn tồn tại để thử nhiều lần.** `tone × length × language` là 2×2×2. Nếu chỉ generate-and-copy, cách duy nhất để so `formal` với `friendly` là sinh cái thứ hai và **mất cái thứ nhất**. Núm vặn mà không so được kết quả thì để làm gì. Đây chính là câu "để so nhiều bản" trong open question, và câu trả lời là có, vì chính thiết kế của feature tạo ra nhu cầu đó.
2. **Mỗi lần sinh tốn tiền thật.** Một call chat mang toàn bộ CV + JD. Mất bản nháp vì lỡ đóng modal / F5 / lạc tay = trả tiền lại. Với `/match` ta đã chấp nhận đúng lập luận này (D3 `multi-provider-compare`: "một match đã tính xong và user đã trả tiền cho nó").
3. **Không lưu thì không ghi nổi lần lỗi.** Muốn giữ hợp đồng D4 (lỗi provider → hiện được, thử lại được, reload vẫn thấy) thì phải có chỗ để ghi. Không bảng = quay về ném 503 = quay lại đúng thứ `multi-provider-compare` vừa bỏ đi.
4. **§6.4 viết "Lưu lại là tuỳ chọn, không bắt buộc".** Đọc kỹ: đó là câu về **user**, không phải về **hệ thống**. Nó nói user không bị bắt phải giữ lá thư — và điều đó được tôn trọng bằng nút **Xoá** (một hành động, không hỏi lại lần hai), chứ không phải bằng cách hệ thống vứt dữ liệu hộ họ.

### Vì sao tự lưu, không có nút "Save"

Nút "Save" đặt một quyết định vào đúng thời điểm user **chưa biết** mình có muốn giữ hay không (họ vừa đọc xong lá thư đầu tiên, chưa có gì để so). Nó cũng phá luôn tính chất ở điểm 3 — bản lỗi thì không ai bấm Save cả.

Tự lưu + xoá dễ đảo ngược hơn nhiều so với không lưu + không lấy lại được.

### Vì sao điều này KHÔNG vi phạm ADR #13 ("output là đề xuất, chỉ thành dữ liệu thật khi user duyệt")

ADR #13 nói về **CV rewrite**: bản CV mới sẽ thành một `Document`, sẽ đem đi match lại, sẽ nằm trong thư viện, sẽ được đo delta ở Goal 9 — nó **chảy tiếp vào hệ thống**, nên phải qua cửa duyệt của user.

`CoverLetter` là **lá**: không có gì phía sau tiêu thụ nó. Không engine nào đọc nó, không điểm số nào tính từ nó, không màn nào coi nó là sự thật về hồ sơ user. Lưu một bản nháp của một lá thư khác về bản chất với việc thêm một dòng "kinh nghiệm" chưa duyệt vào CV của người ta. Điều ADR #13 **thật sự** cấm — bịa nội dung — được giữ nguyên và siết chặt hơn ở §4.

### Vì sao bảng riêng chứ không phải cột trên `MatchResult`

Một cặp CV↔JD sinh **nhiều** lá thư (đó là cả điểm của quyết định này) → quan hệ 1-n, không nhét vào một cột được. Bảng riêng cũng khiến `MatchResult` không phải học thêm về nội dung sinh ra, đúng cùng lập luận ADR #16 đã dùng cho `DataDisclosure`.

> **Kéo theo cho `erd.md`**: mục *"Generated content 📝 (Goal 7 — CHƯA thiết kế)"* chọn **hướng (b) có sửa** — có bảng riêng, nhưng **không phải** `GeneratedContent` gộp 2 loại. Cover letter có bảng của nó; CV rewrite (Goal 7a) tự chốt lưu trữ của nó theo ADR #13 (một `Document` mới sau khi user duyệt). Gộp hai thứ có vòng đời và ràng buộc khác hẳn nhau vào một bảng `kind` enum sẽ để lại một bảng mà **nửa số cột luôn null**.

## 4. Grounding — ADR #13 hiện thực thế nào, và verify ra sao

Ràng buộc: *nội dung sinh ra phải bám vào những gì CV thật sự có; không bịa kinh nghiệm hay bằng cấp.*

### 4.1 Cơ chế trong prompt (3 tầng, không phải 1 câu dặn dò)

1. **Nguồn chất liệu bị giới hạn tường minh.** Prompt nói rõ: mọi khẳng định về ứng viên **phải truy được về đoạn CV bên dưới**; JD chỉ dùng để biết *nhà tuyển dụng quan tâm gì*, **không** phải để mô tả ứng viên. Đây là lỗi kinh điển của cover letter do LLM viết — nó đọc JD rồi viết như thể ứng viên có đủ mọi thứ JD đòi.
2. **`gaps` đi vào prompt như DANH SÁCH CẤM.** Ta đã có sẵn danh sách "CV này thiếu gì" từ chính `report.gaps` của lần match đó, nên không phải đoán: prompt liệt kê từng gap dưới nhãn **"MUST NOT CLAIM"** kèm chỉ thị — không được khẳng định, không được ám chỉ, không được viết vòng vo cho giống như có. Điều này biến ràng buộc mơ hồ ("đừng bịa") thành một ràng buộc **cụ thể và có dữ liệu**.
3. **Bắt model tự khai phần nó không nhận.** Output là JSON `{ body, omittedRequirements }`; `omittedRequirements` là những yêu cầu của JD mà CV không chống lưng được. Một model tuân thủ sẽ điền vào đây; một model bịa sẽ để rỗng trong khi `gaps` dài — và cả hai trường hợp đều **hiện ra trên UI**.

Kèm theo, `report.strengths` được đưa vào như chất liệu **ưu tiên**: đó là những điểm đã được engine xác nhận là giao của CV và JD, nên viết quanh chúng vừa đúng vừa đắt giá.

### 4.2 Verify bằng gì (không phải bằng niềm tin)

| Tầng | Kiểm chứng |
|---|---|
| **Unit BE** (`cover-letters.service.spec`, `ai.service.spec`) | Assert **prompt thực sự gửi đi** chứa: (a) mọi phần tử của `report.gaps` nằm dưới nhãn cấm; (b) chỉ thị "chỉ khẳng định điều truy được về CV"; (c) `report.strengths` có mặt; (d) chỉ thị JSON shape. Prompt là dữ liệu — assert được như mọi dữ liệu khác. Đây là chỗ ADR #13 trở thành **test đỏ khi ai đó gỡ nó ra**, không phải một comment. |
| **Unit BE** | Model trả `omittedRequirements` không phải mảng → coerce về `[]` (cùng cách `toStringArray` đang xử lý `report`), không throw, không để `undefined` lọt xuống DB. |
| **Unit FE** (`CoverLetterModal`) | Khi `omittedRequirements` không rỗng → khối cảnh báo "lá thư này KHÔNG khẳng định: …" phải render. Ràng buộc không nhìn thấy được là ràng buộc không tồn tại với user. |
| **E2E** row 8 | Assert khối cảnh báo hiện đúng nội dung, và assert lá thư **hiển thị dạng plain text** (không diễn giải markup). |
| **Ranh giới trung thực** | Ta **không** claim đã chứng minh model không bao giờ bịa — không ai chứng minh được điều đó bằng test. Cái ta chứng minh được, và có chứng minh, là: prompt **luôn** mang đủ ràng buộc + dữ liệu gaps, output **luôn** đi kèm phần tự khai, và user **luôn** thấy nó trước khi copy. Lá thư cũng là **bản nháp sửa được**, không phải thứ gửi thẳng đi — user vẫn là cửa duyệt cuối, đúng tinh thần ADR #13. |

## 5. Backend

### 5.1 Schema — migration `add_cover_letter`

Chỉ **thêm**: 4 enum mới + 1 bảng mới + 3 relation ngược (relation ngược của Prisma **không sinh cột**). **Không `ALTER TABLE "Document"`** — 7a giữ nguyên quyền sở hữu bảng đó.

```prisma
enum CoverLetterTone     { formal friendly }
enum CoverLetterLength   { short standard }
enum CoverLetterLanguage { en vi }
enum CoverLetterStatus   { succeeded failed }

/// Một lá thư ứng tuyển sinh từ MỘT MatchResult. Là "lá" — không có gì
/// downstream tiêu thụ nó, nên nó KHÔNG tham gia lineage của Document.
model CoverLetter {
  id                  String              @id @default(uuid())
  userId              String
  user                User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  matchResultId       String
  matchResult         MatchResult         @relation(fields: [matchResultId], references: [id], onDelete: Cascade)
  tone                CoverLetterTone
  length              CoverLetterLength
  language            CoverLetterLanguage
  /// Plain text. Rỗng khi status = failed.
  content             String
  /// Yêu cầu của JD mà CV không chống lưng được — model tự khai (ADR #13, §4).
  omittedRequirements String[]
  status              CoverLetterStatus
  /// Closed set: invalid_key | no_quota | model_unavailable | timeout | unreachable.
  /// KHÔNG BAO GIỜ chứa message thô của provider.
  errorCode           String?
  /// true khi user đã sửa tay — phân biệt bản gốc AI với bản đã biên tập.
  edited              Boolean             @default(false)
  credentialId        String?
  credential          AiCredential?       @relation(fields: [credentialId], references: [id], onDelete: SetNull)
  provider            AiProvider
  chatModel           String
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  @@index([userId, matchResultId])
}
```

- `matchResultId` **CASCADE**: lá thư sinh từ một report; report biến mất thì lá thư mất ngữ cảnh của nó. Cùng lập luận `MatchResult.runId` dùng CASCADE (thứ *chứa* nó), khác `credentialId` dùng SET NULL (thứ nó *được chạy bằng*).
- `String[]` (Postgres `text[]`) thay vì `Json`: đây là danh sách chuỗi thuần, không phải cấu trúc mở. Type-safe hơn, không phải cast `Prisma.InputJsonValue`.
- Không snapshot `embedModel` — cover letter chỉ dùng chat, không embed.
- `seed.ts` **không đổi** (không seed nội dung sinh — không có key thật để sinh).
- **Data cũ**: bảng mới, không backfill, không ảnh hưởng row nào đang có.

### 5.2 Module layout

```
src/modules/cover-letters/          MỚI
  cover-letters.controller.ts
  cover-letters.service.ts
  cover-letters.service.spec.ts
  cover-letters.module.ts
  prompt.ts                         dựng prompt + hằng grounding (pure, test được riêng)
  prompt.spec.ts
  dto/create-cover-letter.dto.ts
  dto/update-cover-letter.dto.ts
  dto/list-cover-letters-query.dto.ts
  dto/cover-letter.dto.ts
  i18n-messages.ts                  tLetter(), namespace `coverLetters.*`
src/i18n/{en,vi}/coverLetters.json  MỚI
src/modules/ai/ai.service.ts        SỬA — THÊM method generateCoverLetter(), không đụng code cũ
```

Phụ thuộc: `CoverLetters → {Ai, AiCredentials, Prisma, CurrentUser}`. Không vòng. `AiModule` và `AiCredentialsModule` đều đã export service của chúng (đang được `MatchingModule` dùng).

> **`AiService` chỉ được THÊM, không refactor** — Roadmap #6 đang chạy song song trên cùng file. `generateCoverLetter()` là method mới đứng cạnh `generateReport()`, dùng lại `withTimeout` / `asProviderError` / `AiProviderError` sẵn có. Không đổi chữ ký, không di chuyển gì.

### 5.3 API

Prefix `api/v1`.

| Verb | Path | Body / Query | Trả về |
|---|---|---|---|
| `POST` | `/cover-letters` | `{ matchResultId, tone, length, language, credentialId? }` | `201 CoverLetterDto` (kèm `status`, `errorCode`) |
| `GET` | `/cover-letters?matchResultId=<uuid>` | — | `CoverLetterDto[]`, sort `createdAt desc` |
| `PATCH` | `/cover-letters/:id` | `{ content }` | `CoverLetterDto` (`edited = true`) |
| `DELETE` | `/cover-letters/:id` | — | `204` |

- `GET` **bắt buộc** có `matchResultId` — không có endpoint "mọi lá thư của tôi" vì không có màn nào cần nó; danh sách toàn cục sẽ là một bề mặt đọc không ai dùng.
- `CoverLetterDto` = `id, matchResultId, tone, length, language, content, omittedRequirements, status, errorCode, edited, credentialId, provider, chatModel, createdAt, updatedAt`. **Không field nào chạm key.**
- `PATCH` chỉ nhận `content`. Đổi tone/length/language nghĩa là **sinh lại**, không phải sửa metadata của một văn bản đã có.
- Sửa một row `status=failed` → **400**. Không có nội dung để biên tập.

### 5.4 Luồng `generate`

```ts
// 1. MatchResult phải thuộc user, phải succeeded, và mang theo 2 document.
const match = await this.prisma.matchResult.findFirst({
  where: { id: dto.matchResultId, userId },
  include: { cvDocument: true, jdDocument: true }
});
if (!match) throw new NotFoundException(tLetter("coverLetters.errors.matchNotFound", …));
if (match.status !== MatchStatus.succeeded) {
  // Không strengths thì không có gì để viết, và không có gì để grounding lên.
  throw new BadRequestException(tLetter("coverLetters.errors.matchNotSucceeded", …));
}

// 2. Credential của user, hoặc key hệ thống — ĐÚNG cơ chế của /match.
const runtime = dto.credentialId
  ? await this.credentials.getRuntimeConfig(dto.credentialId)  // 404 nếu không thuộc user
  : this.ai.systemRuntimeConfig();                             // 503 nếu chưa cấu hình

// 3. Sinh. Provider hỏng là KẾT QUẢ của lần chạy này, không phải lỗi của request.
try {
  const { body, omittedRequirements } = await this.ai.generateCoverLetter(input, runtime);
  outcome = { …shared, status: succeeded, content: body, omittedRequirements, errorCode: null };
} catch (error) {
  if (!(error instanceof AiProviderError)) throw error;   // lỗi cấu hình vẫn 503
  outcome = { …shared, status: failed, content: "", omittedRequirements: [], errorCode: error.reason };
}
const created = await this.prisma.coverLetter.create({ data: outcome });

// Dấu audit, cố ý NGOÀI đường ghi kết quả — y hệt createMatch.
if (dto.credentialId) await this.credentials.markUsed(dto.credentialId);
```

### 5.5 Prompt (`prompt.ts`)

Pure function `buildCoverLetterPrompt({ cvText, jdText, strengths, gaps, tone, length, language })` → `{ system, user }`. Tách khỏi service để §4.2 assert được nó mà không cần dựng Nest module.

Khung:

- **system** — vai trò + JSON-only + **nguyên tắc grounding**: mọi khẳng định về ứng viên phải truy được về CV; JD chỉ nói nhà tuyển dụng cần gì, không mô tả ứng viên.
- **user** — theo thứ tự: chỉ thị tone/length/language → `MATCHED STRENGTHS (dùng làm chất liệu chính)` → `MUST NOT CLAIM (CV không chống lưng được — không khẳng định, không ám chỉ)` = `gaps` → `--- JD ---` → `--- CV ---` → shape JSON `{ "body": string, "omittedRequirements": string[] }`.
- Độ dài: `short` ≈ 150–200 từ, `standard` ≈ 300–350 từ (hằng số có tên, không literal rải rác).
- Ngôn ngữ: `vi` → chỉ thị viết **toàn bộ** bằng tiếng Việt (kể cả `omittedRequirements`).
- Text đầu vào bị **cap** bằng hằng riêng của module (`MAX_LETTER_SOURCE_CHARS = 20_000`) — cùng ý đồ `MAX_MATCH_CHARS` nhưng khai riêng để module này không phụ thuộc `matching`.

## 6. Frontend

```
src/views/Wizard/components/CoverLetterModal/index.tsx   MỚI  — modal sinh/sửa/copy/so bản
src/views/Wizard/components/MatchResultCard/index.tsx    SỬA  — thêm nút mở modal (chỉ khi succeeded)
src/requests/coverLetters.ts                             MỚI  — 4 request + query-key factory
src/hooks/useCoverLetters.ts                             MỚI  — list/generate/update/delete
src/hooks/index.ts                                       SỬA  — barrel
src/types/CoverLetters/index.ts                          MỚI
src/constants/endpoints.ts                               SỬA  — 2 key
src/locales/{en,vi}/translation.json                     SỬA  — namespace `coverLetter.*`
```

**Không có SuperDesign mock** (§5 step 1.5 **SKIP**, có chủ ý): feature không dựng màn mới và không sửa lớn màn nào — nó là một modal lắp từ đúng primitive đang có (`SectionCard` khi cần khối, `Modal`/`Form`/`Segmented`/`Input.TextArea`/`Alert`/`Tag` của antd, token semantic theo rule `layout-primitives`). Ngôn ngữ thị giác đã chốt ở `docs/ui-designs/cv-jd-matching-wizard/` + `/ai-credentials`; dựng mock chỉ để tái khẳng định nó là chi phí không đổi lấy quyết định nào.

**Nút vào**: trong `MatchResultCard`, cạnh vùng report, **chỉ hiện khi `result.status === "succeeded"`** — thư sinh từ một report lỗi thì không có chất liệu (khớp chặn 400 ở BE).

**Trong modal**, 3 vùng:

1. **Tuỳ chọn** — `Segmented` cho tone / length / language + `RunWithSelector`-style chọn credential… **không**: dùng lại đúng `Select` một-lựa-chọn đơn giản (một lá thư = một provider), mặc định là credential đã chạy ra `MatchResult` này (`result.credentialId`), fallback "Key hệ thống". Kèm **thông báo quyền riêng tư** nêu đích danh provider sẽ nhận CV/JD (bắt buộc theo `project-goals.md` §7, cùng câu chữ với step 3).
2. **Bản nháp** — `Input.TextArea` chứa `content`, sửa được tại chỗ; **Copy** (clipboard) · **Tải .txt** · **Lưu thay đổi** (`PATCH`, bật khi text khác bản đã lưu) · **Sinh lại**. Dưới đó là khối **"Lá thư này KHÔNG khẳng định"** liệt kê `omittedRequirements` (ẩn khi rỗng) — §4.
3. **Các bản đã sinh** — danh sách row của `GET ?matchResultId=`, mỗi row: tone · length · language · thời gian · `Đã sửa` tag khi `edited`. Click → nạp vào vùng 2. Xoá từng bản. Bản `failed` hiện `errorCode` đã dịch + nút Sinh lại; **không** hiện như một lá thư rỗng.

**Mutation**: dùng `mutateAsync` + `try/catch` (callback `onSuccess`/`onError` truyền vào `mutate(vars, {…})` đã được ghi nhận là **không kích hoạt** trong codebase này — xem `MatchResultCard.fire()`).

### API contract — BE DTO ↔ FE type

| BE `CoverLetterDto` | FE `CoverLetterDto` (`#/types/CoverLetters`) |
|---|---|
| `id, matchResultId: string` | idem |
| `tone: CoverLetterTone` | `"formal" \| "friendly"` |
| `length: CoverLetterLength` | `"short" \| "standard"` |
| `language: CoverLetterLanguage` | `"en" \| "vi"` |
| `content: string` | idem |
| `omittedRequirements: string[]` | `Array<string>` |
| `status: CoverLetterStatus` | `"succeeded" \| "failed"` |
| `errorCode: string \| null` | `MatchErrorCode \| null` (tái dùng union đã có ở `#/types/Matching`) |
| `edited: boolean`, `credentialId: string \| null`, `provider: AiProvider`, `chatModel: string` | idem |
| `createdAt/updatedAt: Date` | `string` (ISO) |
| body `POST` | `GenerateCoverLetterInput = { matchResultId, tone, length, language, credentialId? }` |
| body `PATCH` | `UpdateCoverLetterInput = { content }` |

## 7. Bất biến bảo mật (là acceptance criteria)

1. **Per-user isolation** — mọi query đi qua `findFirst({ where: { id, userId } })` với `userId` từ `CurrentUserService`. `GET` list filter theo cả `userId` **và** `matchResultId`; `matchResultId` của người khác trả **mảng rỗng**, không phải 403 (không tiết lộ sự tồn tại).
2. **Key không bao giờ rời tầng service** — nối tiếp bất biến của `ai-credentials`. `CoverLetterDto` chỉ mang `credentialId` + `provider` + `chatModel`.
3. **`errorCode` là enum đóng**, không bao giờ là message thô của provider (message có thể echo lại key). Dùng lại `AiProviderError.reason` đã phân loại.
4. **Không log body lỗi provider** — `catch` giữ nguyên dạng `catch { throw … }` như `AiService` hiện tại.
5. **Ràng buộc input** (khớp giá trị BVA ở §8 row 6):
   - `matchResultId`, `credentialId` — `@IsUUID()` (`credentialId` thêm `@IsOptional()`).
   - `tone` / `length` / `language` — `@IsEnum(...)`, bắt buộc. Không có "mặc định ngầm" ở BE: FE luôn gửi tường minh, nên một giá trị thiếu là bug chứ không phải ý định.
   - `content` (PATCH) — `@IsString() @Length(1, 20000)`. Cận trên khớp cap nguồn; lá thư dài hơn 20k ký tự là dán nhầm cả CV vào.
6. **Render plain text** — `content` vào `Input.TextArea` / `<p className="whitespace-pre-wrap">`, **không** `dangerouslySetInnerHTML`, không markdown renderer. D8 khiến điều này thành mặc định chứ không phải kỷ luật.
7. **Throttle** `POST /cover-letters` = 10/phút (D9).
8. **Clipboard** — dùng `navigator.clipboard.writeText`; không có ở môi trường không secure-context → fallback chọn text + báo cho user, không nuốt lặng.

## 8. E2E Scenario Matrix

Gate mặc định `A+B`; scenario mutation-heavy ghi `A only`. **Gate B (MCP walk) KHÔNG chạy ở lượt này** — ghi lại ở `e2e.md`, cùng cách `ai-credentials` và `multi-provider-compare` đã ghi.

| # | Category | Trạng thái | Scenario + giá trị dẫn xuất | Gate |
|---|---|---|---|---|
| 1 | Happy path | ✅ | (a) Step 4 với card `succeeded` → nút "Write cover letter" hiện → mở modal. (b) Chọn `formal` + `standard` + `en` → Generate → thân thư hiện trong ô sửa được, và **các bản đã sinh** có đúng 1 dòng. (c) Sinh bản thứ hai `friendly`/`short`/`vi` → danh sách có **2** dòng, click dòng cũ nạp lại đúng nội dung cũ → **đây là "so nhiều bản" mà D1 tồn tại để phục vụ**. (d) Copy → clipboard chứa đúng `content`. | (a)(d) A+B · (b)(c) A only |
| 2 | AuthN | N/A | Chưa có auth — app chạy như đã đăng nhập bằng mock user (`project-goals.md` §3). Không có màn login để test redirect/401. Thành ✅ ở Roadmap #10. | — |
| 3 | AuthZ | N/A ở E2E FE | Không có phân quyền theo role. Per-user isolation (`matchResultId`/`coverLetterId` của user khác) **không** dựng được qua FE vì chỉ tồn tại một mock user → cover ở BE e2e `cover-letters.e2e-spec.ts` (§9). | — |
| 4 | Validation | ✅ | **[EP]** `content` khi PATCH: `hợp lệ` · `rỗng` (nút Lưu disabled, **không** bắn request) · `chỉ khoảng trắng` (idem) · `20_001 ký tự` (chặn client). **[EP]** `matchResultId`: `succeeded` (cho phép) · `failed` (nút không hiện ở FE; BE trả **400**) · `không tồn tại` (404) · `không phải uuid` (400 từ `ParseUUIDPipe`). **[DT]** hai điều kiện cùng sai: `matchResult failed + credentialId của người khác` → assert **400 của matchResult thắng** (kiểm tra ngữ cảnh chạy trước khi phân giải credential) và **không** row nào được tạo; `matchResult hợp lệ + credentialId của người khác` → 404, **không** row nào được tạo. | A only |
| 5 | Empty / null | ✅ | Chưa sinh bản nào → danh sách hiện empty state có nghĩa (không phải bảng trắng). `omittedRequirements = []` → khối "KHÔNG khẳng định" **ẩn hẳn**, không phải một hộp rỗng. Bản `failed` → `content` rỗng **không** được vẽ như một lá thư trắng mà là trạng thái lỗi. `errorCode = null` trên bản thành công → không render "null". | A+B |
| 6 | Boundary | ✅ | **[BVA]** `content` PATCH: `0` (reject) · `1` (accept) · `20_000` (accept) · `20_001` (reject). **[BVA]** số bản đã sinh: `0` (empty state) · `1` (danh sách hiện, không có gì để so) · `2` (biên bật giá trị so sánh — chuyển qua lại giữ nguyên nội dung từng bản). Không phân trang (số bản của một match là hàng đơn vị) → phần pagination **N/A**. | A only |
| 7 | Filter / search | N/A | Modal không có filter/search/sort. Danh sách sort cố định `createdAt desc`; `matchResultId` không phải filter do user chọn mà là ngữ cảnh của modal, không cần persist vào URL. | — |
| 8 | Data rendering | ✅ | `tone`/`length`/`language` enum → nhãn người đọc ("Formal", "Short", "Tiếng Việt"), **không** phải chuỗi enum thô. `provider` enum → nhãn qua `useProviders()`. `errorCode` → câu người đọc được, không phải `no_quota`. `createdAt` → thời gian đã format theo locale, không phải ISO. `content` render **plain text** — chuỗi `**bold**` hiện đúng nguyên văn, không thành đậm. `omittedRequirements` render đủ từng mục. **Assert DOM không chứa key gốc.** | A+B |
| 9 | i18n | ✅ | Render **cả `en` và `vi`** cho: nhãn nút vào, tiêu đề modal, 3 nhóm `Segmented` (6 nhãn), thông báo quyền riêng tư, tiêu đề khối "KHÔNG khẳng định", 4 nhãn action (Copy / Tải .txt / Lưu / Sinh lại), empty state, tag `Đã sửa`, **cả 5 thông điệp `errorCode`**. Bắt lỗi thiếu key dịch. ***Lưu ý phân biệt***: `language` là **ngôn ngữ của lá thư**, độc lập với ngôn ngữ UI — assert đổi UI sang `vi` **không** đổi `language` đã chọn. | A+B |
| 10 | Error / loading | ✅ | `POST /cover-letters` trả row `status=failed` + `errorCode=no_quota` → modal hiện lỗi đã dịch + nút Sinh lại, **không** crash, **không** hiện lá thư rỗng. `GET ?matchResultId=` trả 500 → error UI thay vì danh sách trắng. `PATCH` trả 500 → báo lỗi và **giữ nguyên** text user đang gõ (không revert mất công sức). Đang sinh → nút ở trạng thái loading + vùng nháp `aria-busy`. | A+B (route interception) |
| 11 | Mutation safety | ✅ | **[ST]** vòng đời: `sinh` → `sửa tay + Lưu` (`edited` = true, tag hiện) → `sinh bản mới` (bản cũ **còn nguyên**, không bị ghi đè) → `xoá bản cũ` (bản đang mở không bị mất nếu không phải nó). **Invalid transition (bắt buộc)**: xoá bản đang mở ở danh sách → vùng nháp phải **về trạng thái rỗng có nghĩa**, không giữ nội dung của một row đã chết rồi cho PATCH lên id không còn tồn tại (assert không có PATCH nào được bắn, hoặc 404 được hiển thị). **Double-submit**: bấm Generate 2 lần thật nhanh → chỉ **1** `POST` (nút disable khi pending). Mọi row tạo trong test bị xoá ở `afterAll`. | A only |
| 12 | Accessibility | ✅ | Modal: focus vào control đầu khi mở, `Esc` đóng, focus trả về nút đã kích hoạt. Ba `Segmented` có accessible name liên kết (chọn bằng `getByRole`/`getByLabel`, không phải CSS selector). Ô soạn thư có label. Vùng nháp `aria-busy` khi đang sinh, `aria-live="polite"` để báo thư đã xong. Thứ tự tab: tuỳ chọn → Generate → ô soạn → action. | A+B |

**Error-guessing pass** (làm inline — người dùng không yêu cầu bản "thorough" nên không dispatch subagent critic): đã gộp vào matrix — double-submit Generate (row 11), xoá bản đang mở (row 11), PATCH lỗi làm mất text đang gõ (row 10), lá thư chứa markup bị diễn giải (row 8), `omittedRequirements` rỗng vẽ thành hộp trống (row 5), đổi ngôn ngữ UI bị nhầm với ngôn ngữ lá thư (row 9), và bản `failed` bị vẽ như thư trắng (row 5 + 10).

## 9. Kiểm thử

**BE unit**
- `prompt.spec` — **grounding là nội dung chính**: mọi `gap` xuất hiện dưới nhãn cấm; `strengths` có mặt; chỉ thị "chỉ khẳng định điều truy được về CV" có mặt; `vi` sinh chỉ thị tiếng Việt; `short`/`standard` sinh khoảng từ khác nhau; text nguồn bị cap ở `MAX_LETTER_SOURCE_CHARS`.
- `cover-letters.service.spec` — ownership (404); `MatchResult` `failed` → 400; provider lỗi → row `failed` + `errorCode` đúng và **không ném**; `credentialId` truyền → dùng `getRuntimeConfig`, không truyền → `systemRuntimeConfig`; `markUsed` được gọi khi và chỉ khi có `credentialId`; PATCH set `edited = true`; PATCH lên row `failed` → 400; **assert DTO không chứa field nào của credential ngoài `credentialId`**.
- `ai.service.spec` — `generateCoverLetter` parse JSON đúng; `omittedRequirements` không phải mảng → `[]`; JSON hỏng → `model_unavailable`; lỗi HTTP → `AiProviderError` phân loại đúng (dùng lại `mapProviderError`).

**BE e2e** — `test/cover-letters.e2e-spec.ts`: sinh → list → patch → delete đầy đủ; 404 với `matchResultId`/`id` của user khác (**đây là nơi cover row 3**); `GET` với `matchResultId` người khác → `[]`; 400 khi match `failed`; và một assertion đọc **toàn bộ response body dạng chuỗi** để chắc chắn không chứa key gốc. SDK `openai` được mock — không có network thật.

**FE unit (Vitest)** — `CoverLetterModal`: render tuỳ chọn + empty state; khối `omittedRequirements` ẩn khi rỗng / hiện khi có; bản `failed` render lỗi chứ không phải thư rỗng; nút Lưu disabled khi `content` rỗng hoặc chưa đổi; chuyển giữa 2 bản giữ đúng nội dung. `MatchResultCard`: nút chỉ hiện khi `succeeded`.

**FE E2E (Playwright)** — một test cho mỗi row ✅ ở §8, tại `client/e2e/cover-letter-generator/`. Provider thật chặn bằng route interception (**glob** `**/api/v1/cover-letters**` — regex neo `$` trên path cố định đã được ghi nhận là không intercept được). Chạy **toàn bộ** project `desktop` để bắt hồi quy lên các spec cũ.

## 10. Thay đổi ngoài code

- `docs/erd.md` — thêm `CoverLetter` + 4 enum; mục "Generated content 📝" chuyển từ *chưa thiết kế* sang *đã chốt cho 7b* (giữ 7a mở); cập nhật bảng trạng thái implement.
- `docs/project-goals.md` — §12 **xoá open question** *"Cover letter có cần lưu lịch sử… hay chỉ generate-and-copy?"* (đã chốt: D1) và ghi lại quyết định ở §6.4; Roadmap #8 đổi trạng thái; §6.4 nêu rõ "tuỳ chọn" nghĩa là **xoá được**, không phải "không lưu".
- `server/README.md` — 4 endpoint mới + ghi chú hợp đồng D4 (provider lỗi → 201 + `status=failed`, không 503).
- `.env` — **không thêm biến mới**. Feature chạy hoàn toàn trên `OPENROUTER_*` + `CREDENTIAL_ENCRYPTION_KEY` đã có.
