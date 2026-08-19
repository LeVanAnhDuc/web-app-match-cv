# Design — `data-export` (Goal 10 phần 1/3, Roadmap #5)

> Brainstorm 2026-08-08 qua `superpowers:brainstorming`.
> Hiện thực **phần đầu của Goal 10** (`project-goals.md` §4 + §6.7). Hai phần còn lại tách ra — xem §11.
> Cross-stack: `server/` + `client/`.

## 1. Vấn đề

App lưu 4 thứ về mỗi user — `Document` (kèm file PDF/DOCX gốc), `MatchResult`, `AiCredential`, `User` — và **không có đường nào để user lấy chúng ra**. CV chứa PII bậc cao (tên, email, số điện thoại, lịch sử làm việc), và Goal 6 vừa merge còn gửi nội dung đó tới nhà cung cấp AI bên ngoài.

Feature này trả lời đúng một câu hỏi: *"cho tôi bản sao mọi thứ app đang giữ về tôi."*

Ba nhu cầu nó phục vụ:

1. **Nhìn được app giữ gì về mình** — quyền cơ bản với dữ liệu PII.
2. **Mang đi nơi khác** — không bị giam dữ liệu trong app này.
3. **Giữ bản sao trước khi xoá** — tiền đề cho phần "xoá sạch" sẽ làm sau (§11).

## 2. Phạm vi

### Trong phạm vi

| Hạng mục | Ghi chú |
|---|---|
| `GET /me/export` trả file zip | Stream, không nạp hết vào RAM |
| `data.json` trong zip | Toàn bộ dữ liệu có cấu trúc |
| `documents/<slug>.<ext>` | File PDF/DOCX **gốc** user đã upload |
| Route FE `/my-data` + mục sidebar | Một trang, một nút, trạng thái tải |

### Ngoài phạm vi

| Hoãn | Lý do |
|---|---|
| **Xoá sạch dữ liệu** (`DELETE /me/data`) | User nói **chưa cần** (2026-08-08). Vẫn thuộc Goal 10, làm sau — xem §11 |
| **Nhật ký `DataDisclosure`** | Phải chèn ghi log vào `AiService`, mà `feat/multi-provider-compare` đang sửa chính file đó. Chờ nó merge |
| **In / lưu PDF báo cáo match** | Nhu cầu khác hẳn (định dạng để đọc, không phải để lấy dữ liệu ra) → roadmap riêng, xem §11 |
| Chọn lọc export từng phần | Export là "toàn bộ" hoặc không có nghĩa. Không thêm bộ lọc |
| Import ngược | Chưa có nhu cầu |

## 3. Quyết định thiết kế

### 3.1 Zip, không phải một file JSON hay một PDF

Export chứa **hai loại dữ liệu về bản chất khác nhau**: file nhị phân (PDF/DOCX user đã upload) và dữ liệu có cấu trúc (điểm số, báo cáo JSON, metadata). JSON không nhét được file nhị phân vào một cách dùng được; PDF không nhét được dữ liệu có cấu trúc vào một cách đọc-ngược-được. Zip chứa được cả hai.

**Đã loại — chỉ JSON**: mất file gốc. User upload bản `.docx` mà chỉ lấy lại được `rawText` thì không mang đi đâu được — đó là mất dữ liệu, không phải export.

**Đã loại — PDF**: PDF là định dạng **để đọc**, export là bài toán **về dữ liệu**. Xuất CV `.docx` thành PDF là đưa user một ảnh chụp CV chứ không phải CV: không sửa được, không nộp sang chỗ khác được. `MatchResult.report` là JSON có cấu trúc, vào PDF thành văn xuôi không chương trình nào đọc lại được. (Chuẩn PDF/A-3 có đính kèm file, nhưng gần như không viewer nào cho user lấy ra — lý thuyết có, thực tế vô dụng.) Nhu cầu "có bản PDF để đọc/in/gửi" là thật, nhưng nó là **feature khác** — §11.

### 3.2 Thêm dependency `archiver`

Node không có zip built-in, và project chưa có thư viện nén nào (`pdf-parse` chỉ đọc PDF). `archiver` stream thẳng ra response nên không nạp cả kho tài liệu vào RAM — quan trọng vì `fileData` cap 10MB mỗi file.

Đây là **dependency mới đầu tiên** của một feature trong dự án này. Đánh đổi được chấp nhận vì không có cách nào dựng zip mà không có thư viện, và phương án "không zip" đã bị loại ở §3.1.

### 3.3 Module mới `src/modules/me/`

Không nhét vào `documents` hay `matching` — export cắt ngang **mọi** module (documents + matching + ai-credentials + user). Đặt nó trong bất kỳ module nào trong số đó là chọn sai chủ sở hữu. `me` là module đại diện cho "dữ liệu của người dùng hiện tại", và là chỗ hai phần còn lại của Goal 10 sẽ đáp xuống.

### 3.4 Route FE `/my-data`, phẳng

Theo đúng convention hiện có (`/cv`, `/jd`, `/ai-credentials` đều phẳng dưới `_app/`), không lồng `/me/data`. Endpoint BE giữ `/me/export` vì đó là namespace API, khác chuyện đường dẫn UI.

## 4. Hợp đồng API

```
GET /api/v1/me/export
→ 200 application/zip
  Content-Disposition: attachment; filename="export-2026-08-08.zip"
  (streamed)
```

Không nhận tham số. Scope theo `CurrentUserService.getUserId()` như mọi endpoint khác.

**Bất biến**: tên file trong `Content-Disposition` do **server sinh** (`export-<ngày>.zip`), **không bao giờ** lấy từ dữ liệu user. Đây là thứ chặn header injection ngay từ thiết kế, không phải bằng lọc ký tự.

**Đọc nhất quán**: toàn bộ metadata (`Document` / `MatchResult` / `AiCredential`) đọc trong **một transaction** trước khi bắt đầu stream, để `data.json` và các file trong `documents/` là một ảnh chụp thống nhất — không bị đọc rách khi user upload tài liệu mới giữa chừng.

### 4.1 Bố cục zip

```
export-2026-08-08.zip
├── data.json
└── documents/
    ├── cv-le-van-anh-duc-a1b2c3.pdf
    └── jd-cmc-global-d4e5f6.docx
```

- Chỉ tài liệu có `fileData` mới có file riêng. Tài liệu paste-text chỉ nằm trong `data.json`.
- Tên file = slug của `title` + **6 ký tự đầu của `id`** + đuôi suy từ `fileMime`. Hậu tố id là bắt buộc: hai tài liệu cùng tiêu đề sẽ ghi đè nhau nếu không có nó.
- Đuôi mở rộng lấy từ `fileMime`, **không** từ tiêu đề user đặt — tiêu đề là dữ liệu user kiểm soát.

### 4.2 Hình dạng `data.json`

```jsonc
{
  "schemaVersion": 1,          // để bản export cũ vẫn đọc được khi hình dạng đổi
  "exportedAt": "2026-08-08T16:30:00.000Z",
  "user": { "id": "…", "role": "candidate", "createdAt": "…" },
  "documents": [
    {
      "id": "…", "kind": "CV", "title": "CV Le Van Anh Duc",
      "sourceFormat": "pdf", "isSaved": true, "createdAt": "…",
      "rawText": "LE VAN ANH DUC\nFront-End Developer…",
      "file": "documents/cv-le-van-anh-duc-a1b2c3.pdf"   // null nếu paste-text
    }
  ],
  "matchResults": [
    {
      "id": "…", "cvDocumentId": "…", "jdDocumentId": "…",
      "overallScore": 67, "semanticScore": 78, "keywordScore": 51,
      "provider": "openrouter", "chatModel": "…", "embedModel": "…",
      "report": { "strengths": [], "gaps": [], "suggestions": [] },
      "createdAt": "…"
    }
  ],
  "aiCredentials": [
    {
      "id": "…", "provider": "openai", "label": "Key cá nhân",
      "keyLast4": "4f2a", "chatModel": null, "embedModel": null,
      "lastTestStatus": "ok", "lastTestedAt": "…", "lastUsedAt": "…",
      "createdAt": "…"
    }
  ]
}
```

## 5. Bảo mật — ba bất biến

1. **`encryptedKey` / `keyIv` / `keyTag` KHÔNG BAO GIỜ vào zip.** `erd.md` đã đặt bất biến này cho `AiCredential`: ciphertext không rời tầng service. Export là bề mặt dễ vi phạm nhất vì nó đọc *mọi thứ* — đây là assertion quan trọng nhất của feature.
2. **Per-user isolation.** Mọi truy vấn scope theo `userId`. Zip của user này không được chứa một byte nào của user khác.
3. **Tên file trong zip không được thoát khỏi thư mục.** `title` là dữ liệu user kiểm soát; một tiêu đề kiểu `../../etc/passwd` phải bị slug hoá thành vô hại (zip-slip). Slug chỉ giữ `[a-z0-9-]`.

## 6. Frontend

Route `/my-data`, thêm mục sidebar (icon `Download` hoặc `Archive` theo `.claude/uiux/icon-map.md`).

Nội dung trang:
- Tiêu đề + đoạn mô tả **liệt kê rõ export gồm gì** — user phải biết mình sắp tải về cái gì trước khi bấm.
- Một nút tải, có trạng thái loading trong lúc server dựng zip.
- Ghi chú: file zip có chứa PII, tự bảo quản.

Không có bảng, không có bộ lọc, không có phân trang. Trang này cố tình đơn giản.

## 7. E2E Scenario Matrix

Rubric 12 dòng + 2 dòng riêng của feature. Cột `Gate`: `A+B` = cả 2 gate chạy; `A only` = gate B (MCP walk) chỉ verify render, không thực hiện tải file.

| # | Nhóm | Scenario / lý do N/A | Gate |
|---|---|---|---|
| 1 | **Happy path** | ✅ Bấm tải → nhận zip hợp lệ, mở ra có `data.json` + đúng 1 file cho mỗi tài liệu có `fileData` | A only |
| 2 | **AuthN** | **N/A** — app chưa có auth, chạy bằng mock user (`project-goals.md` §3). Không có màn login để test | — |
| 3 | **AuthZ** | **N/A ở tầng UI** — một role duy nhất, không có gì ẩn/hiện theo quyền. Per-user isolation là ràng buộc BE, đã có case ở BE e2e (§9) | — |
| 4 | **Validation** | ✅ *(critic bác đúng — xem ghi chú dưới bảng)* **[EP]** header cũng là input: `Range: bytes=0-100` trên stream không seek được → từ chối sạch (200 full hoặc 416), **không** trả zip hỏng; `Accept: application/json` → vẫn trả zip hoặc 406, không crash. Sai method (`POST /me/export`) → 404/405 | A only |
| 5 | **Empty / null** | ✅ **[EP]** 5 lớp: (a) 0 tài liệu → zip hợp lệ, `documents: []`, không có thư mục `documents/`; (b) paste-text → có trong JSON, `file: null`; (c) `parsedContent` null → không hỏng JSON; (d) **`fileData` null nhưng `fileMime` có giá trị** (dữ liệu lệch) → bỏ qua file, không 500; (e) paste-text với `rawText` rỗng → vẫn xuất hiện trong JSON, không bị loại | A only |
| 6 | **Boundary** | ✅ **[BVA]** số tài liệu `0` / `1` / `200` (số **entry** trong zip, không chỉ tổng dung lượng); `fileData` ở đúng cap **10MB** (max) và 1 byte (min) → stream đúng, không cắt cụt; tiêu đề **500+ ký tự** → tên entry không vượt giới hạn 255 ký tự mỗi thành phần đường dẫn | A only |
| 7 | **Filter / search** | **N/A** — trang không có bộ lọc, endpoint không nhận tham số lọc | — |
| 8 | **Data rendering** | ✅ Trang liệt kê đúng những gì export chứa. Đặt tên entry: tiếng Việt có dấu (`CV Nguyễn Văn A` → `cv-nguyen-van-a-<id6>`); đuôi lấy từ `fileMime` không từ tiêu đề; **hai tiêu đề khác nhau slug ra cùng chuỗi** (`Resume.pdf` vs `resume!!.pdf`) → hậu tố id tách chúng ra, không ghi đè; tiêu đề rỗng/toàn dấu câu/emoji → dùng `document` làm gốc; tên trùng **tên dành riêng của Windows** (`CON`, `NUL`, `COM1`) và tên có dấu chấm/khoảng trắng ở đầu-cuối → giải nén được trên Windows | A+B |
| 9 | **i18n** | ✅ Trang render đúng ở **cả `en` và `vi`**: tiêu đề, mô tả, nhãn nút, trạng thái loading, thông báo lỗi. Tên file zip **không** đổi theo locale | A+B |
| 10 | **Error / loading** | ✅ 500 → UI hiện lỗi, nút trở lại bấm được (không kẹt loading); đang dựng zip → nút loading. **Lỗi sau khi header đã gửi** (đọc DB hỏng ở tài liệu thứ 3/5) → huỷ kết nối, **không** trả zip cụt kèm `200 OK`; **client ngắt giữa chừng** → server huỷ archive, không tiếp tục nạp phần còn lại vào bộ nhớ | A+B (2 case cuối: A only) |
| 11 | **Mutation safety** | ✅ **[ST]** Read-only nên không cần revert. Hợp lệ: bấm lần 2 khi lần 1 đang bay → không tạo request thứ hai (nút disabled). **Không hợp lệ**: rời trang giữa chừng → không crash, không setState sau unmount, loading không kẹt vĩnh viễn. **Ảnh chụp nhất quán**: upload tài liệu mới trong lúc export đang stream → `data.json` và `documents/` phải khớp nhau, không đọc rách. Gọi thẳng API liên tục (curl loop) → `ThrottlerGuard` toàn cục (100 req/60s) chặn | A only |
| 12 | **Accessibility** | ✅ Nút có accessible name; tới được bằng Tab, kích hoạt bằng Enter/Space; trạng thái loading thông báo qua `aria-busy`/live region; **kết thúc thành công và thất bại cũng phải được thông báo**, không chỉ lúc bắt đầu | A+B |
| 13 | **Rò rỉ dữ liệu** *(feature-specific)* | ✅ **Quan trọng nhất.** Giải nén, tìm chuỗi trong **toàn bộ** nội dung zip: không có `encryptedKey`/`keyIv`/`keyTag`; `aiCredentials[]` chỉ có `keyLast4`; test với nhiều credential. **Zip-slip**: tiêu đề `../../etc/passwd` → entry vẫn nằm dưới `documents/`, slug chỉ giữ `[a-z0-9-]`. **`keyLast4` null (row cũ)** → mask an toàn, không rơi về key đầy đủ, không throw | A only |
| 14 | **Toàn vẹn file** *(feature-specific)* | ✅ File lấy ra từ zip **byte-identical** với bản đã upload — so bằng **hash**, không so kích thước. **Cờ UTF-8 của zip entry** phải bật, nếu không tên file tiếng Việt thành mojibake trong Explorer và các tool giải nén cũ | A only |

> **Vì sao nhiều dòng `A only`**: gate B lái browser thật qua Playwright MCP; nó kiểm được trang render và cú bấm có kích hoạt tải hay không, nhưng giải nén và soi nội dung zip là việc của test file (gate A). Gate B vẫn walk mọi dòng `A+B`.
>
> **Dòng 4 — bản nháp đầu tôi đánh N/A ("endpoint không nhận input"), completeness critic bác lại và đúng**: HTTP header *là* input do client kiểm soát. `Range` trên một stream không seek được là ca thật sự nguy hiểm — trả về một zip cụt kèm `200 OK` thì client tưởng tải xong. Đã đổi thành ✅.
>
> **Ba mục critic nêu mà tôi bác lại, kèm lý do**:
> - *Header injection qua `Content-Disposition`*: tên file tải về do **server sinh** (`export-<ngày>.zip`), không lấy từ tiêu đề user → không có đường tiêm. Đã ghi thành bất biến ở §4.
> - *`MatchResult` trỏ tới `Document` đã xoá*: không xảy ra được — FK bắt buộc, và `DELETE /documents/:id` đã có 409-guard chặn xoá tài liệu đang được match dùng.
> - *`STUB_USER_ID` cấu hình sai*: là rủi ro của kiến trúc mock user nói chung (`project-goals.md` §3), không phải của feature này. Không thuộc phạm vi.

## 8. Xử lý lỗi

| Tình huống | Hành vi |
|---|---|
| User chưa có dữ liệu gì | **200 + zip hợp lệ** với mảng rỗng. KHÔNG phải 404 — "tôi không có dữ liệu" là câu trả lời hợp lệ, không phải lỗi |
| Lỗi phát sinh **sau khi** header đã gửi | Zip đang stream nên không đổi được HTTP status. Phải **huỷ stream** (`archive.abort()` + destroy response) để client nhận file hỏng rõ ràng, thay vì một zip cụt trông như thành công |
| Client ngắt kết nối giữa chừng | Huỷ archive, giải phóng tài nguyên. Không để stream treo |
| Hai tài liệu trùng tiêu đề | Hậu tố `id` 6 ký tự trong tên file làm chúng khác nhau (§4.1) |
| Tiêu đề rỗng / toàn dấu câu | Slug rỗng → dùng `document` làm tên cơ sở, vẫn có hậu tố id |
| `fileData` null nhưng `fileMime` có giá trị | Bỏ qua file, `file: null` trong JSON. **Không 500** — dữ liệu lệch không được làm hỏng cả bản export |
| Tên file tiếng Việt trong zip | Bật **cờ UTF-8** cho entry. Thiếu nó thì Explorer và các tool giải nén cũ hiện mojibake |
| `rawText` chứa byte điều khiển từ PDF parse hỏng | `JSON.stringify` escape được hầu hết; loại bỏ ký tự null trước khi ghi để không hỏng file JSON |

## 9. Testing

**BE unit** — `buildExportManifest()` là hàm thuần, nhận entity trả về object `data.json`:
- Có credential → output chỉ chứa `keyLast4`; **không** chứa `encryptedKey`/`keyIv`/`keyTag`. Đây là test quan trọng nhất của feature.
- Tài liệu paste-text → `file: null`.
- Slug hoá: tiếng Việt có dấu, tiêu đề rỗng, tiêu đề chứa `../`, hai tài liệu trùng tiêu đề.

**BE e2e** — `GET /me/export`:
- Giải nén, khẳng định có `data.json` + đúng số file.
- **Per-user isolation**: seed tài liệu của user khác → không lọt vào zip.
- File lấy ra byte-identical với bản seed.

**FE** — render trang, trạng thái loading, trạng thái lỗi, cả 2 locale.

## 10. Cổng quy trình

| Cổng | Quyết định |
|---|---|
| **§1.5 SuperDesign** | **SKIP** — trang gồm tiêu đề + mô tả + một nút + trạng thái tải. Không layout mới, không component mới, không pattern tương tác nào mà `.claude/uiux/` chưa định nghĩa. SuperDesign tốn credits và upload source lên cloud; không tương xứng cho một cái nút |
| **§4.3 E2E** | **CHẠY** dual-gate — thêm route + UI mới, user tương tác được. Matrix ở §7 |
| **§4.5 Security review** | **CHẠY, bắt buộc** — feature này bản chất là "đóng gói toàn bộ PII của user rồi gửi ra ngoài". Soi: rò rỉ ciphertext credential, per-user isolation, zip-slip qua tên file, header injection qua `Content-Disposition` |
| **§4.6 Drift audit** | `.claude/techstack/backend.md` (thêm `archiver`) · `server/.claude/CLAUDE.md` (module `me`) · `client/.claude/CLAUDE.md` (route mới) |
| **§4.7 Green checks** | BE + FE: lint · type-check · test · build |
| **Worktree** | `docs/` + `server/` + `client/` |

## 11. Việc còn lại của Goal 10 (và một roadmap item mới)

| Việc | Trạng thái |
|---|---|
| **Xoá sạch dữ liệu** (`DELETE /me/data`) | **Hoãn theo yêu cầu user 2026-08-08** — chưa cần. Vẫn thuộc Goal 10 §6.7. Khi làm: xoá trong một transaction đúng thứ tự FK (`MatchResult` → `AiCredential` → `Document`), giữ lại row `User`, đặt vào vùng nguy hiểm của chính trang `/my-data` |
| **Nhật ký `DataDisclosure`** | Chờ `feat/multi-provider-compare` merge — cả hai cùng sửa `src/modules/ai/ai.service.ts` |
| **In / lưu PDF báo cáo match** *(roadmap item mới)* | Nhu cầu tách ra từ phiên này: cho user cầm bản báo cáo đi đọc/in/gửi. Khuyến nghị làm bằng **print stylesheet + `window.print()`** — 0 dependency, output khớp đúng những gì user thấy trên màn hình, và dùng lại được cho cover letter (Goal 7b). Các phương án server-side (`pdfkit`, `puppeteer`) đắt hơn hẳn mà phải dựng lại layout từ đầu |
