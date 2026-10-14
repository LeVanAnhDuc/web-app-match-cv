import { createCipheriv, createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LOOPBACK_IPS, utcDay } from "@/data/test-data/guest-mode";
import { GuestHomePage } from "@/pages/guest-mode/guest-home.page";
import { GuestWizardPage } from "@/pages/guest-mode/guest-wizard.page";
import { insertDocument, insertMatchResult, insertMatchRun, sql, utc } from "@/utils/db";
import {
  createGuestUser,
  createSignedInUser,
  createUser,
  deleteUsers,
  documentOwner,
  resolveSession,
  SESSION_COOKIE,
  sessionIdFor,
  type SeededUser,
} from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "guest-mode": its page objects, seeded guests/users, the per-IP quota counter and the
// sealed mcv_oauth cookie. Every name starts with `guestMode` (all module slots merge into one `test`).
//
//   guestModeHomePage / guestModeWizardPage   page objects (pages/guest-mode/)
//   guestModeData        users and rows this test seeds; every user it made (or recorded) is deleted after the test
//   guestModeQuota       GuestUsage rows of the loopback caller (HMAC of SESSION_SECRET + IP, like the server) —
//                        planted to reach the 429 without spending a single AI call; cleared after the test
//   guestModeOAuth       seals an mcv_oauth cookie like AuthService.beginLogin, to reach the callback's pre-IdP branches
//   guestModeBrowser     puts a seeded session cookie into the test's browser context
//
// SESSION_SECRET: the HMAC key of the quota counter and the seal key of mcv_oauth are the dev SERVER's secret. It is
// read at runtime from process.env.SESSION_SECRET or ../server/.env (the running dev server's own file), never copied
// into this repo.

const DAY_MS = 86_400_000;

function serverSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const file = join(__dirname, "..", "..", "..", "..", "server", ".env");
  if (existsSync(file)) {
    const line = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((l) => /^\s*SESSION_SECRET\s*=/.test(l));
    const value = line?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  }
  throw new Error("guest-mode: SESSION_SECRET of the dev server not found (process.env or ../server/.env)");
}

// ── guestModeData ───────────────────────────────────────────────────────────────
export interface SeededGuest extends SeededUser {
  /** Raw session token (the value of the mcv_session cookie). */
  token: string;
}

export interface SeededRun {
  cvId: string;
  jdId: string;
  runId: string;
  resultId: string;
}

export interface UserRow {
  id: string;
  role: string;
  isGuest: boolean;
  guestExpiresAt: Date | null;
}

export interface GuestData {
  /** A live guest (24 h) with its session. */
  guest(): Promise<SeededGuest>;
  /** A signed-in user with a 1-day session. */
  user(): Promise<SeededUser>;
  /** A guest whose guestExpiresAt and session both ended `agoMs` ago. */
  expiredGuest(agoMs?: number): Promise<SeededGuest>;
  /** Delete this user after the test too (e.g. the guest an anonymous POST /documents minted). */
  track(userId: string): void;
  /** Record and return the owner of a document created over HTTP. */
  ownerOf(documentId: string): Promise<{ userId: string; isGuest: boolean } | null>;
  /** CV + JD documents (pasted text) owned by `userId`. */
  pair(userId: string, opts?: { isSaved?: boolean }): Promise<{ cvId: string; jdId: string }>;
  /** CV + JD + a run + one succeeded system-key result in that run. */
  run(userId: string): Promise<SeededRun>;
  findUser(id: string): Promise<UserRow | null>;
  /** expiresAt of the session row a raw token maps to (expired rows included), or null when it is gone. */
  sessionExpiry(token: string): Promise<Date | null>;
  /** How many guest users exist right now. */
  guestCount(): Promise<number>;
  /** End a guest's 24 h (guestExpiresAt = 1 min ago) while its session row stays valid. */
  expireGuest(userId: string): Promise<void>;
  /** Owner id of a MatchRun row, or null when it is gone. */
  runOwner(runId: string): Promise<string | null>;
  /** How many Document / MatchRun / MatchResult rows a user owns. */
  holdings(userId: string): Promise<{ documents: number; runs: number; results: number }>;
}

// ── guestModeQuota ──────────────────────────────────────────────────────────────
export interface GuestUsageRow {
  ipHash: string;
  day: string;
  count: number;
}

export interface GuestQuota {
  /** HMAC-SHA256(SESSION_SECRET, ip) — the key the server stores instead of the IP. */
  hashOf(ip: string): string;
  /** Set the loopback caller's counter for a UTC day (default today) to `count`. */
  plant(count: number, opts?: { day?: string }): Promise<void>;
  /** Insert a row under an arbitrary hash (removed after the test). */
  plantRaw(ipHash: string, day: string, count: number): Promise<void>;
  rowExists(ipHash: string, day: string): Promise<boolean>;
  /** Every GuestUsage row (ipHash, day as YYYY-MM-DD, count). */
  rows(): Promise<GuestUsageRow[]>;
  /** Delete the loopback caller's rows (every day). Runs again after the test. */
  clear(): Promise<void>;
}

// ── guestModeOAuth ──────────────────────────────────────────────────────────────
export interface GuestOAuth {
  /**
   * `mcv_oauth=<sealed>` carrying { state, nonce, verifier, returnTo, guestUserId, exp }, sealed with AES-256-GCM
   * (key sha256(SESSION_SECRET)) exactly like server/src/modules/auth/oidc/sealed-cookie.ts.
   */
  cookie(input: { state: string; guestUserId: string | null; returnTo?: string; expInMs?: number }): string;
}

export interface GuestBrowser {
  /** Add `mcv_session=<token>` (from a SeededUser) to the test's browser context, host-only on the API host. */
  useSession(seeded: SeededUser): Promise<void>;
  /**
   * The guest the browser minted through the UI (its mcv_session cookie), recorded in guestModeData so it is deleted
   * after the test. Null when the browser holds no live session.
   */
  adoptGuest(): Promise<string | null>;
}

function seal(payload: object, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

async function sessionRow(userId: string, expiresAt: Date): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await sql(
    `INSERT INTO "Session" (id, "userId", "expiresAt", "createdAt")
     VALUES ($1, $2, $3::timestamptz AT TIME ZONE 'UTC', $4::timestamptz AT TIME ZONE 'UTC')`,
    [sessionIdFor(token), userId, utc(expiresAt), utc()]
  );
  return token;
}

const tokenOf = (cookie: string) => cookie.slice(`${SESSION_COOKIE}=`.length);

export const test = shared.extend<{
  guestModeHomePage: GuestHomePage;
  guestModeWizardPage: GuestWizardPage;
  guestModeData: GuestData;
  guestModeQuota: GuestQuota;
  guestModeOAuth: GuestOAuth;
  guestModeBrowser: GuestBrowser;
}>({
  guestModeHomePage: async ({ page }, use) => use(new GuestHomePage(page)),
  guestModeWizardPage: async ({ page }, use) => use(new GuestWizardPage(page)),

  guestModeData: async ({}, use) => {
    const users = new Set<string>();
    const data: GuestData = {
      async guest() {
        const seeded = await createGuestUser();
        users.add(seeded.userId);
        return { ...seeded, token: tokenOf(seeded.cookie) };
      },
      async user() {
        const seeded = await createSignedInUser();
        users.add(seeded.userId);
        return seeded;
      },
      async expiredGuest(agoMs = 60_000) {
        const ended = new Date(Date.now() - agoMs);
        const userId = await createUser({ isGuest: true, guestExpiresAt: ended });
        users.add(userId);
        const token = await sessionRow(userId, ended);
        return { userId, token, cookie: `${SESSION_COOKIE}=${token}` };
      },
      track(userId) {
        users.add(userId);
      },
      async ownerOf(documentId) {
        const owner = await documentOwner(documentId);
        if (owner) users.add(owner.userId);
        return owner;
      },
      async pair(userId, opts = {}) {
        const cvId = await insertDocument({
          userId,
          kind: "CV",
          title: `guest-mode CV ${randomUUID().slice(0, 8)}`,
          rawText: "Senior backend engineer, NestJS and PostgreSQL.",
          isSaved: opts.isSaved ?? false,
        });
        const jdId = await insertDocument({
          userId,
          kind: "JD",
          title: `guest-mode JD ${randomUUID().slice(0, 8)}`,
          rawText: "Hiring a backend engineer with NestJS.",
          isSaved: opts.isSaved ?? false,
        });
        return { cvId, jdId };
      },
      async run(userId) {
        const { cvId, jdId } = await data.pair(userId);
        const runId = await insertMatchRun({ userId, cvDocumentId: cvId, jdDocumentId: jdId });
        const resultId = await insertMatchResult({
          userId,
          cvDocumentId: cvId,
          jdDocumentId: jdId,
          runId,
          scores: [78, 82, 72],
          report: {
            strengths: ["Six years of NestJS in production"],
            gaps: ["No Kubernetes experience mentioned"],
            suggestions: ["Quantify the APIs you built."],
          },
        });
        return { cvId, jdId, runId, resultId };
      },
      async findUser(id) {
        const [row] = await sql<UserRow & Record<string, unknown>>(
          `SELECT id, role::text AS role, "isGuest", "guestExpiresAt" FROM "User" WHERE id = $1`,
          [id]
        );
        if (!row) return null;
        // timestamp(3) without time zone holds UTC: read it back as UTC whatever the machine's offset.
        const raw = row.guestExpiresAt as unknown;
        return { ...row, guestExpiresAt: raw === null ? null : asUtc(raw) };
      },
      async sessionExpiry(token) {
        const [row] = await sql<{ expiresAt: unknown }>(
          `SELECT to_char("expiresAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "expiresAt" FROM "Session" WHERE id = $1`,
          [sessionIdFor(token)]
        );
        return row ? new Date(String(row.expiresAt)) : null;
      },
      async guestCount() {
        const [row] = await sql<{ n: number }>(`SELECT count(*)::int AS n FROM "User" WHERE "isGuest" = true`);
        return row.n;
      },
      async expireGuest(userId) {
        await sql(`UPDATE "User" SET "guestExpiresAt" = $2::timestamptz AT TIME ZONE 'UTC' WHERE id = $1`, [
          userId,
          utc(new Date(Date.now() - 60_000)),
        ]);
      },
      async runOwner(runId) {
        const [row] = await sql<{ userId: string }>(`SELECT "userId" FROM "MatchRun" WHERE id = $1`, [runId]);
        return row?.userId ?? null;
      },
      async holdings(userId) {
        const [row] = await sql<{ documents: number; runs: number; results: number }>(
          `SELECT (SELECT count(*)::int FROM "Document" WHERE "userId" = $1) AS documents,
                  (SELECT count(*)::int FROM "MatchRun" WHERE "userId" = $1) AS runs,
                  (SELECT count(*)::int FROM "MatchResult" WHERE "userId" = $1) AS results`,
          [userId]
        );
        return row;
      },
    };
    await use(data);
    await deleteUsers([...users]);
  },

  guestModeQuota: async ({}, use) => {
    const secret = serverSessionSecret();
    const hashOf = (ip: string) => createHmac("sha256", secret).update(ip).digest("hex");
    const loopback = LOOPBACK_IPS.map(hashOf);
    const raw = new Set<string>();
    const clear = async () => {
      await sql(`DELETE FROM "GuestUsage" WHERE "ipHash" = ANY($1::text[])`, [[...loopback, ...raw]]);
    };
    const upsert = (ipHash: string, day: string, count: number) =>
      sql(
        `INSERT INTO "GuestUsage" ("ipHash", day, count) VALUES ($1, $2::date, $3)
         ON CONFLICT ("ipHash", day) DO UPDATE SET count = EXCLUDED.count`,
        [ipHash, day, count]
      );
    await clear();
    await use({
      hashOf,
      async plant(count, opts = {}) {
        const day = opts.day ?? utcDay(0);
        for (const ipHash of loopback) await upsert(ipHash, day, count);
      },
      async plantRaw(ipHash, day, count) {
        raw.add(ipHash);
        await upsert(ipHash, day, count);
      },
      async rowExists(ipHash, day) {
        const rows = await sql(`SELECT 1 FROM "GuestUsage" WHERE "ipHash" = $1 AND day = $2::date`, [ipHash, day]);
        return rows.length > 0;
      },
      async rows() {
        return sql<GuestUsageRow & Record<string, unknown>>(
          `SELECT "ipHash", to_char(day, 'YYYY-MM-DD') AS day, count FROM "GuestUsage"`
        );
      },
      clear,
    });
    await clear();
  },

  guestModeOAuth: async ({}, use) => {
    const secret = serverSessionSecret();
    await use({
      cookie: ({ state, guestUserId, returnTo = "/wizard", expInMs = 10 * 60_000 }) =>
        `mcv_oauth=${seal(
          {
            state,
            nonce: randomBytes(16).toString("base64url"),
            verifier: randomBytes(32).toString("base64url"),
            returnTo,
            guestUserId,
            exp: Date.now() + expInMs,
          },
          secret
        )}`,
    });
  },

  guestModeBrowser: async ({ page, urls, guestModeData }, use) => {
    await use({
      async adoptGuest() {
        const cookie = (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE && c.value);
        const session = cookie ? await resolveSession(cookie.value) : null;
        if (!session) return null;
        guestModeData.track(session.userId);
        return session.userId;
      },
      async useSession(seeded) {
        await page.context().addCookies([
          {
            name: SESSION_COOKIE,
            value: tokenOf(seeded.cookie),
            url: new URL(urls.apiUrl).origin,
            httpOnly: true,
            sameSite: "Lax",
            expires: Math.floor((Date.now() + DAY_MS) / 1000),
          },
        ]);
      },
    });
  },
});

/** A `timestamp without time zone` value (node-pg parses it as LOCAL time) re-read as the UTC instant it stores. */
function asUtc(value: unknown): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        value.getHours(),
        value.getMinutes(),
        value.getSeconds(),
        value.getMilliseconds()
      )
    );
  }
  return new Date(`${String(value).replace(" ", "T")}Z`);
}
