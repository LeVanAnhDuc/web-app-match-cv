import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthMeDto } from "./dto/auth-me.dto";
import { GuestService } from "./guest.service";
import { GuestUsageService } from "./guest-usage.service";
import type { IdTokenClaims } from "./oidc/id-token";
import { OidcClientService } from "./oidc/oidc-client.service";
import { createPkce, randomToken } from "./oidc/pkce";
import { seal, unseal } from "./oidc/sealed-cookie";
import { safeReturnTo } from "./return-to";
import { SessionService } from "./session.service";

export const OAUTH_COOKIE = "mcv_oauth";
/** Lifetime of one login attempt — also the mcv_oauth cookie's Max-Age. */
export const OAUTH_TTL_MS = 10 * 60_000;
const DAY_MS = 86_400_000;

/** What the mcv_oauth cookie carries between /auth/login and /auth/callback. */
export interface OAuthState {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  /**
   * The guest the login was started from, or null. Only that guest may be
   * claimed at callback: a same-site page can plant its own mcv_oauth and send
   * a victim to the callback with the attacker's code, and without this binding
   * the victim's guest work would land in the attacker's account.
   */
  guestUserId: string | null;
  /** seal() has no expiry of its own — this is the only thing that ends a login attempt. */
  exp: number;
}

export type AuthFlowErrorCode =
  "denied" | "state" | "iss" | "exchange" | "token";

/**
 * A failed sign-in. Never surfaces as JSON: the callback is a browser
 * navigation, so the controller turns it into `/?authError=<code>`.
 */
export class AuthFlowError extends Error {
  constructor(readonly code: AuthFlowErrorCode) {
    super(code);
  }
}

export interface CompleteLoginInput {
  code?: string;
  state?: string;
  error?: string;
  iss?: string;
  sealed: string | null;
  current: {
    userId: string | null;
    isGuest: boolean;
    sessionToken: string | null;
  };
}

/** Only the claims the id_token carries — an absent claim must not wipe what is stored. */
function mirroredProfile(claims: IdTokenClaims): {
  email?: string;
  fullName?: string;
  avatar?: string | null;
} {
  return {
    ...(claims.email !== undefined && { email: claims.email }),
    ...(claims.name !== undefined && { fullName: claims.name }),
    ...(claims.picture !== undefined && { avatar: claims.picture })
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly oidc: OidcClientService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly guests: GuestService,
    private readonly guestUsage: GuestUsageService,
    private readonly currentUser: CurrentUserService,
    private readonly config: ConfigService
  ) {}

  private secret(): string {
    const secret = this.config.get<string>("SESSION_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException({ code: "AUTH_NOT_CONFIGURED" });
    }
    return secret;
  }

  private issuer(): string {
    return (this.config.get<string>("OIDC_ISSUER") ?? "").replace(/\/$/, "");
  }

  clientOrigin(): string {
    return this.config.get<string>("CLIENT_ORIGIN") ?? "http://localhost:5300";
  }

  async beginLogin(
    returnTo: string,
    guestUserId: string | null
  ): Promise<{ authorizeUrl: string; cookie: string }> {
    const { verifier, challenge } = createPkce();
    const state = randomToken();
    const nonce = randomToken();
    const secret = this.secret();
    const authorizeUrl = await this.oidc.authorizeUrl({
      state,
      nonce,
      codeChallenge: challenge
    });
    const payload: OAuthState = {
      state,
      nonce,
      verifier,
      returnTo,
      guestUserId,
      exp: Date.now() + OAUTH_TTL_MS
    };
    return { authorizeUrl, cookie: seal(payload, secret) };
  }

  /** NFR-SEC-12 — state + PKCE + nonce + iss, then a fresh session (no fixation) and the guest claim (ADR-0023). */
  async completeLogin(
    input: CompleteLoginInput
  ): Promise<{ token: string; expiresAt: Date; redirectTo: string }> {
    const saved = input.sealed
      ? unseal<OAuthState>(input.sealed, this.secret())
      : null;
    if (
      !saved ||
      typeof saved.exp !== "number" ||
      saved.exp < Date.now() ||
      !input.state ||
      input.state !== saved.state
    ) {
      throw new AuthFlowError("state");
    }
    // State first: an `error` without the matching state is just a stranger's
    // link, and must not be able to cancel a login in progress.
    if (input.error) throw new AuthFlowError("denied");
    if (!input.code) throw new AuthFlowError("state");
    if (input.iss && input.iss.replace(/\/$/, "") !== this.issuer()) {
      throw new AuthFlowError("iss");
    }

    let idToken: string;
    try {
      idToken = await this.oidc.exchangeCode(input.code, saved.verifier);
    } catch {
      throw new AuthFlowError("exchange");
    }
    let claims: IdTokenClaims;
    try {
      claims = await this.oidc.verifyIdToken(idToken, saved.nonce);
    } catch {
      throw new AuthFlowError("token");
    }

    const profile = mirroredProfile(claims);
    const user = await this.prisma.user.upsert({
      where: { externalSub: claims.sub },
      create: { role: Role.candidate, externalSub: claims.sub, ...profile },
      update: profile
    });

    // Claim first, then purge (ADR-0023 lazy cleanup): claim is the single
    // place that decides whether a guest is still live — it refuses an expired
    // one itself — so the purge only sweeps up what is left behind.
    const { userId: currentId, isGuest, sessionToken } = input.current;
    const claimable =
      isGuest && currentId !== null && currentId === saved.guestUserId;
    const claimed = claimable
      ? await this.guests.claim(currentId, user.id)
      : false;
    await this.guests.purgeExpired();
    if (sessionToken) await this.sessions.revoke(sessionToken);

    const days = this.config.get<number>("SESSION_TTL_DAYS") ?? 7;
    const expiresAt = new Date(Date.now() + days * DAY_MS);
    const token = await this.sessions.create(user.id, expiresAt);

    // The sealed returnTo was already filtered at /auth/login; filtering again
    // keeps the redirect on CLIENT_ORIGIN even if that ever changes.
    const target = new URL(safeReturnTo(saved.returnTo), this.clientOrigin());
    if (claimed) target.searchParams.set("claimed", "1");
    return { token, expiresAt, redirectTo: target.toString() };
  }

  async me(ip: string): Promise<AuthMeDto> {
    const ctx = this.currentUser.peek();
    if (ctx?.userId && !ctx.isGuest) {
      const user = await this.prisma.user.findUnique({
        where: { id: ctx.userId }
      });
      if (user) return AuthMeDto.of("user", user, null);
    }
    const quota = await this.guestUsage.peek(ip);
    return AuthMeDto.of(
      ctx?.userId && ctx.isGuest ? "guest" : "anonymous",
      null,
      quota
    );
  }
}
