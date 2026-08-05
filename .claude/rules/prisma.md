---
name: prisma
paths:
  - "prisma/schema.prisma"
  - "src/prisma/**"
---

Prisma là data layer. Schema ở `prisma/schema.prisma`; client được bọc bởi `PrismaService` (`src/prisma/`) và inject vào service.

## Schema conventions (`prisma/schema.prisma`)

- Datasource `postgresql`, `url = env("DATABASE_URL")`; generator `prisma-client-js`.
- **Model** đặt tên `PascalCase` số ít (`User`, `Document`, `MatchResult`). Field `camelCase`.
- **Primary key**: `id String @id @default(uuid())` (UUID string, khớp `ParseUUIDPipe` ở controller).
- **Enum** đặt tên `PascalCase`; giá trị theo domain (`DocumentKind { CV JD }`, `SourceFormat { pdf docx text }`, `Role { candidate recruiter admin }`). Enum này được import lại ở DTO/service qua `@prisma/client`.
- **Relation**: khai cả FK scalar (`userId String`) lẫn relation field (`user User @relation(fields: [userId], references: [id])`). Nhiều relation cùng model → đặt tên relation (`@relation("MatchResultCvDocument", ...)`).
- **Timestamp**: `createdAt DateTime @default(now())`.
- **Index**: mọi model thuộc user thêm `@@index([userId])` (hoặc composite `@@index([userId, kind])`) vì query luôn scope theo `userId` — xem `services.md`.
- Cột JSON linh hoạt (`parsedContent Json?`, `report Json`) dùng `Json`; khi ghi từ TS cast qua `Prisma.InputJsonValue`.

## `PrismaService` (`src/prisma/prisma.service.ts`)

- `@Injectable()` class **extends `PrismaClient`** implements `OnModuleInit`; `onModuleInit()` gọi `await this.$connect()`.
- Cung cấp qua `PrismaModule` **`@Global()`** (`providers: [PrismaService], exports: [PrismaService]`) → module feature inject thẳng, không cần import lại.

## Quy tắc dùng

- **Query CHỈ nằm trong service** (`*.service.ts`) — KHÔNG bao giờ trong controller. Inject `PrismaService` qua constructor.
- Query luôn scope `userId` (xem `services.md`).
- **Migration**: đổi schema → `npx prisma migrate dev --name <change>`; sau đó regenerate client. Không sửa SQL migration đã commit.
- **Seed** (`prisma/seed.ts`): phải **idempotent** — dùng `upsert` (`where` / `update: {}` / `create`), an toàn chạy lại nhiều lần. Hiện seed `STUB_USER_ID` (khớp `CurrentUserService` — auth deferred). Thêm seed mới → giữ idempotent, `$disconnect` ở cả nhánh success lẫn error.
