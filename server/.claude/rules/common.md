---
name: common
paths:
  - "src/common/**"
---

`src/common/` chứa **provider cross-cutting** dùng chéo nhiều module — không thuộc riêng feature nào. Hiện có `current-user/`; guards / filters / interceptors global tương lai đặt tại đây.

## Cấu trúc

```
src/common/
  current-user/
    current-user.service.ts   # request-scoped user identity
    current-user.module.ts    # @Global() module cung cấp service
```

## Global module pattern

Provider dùng khắp app → gói trong module decorate `@Global()`, `exports` service, import 1 lần ở `AppModule` → mọi module inject được mà không cần import lại:

```ts
@Global()
@Module({
  providers: [CurrentUserService],
  exports: [CurrentUserService]
})
export class CurrentUserModule {}
```

(Cùng pattern với `PrismaModule` ở `src/prisma/` — xem `prisma.md`.)

## `CurrentUserService`

- `@Injectable()`, expose `getUserId(): string` — nguồn duy nhất để service lấy user hiện tại. Service inject qua constructor và scope Prisma query theo giá trị này (xem `services.md`).
- **Hiện là stub** (`STUB_USER_ID`) vì auth deferred — TODO(auth) thay bằng userId thật từ SSO khi có auth. Khi implement auth, chỉ đổi bên trong service này; consumer không đổi.

## Quy tắc

- Thêm cross-cutting mới (guard / exception filter / interceptor / decorator dùng chung) → tạo subfolder trong `src/common/`, cung cấp qua `@Global()` module nếu cần inject khắp nơi, hoặc đăng ký qua `APP_GUARD` / `APP_FILTER` / `APP_INTERCEPTOR` ở `AppModule`.
- KHÔNG đặt logic riêng-một-feature vào đây (thuộc `src/modules/<feature>/`).
- KHÔNG đặt Prisma/DB (thuộc `src/prisma/`) hay config (thuộc `src/config/`).
