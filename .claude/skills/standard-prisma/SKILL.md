---
name: standard-prisma
description: Prisma + PostgreSQL conventions for this backend — schema.prisma (models, enums, relations, uuid ids, indexes), migrations, PrismaService, injecting into services, query patterns (findFirst/findMany/create with where/orderBy), per-user scoping, transactions, and idempotent seed.ts. TRIGGER — read whenever touching prisma/schema.prisma, a migration, PrismaService, seed.ts, or any service query. Keywords: Prisma, PostgreSQL, migration, schema, findFirst, findMany, prisma migrate, relation, seed.
user-invocable: false
---

# Prisma + PostgreSQL — Conventions

ORM là **Prisma 6.19.3** (pin — v7 breaking) trên **PostgreSQL local** (không Docker, pgvector deferred). Xem `.claude/techstack/backend.md`.

## `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")   // KHÔNG hardcode connection string
}

enum DocumentKind { CV JD }
enum SourceFormat { pdf docx text }

model Document {
  id            String       @id @default(uuid())   // UUID string PK — KHÔNG int autoincrement
  userId        String
  user          User         @relation(fields: [userId], references: [id])
  kind          DocumentKind
  title         String
  sourceFormat  SourceFormat
  rawText       String
  parsedContent Json?                                // optional → nullable
  isSaved       Boolean      @default(false)
  createdAt     DateTime     @default(now())

  matchResultsAsCv MatchResult[] @relation("MatchResultCvDocument")
  matchResultsAsJd MatchResult[] @relation("MatchResultJdDocument")

  @@index([userId, kind])                            // index theo pattern query thật
}
```

Rules:

- **PK = `String @id @default(uuid())`** — mọi model. ID string, không expose auto-increment (xem `standard-security`).
- **Enum trong schema** (`DocumentKind`, `SourceFormat`, `Role`) — Prisma sinh TS enum, import từ `@prisma/client`. Đây là source of truth cho tập giá trị; DTO validate bằng `@IsEnum(DocumentKind)`.
- **Relation tường minh** `@relation(fields, references)`. Nhiều relation cùng model đích → đặt tên relation (`"MatchResultCvDocument"` / `"MatchResultJdDocument"`).
- **`@@index`** theo đúng field hay filter/sort — `Document` index `[userId, kind]` (list scope theo user + filter kind); `MatchResult` index `[userId]`. Equality field trước, sort field sau.
- **Optional field** dùng `?` → cột nullable (`parsedContent Json?`, `externalSub String?`).
- Sau khi sửa schema: `npx prisma generate` để cập nhật type `@prisma/client`.

## Migrations

```bash
npx prisma migrate dev --name <change>   # tạo + apply migration (dev), regenerate client
npx prisma migrate deploy                # apply migration đã commit (CI/prod)
npx prisma generate                      # chỉ regenerate client (sau khi pull schema)
npx prisma migrate status                # kiểm tra drift
```

- Migration file commit vào `prisma/migrations/` — **KHÔNG sửa migration đã apply/commit**; đổi schema → tạo migration mới.
- Đổi shape phá vỡ (rename/drop cột đang dùng) → tách bước expand → backfill → contract (xem `standard-backend-engineering-mindset` §Data Integrity), không xoá cột trong 1 deploy.

## `PrismaService`

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

- Extends `PrismaClient`, `$connect()` trong `onModuleInit` (kết nối lúc module lên).
- Provided bởi `PrismaModule` (`@Global()` + `exports: [PrismaService]`) → mọi service inject được mà không cần import lại.

## Inject + query trong service

Inject qua constructor; gọi `this.prisma.<model>.<op>()`:

```ts
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService
  ) {}
  ...
}
```

Query patterns thật trong codebase:

```ts
// findFirst — scope theo userId (KHÔNG findUnique khi cần filter thêm owner)
const doc = await this.prisma.document.findFirst({ where: { id, userId } });

// findMany — filter động + orderBy
const docs = await this.prisma.document.findMany({
  where: {
    userId,
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.saved !== undefined ? { isSaved: query.saved } : {})
  },
  orderBy: { createdAt: "desc" }
});

// create — data object; return entity rồi map DTO
const created = await this.prisma.document.create({
  data: {
    userId,
    kind: dto.kind,
    title,
    sourceFormat,
    rawText,
    isSaved: dto.save
  }
});
return DocumentDto.fromEntity(created);
```

- **Không có repository layer riêng** trong project này — service gọi `this.prisma.*` trực tiếp. Query phức tạp/tái dùng → tách private method trong chính service.
- JSON column: ghi cần cast `value as unknown as Prisma.InputJsonValue`; đọc cast về DTO type (xem `MatchResult.report`).

## Per-user scoping (BẮT BUỘC)

**Mọi query chạm dữ liệu user PHẢI filter theo `userId`** lấy từ `this.currentUser.getUserId()` — ownership enforcement ở tầng DB, không tin client:

- Đọc 1 record: `findFirst({ where: { id, userId } })` → không thấy = `NotFoundException` (không leak record của user khác).
- List: luôn có `userId` trong `where`.
- Cross-record (match 2 document): kiểm tra CẢ HAI thuộc `userId` trước khi xử lý (xem `MatchingService.createMatch`).

Chi tiết bảo mật → `standard-security` (A01 Broken Access Control).

## Transactions

Dùng khi nhiều ghi phải atomic:

```ts
await this.prisma.$transaction(async (tx) => {
  const doc = await tx.document.create({ data: {...} });
  await tx.matchResult.create({ data: { cvDocumentId: doc.id, ... } });
});
```

- Interactive transaction (callback) khi các bước phụ thuộc nhau; batch `$transaction([...])` khi độc lập.
- **KHÔNG gọi external API (OpenRouter, parse file) bên trong transaction** — giữ transaction ngắn; chạy AI/parse trước, chỉ bọc DB writes. MVP hiện chưa cần transaction (mỗi endpoint 1 write), thêm khi có multi-write.

## `prisma/seed.ts` — idempotent

```ts
await prisma.user.upsert({
  where: { id: STUB_USER_ID },
  update: {},
  create: { id: STUB_USER_ID, role: Role.candidate }
});
```

- **`upsert`** để chạy lại nhiều lần không nhân bản (idempotent). Chạy: `npx prisma db seed` (config `prisma.seed` trong `package.json`).
- Seed hiện chỉ tạo stub user (auth deferred). Thêm seed data mới cũng phải idempotent (`upsert`/`createMany({ skipDuplicates: true })`).

## Injection safety

Prisma query builder **parameterized** — an toàn injection mặc định. **KHÔNG dùng `$queryRawUnsafe` / string concat**; cần raw thì `$queryRaw` với tagged template (`Prisma.sql`). Xem `standard-security` A05.
