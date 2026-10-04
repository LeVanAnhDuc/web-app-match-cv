import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth.guard";
import { GuestService } from "./guest.service";
import { SessionService } from "./session.service";
import { SessionMiddleware } from "./session.middleware";

@Module({
  providers: [
    SessionService,
    GuestService,
    SessionMiddleware,
    { provide: APP_GUARD, useClass: AuthGuard }
  ],
  exports: [SessionService, GuestService, SessionMiddleware]
})
export class AuthModule {}
