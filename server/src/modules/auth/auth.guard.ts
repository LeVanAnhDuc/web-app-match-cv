import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { I18nContext } from "nestjs-i18n";
import { requestContext } from "../../common/request-context/request-context";
import { ACCESS_KEY, type Access } from "./decorators";
import { GuestService } from "./guest.service";
import { SessionService } from "./session.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly guests: GuestService,
    private readonly sessions: SessionService
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const access = this.reflector.getAllAndOverride<Access | undefined>(
      ACCESS_KEY,
      [ctx.getHandler(), ctx.getClass()]
    );
    if (access === "public") return true;

    const store = requestContext.getStore();
    if (!store)
      throw new InternalServerErrorException("SessionMiddleware did not run");

    if (store.userId && !store.isGuest) return true;
    if (
      store.userId &&
      store.isGuest &&
      (access === "guest" || access === "guest-create")
    )
      return true;

    if (!store.userId && access === "guest-create") {
      const guest = await this.guests.create();
      this.sessions.setCookie(
        ctx.switchToHttp().getResponse<Response>(),
        guest.token,
        guest.expiresAt
      );
      Object.assign(store, {
        userId: guest.userId,
        isGuest: true,
        sessionToken: guest.token
      });
      return true;
    }

    throw new UnauthorizedException({
      code: "SIGN_IN_REQUIRED",
      message:
        I18nContext.current()?.t("auth.errors.signInRequired" as never) ??
        "Sign in required."
    });
  }
}
