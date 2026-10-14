import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createSign,
  generateKeyPairSync,
  randomBytes,
  type JsonWebKey,
  type KeyObject,
} from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// A stand-in for Ducker ID (decision D5 of module auth): OIDC discovery, JWKS, /oauth/authorize (auto-consent) and
// /oauth/token, signing id_tokens with RS256. It runs inside the Playwright worker, so a spec can steer it directly
// (next identity, a deny, a broken token response) and read back what Match CV sent to it. A dedicated Match CV server
// instance points its OIDC_ISSUER here (fixtures/modules/auth.fixture.ts); nothing ever reaches the real IdP.
//
// Also owns the mcv_oauth sealing format (server/src/modules/auth/oidc/sealed-cookie.ts: AES-256-GCM, key =
// sha256(SESSION_SECRET), iv | tag | ciphertext, base64url): the suite owns that instance's SESSION_SECRET, so it can
// read what /auth/login sealed and craft an expired or forged cookie.
//
// And starts the dedicated Match CV API process those specs talk to (startAuthServer, bottom of this file).
//
// No imports from config/, pages/, api/ or fixtures/ — node built-ins only.

export interface FakeIdentity {
  sub: string;
  email?: string;
  name?: string;
  picture?: string | null;
  email_verified?: boolean;
}

/** What /oauth/token answers instead of a good id_token, for the next token request only. */
export type TokenFault =
  | "http-400"
  | "http-500"
  | "no-id-token"
  | "bad-signature"
  | "unknown-kid"
  | "alg-hs256"
  | "wrong-aud"
  | "wrong-iss"
  | "expired"
  | "wrong-nonce";

export const TOKEN_FAULTS: readonly TokenFault[] = [
  "http-400",
  "http-500",
  "no-id-token",
  "bad-signature",
  "unknown-kid",
  "alg-hs256",
  "wrong-aud",
  "wrong-iss",
  "expired",
  "wrong-nonce",
];

/** Faults Match CV must classify as `exchange` (the token call failed); the rest are `token` (id_token rejected). */
export const EXCHANGE_FAULTS: readonly TokenFault[] = ["http-400", "http-500", "no-id-token"];

export interface IdpRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface TokenRequestRecord {
  /** Decoded `Authorization: Basic` pair, or null when the header is absent / not Basic. */
  basic: { clientId: string; clientSecret: string } | null;
  form: Record<string, string>;
  /** Whether sha256(code_verifier) matched the code_challenge sent to /oauth/authorize. */
  pkceOk: boolean;
  /** The id_token handed back (undefined when a fault replaced it). */
  idToken?: string;
  accessToken?: string;
}

interface PendingCode {
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
  clientId: string;
  identity: FakeIdentity;
  used: boolean;
}

export interface IssueCodeInput {
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
  identity: FakeIdentity;
  clientId?: string;
}

export interface FakeIdpOptions {
  clientId?: string;
  clientSecret?: string;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export function randomSub(prefix = "fake-idp"): string {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

/** sha256(verifier) base64url — the S256 code_challenge (RFC 7636). */
export function s256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Decode a JWT's header and payload without verifying (to inspect what was minted). */
export function decodeJwt(token: string): { header: Record<string, unknown>; payload: Record<string, unknown> } {
  const [h, p] = token.split(".");
  return {
    header: JSON.parse(Buffer.from(h, "base64url").toString("utf8")),
    payload: JSON.parse(Buffer.from(p, "base64url").toString("utf8")),
  };
}

// ── mcv_oauth sealing (mirror of server/src/modules/auth/oidc/sealed-cookie.ts) ──────────────────────────────────

const IV_BYTES = 12;
const TAG_BYTES = 16;
const keyOf = (secret: string) => createHash("sha256").update(secret).digest();

/** What /auth/login seals into mcv_oauth (server/src/modules/auth/auth.service.ts OAuthState). */
export interface OAuthState {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  guestUserId: string | null;
  exp: number;
}

export function sealOAuthState(payload: object, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unsealOAuthState(value: string, secret: string): OAuthState | null {
  try {
    const raw = Buffer.from(decodeURIComponent(value), "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyOf(secret), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const text = Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
    return JSON.parse(text) as OAuthState;
  } catch {
    return null;
  }
}

// ── the IdP ──────────────────────────────────────────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export class FakeIdp {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Every request received, in order (discovery, jwks, authorize, token, anything else). */
  readonly requests: IdpRequest[] = [];
  readonly tokenRequests: TokenRequestRecord[] = [];
  /** Identity /oauth/authorize signs in next (browser flow). Reset to a fresh random sub after each use. */
  nextIdentity: FakeIdentity;
  /** "deny": /oauth/authorize redirects back with error=access_denied (the user cancelled). */
  authorizeBehaviour: "consent" | "deny" = "consent";

  private server: Server | null = null;
  private port = 0;
  private readonly kid = `fake-${randomBytes(4).toString("hex")}`;
  private readonly keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  private readonly otherKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  private readonly codes = new Map<string, PendingCode>();
  private fault: TokenFault | null = null;

  constructor(opts: FakeIdpOptions = {}) {
    this.clientId = opts.clientId ?? `mcv-test-${randomBytes(4).toString("hex")}`;
    this.clientSecret = opts.clientSecret ?? randomBytes(24).toString("base64url");
    this.nextIdentity = { sub: randomSub() };
  }

  /** `http://127.0.0.1:<port>` — what Match CV must see as OIDC_ISSUER and in discovery. */
  get issuer(): string {
    if (!this.server) throw new Error("FakeIdp not started");
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<this> {
    const server = createServer((req, res) => {
      this.handle(req, res).catch((e: unknown) => json(res, 500, { error: "server_error", detail: String(e) }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    this.server = server;
    this.port = (server.address() as AddressInfo).port;
    return this;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  /** The next /oauth/token request answers with `fault` instead of a good id_token. */
  failNextToken(fault: TokenFault): void {
    this.fault = fault;
  }

  /**
   * Hand out an authorization code the way /oauth/authorize would after consent — for API specs that read the
   * authorize URL from /auth/login's Location and then call /auth/callback themselves.
   */
  issueCode(input: IssueCodeInput): string {
    const code = randomBytes(24).toString("base64url");
    this.codes.set(code, {
      nonce: input.nonce,
      codeChallenge: input.codeChallenge,
      redirectUri: input.redirectUri,
      clientId: input.clientId ?? this.clientId,
      identity: input.identity,
      used: false,
    });
    return code;
  }

  /** Every value this IdP minted that must never leave Match CV's server (codes, id_tokens, access tokens). */
  secretsHandedOut(): string[] {
    const out = [...this.codes.keys()];
    for (const t of this.tokenRequests) {
      if (t.idToken) out.push(t.idToken);
      if (t.accessToken) out.push(t.accessToken);
    }
    return out;
  }

  /** Sign an id_token. `opts.key: "other"` signs with a key that is not in the JWKS. */
  signIdToken(
    claims: Record<string, unknown>,
    opts: { kid?: string; key?: "jwks" | "other"; alg?: "RS256" | "HS256" } = {}
  ): string {
    const alg = opts.alg ?? "RS256";
    const header = b64url(JSON.stringify({ alg, typ: "JWT", kid: opts.kid ?? this.kid }));
    const payload = b64url(JSON.stringify(claims));
    const input = `${header}.${payload}`;
    if (alg === "HS256") return `${input}.${createHmac("sha256", this.clientSecret).update(input).digest("base64url")}`;
    const key: KeyObject = (opts.key === "other" ? this.otherKeys : this.keys).privateKey;
    return `${input}.${createSign("RSA-SHA256").update(input).sign(key).toString("base64url")}`;
  }

  private jwk(): JsonWebKey & { kid: string; alg: string; use: string } {
    return { ...this.keys.publicKey.export({ format: "jwk" }), kid: this.kid, alg: "RS256", use: "sig" };
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", this.issuer);
    const body = await readBody(req);
    const query = Object.fromEntries(url.searchParams.entries());
    this.requests.push({ method: req.method ?? "GET", path: url.pathname, query, headers: req.headers, body });

    if (req.method === "GET" && url.pathname === "/.well-known/openid-configuration") {
      return json(res, 200, {
        issuer: this.issuer,
        authorization_endpoint: `${this.issuer}/oauth/authorize`,
        token_endpoint: `${this.issuer}/oauth/token`,
        jwks_uri: `${this.issuer}/.well-known/jwks.json`,
        userinfo_endpoint: `${this.issuer}/oauth/userinfo`,
        response_types_supported: ["code"],
        id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_basic"],
      });
    }
    if (req.method === "GET" && url.pathname === "/.well-known/jwks.json") {
      return json(res, 200, { keys: [this.jwk()] });
    }
    if (req.method === "GET" && url.pathname === "/oauth/authorize") return this.authorize(query, res);
    if (req.method === "POST" && url.pathname === "/oauth/token") return this.token(req, body, res);
    return json(res, 404, { error: "not_found" });
  }

  private authorize(query: Record<string, string>, res: ServerResponse): void {
    const redirect = query.redirect_uri;
    if (!redirect || query.client_id !== this.clientId) return json(res, 400, { error: "invalid_request" });
    const back = new URL(redirect);
    if (this.authorizeBehaviour === "deny") {
      back.searchParams.set("error", "access_denied");
      if (query.state) back.searchParams.set("state", query.state);
    } else {
      const code = this.issueCode({
        nonce: query.nonce ?? "",
        codeChallenge: query.code_challenge ?? "",
        redirectUri: redirect,
        identity: this.nextIdentity,
      });
      this.nextIdentity = { sub: randomSub() };
      back.searchParams.set("code", code);
      if (query.state) back.searchParams.set("state", query.state);
      back.searchParams.set("iss", this.issuer);
    }
    res.writeHead(302, { Location: back.toString() });
    res.end();
  }

  private token(req: IncomingMessage, body: string, res: ServerResponse): void {
    const form = Object.fromEntries(new URLSearchParams(body).entries());
    const auth = req.headers.authorization ?? "";
    let basic: TokenRequestRecord["basic"] = null;
    if (auth.startsWith("Basic ")) {
      const [id, secret] = Buffer.from(auth.slice(6), "base64").toString("utf8").split(":");
      basic = { clientId: decodeURIComponent(id ?? ""), clientSecret: decodeURIComponent(secret ?? "") };
    }
    const pending = this.codes.get(form.code ?? "");
    const pkceOk = Boolean(pending && form.code_verifier && s256(form.code_verifier) === pending.codeChallenge);
    const record: TokenRequestRecord = { basic, form, pkceOk };
    this.tokenRequests.push(record);

    const fault = this.fault;
    this.fault = null;
    if (fault === "http-400") return json(res, 400, { error: "invalid_grant" });
    if (fault === "http-500") return json(res, 500, { error: "server_error" });

    const clientOk = basic?.clientId === this.clientId && basic.clientSecret === this.clientSecret;
    if (!clientOk) return json(res, 401, { error: "invalid_client" });
    if (form.grant_type !== "authorization_code" || !pending || pending.used) {
      return json(res, 400, { error: "invalid_grant" });
    }
    if (form.redirect_uri !== pending.redirectUri || !pkceOk) return json(res, 400, { error: "invalid_grant" });
    pending.used = true;

    const accessToken = randomBytes(24).toString("base64url");
    record.accessToken = accessToken;
    if (fault === "no-id-token") return json(res, 200, { access_token: accessToken, token_type: "Bearer" });

    const now = Math.floor(Date.now() / 1000);
    const { sub, ...profile } = pending.identity;
    const claims: Record<string, unknown> = {
      iss: fault === "wrong-iss" ? "http://evil.test" : this.issuer,
      sub,
      aud: fault === "wrong-aud" ? "someone-else" : pending.clientId,
      iat: now,
      exp: fault === "expired" ? now - 3600 : now + 300,
      nonce: fault === "wrong-nonce" ? "not-the-nonce" : pending.nonce,
      ...profile,
    };
    const idToken =
      fault === "bad-signature"
        ? this.signIdToken(claims, { key: "other" })
        : fault === "unknown-kid"
          ? this.signIdToken(claims, { key: "other", kid: `rotated-${randomBytes(3).toString("hex")}` })
          : fault === "alg-hs256"
            ? this.signIdToken(claims, { alg: "HS256" })
            : this.signIdToken(claims);
    record.idToken = idToken;
    return json(res, 200, { access_token: accessToken, token_type: "Bearer", expires_in: 300, id_token: idToken });
  }
}

// ── the dedicated Match CV instance ──────────────────────────────────────────────────────────────────────────────
// The app's own build (server/dist/src/main.js) with OIDC_* pointed at a FakeIdp, on a free port, sharing the dev
// database. The dev server on :5200 keeps its real Ducker ID config and is never asked to start a sign-in. The
// process runs from an empty temp cwd, so it loads NO server/.env: every setting it gets is listed here, and no AI
// provider key reaches it (D1).

export interface AuthServerEnv {
  /** Web origin the instance redirects to and allows in CORS (the real web app, e.g. http://localhost:5300). */
  clientOrigin: string;
  databaseUrl: string;
  /** Leave the OIDC group out entirely to model "not configured". */
  oidc?: { issuer: string; clientId: string; clientSecret: string };
  /** Defaults to 48 random chars; the suite needs it to read / forge mcv_oauth. */
  sessionSecret?: string;
  extra?: Record<string, string>;
  /** Override the build to run (default: serverMain()). */
  main?: string;
}

export interface AuthServer {
  port: number;
  /** http://localhost:<port> */
  origin: string;
  /** http://localhost:<port>/api/v1 */
  apiUrl: string;
  /** What OIDC_REDIRECT_URI is set to. */
  redirectUri: string;
  sessionSecret: string;
  /** Everything the process wrote to stdout + stderr so far. */
  logs(): string;
  stop(): Promise<void>;
}

/** server/dist/src/main.js of the app this suite sits in (resolved lazily: __dirname exists only once compiled to CJS). */
export function serverMain(): string {
  return join(resolve(__dirname, "..", "..", ".."), "server", "dist", "src", "main.js");
}

export async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const srv = createNetServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolvePort(port));
    });
  });
}

async function waitHealthy(url: string, child: ChildProcess, logs: () => string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`auth server exited (${child.exitCode}) before it was healthy:\n${logs()}`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`auth server not healthy after ${timeoutMs} ms:\n${logs()}`);
}

export async function startAuthServer(env: AuthServerEnv, timeoutMs = 60_000): Promise<AuthServer> {
  const main = env.main ?? serverMain();
  if (!existsSync(main)) {
    throw new Error(`${main} is missing — build the server first (cd ../server && pnpm build)`);
  }
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  const apiUrl = `${origin}/api/v1`;
  const redirectUri = `${apiUrl}/auth/callback`;
  const sessionSecret = env.sessionSecret ?? randomBytes(36).toString("base64url");

  const childEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    NODE_ENV: "development",
    PORT: String(port),
    CLIENT_ORIGIN: env.clientOrigin,
    DATABASE_URL: env.databaseUrl,
    SESSION_SECRET: sessionSecret,
    ...(env.oidc && {
      OIDC_ISSUER: env.oidc.issuer,
      OIDC_CLIENT_ID: env.oidc.clientId,
      OIDC_CLIENT_SECRET: env.oidc.clientSecret,
      OIDC_REDIRECT_URI: redirectUri,
    }),
    ...(env.extra ?? {}),
  };
  const cwd = mkdtempSync(join(tmpdir(), "mcv-auth-server-"));
  const child = spawn(process.execPath, [main], { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout?.on("data", (d: Buffer) => (output += d.toString("utf8")));
  child.stderr?.on("data", (d: Buffer) => (output += d.toString("utf8")));
  const logs = () => output;

  const stop = async () => {
    if (child.exitCode !== null) return;
    await new Promise<void>((done) => {
      child.once("exit", () => done());
      child.kill();
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        done();
      }, 5000).unref();
    });
  };

  try {
    await waitHealthy(`${apiUrl}/health`, child, logs, timeoutMs);
  } catch (e) {
    await stop();
    throw e;
  }
  return { port, origin, apiUrl, redirectUri, sessionSecret, logs, stop };
}
