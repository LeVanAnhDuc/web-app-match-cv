# Security review — `cv-rewrite-assistant`

> §4.5 của root `.claude/CLAUDE.md`. Chạy 2026-08-09 bằng một security-audit subagent rà `origin/main...HEAD` + toàn bộ file chưa track ở cả `server/` lẫn `client/`.
> **Bắt buộc review** vì feature đụng đủ 3 trigger: input của user (CV text + payload accept), dữ liệu nhạy cảm (CV là PII, key AI của user), và một endpoint mới tiêu tiền trên key của user.

## Verdict

| Vòng | Verdict |
|---|---|
| Lần 1 (rà lần đầu) | ⚠️ **CONDITIONAL** — 2 HIGH về **availability** (không phải rò rỉ dữ liệu) |
| Lần 2 (sau khi fix) | ✅ **PASS** |

Không có finding nào về vượt biên user, rò key, hay XSS. Bất biến grounding của `design.md` §3 được cài đúng như mô tả. Toàn bộ HIGH nằm ở chỗ khác: **một request nhỏ có thể chiếm event loop của Node hàng giây tới hàng phút.**

## Findings + xử lý

| # | Sev | Chỗ | Vấn đề | Xử lý |
|---|---|---|---|---|
| 1 | **HIGH** | `grounding.ts` (`findAnchor` → `applyChanges`/`groundChanges`) | `normalize()` chạy **lại từ đầu trên toàn bộ CV cho MỖI thay đổi**. CV không bị cap ở đường grounding (`parsing.ts` cho tới 2M ký tự) → đo được **4.3 giây** block event loop cho 1 lần accept 25 thay đổi. `/cv-rewrite/accept` lại **không có throttle riêng** → ~100 req/phút × 4.3s = phục vụ được ~430 CPU-giây tấn công mỗi phút | ✅ Fixed — `normalize()` **nâng ra khỏi vòng lặp**: `findAnchorIn(haystack, original)` nhận haystack đã chuẩn hoá, `groundChanges`/`applyChanges` chuẩn hoá **một lần** cho cả tập. Thêm `@Throttle(20/60s)` cho `POST /cv-rewrite/accept` |
| 2 | **HIGH** | `grounding.ts` `groundChanges`, `ai.service.ts` `generateCvRewrite` | `MAX_CHANGES` chỉ `.slice()` **sau** vòng lặp → cap **output**, không cap **work**. CV đi thẳng vào prompt nên prompt-injection trong chính CV có thể lái model trả hàng nghìn change object nhỏ; mỗi cái kích hoạt một `normalize(2M)` (~220s block chỉ từ **một** request). Không có `max_tokens` nên không có trần độ dài phản hồi | ✅ Fixed — cắt **đầu vào**: `raw.slice(0, MAX_CHANGES)` trước vòng lặp; thêm `max_tokens: 8_000` cho lời gọi rewrite. Cộng với fix #1, mỗi vòng lặp giờ chỉ là một `indexOf` |
| 3 | MEDIUM | `ai.service.ts` | Không `max_tokens` → cost không trần, và khi không truyền `credentialId` thì chạy trên key **hệ thống** | ✅ Fixed cùng #2 |
| 4 | MEDIUM | `cv-rewrite.controller.ts` | Mỗi lần accept copy nguyên CV thành row `Document` mới → ~200MB/phút tăng trưởng DB từ một IP | ✅ Fixed bởi `@Throttle` ở #1 |
| 5 | LOW | `grounding.ts` | `{"changes":[null]}` (đạt được qua prompt-injection) → `TypeError` → 500 **sau khi** đã trả tiền cho lời gọi AI | ✅ Fixed — bỏ qua phần tử không phải object; có unit test |
| 6 | LOW | `ai.service.ts` → DTO | `unaddressedGaps` là chuỗi do model viết nhưng **không** bị cap (khác `sectionHint`/`rationale` đã có `clip()`) | ✅ Fixed — `clipGaps()`: tối đa 25 mục × 300 ký tự, bỏ mục rỗng; có unit test |
| 7 | LOW | `dto/accept-cv-rewrite.dto.ts` | `@Length(1,200)` chạy **trước** `trim()` ở service → title toàn khoảng trắng lọt qua, lưu thành rỗng | ✅ Fixed — `@Transform` trim **trước** `@Length` |
| 8 | LOW | `RewriteReview/index.tsx` `previewText` | `String.replace` với chuỗi literal → `$&` / `` $` `` / `$'` trong `replacement` (do model viết) bị hiểu là pattern thay thế → preview khác thứ server thực sự ghi. Preview chính là **bằng chứng user dựa vào để duyệt** (ADR #13) | ✅ Fixed — dùng dạng hàm `replace(original, () => replacement)` |
| 9 | LOW | `grounding.ts` `countOccurrences` | Quét hết haystack dù chỉ cần biết "đúng một lần" | ✅ Fixed — `isUnique()` dừng ở lần thứ 2 |
| 10 | INFO | `cv-rewrite.service.ts` | Chỉ chặn `status === failed` | ✅ Fixed — đổi thành **bắt buộc** `status === succeeded` |
| 11 | INFO | `current-user.service.ts` | Auth vẫn stub → throttle theo IP là control **duy nhất**. Không phải finding của feature này (ADR #6/#9 đã defer) nhưng nó **khuếch đại** #1/#2 từ "user tự hại mình" thành "ai cũng hại được service" | 📝 Ghi nhận. Precondition ADR #9 (**không deploy public trước khi có Auth**) vẫn còn nguyên hiệu lực |

**Cap grounding theo kích thước — cân nhắc và KHÔNG làm.** Reviewer gợi ý thêm `MAX_GROUNDING_CHARS` chặn CV quá lớn. Bị loại vì `applyChanges` trả về **chính văn bản sẽ được lưu**: cắt ở đó nghĩa là âm thầm cụt CV của user. Sau fix #1 chi phí còn **một** lần `normalize` mỗi request (~157ms với CV 2MB bệnh lý), và `@Throttle(20/60s)` giới hạn nó ở ~3 CPU-giây/phút — throttle là control đúng chỗ, không phải một lỗi 400 giáng vào CV dài hợp lệ.

## Đã verify là sạch (không cần sửa)

- **Per-user isolation** — mọi read scope theo `userId` từ `CurrentUserService`: `matchResult.findFirst({ id, userId })`, cả 2 document, credential qua `AiCredentialsService.findOwned`. `accept` ghi `userId`/`parentId` lấy từ **row đã sở hữu**, không DTO nào cho client đặt `userId` hay `parentId`. Cover bằng BE e2e (match của user khác → 404).
- **Không tin client ở `accept`** — đây là bề mặt đáng lo nhất của thiết kế (đề xuất không được lưu nên client gửi lại tập đã duyệt). `applyChanges` **dựng lại mọi neo từ `cvDoc.rawText` đọc từ DB**; chỉ neo duy nhất, không chồng lấn, trong giới hạn kích thước mới được thay; sai bất kỳ điều gì → **huỷ cả request, không ghi một phần**. Phần dư — caller tự đặt `replacement` cho CV **của chính họ** — đã nêu tường minh ở `design.md` §3 và vô hại (`sourceFormat: text`, render escape).
- **Secret** — `AiRuntimeConfig` không rời tầng service; DTO đề xuất chỉ lộ `provider` + `chatModel`. Không có `console`/`Logger` nào trong code mới. `mapProviderError` đọc message của provider trong bộ nhớ rồi **vứt đi**, chỉ trả `AiTestStatus` — body lỗi provider không bao giờ bị log hay echo. Assertion trong BE e2e: response không chứa key gốc.
- **XSS** — không có `dangerouslySetInnerHTML` trong code mới; `original`/`replacement`/`rationale`/`sectionHint`/`unaddressedGaps`/preview đều render dạng text node của JSX. E2E có case CV chứa `<script>` → assert `main script` và `main b` đều bằng 0.
- **Prompt injection** — hậu quả với `original` bị grounding giết; bịa ở mức **ngữ nghĩa** trong `replacement` được nói thẳng ở `design.md` §3 là **không chặn được**, và mitigation là **không tick sẵn cái nào** (user phải duyệt từng thay đổi). Hai hậu quả *chưa* được tài liệu hoá của injection chính là #2 và #5 ở trên — đã fix.
- **Bound của DTO** — `@Length(1,5000)` × `@Length(0,1500)` × `@ArrayMaxSize(25)` ≈ 162KB, trên trần JSON 100KB mặc định của Express nên transport chặn trước. Thừa, không sai.
- **Migration** — `ON DELETE SET NULL` khớp ADR #15; BE e2e cover "xoá bản gốc thì bản viết lại còn nguyên, chỉ mất liên kết".

## Ghi chú ngoài phạm vi

`POST /match` **không có throttle riêng** (`matching.controller.ts`) trong khi `POST /cv-rewrite` có 10/60s — tức endpoint cũ đang lỏng hơn endpoint mới. Không thuộc diff này; nên xử lý trong một thay đổi riêng ở module `matching`.
