import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Logger,
  Post,
  Query,
  Req,
  Res
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { readCookie } from "../../common/http/cookies";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import {
  AuthFlowError,
  AuthService,
  OAUTH_COOKIE,
  OAUTH_TTL_MS
} from "./auth.service";
import { Public } from "./decorators";
import { AuthMeDto } from "./dto/auth-me.dto";
import { safeReturnTo } from "./return-to";
import { SessionService } from "./session.service";

/** NFR-SEC-13 — tighter than the global 100/min: these two routes start and finish an IdP round trip. */
const AUTH_THROTTLE = { default: { limit: 20, ttl: 60_000 } };
/** mcv_oauth is only ever needed by /auth/callback, so it is never sent anywhere else. */
const OAUTH_COOKIE_PATH = "/api/v1/auth";

/** Express turns a repeated query key into an array — only a single string counts. */
const single = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * Sign-in is a browser navigation, not an API call: login and callback answer
 * with redirects, and a failed callback lands on `/?authError=<code>` instead
 * of a JSON error the browser would show raw (design §3.2).
 */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly currentUser: CurrentUserService,
    private readonly config: ConfigService
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Get("login")
  @ApiFoundResponse({ description: "Redirects to Ducker ID /oauth/authorize" })
  async login(
    @Query("returnTo") returnTo: unknown,
    @Res() res: Response
  ): Promise<void> {
    const target = safeReturnTo(returnTo);
    const ctx = this.currentUser.peek();
    if (ctx?.userId && !ctx.isGuest) {
      return res.redirect(
        HttpStatus.FOUND,
        new URL(target, this.auth.clientOrigin()).toString()
      );
    }
    let begun: { authorizeUrl: string; cookie: string };
    try {
      begun = await this.auth.beginLogin(
        target,
        ctx?.isGuest ? ctx.userId : null
      );
    } catch (e) {
      // A full-page navigation must never land on raw JSON: discovery down or
      // OIDC_* missing becomes the same /?authError=server the callback uses.
      this.logger.warn(
        `sign-in could not start${e instanceof Error ? ` (${e.name})` : ""}`
      );
      return res.redirect(
        HttpStatus.FOUND,
        `${this.auth.clientOrigin()}/?authError=server`
      );
    }
    const { authorizeUrl, cookie } = begun;
    res.cookie(OAUTH_COOKIE, cookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get<string>("NODE_ENV") === "production",
      path: OAUTH_COOKIE_PATH,
      maxAge: OAUTH_TTL_MS
    });
    res.redirect(HttpStatus.FOUND, authorizeUrl);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Get("callback")
  @ApiFoundResponse({
    description:
      "Redirects to CLIENT_ORIGIN + returnTo with a new session, or to /?authError=<code>"
  })
  async callback(
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const ctx = this.currentUser.peek();
    // One attempt per state: once the state matched, the cookie goes whatever
    // the outcome. A request whose state did not match is a stranger's link —
    // it must not wipe the login this browser has in progress.
    const clearOAuth = () =>
      res.clearCookie(OAUTH_COOKIE, { path: OAUTH_COOKIE_PATH });
    try {
      const result = await this.auth.completeLogin({
        code: single(query.code),
        state: single(query.state),
        error: single(query.error),
        iss: single(query.iss),
        sealed: readCookie(req.headers.cookie, OAUTH_COOKIE),
        current: {
          userId: ctx?.userId ?? null,
          isGuest: ctx?.isGuest ?? false,
          sessionToken: ctx?.sessionToken ?? null
        }
      });
      clearOAuth();
      this.sessions.setCookie(res, result.token, result.expiresAt);
      res.redirect(HttpStatus.FOUND, result.redirectTo);
    } catch (e) {
      const code = e instanceof AuthFlowError ? e.code : "server";
      if (code !== "state") clearOAuth();
      // Only the failure class is logged — never code, tokens, cookies or email (NFR-SEC-02).
      this.logger.warn(
        `sign-in failed: ${code}${code === "server" && e instanceof Error ? ` (${e.name})` : ""}`
      );
      res.redirect(
        HttpStatus.FOUND,
        `${this.auth.clientOrigin()}/?authError=${code}`
      );
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: "Session row deleted, cookie cleared" })
  async logout(@Res({ passthrough: true }) res: Response): Promise<void> {
    const token = this.currentUser.peek()?.sessionToken;
    if (token) await this.sessions.revoke(token);
    this.sessions.clearCookie(res);
  }

  @Public()
  @Get("me")
  @ApiOkResponse({ type: AuthMeDto })
  async me(@Ip() ip: string): Promise<AuthMeDto> {
    return this.auth.me(ip);
  }
}
