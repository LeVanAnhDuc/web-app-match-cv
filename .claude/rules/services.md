---
name: services
paths:
  - "src/modules/**/*.service.ts"
---

Service là nơi chứa **toàn bộ business logic** của module. Controller mỏng gọi xuống đây; service query DB (qua Prisma), enforce rule, map entity → DTO.

## Quy tắc

1. Class decorate `@Injectable()`. Inject dependency qua constructor `private readonly`:
   ```ts
   constructor(
     private readonly prisma: PrismaService,
     private readonly currentUser: CurrentUserService
   ) {}
   ```
   Module có collaborator service khác (vd `AiService` trong `MatchingService`) → inject cùng cách.
2. **Business logic sống ở đây** — validation vượt DTO (vd "title bắt buộc khi save=true"), ownership check, orchestration, tính toán. KHÔNG rò rỉ logic này lên controller.
3. **Scope MỌI Prisma query theo `userId`** lấy từ `this.currentUser.getUserId()`:
   ```ts
   const userId = this.currentUser.getUserId();
   const doc = await this.prisma.document.findFirst({ where: { id, userId } });
   ```
   Đọc 1 bản ghi theo id + owner → `findFirst({ where: { id, userId } })` (KHÔNG `findUnique` bằng id trần — sẽ lộ dữ liệu người khác). List → `findMany({ where: { userId, ... } })`.
4. **Throw lỗi bằng NestJS `HttpException` subclass** (`BadRequestException`, `NotFoundException`, …) với message là i18n qua thunk `tX(key, fallback)` (xem `errors.md` + `i18n.md`):
   ```ts
   if (!doc) {
     throw new NotFoundException(
       tDoc("documents.errors.notFound", "Document not found.")
     );
   }
   ```
   KHÔNG `new Error(...)`, KHÔNG custom exception layer.
5. **Trả về output DTO qua mapper `Dto.fromEntity(entity)`** — không trả Prisma entity thô:
   ```ts
   return DocumentDto.fromEntity(created);
   // list:
   return docs.map((doc) => DocumentSummaryDto.fromEntity(doc));
   ```
6. **Public method = 1 use case** khớp handler controller (`create`, `list`, `findOne`, `createMatch`, `getById`). Sub-logic phức tạp / pure → tách thành module-local function (vd `deriveTitle`, `tokenize`, `cosine`) hoặc collaborator service, KHÔNG nhồi inline dài trong method.
7. Magic number / weight / cap → named `const` module-local (xem `constants.md`), vd `TITLE_FALLBACK_LENGTH`, `SEMANTIC_WEIGHT`, `MAX_MATCH_CHARS`.
8. Entity type import từ `@prisma/client` (`SourceFormat`, `DocumentKind`, `Prisma`).

## Tham chiếu thực tế

`DocumentsService` (create/list/findOne, scope userId, `DocumentDto.fromEntity`), `MatchingService` (createMatch/getById, ownership + kind check, inject `AiService`).
