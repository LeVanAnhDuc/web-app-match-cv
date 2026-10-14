import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql, utc } from "./db";

// Users + sessions for the API specs, seeded the way the server's SessionService would: the Session row stores
// sha256(token) and only the raw token travels in the `mcv_session` cookie. Moved from server/test/helpers/auth.ts
// (PrismaService → pg). Each spec makes its own throwaway users and deletes them in afterAll; a User delete cascades to
// its sessions, documents, matches, runs, credentials and letters.

const DAY_MS = 86_400_000;
export const SESSION_COOKIE = "mcv_session";

export interface SeededUser {
  userId: string;
  /** Ready-to-send Cookie header value: `mcv_session=<token>`. */
  cookie: string;
}

/** The Session row id the server derives from a raw session token. */
export function sessionIdFor(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function sessionFor(userId: string, expiresAt: Date): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await sql(
    `INSERT INTO "Session" (id, "userId", "expiresAt", "createdAt")
     VALUES ($1, $2, $3::timestamptz AT TIME ZONE 'UTC', $4::timestamptz AT TIME ZONE 'UTC')`,
    [sessionIdFor(token), userId, utc(expiresAt), utc()]
  );
  return `${SESSION_COOKIE}=${token}`;
}

/** A bare candidate row with no session: "another user" who owns data the caller must never see. */
export async function createUser(
  opts: { id?: string; isGuest?: boolean; guestExpiresAt?: Date; externalSub?: string | null; email?: string | null } = {}
): Promise<string> {
  const id = opts.id ?? randomUUID();
  const now = utc();
  await sql(
    `INSERT INTO "User" (id, role, "externalSub", "isGuest", "guestExpiresAt", email, "createdAt", "updatedAt")
     VALUES ($1, 'candidate', $2, $3, $4::timestamptz AT TIME ZONE 'UTC', $5,
             $6::timestamptz AT TIME ZONE 'UTC', $6::timestamptz AT TIME ZONE 'UTC')`,
    [
      id,
      opts.externalSub ?? null,
      opts.isGuest ?? false,
      opts.guestExpiresAt ? utc(opts.guestExpiresAt) : null,
      opts.email ?? null,
      now,
    ]
  );
  return id;
}

export async function createSignedInUser(opts: { email?: string } = {}): Promise<SeededUser> {
  const userId = await createUser({
    externalSub: randomBytes(12).toString("hex"),
    email: opts.email ?? `e2e-${randomBytes(4).toString("hex")}@test.local`,
  });
  return { userId, cookie: await sessionFor(userId, new Date(Date.now() + DAY_MS)) };
}

export async function createGuestUser(): Promise<SeededUser> {
  const expiresAt = new Date(Date.now() + DAY_MS);
  const userId = await createUser({ isGuest: true, guestExpiresAt: expiresAt });
  return { userId, cookie: await sessionFor(userId, expiresAt) };
}

export async function deleteUsers(ids: string[]): Promise<void> {
  if (ids.length) await sql(`DELETE FROM "User" WHERE id = ANY($1::text[])`, [ids]);
}

/** Owner of a document, with its guest flag (e.g. to find the guest an anonymous upload minted). */
export async function documentOwner(documentId: string): Promise<{ userId: string; isGuest: boolean } | null> {
  const [row] = await sql<{ userId: string; isGuest: boolean }>(
    `SELECT d."userId", u."isGuest" FROM "Document" d JOIN "User" u ON u.id = d."userId" WHERE d.id = $1`,
    [documentId]
  );
  return row ?? null;
}

/** The user a raw session token resolves to, or null when the session row is gone (or expired). */
export async function resolveSession(token: string): Promise<{ userId: string; isGuest: boolean } | null> {
  const [row] = await sql<{ userId: string; isGuest: boolean }>(
    `SELECT s."userId", u."isGuest" FROM "Session" s JOIN "User" u ON u.id = s."userId"
      WHERE s.id = $1 AND s."expiresAt" > (now() AT TIME ZONE 'UTC')`,
    [sessionIdFor(token)]
  );
  return row ?? null;
}

/** `mcv_session=<token>` from a Set-Cookie list, ignoring a cleared (`mcv_session=;`) one. */
export function liveCookie(setCookies: string[], name: string): string | undefined {
  return setCookies
    .filter((c) => c.startsWith(`${name}=`))
    .map((c) => c.split(";")[0])
    .find((c) => c !== `${name}=`);
}

/** `name=value` of every Set-Cookie for `name` (cleared ones come back as `name=`). */
export function setCookiesNamed(setCookies: string[], name: string): string[] {
  return setCookies.filter((c) => c.startsWith(`${name}=`)).map((c) => c.split(";")[0]);
}
