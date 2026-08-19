# Design — `cv-version-comparison` (Roadmap #7, Goal 9)

> Brainstorm 2026-08-09 qua `superpowers:brainstorming`.
> Hiện thực `project-goals.md` §6.6. Upstream trực tiếp: **`specs/cv-rewrite-assistant/`** (Roadmap #6, vừa merge `main`) — nó tạo `Document.parentId` và nó là thứ sinh ra phiên bản thứ hai để đem so.
> Ràng buộc gốc: **ADR #15** (lineage bằng `parentId` self-FK, `ON DELETE SET NULL`) + **ADR #4** (keyword + semantic chấm điểm, LLM chỉ giải thích) + **ADR #14** (keyword cấp âm tiết, tokenizer chung).

## 1. Vấn đề & phạm vi

Roadmap #6 vừa giao cho user một **CV mới**. Không có gì nói cho họ biết nó có tốt hơn thật không. `report.gaps` của lần match cũ nằm ở một trang, điểm của lần match mới nằm ở trang khác, và việc đối chiếu hai thứ đó là công việc user phải tự làm bằng mắt và trí nhớ — đúng thứ mà Goal 9 sinh ra để thay thế (`specs/goals-8-9-10/design.md` §3.1).

Feature này trả lời **một câu hỏi duy nhất**: *"So với bản trước, CV của tôi tốt lên bao nhiêu trên đúng JD này?"* Câu trả lời gồm hai nửa:

1. **Delta điểm** — `overallScore` / `semanticScore` / `keywordScore`, số cứng, tái lập được.
2. **Gap nào đã đóng / còn / mới phát sinh** — số mềm, suy ra từ hai danh sách free-text do LLM sinh. §3 là toàn bộ thiết kế của nửa này, vì nó là chỗ dễ sai một cách âm thầm nhất.

### Trong phạm vi

- `GET /comparisons/:documentId` — so 1 CV (bản mới) với **cha của nó** (`parentId`) trên **một JD do user chọn**.
- Module BE `comparison` + **`gap-diff.ts` — hàm thuần, test riêng được** (cùng lý do với `matching/tokenizer.ts` và `cv-rewrite/grounding.ts`: đây là phần đáng test nhất của feature).
- `PATCH /documents/:id/parent` — **khai báo lineage thủ công**. Không có nó, Goal 9 chỉ chạy được cho CV do Roadmap #6 sinh ra, trong khi §6.6 nói rõ *"Chạy được độc lập với Goal 7 — user tự upload bản sửa tay rồi khai báo lineage là đủ dùng"*.
- Trang FE `/compare/$documentId` (+ search param `jd`): chọn JD → delta + gap diff.
- 2 điểm vào: hàng CV trong Library (`/cv`) và card kết quả ở wizard step 4 — **cả hai chỉ hiện khi CV đó có `parentId`**.
- Số phiên bản (`Version 1 → Version 2`) suy từ chuỗi `parentId` — đóng một open question của §12.

### Ngoài phạm vi (cố ý)

| Hoãn | Lý do |
|---|---|
| **So 2 `MatchResult` bất kỳ do user tự chọn** | Bị loại từ tầng goal (`specs/goals-8-9-10/design.md` §3.3): hệ thống không biết bản nào cải tiến từ bản nào → không tự nói được "CV của bạn đã tốt lên". Lineage chính là thứ mua lại khả năng đó. |
| **Chạy match mới từ trang so sánh** | §2 — đây là quyết định thiết kế, không phải mục bỏ qua. |
| **So nhiều hơn 2 phiên bản cùng lúc** (v1↔v2↔v3) | Câu hỏi của user là "bản này so với bản trước", không phải "vẽ đường xu hướng". Chuỗi dài vẫn so được từng cặp liền kề. Dashboard xu hướng bị §6.6 loại tường minh. |
| **Hồ sơ định vị CV** ("CV này mạnh với nhóm JD nào") | §6.6 loại tường minh — hướng phân tích khác. |
| **Ghép gap bằng embedding hoặc bằng một call LLM** | §3.2 — cost + quyền riêng tư + không test được. |
| **Chuẩn hoá `Document.parsedContent`** | `specs/cv-rewrite-assistant/design.md` §2 đã cân và chốt **không**, kèm lý do "Goal 9 không cần `parsedContent`". Không mở lại. |
| **Xoá/sửa `MatchResult`** để dọn dữ liệu so sánh | `DELETE /match/:id` vẫn nằm ở `unfinished-features.md` #1, không thuộc feature này. |

### Bỏ qua step 1.5 SuperDesign

Feature không đẻ ngôn ngữ thị giác mới. Trang dùng đúng `PageContainer` + `SectionCard` + token semantic theo `client/.claude/rules/layout-primitives.md`; delta là 3 khối số dùng thang chữ có sẵn; 3 danh sách gap là `ul` + icon Lucide đúng bảng màu ngoại lệ đã cho phép (`green` đóng / `amber` còn / `red` mới); chọn JD là `Select` antd; khai báo lineage là `Modal` + `Select`. Tất cả đều đã có mock đã duyệt ở `ui-designs/` của các trang trước. Dựng mock mới sẽ tốn credit cloud để vẽ lại đúng những component đang có.

## 2. Quyết định bắt buộc — so sánh có chạy match mới không?

**Không. Không bao giờ. Trang so sánh là read-only tuyệt đối và không tiêu một call AI nào.**

Ba lý do, xếp theo sức nặng:

1. **Một lần match là một lần CV rời khỏi hệ thống.** `cv-rewrite-assistant` đã đặt tiền lệ đúng (`design.md` §5.1 bước 2): *"Không tự chạy khi mount. Mỗi lần chạy là một lần CV rời hệ thống trên key của user; điều đó phải do user bấm"*. Một trang tên là "so sánh" mà lặng lẽ gửi CV + JD tới OpenRouter là hành vi bất ngờ đúng ở chỗ NFR §7 và Goal 10 đang cấm.
2. **Cost.** 1 match = 3 call AI (2 embed + 1 chat). Mở trang so sánh, đổi JD trong dropdown 4 lần, refresh → 15 lần chạy match. Không có gì trong UI nói cho user biết họ vừa tiêu bao nhiêu.
3. **Không có chỗ để đặt lựa chọn credential.** `POST /match` cần `credentialId` + thông báo quyền riêng tư nêu đích danh provider. Dựng lại chuỗi đó trong trang so sánh là **đường thứ hai tới cùng một hành động** — đúng thứ `cv-rewrite-assistant` §"Ngoài phạm vi" đã từ chối làm.

**Vậy khi bản mới chưa từng match với JD đó thì sao?** Trang nói thẳng ra điều đó và **giao lại cho wizard**:

- `revisionResult = null` → không render delta, không render gap diff (render một bảng số rỗng còn tệ hơn: nó trông như "không cải thiện gì").
- Render một `Alert` + nút **"Match this version"** → nạp `cvDocId` = bản còn thiếu, `jdDocId` = JD đang chọn vào `useWizardStore`, `step = 3` (Review), điều hướng `/wizard`.
- Wizard đã sở hữu toàn bộ chuỗi *chọn provider → cảnh báo quyền riêng tư → chạy → lưu kết quả*. Sau khi chạy xong, user quay lại `/compare/...` và số đã có.

**Chọn `MatchResult` nào khi một cặp (CV, JD) có nhiều kết quả** (multi-provider run, hoặc chạy lại nhiều lần):

1. Bản mới (revision): lấy `MatchResult` **`status=succeeded` mới nhất**.
2. Bản gốc (base): ưu tiên bản `succeeded` mới nhất **có cùng `chatModel` VÀ `embedModel`** với bản đã chọn ở bước 1; không có thì lùi về bản `succeeded` mới nhất.

Bước 2 không phải để cho đẹp. `semanticScore` là cosine của embedding — **hai embed model khác nhau cho hai không gian vector khác nhau**, nên hiệu của chúng không phải là "CV tốt lên". Và `gaps` do chat model viết, nên đổi model là đổi cả cách diễn đạt gap, làm nhiễu toàn bộ §3. Khi vẫn không ghép được cùng model, API trả `sameEmbedModel` / `sameChatModel` = `false` và **UI hiện cảnh báo tường minh** thay vì im lặng đưa ra một con số sai. Row `failed` không bao giờ được chọn: nó lưu `0/0/0` (`multi-provider-compare` D3), đem so sẽ ra delta −100%.

> **Caveat dữ liệu cũ**: `MatchResult` tạo **trước** Roadmap #3 (Goal 8) mang `keywordScore` tính bằng tokenizer cũ. Script `yarn recompute-scores --apply` đã có sẵn và là bắt buộc của feature đó; nếu một DB chưa chạy nó, delta keyword sẽ phản ánh việc đổi công thức chứ không phải đổi CV. Không thêm code cho việc này — `createdAt` của cả hai bên được trả về DTO nên user nhìn thấy được hai lần chạy cách nhau bao lâu.

## 3. Crux — khi nào hai gap là "cùng một gap"?

Đây là phần dễ sai âm thầm nhất của feature. `report.gaps` là mảng câu tiếng tự nhiên do LLM sinh **lại từ đầu ở mỗi lần match**. Ví dụ thật của cùng một vấn đề qua 2 lần chạy:

```
v1: "No CI/CD experience mentioned"
v2: "CI/CD exposure is still limited to a single tool"
```

So chuỗi nguyên văn → gap này bị đếm **vừa là đã đóng, vừa là mới phát sinh**. Với một danh sách 5 gap, output sẽ là "5 đã đóng, 5 mới" ở **mọi** lần so sánh — một màn hình luôn luôn sai nhưng trông vẫn hợp lý. Đó là lý do phần này được thiết kế riêng, tách thành module thuần, và có test riêng.

### 3.1 Các phương án

| | Cách | Bị loại vì |
|---|---|---|
| (a) | So chuỗi nguyên văn | Hỏng như trên. |
| (b) | So chuỗi sau khi lowercase + bỏ dấu câu | Vẫn hỏng: LLM diễn đạt lại gần như mọi lần, hiếm khi trùng đúng từng chữ. |
| (c) | Embedding từng gap + cosine | Chính xác hơn, nhưng **tốn call AI cho một trang read-only** — mâu thuẫn trực tiếp với §2, và biến một hàm thuần thành một thứ phải mock mới test được. |
| (d) | Hỏi LLM "hai danh sách này gap nào trùng" | Cùng vấn đề của (c), cộng thêm: kết quả không tất định, không unit-test được, và mỗi lần mở trang lại gửi nội dung ra ngoài. |
| (e) | **Trùng lặp token nội dung, dùng `tokenize()` sẵn có** | **Chọn.** |

### 3.2 Chọn (e). Lý do.

1. **Nó tái dùng đúng bộ chuẩn hoá mà điểm số đang dùng.** `matching/tokenizer.ts` (Goal 8) đã Unicode-aware, gỡ dấu tiếng Việt, và có bảng alias kỹ thuật. Nhờ đó `ReactJS`/`React.js`/`react`, `kinh nghiệm`/`kinh nghiem`, `K8s`/`Kubernetes` tự động gộp — miễn phí, không thêm một nguồn chuẩn hoá thứ hai vào codebase (`server/.claude/CLAUDE.md`: *"KHÔNG tự viết logic tách token ở nơi khác"*).
2. **Thuần, tất định, miễn phí, test được.** Mở trang 100 lần ra 100 kết quả giống nhau và không tiêu gì. Đây là điều kiện để §2 đứng vững.
3. **Sai lệch có hướng kiểm soát được.** Xem §3.4 — khi lưỡng lự, thuật toán nghiêng về "gap vẫn còn" chứ không nghiêng về "gap đã đóng". Nói sai rằng một vấn đề đã được giải quyết là kiểu sai tệ nhất ở đây.

### 3.3 Thuật toán

Module thuần `src/modules/comparison/gap-diff.ts`.

**Bước 1 — rút "khoá chủ đề" của mỗi gap.**

```
topicTokens(gap) = tokenize(gap) \ GAP_BOILERPLATE
```

`GAP_BOILERPLATE` là một danh sách nhỏ, có chủ đích, gồm những từ xuất hiện ở **gần như mọi câu gap** và không mang chủ đề: `experience`, `missing`, `lack`/`lacks`/`lacking`, `mention`/`mentioned`, `demonstrate`/`demonstrated`, `show`/`shown`, `evidence`, `cv`, `resume`, `jd`, `candidate`, `role`, `position`, `require`/`required`/`requirement`(`s`), `year`/`years`, cùng bản tiếng Việt đã gỡ dấu (`kinh`, `nghiem`, `thieu`, `chua`, `khong`, `neu`, `ro`, `ung`, `vien`, `vi`, `tri`, `yeu`, `cau`, `nam`…).

> Vì sao cần danh sách này, và vì sao nó **ngược quy tắc** của `tokenizer.ts`: `tokenizer.ts` ghi *"khi một từ vừa có thể là stopword vừa có thể là keyword kỹ thuật thì BỎ RA ngoài danh sách"* — vì lọc nhầm một keyword thật làm hỏng điểm. Ở đây rủi ro đảo chiều: **giữ lại một từ boilerplate làm hai gap khác nhau bị gộp làm một**. `"Missing AWS experience"` và `"Missing Azure experience"` chia sẻ `{missing, experience}` — hai phần ba số token — và sẽ bị coi là cùng một gap. Sau khi gỡ boilerplate chúng còn `{aws}` và `{azure}`: giao rỗng, phân loại đúng. Danh sách vì thế sống **trong module này**, không nhét vào `tokenizer.ts`: nó phục vụ phép so gap, không phục vụ phép chấm điểm.

**Bước 2 — độ tương tự = hệ số overlap trên khoá chủ đề.**

```
similarity(a, b) = |Ka ∩ Kb| / min(|Ka|, |Kb|)      (0 nếu một bên rỗng)
matched(a, b)    = similarity(a, b) >= GAP_MATCH_THRESHOLD        (0.5)
                   HOẶC normalize(a) === normalize(b)             (fallback, xem dưới)
```

Dùng **overlap coefficient** chứ không phải Jaccard hay Dice là quyết định có cân nhắc: gap ở bản v2 thường **dài hơn và cụ thể hơn** gap ở v1 (`"No CI/CD experience mentioned"` → `"CI/CD exposure is still limited to a single tool"`). Jaccard và Dice phạt sự lệch độ dài đó và sẽ bỏ sót đúng ca phổ biến nhất (Dice cho cặp ví dụ = 0.44, dưới ngưỡng). `min()` ở mẫu số hỏi đúng câu cần hỏi: *"gap ngắn hơn có nằm gọn trong chủ đề của gap kia không"*.

**Fallback so chuỗi**: gap nào sau khi gỡ boilerplate còn **rỗng** (vd `"Missing relevant experience"`) thì không có chủ đề để so — nó chỉ ghép được bằng so chuỗi đã chuẩn hoá (lowercase + gộp whitespace). Không ghép bừa theo tập rỗng.

**Bước 3 — ghép tham lam theo điểm cao nhất trước (global, không phải first-match).**

Tính mọi cặp (base × revision) có `matched`, sắp giảm dần theo `similarity` (tie-break theo thứ tự xuất hiện để tất định), duyệt và ghép nếu **cả hai** vế còn tự do.

> Vì sao không first-match: giả sử v1 có `"React state management not shown"` `{react, state, management}`, v2 có `"React testing not covered"` `{react, testing}` và `"Redux/state management missing"` `{redux, state, management}`. First-match sẽ ghép gap v1 với cái đầu tiên vượt ngưỡng (`react testing`, similarity 0.5) và báo `redux/state management` là **mới** — sai gấp đôi. Best-first ghép nó với `{redux, state, management}` (similarity 0.67) trước, để `react testing` đúng là gap mới.

**Kết quả.**

```
closed      = gap của base không ghép được với gap nào của revision
persisted   = các cặp đã ghép { base, revision }   ← giữ NGUYÊN VĂN cả hai vế
introduced  = gap của revision không ghép được với gap nào của base
```

`persisted` giữ cả hai câu gốc chứ không chỉ một, vì cách diễn đạt đổi **cũng là thông tin**: `"No CI/CD experience mentioned"` → `"CI/CD exposure is still limited to a single tool"` cho user biết gap đã thu hẹp dù chưa đóng.

**Hằng số** (`gap-diff.ts`, theo `server/.claude/rules/constants.md`):

```ts
const GAP_MATCH_THRESHOLD = 0.5;   // overlap coefficient trên token chủ đề
const MAX_GAPS_PER_SIDE   = 50;    // chặn input; ghép là O(n·m)
```

### 3.4 Failure mode — nói thẳng

| # | Kiểu sai | Ví dụ | Hướng sai | Giảm nhẹ |
|---|---|---|---|---|
| 1 | **Gộp nhầm 2 gap cùng chủ đề khác chi tiết** | `"Missing AWS Lambda"` vs `"Missing AWS ECS"` → cùng `{aws}` ở một vế → similarity 1.0 → báo "còn tồn tại" thay vì "1 đóng + 1 mới" | **Bảo thủ** — nói gap vẫn còn. Chấp nhận được: thà bảo user vấn đề chưa xong. | `persisted` hiện **nguyên văn cả hai câu** cạnh nhau nên user tự thấy chúng khác nhau. |
| 2 | **Tách nhầm 1 gap dùng từ vựng rời nhau** | `"No container orchestration experience"` vs `"Kubernetes not mentioned"` → giao rỗng → báo "1 đóng + 1 mới" | **Nguy hiểm** — báo đóng một gap chưa đóng. | Không giải được bằng bag-of-words. Embedding/từ điển đồng nghĩa bị loại ở §3.1 và §5 Non-Goals. Giảm nhẹ bằng UI: xem §3.5. |
| 3 | **Boilerplate list là bảng curate, chỉ EN + VI** | Gap viết bằng ngôn ngữ khác → không gỡ được từ đệm → dễ gộp nhầm (kiểu #1) | Bảo thủ | Thêm 1 dòng vào bảng khi gặp. Cùng cơ chế `ALIAS_MAP` của tokenizer. |
| 4 | **Nhiễu từ thượng nguồn** — LLM sinh lại `gaps` mỗi lần match, nên **cùng một CV** chạy 2 lần cũng ra 2 danh sách khác nhau | — | Cả hai | Không phải lỗi của thuật toán này và không sửa được ở đây. Xử lý bằng UI (§3.5) + bằng việc **luôn dẫn đầu bằng delta điểm**, thứ tái lập được. |
| 5 | **Ngưỡng 0.5 là một con số chọn tay** | `{react, redux}` vs `{react, testing}` = 0.5 → ghép | Bảo thủ | Có unit test ở đúng biên (0.49 loại / 0.5 nhận). Đổi ngưỡng = đổi 1 hằng số + chạy lại test. |

### 3.5 Hệ quả bắt buộc lên UI

Vì §3.4 #2 và #4 không thể loại bỏ bằng thuật toán, UI **phải** thiết kế quanh chúng:

1. **Delta điểm đứng trước, to hơn, và được gọi là kết quả chính.** Nó tái lập được; gap diff thì không hoàn toàn.
2. **Không bao giờ chỉ hiện nhãn phân loại.** Cả 3 nhóm đều render **nguyên văn** câu gap để user tự phán đoán khi máy đoán sai.
3. **Một dòng nói thẳng rằng đây là ước lượng** (`comparison.gaps.caveat`, có trong cả `en` và `vi`): *"Gaps are compared by topic overlap, not exact wording — check the text below."*
4. **Cảnh báo khi hai lần match chạy bằng model khác nhau** (§2), vì lúc đó cả `semanticScore` lẫn cách viết gap đều không so được sòng phẳng.

### 3.6 Feature này được verify bằng gì

| Bất biến | Verify bằng |
|---|---|
| Diễn đạt lại cùng một gap → **persisted**, không phải closed+new | `gap-diff.spec.ts` — cặp CI/CD ở §3 |
| Hai gap khác chủ đề nhưng cùng từ đệm → **không** gộp | `gap-diff.spec.ts` — `Missing AWS experience` vs `Missing Azure experience` **[EP]** |
| Ngưỡng đúng ở biên | `gap-diff.spec.ts` — similarity `0.49` loại / `0.5` nhận **[BVA]** |
| Ghép best-first, không first-match | `gap-diff.spec.ts` — ví dụ react/redux ở §3.3 bước 3 |
| Mỗi gap dùng tối đa 1 lần | `gap-diff.spec.ts` — 1 gap base, 2 gap revision cùng chủ đề → 1 persisted + 1 introduced |
| Gap tiếng Việt có/không dấu gộp đúng | `gap-diff.spec.ts` — `"Thiếu kinh nghiệm Docker"` vs `"Chua co kinh nghiem Docker"` → persisted |
| Gap rỗng chủ đề chỉ ghép bằng so chuỗi | `gap-diff.spec.ts` — `"Missing relevant experience"` × 2 → persisted; × khác chữ → closed + introduced |
| Danh sách rỗng ở một/hai bên | `gap-diff.spec.ts` — `[] × [g]` → 1 introduced; `[g] × []` → 1 closed; `[] × []` → rỗng cả 3 |
| Không bao giờ chọn `MatchResult` `failed` | `comparison.service.spec.ts` |
| Ưu tiên base cùng model với revision | `comparison.service.spec.ts` |
| Chưa match bản mới → `delta = null`, không có số bịa | `comparison.service.spec.ts` + E2E row 5 |
| Per-user isolation | `test/comparison.e2e-spec.ts` — document của user khác → 404 |
| Lineage không tạo được vòng | `documents.service.spec.ts` + `test/documents.e2e-spec.ts` |

## 4. Backend

### 4.1 Schema

**Không có migration.** `Document.parentId` + `@@index([parentId])` đã được `cv-rewrite-assistant` tạo (migration `20260808172609_add_document_parent`). Đây đúng là điều `specs/cv-rewrite-assistant/design.md` §4.1 nói trước: *"Ở đây chỉ dựng `parentId` để Goal 9 có cái mà đọc."*

`seed.ts` không đổi. `client/e2e/db-cleanup.ts` không đổi (self-FK `SET NULL`).

`DocumentSummaryDto` **thêm `parentId`** — Library cần biết một hàng có phải bản cải tiến không để quyết định hiện nút "Compare versions"; đó cũng là bằng chứng nhìn thấy được rằng lineage đã ghi. (`DocumentDto` đã có `parentId` từ Roadmap #6.)

### 4.2 Module layout

```
src/modules/comparison/                MỚI
  comparison.controller.ts
  comparison.service.ts
  comparison.service.spec.ts
  comparison.module.ts
  gap-diff.ts                          hàm THUẦN: topicTokens / diffGaps
  gap-diff.spec.ts
  lineage.ts                           hàm THUẦN: resolveVersion (đi ngược chuỗi parentId)
  i18n-messages.ts                     tCompare(), namespace `comparison.*`
  dto/cv-comparison.dto.ts
  dto/comparison-query.dto.ts

src/modules/documents/                 SỬA
  documents.controller.ts              + PATCH /documents/:id/parent
  documents.service.ts                 + setParent()
  documents.service.spec.ts            MỚI (module chưa có unit test)
  dto/set-document-parent.dto.ts       MỚI
  dto/document-summary.dto.ts          + parentId

src/i18n/{en,vi}/comparison.json       MỚI
src/i18n/{en,vi}/documents.json        SỬA — 4 message lỗi lineage
src/app.module.ts                      SỬA — đăng ký ComparisonModule
```

Đồ thị phụ thuộc một chiều: `Comparison → {Prisma, CurrentUser}` + import hàm thuần `tokenize` từ `matching/tokenizer`. **Không** phụ thuộc `AiModule` — đó là bằng chứng cấu trúc cho §2: module này không có đường nào tới một provider AI.

`gap-diff.ts` và `lineage.ts` là hàm thuần, không phụ thuộc Nest — cùng kiểu và cùng lý do với `matching/tokenizer.ts` + `cv-rewrite/grounding.ts`.

### 4.3 API

| Verb | Path | Query / Body | Trả về |
|---|---|---|---|
| `GET` | `/comparisons/:documentId` | `?jdDocumentId=<uuid>` (optional) | `200 CvComparisonDto` |
| `PATCH` | `/documents/:id/parent` | `{ parentId: string \| null }` | `200 DocumentDto` |

**`GET /comparisons/:documentId`** — `:documentId` là **bản mới** (revision). Bản gốc luôn là `parentId` của nó, không phải một tham số: đó chính là điều ADR #15 mua được, và cho user tự chọn cả hai vế sẽ mở lại phương án đã bị loại ở `goals-8-9-10` §3.3.

Luật:

- Document phải thuộc user (`findFirst({ id, userId })`) → **404** `comparison.errors.documentNotFound`.
- `kind !== CV` → **400** `comparison.errors.notCv`. (JD không có khái niệm "bản cải tiến" trong sản phẩm này.)
- `parentId === null` → **400** `comparison.errors.noParent` — *"This CV is not marked as a new version of another CV."* FE bắt và gợi ý khai báo lineage.
- Parent bị xoá (`SET NULL` của ADR #15 nghĩa là `parentId` chỉ về `null`, không dangling) → rơi vào đúng nhánh trên. Parent tồn tại nhưng của user khác là bất khả (mọi document tạo ra đều gắn `userId` của người tạo), vẫn check `userId` khi nạp cho chắc.
- `jdOptions` = mọi JD mà **ít nhất một** trong hai bản có `MatchResult` `succeeded`, sắp theo lần match mới nhất giảm dần. **Không** filter theo `isSaved` — CV/JD transient của wizard vẫn là dữ liệu thật.
- `jdDocumentId` không truyền → chọn mặc định: JD đầu tiên **có đủ cả hai bên**; không có thì JD đầu danh sách; danh sách rỗng → `jdDocumentId = null` + mọi field kết quả `null`.
- `jdDocumentId` truyền nhưng không nằm trong `jdOptions` → **400** `comparison.errors.jdNotComparable` (thay vì im lặng đổi sang JD khác — user sẽ tưởng mình đang xem JD mình chọn).
- Endpoint **không** gọi AI → giữ throttle global, không cần `@Throttle` riêng.

`CvComparisonDto`:

```ts
{
  base:      DocumentVersionDto            // { id, title, version, createdAt }
  revision:  DocumentVersionDto
  jdDocumentId: string | null              // JD đang được so
  jdOptions: Array<ComparisonJdOptionDto>  // { id, title, hasBase, hasRevision }
  baseResult:     ComparisonSideDto | null
  revisionResult: ComparisonSideDto | null
  delta:   ScoreDeltaDto | null            // chỉ khác null khi có ĐỦ hai bên
  gapDiff: GapDiffDto   | null             // idem
  sameChatModel:  boolean                  // true khi không có gì để cảnh báo
  sameEmbedModel: boolean
}

ComparisonSideDto = { matchResultId, overallScore, semanticScore, keywordScore,
                      provider, chatModel, embedModel, gaps: string[], createdAt }
ScoreDeltaDto     = { overall: number, semantic: number, keyword: number }   // có dấu, có thể âm
GapDiffDto        = { closed: string[],
                      persisted: Array<{ base: string, revision: string }>,
                      introduced: string[] }
DocumentVersionDto= { id, title, version: number, createdAt }
```

`delta` và `gapDiff` **cùng null hoặc cùng non-null**. Trả `delta = {0,0,0}` khi thiếu một bên sẽ là số bịa đúng nghĩa — trông như "không cải thiện gì".

**`PATCH /documents/:id/parent`** — sub-resource riêng thay vì nhồi `parentId` vào `UpdateDocumentDto`: `title` ở đó đang là **bắt buộc**, nên gắn thêm vào sẽ buộc mọi lần khai lineage phải gửi kèm tên, và làm luồng rename (đang có E2E xanh) phải đổi hợp đồng. Sub-resource giữ blast radius bằng 0.

Luật `DocumentsService.setParent`:

- Document phải thuộc user → **404**.
- `parentId === null` → gỡ liên kết (hợp lệ, đây là cách sửa khi khai nhầm).
- `parentId === id` → **400** `documents.errors.lineageSelf`.
- Parent không tồn tại / không thuộc user → **400** `documents.errors.lineageParentNotFound` (400 chứ không 404: `:id` trong path tồn tại, cái sai nằm ở **body**).
- `parent.kind !== doc.kind` → **400** `documents.errors.lineageKindMismatch`.
- Đi ngược chuỗi từ `parent`; gặp lại `id` → **400** `documents.errors.lineageCycle`. Vòng lặp chặn cứng ở `MAX_LINEAGE_DEPTH = 20` để một dữ liệu hỏng không treo được request.

### 4.4 Số phiên bản — đóng open question §12

> *(Goal 9)* Số phiên bản (`v2`, `v3`) suy ra bằng cách đi ngược chuỗi `parentId`, hay lưu hẳn cột `version`?

**Chốt: suy ra, không thêm cột.** `version = 1 + số tổ tiên`.

- Cột `version` là **state nhân bản**, và nó drift ngay ở ca đầu tiên: ADR #15 dùng `ON DELETE SET NULL`, nên xoá bản gốc biến `v2` thành gốc mới — cột đã lưu sẽ tiếp tục nói "2" trong khi không còn bản 1 nào tồn tại.
- Chuỗi ngắn (một bản viết lại của một bản viết lại đã là hiếm) và đã có `@@index([parentId])`; `MAX_LINEAGE_DEPTH = 20` chặn cứng cả chi phí lẫn vòng lặp.
- Không migration = không đụng dữ liệu đang chạy.

`lineage.ts` giữ hàm này để test được mà không dựng Nest.

## 5. Frontend

```
src/routes/_app/compare.$documentId.tsx        MỚI — route mỏng + validateSearch({ jd })
src/views/CvComparison/index.tsx               MỚI — shell
src/views/CvComparison/mains/ComparisonReport/ MỚI — chọn JD → delta → gap diff
src/views/CvComparison/components/ScoreDelta/  MỚI — 3 khối delta
src/views/CvComparison/components/GapDiffList/ MỚI — 1 nhóm (closed | persisted | introduced)
src/views/DocumentLibrary/components/LineageModal/ MỚI — khai báo "bản mới của …"
src/requests/comparison.ts                     MỚI
src/hooks/useComparison.ts                     MỚI
src/types/Comparison/index.ts                  MỚI
src/hooks/index.ts                             SỬA — barrel
src/constants/endpoints.ts                     SỬA — + comparison, documentParent
src/types/Documents/index.ts                   SỬA — DocumentSummaryDto + parentId; SetDocumentParentInput
src/requests/documents.ts                      SỬA — setDocumentParent
src/hooks/useDocuments.ts                      SỬA — useSetDocumentParent
src/views/DocumentLibrary/mains/DocumentList/  SỬA — wiring modal + điều hướng compare
src/views/DocumentLibrary/components/DocumentRow/ SỬA — 2 action mới
src/views/Wizard/components/MatchResultCard/   SỬA — nút "Compare versions"
src/locales/{en,vi}/translation.json           SỬA
```

### 5.1 Luồng trang `/compare/$documentId?jd=<uuid>`

1. `useComparison(documentId, jd)` → `GET /comparisons/:id`.
2. Lỗi 400 `noParent` → `Alert` nói rõ *"CV này chưa được khai là bản mới của CV nào"* + link về `/cv`. Lỗi 404 → thông báo riêng. Lỗi khác → error UI, không trang trắng.
3. Header: **`Version 1 → Version 2`** kèm tên hai bản và ngày tạo. Đây là câu trả lời cho *"tôi đang so cái gì với cái gì"*, và nó không thể suy được từ hai cái tên do user tự đặt.
4. `Select` chọn JD. Đổi lựa chọn → `navigate({ search: { jd } })` → **URL là nguồn chân lý**, refresh và share link giữ nguyên JD đang xem (row 7 của matrix).
5. `delta !== null` → `ScoreDelta`: 3 khối `Overall / Semantic / Keyword`, mỗi khối hiện **điểm cũ → điểm mới** và **delta có dấu** (`+14` xanh ↑ / `−6` đỏ ↓ / `0` xám, **không** mũi tên, **không** dấu `+`).
6. `delta === null` → `Alert` + nút **"Match this version"** (§2). Không render khối số nào.
7. `gapDiff` → 3 `GapDiffList`: **Closed** (green, `CircleCheck`), **Still open** (amber, `TriangleAlert`), **New** (red, `CirclePlus`). `persisted` hiện **cả hai câu**: câu cũ mờ hơn, câu mới đậm. Nhóm rỗng vẫn render với empty text (`"None"`) — rỗng là thông tin, không phải chỗ trống.
8. Dòng caveat §3.5 #3 nằm dưới 3 nhóm.
9. `sameEmbedModel === false` hoặc `sameChatModel === false` → `Alert type="warning"` nêu tên hai model.

### 5.2 Điểm vào

- **Library `/cv`** — `DocumentRow` thêm nút **"Compare versions"** (`GitCompareArrows`, Lucide), **chỉ khi `doc.parentId !== null`**; và nút **"Mark as version of…"** (`GitBranch`) mở `LineageModal` cho mọi hàng.
- **Wizard step 4** — `MatchResultCard` thêm nút **"Compare versions"** cạnh "Improve my CV", **chỉ khi CV của kết quả có `parentId`** (đọc qua `useDocument(cvDocumentId)`, React Query dedupe nên N card chỉ 1 request). Nút mang sẵn `?jd=<jdDocumentId>` của chính kết quả đó — đúng JD user vừa xem.
  > Điều kiện `parentId !== null` cũng là lý do **không spec E2E cũ nào phải sửa**: mọi stub hiện có đặt `parentId: null`, nên nút không tồn tại trong DOM của chúng.

### 5.3 `LineageModal`

`Select` các document **cùng kind, khác chính nó** lấy từ `useSavedDocuments(kind)` đang có; `allowClear` để gỡ liên kết. Confirm → `PATCH /documents/:id/parent` → invalidate `savedDocumentsQueryKey(kind)`. Nút confirm `disabled` khi không đổi gì, và `loading` trong lúc bay (chặn double-submit — row 11).

Dùng `mutateAsync` + `try/catch`, **không** dùng callback `onSuccess`/`onError` của `mutate` — đã quan sát được là chúng không chạy trong codebase này (cùng lý do `RewriteReview` làm vậy).

## 6. Hợp đồng BE DTO ↔ FE type

| BE | FE (`src/types/Comparison/index.ts`) |
|---|---|
| `DocumentVersionDto` | `DocumentVersion { id: string; title: string; version: number; createdAt: string }` |
| `ComparisonJdOptionDto` | `ComparisonJdOption { id: string; title: string; hasBase: boolean; hasRevision: boolean }` |
| `ComparisonSideDto` | `ComparisonSide { matchResultId; overallScore; semanticScore; keywordScore; provider: AiProvider; chatModel; embedModel; gaps: Array<string>; createdAt: string }` |
| `ScoreDeltaDto` | `ScoreDelta { overall: number; semantic: number; keyword: number }` |
| `GapDiffDto` | `GapDiff { closed: Array<string>; persisted: Array<{ base: string; revision: string }>; introduced: Array<string> }` |
| `CvComparisonDto` | `CvComparisonDto { base; revision; jdDocumentId: string \| null; jdOptions; baseResult: ComparisonSide \| null; revisionResult: ComparisonSide \| null; delta: ScoreDelta \| null; gapDiff: GapDiff \| null; sameChatModel: boolean; sameEmbedModel: boolean }` |
| `SetDocumentParentDto` | `SetDocumentParentInput { parentId: string \| null }` |
| `DocumentSummaryDto` (+`parentId`) | `DocumentSummaryDto` thêm `parentId: string \| null` |

## 7. E2E Scenario Matrix

Gate mặc định `A+B`; scenario mutation-heavy ghi `A only`. **Gate B (MCP walk) không chạy ở feature này** — ghi lý do trong `e2e.md`, đúng tiền lệ `ai-credentials`, `multi-provider-compare` và `cv-rewrite-assistant`.

| # | Category | Trạng thái | Scenario + giá trị dẫn xuất | Gate |
|---|---|---|---|---|
| 1 | Happy path | ✅ | **[EP]** (a) `/cv` → hàng CV có `parentId` hiện nút "Compare versions" → mở `/compare/<id>` → header `Version 1 → Version 2`, tên cả hai bản. (b) delta hiện `61 → 75` và `+14` cho overall, `+8` semantic, `+23` keyword. (c) 3 nhóm gap đúng phân loại với stub `closed=["Kubernetes not mentioned"]`, `persisted=[{base:"No CI/CD experience mentioned", revision:"CI/CD exposure is still limited"}]`, `introduced=["No Terraform experience"]` — **cả hai câu của `persisted` đều có mặt trong DOM**. (d) từ wizard step 4: card kết quả của CV có parent → nút "Compare versions" → tới đúng `/compare/<cv>?jd=<jd>`. | (a)(b)(c) A+B · (d) A+B |
| 2 | AuthN | N/A | Chưa có auth — app chạy như đã đăng nhập bằng mock user (`project-goals.md` §3). Không có màn login để test redirect/401. Thành ✅ ở Roadmap #10. | — |
| 3 | AuthZ | N/A ở FE | Không có phân quyền theo role. Per-user isolation (`documentId` của user khác → 404; `parentId` trỏ document của user khác → 400) chỉ dựng được với user thứ hai → cover ở BE e2e `test/comparison.e2e-spec.ts` + `test/documents.e2e-spec.ts` (§8). | — |
| 4 | Validation | ✅ | **[EP]** `:documentId` chia lớp: `CV có parent` (200) · `CV không có parent` (400 `noParent` → trang nói rõ + link về `/cv`, **không** trang trắng) · `id là JD` (400 `notCv`) · `uuid không tồn tại` (404 → thông báo riêng) · `chuỗi không phải uuid` (400 từ `ParseUUIDPipe`). **[EP]** `?jd=` chia lớp: `bỏ trống` (server chọn mặc định) · `JD trong danh sách` (dùng) · `JD hợp lệ nhưng không comparable` (400 `jdNotComparable`, **không** im lặng đổi sang JD khác) · `jd không phải uuid` (400). **[DT]** `LineageModal` — 2 điều kiện quyết định cùng lúc (`parent hợp lệ?` × `tạo vòng?`): `parent=chính nó` → 400 `lineageSelf` · `parent=document kind khác` → 400 `lineageKindMismatch` · `parent=con của chính nó (A→B, đặt A.parent=B)` → 400 `lineageCycle` · `parent=hợp lệ` → 200 · `không chọn gì và không đổi gì` → nút confirm **disabled**, **không** request nào bay. | A only |
| 5 | Empty / null | ✅ | `jdOptions = []` (chưa bản nào từng match) → empty state có nghĩa + CTA sang wizard, **không** render bảng delta rỗng. Chỉ base có match (`revisionResult = null`, `delta = null`) → `Alert` "chưa match bản này" + nút "Match this version"; **assert không có ô delta nào trong DOM** (đây là ca "0% trông như không cải thiện"). Chỉ revision có match → tương ứng. `gapDiff` với cả 3 nhóm rỗng → mỗi nhóm hiện chữ "None", không phải 3 khối trắng. `gaps = []` ở một bên → nhóm còn lại vẫn đúng. | A+B |
| 6 | Boundary | ✅ | **[BVA]** dấu của delta: `+1` (hiện `+1`, mũi tên lên, màu xanh) · `0` (hiện `0`, **không** dấu `+`, **không** mũi tên, màu trung tính) · `−1` (hiện `−1`, mũi tên xuống, đỏ) · `−100` và `+100` (biên tuyệt đối, không tràn layout). **[BVA]** chuỗi lineage sâu: `v1→v2→v3`, mở `/compare/<v3>` → header đọc `Version 2 → Version 3` (không phải `1 → 2`). Ngưỡng ghép gap `0.49 / 0.5` là **unit test** của `gap-diff.spec.ts`, E2E chỉ assert kết quả phân loại đã render. Không phân trang → phần pagination **N/A**. | A only |
| 7 | Filter / search | ✅ | `Select` JD là bộ lọc duy nhất: đổi JD → số và gap đổi theo · **search param `jd` xuất hiện trong URL** · **F5 giữ nguyên JD đang xem** · mở thẳng URL có `?jd=` → đúng JD đó được chọn sẵn trong `Select`. | A+B |
| 8 | Data rendering | ✅ | `provider` enum → nhãn người đọc ("OpenRouter"), không phải chuỗi enum thô. Điểm hiện `%`. Delta hiện **dấu tường minh**. `createdAt` hiện theo locale, **không** phải ISO. Gap chứa `<script>alert(1)</script>` render **nguyên văn dưới dạng text**, assert không có node script nào được tạo. Không có `[object Object]` ở bất kỳ đâu (`persisted` là object 2 trường — đây chính là chỗ dễ ra `[object Object]` nhất). Assert DOM **không** chứa API key. | A+B |
| 9 | i18n | ✅ | Render **cả `en` và `vi`** cho: tiêu đề trang, nhãn `Version N`, nhãn 3 khối delta, tiêu đề 3 nhóm gap + chữ "None", **dòng caveat §3.5 #3**, cảnh báo khác model, empty state, nhãn nút "Compare versions" / "Mark as version of…" / "Match this version", tiêu đề + nhãn của `LineageModal`, và mọi message lỗi mới (`noParent`, `notCv`, `jdNotComparable`, 4 lỗi lineage). Bắt lỗi thiếu key dịch. | A+B |
| 10 | Error / loading | ✅ | `GET /comparisons/:id` → **500** → error UI đọc được, không trang trắng. → **404** → thông báo riêng ("không tìm thấy CV"). → **400 `noParent`** → thông báo riêng + link `/cv` (khác hẳn 500). Đang tải → `Skeleton` + `aria-busy`. `PATCH /documents/:id/parent` → **500** → `Alert`, **modal vẫn mở**, lựa chọn còn nguyên. | A+B (route interception) |
| 11 | Mutation safety | ✅ | Trang compare **read-only** — không có mutation nào, và đó là điều phải assert: **[ST]** mở trang → đổi JD 3 lần → refresh, assert **không** request `POST` nào tới `**/api/v1/match*` hay `**/api/v1/cv-rewrite*` (bằng chứng E2E cho §2). Lineage là mutation duy nhất: **[ST]** vòng đời `chưa có parent` → `đã đặt parent` → `đã gỡ parent (null)`; **invalid transition (bắt buộc)**: đặt parent tạo vòng → **400**, lineage cũ **không đổi** (mở lại modal thấy giá trị cũ). Double-click confirm → đúng **1** `PATCH` (nút disable khi pending). Dọn `Document`/`MatchResult` tạo trong test ở `afterAll` (dùng lại `db-cleanup`). | A only |
| 12 | Accessibility | ✅ | `Select` JD có nhãn liên kết (chọn bằng `getByRole('combobox', { name })`). 3 nhóm gap là `role="list"` có accessible name (nhóm nào là nhóm nào phải nghe được, không chỉ nhìn màu). Delta không truyền nghĩa **chỉ bằng màu** — có dấu `+`/`−` và text hướng. Khối đang tải có `aria-busy`; vùng kết quả `aria-live="polite"` khi đổi JD. `LineageModal`: focus vào `Select` khi mở, `Esc` đóng, focus trả về nút mở. Thứ tự tab: chọn JD → CTA → các nhóm. Mọi nút chọn được bằng role + name. | A+B |

**Error-guessing pass** (làm inline) — đã gộp vào matrix: double-submit khi đặt lineage (row 11), đổi JD liên tục rất nhanh (row 11 + 7), gap chứa markup (row 8), `persisted` là object dễ ra `[object Object]` (row 8), delta `0` bị render thành `+0` với mũi tên lên (row 6), CV bị xoá ở tab khác giữa chừng → 404 (row 10), mở thẳng URL có `?jd=` của một JD đã không còn comparable (row 4), chuỗi lineage 3 đời làm số version sai (row 6), và ca nguy hiểm nhất: **`revisionResult = null` bị render thành `0 → 0 (0)`** thay vì CTA (row 5).

## 8. Kiểm thử

**BE unit**
- `gap-diff.spec.ts` — toàn bộ bảng §3.6 phần gap: diễn đạt lại → persisted; cùng từ đệm khác chủ đề → không gộp; biên ngưỡng `0.49`/`0.5` **[BVA]**; best-first thay vì first-match; mỗi gap dùng tối đa 1 lần; tiếng Việt có/không dấu; alias `ReactJS`→`react`; gap rỗng chủ đề → fallback so chuỗi; các tổ hợp danh sách rỗng; cắt ở `MAX_GAPS_PER_SIDE`.
- `lineage.spec.ts` (trong `gap-diff.spec.ts` hay file riêng) — `version` của gốc = 1; chuỗi 3 đời = 3; vòng lặp dữ liệu hỏng dừng ở `MAX_LINEAGE_DEPTH`.
- `comparison.service.spec.ts` — ownership 404; `kind=JD` → 400; `parentId=null` → 400; `jdNotComparable` → 400; chọn result mới nhất; **bỏ qua `status=failed`**; ưu tiên base cùng `chatModel`+`embedModel`; `sameEmbedModel=false` khi khác; thiếu một bên → `delta`/`gapDiff` = `null`; `jdOptions` gộp từ cả hai bên và sắp đúng.
- `documents.service.spec.ts` (MỚI) — `setParent` hợp lệ; `parentId=null` gỡ liên kết; self → 400; kind mismatch → 400; parent không thuộc user → 400; vòng → 400; document không thuộc user → 404.

**BE e2e** — `test/comparison.e2e-spec.ts`: seed 2 CV (v1 → v2) + 1 JD + 2 `MatchResult` → `GET /comparisons/:v2` trả delta đúng và gap diff đúng; `documentId` của user khác → **404** (nơi cover row 3); `PATCH /documents/:id/parent` tạo vòng → **400** và lineage không đổi. Không network thật (endpoint không gọi AI — đó là một phần của assertion).

**FE unit (Vitest)** — `ScoreDelta` (3 dấu `+`/`0`/`−`, không có `+0`), `GapDiffList` (3 nhóm, nhóm rỗng ra "None", `persisted` render 2 câu), `ComparisonReport` (nhánh `delta === null` ra CTA chứ không ra số; đổi JD đẩy vào search param), `DocumentRow` (nút compare chỉ hiện khi `parentId !== null`), `MatchResultCard` (nút compare chỉ hiện khi CV có parent), `LineageModal` (confirm disabled khi chưa đổi).

**FE E2E (Playwright)** — một test cho mỗi row ✅ ở §7, tại `client/e2e/cv-version-comparison/`. Toàn bộ chặn bằng route interception (`**/api/v1/comparisons/*`). Chạy **cả suite desktop**, reconcile mọi spec cũ bị ảnh hưởng.

## 9. Thay đổi ngoài code

- `docs/erd.md` — `DocumentSummaryDto` không nằm trong ERD, nhưng ghi chú rằng `Document.parentId` giờ **có consumer đọc** (Goal 9) và cách suy `version` (không thêm cột) vào phần Notes.
- `docs/project-goals.md` — Roadmap #7 → ✅ DONE; §6.6 ghi rõ cách ghép gap là **topic-overlap trên tokenizer chung** kèm giới hạn; §12 đóng open question *"số phiên bản suy ra hay lưu cột"*; §13 changelog.
- `docs/unfinished-features.md` — ghi nhận lineage giờ khai báo được thủ công.
- `server/README.md` — 2 endpoint mới + ghi rõ `GET /comparisons/:id` **không gọi AI**.
- `.env.example` — **không đổi**, feature không thêm env nào.
