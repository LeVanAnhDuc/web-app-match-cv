import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Client } from "pg";

// Signs the suite in without the OIDC round-trip: seed a User + a Session row
// the way the server would, then hand the browser the matching cookie as a
// Playwright storage state. The DB stores sha256(token); only the raw token
// goes in the cookie. Everything lands in e2e/.auth/ (gitignored).

const CONNECTION_STRING =
  process.env.E2E_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/matchcv";

const AUTH_DIR = join(process.cwd(), "e2e", ".auth");
export const STORAGE_STATE_PATH = join(AUTH_DIR, "user.json");
const USER_INFO_PATH = join(AUTH_DIR, "e2e-user.json");
const SESSION_INFO_PATH = join(AUTH_DIR, "session.json");

const E2E_SUB = "e2e-user";
const COOKIE_NAME = "mcv_session";
const SESSION_TTL_SECONDS = 24 * 60 * 60;

/** Id of the seeded e2e user, for specs that insert rows directly. */
export function readE2eUserId(): string {
  const info = JSON.parse(readFileSync(USER_INFO_PATH, "utf8")) as {
    id: string;
  };
  return info.id;
}

export async function seedSignedInSession(): Promise<void> {
  mkdirSync(AUTH_DIR, { recursive: true });
  const token = randomBytes(32).toString("base64url");
  const sessionId = createHash("sha256").update(token).digest("hex");
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  let userId: string;
  try {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO "User"
         (id, role, "externalSub", "isGuest", email, "fullName", "createdAt", "updatedAt")
       VALUES ($1, 'candidate', $2, false, 'e2e@match-cv.test', 'E2E User', now(), now())
       ON CONFLICT ("externalSub") DO UPDATE
         SET "isGuest" = false, "guestExpiresAt" = NULL, "updatedAt" = now()
       RETURNING id`,
      [randomUUID(), E2E_SUB]
    );
    userId = rows[0].id;
    await client.query(
      `INSERT INTO "Session" (id, "userId", "expiresAt", "createdAt")
       VALUES ($1, $2, to_timestamp($3), now())`,
      [sessionId, userId, expires]
    );
  } finally {
    await client.end();
  }

  writeFileSync(USER_INFO_PATH, JSON.stringify({ id: userId }));
  writeFileSync(SESSION_INFO_PATH, JSON.stringify({ id: sessionId }));
  writeFileSync(
    STORAGE_STATE_PATH,
    JSON.stringify({
      cookies: [
        {
          name: COOKIE_NAME,
          value: token,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
          expires
        }
      ],
      origins: []
    })
  );
  mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });
}

/** Remove the session row seeded by this run. The user row is kept. */
export async function removeSignedInSession(): Promise<void> {
  let sessionId: string;
  try {
    sessionId = (
      JSON.parse(readFileSync(SESSION_INFO_PATH, "utf8")) as { id: string }
    ).id;
  } catch {
    return;
  }
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  try {
    await client.query('DELETE FROM "Session" WHERE id = $1', [sessionId]);
  } finally {
    await client.end();
  }
}

/**
 * Guest quota is per IP per UTC day and the dev DB's counter persists across
 * runs; clear today's rows so guest specs are repeatable. Quota behaviour
 * itself is covered by the server e2e.
 */
export async function resetGuestUsage(): Promise<void> {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  try {
    await client.query('DELETE FROM "GuestUsage"');
  } finally {
    await client.end();
  }
}

/**
 * Cookie header for specs that call the API with node `fetch` (outside the
 * browser context, so the storage state does not apply).
 */
export function sessionCookieHeader(): Record<string, string> {
  const state = JSON.parse(readFileSync(STORAGE_STATE_PATH, "utf8")) as {
    cookies: { name: string; value: string }[];
  };
  const c = state.cookies[0];
  return { Cookie: `${c.name}=${c.value}` };
}
