---
name: standard-restful-api
description: RESTful API design standards for this NestJS backend — resource URLs, HTTP verbs/status codes, @Controller routing under /api/v1, request/response DTOs, validation at the boundary, pagination/filtering via query DTO, error responses, and security. TRIGGER — read when writing or reviewing any controller, route, request/response DTO, or API contract.
user-invocable: false
---

# RESTful API — Conventions (NestJS)

## URL & Resource Design

- Resource = plural noun, lowercase, kebab-case: `documents`, `match`, `payment-methods`. No verbs in URLs (`/getDocuments` ❌).
- Global prefix `api/v1` set in `main.ts` → `@Controller("documents")` serves `/api/v1/documents`. **Do not repeat the prefix** in the decorator.
- Max nesting depth 2 — beyond that use a top-level resource + query filter.
- Non-CRUD action = verb sub-resource with `POST`: `POST /api/v1/documents/:id/reparse`.

Real routes in this project:

```
POST   /api/v1/documents          → DocumentsController.create   (201, DocumentDto)
GET    /api/v1/documents          → DocumentsController.list     (200, DocumentSummaryDto[])
GET    /api/v1/documents/:id      → DocumentsController.findOne   (200, DocumentDto)
POST   /api/v1/match              → MatchingController.create    (201, MatchResultDto)
GET    /api/v1/match/:id          → MatchingController.findOne    (200, MatchResultDto)
GET    /api/v1/health             → HealthController.check
```

## HTTP Methods & Status Codes

- `@Post` → **201** by default (Nest); `@Get` → 200. Use `@HttpCode(200)` on a POST that does not create a resource.
- `PATCH` = partial update (only provided fields); `PUT` = full replace; `DELETE` → 204 no body.
- Never `GET` with a body; never `GET` for state changes; never `POST` for idempotent ops.

| Scenario                 | Code | In this repo                                               |
| ------------------------ | ---- | ---------------------------------------------------------- |
| Success with data        | 200  | GET endpoints                                              |
| Created                  | 201  | POST /documents, POST /match                               |
| Bad request / validation | 400  | `BadRequestException` (invalid input, wrong doc kind)      |
| Not found                | 404  | `NotFoundException` (doc/match not owned/absent)           |
| Too many requests        | 429  | global `ThrottlerGuard`                                    |
| Service unavailable      | 503  | `ServiceUnavailableException` (AI not configured / failed) |

- `401` = identity unknown, `403` = known but denied (auth deferred in MVP). Never `200` for errors, never `500` for validation.

## Request — validation at the boundary (DTO + pipes)

Every body/query/param is validated **before** the service, via the global `ValidationPipe({ whitelist, transform })` + class-validator DTOs and param pipes. Controller never trusts raw input.

- **Body** → input DTO with class-validator decorators:
  ```ts
  export class CreateMatchDto {
    @ApiProperty(...) @IsUUID() cvDocumentId: string;
    @ApiProperty(...) @IsUUID() jdDocumentId: string;
  }
  ```
- **Path param** → format-validating pipe: `@Param("id", new ParseUUIDPipe())`.
- **File** → `ParseFilePipe` with `FileTypeValidator` + `MaxFileSizeValidator` (10MB, PDF/DOCX only).
- **Query** → query DTO; coerce types explicitly for booleans/enums.

## Pagination & Filtering (query DTO)

Filtering today uses a query DTO with optional validated fields; the service applies them conditionally in the Prisma `where`:

```ts
export class ListDocumentsQueryDto {
  @ApiPropertyOptional({ enum: DocumentKind })
  @IsOptional()
  @IsEnum(DocumentKind)
  kind?: DocumentKind;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  saved?: boolean;
}
```

```ts
where: {
  userId,
  ...(query.kind ? { kind: query.kind } : {}),
  ...(query.saved !== undefined ? { isSaved: query.saved } : {})
}
```

When lists grow, add pagination via query DTO (`limit`/`offset` or cursor) with server-enforced max limit (default 20, max 100). Whitelist sort/filter fields server-side — never pass a raw client string as a Prisma field name. Ignore unknown filters (don't 400).

## Response

- **Never return a raw Prisma entity** — always map through a DTO `static fromEntity()` (strips `parsedContent`, `externalSub`, etc.).
- Response field names camelCase; dates as `Date` (serialized ISO 8601); IDs are UUID strings.
- Consistent shape per endpoint. Nest's built-in exception layer produces the error shape `{ statusCode, message, error }` — do not hand-roll error responses.

## Error Handling

- Throw a Nest `HttpException` subclass with an **i18n message** (via the module's `tX` helper) — Nest's default filter maps it to the right status + safe body:
  ```ts
  throw new NotFoundException(
    tDoc("documents.errors.notFound", "Document not found.")
  );
  throw new BadRequestException(
    tMatch("matching.errors.invalidDocumentKind", "…")
  );
  throw new ServiceUnavailableException(
    tMatch("matching.errors.aiFailed", "…")
  );
  ```
- **No custom exception classes, no `new Error(...)`, no custom global filter.**
- Never expose stack traces, DB errors, or internal paths to the client (see `standard-security` A10).

## Authorization / ownership

- Every data query is scoped by `userId` from `CurrentUserService.getUserId()` — ownership is enforced server-side at the DB layer, not trusted from the client (see `standard-prisma`, `standard-security` A01).
- A record owned by another user returns 404 (findFirst miss), not the record.

## Security (per response / endpoint)

- `helmet()` sets security headers globally; CORS is an explicit origin whitelist (`credentials: true`), never `*`.
- Rate limiting via global `ThrottlerGuard` (`ttl 60s / limit 100`); tighten per-route later for expensive endpoints (`/match`).
- Enforce input size caps: file 10MB, pasted text 100k chars, AI input 20k chars.

## DO NOT

- Verbs in resource URLs; nesting > 2 levels
- Repeat `/api/v1` inside `@Controller`
- Return raw DB objects; skip DTO mapping
- Return 200 for errors or 500 for validation failures
- Skip DTO/pipe validation and read raw `@Body`/`@Query`/`@Param`
- Wildcard CORS for the API; unbounded pagination
