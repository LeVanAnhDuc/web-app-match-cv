# Design — `vietnamese-document-support` (Goal 8, Roadmap #3)

> Brainstorm 2026-08-08 qua `superpowers:brainstorming`.
> Hiện thực **Goal 8** (`project-goals.md` §4 + §6.5). Spec tầng goal: `specs/goals-8-9-10/design.md` §2.
> Feature **BE-only**, thuần logic — không đổi DTO, endpoint, schema DB, hay FE.

## 1. Vấn đề

`keywordScore` chiếm **40% trọng số** điểm tổng. Với tài liệu tiếng Việt, con số đó là nhiễu.

Nguyên nhân ở `server/src/modules/matching/matching.service.ts:124` — regex tách token là `[^a-z0-9+#.]+`. Mọi ký tự có dấu (`ệ`, `á`, `ể`…) không nằm trong `a-z0-9+#.` nên **bị coi là dấu phân cách**, băm vụn từ tiếng Việt:

```
CV: "Kinh nghiệm 3 năm phát triển hệ thống với ReactJS và Node.js"
→  ['kinh', 'nghi', 'ph', 'tri', 'th', 'ng', 'reactjs', 'node.js']

JD: "3 years experience developing systems with React and Node.js"
→  ['years', 'experience', 'developing', 'systems', 'with', 'react', 'and', 'node.js']

overlap = ['node.js']                 keywordScore ≈ 12%
```

`nghiệm` → `nghi`, `phát` → `ph`, `triển` → `tri`, `hệ thống` → `th` + `ng`, `năm` → mất hẳn (2 mảnh 1 ký tự, dưới `MIN_TOKEN_LENGTH`).

### 1.1 Tầng lỗi thứ hai — Unicode normalization

Cùng một chữ `nghiệm` được lưu 2 kiểu tuỳ nguồn text: **NFC** (6 codepoint, `ệ` là 1 ký tự) hoặc **NFD** (8 codepoint, `e` + dấu tổ hợp). `pdf-parse` hay sinh NFD.

Tokenizer hiện tại băm 2 kiểu này ra **2 kết quả rác khác nhau**:

```
NFC "nghiệm" → ['nghi']
NFD "nghiệm" → ['nghie']
```

Nên hai tài liệu cùng nội dung, khác nguồn, còn không khớp nổi phần rác của nhau.

### 1.2 Kết quả sau khi sửa (prototype đã chạy)

```
CV: "Kinh nghiệm 3 năm phát triển hệ thống với ReactJS và Node.js, đã dùng PostgreSQL"
JD: "Tuyển lập trình viên có kinh nghiem phat trien he thong React, Node, Postgres"
                                    ↑ JD viết không dấu

overlap: kinh nghiem phat trien he thong react node postgresql
keywordScore: 12% → 69%
```

## 2. Phạm vi

### Trong phạm vi

| Hạng mục | Ghi chú |
|---|---|
| Tokenizer Unicode-aware | `\p{L}` thay `a-z` |
| Chuẩn hoá NFC + **bỏ dấu** khi so khớp | Quyết định §3.1 |
| Stopword tiếng Việt | Lưu ở **dạng đã bỏ dấu** |
| Alias map kỹ thuật (~40 entry) | Quyết định §3.2 |
| Script tính lại `keywordScore` / `overallScore` cho `MatchResult` đã lưu | §5 |

### Ngoài phạm vi

| Hoãn | Lý do |
|---|---|
| **Token 1 ký tự** (ngôn ngữ `C`, `R`) | Hạn chế **có sẵn** hôm nay, không liên quan tiếng Việt. Cần cơ chế whitelist riêng — feature khác |
| **Chữ CJK dính thành một token** *(phát hiện ở final review)* | `\p{L}` khớp cả Hán/Kana nên `Java开发工程师` thành **một** token; tokenizer cũ tách được `java`. Đây là **hồi quy hành vi**, không chỉ là ngôn ngữ chưa hỗ trợ — nhưng JD tiếng Trung/Nhật nằm ngoài thị trường của sản phẩm. Ghi nhận, không sửa ở feature này |
| **Test cho script recompute** | Script là công cụ chạy tay một lần, đã chạy thật và verify idempotent. Viết test cần mock DB — chi phí không tương xứng |
| Tách từ ghép tiếng Việt | ADR #14 — xem `specs/goals-8-9-10/design.md` §2.3 |
| Từ điển VI↔EN cho cặp lệch ngôn ngữ | `project-goals.md` §5 Non-Goals — vế semantic gánh |
| Trích skill / skill-level overlap | `unfinished-features.md` #4 |
| Tính lại `semanticScore` | Cần gọi lại embedding = tốn tiền, mà vế semantic vốn không hỏng |

## 3. Quyết định thiết kế

### 3.1 Bỏ dấu khi so khớp

**Quyết định**: chuẩn hoá NFC rồi **gỡ dấu** trước khi so — `nghiệm` → `nghiem`.

**Lý do**: CV/JD tiếng Việt trong ngành thường viết thiếu dấu hoặc không đồng nhất, và `pdf-parse` có thể làm hỏng dấu tuỳ font. Đo trên chính ví dụ §1.2 (CV có dấu ↔ JD không dấu):

| | keywordScore | Khớp được gì |
|---|---|---|
| **Bỏ dấu** | **69%** | `kinh nghiem phat trien he thong react node postgresql` |
| Giữ dấu | 31% | `kinh react node postgresql` |

Giữ dấu vẫn được 31% vì từ khoá kỹ thuật vốn không dấu — nhưng **toàn bộ phần tiếng Việt mô tả kinh nghiệm thì mất sạch**, đúng cái mà chân keyword sinh ra để đo.

**Chấp nhận đánh đổi**: vài cặp khác nghĩa bị gộp (`mã`/`má`/`ma`, `hóa`/`họa`/`hoa`). Không đáng kể vì `keywordScore` là **tỉ lệ tổng hợp trên hàng trăm token**, không phải phép tra nghĩa từng từ.

**Đã loại**: *giữ dấu* (chính xác ngữ nghĩa hơn nhưng vỡ khi hai bên viết khác kiểu) và *index kép có dấu/không dấu với trọng số riêng* (thêm một hằng số tuỳ tiện vào công thức điểm, khiến `keywordScore` không còn là phép đếm giải thích được).

### 3.2 Alias bằng bảng tra nhỏ tự soạn

**Quyết định**: `ALIAS_MAP` ~40 entry, module-local, chỉ chứa alias thật sự hay gặp trong CV/JD Việt Nam (`reactjs`/`react.js` → `react`, `k8s` → `kubernetes`, `postgres` → `postgresql`, `js` → `javascript`…). Thiếu thì thêm một dòng.

**Đã loại quy tắc thuật toán** (kiểu "bỏ hậu tố `js`"): sinh kết quả sai khó đoán — `angularjs` → `angular` gộp **hai framework khác nhau** — và không xử được `k8s` → `kubernetes` hay `postgres` → `postgresql`, tức là vẫn phải có bảng tra bên cạnh.

### 3.3 Tách `tokenizer.ts` khỏi service

**Quyết định**: file mới `server/src/modules/matching/tokenizer.ts` export `tokenize(text): Set<string>` + các bảng từ. `matching.service.ts` giữ `keywordScore` / `cosine` / `combineOverall`, chỉ đổi phần thân `keywordScore` thành gọi `tokenize()`.

**Lý do**: `matching.service.ts` đã ~240 dòng chứa cả engine lẫn CRUD; thêm ~80 stopword tiếng Việt + ~40 alias + logic chuẩn hoá nữa thì file làm quá nhiều việc. Module `documents` đã có tiền lệ đúng pattern này (`parsing.ts` là domain-helper tách riêng, xem skill `module-struct`).

Ba hàm tính điểm **ở lại service** vì chúng là một bộ, đang được test cùng chỗ.

## 4. Pipeline chuẩn hoá

```
lowercase
 → bỏ dấu: normalize("NFD") + xoá \p{M}, rồi đ → d
 → tách: /[^\p{L}\p{N}+#.]+/u
 → cắt dấu chấm thừa đầu/cuối token
 → bỏ token < MIN_TOKEN_LENGTH (2)
 → tra ALIAS_MAP → dạng chuẩn
 → bỏ stopword (EN + VI)
 → Set
```

**Hai điểm trong thứ tự này là cố ý, không tuỳ tiện:**

1. **`đ → d` phải xử lý riêng** — `đ` là chữ cái độc lập trong Unicode (U+0111), **không phải** `d` + dấu tổ hợp, nên `\p{M}` không đụng tới. Bỏ sót bước này thì `đã`/`da`, `được`/`duoc` không khớp nhau.
2. **Alias TRƯỚC stopword** — nếu lọc stopword chạy trước, một alias key tình cờ trùng stopword sẽ bị giết trước khi kịp ánh xạ. Thứ tự này rẻ và bảo vệ mọi alias thêm về sau.

> **Sửa lại khi viết plan (2026-08-08)**: bản design đầu có một bước `normalize("NFC")` riêng đứng trước bước gỡ dấu. **Bước đó thừa** — `normalize("NFD")` bên trong hàm gỡ dấu đã tự gộp cả input NFC lẫn NFD về một dạng (đã kiểm chứng bằng test). Giữ lại chỉ là code chết. Mục tiêu §1.1 vẫn đạt, chỉ bằng một bước thay vì hai.

### 4.1 Bẫy phải tránh: `ai`

**`ai` TUYỆT ĐỐI KHÔNG được cho vào stopword tiếng Việt.** Trong tiếng Việt `ai` là đại từ nghi vấn nên nhìn rất giống stopword, nhưng **`AI` là từ khoá kỹ thuật quan trọng bậc nhất** trong CV/JD ngành này. Prototype đã kiểm chứng `ai` sống sót qua pipeline.

Cùng loại rủi ro, hai từ nữa **không được** cho vào danh sách tiếng Việt: `ma` (`mã` = code, gỡ dấu thành `ma` trùng với `mà`) và `nam` (`năm` = year — "3 năm kinh nghiệm" là thông tin, không phải nhiễu).

**Nguyên tắc**: khi phân vân giữa *"là stopword"* và *"có thể là từ khoá kỹ thuật"* → **không cho vào danh sách**. Bỏ sót một stopword chỉ làm loãng điểm chút ít; giết nhầm một từ khoá kỹ thuật làm sai hẳn kết quả.

> **Hạn chế đã biết — `it`**: bản design đầu nói thứ tự alias-trước-stopword sẽ "cứu" được `it` (IT = công nghệ thông tin), vốn đang nằm trong `STOPWORDS` tiếng Anh. **Không đúng** — muốn cứu thì `ALIAS_MAP` phải ánh xạ `it` sang một dạng chuẩn khác, mà trong CV tiếng Anh thì `it` (đại từ) phổ biến hơn hẳn `IT` (ngành), nên gỡ nó khỏi stopword sẽ thêm nhiễu nhiều hơn là được. **Quyết định: giữ `it` là stopword và chấp nhận đây là hạn chế**, cùng bậc với token 1 ký tự (`C`, `R`) ở §2. Thứ tự alias-trước-stopword **vẫn giữ** vì nó đúng và không tốn gì, chỉ là lý do biện minh cho nó không còn là `it`.

### 4.2 Stopword tiếng Việt lưu ở dạng đã bỏ dấu

Vì pipeline bỏ dấu trước khi lọc, danh sách phải viết `va`, `cua`, `duoc`, `nhung` — **không** phải `và`, `của`, `được`, `những`. Ghi comment rõ trong file để người sau không thêm nhầm dạng có dấu (thêm vào cũng không lỗi, chỉ là không bao giờ khớp).

## 5. Script tính lại điểm cũ

`server/scripts/recompute-keyword-scores.ts`, chạy bằng `yarn recompute-scores`.

- **Chỉ tính lại `keywordScore` + `overallScore`**; `semanticScore` giữ nguyên như đã lưu.
- **Phải áp `capForMatch(MAX_MATCH_CHARS = 20_000)` y hệt engine.** Điểm gốc tính trên text **đã cắt** (`matching.service.ts:173-182`); không cắt thì số mới lệch so với một lần match thật — tức là ta thay một kiểu sai bằng một kiểu sai khác.
- **Dry-run là mặc định** — in bảng `id · điểm cũ → điểm mới`; muốn ghi phải truyền `--apply`. Với thao tác sửa hàng loạt dữ liệu, mặc định an toàn quan trọng hơn mặc định tiện.
- **Idempotent** — `keywordScore` là hàm thuần của `rawText`, chạy lại cho cùng kết quả.
- Không lo mất `rawText`: `DELETE /documents/:id` đã có 409-guard chặn xoá tài liệu đang được một match dùng.

**Vì sao bắt buộc chạy** (không phải tuỳ chọn): để lẫn hai hệ điểm trong cùng bảng `MatchResult` sẽ khiến **Goal 9** (so delta giữa các phiên bản CV) đọc ra số vô nghĩa — user thấy "điểm tăng 15%" trong khi thực tế chỉ là công thức đổi.

## 6. Test

### `tokenizer.spec.ts` (mới)

Theo convention project — 5 kỹ thuật test-design, tag inline:

| Tag | Case |
|---|---|
| `[EP]` | Text tiếng Anh thuần **không đổi kết quả** — test hồi quy quan trọng nhất |
| `[EP]` | Tiếng Việt có dấu ra token đúng |
| `[EP]` | Tiếng Việt **không dấu** ra **cùng token set** với bản có dấu |
| `[BVA]` | Input NFD cho kết quả đúng bằng NFC |
| `[BVA]` | Token dài đúng 1 bị bỏ; dài đúng 2 được giữ |
| `[Decision table]` | Alias × stopword: `it` sống sót nhờ alias chạy trước; **`ai` không bị lọc** |
| `[Error guessing]` | Chữ `đ` · text lẫn Việt–Anh · chuỗi chỉ có dấu câu · chuỗi rỗng · `C++` / `C#` / `Node.js` giữ được ký tự đặc biệt |

`[State transition]`: **N/A** — `tokenize` là hàm thuần, không có trạng thái.

### `matching.service.spec.ts` (bổ sung)

Thêm test **bất biến**, không assert con số cụ thể:

> Cặp *CV có dấu ↔ JD không dấu* phải cho **cùng `keywordScore`** với cặp *CV có dấu ↔ JD có dấu*.

Assert quan hệ chứ không assert `69%`: con số sẽ đổi mỗi lần ai đó thêm một dòng vào stopword list, và test giòn là test sẽ bị vô hiệu hoá thay vì được sửa.

## 7. Cổng quy trình

| Cổng | Quyết định | Lý do |
|---|---|---|
| **§4.3 E2E** | **SKIP** | Không UI mới, không flow mới. Đã verify: `client/e2e/cv-jd-matching-wizard/helpers.ts` dùng `MatchResult` **stub cắm thẳng DB** (82/90/74), không gọi engine → đổi tokenizer không làm vỡ E2E |
| **§4.5 Security review** | **CHẠY** | Xử lý text do user nạp. Soi: regex `\p{L}` có backtracking không (đánh giá ban đầu: không — character class, không lồng quantifier), và input đã bị chặn ở 20k ký tự trước khi vào `keywordScore` |
| **§4.6 Drift audit** | **CHẠY cho `server/.claude/CLAUDE.md`** | Thêm `tokenizer.ts` vào mô tả module + `yarn recompute-scores` vào bảng Commands. `techstack/backend.md` **không đổi** (không thêm dependency). `erd.md` **không đổi** (không đổi schema) |
| **§4.7 Green checks** | `yarn lint` → `type-check` → `test` → `build` trong `server/` | |
| **Worktree** | `docs/` + `server/` | Không đụng `client/` |

## 8. Tiêu chí thành công

1. Ví dụ §1.2 cho `keywordScore` ≥ 60% (hiện 12%).
2. Cặp CV↔JD tiếng Anh thuần **không bị giảm điểm** — không phá cái đang chạy đúng.

   > **Sửa lại sau final review (2026-08-08)**: bản đầu viết là *"cho **đúng điểm** như trước khi sửa"*. **Sai.** Hai thay đổi của feature này cũng cải thiện một số cặp tiếng Anh, nên điểm có thể **tăng**:
   > - **Alias**: CV `"PostgreSQL skills"` ↔ JD `"Postgres and MySQL"` trước là 0%, giờ là 50% (`postgres` → `postgresql`).
   > - **Cắt dấu chấm ở rìa token**: `"Senior developer."` trước cho token `developer.` nên không bao giờ khớp `developer`; giờ khớp.
   >
   > Cả hai đều là cải thiện có chủ ý. Tiêu chí đúng phải là **không hồi quy**, không phải **bất biến**.
3. Cặp *CV có dấu ↔ JD không dấu* cho cùng điểm với cặp *cả hai đều có dấu*.
4. Input NFC và NFD của cùng một văn bản cho cùng token set.
5. `yarn recompute-scores --apply` chạy xong, mọi `MatchResult` cũ mang điểm theo công thức mới; chạy lại lần hai không đổi gì.
