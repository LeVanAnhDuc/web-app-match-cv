import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import type { HttpFactory } from "@/api/http.client";
import { sql } from "@/utils/db";
import { createGuestUser, deleteUsers } from "@/utils/sessions";

// Ported from server/test/guest-quota.e2e-spec.ts. That suite set GUEST_MATCH_LIMIT_PER_DAY=1 before booting the app
// (helpers/guest-quota-env.ts) and replaced AiService with a stand-in that fails fast. Over HTTP the dev server keeps
// its own limit (default 5) and its real AiService, so the quota case is fixme. The credential case is decided before
// the quota is consumed and before any provider call, and runs live.

test.describe("Guest quota (e2e)", () => {
  let cookie: string;
  let userId: string;
  let cvId: string;
  let jdId: string;
  let runId: string;

  const post = (http: HttpFactory, path: string, body: object) => http(cookie).post(path, { data: body });

  const clearToday = () => sql(`DELETE FROM "GuestUsage" WHERE "day" = (now() AT TIME ZONE 'UTC')::date`);

  test.beforeAll(async ({ http }) => {
    await clearToday();
    ({ userId, cookie } = await createGuestUser());
    const cv = await post(http, "/documents", {
      kind: "CV",
      sourceText: "TypeScript NestJS engineer.",
      save: false,
    });
    const jd = await post(http, "/documents", {
      kind: "JD",
      sourceText: "Looking for a TypeScript NestJS engineer.",
      save: false,
    });
    cvId = (cv.body as { id: string }).id;
    jdId = (jd.body as { id: string }).id;
    const run = await post(http, "/match/runs", {
      cvDocumentId: cvId,
      jdDocumentId: jdId,
    });
    runId = (run.body as { id: string }).id;
  });

  test.afterAll(async () => {
    await clearToday();
    await deleteUsers([userId]);
  });

  // FIXME(migrated): needs AiService (FailingAiService) injected in-process and GUEST_MATCH_LIMIT_PER_DAY=1 (helpers/guest-quota-env.ts); over HTTP the first match would call the real OpenRouter and the dev limit is 5. Decide in /write-tests guest-mode.
  test.fixme("lets the first system-key match through, then answers 429 with resetsAt", async ({ http }) => {
    const body = { cvDocumentId: cvId, jdDocumentId: jdId, runId };
    const first = await post(http, "/match", body);
    // The AI stand-in fails, so any status is fine except the auth/quota blocks.
    expect([401, 403, 429]).not.toContain(first.status);

    const second = await post(http, "/match", body);
    expect(second.status).toBe(429);
    expect(second.body).toMatchObject({
      code: "GUEST_QUOTA_EXCEEDED",
      limit: 1,
    });
    expect(typeof (second.body as { resetsAt: string }).resetsAt).toBe("string");
  });

  test("forbids a guest credential with 403 GUEST_FORBIDDEN_CREDENTIAL", async ({ http }) => {
    const res = await post(http, "/match", {
      cvDocumentId: cvId,
      jdDocumentId: jdId,
      credentialId: randomUUID(),
    });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "GUEST_FORBIDDEN_CREDENTIAL" });
  });
});
