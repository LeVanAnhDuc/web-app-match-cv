# Security Report — seed-mock-documents

> Review 2026-08-11, branch `chore/seed-mock-documents` (repo `server/`).
> Phạm vi: `scripts/mock-documents.ts`, `scripts/seed-mock.ts`, `eslint.config.mjs`, `package.json`, README + CLAUDE.md/rules (tài liệu, không review bảo mật).

## Verdict: ✅ PASS

Không có finding HIGH hoặc MEDIUM.

## Vì sao review này chạy dù là dev tooling

`.claude/CLAUDE.md` §4.5 cho phép **skip** khi thay đổi không chạm attack surface. Thay đổi này đúng là không thêm attack surface (không endpoint, không nhận input user, không đụng auth/crypto). Vẫn review vì nó **xoá dữ liệu** — và đó là loại code mà sai một dòng `where` sẽ mất dữ liệu thật, không sửa được.

## Bề mặt đã rà

| Hạng mục | Kết quả |
| --- | --- |
| SQL / NoSQL injection | Không. Toàn bộ query qua Prisma client (tham số hoá). Không có `$queryRaw`/`$executeRaw`. |
| Input do attacker kiểm soát | Không có. Nội dung 6 document là hằng số trong source; đường vào duy nhất là flag CLI `--clean`, và CLI flag/env là **trusted value** trong mô hình rủi ro. |
| Command injection | Không. Hai npm script mới gọi `ts-node` trên đường dẫn file tĩnh, không nội suy biến nào. |
| Authn / authz | Không đổi. Script import `STUB_USER_ID` như một hằng số; không sửa `CurrentUserService`, không thêm đường bỏ qua guard. |
| Secrets / crypto | Không. Không hardcode key, không đọc `CREDENTIAL_ENCRYPTION_KEY`, không gọi mạng, không đụng `AiCredential`. |
| Data exposure qua log | `console.log` chỉ in id / kind / language / title / độ dài `rawText` của fixture. Không in secret, không in nội dung tài liệu thật. |
| PII | Tên, email, số điện thoại trong fixture đều **bịa**; domain là `example.com` (RFC 2606) nên không tới được hộp thư thật. Không có PII thật trong repo. |
| Path traversal / file I/O | Không có thao tác file nào. `fileData` luôn ghi `null`. |
| Deserialization | Không. Không `eval`, không YAML/pickle, không parse input ngoài. |

## Thuộc tính an toàn quan trọng nhất, đã kiểm bằng chạy thật

Nhánh xoá chỉ khoá theo **dial UUID hằng số** (24 ký tự đầu cố định), không theo `userId`, `isSaved`, hay tiền tố `title`. Điều này quan trọng vì mock và dữ liệu thật hiện **dùng chung `STUB_USER_ID`** (auth deferred) — một `deleteMany({ where: { userId } })` sẽ xoá sạch dữ liệu thật của user. Dial dài 24 ký tự nên không thể trùng với id sinh tự động của document thật.

Kiểm chứng trên DB có dữ liệu thật sẵn (không phải DB trống), có cả `MatchRun`/`MatchResult`/`CoverLetter` sinh từ mock **và** một document thật `parentId` trỏ vào mock:

| | trước seed | sau seed + dữ liệu phái sinh | sau clean |
| --- | --- | --- | --- |
| documents | 2 | 9 (2 thật + 6 mock + 1 thật-con-của-mock) | **3** → 2 sau khi xoá control |
| matchResults | 3 | 4 | **3** |
| matchRuns | 1 | 2 | **1** |
| coverLetters | 3 | 4 | **3** |
| users | 1 | 1 | **1** |

2 document thật + 3 match thật + 3 cover letter thật **không bị chạm**. Document thật trỏ `parentId` vào mock **sống sót** với `parentId = null` (`onDelete: SetNull`). `STUB_USER_ID` còn nguyên. Không còn row nào trên dial mock. Chạy `clean` lần hai khi không có mock → `0/0/0`, exit 0 (không lỗi FK, không xoá lan).

## Bổ sung sau code review

Code review phát hiện **id mock ban đầu không phải UUIDv4 hợp lệ** nên mọi endpoint ghi trả 400 (`@IsUUID()`). Đây là lỗi **chức năng**, không phải lỗ hổng bảo mật — nhưng đã sửa và ghi lại ở `design.md` §3.1. Việc sửa **không** làm thay đổi kết luận bảo mật: nhánh xoá vẫn khoá theo dial hằng số, và toàn bộ bảng số ở trên được **đo lại** sau khi sửa, không phải chép lại từ lần đo trước.

## Ghi nhận (không phải finding)

**`dist/scripts/seed-mock.js` có mặt trong build production.** `tsconfig.build.json` chỉ exclude `node_modules`, `test`, `dist`, `**/*spec.ts`, nên `scripts/` được compile vào `dist/`.

Không xếp là lỗ hổng, vì:

- Đây là **hành vi sẵn có**, không do PR này tạo: `dist/prisma/seed.js` và `dist/scripts/recompute-keyword-scores.js` đã nằm đó từ trước.
- Để chạy được nó, attacker phải **đã có khả năng thực thi code** trên server — lúc đó họ đã có `DATABASE_URL` và toàn quyền DB, script này không thêm gì.
- Bán kính thiệt hại bị chặn ở 6 UUID hằng số + match sinh ra từ chúng, chứ không phải toàn bộ bảng.

Nếu sau này muốn siết, cách đúng là thêm `scripts` vào `exclude` của `tsconfig.build.json` — nhưng đó là hardening chung cho cả 3 script, nên thuộc một thay đổi riêng, không nhét vào PR này.
