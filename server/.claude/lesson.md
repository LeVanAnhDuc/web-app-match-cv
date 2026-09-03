# Lessons — server

## Prisma `Bytes` map ra `Uint8Array<ArrayBuffer>`, KHÔNG phải `Buffer` (2026-08-08, ai-credentials)

- **Triệu chứng**: `TS2740 'Uint8Array<ArrayBuffer>' is missing ... from type 'Buffer'`, rồi đổi sang `Uint8Array` lại ra `TS2322 'Uint8Array<ArrayBufferLike>' not assignable to 'Uint8Array<ArrayBuffer>'`.
- **Nguyên nhân**: Prisma 6 dùng `Uint8Array<ArrayBuffer>`; `node:crypto` trả `Buffer<ArrayBufferLike>` — hai type khác nhau.
- **Áp dụng**: khai payload là `Uint8Array<ArrayBuffer>` và convert bằng `new Uint8Array(buf)` ở biên. Trong spec, `Buffer.from(x).equals(...)` thay cho `x.equals(...)`.

## Route có segment tĩnh phải khai TRƯỚC route `:id` (2026-08-08)

- `GET /ai-credentials/providers` và `GET /match/runs/:id` bị `GET /:id` nuốt → `ParseUUIDPipe` trả **400** thay vì chạy handler đúng.
- **Áp dụng**: trong controller, đặt mọi route có segment tĩnh lên trên `:id`. Viết luôn một e2e assert `status).not.toBe(400)` để khoá thứ tự — refactor sau này đổi thứ tự sẽ đỏ.

## Thêm cột NOT NULL vào bảng đã có dữ liệu (2026-08-08)

- `prisma migrate dev` **từ chối** ("There are N rows in this table"). Cột nullable hoặc có `@default` thì tự backfill được, không cần can thiệp.
- **Áp dụng khi thật sự cần NOT NULL không default**: `npx prisma migrate dev --name <x> --create-only` → sửa tay SQL thành `ADD COLUMN ... DEFAULT '<giá trị backfill>'` rồi `ALTER COLUMN ... DROP DEFAULT` → `migrate dev`. Ghi lý do giá trị backfill ngay trong file SQL.
- **Hệ quả cần cảnh báo**: sau khi apply, code trên `main` (chưa có cột) sẽ **không insert được** cho tới khi branch merge. DB dev dùng chung nên phải nói trước.

## E2E raw SQL insert vỡ khi schema thêm cột/bảng (2026-08-08)

- `INSERT INTO "MatchResult" (...)` viết tay trong e2e FE không biết cột NOT NULL mới → insert fail. Và `MatchRun` tham chiếu `Document` với **RESTRICT** khiến `cleanDocuments()` (xoá Document trước) fail → `globalSetup` chết → **cả suite chết**, không chỉ test liên quan.
- **Áp dụng**: đổi schema → grep raw SQL trong `client/e2e/**` và `test/**`; dọn DB theo đúng thứ tự FK (`MatchResult` → `MatchRun` → `Document`).

## E2E giả định env sẽ đỏ trên máy sạch (2026-08-08, ai-credentials — lỗi của chính feature này)

- `test/ai-credentials.e2e-spec.ts` cần `CREDENTIAL_ENCRYPTION_KEY` trong `.env`. Service cố ý optional-at-boot để test **không** cần khoá, nhưng spec lại giả định có → clone mới về thấy 20 test đỏ mà không hiểu vì sao.
- **Quy tắc**: spec phải tự lo tiền đề của nó (tự sinh khoá / override provider), hoặc `skip` kèm thông báo nêu rõ thiếu gì. Đừng để môi trường quyết định suite xanh hay đỏ.

## DB dev dùng chung bị tranh chấp khi chạy nhiều worktree (2026-08-09)

- Nhiều phiên cùng `prisma migrate dev` trên `matchcv` → migration của phiên khác làm Prisma đòi **reset**.
- **Áp dụng**: mỗi worktree trỏ một DB riêng trong `.env` của worktree (`matchcv_<feature>`), `migrate deploy` + seed ở đó. Sau khi merge hết, chạy `migrate dev` một lượt trên `matchcv`.
