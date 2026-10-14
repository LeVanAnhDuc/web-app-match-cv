import { randomBytes, randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import type { CallOptions, HttpFactory, HttpResponse } from "@/api/http.client";
import {
  deleteDocuments,
  deleteMatchResults,
  findAiCredential,
  findMatchResult,
  insertAiCredential,
  insertDocument,
  insertMatchResult,
  sql,
} from "@/utils/db";
import { createSignedInUser, createUser, deleteUsers } from "@/utils/sessions";

// Ported from server/test/ai-credentials.e2e-spec.ts. That suite replaced AiService with FakeAiService (ping → chat
// ok / embed model_unavailable) and CredentialCryptoService with one holding a per-spec key. Over HTTP the dev server
// uses its own CREDENTIAL_ENCRYPTION_KEY (it must have one: without it every key endpoint answers 503) and its real
// AiService, so:
//   - anything that runs POST /ai-credentials/:id/test on an OWNED credential would call the real provider → fixme;
//   - anything that needs the crypto service itself (decrypt round trip, isConfigured, the "key absent" app) → fixme;
//   - CRUD, validation, isolation and the 404s decided before any provider call run live.

const BASE = "/ai-credentials";

// A key long enough to pass validation and distinctive enough that a substring
// search over a whole response body proves it did not leak.
const API_KEY = "sk-e2e-secret-do-not-leak-9876";

interface CredentialBody {
  id: string;
  provider: string;
  label: string;
  keyLast4: string;
  chatModel: string | null;
  embedModel: string | null;
  lastTestStatus: string | null;
  lastTestedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ProviderBody {
  id: string;
  label: string;
  defaultChatModel: string;
  defaultEmbedModel: string;
}

test.describe("AiCredentials (e2e)", () => {
  let userId: string;
  let cookie: string;
  const createdIds: string[] = [];
  let labelCounter = 0;

  /** Unique per call so tests never collide on the (userId, label) constraint. */
  const uniqueLabel = () => `e2e-label-${(labelCounter += 1)}-${randomUUID()}`;

  test.beforeAll(async () => {
    ({ userId, cookie } = await createSignedInUser());
  });

  test.afterAll(async () => {
    if (createdIds.length) {
      await sql('DELETE FROM "AiCredential" WHERE id = ANY($1::text[])', [createdIds]);
    }
    await deleteUsers([userId]);
  });

  const track = (res: HttpResponse) => {
    const body = res.body as CredentialBody;
    if (body?.id) createdIds.push(body.id);
    return res;
  };

  test.describe("spec self-sufficiency", () => {
    // FIXME(migrated): needs CredentialCryptoService injected in-process (app.get on the test module); over HTTP this would only see the real server's crypto service. Decide in /write-tests ai-credentials.
    test.fixme("[EP] runs without CREDENTIAL_ENCRYPTION_KEY in the environment", async () => {
      // The guard for the bug this spec used to have: it read the key from
      // .env, so a clean clone saw 20 red tests. If someone reverts to the
      // ambient key, this fails on any machine that does not have one set.
      // in-process: expect(app.get(CredentialCryptoService).isConfigured()).toBe(true);
    });
  });

  test.describe("GET /ai-credentials/providers", () => {
    test("[EP] returns the whitelist with human labels and default models", async ({ http }) => {
      const res = await http(cookie).get(`${BASE}/providers`);

      expect(res.status).toBe(200);
      const body = res.body as ProviderBody[];
      expect(body.map((p) => p.id)).toEqual(["openrouter", "openai", "gemini"]);
      expect(body.find((p) => p.id === "gemini")?.label).toBe("Google Gemini");
      expect(body.every((p) => p.defaultChatModel && p.defaultEmbedModel)).toBe(true);
    });

    test("[EP] is not shadowed by the :id route", async ({ http }) => {
      // "providers" would otherwise be parsed as a credential id and rejected
      // by ParseUUIDPipe with a 400.
      const res = await http(cookie).get(`${BASE}/providers`);
      expect(res.status).not.toBe(400);
    });
  });

  test.describe("POST /ai-credentials", () => {
    let create: (over?: Record<string, unknown>) => Promise<HttpResponse>;

    test.beforeAll(async ({ http }) => {
      create = (over = {}) =>
        http(cookie).post(BASE, {
          data: { provider: "openrouter", label: uniqueLabel(), apiKey: API_KEY, ...over },
        });
    });

    test("[EP] valid body → 201 with a masked key and no secret material", async () => {
      const res = track(await create());

      expect(res.status).toBe(201);
      const body = res.body as CredentialBody;
      expect(body.keyLast4).toBe("9876");
      expect(body.provider).toBe("openrouter");
      expect(body.chatModel).toBeNull();
      expect(body.lastTestStatus).toBeNull();
      expect(body).not.toHaveProperty("apiKey");
      expect(body).not.toHaveProperty("encryptedKey");
      expect(body).not.toHaveProperty("keyIv");
      expect(body).not.toHaveProperty("keyTag");
    });

    test("[security] the submitted key appears nowhere in the response body", async () => {
      const res = track(await create());
      expect(JSON.stringify(res.body)).not.toContain(API_KEY);
      expect(JSON.stringify(res.body)).not.toContain("sk-e2e-secret");
    });

    // FIXME(migrated): needs CredentialCryptoService injected in-process (a per-spec key to decrypt with); over HTTP the ciphertext is under the real server's CREDENTIAL_ENCRYPTION_KEY, which the suite does not hold. Decide in /write-tests ai-credentials.
    test.fixme("[security] the key is stored as ciphertext, not plaintext", async () => {
      const res = track(await create());
      const { id } = res.body as CredentialBody;

      const row = (await findAiCredential(id))!;
      expect(Buffer.from(row.encryptedKey).toString("utf8")).not.toContain("sk-e2e-secret");
      expect(row.keyIv).toHaveLength(12);
      expect(row.keyTag).toHaveLength(16);

      // …and it round-trips back to exactly what was submitted.
      // in-process: expect(app.get(CredentialCryptoService).decrypt({ ciphertext: row.encryptedKey, iv: row.keyIv, tag: row.keyTag })).toBe(API_KEY);
    });

    test("[EP] a duplicate label → 409", async () => {
      const label = uniqueLabel();
      track(await create({ label }));
      const res = await create({ label });
      expect(res.status).toBe(409);
    });

    test("[BVA] apiKey length 19 (min-1) → 400, 20 (min) → 201", async () => {
      expect((await create({ apiKey: "x".repeat(19) })).status).toBe(400);
      expect(track(await create({ apiKey: "x".repeat(20) })).status).toBe(201);
    });

    test("[BVA] apiKey length 400 (max) → 201, 401 (max+1) → 400", async () => {
      expect(track(await create({ apiKey: "x".repeat(400) })).status).toBe(201);
      expect((await create({ apiKey: "x".repeat(401) })).status).toBe(400);
    });

    test("[BVA] label length 0 → 400, 1 → 201, 60 → 201, 61 → 400", async () => {
      expect((await create({ label: "" })).status).toBe(400);
      expect(track(await create({ label: randomUUID().slice(0, 1) })).status).toBe(201);
      expect(track(await create({ label: "a".repeat(60) })).status).toBe(201);
      expect((await create({ label: "b".repeat(61) })).status).toBe(400);
    });

    test("[EP] whitespace inside the key → 400", async () => {
      expect((await create({ apiKey: "sk-with a space 1234567890" })).status).toBe(400);
      expect((await create({ apiKey: "   ".padEnd(25, " ") })).status).toBe(400);
    });

    test("[EP] an unknown provider → 400", async () => {
      expect((await create({ provider: "anthropic" })).status).toBe(400);
    });

    test("[EP] a blank model override is stored as null, not an empty string", async () => {
      const res = track(await create({ chatModel: "  ", embedModel: "" }));
      expect(res.status).toBe(201);
      const body = res.body as CredentialBody;
      expect(body.chatModel).toBeNull();
      expect(body.embedModel).toBeNull();
    });

    test("[EP] a real override is trimmed and kept", async () => {
      const res = track(await create({ chatModel: "  gpt-4o  " }));
      expect(res.status).toBe(201);
      expect((res.body as CredentialBody).chatModel).toBe("gpt-4o");
    });
  });

  test.describe("PATCH /ai-credentials/:id", () => {
    let create: (over?: Record<string, unknown>) => Promise<HttpResponse>;
    let patch: (id: string, options: CallOptions) => Promise<HttpResponse>;

    test.beforeAll(async ({ http }) => {
      create = (over = {}) =>
        http(cookie).post(BASE, {
          data: { provider: "openrouter", label: uniqueLabel(), apiKey: API_KEY, ...over },
        });
      patch = (id, options) => http(cookie).patch(`${BASE}/${id}`, options);
    });

    // FIXME(migrated): needs AiService (FakeAiService.ping) injected in-process; over HTTP POST /:id/test would call the real OpenRouter. Decide in /write-tests ai-credentials.
    test.fixme("[ST] rotating the key updates keyLast4 and clears the test verdict", async ({ http }) => {
      const created = track(await create());
      const { id } = created.body as CredentialBody;

      await http(cookie).post(`${BASE}/${id}/test`);
      const tested = await http(cookie).get(BASE);
      expect((tested.body as CredentialBody[]).find((c) => c.id === id)?.lastTestStatus).not.toBeNull();

      const res = await patch(id, { data: { apiKey: "sk-rotated-key-abcdefgh4321" } });

      expect(res.status).toBe(200);
      const body = res.body as CredentialBody;
      expect(body.keyLast4).toBe("4321");
      expect(body.lastTestStatus).toBeNull();
      expect(body.lastTestedAt).toBeNull();
    });

    // FIXME(migrated): needs AiService (FakeAiService.ping) injected in-process; over HTTP POST /:id/test would call the real OpenRouter. Decide in /write-tests ai-credentials.
    test.fixme("[EP] renaming alone keeps the test verdict", async ({ http }) => {
      const created = track(await create());
      const { id } = created.body as CredentialBody;
      await http(cookie).post(`${BASE}/${id}/test`);

      const res = await patch(id, { data: { label: uniqueLabel() } });

      expect(res.status).toBe(200);
      expect((res.body as CredentialBody).lastTestStatus).not.toBeNull();
    });

    test("[ST] sending a blank model clears an existing override", async () => {
      const created = track(await create({ chatModel: "gpt-4o" }));
      const { id } = created.body as CredentialBody;
      expect((created.body as CredentialBody).chatModel).toBe("gpt-4o");

      // This is exactly what the edit dialog sends for an empty field, so a
      // 400 here would break every save from the UI.
      const res = await patch(id, { data: { chatModel: "", embedModel: "" } });

      expect(res.status).toBe(200);
      expect((res.body as CredentialBody).chatModel).toBeNull();
    });

    test("[EP] provider is immutable — the field is stripped, not honoured", async () => {
      const created = track(await create());
      const { id } = created.body as CredentialBody;

      const res = await patch(id, { data: { provider: "gemini" } });

      expect(res.status).toBe(200);
      expect((res.body as CredentialBody).provider).toBe("openrouter");
    });

    test("[EP] a duplicate label → 409", async () => {
      const first = track(await create());
      const second = track(await create());
      const res = await patch((second.body as CredentialBody).id, {
        data: { label: (first.body as CredentialBody).label },
      });
      expect(res.status).toBe(409);
    });
  });

  test.describe("POST /ai-credentials/:id/test", () => {
    // FIXME(migrated): needs AiService (FakeAiService.ping → chat ok / embed model_unavailable) injected in-process; over HTTP this would call the real OpenRouter. Decide in /write-tests ai-credentials.
    test.fixme("[EP] reports chat and embed separately and stores the worse of the two", async ({ http }) => {
      const created = track(
        await http(cookie).post(BASE, { data: { provider: "openrouter", label: uniqueLabel(), apiKey: API_KEY } })
      );
      const { id } = created.body as CredentialBody;

      const res = await http(cookie).post(`${BASE}/${id}/test`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        chat: "ok",
        embed: "model_unavailable",
        status: "model_unavailable",
      });

      const row = (await findAiCredential(id))!;
      expect(row.lastTestStatus).toBe("model_unavailable");
      expect(row.lastTestedAt).not.toBeNull();
    });
  });

  test.describe("GET /ai-credentials", () => {
    test("[EP] lists newest-first and leaks no secret material", async ({ http }) => {
      track(
        await http(cookie).post(BASE, { data: { provider: "openrouter", label: uniqueLabel(), apiKey: API_KEY } })
      );
      const res = await http(cookie).get(BASE);

      expect(res.status).toBe(200);
      const body = res.body as CredentialBody[];
      expect(body.length).toBeGreaterThan(0);
      const timestamps = body.map((c) => Date.parse(c.createdAt));
      expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
      expect(JSON.stringify(body)).not.toContain("sk-e2e-secret");
    });
  });

  test.describe("DELETE /ai-credentials/:id", () => {
    const create = (http: HttpFactory) =>
      http(cookie).post(BASE, { data: { provider: "openrouter", label: uniqueLabel(), apiKey: API_KEY } });

    test("[ST] deleting → 204, and the id is then unknown", async ({ http }) => {
      const created = track(await create(http));
      const { id } = created.body as CredentialBody;

      expect((await http(cookie).delete(`${BASE}/${id}`)).status).toBe(204);
      expect((await http(cookie).patch(`${BASE}/${id}`, { data: { label: uniqueLabel() } })).status).toBe(404);
    });

    test("[ST] deleting keeps past match results readable via their snapshot", async ({ http }) => {
      const created = track(await create(http));
      const { id } = created.body as CredentialBody;

      const cvId = await insertDocument({
        userId,
        kind: "CV",
        title: "e2e cred cv",
        sourceFormat: "text",
        rawText: "cv text",
      });
      const jdId = await insertDocument({
        userId,
        kind: "JD",
        title: "e2e cred jd",
        sourceFormat: "text",
        rawText: "jd text",
      });
      const matchId = await insertMatchResult({
        userId,
        cvDocumentId: cvId,
        jdDocumentId: jdId,
        credentialId: id,
        provider: "gemini",
        chatModel: "gemini-2.5-flash",
        embedModel: "gemini-embedding-001",
        scores: [50, 50, 50],
        report: { strengths: [], gaps: [], suggestions: [] },
      });

      try {
        await http(cookie).delete(`${BASE}/${id}`);

        const after = (await findMatchResult(matchId))!;
        expect(after.credentialId).toBeNull();
        expect(after.provider).toBe("gemini");
        expect(after.chatModel).toBe("gemini-2.5-flash");
      } finally {
        await deleteMatchResults([matchId]);
        await deleteDocuments([cvId, jdId]);
      }
    });
  });

  test.describe("per-user isolation", () => {
    // The FE cannot cover this: only one mock user exists there. This is the
    // only place the ownership scope is actually exercised.
    let otherUserId: string;
    let othersCredentialId: string;

    test.beforeAll(async () => {
      otherUserId = await createUser();
      // The in-process suite encrypted API_KEY with its own key. These cases only prove the row is unreachable, which
      // never decrypts it, so opaque bytes of the right shape stand in for the ciphertext.
      othersCredentialId = await insertAiCredential({
        userId: otherUserId,
        provider: "openai",
        label: "belongs to someone else",
        encryptedKey: randomBytes(32),
        keyIv: randomBytes(12),
        keyTag: randomBytes(16),
        keyLast4: "9876",
      });
    });

    test.afterAll(async () => {
      await deleteUsers([otherUserId]);
    });

    test("[authz] another user's credential is absent from the list", async ({ http }) => {
      const res = await http(cookie).get(BASE);
      expect((res.body as CredentialBody[]).some((c) => c.id === othersCredentialId)).toBe(false);
    });

    test("[authz] PATCH / DELETE / test on it → 404, never 403", async ({ http }) => {
      expect(
        (await http(cookie).patch(`${BASE}/${othersCredentialId}`, { data: { label: uniqueLabel() } })).status
      ).toBe(404);
      expect((await http(cookie).post(`${BASE}/${othersCredentialId}/test`)).status).toBe(404);
      expect((await http(cookie).delete(`${BASE}/${othersCredentialId}`)).status).toBe(404);
    });

    test("[authz] the 404 does not confirm the row exists", async ({ http }) => {
      const res = await http(cookie).patch(`${BASE}/${randomUUID()}`, { data: { label: uniqueLabel() } });
      const other = await http(cookie).patch(`${BASE}/${othersCredentialId}`, { data: { label: uniqueLabel() } });
      expect(res.status).toBe(other.status);
    });

    test("[authz] running a match with another user's credential → 404", async ({ http }) => {
      const res = await http(cookie).post("/match", {
        data: {
          cvDocumentId: randomUUID(),
          jdDocumentId: randomUUID(),
          credentialId: othersCredentialId,
        },
      });
      // The document check runs first and already rejects; either way the
      // caller learns nothing about the credential.
      expect([400, 404]).toContain(res.status);
    });
  });

  test.describe("when CREDENTIAL_ENCRYPTION_KEY is absent", () => {
    // FIXME(migrated): needs CredentialCryptoService (UnconfiguredCryptoService, isConfigured() = false) injected in-process; over HTTP the real server has a key configured. Decide in /write-tests ai-credentials.
    test.fixme("[EP] every endpoint that touches a key → 503", async ({ http }) => {
      expect((await http(cookie).get(BASE)).status).toBe(503);
      expect(
        (await http(cookie).post(BASE, { data: { provider: "openrouter", label: "x", apiKey: API_KEY } })).status
      ).toBe(503);
    });

    // FIXME(migrated): needs CredentialCryptoService (UnconfiguredCryptoService, isConfigured() = false) injected in-process; over HTTP the real server has a key configured. Decide in /write-tests ai-credentials.
    test.fixme("[EP] listing providers still works — it needs no key", async ({ http }) => {
      const res = await http(cookie).get(`${BASE}/providers`);
      expect(res.status).toBe(200);
      expect((res.body as ProviderBody[]).length).toBe(3);
    });
  });
});
