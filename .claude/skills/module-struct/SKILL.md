---
name: module-struct
description: File structure, naming, and wiring for a feature module in this NestJS project. TRIGGER — read when scaffolding, reviewing, or navigating any module under src/modules/**, or wiring a new provider/controller into AppModule. Covers folder layout (dto/, i18n-messages.ts, domain-helper files), @Module wiring, provider/exports, inter-module dependency via DI (imports/exports), and 3 golden rules (YAGNI, shared layer, plural folder names).
user-invocable: false
---

# Module Structure (NestJS)

Mỗi feature sống trong `src/modules/<feature>/`. NestJS lo DI + wiring qua decorator — KHÔNG có factory function thủ công hay file `.routes.ts` như Express. Route sinh ra từ `@Controller` + method decorators.

## 📁 Cấu trúc một module

```
<feature>/                        ← số nhiều nếu là resource (documents/, matching/ là "match")
├── dto/                          ← Data Transfer Objects (input + output)
│   ├── create-<feature>.dto.ts   ← input DTO — class-validator decorators
│   ├── <feature>.dto.ts          ← output DTO — @ApiProperty + static fromEntity()
│   ├── <feature>-summary.dto.ts  ← output DTO gọn cho list
│   └── list-<feature>-query.dto.ts ← query DTO (filter/pagination)
├── <feature>.controller.ts       ← thin — @Controller + route decorators, delegate sang service
├── <feature>.service.ts          ← @Injectable — business logic, constructor DI
├── <feature>.module.ts           ← @Module — controllers + providers + (imports/exports)
├── i18n-messages.ts              ← tX(key, fallback) helper cho namespace của module
├── <domain-helper>.ts            ← pure/domain helper file (vd parsing.ts, ai.service.ts)
└── <feature>.service.spec.ts     ← Jest unit test co-located
```

⚠️ **YAGNI** — module đơn giản chỉ cần `dto/` + controller + service + module + `i18n-messages.ts`. Không tạo file/folder rỗng "cho đẹp". So sánh 2 module thật:

- `documents/` — 4 DTO, 1 controller, 1 service, `parsing.ts` (domain helper), `i18n-messages.ts`.
- `matching/` — 2 DTO, 1 controller, `matching.service.ts` (engine) + `ai.service.ts` (collaborator provider) + specs.

**Không có `dto/index.ts` barrel** trong project này — import DTO trực tiếp theo path tương đối (`./dto/create-document.dto`). Không path alias.

---

## `dto/` — Data Transfer Objects

- **1 file = 1 DTO**, tên theo action/shape: `create-document.dto.ts`, `document.dto.ts`, `document-summary.dto.ts`, `list-documents-query.dto.ts`.
- **Input DTO** = class + **class-validator** decorators (`@IsEnum`, `@IsString`, `@IsUUID`, `@IsOptional`, `@MaxLength`) + `@ApiProperty`/`@ApiPropertyOptional`. `ValidationPipe` global (`whitelist: true, transform: true`) validate + strip field lạ trước khi vào controller.
- **Output DTO** = class có `@ApiProperty` từng field + **`static fromEntity(entity): Dto` mapper**. Entity type là type do Prisma sinh (`Document`, `MatchResult` từ `@prisma/client`).
- **KHÔNG return raw Prisma entity** từ service — luôn map qua `fromEntity` để không leak field (vd `parsedContent`, `externalSub`).

```ts
// dto/document.dto.ts — output DTO + mapper
import { ApiProperty } from "@nestjs/swagger";
import { Document, DocumentKind, SourceFormat } from "@prisma/client";

export class DocumentDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: DocumentKind }) kind: DocumentKind;
  @ApiProperty() title: string;
  @ApiProperty({ enum: SourceFormat }) sourceFormat: SourceFormat;
  @ApiProperty() rawText: string;
  @ApiProperty() isSaved: boolean;
  @ApiProperty() createdAt: Date;

  static fromEntity(doc: Document): DocumentDto {
    const dto = new DocumentDto();
    dto.id = doc.id;
    dto.kind = doc.kind;
    dto.title = doc.title;
    dto.sourceFormat = doc.sourceFormat;
    dto.rawText = doc.rawText;
    dto.isSaved = doc.isSaved;
    dto.createdAt = doc.createdAt;
    return dto;
  }
}
```

> DTO chi tiết → `standard-restful-api` (query/pagination) + `standard-doc-api` (Swagger decorators).

---

## `<feature>.controller.ts` — thin

- `@Controller("<resource>")` — resource số nhiều/kebab-case. Global prefix `api/v1` add ở `main.ts`, KHÔNG lặp trong `@Controller`.
- Method decorators: `@Get`, `@Post`, `@Get(":id")` … Controller **CHỈ**: nhận input (qua `@Body`/`@Query`/`@Param` + pipe), delegate 1 dòng sang service, return DTO. KHÔNG business logic, KHÔNG chạm Prisma.
- Param pipe validate format tại biên: `@Param("id", new ParseUUIDPipe())`. File upload: `@UploadedFile(new ParseFilePipe({...}))`.
- Swagger response type: `@ApiTags`, `@ApiCreatedResponse({ type: Dto })`, `@ApiOkResponse({ type: [Dto] })`.

```ts
@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(":id")
  @ApiOkResponse({ type: DocumentDto })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string
  ): Promise<DocumentDto> {
    return this.documentsService.findOne(id);
  }
}
```

> Pipes/guards/interceptors chi tiết → `standard-nestjs`.

---

## `<feature>.service.ts` — business logic

- `@Injectable()` — deps qua **constructor DI**: `PrismaService` (data), `CurrentUserService` (userId scoping), collaborator provider khác (vd `AiService`).
- Method = use case, nhận primitive/DTO trả DTO. **Scope mọi query theo `userId`** lấy từ `this.currentUser.getUserId()` (xem `standard-prisma` + `standard-security`).
- **Error = throw HttpException dựng sẵn của Nest** (`BadRequestException`, `NotFoundException`, `ServiceUnavailableException`, …) với message i18n. **KHÔNG `new Error(...)`, KHÔNG custom exception layer.**
- Logic phụ pure (không DI) → tách ra file helper riêng cùng module (`parsing.ts`, hàm `deriveTitle`/`tokenize`).
- Service >200 dòng hoặc concern tách bạch → tách collaborator provider (vd `AiService` tách khỏi `MatchingService`), cùng khai báo trong `providers`.

```ts
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService
  ) {}

  async findOne(id: string): Promise<DocumentDto> {
    const userId = this.currentUser.getUserId();
    const doc = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!doc) {
      throw new NotFoundException(
        tDoc("documents.errors.notFound", "Document not found.")
      );
    }
    return DocumentDto.fromEntity(doc);
  }
}
```

---

## `i18n-messages.ts` — i18n thunk cho module

Mỗi module export 1 helper `t<Ns>(key, fallback)` gọi `I18nContext.current()?.t(key) ?? fallback`. Fallback English để không vỡ khi throw ngoài request lifecycle (job/test).

```ts
// documents/i18n-messages.ts
import { I18nContext } from "nestjs-i18n";

export function tDoc(key: string, fallback: string): string {
  return I18nContext.current()?.t(key as never) ?? fallback;
}
```

- Key = `"<namespace>.<path>"`; namespace = tên file JSON. JSON sống ở `src/i18n/{en,vi}/<namespace>.json` (vd `documents.json` có `{ "errors": { "notFound": ... } }` → key `"documents.errors.notFound"`).
- Thêm message mới: thêm cùng lúc CẢ `en/` LẪN `vi/` cho namespace đó.

---

## `<feature>.module.ts` — @Module wiring

```ts
@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService]
})
export class DocumentsModule {}
```

- `controllers` — controller HTTP của module.
- `providers` — service + collaborator (vd `matching`: `providers: [MatchingService, AiService]`).
- `exports` — CHỈ khi module khác cần inject provider này (xem inter-module).
- **Register vào `AppModule.imports`** — mỗi module mới PHẢI thêm vào mảng `imports` của `src/app.module.ts`, nếu không route không mount.

---

## Inter-Module Dependency (DI)

Module A cần provider của module B → **B `exports` provider, A `imports` module B**; Nest tự inject qua constructor. KHÔNG `new` service thủ công.

```ts
// b.module.ts
@Module({ providers: [BService], exports: [BService] })
export class BModule {}

// a.module.ts
@Module({ imports: [BModule], providers: [AService] })
export class AModule {}
// → AService constructor(private readonly b: BService) {}
```

- **Provider dùng khắp app** (cross-cutting) → `@Global()` module, không cần import mỗi nơi. Thực tế trong project: `PrismaModule` (`@Global`) và `CurrentUserModule` — mọi service inject `PrismaService`/`CurrentUserService` khi chúng có trong `AppModule.imports`.
- **Circular** (A cần B, B cần A) → tách logic chung ra module thứ 3, hoặc `forwardRef()` (last resort — dấu hiệu thiết kế sai).

---

## 🏆 Golden rules

1. **YAGNI** — chỉ tạo file/folder khi có nội dung. Không sinh `dto/index.ts` rỗng, không `helpers/` trống.
2. **Dùng chung 2+ module → đẩy lên shared layer**: `src/common/` (vd `current-user/`), `src/prisma/`, `src/config/`. Provider dùng chung → `@Global()` hoặc export + import.
3. **Folder resource số nhiều** (`documents/`, `dto/`); file theo suffix Nest (`.controller.ts`, `.service.ts`, `.module.ts`, `.dto.ts`, `.spec.ts`).
