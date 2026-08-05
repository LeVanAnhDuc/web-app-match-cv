---
name: dto
paths:
  - "src/modules/**/dto/**"
---

DTO định nghĩa **hợp đồng I/O** của module. 2 loại: **input DTO** (validate request) và **output DTO** (shape response + map từ entity). File đặt trong `<module>/dto/`, tên `<name>.dto.ts`.

## Input DTO (request body / query)

- Mỗi field decorate bằng **class-validator** (`@IsString`, `@IsEnum`, `@IsBoolean`, `@IsOptional`, `@MaxLength`, …) + **Swagger** (`@ApiProperty` / `@ApiPropertyOptional`).
- Field optional → `@IsOptional()` + `@ApiPropertyOptional(...)` + type TS `?`.
- Enum lấy từ `@prisma/client` → `@IsEnum(DocumentKind)` + `@ApiProperty({ enum: DocumentKind })`.
- Coerce kiểu từ multipart/query (string → boolean) qua `@Transform` từ `class-transformer` (vd hàm `toBoolean`). Global `ValidationPipe` có `transform: true`.
- Đặt giới hạn an toàn tường minh bằng `@MaxLength` (vd `sourceText` cap `100_000`) — không dựa vào default ngầm của body-parser.
- Validate được global `ValidationPipe` (`whitelist: true, transform: true` ở `main.ts`) chạy tự động; lỗi → `400` do Nest format (xem `errors.md`). KHÔNG tự validate trong DTO constructor.

```ts
export class CreateDocumentDto {
  @ApiProperty({ enum: DocumentKind })
  @IsEnum(DocumentKind)
  kind: DocumentKind;

  @ApiPropertyOptional({ description: "Required when save=true." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
```

Ví dụ: `CreateDocumentDto`, `ListDocumentsQueryDto`, `CreateMatchDto`.

## Output DTO (response)

- Field decorate `@ApiProperty()` (hoặc `@ApiProperty({ enum: ... })`). KHÔNG cần class-validator (không phải input).
- **Bắt buộc có `static fromEntity(entity): Dto` mapper** — nhận Prisma entity (type từ `@prisma/client`, vd `Document`), gán từng field, trả instance. Service gọi mapper này, KHÔNG trả entity thô.
- Không expose field nhạy cảm / dư thừa — chỉ map field cần cho client (vd `DocumentSummaryDto` bỏ `rawText`).

```ts
export class DocumentDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: DocumentKind }) kind: DocumentKind;

  static fromEntity(doc: Document): DocumentDto {
    const dto = new DocumentDto();
    dto.id = doc.id;
    dto.kind = doc.kind;
    return dto;
  }
}
```

Ví dụ: `DocumentDto`, `DocumentSummaryDto`, `MatchResultDto`.

## Chung

- 1 DTO = 1 file `<name>.dto.ts`. Input và output tách file riêng.
- Entity/enum type LUÔN import từ `@prisma/client` — không tự khai lại type domain.
- Controller khai `@ApiOkResponse/@ApiCreatedResponse({ type: Dto })` trỏ tới output DTO (xem `controllers.md`).
