import type { AuthMeDto } from "#/types/Auth";
import type { CallOptions } from "./http.client";
import { query, withOptions, type BaseClient } from "./base.client";

// server/src/modules/auth/auth.controller.ts. login / callback answer with 302 and redirects are NOT followed: read
// `headers.location` and `setCookies`. Both share a 20/min throttle (NFR-SEC-13).
export function createAuthClient(base: BaseClient) {
  return {
    /** GET /auth/login?returnTo= → 302 to the IdP authorize URL (sets mcv_oauth), or straight back when signed in. */
    login: (params: { returnTo?: string | string[] } = {}, options?: CallOptions) =>
      base.request<never>("GET", "/auth/login", withOptions({ params: query(params) }, options)),
    /**
     * GET /auth/callback?code=&state=&iss=&error= → 302 to CLIENT_ORIGIN + returnTo (sets mcv_session), or to
     * /?authError=<code>. Needs the `mcv_oauth` cookie set by login: bind it with `api.as([oauthCookie, session?])`.
     */
    callback: (params: Record<string, string | undefined> = {}, options?: CallOptions) =>
      base.request<never>("GET", "/auth/callback", withOptions({ params: query(params) }, options)),
    /** POST /auth/logout → 204: revokes the session row, clears mcv_session. Public. */
    logout: (options?: CallOptions) => base.request<void>("POST", "/auth/logout", options),
    /** GET /auth/me → { status: anonymous | guest | user, user, guestQuota }. Public. */
    me: (options?: CallOptions) => base.request<AuthMeDto>("GET", "/auth/me", options),
  };
}
