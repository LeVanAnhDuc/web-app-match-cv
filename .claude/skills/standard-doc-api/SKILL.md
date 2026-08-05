---
name: standard-doc-api
description: API documentation standards for this backend using Swagger/OpenAPI via @nestjs/swagger. TRIGGER — read after adding or refactoring any controller/endpoint or DTO, to keep the OpenAPI docs (served at /api/v1/docs) accurate. Covers @ApiTags, @ApiOkResponse/@ApiCreatedResponse({ type }), @ApiConsumes, @ApiProperty on DTO fields, and DocumentBuilder/SwaggerModule setup in main.ts.
user-invocable: false
---

# API Documentation — Swagger / OpenAPI (@nestjs/swagger)

Docs are generated from decorators (no hand-written spec) and served at **`/api/v1/docs`**. Keep decorators in sync whenever you add or change an endpoint or DTO.

## Setup — `main.ts`

```ts
const swagger = new DocumentBuilder()
  .setTitle("match-cv API")
  .setVersion("0.0.1")
  .build();
SwaggerModule.setup(
  "api/v1/docs",
  app,
  SwaggerModule.createDocument(app, swagger)
);
```

- When auth ships, add `.addBearerAuth()` to the builder and `@ApiBearerAuth()` on protected controllers.

## Controllers — tag + response types

- `@ApiTags("<group>")` on the controller class groups its routes in the UI (`"documents"`, `"match"`).
- Document the **success response DTO** on each handler:
  - `@ApiCreatedResponse({ type: Dto })` for 201 (POST that creates).
  - `@ApiOkResponse({ type: Dto })` for 200; array response → `{ type: [Dto] }`.
- File upload endpoint: `@ApiConsumes("multipart/form-data", "application/json")` so Swagger renders a file field.

```ts
@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  @Post()
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiCreatedResponse({ type: DocumentDto })
  @UseInterceptors(FileInterceptor("file"))
  async create(...) {}

  @Get()
  @ApiOkResponse({ type: [DocumentSummaryDto] })
  async list(...) {}

  @Get(":id")
  @ApiOkResponse({ type: DocumentDto })
  async findOne(...) {}
}
```

- Consider documenting error responses on endpoints with notable failure modes: `@ApiBadRequestResponse()`, `@ApiNotFoundResponse()`, `@ApiServiceUnavailableResponse()` (e.g. `/match` returns 503 when the AI provider is unconfigured/down).

## DTOs — `@ApiProperty`

Swagger reads DTO classes referenced in `@Api*Response({ type })` and in `@Body`/`@Query`. Every exposed field needs an `@ApiProperty` (or `@ApiPropertyOptional`).

**Output DTO** — annotate each field; enums via `{ enum }`, arrays via `{ type: [String] }`, nested via `{ type: NestedDto }`:

```ts
export class DocumentDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: DocumentKind }) kind: DocumentKind;
  @ApiProperty() title: string;
  @ApiProperty({ enum: SourceFormat }) sourceFormat: SourceFormat;
  @ApiProperty() rawText: string;
  @ApiProperty() isSaved: boolean;
  @ApiProperty() createdAt: Date;
}

export class MatchReportDto {
  @ApiProperty({ type: [String] }) strengths: string[];
  @ApiProperty({ type: [String] }) gaps: string[];
  @ApiProperty({ type: [String] }) suggestions: string[];
}
export class MatchResultDto {
  @ApiProperty() overallScore: number;
  @ApiProperty({ type: MatchReportDto }) report: MatchReportDto;
  // …
}
```

**Input DTO** — `@ApiProperty` sits alongside the class-validator decorators; use `@ApiPropertyOptional` for optional fields, and `description` to document constraints:

```ts
export class CreateDocumentDto {
  @ApiProperty({ enum: DocumentKind })
  @IsEnum(DocumentKind)
  kind: DocumentKind;

  @ApiProperty({
    type: Boolean,
    description: "Whether to persist this document for later reuse."
  })
  @Transform(toBoolean)
  @IsBoolean()
  save: boolean;

  @ApiPropertyOptional({ description: "Required when save=true." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
```

## Rules

- Docs are **decorator-driven** — do not maintain a separate `swagger/` spec file or Postman collection; the source of truth is the annotated controllers + DTOs.
- Any new/changed field must get/update its `@ApiProperty`; any new endpoint must get `@ApiTags` + a response-type decorator. This is part of finishing an endpoint, not an afterthought.
- Keep `description` accurate — document non-obvious constraints (size caps, "required when …", ownership) so the OpenAPI contract matches real validation.
- Never expose internal-only fields — output DTOs already omit them; do not add `@ApiProperty` to leak `parsedContent`, `externalSub`, or raw entities.
