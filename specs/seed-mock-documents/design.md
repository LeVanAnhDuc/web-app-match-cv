# Design — Seed mock CV/JD documents (dev tooling)

> Brainstorm 2026-08-11 qua `superpowers:brainstorming`.
> Scope: **dev tooling trong `server/`**. Không thêm endpoint, không đổi schema, không chạm `server/src/**`.

## 1. Vấn đề

Một DB vừa `migrate reset` chỉ có `STUB_USER_ID` và không có một document nào. Muốn bấm thử wizard, Document Library (`/cv`, `/jd`), hay match history, phải tự tay upload/dán 2 tài liệu mỗi lần — và nội dung mỗi lần một khác nên điểm số giữa 2 phiên không so sánh được với nhau.

Cần: **một lệnh chèn bộ CV/JD mock cố định, và một lệnh xoá sạch chúng đi** — không để lại dấu vết, không chạm dữ liệu thật.

## 2. Phạm vi

| Trong phạm vi                                             | Ghi chú                                        |
| --------------------------------------------------------- | ---------------------------------------------- |
| File dữ liệu mock cho CV + JD                             | 3 CV + 3 JD, thuần data                        |
| `yarn seed:mock` — chèn / làm mới mock                    | Idempotent                                     |
| `yarn seed:mock:clean` — xoá mock + match sinh ra từ mock | Chỉ theo **dial** id hằng số                   |
| Ghi chú lệnh mới vào `server/.claude/CLAUDE.md` §Commands | Drift audit §4.6                               |

| Ngoài phạm vi                        | Lý do                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Cột `Document.isMock`                | Cần migration, và cột đó lộ ra mọi query / DTO / export manifest chỉ để phục vụ dev tooling. Id hằng số đạt cùng mục đích, phí 0.  |
| Mock `MatchResult` / `CoverLetter`   | Cả hai là **output của AI**. Mock chúng nghĩa là bịa ra report và điểm số — dữ liệu trông thật nhưng không phải do engine sinh ra, đúng thứ gây nhầm lẫn khi debug. Mock chỉ cung cấp **input**; điểm số phải do engine tính thật. |
| File gốc PDF/DOCX (`fileData`)       | Phải commit binary fixture vào repo. Mock `sourceFormat = text` đủ cho matching / library / wizard; endpoint stream file gốc trả 404 — đúng hành vi của một document dán text thật. |
| Endpoint API để seed                 | Đây là dev tooling, không phải tính năng sản phẩm. Một endpoint ghi dữ liệu mock là attack surface không có lý do tồn tại.         |
| Unit spec cho script                 | Xem §7.                                                                                                                           |

## 3. Nhận diện mock — "dial" id hằng số

Mock dùng UUID cố định, phân dải (**dial**) theo kind:

```
CV : 10000000-0000-4000-8000-<12 chữ số>      → 10000000-0000-4000-8000-000000000001
JD : 20000000-0000-4000-8000-<12 chữ số>      → 20000000-0000-4000-8000-000000000001
```

Nhìn một id là biết ngay nó là mock và mock loại gì.

Đây là quyết định thiết kế **quan trọng nhất** của phiên này, vì nó là thứ khiến `clean` an toàn: mọi `where` của bước xoá đều khoá theo **dial** — 24 ký tự đầu cố định của UUID. Không có `deleteMany` nào chạy theo `userId`, theo `isSaved`, hay theo tiền tố `title`. Hệ quả: **không tồn tại đường nào để `clean` xoá một document thật**, kể cả khi dữ liệu thật và mock cùng thuộc `STUB_USER_ID` (hiện tại đúng là vậy — auth deferred).

Xoá theo **dial** chứ không theo danh sách id hiện tại: nếu đánh số lại hoặc bỏ một fixture, row đã nằm trong DB sẽ **vĩnh viễn** vô hình với `clean` — và vì dùng chung `STUB_USER_ID`, nó không còn cách nào phân biệt với một document thật.

### 3.1 Id PHẢI là UUIDv4 hợp lệ — `4` và `8` không phải cho đẹp

Phiên bản đầu của feature này dùng `10000000-0000-0000-0000-00000000000N`, và **nó hỏng**. `Document.id` là cột `TEXT` nên seed vào bình thường, `/cv` và `/jd` liệt kê bình thường — nhưng **mọi endpoint ghi đều trả 400**, vì tất cả đều validate id bằng `@IsUUID()` của class-validator, và validator.js ≥ 13.12 đòi nibble version ∈ `1-8` cùng nibble variant ∈ `8/9/a/b`.

Đo bằng chính DTO thật:

```
plainToInstance(CreateMatchDto, { cvDocumentId: '10000000-0000-0000-0000-000000000001', … })
→ 2 errors: "cvDocumentId must be a UUID", "jdDocumentId must be a UUID"

plainToInstance(CreateMatchDto, { cvDocumentId: '10000000-0000-4000-8000-000000000001', … })
→ 0 errors
```

Ảnh hưởng nếu không sửa: seed xong, mở wizard, chọn CV-01 + JD-01, bấm "Run match" → 400, **không bao giờ tới service**. Cùng lỗi đó ở `POST /match/runs`, `POST /cover-letters`, `POST /cv-rewrite`, `PATCH /documents/:id/parent`, `GET /comparison`. Chỉ danh sách library và `GET/PATCH/DELETE /documents/:id` sống, vì `ParseUUIDPipe` của NestJS mang regex riêng lỏng hơn. Tức là mock **trông ổn và không dùng được** — đúng thứ feature này tồn tại để cung cấp.

Hai điều đáng ghi lại:

- **`STUB_USER_ID` KHÔNG phải UUID hợp lệ** (`00000000-…-0001` cũng sai nibble). Nó chỉ chưa bao giờ đi qua một boundary có validate, nên nó **không chứng minh được gì** về những gì API nhận. Lấy nó làm tiền lệ chính là cái bẫy đã sập.
- **Bẫy này lọt qua verification vì §7 không chạm tầng HTTP** — chỉ đo tầng DB (Prisma) và hàm thuần (`tokenizer` + `keywordScore`). Đã bổ sung ở §7.

`assertFixturesValid()` giờ kiểm id bằng **chính `isUUID` của class-validator**, không phải regex tự viết, để guard không thể lệch khỏi thứ DTO thật dùng.

Bộ đếm được zero-pad thành đủ 12 chữ số của nhóm cuối, nên fixture thứ 10 vẫn là chuỗi 36 ký tự hợp lệ thay vì tràn thành 37.

Hai phương án bị loại:

- **Cột `isMock`** — sạch về semantics nhưng đòi migration, và một cột chỉ dành cho dev tooling sẽ phải được nhớ tới ở mọi DTO và ở `export-manifest.ts` về sau.
- **Tiền tố `[MOCK]` trong `title`** — mong manh hai chiều: user rename trên UI là mất dấu (mock thành rác vĩnh viễn), và user tự đặt title `[MOCK] …` sẽ bị xoá oan.

## 4. Bộ dữ liệu — 3 CV + 3 JD

| Nhãn      | id đầy đủ                              | kind | lang | Nội dung                                         |
| --------- | -------------------------------------- | ---- | ---- | ------------------------------------------------ |
| **CV-01** | `10000000-0000-4000-8000-000000000001` | CV   | VI   | Backend Engineer — NestJS/Node/PostgreSQL/Prisma  |
| **CV-02** | `10000000-0000-4000-8000-000000000002` | CV   | EN   | Backend Engineer — cùng profile, bản tiếng Anh    |
| **CV-03** | `10000000-0000-4000-8000-000000000003` | CV   | VI   | Frontend Developer — React/Tailwind/Figma         |
| **JD-01** | `20000000-0000-4000-8000-000000000001` | JD   | VI   | Senior Backend Engineer (NestJS)                  |
| **JD-02** | `20000000-0000-4000-8000-000000000002` | JD   | EN   | Senior Backend Engineer (NestJS)                  |
| **JD-03** | `20000000-0000-4000-8000-000000000003` | JD   | VI   | Data Engineer (Python/Spark)                      |

Chung: `userId = STUB_USER_ID`, `sourceFormat = text`, `fileData = null`, `fileMime = null`, `isSaved = true` (hiện trong `/cv` và `/jd`, chọn lại được ở bước reuse của wizard), `parentId = null`. Mỗi doc ~250–400 từ — đủ dài để `keywordScore` có ý nghĩa thống kê chứ không dao động theo một hai từ.

**Vì sao 6 doc chứ không phải 2.** Bộ này được chọn để cross-match ra một ma trận điểm có hình dạng biết trước. Dưới đây là `keywordScore` **đo thật** (vế keyword thuần cục bộ, không gọi AI — chạy qua `tokenizer.ts` + `MatchingService.keywordScore` trên chính 6 fixture này):

| | JD-01 (BE·VI) | JD-02 (BE·EN) | JD-03 (Data·VI) |
| --- | --- | --- | --- |
| **CV-01** (BE·VI) | **60** | 15 | 43 |
| **CV-02** (BE·EN) | 14 | **33** | 5 |
| **CV-03** (FE·VI) | 28 | 2 | 30 |

Giá trị của hình dạng đó:

1. **Có cả ca điểm cao lẫn điểm thấp** để nhìn UI ở hai đầu thang — một bộ mock chỉ ra 85% không cho biết màu/copy của trạng thái điểm thấp trông thế nào.
2. **Trong cùng một ngôn ngữ, cặp đúng nghề luôn thắng cặp sai nghề.** VI: `CV-01×JD-01` = 60 > `CV-03×JD-01` = 28 (frontend ứng backend) và > `CV-01×JD-03` = 43 (backend ứng data). EN: `CV-02×JD-02` = 33 cao hơn mọi cặp khác của CV-02. Đây là bất biến thật của bộ fixture.
3. **Chéo ngôn ngữ sụp điểm** (`CV-01×JD-02` = 15, `CV-02×JD-01` = 14) — đúng như ADR #14 nói: vế keyword **không** hỗ trợ VI↔EN (không có từ điển; vế semantic gánh). Có sẵn cặp này trong mock nghĩa là hành vi đó quan sát được, thay vì là một ghi chú trong doc.

### 4.1 Phát hiện: điểm keyword VI và EN KHÔNG cùng thang

Phiên brainstorm ban đầu của doc này giả định "CV-01×JD-01 phải xấp xỉ CV-02×JD-02" và coi đó là bộ đối chứng hồi quy cho tokenizer. **Giả định đó sai**, và chính bộ fixture này chứng minh:

| Cặp | Điểm | Ghi chú |
| --- | --- | --- |
| CV-01 (BE·**VI**) × JD-03 (Data·VI) | **43** | Hai tài liệu **không liên quan gì về nghề** |
| CV-02 (BE·**EN**) × JD-03 (Data·VI) | **5** | **Cùng một người, cùng kinh nghiệm**, chỉ khác ngôn ngữ |

Biến duy nhất là ngôn ngữ của CV. Trong 55 token trùng của cặp 43%, chỉ 3 token là kỹ thuật (`engineer`, `sql`, `pipeline`); 52 token còn lại là âm tiết tiếng Việt phổ thông xuất hiện trong mọi tin tuyển dụng: `kinh` `nghiem` `cong` `ty` `thiet` `ke` `thoi` `gian` `lam` `viec` `xay` `dung` `du` `lieu` `yeu` `cau`…

**Nguyên nhân**: tiếng Việt được tách theo **âm tiết**, không tách từ ghép (chủ ý — ADR #14). Vốn từ nghề nghiệp trung tính của tiếng Việt phân rã thành các âm tiết lặp lại ở mọi tài liệu, nên **hai tài liệu tiếng Việt bất kỳ đã có sẵn sàn trùng lặp ~30–43%** bất kể nội dung. Tiếng Anh tách theo từ nguyên vẹn nên sàn chỉ ~5%.

Lập luận của ADR #14 — "cả CV và JD đều viết cùng cách nên đếm overlap vẫn đúng" — đúng với **tín hiệu**, nhưng không nói gì về **sàn nhiễu**. Hệ quả thực tế:

- `keywordScore` của tài liệu VI **không so sánh được** với `keywordScore` của tài liệu EN. 43% (VI, sai nghề) cao hơn 33% (EN, đúng nghề).
- Tỷ lệ tín hiệu/sàn của tiếng Việt kém: đúng nghề 60 so với sai nghề 43 — chỉ cách nhau 17 điểm.

Goal 8 đã sửa việc tokenizer **băm vụn** chữ có dấu; nó **không** sửa việc lệch thang này. Đây là phát hiện **ngoài phạm vi** của feature seed data — đã ghi vào `docs/unfinished-features.md` để xử lý riêng. Việc bộ fixture phơi ra được nó chỉ sau một lệnh là chính lý do chọn 6 doc thay vì 2.

Ngưỡng cứng **không** được ghi thành điều kiện pass/fail: điểm phụ thuộc phiên bản tokenizer/alias table và sẽ trôi. Bất biến là **thứ tự trong cùng ngôn ngữ** (mục 2) và **sụp điểm khi chéo ngôn ngữ** (mục 3), không phải con số.

## 5. Kiến trúc — 2 file, tách data khỏi runner

```
server/scripts/mock-documents.ts   ← dữ liệu seed cho CV + JD (thuần data)
server/scripts/seed-mock.ts        ← runner: chèn, hoặc --clean để xoá
```

- **`mock-documents.ts`** — export `MOCK_CV_IDS`, `MOCK_JD_IDS`, `MOCK_DOCUMENT_IDS` (hợp của hai), và `MOCK_DOCUMENTS` (mảng bản ghi đủ field). Import duy nhất: enum từ `@prisma/client`. Không có logic, không gọi DB → thêm/sửa một CV mock là mở đúng một file, không cần hiểu gì về Prisma.
- **`seed-mock.ts`** — toàn bộ tương tác DB. Không chứa văn bản CV dài nên logic đọc được trong một màn hình.

Đặt ở `scripts/` (cạnh `recompute-keyword-scores.ts`) chứ **không** phải `prisma/seed.ts`, vì `prisma/seed.ts` chạy tự động mỗi lần `prisma migrate dev`. Trộn mock vào đó nghĩa là mọi lần migrate đều tự nhồi mock vào DB — mất chính quyền kiểm soát mà tính năng này tồn tại để cung cấp.

`STUB_USER_ID` import từ **`src/common/current-user/current-user.service.ts`**, không phải từ `prisma/seed.ts`: file seed gọi `main()` ở top-level, nên `import` nó sẽ chạy seed như một side effect.

## 6. Hành vi

### `yarn seed:mock`

1. Upsert `STUB_USER_ID` (`role: candidate`) — để chạy được trên DB trắng chưa `prisma db seed`.
2. Upsert từng mock document theo `id`. Nhánh `update` ghi lại **đầy đủ** mọi field, không phải `update: {}`.
3. In bảng tóm tắt: id · kind · lang · title · số ký tự `rawText`.

`update` đầy đủ là có ý: nó khiến lệnh này vừa là "chèn" vừa là "làm mới". Chạy lại sau khi đã rename mock trên UI, hoặc sau khi lỡ sửa nội dung, sẽ trả mock về đúng trạng thái gốc. Với dữ liệu thật thì ghi đè như vậy là sai; với mock thì đó chính là hành vi mong muốn.

### `yarn seed:mock:clean`

Trong **một** `$transaction`, đúng thứ tự khoá ngoại:

```
isMockId = id startsWith CV_ID_DIAL  OR  id startsWith JD_ID_DIAL

1. deleteMany matchResult  where cvDocument matches isMockId OR jdDocument matches isMockId
                              → CoverLetter tự cascade (onDelete: Cascade)
2. deleteMany matchRun     where cvDocument matches isMockId OR jdDocument matches isMockId
3. deleteMany document     where isMockId
```

In số row đã xoá ở từng bước.

- **Vì sao phải xoá `MatchResult`/`MatchRun` trước:** hai model đó trỏ tới `Document` bằng relation **bắt buộc không có `onDelete`** → Postgres mặc định `RESTRICT`. Xoá document trước sẽ bị chặn ngay khi mock từng được đem đi match. Một match sinh ra từ document mock thì bản thân nó cũng là mock, nên xoá cùng là đúng ngữ nghĩa, không phải mở rộng phạm vi.
- **Vì sao trong transaction:** một exception ở giữa sẽ để lại DB nửa vời — match đã mất nhưng document vẫn còn, hoặc ngược lại.
- **Không xoá `STUB_USER_ID`:** đó là seed bắt buộc (`prisma/seed.ts`, khớp `CurrentUserService`), không phải mock. Xoá nó làm sập toàn bộ app.
- **Không có bước xử lý `parentId`** — cố ý, không phải bỏ sót. Nếu một document **thật** từng được khai là phiên bản mới của một mock (`PATCH /documents/:id/parent`), quan hệ lineage dùng `onDelete: SetNull` (`schema.prisma`), nên xoá mock cha chỉ làm `parentId` của document thật về `null`. Document thật sống nguyên vẹn, và không có lỗi khoá ngoại. Một bước xoá thủ công ở đây sẽ là dư.
- Match giữa **hai document thật** không thoả `where` nào ở trên → không bị chạm.

### Giao diện lệnh

```jsonc
"seed:mock":       "ts-node --compiler-options {\"module\":\"CommonJS\"} scripts/seed-mock.ts"
"seed:mock:clean": "ts-node --compiler-options {\"module\":\"CommonJS\"} scripts/seed-mock.ts --clean"
```

Hai npm script riêng (cùng một file TS, phân biệt bằng `--clean`) thay vì bắt người dùng tự gõ flag: lệnh xoá phải là thứ đọc `package.json` là thấy, và không thể gõ nhầm thành lệnh chèn.

`ts-node --compiler-options {"module":"CommonJS"}` khớp nguyên dạng `recompute-scores` sẵn có. `DATABASE_URL` không cần nạp thủ công — đã xác minh `PrismaClient` tự đọc `.env` khi chạy qua ts-node.

## 7. Xác minh

Script dev-only, không thêm unit spec — khớp tiền lệ `recompute-keyword-scores.ts`, và `jest` có `rootDir: src` nên spec nằm trong `scripts/` sẽ không được `yarn test` nhặt lên. Với script trực tiếp đọc/ghi DB, chạy thật cho bằng chứng mạnh hơn một unit test trên fixture thuần:

1. Đếm `document` / `matchResult` / `matchRun` / `coverLetter` / `user` trước — và làm việc này trên **DB có dữ liệu thật**, không phải DB trống. Đây mới là chỗ chứng minh được "không chạm dữ liệu thật".
2. `yarn seed:mock` → phải có đúng 6 document mock, đọc lại kiểm `kind` / `isSaved` / `sourceFormat` / `fileData` / `parsedContent` / `parentId` / owner / độ dài `rawText`.
3. `yarn seed:mock` **lần hai** → vẫn đúng 6 (chứng minh idempotent, không nhân bản).
4. Sửa tay một mock (title + `isSaved` + `rawText`) → `yarn seed:mock` → cả ba trở về gốc (chứng minh nhánh làm mới).
5. Tạo `MatchRun` + `MatchResult` + `CoverLetter` trỏ vào mock, **và** một document **thật** có `parentId` trỏ vào mock → `yarn seed:mock:clean` → mock biến hết, document thật sống với `parentId = null`, số đếm về đúng bước 1, `STUB_USER_ID` còn nguyên.
6. `yarn seed:mock:clean` lần hai khi không còn mock → `0/0/0`, exit 0.
7. **Kiểm tầng HTTP — BẮT BUỘC, không được bỏ.** Cho id mock đi qua **DTO thật** (`plainToInstance(CreateMatchDto, …)` + `validateSync`) và khẳng định **0 error**. Bước này thiếu ở phiên bản đầu, và đó chính là lý do bug §3.1 lọt: bước 1–6 chỉ chạm tầng DB, tầng DB nhận mọi chuỗi vì `Document.id` là `TEXT`. Một fixture có thể qua sạch 6 bước đầu mà vẫn 400 ở mọi endpoint ghi.
8. `yarn format` → `yarn lint` → `yarn type-check` → `yarn test` → `yarn build` xanh hết.
9. `npx prisma db seed` vẫn chạy (vì `prisma/seed.ts` giờ import `STUB_USER_ID` từ `src/`, xem §5).

**Bài học của §7**: verification chỉ mạnh bằng tầng thấp nhất mà nó chạm. Đo ở tầng DB và ở hàm thuần thì bỏ lọt đúng lớp mà dữ liệu phải đi qua để có ích — lớp validate.

## 8. E2E Scenario Matrix

**N/A** — thay đổi không chạm `client/src/**` và không thêm/đổi hành vi nào user quan sát được qua UI. Theo `.claude/CLAUDE.md` §4.3, trigger E2E là hành vi UI; dev tooling CLI nằm ngoài.

Ghi chú: bug §3.1 **không** phải bằng chứng cần E2E cho feature này — nó bị bắt bằng cách cho id đi qua DTO thật (§7 bước 7), rẻ hơn E2E nhiều và ở đúng tầng gây lỗi.

## 9. Ảnh hưởng dữ liệu cũ

Không có. Không đổi schema, không migration, không sửa row nào ngoài các id trên dial mock.

Riêng việc **đổi shape id** ở §3.1: không cần migration vì shape cũ chưa bao giờ được merge vào `main`, và đã kiểm DB không còn row nào trên shape cũ trước khi chốt. Nếu về sau có đổi dial lần nữa thì phải dọn tay các row cũ, vì `clean` chỉ biết dial hiện tại (đây là lý do xoá theo dial thay vì theo danh sách id — xem §3).
