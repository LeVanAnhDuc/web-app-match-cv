# Security review — `ai-credentials`

> Rà 2026-08-08 trên `feat/ai-credentials` vs `origin/main`, cả `server/` (38 file, +1977/−352) và `client/` (27 file, +1805/−11).
> Slash `/security-review` không chạy được ở root monorepo (root không phải git repo, và skill cần `origin/HEAD`); đã set `origin/HEAD` cho từng repo và rà theo đúng checklist của nó: auth/authz, input validation, crypto & secrets, injection, data exposure.

## Verdict: ✅ PASS *(kèm 1 precondition vận hành, xem §3)*

Không có finding HIGH hoặc MEDIUM nào trong code do feature này thêm vào.

## 1. Bất biến bảo mật — đối chiếu từng cái với code

| # (design.md §5) | Bất biến | Kết quả |
|---|---|---|
| 1 | Ciphertext trio không rời tầng service | ✅ `AiCredentialDto.fromEntity` map tường minh 10 field, **không** có `encryptedKey`/`keyIv`/`keyTag`. Grep toàn `src/` (trừ spec + DTO input): 3 cột chỉ xuất hiện trong `ai-credentials.service.ts` và trong comment của DTO. |
| 2 | `AiRuntimeConfig` không bao giờ serialize | ✅ Chỉ `MatchingService` và `AiCredentialsService.test()` tiêu thụ; không controller nào trả về; không có `@ApiProperty`. |
| 3 | Không log body lỗi provider | ✅ Grep `console.` / `Logger` / `logger` trong `modules/ai`, `modules/ai-credentials`, `common/crypto` → **không có gì**. Mọi `catch` giữ dạng `catch { throw ... }`. `mapProviderError` có đọc `error.message` để phân loại 400, nhưng **chỉ regex-test rồi bỏ** — không lưu, không trả, không log. |
| 4 | Swagger `writeOnly` | ✅ `apiKey` đánh `writeOnly: true` ở cả create lẫn update DTO; example là placeholder `sk-xxxx…`. |
| 5 | Throttle `/test` | ✅ `@Throttle({ default: { limit: 10, ttl: 60_000 } })`, chặt hơn global 100/60s. |
| 6 | Ràng buộc input | ✅ `apiKey` `@Length(20,400)` + `@Matches(/^\S+$/)`; `label` `@Length(1,60)`; model `@Length(1,120)` + no-whitespace; `provider` `@IsEnum`; `credentialId` `@IsUUID`. Global `ValidationPipe({ whitelist: true })` loại field lạ → **không sửa được `provider` qua PATCH** (DTO update cố ý không khai báo nó). |
| 7 | Query scope theo `userId` | ✅ `findOwned()` dùng `findFirst({ where: { id, userId } })`; `list()` dùng `findMany({ where: { userId } })`. `update`/`remove`/`test`/`getRuntimeConfig` đều gọi `findOwned` trước. `markUsed` chỉ chạy sau khi `getRuntimeConfig` đã kiểm ownership. |
| 8 | FE không render key gốc | ✅ Chỉ `••••{keyLast4}`; ô key khi sửa để trống (`apiKey: undefined` trong `setFieldsValue`); `Input.Password` + `autoComplete="off"`. |

## 2. Các hướng tấn công đã rà và loại

**Crypto (AES-256-GCM)** — thuật toán đúng, khoá 32 byte kiểm tra độ dài sau decode base64, **IV 12 byte random mỗi lần ghi** (không tái dùng nonce — lỗi chí mạng của GCM), auth tag set trước `final()` nên ciphertext bị sửa sẽ throw. Spec chứng minh: sửa 1 byte ciphertext → throw; sửa tag → throw; giải bằng khoá khác → throw; 2 lần mã hoá cùng plaintext cho IV và ciphertext khác nhau. Không tự sinh khoá tạm.

**SSRF** — `baseUrl` **không** nhận input user: nó tra từ `PROVIDERS` const bằng enum `provider`. User chỉ điều khiển được *tên model*, đi vào **JSON body**, không vào URL/host/protocol. Không có đường nâng lên SSRF.

**Header / CRLF injection** — `apiKey` bị regex `^\S+$` chặn mọi whitespace kể cả `\r`/`\n` trước khi tới header `Authorization` của SDK.

**Injection vào DB** — toàn bộ qua Prisma parameterised; không có raw SQL nào trong diff.

**XSS** — FE là React, không có `dangerouslySetInnerHTML` nào trong diff. Giá trị hiển thị (`label`, `keyLast4`, tên model) đi qua JSX text node.

**IDOR** — id là UUID, và mọi truy cập đều kèm `userId` trong `where`. Trả `404` (không phải `403`) cho tài nguyên của người khác → không rò rỉ sự tồn tại.

**Race check-then-insert trên label** — cố ý **không** check trước; để unique constraint `(userId, label)` quyết định rồi map `P2002` → `409`. Hai request đồng thời không thể cùng thắng.

**Lỗi ngoài `P2002`** — `asDomainError` trả lại nguyên error, Nest coi là 500 và trả body generic; không serialize message của Prisma ra ngoài.

## 3. Precondition vận hành — không phải bug mới, nhưng **nặng hơn kể từ feature này**

`project-goals.md` ADR #9 đã ghi: chưa có auth nên **mọi caller dùng chung một mock user**. Trước feature này, hệ quả xấu nhất là đọc được CV/JD của nhau. Từ nay, cùng một hệ quả có nghĩa là **bất kỳ ai gọi được API đều đọc được `keyLast4`, dùng được, test được và xoá được credential của người khác** — tức tiêu quota trên tài khoản nhà cung cấp của họ.

Code **không** làm precondition này tệ đi (mọi query đã scope theo `userId`, chỉ là `userId` hiện đến từ hằng số). Nhưng nó nâng mức thiệt hại nếu precondition bị vi phạm.

**Giữ nguyên và nhấn mạnh**: KHÔNG deploy public cho tới khi Roadmap #6 (Auth/SSO) xong. Khi đó `CurrentUserService.getUserId()` đổi nguồn là đủ — không luồng nghiệp vụ nào phải viết lại.

Kèm theo: `CREDENTIAL_ENCRYPTION_KEY` là secret vận hành. Đổi/mất khoá làm **mọi credential đã lưu không giải mã được** (đúng thiết kế — không có đường khôi phục). `.env.example` đã ghi rõ điều này và không chứa giá trị thật.

## 4. Kiểm chứng bằng test

- `credential-crypto.service.spec` — 7 case về khoá, IV, tamper ciphertext/tag, khoá sai.
- `ai-credentials.service.spec` — assert DTO không chứa `encryptedKey`/`keyIv`/`keyTag`; assert `data` gửi xuống Prisma **không chứa plaintext key**; assert `findFirst` luôn kèm `userId`; assert 404 cho id của người khác trên cả 3 đường (`getRuntimeConfig`/`remove`/`update`); assert 503 khi crypto chưa cấu hình.
- `matching.service.spec` — assert `JSON.stringify(dto)` của `MatchResultDto` không chứa plaintext key.
- `ai.service.spec` — assert `mapProviderError` không nhầm một error *giống* `APIError` thành `APIError` thật.
- **Còn thiếu (chờ DB)**: `test/ai-credentials.e2e-spec.ts` — assert toàn bộ response body dạng chuỗi không chứa key gốc, và ownership 404 với credential của `userId` khác. Xem `plan.md` Task 6.
