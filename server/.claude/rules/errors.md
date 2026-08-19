---
name: errors
paths:
  - "src/**"
---

Báo lỗi bằng **NestJS built-in `HttpException` subclass** + message i18n. KHÔNG có custom exception layer; Nest tự format response + status.

## Quy tắc

1. **Throw `HttpException` subclass** từ `@nestjs/common` khớp status:
   - `BadRequestException` (400) — input/business rule sai (title thiếu khi save, document kind mismatch, file unsupported/too large, empty text).
   - `NotFoundException` (404) — không tìm thấy resource của user (`notFound`, `matchNotFound`).
   - Cần status khác → dùng subclass tương ứng (`UnauthorizedException`, `ForbiddenException`, `ConflictException`, …).
2. **Message = i18n qua thunk `tX(key, fallback)`** của module (xem `i18n.md`):
   ```ts
   throw new NotFoundException(
     tDoc("documents.errors.notFound", "Document not found.")
   );
   throw new BadRequestException(
     tMatch(
       "matching.errors.invalidDocumentKind",
       "Document kind does not match."
     )
   );
   ```
3. **KHÔNG `new Error(...)`** cho lỗi user-facing. **KHÔNG** dựng API positional/custom kiểu `new BadRequestError("msg", CODE)` (đó là convention của project Express tham chiếu — KHÔNG áp dụng ở đây). Không tự set body lỗi thủ công.
4. **Controller KHÔNG try/catch business error** — để nguyên cho Nest exception layer bắt và format. Chỉ catch khi cần chuyển đổi lỗi hạ tầng thành `HttpException` domain (vd `parsing.ts`: bắt lỗi parser lạ → ném `BadRequestException` với message i18n `parseFailed`; re-throw nếu đã là `HttpException`).
5. **Lỗi validation DTO do global `ValidationPipe` lo** (`main.ts`, `whitelist + transform`) — tự trả `400` khi class-validator fail. KHÔNG tự validate + throw thủ công cho field mà decorator DTO đã cover (xem `dto.md`).
6. File-upload validator (`ParseFilePipe` → `FileTypeValidator` / `MaxFileSizeValidator`) đặt `errorMessage` = thunk i18n (`tDoc(...)`) để giữ thông điệp đa ngôn ngữ nhất quán.

## Ví dụ thực tế

`DocumentsService` (Bad/NotFound + `tDoc`), `MatchingService` (Bad/NotFound + `tMatch`), `parsing.ts` (`parseFailedError()` bọc `BadRequestException`).
