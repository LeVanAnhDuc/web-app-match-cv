import { test as base, type APIRequest } from "@playwright/test";
import { createApiClient, type ApiClient, type ApiResponse, type Identity } from "@/api";
import { createHttp } from "@/api/http.client";
import { AccountIdentity } from "@/components/auth/account-identity.component";
import { databaseUrl } from "@/config/database";
import { getUrls } from "@/config/urls";
import { AccountShellPage } from "@/pages/auth/account-shell.page";
import { AuthErrorPage } from "@/pages/auth/auth-error.page";
import { SignInGatePage } from "@/pages/auth/sign-in-gate.page";
import { sql } from "@/utils/db";
import {
  FakeIdp,
  randomSub,
  startAuthServer,
  unsealOAuthState,
  type AuthServer,
  type FakeIdentity,
  type OAuthState,
} from "@/utils/fake-idp";
import { liveCookie } from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "auth" (decision D5, src/docs/decisions/auth.md Q1). Everything that starts a sign-in talks to
// a DEDICATED Match CV process whose OIDC_* points at an in-worker fake IdP — never to the dev server's real Ducker ID.
//
// worker   authIdp          FakeIdp (discovery, JWKS, /oauth/authorize auto-consent, /oauth/token; RS256)
//          authServer       Match CV API process on a free port wired to authIdp (same dev DB, no server/.env, no AI key)
//          authApi          anonymous ApiClient on authServer (`.as(cookie)` for anyone else)
// test     authFlow         drive login → code → callback by hand; users it signs in are deleted after the test
//          authSpawnServer  a fresh, throw-away instance (own throttle counters; OIDC unreachable / not configured)
//          authBrowser      UI helpers: send the app's "Sign in" link to authServer, plant a session cookie
//          signInGatePage, authErrorPage, accountShellPage, accountIdentity   page objects / component of this module

export interface BegunLogin {
  res: ApiResponse<never>;
  /** Location of the 302 (authorize URL, or the web URL when login short-circuits). */
  location: URL | null;
  state: string;
  nonce: string;
  codeChallenge: string;
  /** `mcv_oauth=<value>` ready for a Cookie header, or undefined when none was set. */
  oauthCookie: string | undefined;
  /** What the cookie carries, unsealed with the instance's SESSION_SECRET. */
  sealed: OAuthState | null;
}

export interface SignedIn {
  begun: BegunLogin;
  callback: ApiResponse<never>;
  /** `mcv_session=<token>` the callback set, or undefined when it failed. */
  sessionCookie: string | undefined;
  identity: FakeIdentity;
}

export interface AuthFlow {
  readonly idp: FakeIdp;
  readonly server: AuthServer;
  readonly api: ApiClient;
  /** A fresh IdP identity (random sub, email <sub>@auth.test); its User row is deleted after the test. */
  identity(overrides?: Partial<FakeIdentity>): FakeIdentity;
  /** Remember a sub created some other way (e.g. idp.nextIdentity) so it is cleaned up too. */
  track(sub: string): void;
  /** GET /auth/login on authServer as `as` (anonymous by default). */
  begin(returnTo?: string, as?: Identity): Promise<BegunLogin>;
  /** An authorization code for `begun`, as the IdP would issue after consent. */
  code(begun: BegunLogin, identity: FakeIdentity): string;
  /** GET /auth/callback with the given query, sending every cookie in `cookies` (undefined ones skipped). */
  callback(query: Record<string, string | undefined>, cookies?: Array<string | undefined>): Promise<ApiResponse<never>>;
  /** login → code → callback (with iss) in one go. `as` = the browser's current mcv_session (guest or user). */
  signIn(opts?: { identity?: FakeIdentity; returnTo?: string; as?: string }): Promise<SignedIn>;
  /** The User row for an IdP subject, or null. */
  userBySub(sub: string): Promise<UserRow | null>;
}

export interface UserRow {
  id: string;
  role: string;
  isGuest: boolean;
  email: string | null;
  fullName: string | null;
  avatar: string | null;
  [key: string]: unknown;
}

export type SpawnMode = "fake-idp" | "oidc-unreachable" | "oidc-missing";

export interface SpawnedServer {
  server: AuthServer;
  api: ApiClient;
  /** One GET that is NEVER retried on 429 (the shared http client waits a throttler 429 out). Returns the status. */
  hitOnce(path: string, cookie?: string): Promise<number>;
}

export interface AuthBrowser {
  /**
   * Make every "Sign in" link of the app land on authServer instead of the dev API: the dev server's
   * GET /auth/login is answered with a 302 to the same path + query on authServer, which then runs the whole
   * round trip against the fake IdP (auto-consent) and redirects back to the web app with a session cookie.
   */
  routeSignInToFakeIdp(): Promise<void>;
  /** Put `mcv_session=<token>` (as returned by utils/sessions or authFlow) into this page's browser context. */
  useSession(cookie: string): Promise<void>;
}

const OAUTH_COOKIE = "mcv_oauth";
const SESSION_COOKIE = "mcv_session";

function begunFrom(res: ApiResponse<never>, secret: string): BegunLogin {
  const raw = res.headers.location;
  const location = raw ? new URL(raw) : null;
  const oauthCookie = liveCookie(res.setCookies, OAUTH_COOKIE);
  return {
    res,
    location,
    state: location?.searchParams.get("state") ?? "",
    nonce: location?.searchParams.get("nonce") ?? "",
    codeChallenge: location?.searchParams.get("code_challenge") ?? "",
    oauthCookie,
    sealed: oauthCookie ? unsealOAuthState(oauthCookie.slice(OAUTH_COOKIE.length + 1), secret) : null,
  };
}

function clientFor(request: APIRequest, apiUrl: string): ApiClient {
  return createApiClient(
    createHttp(request, apiUrl, (ms) => {
      try {
        const info = base.info();
        info.setTimeout(info.timeout + ms);
      } catch {
        // outside a test
      }
    })
  );
}

export const test = shared.extend<
  {
    authFlow: AuthFlow;
    authSpawnServer: (mode: SpawnMode) => Promise<SpawnedServer>;
    authBrowser: AuthBrowser;
    signInGatePage: SignInGatePage;
    authErrorPage: AuthErrorPage;
    accountShellPage: AccountShellPage;
    accountIdentity: AccountIdentity;
  },
  { authIdp: FakeIdp; authServer: AuthServer; authApi: ApiClient }
>({
  authIdp: [
    async ({}, use) => {
      const idp = await new FakeIdp().start();
      await use(idp);
      await idp.stop();
    },
    { scope: "worker" },
  ],

  authServer: [
    async ({ env, authIdp }, use) => {
      const server = await startAuthServer({
        clientOrigin: getUrls(env).webUrl,
        databaseUrl: databaseUrl(),
        oidc: { issuer: authIdp.issuer, clientId: authIdp.clientId, clientSecret: authIdp.clientSecret },
      });
      await use(server);
      await server.stop();
    },
    { scope: "worker", timeout: 90_000 },
  ],

  authApi: [async ({ playwright, authServer }, use) => use(clientFor(playwright.request, authServer.apiUrl)), { scope: "worker" }],

  authFlow: async ({ authIdp, authServer, authApi }, use) => {
    const subs: string[] = [];
    const flow: AuthFlow = {
      idp: authIdp,
      server: authServer,
      api: authApi,
      identity(overrides = {}) {
        const sub = overrides.sub ?? randomSub("auth-e2e");
        subs.push(sub);
        return { sub, email: `${sub}@auth.test`, name: "Auth E2E Person", ...overrides };
      },
      track(sub) {
        subs.push(sub);
      },
      async begin(returnTo = "/", as) {
        const res = await authApi.as(as).auth.login({ returnTo });
        return begunFrom(res, authServer.sessionSecret);
      },
      code(begun, identity) {
        return authIdp.issueCode({
          nonce: begun.nonce,
          codeChallenge: begun.codeChallenge,
          redirectUri: authServer.redirectUri,
          identity,
        });
      },
      callback(query, cookies = []) {
        return authApi.as(cookies.filter((c): c is string => Boolean(c))).auth.callback(query);
      },
      async signIn(opts = {}) {
        const identity = opts.identity ?? flow.identity();
        const begun = await flow.begin(opts.returnTo ?? "/", opts.as);
        const code = flow.code(begun, identity);
        const callback = await flow.callback(
          { code, state: begun.state, iss: authIdp.issuer },
          [opts.as, begun.oauthCookie]
        );
        return { begun, callback, sessionCookie: liveCookie(callback.setCookies, SESSION_COOKIE), identity };
      },
      async userBySub(sub) {
        const [row] = await sql<UserRow>(
          'SELECT id, role, "isGuest", email, "fullName", avatar FROM "User" WHERE "externalSub" = $1',
          [sub]
        );
        return row ?? null;
      },
    };
    await use(flow);
    if (subs.length) {
      await sql('DELETE FROM "User" WHERE "externalSub" = ANY($1::text[])', [subs]).catch(() => undefined);
    }
  },

  authSpawnServer: async ({ env, playwright, authIdp }, use) => {
    const started: AuthServer[] = [];
    await use(async (mode) => {
      const oidc =
        mode === "fake-idp"
          ? { issuer: authIdp.issuer, clientId: authIdp.clientId, clientSecret: authIdp.clientSecret }
          : mode === "oidc-unreachable"
            ? { issuer: "http://127.0.0.1:9", clientId: "nobody", clientSecret: "nothing" }
            : undefined;
      const server = await startAuthServer({ clientOrigin: getUrls(env).webUrl, databaseUrl: databaseUrl(), oidc });
      started.push(server);
      const hitOnce = async (path: string, cookie?: string) => {
        const ctx = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
          extraHTTPHeaders: cookie ? { Cookie: cookie } : {},
        });
        try {
          const res = await ctx.get(`${server.apiUrl}${path}`, { maxRedirects: 0, failOnStatusCode: false });
          return res.status();
        } finally {
          await ctx.dispose();
        }
      };
      return { server, api: clientFor(playwright.request, server.apiUrl), hitOnce };
    });
    for (const server of started) await server.stop().catch(() => undefined);
  },

  authBrowser: async ({ page, urls, authServer }, use) => {
    const api = new URL(urls.apiUrl);
    await use({
      async routeSignInToFakeIdp() {
        await page.route(`${urls.apiUrl}/auth/login**`, async (route) => {
          const url = new URL(route.request().url());
          const path = url.pathname.slice(api.pathname.length);
          await route.fulfill({ status: 302, headers: { location: `${authServer.apiUrl}${path}${url.search}` } });
        });
      },
      async useSession(cookie) {
        const [name, ...rest] = cookie.split("=");
        await page.context().addCookies([
          {
            name,
            value: rest.join("="),
            domain: new URL(urls.webUrl).hostname,
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
      },
    });
  },

  signInGatePage: async ({ page }, use) => use(new SignInGatePage(page)),
  authErrorPage: async ({ page }, use) => use(new AuthErrorPage(page)),
  accountShellPage: async ({ page }, use) => use(new AccountShellPage(page)),
  accountIdentity: async ({ page }, use) => use(new AccountIdentity(page)),
});

