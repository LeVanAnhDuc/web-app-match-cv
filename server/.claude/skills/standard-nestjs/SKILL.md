---
name: standard-nestjs
description: NestJS framework conventions for this backend — dependency injection, modules/providers, controllers, pipes (global ValidationPipe, ParseUUIDPipe, ParseFilePipe), guards (APP_GUARD/ThrottlerGuard), interceptors/filters, ConfigModule + env validation, i18n, and main.ts bootstrap. TRIGGER — read before writing or reviewing any NestJS wiring: a new controller/service/provider, a pipe/guard/interceptor, ConfigModule usage, or changes to main.ts / app.module.ts.
user-invocable: false
---

# NestJS Conventions

Framework thật: **NestJS 11 + Express platform**. Version chi tiết ở `.claude/techstack/backend.md`. Skill này = cách dùng framework; layout module → `module-struct`.

## Dependency Injection

- Class có business logic/state = `@Injectable()` provider. Deps **luôn qua constructor**, `private readonly`:
  ```ts
  @Injectable()
  export class MatchingService {
    constructor(
      private readonly ai: AiService,
      private readonly prisma: PrismaService,
      private readonly currentUser: CurrentUserService
    ) {}
  }
  ```
- **KHÔNG `new` một provider thủ công** — Nest resolve từ DI container. Muốn dùng provider của module khác → export nó, import module đó (xem `module-struct`).
- Provider mặc định **singleton** (1 instance / app). Không giữ per-request state trong field provider.
- Provider không-phải-class hoặc cần config runtime → dùng `{ provide, useClass | useValue | useFactory }`. Trong project: `{ provide: APP_GUARD, useClass: ThrottlerGuard }`.

## Controllers

- `@Controller("resource")` — route decorators `@Get/@Post/@Patch/@Delete`, param decorators `@Body() @Query() @Param() @UploadedFile()`. Controller thin (xem `module-struct`).
- Status code: `@Post` mặc định trả **201**, `@Get` trả **200**. Đổi bằng `@HttpCode(200)` khi cần (vd `@Post` không tạo resource). `204` → không body.
- File upload dùng `@UseInterceptors(FileInterceptor("file"))` + `@UploadedFile(...)` (platform-express + multer memory storage).

## Pipes — validation & transform tại biên

| Pipe                                                   | Dùng                                                         | Ở đâu                                           |
| ------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------- |
| `ValidationPipe({ whitelist: true, transform: true })` | validate + strip field lạ + transform DTO                    | **global** ở `main.ts`                          |
| `ParseUUIDPipe`                                        | ép param `:id` là UUID hợp lệ (400 nếu sai)                  | param-level `@Param("id", new ParseUUIDPipe())` |
| `ParseFilePipe`                                        | validate file (`FileTypeValidator` + `MaxFileSizeValidator`) | `@UploadedFile(new ParseFilePipe({...}))`       |

- Global `ValidationPipe` là nền tảng bảo mật input: mọi `@Body`/`@Query` chạy qua class-validator + strip field không khai báo. **KHÔNG tự validate thủ công trong controller.**
- `transform: true` cho phép coerce (string → number/boolean) — nhưng query boolean vẫn cần `@Transform(toBoolean)` tường minh vì `"true"`/`"false"` là string (xem `ListDocumentsQueryDto`).
- File validator dùng `errorMessage: () => tDoc(...)` để i18n hoá lỗi upload.

```ts
@UploadedFile(
  new ParseFilePipe({
    fileIsRequired: false,
    validators: [
      new FileTypeValidator({
        fileType: ALLOWED_FILE_TYPE_REGEX,
        skipMagicNumbersValidation: true,
        errorMessage: () =>
          tDoc("documents.errors.unsupportedFileType", "Unsupported file type…")
      }),
      new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES, errorMessage: () => tDoc(...) })
    ]
  })
)
file?: Express.Multer.File
```

## Guards — authN/authZ + rate limit

- Global guard qua token `APP_GUARD` trong `AppModule.providers`. Project chạy `ThrottlerGuard` global (rate-limit toàn app):
  ```ts
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }];
  ```
- Guard trả `false`/throw → Nest chặn request (403/401). Auth guard **DEFER** trong MVP (current-user là stub). Khi thêm auth → guard riêng, mount `APP_GUARD` hoặc `@UseGuards` per-route.

## Interceptors & Filters

- **Interceptor** — cross-cutting quanh handler (logging, transform response, timeout). Chưa dùng global trong project; thêm qua `APP_INTERCEPTOR` khi cần.
- **Exception filter** — KHÔNG viết filter tuỳ biến. Project dựa **built-in exception filter của Nest**: throw `HttpException` subclass → Nest tự format `{ statusCode, message, error }`. Message string i18n truyền vào constructor exception (xem `module-struct` + `standard-restful-api`).

## ConfigModule + env validation

- `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })` trong `AppModule` — global, không import lại.
- `validateEnv` (`src/config/env.validation.ts`) dùng class-validator + `plainToInstance` validate biến môi trường lúc boot; thiế/sai → **throw, app không start** (fail fast).
- Đọc env qua **`ConfigService.get<T>("KEY")`** trong provider — KHÔNG `process.env.X` rải rác (ngoại lệ hẹp: `main.ts` trước khi DI sẵn sàng). Vd `AiService`:
  ```ts
  constructor(config: ConfigService) {
    const apiKey = config.get<string>("OPENROUTER_API_KEY");
    ...
  }
  ```
- Thêm env mới: thêm field + validator vào `EnvVars`, thêm key vào `.env.example`.

## Lifecycle hooks

- `OnModuleInit` cho khởi tạo cần async khi module lên — vd `PrismaService.onModuleInit()` gọi `$connect()`.
- Enable graceful shutdown khi cần cleanup: `app.enableShutdownHooks()` + `OnModuleDestroy`.

## main.ts bootstrap

Thứ tự trong `bootstrap()` (đang có, giữ nguyên khi sửa):

```ts
const app = await NestFactory.create(AppModule);
app.setGlobalPrefix("api/v1"); // mọi route dưới /api/v1
app.use(helmet()); // security headers
app.enableCors({ origin: CLIENT_ORIGIN, credentials: true }); // CORS whitelist (KHÔNG "*")
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

const swagger = new DocumentBuilder()
  .setTitle("match-cv API")
  .setVersion("0.0.1")
  .build();
SwaggerModule.setup(
  "api/v1/docs",
  app,
  SwaggerModule.createDocument(app, swagger)
);

await app.listen(process.env.PORT ?? 5200); // port 5200
```

- Global prefix `api/v1` → controller KHÔNG lặp `/api/v1`.
- Swagger UI ở `api/v1/docs` (xem `standard-doc-api`).
- CORS origin lấy từ env, `credentials: true` — không wildcard (xem `standard-security`).

## Commands

```bash
yarn start:dev        # nest start --watch
yarn build            # nest build
yarn type-check       # tsc --noEmit
yarn lint             # eslint .
yarn format           # prettier --write .
yarn test             # jest (unit *.spec.ts co-located)
```
