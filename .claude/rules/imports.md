---
name: imports
paths:
  - "src/**"
---

Thứ tự và style import cho mọi file `.ts` trong `src/`.

## KHÔNG có path alias

Project **chưa cấu hình alias `@/`** — dùng **relative import** (`./`, `../../`). Ví dụ từ service:

```ts
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
```

Đừng viết `@/...` cho tới khi alias được set trong `tsconfig.json` (+ jest config).

## Thứ tự nhóm import

Nhóm theo thứ tự (khớp code hiện tại, tham khảo `documents.controller.ts` / `matching.service.ts`):

1. **Node built-in** — `path`, `crypto`, … (vd `import { join } from "path"`).
2. **Third-party** — package NPM ngoài framework (`helmet`, `class-validator`, `class-transformer`, `nestjs-i18n`, `mammoth`, `pdf-parse`).
3. **`@nestjs/*`** — `@nestjs/common`, `@nestjs/core`, `@nestjs/swagger`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/throttler`.
4. **`@prisma/client`** — entity/enum type + `Prisma` (`DocumentKind`, `SourceFormat`, `Document`).
5. **Local relative** — `../...` trước rồi `./...`; trong cùng module thường theo trình tự dto → i18n-messages → helper (parsing) → service.

Trong 1 dòng import, gom nhiều symbol từ cùng package và (khuyến khích) sắp alphabet, như `import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common"`.

## Style

- Decorator NestJS: route/param/pipe/`@Injectable`/`HttpException` từ `@nestjs/common`; `@ApiTags`/`@ApiProperty`/`@ApiOkResponse`… từ `@nestjs/swagger`.
- Dùng `import type { ... }` cho import **chỉ dùng làm type** khi giúp làm rõ / tránh giữ runtime dependency (vd type thuần từ `@prisma/client`). Decorator + value import (class dùng cho DI, enum dùng runtime) giữ import thường.
- Không để import không dùng (ESLint sẽ báo).
