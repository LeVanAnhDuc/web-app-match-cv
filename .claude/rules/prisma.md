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
- **Mock data KHÔNG đặt vào `prisma/seed.ts`.** File đó chạy tự động mỗi `prisma migrate dev`, nên mock nhồi vào đây là mất quyền kiểm soát. Mock đi qua `scripts/seed-mock.ts` + `scripts/mock-documents.ts` (`yarn seed:mock` / `yarn seed:mock:clean`) và được nhận diện bằng **dial UUID hằng số** (`10000000-0000-4000-8000-…` = CV, `20000000-0000-4000-8000-…` = JD), KHÔNG bằng cột `isMock` hay tiền tố `title`. Mọi lệnh xoá phải khoá theo dial đó — tuyệt đối không `deleteMany` theo `userId`/`isSaved`/`title`, vì mock và dữ liệu thật hiện dùng chung `STUB_USER_ID`.
- **Id hằng số PHẢI là UUIDv4 hợp lệ** (nibble version `4`, nibble variant `8`) — KHÔNG phải zero cho đẹp mắt kiểu `10000000-0000-0000-0000-…`. `Document.id` là cột `TEXT` nên id sai định dạng vẫn seed và list được, nhưng **mọi endpoint ghi trả 400** vì đều validate bằng `@IsUUID()` (validator.js ≥ 13.12 siết nibble). Đừng lấy `STUB_USER_ID` làm tiền lệ — nó cũng không phải UUID hợp lệ, chỉ là chưa bao giờ đi qua boundary có validate. Xem `docs/specs/seed-mock-documents/design.md` §3.1.
- **Ghi cột `Json?` về NULL** dùng `Prisma.DbNull`, KHÔNG dùng `null` — Prisma phân biệt SQL NULL với JSON `null` nên `null` trần không type-check (`parsedContent`).
