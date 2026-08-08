# Security review — `cover-letter-generator`

> §4.5 của root `.claude/CLAUDE.md`. Slash `/security-review` không chạy được từ session này (setup shell của nó giả định cwd là repo gốc), nên dùng đường dự phòng: dispatch một security-audit subagent rà `git diff origin/main` của **cả 2 repo code** theo trục auth/authz, input, data-exposure, injection, migration.
>
> Ngày: **2026-08-09** · Branch `feat/cover-letter-generator`.

## Verdict

# ✅ **PASS**

Không có finding **Critical / High / Medium**. Cả 8 bất biến bảo mật ở `design.md` §7 đều được hiện thực, và các bất biến về isolation có test BE e2e phủ.

## Findings

| # | Sev | Vị trí | Nội dung | Xử lý |
|---|---|---|---|---|
| 1 | Low | `server/src/modules/cover-letters/prompt.ts` | **Giả mạo dấu phân đoạn trong prompt.** JD thường được **dán từ tin tuyển dụng của bên thứ ba** → là input không tin cậy. Một dòng `--- CV ---` cài trong JD kèm kinh nghiệm bịa có thể khiến model đọc đoạn đó như CV thật — đúng thứ ADR #13 sinh ra để chặn. Tác động giới hạn ở **tính toàn vẹn của bản nháp** (output chỉ quay về đúng user, render plain text, không có tool/network nào mở ra). | ✅ **ĐÃ SỬA** — `sanitise()` xoá mọi dòng có **hình dạng** dấu phân đoạn khỏi cả CV lẫn JD, và 2 section thật được gắn **nonce ngẫu nhiên mỗi request** (`--- JD <uuid> ---`); system prompt nói rõ chỉ marker mang nonce mới là marker. Có test: `prompt.spec.ts` → `describe("section-marker forgery")`. |
| 2 | Low | `server/src/modules/ai/ai.service.ts` | **Output của model được lưu không giới hạn.** `chat.completions.create` không đặt `max_tokens`, và `body` ghi thẳng vào cột `content` — trong khi đường `PATCH` lại chặn ở 20k. Hai đầu của cùng một cột bất đồng. | ✅ **ĐÃ SỬA** — `max_tokens: 1_200` (prompt vốn nhắm 150–350 từ) + cắt `body` về `20_000` ký tự trước khi ghi, khớp đúng cận của `UpdateCoverLetterDto`. |
| 3 | Low | `dto/cover-letter.dto.ts`, `schema.prisma`, locales | Tập đóng `errorCode` **ghi trong tài liệu** có `timeout`, nhưng enum `AiTestStatus` không có member đó (timeout bị gộp thành `unreachable`). Cột cũng là `TEXT` tự do, nên "tập đóng" là quy ước tầng service chứ không có ràng buộc DB. | ✅ **ĐÃ SỬA nửa quan trọng** *(2026-08-09, sau khi 7a merge — xem §"Quyết định về `errorCode`" bên dưới)*: `timeout` thành member thật của `AiTestStatus` và **thực sự được phát ra**; cột **giữ nguyên `TEXT`** có lý do. |
| 4 | Low | `cover-letters.controller.ts` + `app.module.ts` | **Throttle theo IP, không theo principal.** `POST /cover-letters` đã siết 10/60s (§7.7 đạt), nhưng `ThrottlerGuard` key theo IP và auth còn defer → client phân tán vẫn lách được trần chi phí AI. | ⏭️ Chấp nhận ở MVP, đúng như ADR #9 đã chốt (**không deploy public trước khi Auth xong**). Re-key theo `userId` khi Roadmap #10 về. |
| 5 | Low | `cover-letters.service.ts` `update`/`remove` | **TOCTOU trên vị từ ghi**: `findOwned(id)` rồi ghi bằng `where: { id }` — ownership nằm ở thứ tự gọi chứ không nằm trong vị từ. Không khai thác được hôm nay (`userId` của một row không bao giờ đổi). | ⏭️ Không sửa — **khớp đúng prior art đã duyệt** ở `ai-credentials.service.ts`. Đổi riêng chỗ này sẽ tạo hai kiểu code cho cùng một việc. |
| 6 | Info | `client/.../CoverLetterModal/index.tsx` | `URL.revokeObjectURL` gọi đồng bộ ngay sau `anchor.click()` có thể huỷ download ở một số trình duyệt. Lỗi chức năng, không phải bảo mật. | ✅ **ĐÃ SỬA** — hoãn revoke sang `setTimeout(..., 0)`. |
| 7 | Info | `migration.sql` + service | `credentialId` là `ON DELETE SET NULL`, nên sau khi xoá credential, thư cũ đọc ra `credentialId: null` và UI hiểu là "chạy bằng key hệ thống". Sai lệch **nhật ký**, không phải sai lệch isolation. | ⏭️ Chấp nhận — giống hệt ngữ nghĩa `MatchResult.credentialId` đã chốt ở `erd.md`. |

## Các trục đã rà và KHÔNG có phát hiện

- **Per-user isolation / IDOR** — mọi lệnh đọc Prisma đều scope: `requireUsableMatch` dùng `findFirst({ where: { id, userId } })`; `list` filter theo **cả** `userId` lẫn `matchResultId`; `findOwned` phủ `update`/`remove`. Đường credential uỷ quyền cho `AiCredentialsService.getRuntimeConfig` → `findOwned`, nên `credentialId` của người khác **404 trước khi** tốn bất kỳ call AI nào hay ghi row nào. Kiểm tra ngữ cảnh match chạy **trước** phân giải credential → đúng thứ tự Decision Table ở `design.md` §8 row 4. `matchResultId` của người khác trên `GET` trả `[]`, không phải 403. Có test: `server/test/cover-letters.e2e-spec.ts`.
- **Rò rỉ secret** — `CoverLetterDto` là mapper liệt kê từng field, chỉ mang `credentialId` + `provider` + `chatModel`; không có `encryptedKey`/`keyIv`/`keyTag`/`apiKey`. Không có `console`/`Logger` nào trong module. Swagger example là `"no_quota"`, không phải key. Có assertion `JSON.stringify(body)` không chứa key gốc ở cả unit lẫn e2e.
- **Xử lý lỗi** — `errorCode` chỉ nhận `AiProviderError.reason`. `mapProviderError` đọc message của provider **trong bộ nhớ** để phân loại rồi vứt đi; message của `AiProviderError` là chuỗi i18n cố định. Text thô của provider không bao giờ tới DTO, log, hay response.
- **Validate input** — 4/4 field của `CreateCoverLetterDto` được validate (`@IsUUID`, 3 × `@IsEnum`); query bắt buộc `@IsUUID`; `content` có `@Length(1, 20000)`. Không có chuỗi không giới hạn phía request. Path param qua `ParseUUIDPipe`. Text nguồn cap 20k/tài liệu.
- **XSS / injection ở FE** — không có `dangerouslySetInnerHTML`, `innerHTML`, `eval` ở bất kỳ file mới nào. `content` render qua `Input.TextArea`, `omittedRequirements` qua text children — cả hai đều được React escape; **không** có markdown renderer, nên §7.6 được bảo đảm bằng **cấu trúc** chứ không bằng kỷ luật. Clipboard có `catch` báo cho user thay vì nuốt lặng. Endpoint builder dùng `encodeURIComponent`.
- **An toàn migration** — `20260808171742_add_cover_letter/migration.sql` **thuần additive**: 4 `CREATE TYPE`, 1 `CREATE TABLE`, 1 `CREATE INDEX`, 3 `ADD CONSTRAINT`. **Không** `DROP`, **không** `ALTER` bảng nào đang có, **không** đụng `Document` — đúng ràng buộc chạy song song với feature 7a. Cascade hợp lý: `userId`/`matchResultId` CASCADE, `credentialId` SET NULL.

## Quyết định về `errorCode` (finding 3) — chốt 2026-08-09

Finding 3 ban đầu bị hoãn "vì 7a đang làm gần đó". 7a **đã merge**, nên lý do hoãn không còn. Tách làm **hai** câu hỏi, và chúng có hai câu trả lời khác nhau:

### (a) `timeout` được ghi trong tài liệu nhưng không bao giờ xảy ra → **ĐÃ SỬA**

Đây là lỗi thật, và là loại tệ nhất trong tài liệu: nó **nói dối một cách kiểm chứng được**. `erd.md`, Swagger description, `schema.prisma` comment và cả `README` đều liệt kê `timeout`; FE thậm chí đã ship sẵn bản dịch `result.error.timeout` cho **cả `en` lẫn `vi`**. Nhưng `withTimeout` lại reject bằng `unreachable`, nên câu chữ đó **không có đường nào hiện ra**.

Đã sửa:

- `AiTestStatus` thêm member `timeout` (migration `add_timeout_test_status` — `ALTER TYPE ... ADD VALUE`, thuần additive, không đụng dữ liệu cũ);
- `withTimeout` reject bằng `AiTestStatus.timeout`;
- `SEVERITY_ORDER` xếp `timeout` **nặng hơn** `unreachable` (biết là quá chậm cụ thể hơn là không rõ vì sao không tới) nhưng nhẹ hơn `model_unavailable`;
- `ping()` bắt lỗi bằng `asProviderError(error).reason` thay vì `mapProviderError(error)` — nếu không, một lần test connection hết giờ đã được phân loại đúng lại **bị san phẳng** về `unreachable`;
- FE: `AiTestStatus` type, màu của `TestStatusTag`, và nhãn `credentials.status.timeout` cho `en` + `vi`.

Có test: `ai.service.spec.ts` → `describe("the timeout guard")`, dùng fake timer để chứng minh provider treo cho ra `reason: "timeout"`, và kiểm cả thứ tự severity.

### (b) Cột `errorCode` có nên đổi từ `TEXT` sang enum không → **KHÔNG, giữ `TEXT`**

Hai lý do, cái thứ hai là cái quyết định:

1. **Ràng buộc đã có ở đúng chỗ cần.** Người ghi vào cột này **chỉ có một**: `AiProviderError.reason`, kiểu `AiTestStatus`. TypeScript đã chặn giá trị lạ ngay tại điểm ghi duy nhất đó. Enum ở DB sẽ là lớp thứ hai bảo vệ một cửa vốn đã khoá.
2. **Không có enum nào đúng để dùng.** `AiTestStatus` chứa `ok` — một giá trị **không bao giờ** hợp lệ cho `errorCode`. Gắn cột với nó nghĩa là DB sẽ vui vẻ nhận `errorCode = 'ok'`, tức lớp "bảo vệ" mới lại cho qua một trạng thái vô nghĩa. Còn đúc một enum thứ hai (`AiErrorCode`) chỉ để bỏ `ok` thì tạo ra **hai enum lệch nhau 1 member**, và mỗi lần thêm mã lỗi phải nhớ sửa cả hai — một nguồn drift mới, đổi lấy thứ TypeScript đã lo.

Ngoài ra `errorCode` mang tính **ghi chú lịch sử**: nó lưu cách hệ thống *đã* phân loại một lần hỏng trong quá khứ. Kiểu chữ khoan dung hơn cho dữ liệu như vậy — bỏ một mã khỏi tập đóng sẽ không bắt phải viết migration cast cho những row đã tồn tại.

**Điều kiện để đảo quyết định**: nếu về sau có **đường ghi thứ hai** vào `errorCode` (ví dụ một job nền hoặc một module khác tự phân loại lỗi), thì lập luận (1) sụp và lúc đó nên đúc `AiErrorCode` riêng cho cả `MatchResult` lẫn `CoverLetter`.

## Follow-up để lại (không chặn PR)

1. Re-key throttler theo `userId` khi Auth/SSO về (finding 4).
