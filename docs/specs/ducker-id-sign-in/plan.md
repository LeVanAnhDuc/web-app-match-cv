# Ducker ID sign-in + guest mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock user with sign-in through Ducker ID (OIDC, BFF, own session) and add a guest mode that can only run the wizard on the system key, 5 matches/IP/day, data kept 24 h and carried into the account on sign-in.

**Architecture:** NestJS is a confidential OIDC client; it mints its own `mcv_session` cookie (hash stored in `Session`). A middleware resolves the cookie into an `AsyncLocalStorage` request context that `CurrentUserService.getUserId()` reads, so existing services are untouched. A global `AuthGuard` denies by default; `@Public()` / `@AllowGuest()` open endpoints. Guests are short-lived `User` rows created lazily on the first `POST /documents`; on sign-in their rows are re-owned in one transaction.

**Tech Stack:** NestJS 11, Prisma 6 + PostgreSQL, `node:crypto` (no new dependency), Jest + supertest; TanStack Start (React 19) + antd 5 + Tailwind 4 + TanStack Query + Zustand + i18next; Vitest; Playwright.

**Spec:** `docs/specs/ducker-id-sign-in/design.md` (read it first — every task argues from it).

## Global Constraints

- Work only inside the worktree `D:\Learn\web-app-ecosystem\web-app-match-cv\.worktrees\ducker-id-sign-in` on branch `feat/ducker-id-sign-in`. Never commit to `main`.
- **No new runtime dependency** on either side (ADR-0022). Use `node:crypto`, `node:async_hooks`, Express `res.cookie`.
- Before touching `server/src/**` read `server/.claude/CLAUDE.md`; before `client/src/**` read `client/.claude/CLAUDE.md`. Their quality gates are mandatory at the end of each task touching that side:
  - server: `pnpm format && pnpm lint && pnpm type-check && pnpm test && pnpm build` (+ `pnpm test:e2e` when the AppModule graph or guards change — Tasks 2–8)
  - client: `pnpm format && pnpm lint && pnpm type-check && pnpm test && pnpm build`
- Cookie names: `mcv_session`, `mcv_oauth`. Never `sid` / `refreshToken` (Ducker ID owns those on `localhost`).
- Session: random 32 bytes base64url in the cookie; DB stores `sha256(token)` hex. Cookie `HttpOnly; SameSite=Lax; Path=/; Secure` only when `NODE_ENV=production`.
- Guest TTL `GUEST_TTL_HOURS` (default 24); user session `SESSION_TTL_DAYS` (default 7); guest quota `GUEST_MATCH_LIMIT_PER_DAY` (default 5) per `HMAC-SHA256(SESSION_SECRET, ip)` per **UTC** day.
- `returnTo` accepts only a relative path: starts with `/`, not `//`, no `\`. Anything else → `/`.
- Error codes in JSON bodies: `SIGN_IN_REQUIRED` (401), `GUEST_FORBIDDEN_CREDENTIAL` (403), `GUEST_QUOTA_EXCEEDED` (429, with `resetsAt` ISO string).
- Copy (EN): "Sign in with Ducker ID", "Sign in", "Sign out", "Guest mode", "Free matches today", "{{left}} / {{limit}} left", "Kept for 24 hours, then deleted", "Sign in to keep it", "You have used today's {{limit}} free matches", "Resets in {{time}}", "Saved to your account." — VI equivalents in the same commit (`ux-copy.md`).
- Every button touched by this feature is 44px tall (`!h-11`) and full width below `md` (NFR-A11Y-03, design §6.4).
- Table names are the Prisma model names quoted (`"User"`, `"Document"`, …) — there is no `@@map`.
- Conventional Commits, English subject, scope `auth` / `guest` / `wizard` / `shell` / `docs(ducker-id-sign-in)`; body explains why and cites IDs.

---

### Task 1: Schema — sessions, guests, guest usage, cascades, drop the mock user

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/<timestamp>_auth_sessions_and_guests/migration.sql` (generated, then edited)
- Modify: `docs/erd.md`

**Interfaces:**
- Produces: Prisma models `Session { id, userId, expiresAt, createdAt }`, `GuestUsage { ipHash, day, count }`, `User.{externalSub @unique, isGuest, guestExpiresAt, email, fullName, avatar, updatedAt, sessions}`.

- [ ] **Step 1: Edit `schema.prisma`**

In `model User` replace `externalSub String?` and add fields/relations:

```prisma
model User {
  id             String    @id @default(uuid())
  role           Role
  externalSub    String?   @unique
  isGuest        Boolean   @default(false)
  guestExpiresAt DateTime?
  email          String?
  fullName       String?
  avatar         String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  documents     Document[]
  matchResults  MatchResult[]
  matchRuns     MatchRun[]
  aiCredentials AiCredential[]
  coverLetters  CoverLetter[]
  sessions      Session[]

  @@index([isGuest, guestExpiresAt])
}

model Session {
  id        String   @id
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model GuestUsage {
  ipHash String
  day    DateTime @db.Date
  count  Int      @default(0)

  @@id([ipHash, day])
}
```

Change relations (keep everything else):
- `Document.user` → `@relation(fields: [userId], references: [id], onDelete: Cascade)`
- `MatchResult.user` → `onDelete: Cascade`
- `MatchResult.cvDocument`, `MatchResult.jdDocument`, `MatchRun.cvDocument`, `MatchRun.jdDocument` → add `onDelete: NoAction`.
  Why NoAction and not the default Restrict: deleting a `User` cascades to both `Document` and `MatchResult` in one statement; Postgres checks `RESTRICT` immediately (fails mid-cascade) but `NO ACTION` at statement end (passes once both sides are gone). Deleting a single in-use document still fails with a FK error, so FR-07's 409 keeps working.

- [ ] **Step 2: Generate the migration without applying**

Run (in `server/`): `pnpm exec prisma migrate dev --create-only --name auth_sessions_and_guests`
Expected: a new folder under `prisma/migrations/`.

- [ ] **Step 3: Append the mock-user deletion to the generated `migration.sql`** (at the very end, after all `ALTER TABLE`s):

```sql
-- FR-18 / ADR-0023: the mock user of ADR-0008 is gone. Its rows are deleted,
-- not migrated (decided with the user 2026-10-04). Cascades above make this
-- one statement.
DELETE FROM "User" WHERE "id" = '00000000-0000-0000-0000-000000000001';
```

- [ ] **Step 4: Apply and regenerate**

Run: `pnpm exec prisma migrate dev` then `pnpm exec prisma generate`
Expected: "Your database is now in sync with your schema."

- [ ] **Step 5: Update `docs/erd.md`** — add `Session`, `GuestUsage`, the new `User` columns, the cascade changes; remove 📝 marks for `email`/`fullName`/`avatar`/`updatedAt`; drop `isMock` and `phone` with a one-line note citing ADR-0023 (no claim for phone in Ducker ID).

- [ ] **Step 6: Commit**

```bash
git add server/prisma docs/erd.md
git commit -m "feat(auth): add sessions, guest users and guest usage to the schema"
```
(Body: why NoAction on document FKs; mock user deleted per ADR-0023; refs FR-18, FR-21.)

---

### Task 2: Request context, `CurrentUserService`, env vars — remove `STUB_USER_ID`

**Files:**
- Create: `server/src/common/request-context/request-context.ts`
- Modify: `server/src/common/current-user/current-user.service.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/prisma/seed.ts` (stub user removed — see Step 5)
- Modify: `server/src/modules/documents/documents.service.spec.ts`, `server/src/modules/comparison/comparison.service.spec.ts` (replace `STUB_USER_ID` import with a local constant)
- Create: `server/src/i18n/en/auth.json`, `server/src/i18n/vi/auth.json`
- Test: `server/src/common/current-user/current-user.service.spec.ts`

**Interfaces:**
- Produces:
  - `interface RequestContextStore { userId: string | null; isGuest: boolean; sessionToken: string | null }`
  - `const requestContext: AsyncLocalStorage<RequestContextStore>`
  - `CurrentUserService.getUserId(): string` (throws `UnauthorizedException` with `{ code: "SIGN_IN_REQUIRED" }` when no user), `CurrentUserService.isGuest(): boolean`, `CurrentUserService.peek(): RequestContextStore | undefined`

- [ ] **Step 1: Write the failing test** `current-user.service.spec.ts`

```ts
import { UnauthorizedException } from "@nestjs/common";
import { requestContext } from "../request-context/request-context";
import { CurrentUserService } from "./current-user.service";

describe("CurrentUserService", () => {
  const service = new CurrentUserService();

  it("returns the user id bound to the current request", () => {
    requestContext.run(
      { userId: "u-1", isGuest: false, sessionToken: "t" },
      () => {
        expect(service.getUserId()).toBe("u-1");
        expect(service.isGuest()).toBe(false);
      }
    );
  });

  it("reports a guest", () => {
    requestContext.run(
      { userId: "g-1", isGuest: true, sessionToken: "t" },
      () => expect(service.isGuest()).toBe(true)
    );
  });

  it("throws 401 SIGN_IN_REQUIRED when nobody is bound", () => {
    requestContext.run(
      { userId: null, isGuest: false, sessionToken: null },
      () => expect(() => service.getUserId()).toThrow(UnauthorizedException)
    );
  });

  it("throws 401 outside any request", () => {
    expect(() => service.getUserId()).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run it** — `pnpm test -- current-user` → FAIL (module not found).

- [ ] **Step 3: Implement**

`request-context.ts`:
```ts
import { AsyncLocalStorage } from "async_hooks";

/**
 * Who the current HTTP request acts as. Filled by SessionMiddleware for every
 * request, mutated once by AuthGuard when it lazily creates a guest. Read only
 * through CurrentUserService so no service learns where the id comes from
 * (ADR-0022 — "when auth arrives only the source of userId changes").
 */
export interface RequestContextStore {
  userId: string | null;
  isGuest: boolean;
  sessionToken: string | null;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();
```

`current-user.service.ts`:
```ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import {
  requestContext,
  type RequestContextStore
} from "../request-context/request-context";

@Injectable()
export class CurrentUserService {
  getUserId(): string {
    const userId = requestContext.getStore()?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        code: "SIGN_IN_REQUIRED",
        message:
          I18nContext.current()?.t("auth.errors.signInRequired" as never) ??
          "Sign in required."
      });
    }
    return userId;
  }

  isGuest(): boolean {
    return requestContext.getStore()?.isGuest ?? false;
  }

  peek(): RequestContextStore | undefined {
    return requestContext.getStore();
  }
}
```

`auth.json` (en): `{ "errors": { "signInRequired": "Sign in required.", "guestCredential": "Guests can only use the system AI key.", "guestQuota": "You have used today's free matches.", "notConfigured": "Sign-in is not configured on this server." } }` — vi: `{ "errors": { "signInRequired": "Cần đăng nhập.", "guestCredential": "Khách chỉ dùng được khoá AI của hệ thống.", "guestQuota": "Bạn đã dùng hết lượt match miễn phí hôm nay.", "notConfigured": "Máy chủ chưa cấu hình đăng nhập." } }`.

`env.validation.ts` — add to `EnvVars` (all optional at boot, mirroring `CREDENTIAL_ENCRYPTION_KEY`: the auth endpoints answer 503 when missing):
```ts
  // --- Sign-in through Ducker ID (ADR-0022). Optional at boot so unit/e2e
  // tests need no IdP; /auth/login and /auth/callback answer 503 without them.
  @IsOptional() @IsString() OIDC_ISSUER?: string;
  @IsOptional() @IsString() OIDC_CLIENT_ID?: string;
  @IsOptional() @IsString() OIDC_CLIENT_SECRET?: string;
  @IsOptional() @IsString() OIDC_REDIRECT_URI?: string;
  // ≥32 chars. Seals the mcv_oauth cookie and keys the guest IP HMAC.
  @IsOptional() @IsString() SESSION_SECRET?: string;
  @IsInt() SESSION_TTL_DAYS: number = 7;
  @IsInt() GUEST_TTL_HOURS: number = 24;
  @IsInt() GUEST_MATCH_LIMIT_PER_DAY: number = 5;
```
and in `validateEnv` coerce the three ints like `PORT`:
`SESSION_TTL_DAYS: Number(config.SESSION_TTL_DAYS ?? 7), GUEST_TTL_HOURS: Number(config.GUEST_TTL_HOURS ?? 24), GUEST_MATCH_LIMIT_PER_DAY: Number(config.GUEST_MATCH_LIMIT_PER_DAY ?? 5)`.

`seed.ts` — the stub user is gone. Replace the body with a no-op that documents why, keeping the `prisma db seed` entry point valid:
```ts
// FR-18 (ADR-0022/0023): there is no default user any more — users come from
// Ducker ID sign-in, guests are created on demand. Kept as a valid entry point
// for `prisma db seed`; dev sample data lives in `pnpm seed:mock --user`.
async function main(): Promise<void> {}
void main();
```

In the two `*.service.spec.ts` files replace `import { STUB_USER_ID } from ".../current-user.service"` with `const STUB_USER_ID = "00000000-0000-0000-0000-000000000001";` (they mock `CurrentUserService`; the value is arbitrary).

Delete `server/test/current-user.e2e-spec.ts` (it asserted the stub seed; the behaviour is now covered by the unit test above and Task 4's guard matrix).

- [ ] **Step 4: Run** `pnpm test -- current-user` → PASS; `pnpm type-check` will still fail on `scripts/seed-mock.ts` and `test/*.e2e-spec.ts` — those are fixed in Tasks 4 and 8. Do **not** commit a red type-check: fix `scripts/seed-mock.ts` minimally now by inlining the old id constant with a `// replaced in Task 8` comment, and leave e2e specs for Task 4 (they are not part of `tsc` of `src` — confirm with `pnpm type-check`; if they are, inline the constant there too).

- [ ] **Step 5: Gate + commit**

`pnpm format && pnpm lint && pnpm type-check && pnpm test && pnpm build`
```bash
git add server
git commit -m "feat(auth): read the current user from a request context"
```

---

### Task 3: Sessions, guests, middleware, guard, decorators

**Files:**
- Create: `server/src/modules/auth/auth.module.ts`
- Create: `server/src/modules/auth/session.service.ts` (+ `.spec.ts`)
- Create: `server/src/modules/auth/guest.service.ts` (+ `.spec.ts`)
- Create: `server/src/modules/auth/session.middleware.ts`
- Create: `server/src/modules/auth/auth.guard.ts` (+ `.spec.ts`)
- Create: `server/src/modules/auth/decorators.ts`
- Create: `server/src/common/http/cookies.ts` (+ `.spec.ts`)
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `requestContext`, `RequestContextStore` (Task 2); Prisma models (Task 1).
- Produces:
  - `SESSION_COOKIE = "mcv_session"`
  - `readCookie(header: string | undefined, name: string): string | null`
  - `SessionService.create(userId: string, expiresAt: Date): Promise<string>` (returns raw token) · `resolve(token: string): Promise<{ userId: string; isGuest: boolean } | null>` · `revoke(token: string): Promise<void>` · `setCookie(res: Response, token: string, expiresAt: Date): void` · `clearCookie(res: Response): void` · `static hash(token: string): string`
  - `GuestService.create(): Promise<{ userId: string; token: string; expiresAt: Date }>` · `purgeExpired(): Promise<number>` · `claim(guestUserId: string, userId: string): Promise<boolean>`
  - `Public()`, `AllowGuest(opts?: { createGuest?: boolean })`, `ACCESS_KEY`, `type Access = "public" | "guest" | "guest-create"`
  - `AuthModule` exports `SessionService`, `GuestService`.

- [ ] **Step 1: Failing tests**

`cookies.spec.ts`:
```ts
import { readCookie } from "./cookies";

describe("readCookie", () => {
  it("finds a cookie among others", () => {
    expect(readCookie("a=1; mcv_session=abc; sid=x", "mcv_session")).toBe("abc");
  });
  it("does not match a name that is only a suffix", () => {
    expect(readCookie("xmcv_session=abc", "mcv_session")).toBeNull();
  });
  it("decodes percent-encoding", () => {
    expect(readCookie("n=a%3Db", "n")).toBe("a=b");
  });
  it("returns null without a header", () => {
    expect(readCookie(undefined, "n")).toBeNull();
  });
});
```

`session.service.spec.ts` — mock Prisma with `jest.fn()`s:
```ts
import { SessionService } from "./session.service";

const prisma = {
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  }
};
const service = new SessionService(prisma as never, { get: () => undefined } as never);

describe("SessionService", () => {
  beforeEach(() => jest.resetAllMocks());

  it("stores only the hash of the token", async () => {
    const token = await service.create("u-1", new Date(Date.now() + 1000));
    const stored = prisma.session.create.mock.calls[0][0].data.id as string;
    expect(stored).toBe(SessionService.hash(token));
    expect(stored).not.toContain(token);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it("resolves a live session to its user", async () => {
    prisma.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "u-1", isGuest: false }
    });
    await expect(service.resolve("tok")).resolves.toEqual({ userId: "u-1", isGuest: false });
  });

  it("drops an expired session and resolves to null", async () => {
    prisma.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1),
      user: { id: "u-1", isGuest: false }
    });
    await expect(service.resolve("tok")).resolves.toBeNull();
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { id: SessionService.hash("tok") }
    });
  });

  it("resolves an unknown token to null", async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    await expect(service.resolve("tok")).resolves.toBeNull();
  });
});
```

`guest.service.spec.ts` — mock Prisma including `$transaction(fn) => fn(tx)`:
```ts
import { GuestService } from "./guest.service";

const tx = {
  user: { findUnique: jest.fn(), delete: jest.fn() },
  document: { updateMany: jest.fn() },
  matchRun: { updateMany: jest.fn() },
  matchResult: { updateMany: jest.fn() }
};
const prisma = {
  user: { create: jest.fn(), deleteMany: jest.fn() },
  $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx))
};
const sessions = { create: jest.fn().mockResolvedValue("raw-token") };
const config = { get: (k: string) => (k === "GUEST_TTL_HOURS" ? 24 : undefined) };
const service = new GuestService(prisma as never, sessions as never, config as never);

describe("GuestService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("purges expired guests before creating one, then opens a session of the same lifetime", async () => {
    prisma.user.deleteMany.mockResolvedValue({ count: 2 });
    prisma.user.create.mockResolvedValue({ id: "g-1" });
    const guest = await service.create();
    expect(prisma.user.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.user.create.mock.invocationCallOrder[0]
    );
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.isGuest).toBe(true);
    expect(sessions.create).toHaveBeenCalledWith("g-1", data.guestExpiresAt);
    expect(guest).toEqual({ userId: "g-1", token: "raw-token", expiresAt: data.guestExpiresAt });
  });

  it("moves documents, runs and results, marks documents saved, deletes the guest", async () => {
    tx.user.findUnique.mockResolvedValue({ id: "g-1", isGuest: true, guestExpiresAt: new Date(Date.now() + 60_000) });
    await expect(service.claim("g-1", "u-1")).resolves.toBe(true);
    expect(tx.document.updateMany).toHaveBeenCalledWith({ where: { userId: "g-1" }, data: { userId: "u-1", isSaved: true } });
    expect(tx.matchRun.updateMany).toHaveBeenCalledWith({ where: { userId: "g-1" }, data: { userId: "u-1" } });
    expect(tx.matchResult.updateMany).toHaveBeenCalledWith({ where: { userId: "g-1" }, data: { userId: "u-1" } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "g-1" } });
  });

  it("skips an expired guest without failing", async () => {
    tx.user.findUnique.mockResolvedValue({ id: "g-1", isGuest: true, guestExpiresAt: new Date(Date.now() - 1) });
    await expect(service.claim("g-1", "u-1")).resolves.toBe(false);
    expect(tx.document.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to claim a non-guest", async () => {
    tx.user.findUnique.mockResolvedValue({ id: "u-2", isGuest: false, guestExpiresAt: null });
    await expect(service.claim("u-2", "u-1")).resolves.toBe(false);
  });
});
```

`auth.guard.spec.ts` — build an `ExecutionContext` stub; cover every row of design §5.2 at the guard level:
```ts
import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { requestContext, type RequestContextStore } from "../../common/request-context/request-context";
import { AuthGuard } from "./auth.guard";
import type { Access } from "./decorators";

const guests = { create: jest.fn().mockResolvedValue({ userId: "g-new", token: "t", expiresAt: new Date() }) };
const sessions = { setCookie: jest.fn() };

function run(access: Access | undefined, store: RequestContextStore) {
  const reflector = { getAllAndOverride: () => access } as unknown as Reflector;
  const guard = new AuthGuard(reflector, guests as never, sessions as never);
  const ctx = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getResponse: () => ({}) })
  } as never;
  return requestContext.run(store, () => guard.canActivate(ctx));
}

const anon: RequestContextStore = { userId: null, isGuest: false, sessionToken: null };
const guest: RequestContextStore = { userId: "g", isGuest: true, sessionToken: "t" };
const user: RequestContextStore = { userId: "u", isGuest: false, sessionToken: "t" };

describe("AuthGuard", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ["public", anon, true], ["public", guest, true], ["public", user, true],
    [undefined, user, true], ["guest", user, true], ["guest-create", user, true],
    ["guest", guest, true], ["guest-create", guest, true]
  ] as const)("access=%s lets %o through", async (access, store, ok) => {
    await expect(run(access, { ...store })).resolves.toBe(ok);
  });

  it.each([
    [undefined, anon], [undefined, guest], ["guest", anon]
  ] as const)("access=%s rejects %o with 401", async (access, store) => {
    await expect(run(access, { ...store })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("guest-create turns an anonymous request into a guest and sets the cookie", async () => {
    const store = { ...anon };
    await expect(run("guest-create", store)).resolves.toBe(true);
    expect(store).toEqual({ userId: "g-new", isGuest: true, sessionToken: "t" });
    expect(sessions.setCookie).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** `pnpm test -- auth cookies` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`common/http/cookies.ts`:
```ts
/** Minimal Cookie-header reader — cookie-parser would be a dependency for one function. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}
```

`modules/auth/decorators.ts`:
```ts
import { SetMetadata } from "@nestjs/common";

export const ACCESS_KEY = "access";
/** Default (no decorator) = a signed-in user only. */
export type Access = "public" | "guest" | "guest-create";

export const Public = () => SetMetadata(ACCESS_KEY, "public" satisfies Access);
/** Opens an endpoint to guests. `createGuest` also lets an anonymous caller in by creating one. */
export const AllowGuest = (opts?: { createGuest?: boolean }) =>
  SetMetadata(ACCESS_KEY, (opts?.createGuest ? "guest-create" : "guest") satisfies Access);
```

`session.service.ts`:
```ts
import { createHash, randomBytes } from "crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";

export const SESSION_COOKIE = "mcv_session";
const TOKEN_BYTES = 32;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  static hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async create(userId: string, expiresAt: Date): Promise<string> {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    await this.prisma.session.create({
      data: { id: SessionService.hash(token), userId, expiresAt }
    });
    return token;
  }

  async resolve(token: string): Promise<{ userId: string; isGuest: boolean } | null> {
    const id = SessionService.hash(token);
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { user: { select: { id: true, isGuest: true } } }
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.deleteMany({ where: { id } });
      return null;
    }
    return { userId: session.user.id, isGuest: session.user.isGuest };
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: SessionService.hash(token) } });
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get<string>("NODE_ENV") === "production",
      path: "/",
      expires: expiresAt
    });
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }
}
```

`guest.service.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SessionService } from "./session.service";

const HOUR_MS = 3_600_000;

@Injectable()
export class GuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService
  ) {}

  /** Lazy cleanup (ADR-0023): guest data only grows here and at sign-in, so it is purged at those two points. */
  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.user.deleteMany({
      where: { isGuest: true, guestExpiresAt: { lt: new Date() } }
    });
    return count;
  }

  async create(): Promise<{ userId: string; token: string; expiresAt: Date }> {
    await this.purgeExpired();
    const hours = this.config.get<number>("GUEST_TTL_HOURS") ?? 24;
    const expiresAt = new Date(Date.now() + hours * HOUR_MS);
    const user = await this.prisma.user.create({
      data: { role: Role.candidate, isGuest: true, guestExpiresAt: expiresAt }
    });
    const token = await this.sessions.create(user.id, expiresAt);
    return { userId: user.id, token, expiresAt };
  }

  /** Re-owns everything a live guest made, then deletes the guest. Returns whether anything was claimed. */
  async claim(guestUserId: string, userId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const guest = await tx.user.findUnique({ where: { id: guestUserId } });
      if (!guest?.isGuest || !guest.guestExpiresAt || guest.guestExpiresAt.getTime() <= Date.now()) {
        return false;
      }
      await tx.document.updateMany({ where: { userId: guestUserId }, data: { userId, isSaved: true } });
      await tx.matchRun.updateMany({ where: { userId: guestUserId }, data: { userId } });
      await tx.matchResult.updateMany({ where: { userId: guestUserId }, data: { userId } });
      await tx.user.delete({ where: { id: guestUserId } });
      return true;
    });
  }
}
```

`session.middleware.ts`:
```ts
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { readCookie } from "../../common/http/cookies";
import { requestContext, type RequestContextStore } from "../../common/request-context/request-context";
import { SESSION_COOKIE, SessionService } from "./session.service";

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessions: SessionService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const store: RequestContextStore = { userId: null, isGuest: false, sessionToken: null };
    if (token) {
      const resolved = await this.sessions.resolve(token);
      if (resolved) {
        Object.assign(store, { ...resolved, sessionToken: token });
      } else {
        this.sessions.clearCookie(res);
      }
    }
    requestContext.run(store, () => next());
  }
}
```

`auth.guard.ts`:
```ts
import { type CanActivate, type ExecutionContext, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
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
    const access = this.reflector.getAllAndOverride<Access | undefined>(ACCESS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (access === "public") return true;

    const store = requestContext.getStore();
    if (!store) throw new InternalServerErrorException("SessionMiddleware did not run");

    if (store.userId && !store.isGuest) return true;
    if (store.userId && store.isGuest && (access === "guest" || access === "guest-create")) return true;

    if (!store.userId && access === "guest-create") {
      const guest = await this.guests.create();
      this.sessions.setCookie(ctx.switchToHttp().getResponse<Response>(), guest.token, guest.expiresAt);
      Object.assign(store, { userId: guest.userId, isGuest: true, sessionToken: guest.token });
      return true;
    }

    throw new UnauthorizedException({
      code: "SIGN_IN_REQUIRED",
      message: I18nContext.current()?.t("auth.errors.signInRequired" as never) ?? "Sign in required."
    });
  }
}
```

`auth.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth.guard";
import { GuestService } from "./guest.service";
import { SessionService } from "./session.service";
import { SessionMiddleware } from "./session.middleware";

@Module({
  providers: [SessionService, GuestService, SessionMiddleware, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [SessionService, GuestService, SessionMiddleware]
})
export class AuthModule {}
```

`app.module.ts`: import `AuthModule`; make `AppModule implements NestModule` with
```ts
configure(consumer: MiddlewareConsumer): void {
  consumer.apply(SessionMiddleware).forRoutes("*");
}
```
Keep `ThrottlerGuard` as the first `APP_GUARD` (it stays in `AppModule.providers`; `AuthModule`'s guard is registered after it because `AuthModule` is imported).

- [ ] **Step 4: Run** `pnpm test -- auth cookies` → PASS.

- [ ] **Step 5: Gate + commit** (unit gate only; e2e is red until Task 4 decorates controllers — that is expected and Task 4 lands before any push)

```bash
git add server
git commit -m "feat(auth): deny by default with own sessions and lazily created guests"
```

---

### Task 4: Open endpoints per the access matrix; e2e auth helper; migrate e2e specs

**Files:**
- Modify: `server/src/modules/health/*.controller.ts` (`@Public()` on the class)
- Modify: `server/src/modules/documents/documents.controller.ts`
- Modify: `server/src/modules/matching/matching.controller.ts`
- Create: `server/test/helpers/auth.ts`
- Create: `server/test/helpers/app.ts`
- Modify: every `server/test/*.e2e-spec.ts` that issues requests
- Create: `server/test/access-matrix.e2e-spec.ts`

**Interfaces:**
- Consumes: `Public`, `AllowGuest`, `SessionService`, `SESSION_COOKIE` (Task 3).
- Produces (test helpers):
  - `createSignedInUser(prisma: PrismaService, opts?: { email?: string }): Promise<{ userId: string; cookie: string }>`
  - `createGuestUser(prisma: PrismaService): Promise<{ userId: string; cookie: string }>`
  - `deleteUsers(prisma: PrismaService, ids: string[]): Promise<void>`
  - `createTestApp(): Promise<{ app: INestApplication<App>; prisma: PrismaService }>` (mirrors `main.ts`: global prefix + ValidationPipe)

- [ ] **Step 1: Decorate**

- `DocumentsController.create` → `@AllowGuest({ createGuest: true })`; `findOne` and `file` → `@AllowGuest()`. Everything else in the controller stays default (user only).
- `MatchingController.create`, `createRun`, `findRun`, `findOne` → `@AllowGuest()`. `list` stays default.
- Health controller → `@Public()` on the class.

- [ ] **Step 2: Helpers** `test/helpers/auth.ts`:

```ts
import { createHash, randomBytes } from "crypto";
import { Role } from "@prisma/client";
import { PrismaService } from "../../src/prisma/prisma.service";

const DAY_MS = 86_400_000;

async function sessionFor(prisma: PrismaService, userId: string, expiresAt: Date): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: { id: createHash("sha256").update(token).digest("hex"), userId, expiresAt }
  });
  return `mcv_session=${token}`;
}

export async function createSignedInUser(prisma: PrismaService, opts: { email?: string } = {}) {
  const user = await prisma.user.create({
    data: {
      role: Role.candidate,
      externalSub: randomBytes(12).toString("hex"),
      email: opts.email ?? `e2e-${randomBytes(4).toString("hex")}@test.local`
    }
  });
  return { userId: user.id, cookie: await sessionFor(prisma, user.id, new Date(Date.now() + DAY_MS)) };
}

export async function createGuestUser(prisma: PrismaService) {
  const expiresAt = new Date(Date.now() + DAY_MS);
  const user = await prisma.user.create({
    data: { role: Role.candidate, isGuest: true, guestExpiresAt: expiresAt }
  });
  return { userId: user.id, cookie: await sessionFor(prisma, user.id, expiresAt) };
}

export async function deleteUsers(prisma: PrismaService, ids: string[]): Promise<void> {
  if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
```

`test/helpers/app.ts`:
```ts
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { App } from "supertest/types";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/prisma/prisma.service";

export async function createTestApp(): Promise<{ app: INestApplication<App>; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return { app, prisma: moduleRef.get(PrismaService) };
}
```

- [ ] **Step 3: Migrate existing e2e specs.** In each spec that calls the API: create a user in `beforeAll` with `createSignedInUser`, add `.set("Cookie", cookie)` to **every** `request(app.getHttpServer())` chain, replace `STUB_USER_ID` with that `userId`, and in `afterAll` call `deleteUsers(prisma, [userId])` (cascade removes its rows — remove now-redundant per-row cleanup only where it targeted this user). Suggested mechanical pattern per file: define `const api = () => request(app.getHttpServer());` and `const authed = (r: request.Test) => r.set("Cookie", cookie);`.

- [ ] **Step 4: Failing test — the access matrix** `test/access-matrix.e2e-spec.ts`. One `it` per cell of design §5.2. Use an unknown UUID where an id is needed — the assertion is about the guard, so `404` counts as "let through", `401` as "blocked":

```ts
import request from "supertest";
import { createGuestUser, createSignedInUser, deleteUsers } from "./helpers/auth";
import { createTestApp } from "./helpers/app";

const UNKNOWN = "11111111-2222-4333-8444-555555555555";

describe("Access matrix (e2e) — design §5.2", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let guestCookie: string;
  let userCookie: string;
  const users: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    const g = await createGuestUser(ctx.prisma);
    const u = await createSignedInUser(ctx.prisma);
    guestCookie = g.cookie;
    userCookie = u.cookie;
    users.push(g.userId, u.userId);
  });

  afterAll(async () => {
    await deleteUsers(ctx.prisma, users);
    await ctx.app.close();
  });

  const call = (method: "get" | "post" | "patch" | "delete", path: string, cookie?: string) => {
    const r = request(ctx.app.getHttpServer())[method](`/api/v1${path}`);
    return cookie ? r.set("Cookie", cookie) : r;
  };

  it("health is public", async () => {
    await call("get", "/health").expect(200);
  });

  it.each([
    ["get", `/documents/${UNKNOWN}`],
    ["get", `/documents/${UNKNOWN}/file`],
    ["get", `/match/runs/${UNKNOWN}`],
    ["get", `/match/${UNKNOWN}`]
  ] as const)("%s %s: anonymous 401, guest and user pass the guard", async (m, p) => {
    await call(m, p).expect(401);
    expect((await call(m, p, guestCookie)).status).not.toBe(401);
    expect((await call(m, p, userCookie)).status).not.toBe(401);
  });

  it.each([
    ["get", "/documents"],
    ["get", "/match"],
    ["get", "/ai-credentials"],
    ["get", "/cover-letters"],
    ["get", "/me/export"],
    ["patch", `/documents/${UNKNOWN}`],
    ["delete", `/documents/${UNKNOWN}`],
    ["get", `/comparisons/${UNKNOWN}`]
  ] as const)("%s %s: user only", async (m, p) => {
    await call(m, p).expect(401);
    await call(m, p, guestCookie).expect(401);
    expect((await call(m, p, userCookie)).status).not.toBe(401);
  });

  it("POST /documents by an anonymous caller creates a guest and sets mcv_session", async () => {
    const res = await call("post", "/documents")
      .send({ kind: "JD", sourceText: "Senior Frontend Engineer — React, TypeScript", save: false })
      .expect(201);
    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toMatch(/mcv_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    const owner = await ctx.prisma.document.findUnique({ where: { id: res.body.id }, include: { user: true } });
    expect(owner?.user.isGuest).toBe(true);
    users.push(owner!.userId);
  });

  it("a 401 body carries code SIGN_IN_REQUIRED", async () => {
    const res = await call("get", "/documents").expect(401);
    expect(res.body.code).toBe("SIGN_IN_REQUIRED");
  });
});
```
(Check the exact `CreateDocumentDto` field names before running — adjust `sourceText`/`save` if they differ.)

- [ ] **Step 5: Run** `pnpm test:e2e` → all suites PASS (the access matrix plus every migrated suite).

- [ ] **Step 6: Gate + commit**
```bash
git add server
git commit -m "feat(auth): open the wizard endpoints to guests and sign every e2e request in"
```

---

### Task 5: OIDC client — discovery, PKCE, sealed state cookie, id_token verification

**Files:**
- Create: `server/src/modules/auth/oidc/id-token.ts` (+ `.spec.ts`)
- Create: `server/src/modules/auth/oidc/pkce.ts`
- Create: `server/src/modules/auth/oidc/sealed-cookie.ts` (+ `.spec.ts`)
- Create: `server/src/modules/auth/oidc/oidc-client.service.ts` (+ `.spec.ts`)
- Create: `server/src/modules/auth/return-to.ts` (+ `.spec.ts`)
- Modify: `server/src/modules/auth/auth.module.ts` (provide + export `OidcClientService`)

**Interfaces:**
- Produces:
  - `interface IdTokenClaims { sub: string; iss: string; aud: string | string[]; exp: number; iat: number; nonce?: string; email?: string; email_verified?: boolean; name?: string; picture?: string | null }`
  - `class IdTokenError extends Error { reason: "malformed" | "alg" | "signature" | "iss" | "aud" | "exp" | "nonce" | "kid" }`
  - `decodeJwt(token: string): { header: { alg: string; kid?: string }; payload: IdTokenClaims; signingInput: string; signature: Buffer }`
  - `verifyRs256(token: string, jwk: JsonWebKey): boolean`
  - `validateClaims(claims: IdTokenClaims, expected: { issuer: string; clientId: string; nonce: string; nowSec: number }): void`
  - `createPkce(): { verifier: string; challenge: string }` · `randomToken(): string`
  - `seal(payload: object, secret: string): string` · `unseal<T>(value: string, secret: string): T | null`
  - `safeReturnTo(raw: unknown): string`
  - `OidcClientService.isConfigured(): boolean` · `authorizeUrl(p: { state: string; nonce: string; codeChallenge: string }): Promise<string>` · `exchangeCode(code: string, verifier: string): Promise<string /* id_token */>` · `verifyIdToken(idToken: string, nonce: string): Promise<IdTokenClaims>`

- [ ] **Step 1: Failing tests**

`return-to.spec.ts`:
```ts
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it.each([
    ["/wizard?runId=abc", "/wizard?runId=abc"],
    ["/", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["", "/"],
    [undefined, "/"],
    [42, "/"]
  ])("%p → %p", (raw, expected) => expect(safeReturnTo(raw)).toBe(expected));
});
```

`sealed-cookie.spec.ts`:
```ts
import { seal, unseal } from "./sealed-cookie";

const SECRET = "x".repeat(32);

describe("sealed cookie", () => {
  it("round-trips", () => {
    expect(unseal(seal({ a: 1 }, SECRET), SECRET)).toEqual({ a: 1 });
  });
  it("rejects tampering", () => {
    const v = seal({ a: 1 }, SECRET);
    const flipped = v.slice(0, -2) + (v.endsWith("A") ? "BB" : "AA");
    expect(unseal(flipped, SECRET)).toBeNull();
  });
  it("rejects another secret", () => {
    expect(unseal(seal({ a: 1 }, SECRET), "y".repeat(32))).toBeNull();
  });
  it("rejects garbage", () => {
    expect(unseal("not-a-cookie", SECRET)).toBeNull();
  });
});
```

`id-token.spec.ts` — sign tokens with a locally generated key:
```ts
import { generateKeyPairSync, createSign } from "crypto";
import { decodeJwt, IdTokenError, validateClaims, verifyRs256 } from "./id-token";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1" };
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(payload: object, header: object = { alg: "RS256", kid: "k1" }, key = privateKey) {
  const input = `${b64(header)}.${b64(payload)}`;
  const sig = createSign("RSA-SHA256").update(input).sign(key).toString("base64url");
  return `${input}.${sig}`;
}

const now = 1_800_000_000;
const good = { sub: "65f0c0ffee", iss: "http://localhost:3000", aud: "client_abc", exp: now + 900, iat: now, nonce: "n1" };
const expected = { issuer: "http://localhost:3000", clientId: "client_abc", nonce: "n1", nowSec: now };

describe("id_token", () => {
  it("verifies a token signed by the JWK", () => {
    expect(verifyRs256(sign(good), jwk)).toBe(true);
  });
  it("rejects a token signed by another key", () => {
    expect(verifyRs256(sign(good, undefined, other.privateKey), jwk)).toBe(false);
  });
  it("accepts valid claims", () => {
    expect(() => validateClaims(decodeJwt(sign(good)).payload, expected)).not.toThrow();
  });
  it.each([
    ["iss", { iss: "http://evil" }],
    ["aud", { aud: "someone-else" }],
    ["exp", { exp: now - 120 }],
    ["nonce", { nonce: "n2" }]
  ])("rejects a wrong %s", (reason, patch) => {
    const claims = decodeJwt(sign({ ...good, ...patch })).payload;
    try {
      validateClaims(claims, expected);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(IdTokenError);
      expect((e as IdTokenError).reason).toBe(reason);
    }
  });
  it("accepts aud as an array containing the client", () => {
    expect(() => validateClaims({ ...good, aud: ["x", "client_abc"] }, expected)).not.toThrow();
  });
  it("rejects a non-RS256 header as malformed/alg", () => {
    expect(() => decodeJwt(sign(good, { alg: "none" }))).toThrow(IdTokenError);
  });
  it("rejects a malformed token", () => {
    expect(() => decodeJwt("a.b")).toThrow(IdTokenError);
  });
});
```

`oidc-client.service.spec.ts` — mock `global.fetch`; cover: discovery issuer mismatch throws; `authorizeUrl` contains `response_type=code`, `scope=openid+profile+email`, `code_challenge_method=S256`, the redirect uri; `exchangeCode` sends `Authorization: Basic base64(encodeURIComponent(id):encodeURIComponent(secret))` and form body with `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier`; `verifyIdToken` re-fetches JWKS **once** when the `kid` is unknown and then fails with reason `kid` if still unknown. (Write each as its own `it` using the key-pair helper from `id-token.spec.ts`, copied into this file.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`return-to.ts`:
```ts
/** Only same-origin relative paths survive (NFR-SEC-13) — anything else would be an open redirect. */
export function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw;
}
```

`pkce.ts`:
```ts
import { createHash, randomBytes } from "crypto";

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomToken();
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}
```

`sealed-cookie.ts` (AES-256-GCM, key = sha256(secret)):
```ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;
const keyOf = (secret: string) => createHash("sha256").update(secret).digest();

export function seal(payload: object, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(value: string, secret: string): T | null {
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyOf(secret), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const text = Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
```

`id-token.ts`:
```ts
import { createPublicKey, createVerify } from "crypto";

export interface IdTokenClaims {
  sub: string; iss: string; aud: string | string[]; exp: number; iat: number;
  nonce?: string; email?: string; email_verified?: boolean; name?: string; picture?: string | null;
}

export type IdTokenFailure = "malformed" | "alg" | "signature" | "iss" | "aud" | "exp" | "nonce" | "kid";

export class IdTokenError extends Error {
  constructor(readonly reason: IdTokenFailure) {
    super(`id_token rejected: ${reason}`);
  }
}

const CLOCK_SKEW_SEC = 60;

function parsePart<T>(part: string): T {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
  } catch {
    throw new IdTokenError("malformed");
  }
}

export function decodeJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new IdTokenError("malformed");
  const header = parsePart<{ alg: string; kid?: string }>(parts[0]);
  if (header.alg !== "RS256") throw new IdTokenError("alg");
  const payload = parsePart<IdTokenClaims>(parts[1]);
  if (typeof payload.sub !== "string" || !payload.sub) throw new IdTokenError("malformed");
  return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature: Buffer.from(parts[2], "base64url") };
}

export function verifyRs256(token: string, jwk: JsonWebKey): boolean {
  const { signingInput, signature } = decodeJwt(token);
  const key = createPublicKey({ key: jwk, format: "jwk" });
  return createVerify("RSA-SHA256").update(signingInput).verify(key, signature);
}

export function validateClaims(
  claims: IdTokenClaims,
  expected: { issuer: string; clientId: string; nonce: string; nowSec: number }
): void {
  if (claims.iss !== expected.issuer) throw new IdTokenError("iss");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(expected.clientId)) throw new IdTokenError("aud");
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SEC < expected.nowSec) throw new IdTokenError("exp");
  if (claims.nonce !== expected.nonce) throw new IdTokenError("nonce");
}
```

`oidc-client.service.ts`:
```ts
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decodeJwt, type IdTokenClaims, IdTokenError, validateClaims, verifyRs256 } from "./id-token";

interface Discovery { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }
type Jwk = JsonWebKey & { kid?: string };

const HTTP_TIMEOUT_MS = 5000;

/** Hand-rolled on purpose (ADR-0022): openid-client/jose are pure ESM and break the CommonJS Jest run. */
@Injectable()
export class OidcClientService {
  private discovery: Discovery | null = null;
  private jwks = new Map<string, Jwk>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI", "SESSION_SECRET"]
      .every((k) => Boolean(this.config.get<string>(k)));
  }

  private setting(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) throw new ServiceUnavailableException({ code: "AUTH_NOT_CONFIGURED" });
    return value;
  }

  private async getDiscovery(): Promise<Discovery> {
    if (this.discovery) return this.discovery;
    const issuer = this.setting("OIDC_ISSUER").replace(/\/$/, "");
    const res = await fetch(`${issuer}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`discovery ${res.status}`);
    const doc = (await res.json()) as Discovery;
    if (doc.issuer !== issuer) throw new Error("discovery issuer mismatch");
    this.discovery = doc;
    return doc;
  }

  async authorizeUrl(p: { state: string; nonce: string; codeChallenge: string }): Promise<string> {
    const d = await this.getDiscovery();
    const url = new URL(d.authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: this.setting("OIDC_CLIENT_ID"),
      redirect_uri: this.setting("OIDC_REDIRECT_URI"),
      scope: "openid profile email",
      state: p.state,
      nonce: p.nonce,
      code_challenge: p.codeChallenge,
      code_challenge_method: "S256"
    }).toString();
    return url.toString();
  }

  async exchangeCode(code: string, verifier: string): Promise<string> {
    const d = await this.getDiscovery();
    const id = encodeURIComponent(this.setting("OIDC_CLIENT_ID"));
    const secret = encodeURIComponent(this.setting("OIDC_CLIENT_SECRET"));
    const res = await fetch(d.token_endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.setting("OIDC_REDIRECT_URI"),
        code_verifier: verifier
      }).toString(),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
    });
    // Ducker ID's rate limiter answers in its own error shape, not OAuth's — treat every non-2xx alike.
    if (!res.ok) throw new Error(`token endpoint ${res.status}`);
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw new Error("token response without id_token");
    return body.id_token;
  }

  private async loadJwks(): Promise<void> {
    const d = await this.getDiscovery();
    const res = await fetch(d.jwks_uri, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`jwks ${res.status}`);
    const { keys } = (await res.json()) as { keys: Jwk[] };
    this.jwks = new Map(keys.filter((k) => k.kid).map((k) => [k.kid as string, k]));
  }

  async verifyIdToken(idToken: string, nonce: string): Promise<IdTokenClaims> {
    const { header, payload } = decodeJwt(idToken);
    if (!header.kid) throw new IdTokenError("kid");
    // Ducker ID's dev keypair is regenerated on every restart — an unknown kid earns exactly one refetch.
    if (!this.jwks.has(header.kid)) await this.loadJwks();
    const jwk = this.jwks.get(header.kid);
    if (!jwk) throw new IdTokenError("kid");
    if (!verifyRs256(idToken, jwk)) throw new IdTokenError("signature");
    validateClaims(payload, {
      issuer: this.setting("OIDC_ISSUER").replace(/\/$/, ""),
      clientId: this.setting("OIDC_CLIENT_ID"),
      nonce,
      nowSec: Math.floor(Date.now() / 1000)
    });
    return payload;
  }
}
```

- [ ] **Step 4: Run** `pnpm test -- oidc return-to sealed id-token` → PASS.
- [ ] **Step 5: Gate + commit** `git commit -m "feat(auth): verify Ducker ID id_tokens with node:crypto"`

---

### Task 6: Guest quota

**Files:**
- Create: `server/src/modules/auth/guest-usage.service.ts` (+ `.spec.ts`)
- Modify: `server/src/modules/auth/auth.module.ts` (provide + export)
- Modify: `server/src/modules/matching/matching.module.ts` (import `AuthModule`)
- Modify: `server/src/modules/matching/matching.controller.ts` (`@Ip()` into `create`)
- Modify: `server/src/modules/matching/matching.service.ts` (`createMatch(dto, ctx: { ip: string })`)
- Modify: `server/src/modules/matching/matching.service.spec.ts`
- Test: `server/test/guest-quota.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `GuestUsageService.consume(ip: string): Promise<GuestQuota & { allowed: boolean }>`
  - `GuestUsageService.peek(ip: string): Promise<GuestQuota>`
  - `interface GuestQuota { limit: number; used: number; resetsAt: Date }`
  - `nextUtcMidnight(now: Date): Date`, `utcDay(now: Date): string` (exported pure helpers)

- [ ] **Step 1: Failing unit tests** `guest-usage.service.spec.ts`: `utcDay(new Date("2026-10-04T23:59:59Z")) === "2026-10-04"`; `nextUtcMidnight(new Date("2026-10-04T23:59:59Z")).toISOString() === "2026-10-05T00:00:00.000Z"`; `consume` returns `allowed: true, used: 3` when `$queryRaw` resolves `[{ count: 3 }]`, `allowed: false, used: limit` when it resolves `[]`; the IP passed to Prisma is **not** the raw IP (assert the bound value is a 64-hex string ≠ input); `consume` throws `ServiceUnavailableException` when `SESSION_SECRET` is missing.

In `matching.service.spec.ts` add: guest + `credentialId` → `ForbiddenException` with `code: "GUEST_FORBIDDEN_CREDENTIAL"` and AI never called; guest over quota → `HttpException` status 429 with `code: "GUEST_QUOTA_EXCEEDED"` and `resetsAt`, AI never called; user → `consume` never called.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```ts
import { createHmac } from "crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

export interface GuestQuota { limit: number; used: number; resetsAt: Date }

export const utcDay = (now: Date): string => now.toISOString().slice(0, 10);
export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** NFR-COST-04 — per-IP daily cap on system-key matches for guests. The IP is stored only as an HMAC. */
@Injectable()
export class GuestUsageService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private limit(): number {
    return this.config.get<number>("GUEST_MATCH_LIMIT_PER_DAY") ?? 5;
  }

  private hash(ip: string): string {
    const secret = this.config.get<string>("SESSION_SECRET");
    if (!secret) throw new ServiceUnavailableException({ code: "AUTH_NOT_CONFIGURED" });
    return createHmac("sha256", secret).update(ip).digest("hex");
  }

  async peek(ip: string): Promise<GuestQuota> {
    const now = new Date();
    const row = await this.prisma.guestUsage.findUnique({
      where: { ipHash_day: { ipHash: this.hash(ip), day: new Date(`${utcDay(now)}T00:00:00Z`) } }
    });
    return { limit: this.limit(), used: row?.count ?? 0, resetsAt: nextUtcMidnight(now) };
  }

  /** Atomic check-and-increment, BEFORE the AI call: the money is spent when we call, not when it succeeds. */
  async consume(ip: string): Promise<GuestQuota & { allowed: boolean }> {
    const now = new Date();
    const limit = this.limit();
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "GuestUsage" ("ipHash", "day", "count")
      VALUES (${this.hash(ip)}, ${utcDay(now)}::date, 1)
      ON CONFLICT ("ipHash", "day") DO UPDATE SET "count" = "GuestUsage"."count" + 1
      WHERE "GuestUsage"."count" < ${limit}
      RETURNING "count"`;
    const resetsAt = nextUtcMidnight(now);
    return rows.length
      ? { allowed: true, used: Number(rows[0].count), limit, resetsAt }
      : { allowed: false, used: limit, limit, resetsAt };
  }
}
```
(When `limit` is 0 the `INSERT` path would still allow one — guard: if `limit <= 0` return `allowed: false` before querying.)

In `MatchingService.createMatch(dto, ctx)` — first lines, before any document lookup or AI call:
```ts
if (this.currentUser.isGuest()) {
  if (dto.credentialId) {
    throw new ForbiddenException({ code: "GUEST_FORBIDDEN_CREDENTIAL", message: tMatch("matching.errors.guestCredential", "Guests can only use the system AI key.") });
  }
  const quota = await this.guestUsage.consume(ctx.ip);
  if (!quota.allowed) {
    throw new HttpException(
      { statusCode: 429, code: "GUEST_QUOTA_EXCEEDED", message: tMatch("matching.errors.guestQuota", "You have used today's free matches."), limit: quota.limit, resetsAt: quota.resetsAt.toISOString() },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}
```
Add the two keys to `src/i18n/{en,vi}/matching.json` (copy the strings from Task 2's `auth.json`). Controller: `async create(@Body() dto: CreateMatchDto, @Ip() ip: string)` → `this.matchingService.createMatch(dto, { ip })`.

- [ ] **Step 4: e2e** `test/guest-quota.e2e-spec.ts`: set `process.env.GUEST_MATCH_LIMIT_PER_DAY = "1"` and `process.env.SESSION_SECRET ??= "e2e-secret-".padEnd(32, "x")` **before** `createTestApp()`; delete the `GuestUsage` rows for today in `beforeAll`; as a guest: create two documents (JD + CV) and a run; first `POST /match` → not 429 (AI may be unconfigured: accept any status except 429/401/403 — the point is the quota did not block); second → 429 with `code: "GUEST_QUOTA_EXCEEDED"`; `POST /match` with a `credentialId` → 403 `GUEST_FORBIDDEN_CREDENTIAL`.

- [ ] **Step 5: Gate (incl. `pnpm test:e2e`) + commit** `git commit -m "feat(guest): cap guest matches per IP per UTC day"`

---

### Task 7: AuthController — login, callback (claim), logout, me

**Files:**
- Create: `server/src/modules/auth/auth.service.ts` (+ `.spec.ts`)
- Create: `server/src/modules/auth/auth.controller.ts`
- Create: `server/src/modules/auth/dto/auth-me.dto.ts`
- Modify: `server/src/modules/auth/auth.module.ts` (controller, `AuthService`, `OidcClientService`, `GuestUsageService`)
- Test: `server/test/auth-flow.e2e-spec.ts`

**Interfaces:**
- Consumes: `OidcClientService`, `createPkce`, `randomToken`, `seal/unseal`, `safeReturnTo` (Task 5); `SessionService`, `GuestService` (Task 3); `GuestUsageService` (Task 6).
- Produces:
  - `OAUTH_COOKIE = "mcv_oauth"`; `interface OAuthState { state: string; nonce: string; verifier: string; returnTo: string; exp: number }`
  - `AuthService.beginLogin(returnTo: string): Promise<{ authorizeUrl: string; cookie: string }>`
  - `AuthService.completeLogin(input: { code?: string; state?: string; error?: string; iss?: string; sealed: string | null; current: { userId: string | null; isGuest: boolean; sessionToken: string | null } }): Promise<{ token: string; expiresAt: Date; redirectTo: string }>` — throws `AuthFlowError(code)` where `code ∈ "denied" | "state" | "iss" | "exchange" | "token"`
  - `AuthService.me(ip: string): Promise<AuthMeDto>`
  - HTTP: `GET /auth/login?returnTo=`, `GET /auth/callback`, `POST /auth/logout` (204), `GET /auth/me` → `AuthMeDto { status: "anonymous" | "guest" | "user"; user: { id; email; fullName; avatar } | null; guestQuota: { limit; used; resetsAt } | null }`

- [ ] **Step 1: Failing unit tests** `auth.service.spec.ts` (mock `OidcClientService`, `PrismaService.user.upsert`, `SessionService`, `GuestService`, `GuestUsageService`, `ConfigService`):
  - `beginLogin` returns an authorize URL from the client and a cookie that `unseal`s to `{ state, nonce, verifier, returnTo }` with `exp` ≈ now+600s.
  - `completeLogin` with `error=access_denied` → `AuthFlowError("denied")`; with `state` ≠ sealed state → `"state"`; with `sealed` null or expired → `"state"`; with `iss` present and ≠ `OIDC_ISSUER` → `"iss"`; exchange throwing → `"exchange"`; verify throwing → `"token"`.
  - happy path: upserts by `externalSub = sub` with `email`, `fullName = name`, `avatar = picture`; calls `guests.purgeExpired()`; when `current.isGuest` calls `guests.claim(current.userId, user.id)` and, if it returned `true`, `redirectTo` has `claimed=1` appended to the sealed `returnTo` (preserving existing query: `/wizard?runId=r1` → `/wizard?runId=r1&claimed=1`); revokes `current.sessionToken` when present; creates a session that expires `SESSION_TTL_DAYS` from now; `redirectTo` starts with `CLIENT_ORIGIN`.
  - `me`: anonymous → `{ status: "anonymous", user: null, guestQuota: <peek> }`; guest → `"guest"` + quota; user → `"user"` + profile, `guestQuota: null`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `auth.service.ts` (sketch to fill exactly):
```ts
const OAUTH_TTL_MS = 10 * 60_000;
export const OAUTH_COOKIE = "mcv_oauth";
export class AuthFlowError extends Error {
  constructor(readonly code: "denied" | "state" | "iss" | "exchange" | "token") { super(code); }
}

beginLogin(returnTo) {
  const { verifier, challenge } = createPkce();
  const state = randomToken(); const nonce = randomToken();
  const authorizeUrl = await this.oidc.authorizeUrl({ state, nonce, codeChallenge: challenge });
  const cookie = seal({ state, nonce, verifier, returnTo, exp: Date.now() + OAUTH_TTL_MS }, this.secret());
  return { authorizeUrl, cookie };
}

completeLogin(input) {
  if (input.error) throw new AuthFlowError("denied");
  const saved = input.sealed ? unseal<OAuthState>(input.sealed, this.secret()) : null;
  if (!saved || saved.exp < Date.now() || !input.state || input.state !== saved.state || !input.code) throw new AuthFlowError("state");
  if (input.iss && input.iss.replace(/\/$/, "") !== issuer) throw new AuthFlowError("iss");
  let idToken: string; try { idToken = await this.oidc.exchangeCode(input.code, saved.verifier); } catch { throw new AuthFlowError("exchange"); }
  let claims: IdTokenClaims; try { claims = await this.oidc.verifyIdToken(idToken, saved.nonce); } catch { throw new AuthFlowError("token"); }
  const profile = { email: claims.email ?? null, fullName: claims.name ?? null, avatar: claims.picture ?? null };
  const user = await this.prisma.user.upsert({
    where: { externalSub: claims.sub },
    create: { role: Role.candidate, externalSub: claims.sub, ...profile },
    update: profile
  });
  await this.guests.purgeExpired();
  const claimed = input.current.isGuest && input.current.userId ? await this.guests.claim(input.current.userId, user.id) : false;
  if (input.current.sessionToken) await this.sessions.revoke(input.current.sessionToken);
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  const token = await this.sessions.create(user.id, expiresAt);
  const target = new URL(saved.returnTo, clientOrigin);
  if (claimed) target.searchParams.set("claimed", "1");
  return { token, expiresAt, redirectTo: target.toString() };
}
```
Note: `purgeExpired` runs **after** claim would be wrong for a guest who expired a second ago — claim already refuses expired guests, so order is: claim first, then purge. Implement it in that order (the spec bullet's "calls purgeExpired" holds either way; the test asserts both are called).

`auth.controller.ts`:
```ts
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly sessions: SessionService, private readonly currentUser: CurrentUserService, private readonly config: ConfigService) {}

  private clientOrigin(): string { return this.config.get<string>("CLIENT_ORIGIN") ?? "http://localhost:5300"; }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("login")
  async login(@Query("returnTo") returnTo: unknown, @Res() res: Response): Promise<void> {
    const target = safeReturnTo(returnTo);
    const ctx = this.currentUser.peek();
    if (ctx?.userId && !ctx.isGuest) return res.redirect(302, new URL(target, this.clientOrigin()).toString());
    const { authorizeUrl, cookie } = await this.auth.beginLogin(target);
    res.cookie(OAUTH_COOKIE, cookie, { httpOnly: true, sameSite: "lax", secure: this.config.get("NODE_ENV") === "production", path: "/api/v1/auth", maxAge: 600_000 });
    res.redirect(302, authorizeUrl);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("callback")
  async callback(@Query() q: Record<string, string | undefined>, @Req() req: Request, @Res() res: Response): Promise<void> {
    const ctx = this.currentUser.peek();
    res.clearCookie(OAUTH_COOKIE, { path: "/api/v1/auth" });
    try {
      const result = await this.auth.completeLogin({
        code: q.code, state: q.state, error: q.error, iss: q.iss,
        sealed: readCookie(req.headers.cookie, OAUTH_COOKIE),
        current: { userId: ctx?.userId ?? null, isGuest: ctx?.isGuest ?? false, sessionToken: ctx?.sessionToken ?? null }
      });
      this.sessions.setCookie(res, result.token, result.expiresAt);
      res.redirect(302, result.redirectTo);
    } catch (e) {
      const code = e instanceof AuthFlowError ? e.code : "server";
      res.redirect(302, `${this.clientOrigin()}/?authError=${code}`);
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
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
```
`login` with OIDC unset → `ServiceUnavailableException` (503) from `OidcClientService.setting` — acceptable for an unconfigured server. Never log `code`, tokens or cookies.

- [ ] **Step 4: e2e** `test/auth-flow.e2e-spec.ts` — override `OidcClientService` with a fake (`moduleRef.overrideProvider(OidcClientService).useValue(fake)`; use a local variant of `createTestApp` that accepts an override), env `SESSION_SECRET`, `CLIENT_ORIGIN=http://localhost:5300`, `OIDC_ISSUER=http://idp.test`:
  - `GET /auth/login?returnTo=/wizard` → 302 to the fake authorize URL and a `mcv_oauth` cookie.
  - guest flow: create a guest with a document via `POST /documents` (anonymous → guest cookie), then `GET /auth/login` with that cookie, read `state` from the fake's captured `authorizeUrl` args, `GET /auth/callback?code=c&state=<state>` with both cookies → 302 to `http://localhost:5300/wizard?claimed=1`, new `mcv_session` set; the document is now owned by the user whose `externalSub` is the fake's `sub` and `isSaved=true`; the guest user row is gone; the old guest token no longer resolves.
  - wrong state → 302 `/?authError=state`, no session cookie.
  - `POST /auth/logout` with a user cookie → 204 and that cookie no longer authenticates `GET /documents` (401).
  - `GET /auth/me`: anonymous → `status: "anonymous"` with `guestQuota.limit`; user → `status: "user"` with `user.email`.

- [ ] **Step 5: Gate (incl. e2e) + commit** `git commit -m "feat(auth): sign in through Ducker ID and carry guest work into the account"`

---

### Task 8: Scripts, env examples, server README

**Files:**
- Modify: `server/scripts/seed-mock.ts`, `server/scripts/mock-documents.ts` (comments)
- Modify: `server/package.json` (only if the script signature changes)
- Modify: `server/.env.example`, `.env.example` (root)
- Modify: `server/README.md`, `CLAUDE.md` (root: "`pnpm exec prisma db seed` — seed the stub user" → no default user)

- [ ] **Step 1:** `seed-mock.ts` takes `--user <email>`: looks up `User` by `email` (must exist and not be a guest — exit 1 with a clear message otherwise: "Sign in once through Ducker ID with that email first"), attaches the mock documents to it. `seed:mock:clean` keeps deleting by the fixed mock-document ids (unchanged). Remove every `STUB_USER_ID` reference; rewrite the comments in `mock-documents.ts` that explained sharing the stub owner.
- [ ] **Step 2:** Add to `server/.env.example` (and mirror the section in the root `.env.example`):
```
# --- Sign-in through Ducker ID (ADR-0022) — optional at boot; /auth/* answers 503 without them ---
# Register the app in Ducker ID admin (/admin/apps), redirect URI must match EXACTLY.
# OIDC_ISSUER=http://localhost:3000
# OIDC_CLIENT_ID=
# OIDC_CLIENT_SECRET=
# OIDC_REDIRECT_URI=http://localhost:5200/api/v1/auth/callback
# At least 32 random chars: openssl rand -base64 48
# SESSION_SECRET=
# SESSION_TTL_DAYS=7
# --- Guest mode (ADR-0023) ---
# GUEST_TTL_HOURS=24
# GUEST_MATCH_LIMIT_PER_DAY=5
```
- [ ] **Step 3:** README (server + root CLAUDE.md command line) — no default user; how to register with Ducker ID; `seed:mock --user`.
- [ ] **Step 4: Gate (incl. e2e) + commit** `git commit -m "chore(auth): document sign-in env and seed mock data for a real user"`

---

### Task 9: Client — credentials, auth requests, `useAuth`, auth error toast

**Files:**
- Modify: `client/src/libs/api.ts`
- Modify: `client/src/constants/endpoints.ts`
- Create: `client/src/types/Auth/index.ts`
- Create: `client/src/requests/auth.ts` (+ `__tests__/auth.test.ts`)
- Create: `client/src/hooks/useAuth.ts` (+ export from `hooks/index.ts`)
- Create: `client/src/components/AuthErrorToast/index.tsx`
- Modify: `client/src/routes/_app.tsx` (render `<AuthErrorToast />`)
- Modify: `client/src/requests/__tests__/*` that assert `fetch` init (now includes `credentials`)

**Interfaces:**
- Produces:
  - `API_BASE_URL` exported from `libs/api.ts`; `ApiError` gains `code?: string` and `body?: unknown`
  - `signInUrl(returnTo: string): string` (in `libs/api.ts`) = `${API_BASE_URL}/auth/login?returnTo=${encodeURIComponent(returnTo)}`
  - `ENDPOINTS.authMe = "/auth/me"`, `ENDPOINTS.authLogout = "/auth/logout"`
  - types `AuthStatus`, `AuthUserDto`, `GuestQuotaDto`, `AuthMeDto` (shape in design §5.1)
  - `fetchMe(): Promise<AuthMeDto>`, `logout(): Promise<void>`
  - `useAuth(): { status: AuthStatus | "loading"; user: AuthUserDto | null; guestQuota: GuestQuotaDto | null; isUser: boolean }` (query key `["auth","me"]`)
  - `useSignOut()` — mutation; on success `queryClient.clear()` then navigate to `/`
  - `AUTH_QUERY_KEY = ["auth", "me"] as const`

- [ ] **Step 1: Failing tests** `requests/__tests__/auth.test.ts`: `fetchMe` calls `${base}/auth/me` with `credentials: "include"`; `logout` POSTs; `signInUrl("/wizard?runId=1")` encodes the query; `ApiError` from a 429 body `{ code: "GUEST_QUOTA_EXCEEDED", resetsAt }` exposes `code` and `body`.
- [ ] **Step 2:** Run `pnpm test -- auth` → FAIL.
- [ ] **Step 3: Implement.** In `apiFetch` and `apiFetchBinary`: `fetch(url, { ...init, credentials: "include" })`. Replace `extractErrorMessage` with `extractError(res): Promise<{ message: string; code?: string; body?: unknown }>` and construct `new ApiError(res.status, message, code, body)`. `useAuth` uses `useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: fetchMe, staleTime: 30_000 })`; after any mutation that may create a guest (`useCreateDocument`, `useRunMatch`) invalidate `AUTH_QUERY_KEY` in their `onSuccess`/`onError` (status flips anonymous→guest, quota changes).
  `AuthErrorToast`: reads `authError` from `useSearch({ strict: false })`; when present shows `message.error(t("auth.error." + code, { defaultValue: t("auth.error.generic") }))` once, then `navigate({ search: (s) => ({ ...s, authError: undefined }), replace: true })`.
- [ ] **Step 4:** Update existing request tests that assert the exact `fetch` init. Run `pnpm test` → PASS.
- [ ] **Step 5: Gate + commit** `git commit -m "feat(auth): send the session cookie and expose who is signed in"`

---

### Task 10: Shell — guest and user sidebar, header, drawer

**Files:**
- Modify: `client/src/layouts/AppShell/index.tsx`
- Modify: `client/src/layouts/AppShell/components/Sidebar/index.tsx`
- Create: `client/src/layouts/AppShell/components/GuestCard/index.tsx`
- Create: `client/src/layouts/AppShell/components/UserCard/index.tsx`
- Create: `client/src/layouts/AppShell/components/AccountMenu/index.tsx` (mobile/tablet header avatar menu)
- Modify: `client/src/layouts/AppShell/__tests__/AppShell.test.tsx`
- Modify: `client/src/locales/{en,vi}/translation.json`

**Interfaces:**
- Consumes: `useAuth`, `useSignOut`, `signInUrl` (Task 9).
- Produces: `Sidebar` prop unchanged (`collapsed?: boolean`); it filters `NAV_ITEMS` by a new `guest: boolean` field (`true` for Home and Match only) when `!isUser`.

- [ ] **Step 1: Failing tests** (mock `useAuth`): anonymous/guest → nav shows exactly Home + Match, GuestCard with "Sign in with Ducker ID" link whose `href` is `signInUrl(<current path>)`, quota text "3 / 5 left" for `{ limit: 5, used: 2 }`; user → 6 nav items, UserCard with full name, email and a "Sign out" button that calls the mutation; header below `lg` shows "Sign in" link for guests and an "Account" button for users; while `status === "loading"` neither card renders (no flash of the wrong state).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** to the canvas (row 1 and row 6). GuestCard: `rounded-xl border border-line bg-surface-subtle p-4 flex flex-col gap-3` — eyebrow `auth.guest.eyebrow`, body `auth.guest.pitch`, `<a>` styled as antd primary button `!h-11 w-full` (use `<Button type="primary" href=…>`), then quota row (`text-xs text-muted` label + `font-mono tabular-nums text-xs` value) and a 6px track (`bg-line`, fill `bg-primary`, width `${(left/limit)*100}%`). UserCard: `mt-auto rounded-xl border border-line p-3` — avatar circle `size-9 rounded-full bg-primary/10 text-accent font-semibold` with initials (first letters of the first and last word of `fullName`, else of `email`), name `text-sm font-semibold truncate`, email `text-xs text-muted truncate`, then `<Button type="text" icon={<LogOut/>} className="!h-11 w-full !justify-start">`. Collapsed rail (`w-16`): GuestCard collapses to an icon-only sign-in button with tooltip; UserCard to the avatar with a tooltip and the sign-out in a popover. Drawer renders the same Sidebar + card. Icons per `icon-map.md` (add `log-in`, `log-out`, `clock` rows there in Task 15).
- [ ] **Step 4:** Run → PASS. **Step 5: Gate + commit** `git commit -m "feat(shell): show guests two destinations and a way to sign in"`

---

### Task 11: Sign-in gate + route gating + quota state

**Files:**
- Create: `client/src/components/SignInGate/index.tsx` (+ `__tests__`)
- Create: `client/src/components/RequireAuth/index.tsx` (+ `__tests__`)
- Modify: `client/src/routes/_app/{cv,jd,ai-credentials,my-data}.tsx`, `compare.$documentId.tsx`, `cv-rewrite.$matchResultId.tsx`
- Modify: `client/src/views/Wizard/components/MatchResultCard/index.tsx` (quota error → `SignInGate variant="quota"`)

**Interfaces:**
- Produces:
  - `SignInGate({ variant: "route" | "quota"; title: string; description: string; resetsAt?: string; backTo: "/" | "/wizard" })`
  - `RequireAuth({ titleKey: string; children: ReactNode })` — renders children for users, `SignInGate variant="route"` for anonymous/guest, a skeleton while loading

- [ ] **Step 1: Failing tests:** gate renders title, description, a sign-in link to `signInUrl(currentPath)` and a back link; quota variant renders "Resets in 6 h 12 min" for a `resetsAt` 6h12m ahead (mock `Date.now`) using `font-mono tabular-nums`; `RequireAuth` renders children only when `isUser`.
- [ ] **Step 2–3:** Implement per canvas rows 4 and 5: centered `SectionCard` `max-w-[440px] mx-auto mt-8 md:mt-16 lg:mt-24`, icon tile `size-12 rounded-full bg-primary/10 text-accent` (`KeyRound` for route, `Clock` for quota), title (card-title role), description `text-muted`, buttons stacked full width `!h-11`: primary "Sign in with Ducker ID", text "Back to matching"/"Back to home". Route files wrap their component: `component: () => <RequireAuth titleKey="gate.cv"><CvLibrary /></RequireAuth>` with keys `gate.cv`, `gate.jd`, `gate.aiCredentials`, `gate.myData`, `gate.compare`, `gate.cvRewrite` (EN titles: "Sign in to see your saved CVs", "… saved job descriptions", "… manage your AI keys", "… download your data", "… compare CV versions", "… rewrite this CV"). In `MatchResultCard`, when the run mutation fails with `ApiError` whose `code === "GUEST_QUOTA_EXCEEDED"`, render `<SignInGate variant="quota" … resetsAt={body.resetsAt} backTo="/" />` instead of the generic error alert.
- [ ] **Step 4–5:** Run → PASS. Gate + commit `git commit -m "feat(guest): invite guests to sign in instead of showing a broken page"`

---

### Task 12: Home for guests

**Files:**
- Modify: `client/src/views/Home/index.tsx`, `client/src/views/Home/mains/HeroCta/index.tsx`
- Create: `client/src/views/Home/mains/AccountPerks/index.tsx`
- Modify: `client/src/views/Home/__tests__/Home.test.tsx`

- [ ] **Step 1: Failing tests:** guest → hero with eyebrow "CV ↔ JD matching", `Start matching` link to `/wizard`, a `Sign in` link, footer note "No account needed: 5 matches a day on the system AI key…" (limit from `guestQuota.limit`), `AccountPerks` with 4 rows; no `StatCards`, no `RecentMatches` (and their queries are not fired — assert the history request mock was not called). User → unchanged (existing tests still pass).
- [ ] **Step 2–3:** Implement per canvas row 1: desktop `grid lg:grid-cols-[3fr_2fr] gap-6 items-start`; hero buttons `!h-11`, stacked full width below `md`. `StatCards`/`RecentMatches` only mount when `isUser` (so their queries do not 401).
- [ ] **Step 4–5:** Run → PASS. Gate + commit `git commit -m "feat(guest): a home page that explains what signing in adds"`

---

### Task 13: Wizard — guest inputs, system key, result callout, `?runId=` reopen, spacing + 44px

**Files:**
- Modify: `client/src/routes/_app/wizard.tsx` (`validateSearch`)
- Modify: `client/src/views/Wizard/index.tsx` (reopen from `runId`)
- Modify: `client/src/stores/slices/wizard.ts` (`openRun`)
- Modify: `client/src/views/Wizard/components/UploadPasteTabs/index.tsx`
- Modify: `client/src/views/Wizard/components/DocumentInputStep/index.tsx`
- Modify: `client/src/views/Wizard/mains/StepReview/index.tsx`
- Modify: `client/src/views/Wizard/mains/StepResult/index.tsx`
- Create: `client/src/views/Wizard/components/KeepResultCallout/index.tsx`
- Create: `client/src/views/Wizard/components/ClaimedNotice/index.tsx`
- Modify: `client/src/views/Wizard/components/ResultActionBar/index.tsx`
- Modify: `client/src/views/Wizard/components/MatchResultCard/index.tsx` (hide improve/cover letter/compare for guests)
- Tests under `client/src/views/Wizard/__tests__/` and `client/src/stores/slices/__tests__/`

**Interfaces:**
- Produces: `useWizardStore.openRun({ runId, cvDocId, jdDocId }): void` → `{ step: 4, runId, cvDocId, jdDocId, matchId: null, pendingCredentialIds: [] }`; route search `{ runId?: string; claimed?: "1" }`.

- [ ] **Step 1: Failing tests:**
  - store: `openRun` sets step 4 and the ids, clears pending.
  - `UploadPasteTabs`: root has `flex flex-col gap-4`; `Segmented` has no `mb-*` class; `Dragger`/`TextArea` have no `mb-*` class; `Segmented` uses `size="large"` and the class that makes items 40px (`[&_.ant-segmented-item-label]:!min-h-10 [&_.ant-segmented-item-label]:!leading-10`).
  - `DocumentInputStep` as guest: no "Saved" list heading, no `SaveForReuseButton`, shows note "As a guest, this document is kept for 24 hours…" with a sign-in link; Back/Next buttons carry `!h-11`.
  - `StepReview` as guest: no `RunWithSelector`; starting the run uses `credentialIds = [null]`.
  - `StepResult` as guest with a ready report: renders `KeepResultCallout` whose sign-in link is `signInUrl("/wizard?runId=<runId>")`.
  - `ResultActionBar`: no "Save report" button for anyone; `Start over` only.
  - `MatchResultCard` as guest: no improve/cover-letter/compare buttons.
  - `Wizard` with search `runId=r1` and the store empty: calls `fetchMatchRun("r1")`, then `openRun` with its `cvDocumentId/jdDocumentId`, then strips `runId` from the URL (keeps `claimed`); with `claimed=1` and user → `ClaimedNotice` renders "Saved to your account." once and the param is removed on dismiss.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.**
  `UploadPasteTabs` root: `<div className="flex flex-col gap-4">`; drop `className="mb-8"` from `Segmented` and the `mb-6 md:mb-10` from `Dragger`/`TextArea`; the parent `DocumentInputStep` already separates blocks — replace its `mb-8` wrappers with a `flex flex-col gap-6` body. (Why: antd's cssinjs sets `margin: 0` on `.ant-segmented` and wins over the Tailwind margin, so the tabs sat flush against the drop zone — design §6.4.)
  Every `Button` in `DocumentInputStep`, `StepReview`, `StepResult`, `ResultActionBar`, `KeepResultCallout`: `size="large" className="!h-11 …"`, full width below `md` where it is a footer action (`max-md:w-full`).
  `wizard.tsx`: `validateSearch: (s: Record<string, unknown>) => ({ runId: typeof s.runId === "string" ? s.runId : undefined, claimed: s.claimed === "1" || s.claimed === 1 ? ("1" as const) : undefined })`.
  `Wizard`: `const { runId: searchRunId, claimed } = Route.useSearch()`; effect: if `searchRunId && searchRunId !== storeRunId` → `queryClient.fetchQuery({ queryKey: [...], queryFn: () => fetchMatchRun(searchRunId) })` → `openRun(...)` → `navigate({ search: (s) => ({ ...s, runId: undefined }), replace: true })`; on 401/404 fall back to step 1 and show `result.missingRun`.
  `KeepResultCallout` per canvas row 3 (tile `Clock`, title "Kept for 24 hours, then deleted", text, primary `Button href={signInUrl(...)}` "Sign in to keep it"). Rendered after the cards in `StepResult` only when `!isUser && isReportReady`.
  `ResultActionBar`: remove the inert `Save report` button and its i18n key usage (closes debt #8), keep `Start over` (`!h-11`, `max-md:w-full`).
- [ ] **Step 4:** Run → PASS. **Step 5: Gate + commit** `git commit -m "feat(wizard): run as a guest on the system key and reopen a result after sign-in"`

---

### Task 14: Playwright — signed-in storage state, guest spec

**Files:**
- Modify: `client/e2e/global-setup.ts`, `client/e2e/global-teardown.ts`, `client/e2e/db-cleanup.ts`
- Create: `client/e2e/auth-state.ts`
- Modify: `client/playwright.config.ts` (`storageState` per project; guest project)
- Modify: `client/e2e/home-dashboard-library/library.e2e.ts` (drop `STUB_USER_ID`, use the e2e user id)
- Create: `client/e2e/guest-mode/guest.e2e.ts`

- [ ] **Step 1:** `auth-state.ts`: with `pg`, upsert a `User` (`externalSub = 'e2e-user'`, `email = 'e2e@match-cv.test'`, `fullName = 'E2E User'`), insert a `Session` (`sha256(token)` hex, 1 day), write `e2e/.auth/user.json` storage state with cookie `{ name: "mcv_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax", expires: <unix> }`; export `E2E_USER_ID` via a JSON file read by specs. `global-setup` calls it after `cleanDocuments`; teardown deletes the session. Add `e2e/.auth/` to `client/.gitignore`.
- [ ] **Step 2:** `playwright.config.ts`: `use.storageState: "e2e/.auth/user.json"` for the three existing projects; add a `guest` project (`testMatch: "guest-mode/**"`, `storageState: { cookies: [], origins: [] }`, desktop + mobile viewports via two projects `guest-desktop`, `guest-mobile`) and exclude `guest-mode/**` from the signed-in projects with `testIgnore`.
- [ ] **Step 3:** `guest.e2e.ts`: sidebar has exactly Home + Match and a sign-in link to `:5200/api/v1/auth/login?returnTo=…`; wizard: paste a JD and a CV, review has no provider selector, result shows the "Kept for 24 hours" callout (if the system AI key is not configured in the dev env, assert on the error card instead and `test.skip` the callout check with a message naming `OPENROUTER_API_KEY` — the suite must not go red on environment, see `server/.claude/lesson.md`); `/cv` shows the sign-in gate; tab group and drop zone are separated (bounding boxes: `dropzone.top - tabs.bottom >= 16`). Quota: set no env here — covered by the server e2e (Task 6).
- [ ] **Step 4:** Run both servers (worktree ports) and `pnpm test:e2e` → PASS (record the pass count for the README).
- [ ] **Step 5: Commit** `git commit -m "test(e2e): run the suite signed in and cover guest mode"`

---

### Task 15: Tier-1 docs, design system, README

**Files:** `docs/03-design/invariants.md`, `docs/03-design/architecture.md`, `docs/01-product/glossary.md`, `docs/01-product/overview.md` (only if it mentions the mock user), `docs/04-state/backlog.md`, `docs/design-system/match-cv/ux-copy.md`, `docs/design-system/match-cv/icon-map.md`, `README.md`, `client/README.md` (if it documents env/setup), `docs/02-requirements/scope.md` (FR-18, FR-21 → `xong`)

- [ ] invariants: #4 drop the "mock user" sentence (now: ownership always from the session); add a row "Session token is stored only as `sha256`; the IdP token is never stored" → violated ⇒ DB leak = account takeover; add "Guest-only endpoints are opted in with `@AllowGuest`; the default is user-only" → violated ⇒ guests reach paid features. Keep the file under 40 content lines.
- [ ] architecture: AuthModule in the module map, the §3.2 flow in one paragraph + link to design.
- [ ] glossary: Guest (khách) ↔ `User.isGuest` ↔ "Guest mode"; Session ↔ `Session` ↔ —; Claim ↔ `GuestService.claim` ↔ "Saved to your account".
- [ ] backlog: §Đang làm → empty with a one-paragraph close note; close debt #2 and #8 (state how); add debt "lazy guest purge" (what, why accepted, when to pay: when a scheduler exists or guest rows exceed what one purge statement clears quickly); reorder next-steps (FR-16, FR-17 first).
- [ ] ux-copy: EN + VI for every new string. icon-map: `log-in`, `log-out`, `clock`, `key-round` (gate).
- [ ] README: dispatch the `readme-maintainer` agent (Features bullets for sign-in and guest mode, setup section for Ducker ID registration + env).
- [ ] Commit `docs(ducker-id-sign-in): record sign-in and guest mode across the docs`

---

### Task 16: Register in Ducker ID and verify on the running app (controller-run, not a subagent)

- [ ] Start Ducker ID (server `:5000`, client `:3000`), sign in as `admin@test.com`, create app `match-cv` per design §7 in `/admin/apps` through Chrome; copy client id + one-time secret into the **worktree's** `server/.env` with `OIDC_*`, `SESSION_SECRET`.
- [ ] Run Match CV from the worktree (server `:5200`, client `:5300` — stop the main checkout's dev servers first).
- [ ] Walk as guest: home → wizard → result → "Sign in to keep it" → Ducker ID login `user@test.com` → back on `/wizard` with the claimed notice; `/cv` lists the claimed CV.
- [ ] Screenshots at 375 / 768 / 1024 / 1440, light + dark; keyboard through sidebar and gate; no horizontal scroll.
- [ ] Note every divergence from the canvas in the final report and update the canvas.
