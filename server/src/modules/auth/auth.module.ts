import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth.guard";
import { GuestService } from "./guest.service";
import { GuestUsageService } from "./guest-usage.service";
import { OidcClientService } from "./oidc/oidc-client.service";
import { SessionService } from "./session.service";
import { SessionMiddleware } from "./session.middleware";

@Module({
  providers: [
    SessionService,
    GuestService,
    GuestUsageService,
    OidcClientService,
    SessionMiddleware,
    { provide: APP_GUARD, useClass: AuthGuard }
  ],
  exports: [
    SessionService,
    GuestService,
    GuestUsageService,
    OidcClientService,
    SessionMiddleware
  ]
})
export class AuthModule {}
