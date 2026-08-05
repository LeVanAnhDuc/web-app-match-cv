---
name: controllers
paths:
  - "src/modules/**/*.controller.ts"
---

Controller là **HTTP boundary** của module — mỏng, chỉ khai báo route + Swagger, rồi delegate xuống service. KHÔNG chứa business logic.

## Quy tắc

1. Class decorate `@ApiTags("<tag>")` + `@Controller("<path>")`. Path là danh từ số nhiều (`"documents"`, `"match"`). Global prefix `api/v1` set ở `main.ts` — KHÔNG lặp lại trong `@Controller`.
2. Inject service qua constructor `private readonly`:
   ```ts
   constructor(private readonly documentsService: DocumentsService) {}
   ```
3. **Thin — mỗi handler chỉ 1 dòng delegate**, trả thẳng kết quả service. KHÔNG query DB, KHÔNG validate business rule, KHÔNG try/catch (để Nest exception layer format — xem `errors.md`).
   ```ts
   async findOne(@Param("id", new ParseUUIDPipe()) id: string): Promise<DocumentDto> {
     return this.documentsService.findOne(id);
   }
   ```
4. **Route decorator**: `@Get()` / `@Get(":id")` / `@Post()`. Param binding: `@Param("id", ...)`, `@Query() query: XxxQueryDto`, `@Body() dto: XxxDto`, `@UploadedFile(...) file?: Express.Multer.File`.
5. **Pipes**:
   - Route param UUID → `@Param("id", new ParseUUIDPipe())`.
   - File upload → `@UseInterceptors(FileInterceptor("file"))` + `@UploadedFile(new ParseFilePipe({ ... }))` với `FileTypeValidator` + `MaxFileSizeValidator`. `errorMessage` của validator dùng i18n thunk (`tDoc(...)`, xem `i18n.md`).
   - Body/query validate qua **global `ValidationPipe`** (set ở `main.ts`, `{ whitelist: true, transform: true }`) — KHÔNG khai `@UsePipes` per-controller cho DTO thường.
6. **Swagger response bắt buộc**: mỗi handler khai `@ApiOkResponse({ type: Dto })` (GET) hoặc `@ApiCreatedResponse({ type: Dto })` (POST). List → `{ type: [Dto] }`. Upload → thêm `@ApiConsumes("multipart/form-data", "application/json")`.
7. **Return type luôn là output DTO** (`DocumentDto`, `DocumentSummaryDto`, `MatchResultDto`) — không trả Prisma entity thô. Việc map entity→DTO nằm ở service (`Dto.fromEntity`), controller chỉ chuyển tiếp.
8. Import decorator từ `@nestjs/common` (route/param/pipe) và `@nestjs/swagger` (Api*). File upload interceptor từ `@nestjs/platform-express`.

## Tham chiếu thực tế

`DocumentsController` (upload + list + findOne), `MatchingController` (create + findOne). Service tương ứng: `DocumentsService`, `MatchingService`.
