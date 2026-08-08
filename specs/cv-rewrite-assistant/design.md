# Design — `cv-rewrite-assistant` (Roadmap #6, Goal 7a)

> Brainstorm 2026-08-09 qua `superpowers:brainstorming`.
> Hiện thực `project-goals.md` §6.3. Nền đã có sẵn từ 2 feature gần nhất: `AiRuntimeConfig` dựng **per-request**, `getRuntimeConfig(credentialId)` cho BYO key, `MatchResult` snapshot `provider`/`chatModel` (xem `specs/ai-credentials/design.md` §10 — nó đã nói trước rằng Roadmap #6 "tiêu thụ đúng `AiRuntimeConfig` mà feature này dựng, thay vì tự đọc env").
> Ràng buộc gốc: **ADR #13** (grounded, cấm bịa, user duyệt từng thay đổi, không ghi đè CV gốc) + **ADR #15** (lineage bằng `Document.parentId`, `ON DELETE SET NULL`).

## 1. Vấn đề & phạm vi

Hôm nay app **nói** user nên sửa gì (`report.gaps` + `report.suggestions` ở step 4) rồi dừng. User phải tự dịch một câu như *"CV chưa nêu rõ kinh nghiệm CI/CD"* thành một dòng cụ thể trong CV của họ. Goal 7a là **sửa hộ** — nhưng để user giữ quyền quyết định cuối.

Từ một `MatchResult` đã có → sinh **đề xuất chỉnh sửa CV** đóng các `gaps`, hiển thị dạng **diff so với bản gốc**, user **duyệt từng thay đổi**, phần đã duyệt được lưu thành một **`Document` mới** (`kind=CV`) trỏ về bản gốc qua `parentId`.

### Trong phạm vi

- Cột `Document.parentId` (self-FK, `ON DELETE SET NULL`) — mảnh 📝 cuối cùng của ERD cho Goal 9.
- Module BE `cv-rewrite`: `POST /cv-rewrite` (sinh đề xuất) + `POST /cv-rewrite/accept` (lưu bản đã duyệt).
- **Ràng buộc grounding kiểm tra được bằng máy** (§3) — không chỉ là một câu trong prompt.
- Trang FE `/cv-rewrite/$matchResultId`: chọn key để chạy + thông báo quyền riêng tư → sinh → duyệt từng thay đổi → lưu thành CV mới.
- Điểm vào: nút trên card kết quả ở wizard step 4 **và** từ match history (mở lại kết quả cũ → cùng card đó).
- Sửa đường "mở lại kết quả cũ từ Home" đang hỏng (§4.4) — không có nó thì một trong hai điểm vào §6.3 không tồn tại.

### Ngoài phạm vi (cố ý)

| Hoãn | Lý do |
|---|---|
| Cover letter (Goal 7b) | Roadmap #8, feature riêng. Dùng lại cùng hạ tầng `AiRuntimeConfig`, nhưng UX (tone/độ dài/ngôn ngữ, edit tại chỗ) không có gì chung với diff-và-duyệt. |
| Màn so sánh v1↔v2, delta điểm | **Goal 9 / Roadmap #7**, cố ý nằm ngay sau feature này. Ở đây chỉ dựng `parentId` để Goal 9 có cái mà đọc. |
| Chạy lại match cho CV mới ngay tại chỗ | Wizard đã làm được việc đó; nhét thêm vào trang rewrite là dựng hai đường cho cùng một hành động. |
| Chuẩn hoá `Document.parsedContent` | Xem §2 — đây là quyết định thiết kế phải cân, không phải mục bỏ qua. |
| Sinh nhiều phương án rewrite để so | Cost 1 chat call / lần. Nhiều phương án nghĩa là nhiều lần gửi CV ra ngoài cho một giá trị chưa ai đòi. |
| Sửa tay nội dung đề xuất trong trình duyệt | §6 chốt step Review read-only; cho sửa tay ở đây sẽ mở lại đúng câu hỏi đó, và làm hỏng bất biến grounding (§3) vì text sửa tay không còn anchor nào để kiểm. |
| Lưu lịch sử các bản đề xuất chưa duyệt | ADR #13: output là **đề xuất**, chỉ thành dữ liệu thật khi user duyệt. Xem D2. |

## 2. Quyết định bắt buộc — `parsedContent` hay không?

`erd.md` ghi `Document.parsedContent` (jsonb) nhưng `unfinished-features.md` #2 nói rõ: cột có trong schema, **luôn ghi `null`**, và nó "đang chặn … diff theo section của Goal 7". §12 Open Questions cũng hỏi *"Diff CV hiển thị ở mức nào — dòng, câu, hay section?"*. Phải chốt.

### Hai phương án

**(a) Chuẩn hoá `parsedContent` trước, rồi diff theo section.**

- Việc thật phải làm: chốt schema section cho CV (skills / experience / education / summary) → viết parser điền vào (heuristic regex hay thêm **một call AI nữa** mỗi lần upload) → backfill mọi `Document` đã có → rồi mới tới feature này.
- Blast radius: đường ghi `Document` là đường **mọi** feature đang đi qua (upload/paste ở wizard step 1–2, library, toàn bộ E2E suite hiện có). Một parser mới ở đó làm rung cả 96 test E2E đang xanh.
- Rủi ro chất lượng: CV thật không có cấu trúc ổn định. Parser heuristic sẽ chia section sai với CV 2 cột, CV tiếng Việt, CV xuất từ Canva; parser bằng AI thì thêm một call AI cho **mọi** lần upload — kể cả upload không bao giờ đem đi rewrite.
- Cái nó mua được: diff hiển thị theo section, và mở khoá mục #4 `unfinished-features.md` (skill-level overlap).

**(b) Diff ở mức toàn văn `rawText`, không đụng `parsedContent`.**

- Đề xuất trả về **một danh sách thay đổi có neo** (anchored changes), mỗi thay đổi = `{ original, replacement, rationale, addressesGap }`, trong đó `original` là **một đoạn trích nguyên văn** từ `rawText` của CV gốc.
- Duyệt-từng-thay-đổi rơi ra tự nhiên: mỗi phần tử trong danh sách là một checkbox.
- Không đụng đường ghi `Document`; `parsedContent` giữ nguyên `null`.

### Chọn (b). Lý do.

1. **Cái feature này thật sự cần không phải "section", mà là "neo".** Yêu cầu là *duyệt từng thay đổi*. Một thay đổi cần biết nó **thay chỗ nào** trong văn bản gốc — đó là một khoảng ký tự, không phải một tên section. Section-level diff thậm chí còn **thô hơn** mức cần: duyệt cả khối "Experience" một lần là mất đúng cái quyền kiểm soát chi tiết mà ADR #13 đòi.

2. **Neo là thứ biến ADR #13 từ lời dặn trong prompt thành ràng buộc kiểm tra được bằng máy.** `original` phải xuất hiện **nguyên văn và duy nhất** trong `rawText` của CV gốc, nếu không server **loại thay đổi đó** trước khi trả về (và loại lần nữa lúc accept). Một "kinh nghiệm" bịa ra không có chỗ nào trong CV để neo vào → không tồn tại được dưới dạng một thay đổi hợp lệ. Với phương án (a), model trả về nguyên một section mới và ta không có mốc nào để đối chiếu ngoài việc đọc bằng mắt. **Phương án rẻ hơn lại là phương án an toàn hơn** — đó là lý do chính.

3. **Goal 9 không cần `parsedContent`.** Đọc lại §6.6 + ADR #15: Goal 9 cần **lineage** (`parentId`) và **cùng một JD** do user chọn, rồi so `overallScore` / `semanticScore` / `keywordScore` + gap đã đóng / còn / mới. Cả ba con số đó tính từ `rawText` + engine hiện có. Không có dòng nào của Goal 9 đọc `parsedContent`. Vậy "làm (a) trước cho Goal 9 đỡ khổ" là một lập luận sai — nó không mua gì cho Goal 9 cả.

4. **Ai thật sự cần `parsedContent` thì vẫn đang chờ đúng chỗ cũ.** Consumer duy nhất còn lại là `unfinished-features.md` #4 (skill-level overlap) — mục mà chính file đó xếp **ưu tiên thấp nhất bảng** và ghi "không chặn Goal nào". Kéo một schema jsonb + parser + backfill vào feature này là để một mục ưu tiên thấp nhất quyết định thiết kế của một mục đang trong roadmap.

5. **Chốt được open question mà không đóng cửa tương lai.** `parsedContent` vẫn `null`, cột vẫn còn, `unfinished-features.md` #2 vẫn mở — chỉ **mất một lý do** trong danh sách "đang chặn" của nó. Nếu sau này skill-level overlap được làm, diff hiện tại không phải viết lại: neo theo ký tự vẫn đúng, chỉ có thể thêm nhãn section vào mỗi thay đổi.

**Cái mất, nói thẳng**: diff không nhóm được theo section, nên với CV dài user sẽ thấy một danh sách phẳng 5–15 thay đổi. Giảm nhẹ bằng `sectionHint` — một nhãn **do model gợi ý** (`"Experience"`, `"Skills"`, …) đi kèm mỗi thay đổi, dùng **chỉ để hiển thị/nhóm**, không tham gia bất kỳ phép kiểm nào. Nhãn sai thì xấu chứ không sai dữ liệu.

→ Chốt vào `project-goals.md` §12 (đóng câu hỏi *"diff ở mức nào"*) + `unfinished-features.md` #2.

## 3. Bất biến grounding — cách ADR #13 được **thi hành**, không chỉ được dặn

Ba tầng, độc lập nhau. Tầng 1 là lời dặn; tầng 2 và 3 là code, có unit test, và chạy ở server.

**Tầng 1 — prompt.** System + user prompt cấm tường minh: *chỉ được diễn đạt lại / làm nổi bật nội dung ĐÃ CÓ; TUYỆT ĐỐI không thêm nhà tuyển dụng, chức danh, mốc thời gian, bằng cấp, chứng chỉ, công cụ hay kỹ năng không xuất hiện trong CV; `original` phải sao chép nguyên văn từ CV; gap nào không đóng được nếu không bịa thì bỏ vào `unaddressedGaps`.*

**Tầng 2 — lọc theo neo, lúc sinh đề xuất.** Với mỗi thay đổi model trả về, server tìm `original` trong `rawText` của CV (so khớp có bỏ qua khác biệt khoảng trắng, §4.3). **Loại bỏ** thay đổi nếu:

- `original` rỗng, hoặc ngắn hơn `MIN_ANCHOR_CHARS` (neo quá ngắn thì mơ hồ);
- `original` **không** tìm thấy → model đã bịa ra một đoạn CV không có;
- `original` tìm thấy **nhiều hơn 1 lần** → không xác định được thay ở đâu, và một thay đổi mơ hồ là một thay đổi user không duyệt được chính xác;
- neo **chồng lấn** với neo của một thay đổi đã nhận (áp cả hai sẽ làm hỏng văn bản);
- `replacement` dài hơn `MAX_REPLACEMENT_CHARS`, hoặc dài hơn `REPLACEMENT_GROWTH_FACTOR` lần `original` — *diễn đạt lại một gạch đầu dòng không biến nó thành bốn đoạn văn*; vượt ngưỡng đó là model đang **viết mới** chứ không viết lại.

Số thay đổi trả về cắt ở `MAX_CHANGES`.

**Tầng 3 — kiểm lại lúc accept.** Client gửi lại đúng tập thay đổi user đã tick. Server **không tin** payload đó: nạp lại CV gốc từ DB, chạy lại y hệt tầng 2 (neo tồn tại, duy nhất, không chồng lấn, trong giới hạn kích thước). Sai bất kỳ điều nào → **400**, không tạo `Document` nào. Nghĩa là: kể cả có ai gọi thẳng API và nhét văn bản tự chế vào `replacement`, thì phần **được giữ nguyên** của CV vẫn là CV thật, và mọi thay đổi vẫn phải neo vào một đoạn có thật.

**Thêm/xoá được biểu diễn thế nào.** Mọi thay đổi đều có neo — không có thao tác "chèn tự do".

- *Sửa* — `original` → `replacement` khác.
- *Thêm* — mở rộng một neo có sẵn (`replacement` = `original` + phần thêm). Đây là chủ ý: nội dung mới **buộc phải mọc ra từ** một dòng có thật, và user thấy nó nằm cạnh dòng gốc lúc duyệt.
- *Bỏ* — `replacement` rỗng.

**Cái KHÔNG chặn được, nói thẳng.** Không tầng nào bắt được **bịa ở mức ngữ nghĩa**: model hoàn toàn có thể lấy neo `"Xây dựng API bằng Node.js"` và đề xuất `"Xây dựng API bằng Node.js và Kubernetes"` trong khi user chưa từng đụng Kubernetes. Ba thứ giảm rủi ro đó: (1) prompt cấm; (2) **mỗi thay đổi hiện nguyên văn cạnh bản gốc và mặc định KHÔNG được chọn** — user phải chủ động tick từng cái, nên nội dung bịa muốn vào CV thì phải đi qua mắt user; (3) `unaddressedGaps` được render thành một khối riêng nói rõ *"những gap này cần kinh nghiệm thật, hệ thống KHÔNG tự điền"*. Đây là ranh giới đúng của ADR #13: hệ thống chịu trách nhiệm **không lén thêm gì**, user chịu trách nhiệm **duyệt cái mình ký tên**.

### Cách feature này được verify

| Bất biến | Verify bằng |
|---|---|
| Neo bịa bị loại lúc sinh | `grounding.spec.ts` — `original` không có trong CV → không nằm trong output |
| Neo mơ hồ bị loại | `grounding.spec.ts` — `original` xuất hiện 2 lần → loại |
| Neo chồng lấn bị loại | `grounding.spec.ts` — 2 thay đổi cùng đè lên một khoảng → giữ 1 |
| Phình quá cỡ bị loại | `grounding.spec.ts` — `replacement` = 5× `original` → loại **[BVA]** |
| Accept không tin client | `cv-rewrite.service.spec.ts` — accept với `original` không có trong CV → 400, `prisma.document.create` **không** được gọi |
| CV gốc không bị ghi đè | `cv-rewrite.service.spec.ts` + BE e2e — sau accept, `rawText` của document gốc **byte-for-byte không đổi**, và bản mới là row khác có `parentId` trỏ về nó |
| Phần không được duyệt không lọt vào | `grounding.spec.ts` — áp 1/3 thay đổi → 2 đoạn kia còn nguyên văn trong kết quả |
| E2E | `client/e2e/cv-rewrite-assistant/grounding.e2e.ts` — đề xuất có 1 thay đổi neo bịa → UI **không** hiển thị nó (§7 row 4) |

## 4. Backend

### 4.1 Schema — migration `add_document_parent`

```prisma
model Document {
  // …
  parentId String?
  parent   Document?  @relation("DocumentLineage", fields: [parentId], references: [id], onDelete: SetNull)
  children Document[] @relation("DocumentLineage")

  @@index([userId, kind])
  @@index([parentId])
}
```

- `ON DELETE SET NULL` đúng ADR #15: xoá CV gốc **không được** kéo theo bản cải tiến, chỉ mất liên kết.
- Nullable — mọi document đã có là bản gốc, không cần backfill.
- `seed.ts` không đổi.
- `client/e2e/db-cleanup.ts` không cần sửa: self-FK `SET NULL` nên `DELETE FROM "Document"` vẫn chạy.
- `DocumentDto` thêm `parentId: string | null` — Goal 9 sẽ đọc, và nó là bằng chứng nhìn thấy được rằng lineage đã được ghi.

**Không thêm model `GeneratedContent`** — chốt phương án **(a)** của `erd.md` §"Generated content 📝":

| | |
|---|---|
| Vì sao không lưu bản đề xuất | ADR #13 nói output "chỉ thành dữ liệu thật khi user duyệt". Lưu mọi đề xuất chưa duyệt là **lưu thêm một bản sao CV** (PII) cho một thứ user có thể không bao giờ nhận — đi ngược Goal 10 vừa mới đặt ra chủ quyền dữ liệu. |
| Cái mất mà `erd.md` đã cảnh báo | *"mất truy vết bản này sinh ra từ match nào"*. Chấp nhận, vì consumer duy nhất được biết là Goal 9, mà Goal 9 (§6.6) so **2 phiên bản CV trên một JD do user chọn** — nó cần `parentId` + JD, không cần con trỏ ngược về `MatchResult`. Thêm `Document.sourceMatchResultId` bây giờ là thêm cột cho một nhu cầu chưa ai có. |
| Reload giữa chừng | Mất đề xuất, phải bấm sinh lại (tốn 1 chat call). Chấp nhận: khác `multi-provider-compare` — ở đó **kết quả** là sản phẩm cuối nên phải bền; ở đây sản phẩm cuối là **`Document` sau khi duyệt**, và nó được lưu hẳn hoi. |

### 4.2 Module layout

```
src/modules/cv-rewrite/           MỚI
  cv-rewrite.controller.ts
  cv-rewrite.service.ts
  cv-rewrite.service.spec.ts
  cv-rewrite.module.ts
  grounding.ts                    hàm THUẦN: findAnchor / groundChanges / applyChanges
  grounding.spec.ts
  i18n-messages.ts                tRewrite(), namespace `cvRewrite.*`
  dto/generate-cv-rewrite.dto.ts
  dto/accept-cv-rewrite.dto.ts
  dto/cv-rewrite-change.dto.ts
  dto/cv-rewrite-proposal.dto.ts

src/modules/ai/ai.service.ts      SỬA — thêm generateCvRewrite(cvText, jdText, gaps, suggestions, cfg)
src/i18n/{en,vi}/cvRewrite.json   MỚI
src/app.module.ts                 SỬA — đăng ký CvRewriteModule
```

Đồ thị phụ thuộc vẫn một chiều: `CvRewrite → {Ai, AiCredentials}` (giống `Matching`). `grounding.ts` là hàm thuần, không phụ thuộc Nest — cùng kiểu với `tokenizer.ts` của matching, và cùng lý do: đây là phần **đáng test kỹ nhất** của feature nên nó phải test được mà không dựng module.

### 4.3 `grounding.ts` — hàm thuần

```ts
const MIN_ANCHOR_CHARS = 12;          // neo ngắn hơn thì mơ hồ, dễ trùng
const MAX_CHANGES = 25;               // chặn payload + chặn "viết lại cả CV"
const MAX_REPLACEMENT_CHARS = 1_500;
const REPLACEMENT_GROWTH_FACTOR = 4;  // viết lại 1 gạch đầu dòng ≠ 4 đoạn văn
```

- `findAnchor(cvText, original): { start, end } | null` — so khớp **bỏ qua khác biệt khoảng trắng**: chuẩn hoá cả hai về "mọi chuỗi whitespace → 1 space" kèm bảng ánh xạ chỉ số ngược về văn bản gốc, rồi `indexOf`. Trả `null` khi không thấy **hoặc thấy >1 lần**.
  > Vì sao phải bỏ qua whitespace: parser PDF/DOCX sinh xuống dòng và khoảng trắng không ổn định, còn model gần như luôn chuẩn hoá lại khi chép. So khớp byte tuyệt đối sẽ loại gần hết thay đổi **hợp lệ** — bất biến vẫn giữ nguyên (nội dung phải có thật), chỉ nới đúng phần định dạng.
- `groundChanges(cvText, raw[]): CvRewriteChange[]` — áp toàn bộ luật loại bỏ ở §3 tầng 2, giữ thứ tự theo vị trí neo trong CV (đọc từ trên xuống đúng như đọc CV).
- `applyChanges(cvText, accepted[]): string` — resolve neo, sắp giảm dần theo `start`, splice; ném lỗi domain nếu có neo hỏng/chồng lấn (accept mới gọi tới nhánh này).

### 4.4 API

| Verb | Path | Body | Trả về |
|---|---|---|---|
| `POST` | `/cv-rewrite` | `{ matchResultId, credentialId? }` | `201 CvRewriteProposalDto` |
| `POST` | `/cv-rewrite/accept` | `{ matchResultId, title, changes: [{ original, replacement }] }` | `201 DocumentDto` |

`CvRewriteProposalDto` = `{ matchResultId, cvDocumentId, cvTitle, provider, chatModel, changes: CvRewriteChangeDto[], unaddressedGaps: string[] }`
`CvRewriteChangeDto` = `{ id, sectionHint, original, replacement, rationale, addressesGap }` — `id` là chỉ số ổn định trong phạm vi một đề xuất (đề xuất không được lưu nên không cần id toàn cục).

Luật:

- `matchResultId` phải thuộc user (`findFirst({ id, userId })`) → **404** nếu không.
- `status = failed` → **400** `cvRewrite.errors.matchFailed`: một match lỗi không có `gaps` nào để đóng.
- `credentialId` bỏ trống = key hệ thống; có thì `getRuntimeConfig` (404 nếu không thuộc user, 503 nếu thiếu khoá mã hoá) — **dùng lại nguyên đường của `/match`**, không có nhánh mới nào cho secret.
- Provider hỏng → `AiProviderError` → **503**. *Không* mượn hợp đồng D3 của `multi-provider-compare` (lưu row `failed`): ở đó phải lưu vì có N card song song và reload phải thấy cái nào chết; ở đây chỉ có một lời gọi đồng bộ, không có gì để lưu, và không có row nào bị tạo ra.
- `POST /cv-rewrite` gắn `@Throttle` chặt hơn global (**10 req/phút**) — mỗi lần gọi là một chat call trên key của user, và là một lần CV rời hệ thống.
- `POST /cv-rewrite/accept` **không** gọi AI → giữ throttle global.
- Accept: `title` `@IsString() @Length(1, 200)` (khớp `Document.title` hiện có), `changes` `@ArrayMinSize(1) @ArrayMaxSize(MAX_CHANGES)`, mỗi phần tử `original` `@IsString() @Length(1, 5000)`, `replacement` `@IsString() @Length(0, 1500)` (**rỗng hợp lệ = xoá đoạn đó**).
- Document mới: `kind=CV`, `sourceFormat=text`, `isSaved=true`, `parentId = <cv gốc>`, `fileData/fileMime = null` (bản viết lại là text, không có file gốc — và **không** copy `fileData` của CV cha, vì file PDF cũ không còn khớp nội dung mới, giữ lại sẽ là một bản tải về nói dối).
- Kết quả áp thay đổi mà rỗng/trắng → **400** `cvRewrite.errors.emptyResult`.

### 4.5 Prompt (`AiService.generateCvRewrite`)

Cùng khuôn với `generateReport`: `response_format: json_object`, `withTimeout`, `catch → asProviderError`, **không log body lỗi của provider** (bất biến §5.3 của `ai-credentials`).

```
system: You are a CV editing assistant. You may ONLY rephrase, reorder or emphasise
        content that ALREADY EXISTS in the CV. You must NEVER invent employers, job
        titles, dates, degrees, certifications, tools or skills that do not already
        appear in the CV. Respond ONLY with JSON.

user:   <JD> · <CV> · <gaps từ report> · <suggestions từ report>
        Return { "changes": [ { "sectionHint", "original", "replacement",
                                "rationale", "addressesGap" } ],
                 "unaddressedGaps": [string] }.
        "original" MUST be copied character-for-character from the CV.
        If a gap cannot be closed without inventing facts the candidate does not
        have, DO NOT attempt it — list it in "unaddressedGaps".
```

`cvText`/`jdText` đi qua `capForMatch()` đang có (20k ký tự) — cùng cận cost/latency với `/match`, và tái dùng đúng constant thay vì đẻ ngưỡng thứ hai.

### 4.6 Sửa ngoài module (BE)

Không có. `documents.service.remove` giữ nguyên: nó chặn xoá khi document bị `MatchResult` tham chiếu; quan hệ lineage là `SET NULL` nên không thêm ràng buộc xoá nào.

## 5. Frontend

```
src/routes/_app/cv-rewrite.$matchResultId.tsx    MỚI — route mỏng
src/views/CvRewrite/index.tsx                    MỚI — shell
src/views/CvRewrite/mains/RewriteReview/         MỚI — sinh → danh sách thay đổi → footer lưu
src/views/CvRewrite/components/ChangeCard/       MỚI — 1 thay đổi: gốc ↔ đề xuất + checkbox
src/views/CvRewrite/components/RewriteRunWith/   MỚI — chọn 1 key + thông báo quyền riêng tư
src/views/CvRewrite/components/SaveRewriteModal/ MỚI — đặt tên CV mới
src/requests/cvRewrite.ts                        MỚI
src/hooks/useCvRewrite.ts                        MỚI
src/types/CvRewrite/index.ts                     MỚI
src/views/Wizard/components/MatchResultCard/     SỬA — nút "Improve my CV"
src/views/Wizard/mains/StepResult/               SỬA — đường mở lại 1 kết quả cũ (§5.3)
src/types/Documents/index.ts                     SỬA — + parentId
src/constants/endpoints.ts                       SỬA — + cvRewrite, cvRewriteAccept
src/locales/{en,vi}/translation.json             SỬA
```

**Không chạy step 1.5 SuperDesign.** Feature không đẻ ngôn ngữ thị giác mới: trang dùng đúng `PageContainer` + `SectionCard` + token semantic theo `client/.claude/rules/layout-primitives.md`, danh sách thay đổi là `SectionCard` + `Checkbox` của antd, khối gap chưa đóng là `Alert`, đặt tên là `Modal` — tất cả đã có mock đã duyệt ở `ui-designs/` cho các trang trước. Dựng mock mới sẽ tốn credit cloud + upload CV-shaped source để vẽ lại đúng những component đang có.

### 5.1 Luồng trang

1. Vào `/cv-rewrite/$matchResultId` → `useMatchResult(id)` cho ngữ cảnh (điểm, `report.gaps`), `useDocument(cvDocumentId)` cho tiêu đề CV.
2. **Chưa sinh gì cả.** Panel đầu tiên: `RewriteRunWith` (chọn 1 credential hoặc "System key", mặc định = credential mà chính match đó đã chạy; credential đó đã bị xoá → về "System key") + **thông báo quyền riêng tư** nêu đích danh provider sắp nhận CV/JD (dùng lại key i18n `credentials.runWith.privacy*` đã có) + nút **"Generate suggestions"**.
   > Không tự chạy khi mount. Mỗi lần chạy là một lần CV rời hệ thống trên key của user; điều đó phải do user bấm, đúng NFR §7.
3. Đang chạy → `Skeleton` + `aria-busy`.
4. Có đề xuất → danh sách `ChangeCard`, **mặc định KHÔNG tick cái nào** (§3), kèm "Select all"; khối `Alert` cho `unaddressedGaps`; khối `Collapse` "Preview result" hiện `rawText` sau khi áp các thay đổi đang tick.
5. Footer: `Save as new CV` (disabled khi 0 tick) → `SaveRewriteModal` đặt tên (mặc định `"<tên CV gốc> (improved)"`) → `POST /cv-rewrite/accept` → invalidate `savedDocumentsQueryKey("CV")` → `message.success` + điều hướng `/cv`.

`ChangeCard`: `sectionHint` làm eyebrow; `original` nền `red-*` nhạt gạch ngang; `replacement` nền `green-*` nhạt; `rationale` chữ `text-muted`; `addressesGap` thành `Tag`. (`red`/`green`/`amber` nằm trong ngoại lệ được phép của rule `layout-primitives` §1.)

### 5.2 Điểm vào

- **Wizard step 4** — `MatchResultCard` thêm nút `extra` **"Improve my CV"** (icon `Wand2`, Lucide), chỉ hiện khi `result.status === "succeeded"`. `useNavigate` → `/cv-rewrite/$matchResultId`.
- **Match history** — Home `RecentMatches` click một dòng đã mở lại step 4; nút ở trên nằm ngay trên card đó nên **cùng một nút phục vụ cả hai điểm vào §6.3**, không nhân đôi UI.

### 5.3 Sửa kèm — mở lại một kết quả cũ (bug đang có trên `main`)

`RecentMatches.openResult()` set `matchId` + `step = 4` rồi vào `/wizard`. Nhưng từ `multi-provider-compare`, `StepResult` chỉ đọc `runId` / `cvDocId` / `jdDocId` — cả ba đều `null` khi đến từ Home → màn hình hiện *"No run to show"*. `matchId` trong store thành cột chết.

Đây là **regression đang chạy trên `main`**, và nó chặn đúng một trong hai điểm vào mà §6.3 yêu cầu. Sửa tối thiểu: khi `runId == null` nhưng `matchId != null`, `StepResult` gọi `useMatchResult(matchId)` và render **một** `MatchResultCard` với `autoRun=false`, `expanded`, `cvDocumentId`/`jdDocumentId` lấy **từ chính result** (không từ store). Đường live (`runId` + `pendingCredentialIds`) và đường reload (`GET /match/runs/:id`) không đổi. → cập nhật `unfinished-features.md` #1.

## 6. Hợp đồng BE DTO ↔ FE type

| BE | FE (`src/types/CvRewrite/index.ts`) |
|---|---|
| `CvRewriteChangeDto` | `CvRewriteChange { id: string; sectionHint: string \| null; original: string; replacement: string; rationale: string; addressesGap: string \| null }` |
| `CvRewriteProposalDto` | `CvRewriteProposalDto { matchResultId; cvDocumentId; cvTitle; provider: AiProvider; chatModel: string; changes: Array<CvRewriteChange>; unaddressedGaps: Array<string> }` |
| `GenerateCvRewriteDto` | `GenerateCvRewriteInput { matchResultId: string; credentialId?: string }` |
| `AcceptCvRewriteDto` | `AcceptCvRewriteInput { matchResultId: string; title: string; changes: Array<{ original: string; replacement: string }> }` |
| `DocumentDto` (+`parentId`) | `DocumentDto` thêm `parentId: string \| null` |

## 7. E2E Scenario Matrix

Gate mặc định `A+B`; scenario mutation-heavy ghi `A only`. **Gate B (MCP walk) không chạy ở feature này** — ghi lý do trong `e2e.md`, đúng tiền lệ `ai-credentials` và `multi-provider-compare`.

| # | Category | Trạng thái | Scenario + giá trị dẫn xuất | Gate |
|---|---|---|---|---|
| 1 | Happy path | ✅ | (a) step 4 (1 card, `succeeded`) → nút "Improve my CV" → trang rewrite hiện tiêu đề CV + gaps của match. (b) bấm Generate → 3 `ChangeCard`, **không cái nào được tick sẵn**, footer disabled. (c) tick 2/3 → Preview result chứa đúng 2 đoạn mới + đoạn thứ 3 **còn nguyên văn bản gốc** → Save → modal tên → `/cv` hiện CV mới. (d) từ Home: click 1 dòng match → step 4 mở lại kết quả cũ → cùng nút đó. | (a)(d) A+B · (b)(c) A only |
| 2 | AuthN | N/A | Chưa có auth — app chạy như đã đăng nhập bằng mock user (`project-goals.md` §3). Không có màn login để test redirect/401. Thành ✅ ở Roadmap #10. | — |
| 3 | AuthZ | N/A ở FE | Không có phân quyền theo role. Per-user isolation (`matchResultId` / `credentialId` của user khác → 404) chỉ dựng được với user thứ hai → cover ở BE e2e `cv-rewrite.e2e-spec.ts` (§8). | — |
| 4 | Validation / grounding | ✅ | **[EP]** phản hồi model chia lớp: `neo hợp lệ` · `neo không có trong CV` · `neo xuất hiện 2 lần` · `neo < 12 ký tự` · `replacement phình > 4×` · `replacement rỗng (xoá — HỢP LỆ)`. Stub trả cả 6 → UI **chỉ** hiện 2 lớp hợp lệ (neo hợp lệ + xoá); 4 lớp còn lại không có mặt trong DOM. **[DT]** kết hợp lúc Save: `0 thay đổi tick + tên hợp lệ` → nút disabled, **không** request nào; `có tick + tên rỗng` → lỗi client trên ô tên, **không** request nào; `có tick + tên 201 ký tự` → chặn client-side; `có tick + tên hợp lệ nhưng neo đã hỏng ở server` → **400**, alert, **không** tạo `Document` (assert `/cv` không có thêm dòng). | A only |
| 5 | Empty / null | ✅ | Match có `report.gaps` **rỗng** → trang nói rõ "không có gap nào để đóng", nút Generate vẫn dùng được nhưng có ghi chú. Đề xuất trả **0 thay đổi** → empty state có nghĩa (không phải màn trắng, không phải danh sách rỗng câm). `unaddressedGaps` rỗng → khối Alert **không** render. `sectionHint = null` → không render eyebrow rỗng. `addressesGap = null` → không render `Tag` trống. | A+B |
| 6 | Boundary | ✅ | **[BVA]** độ dài neo `11` (min−1 → loại) · `12` (min → nhận). Phình `replacement`: `4×` (max → nhận) · `4× + 1 ký tự` (max+1 → loại) · `1500` (max tuyệt đối → nhận) · `1501` (→ loại). Số thay đổi `25` (max → đủ 25 card) · `26` (max+1 → vẫn đúng 25 card). Tên CV mới `0` (reject) · `1` (accept) · `200` (accept) · `201` (reject). Không phân trang → phần pagination **N/A**. | A only |
| 7 | Filter / search | N/A | Trang không có filter/sort/search — danh sách thay đổi giữ **thứ tự theo vị trí trong CV** (§4.3) và thứ tự đó là ngữ nghĩa, không được cho user đảo. Không query param nào cần persist. | — |
| 8 | Data rendering | ✅ | `provider` enum → nhãn người đọc ("OpenRouter"), không phải chuỗi enum thô. Điểm của match hiện `%`. `original` và `replacement` render **nguyên văn**, kể cả khi chứa `<script>` / ký tự markup — assert nội dung hiện dạng text và **không** có node script nào được tạo. Assert DOM **không** chứa key API gốc ở bất kỳ đâu. Preview result là văn bản, không phải `[object Object]`. | A+B |
| 9 | i18n | ✅ | Render **cả `en` và `vi`** cho: tiêu đề trang, nhãn nút Generate + Save + Select all, tiêu đề khối `unaddressedGaps` và câu "cần kinh nghiệm thật", nhãn Original/Suggested trên `ChangeCard`, empty state, thông báo quyền riêng tư, mọi message lỗi mới (`matchFailed`, `changeNotGrounded`, `emptyResult`), nhãn nút "Improve my CV". Bắt lỗi thiếu key dịch. | A+B |
| 10 | Error / loading | ✅ | `POST /cv-rewrite` → **503** (provider chết) → alert đọc được + đề xuất cũ **không** bị xoá khỏi màn hình. `POST /cv-rewrite` → **404** (match bị xoá ở tab khác) → thông báo rõ. `GET /match/:id` → 500 → error UI, không phải trang trắng. Đang sinh → skeleton + `aria-busy`. `POST /cv-rewrite/accept` → 500 → alert, ở lại trang, **các tick vẫn còn nguyên** (không mất công duyệt lại). | A+B (route interception) |
| 11 | Mutation safety | ✅ | **[ST]** vòng đời: `chưa sinh` → `đang sinh` → `có đề xuất` → `đã tick` → `đã lưu`. **Invalid transition (bắt buộc)**: (i) bấm **Generate lần 2** khi đã có đề xuất và đã tick → xác nhận, và sau khi thay đề xuất mới thì **mọi tick cũ bị bỏ** (tick trỏ vào neo của đề xuất cũ, giữ lại là ghi nhầm đoạn); (ii) bấm **Save 2 lần thật nhanh** → đúng **1** `Document` được tạo (nút disable khi pending); (iii) Save **lần thứ hai sau khi đã lưu thành công** → không tạo thêm bản trùng. **CV gốc bất biến**: sau khi lưu, mở CV gốc ở `/cv` → nội dung không đổi; bản mới là dòng riêng. Dọn `Document`/`MatchResult` tạo trong test ở `afterAll` (dùng lại `db-cleanup`). | A only |
| 12 | Accessibility | ✅ | Mỗi `ChangeCard` là một `role="group"` có accessible name; checkbox chọn được bằng bàn phím và có nhãn liên kết (chọn bằng `getByRole('checkbox', { name })`, không phải CSS selector). Vùng đề xuất `aria-live="polite"` để screen reader biết đã sinh xong. Khối đang sinh có `aria-busy`. Modal đặt tên: focus vào ô đầu khi mở, `Esc` đóng, focus trả về nút Save. Thứ tự tab: Run-with → Generate → Select all → từng checkbox → Save. | A+B |

**Error-guessing pass** (làm inline, không dispatch subagent vì user không yêu cầu bản "thorough") — đã gộp vào matrix: double-submit lúc Save (row 11), sinh lại đè lên tick cũ (row 11), model trả neo trùng/rỗng/phình (row 4+6), CV chứa ký tự markup (row 8), match bị xoá ở tab khác giữa chừng (row 10), mất công duyệt khi accept lỗi (row 10), gap rỗng và đề xuất rỗng (row 5).

## 8. Kiểm thử

**BE unit**
- `grounding.spec.ts` — toàn bộ bảng verify ở §3: neo bịa/mơ hồ/ngắn/chồng lấn/phình bị loại; so khớp bỏ qua khác biệt whitespace hoạt động; `applyChanges` giữ nguyên phần không được duyệt và splice đúng khi có nhiều thay đổi; `MAX_CHANGES` cắt đúng.
- `cv-rewrite.service.spec.ts` — ownership 404; `status=failed` → 400; accept không tin client (neo hỏng → 400 + **không** `document.create`); `Document` mới có `parentId` đúng, `kind=CV`, `sourceFormat=text`, `fileData=null`; CV gốc không bị `update`; `credentialId` bỏ trống → dùng `systemRuntimeConfig`.
- `ai.service.spec.ts` — thêm case cho `generateCvRewrite`: JSON không parse được → `model_unavailable`; lỗi provider → `AiProviderError` giữ nguyên `reason`.

**BE e2e** — `test/cv-rewrite.e2e-spec.ts`: sinh → accept → `GET /documents/:id` trả CV mới có `parentId`; CV gốc đọc lại **không đổi**; `matchResultId` của user khác → 404 (**đây là nơi cover row 3**); accept với neo bịa → 400 và không có document nào được tạo. SDK `openai` mock — không network thật.

**FE unit (Vitest)** — `ChangeCard` (3 trạng thái tick/untick/xoá-đoạn), `RewriteReview` (mặc định không tick gì, Select all, footer disabled khi 0 tick, đề xuất mới xoá tick cũ), `StepResult` (đường `matchId` mở lại 1 kết quả), `MatchResultCard` (nút chỉ hiện khi `succeeded`).

**FE E2E (Playwright)** — một test cho mỗi row ✅ ở §7, tại `client/e2e/cv-rewrite-assistant/`. Provider thật chặn bằng route interception (`**/api/v1/cv-rewrite`) — E2E **không** gọi AI thật. Chạy **cả suite desktop**, reconcile mọi spec cũ bị ảnh hưởng bởi §5.3 và nút mới trên card.

## 9. Thay đổi ngoài code

- `docs/erd.md` — `Document.parentId` bỏ dấu 📝 (implemented); mục "Generated content 📝" chốt phương án **(a)** + lý do; bảng trạng thái implement cập nhật.
- `docs/project-goals.md` — Roadmap #6 → ✅ DONE; §6.3 ghi rõ diff là **anchored change list** chứ không phải section; §12 đóng 2 open question của Goal 7 (lưu ở đâu · diff mức nào), giữ nguyên câu về cover letter (thuộc Roadmap #8); §13 changelog.
- `docs/unfinished-features.md` — #2 `parsedContent` gỡ "diff theo section của Goal 7" khỏi danh sách đang chặn (kèm lý do §2); #1 Match history ghi nhận đường mở lại kết quả đã sửa.
- `server/README.md` — 2 endpoint mới + throttle 10 req/phút của `POST /cv-rewrite` + ghi chú bất biến grounding.
- `.env.example` — **không đổi**, feature không thêm env nào.
