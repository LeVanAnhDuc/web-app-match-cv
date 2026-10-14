import { randomUUID } from "node:crypto";
import { expect, test } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import { CV_TEXT, JD_TEXT } from "@/data/test-data/cv-jd-matching-wizard";
import { insertDocument, insertMatchResult, insertMatchRun, sql } from "@/utils/db";
import { createGuestUser, createSignedInUser, createUser, deleteUsers, type SeededUser } from "@/utils/sessions";

// POST /match, POST /match/runs, GET /match/runs/:id, GET /match/:id — every branch decided BEFORE the provider call
// (D1): validation, ownership, kinds, runs, guest rules, error hygiene, language. Results the GET cases read are seeded
// straight into the DB, never computed. Scoring itself is in live-scoring.api.ts (@live-ai).
//
// Each POST /match below must be rejected before any AI call; a regression that lets one through would reach the
// provider, which is exactly what these tests exist to catch.

const messageOf = (body: { message: string | string[] }) =>
  Array.isArray(body.message) ? body.message.join(" | ") : body.message;

let owner: SeededUser;
let otherUserId: string;
let cvId: string;
let jdId: string;
let otherCvId: string;
let foreignCvId: string;
let foreignJdId: string;

test.beforeAll(async ({ apiAs }) => {
  owner = await createSignedInUser();
  const api = apiAs(owner);
  cvId = (await api.documents.create({ kind: "CV", save: false, sourceText: CV_TEXT })).json().id;
  jdId = (await api.documents.create({ kind: "JD", save: false, sourceText: JD_TEXT })).json().id;
  otherCvId = (await api.documents.create({ kind: "CV", save: false, sourceText: `${CV_TEXT} v2` })).json().id;

  otherUserId = await createUser();
  foreignCvId = await insertDocument({ userId: otherUserId, kind: "CV", title: "Foreign CV", rawText: CV_TEXT });
  foreignJdId = await insertDocument({ userId: otherUserId, kind: "JD", title: "Foreign JD", rawText: JD_TEXT });
});

test.afterAll(async () => {
  await deleteUsers([owner.userId, otherUserId]);
});

test.describe("POST /match — rejected before the provider", () => {
  test(
    "thiếu field hoặc id không phải UUID trả 400",
    { tag: ["@TC-CVJDMATCHINGWIZARD-057"] },
    async ({ apiAs }) => {
      for (const body of [
        {},
        { cvDocumentId: cvId },
        { jdDocumentId: jdId },
        { cvDocumentId: "not-a-uuid", jdDocumentId: jdId },
        { cvDocumentId: cvId, jdDocumentId: jdId, runId: "abc" },
        { cvDocumentId: cvId, jdDocumentId: jdId, credentialId: "abc" },
      ]) {
        const res = await apiAs(owner).match.create(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
    }
  );

  test(
    "tài liệu của user khác hoặc không tồn tại trả cùng documentNotOwned",
    { tag: ["@TC-CVJDMATCHINGWIZARD-058", "@smoke"] },
    async ({ apiAs }) => {
      const foreign = await apiAs(owner).match.create({ cvDocumentId: foreignCvId, jdDocumentId: jdId });
      const missing = await apiAs(owner).match.create({ cvDocumentId: randomUUID(), jdDocumentId: jdId });
      const foreignJd = await apiAs(owner).match.create({ cvDocumentId: cvId, jdDocumentId: foreignJdId });

      for (const res of [foreign, missing, foreignJd]) {
        expect(res.status).toBe(400);
        expect(messageOf(res.error())).toBe(serverMessage("matching.errors.documentNotOwned"));
      }
      // Same answer either way: the caller cannot tell "someone else's" from "does not exist".
      expect(foreign.text).toBe(missing.text);
    }
  );

  test(
    "đảo kind CV/JD trả invalidDocumentKind",
    { tag: ["@TC-CVJDMATCHINGWIZARD-059"] },
    async ({ apiAs }) => {
      const res = await apiAs(owner).match.create({ cvDocumentId: jdId, jdDocumentId: cvId });
      expect(res.status).toBe(400);
      expect(messageOf(res.error())).toBe(serverMessage("matching.errors.invalidDocumentKind"));
    }
  );

  test(
    "runId lạ trả runNotFound, runId của cặp khác trả runDocumentMismatch",
    { tag: ["@TC-CVJDMATCHINGWIZARD-060"] },
    async ({ apiAs }) => {
      const api = apiAs(owner);
      const foreignRun = await insertMatchRun({ userId: otherUserId, cvDocumentId: foreignCvId, jdDocumentId: foreignJdId });
      for (const runId of [randomUUID(), foreignRun]) {
        const res = await api.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId });
        expect(res.status, runId).toBe(404);
        expect(messageOf(res.error())).toBe(serverMessage("matching.errors.runNotFound"));
      }

      const otherPairRun = await api.match.createRun({ cvDocumentId: otherCvId, jdDocumentId: jdId });
      expect(otherPairRun.status).toBe(201);
      const mismatch = await api.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId: otherPairRun.json().id });
      expect(mismatch.status).toBe(400);
      expect(messageOf(mismatch.error())).toBe(serverMessage("matching.errors.runDocumentMismatch"));
    }
  );
});

test.describe("match runs", () => {
  test(
    "mở run trả 201 không gọi AI và đọc lại được run rỗng",
    { tag: ["@TC-CVJDMATCHINGWIZARD-061"] },
    async ({ apiAs }) => {
      const created = await apiAs(owner).match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId });
      expect(created.status).toBe(201);
      const run = created.json();
      expect(run).toMatchObject({ id: expect.any(String), cvDocumentId: cvId, jdDocumentId: jdId, createdAt: expect.any(String) });

      const [{ n }] = await sql<{ n: number }>(`SELECT count(*)::int AS n FROM "MatchResult" WHERE "runId" = $1`, [run.id]);
      expect(n).toBe(0);

      const detail = await apiAs(owner).match.getRun(run.id);
      expect(detail.status).toBe(200);
      expect(detail.json()).toMatchObject({ id: run.id, cvDocumentId: cvId, jdDocumentId: jdId, results: [] });
    }
  );

  test(
    "mở run kiểm sở hữu và kind như POST /match",
    { tag: ["@TC-CVJDMATCHINGWIZARD-062"] },
    async ({ apiAs }) => {
      const api = apiAs(owner);
      const foreign = await api.match.createRun({ cvDocumentId: foreignCvId, jdDocumentId: jdId });
      expect(foreign.status).toBe(400);
      expect(messageOf(foreign.error())).toBe(serverMessage("matching.errors.documentNotOwned"));

      const swapped = await api.match.createRun({ cvDocumentId: jdId, jdDocumentId: cvId });
      expect(swapped.status).toBe(400);
      expect(messageOf(swapped.error())).toBe(serverMessage("matching.errors.invalidDocumentKind"));

      for (const body of [{ cvDocumentId: cvId }, { cvDocumentId: "x", jdDocumentId: jdId }]) {
        expect((await api.match.createRun(body)).status, JSON.stringify(body)).toBe(400);
      }
    }
  );

  test(
    "run của user khác hoặc không tồn tại trả 404",
    { tag: ["@TC-CVJDMATCHINGWIZARD-063", "@smoke"] },
    async ({ apiAs }) => {
      const foreignRun = await insertMatchRun({ userId: otherUserId, cvDocumentId: foreignCvId, jdDocumentId: foreignJdId });
      for (const id of [foreignRun, randomUUID()]) {
        const res = await apiAs(owner).match.getRun(id);
        expect(res.status, id).toBe(404);
        expect(messageOf(res.error())).toBe(serverMessage("matching.errors.runNotFound"));
      }
      expect((await apiAs(owner).match.getRun("not-a-uuid")).status).toBe(400);
    }
  );
});

test.describe("GET /match/:id", () => {
  test(
    "GET /match/:id trả kết quả của mình",
    { tag: ["@TC-CVJDMATCHINGWIZARD-064"] },
    async ({ apiAs }) => {
      const report = { strengths: ["Relevant NestJS work"], gaps: ["No GraphQL"], suggestions: ["Quantify impact"] };
      const id = await insertMatchResult({ userId: owner.userId, cvDocumentId: cvId, jdDocumentId: jdId, scores: [70, 75, 63], report });

      const res = await apiAs(owner).match.get(id);
      expect(res.status).toBe(200);
      expect(res.json()).toMatchObject({
        id,
        cvDocumentId: cvId,
        jdDocumentId: jdId,
        overallScore: 70,
        semanticScore: 75,
        keywordScore: 63,
        report,
        credentialId: null,
        status: "succeeded",
        errorCode: null,
      });
    }
  );

  test(
    "kết quả của user khác hoặc không tồn tại trả matchNotFound, id sai định dạng trả 400",
    { tag: ["@TC-CVJDMATCHINGWIZARD-065", "@smoke"] },
    async ({ apiAs }) => {
      const foreign = await insertMatchResult({ userId: otherUserId, cvDocumentId: foreignCvId, jdDocumentId: foreignJdId });
      for (const id of [foreign, randomUUID()]) {
        const res = await apiAs(owner).match.get(id);
        expect(res.status, id).toBe(404);
        expect(messageOf(res.error())).toBe(serverMessage("matching.errors.matchNotFound"));
      }
      expect((await apiAs(owner).match.get("not-a-uuid")).status).toBe(400);
    }
  );

  test(
    "kết quả giữ provider/model của chính row và không lộ khoá AI",
    { tag: ["@TC-CVJDMATCHINGWIZARD-066"] },
    async ({ apiAs }) => {
      const id = await insertMatchResult({
        userId: owner.userId,
        cvDocumentId: cvId,
        jdDocumentId: jdId,
        provider: "gemini",
        chatModel: "gemini-2.0-flash",
        embedModel: "text-embedding-004",
      });

      const res = await apiAs(owner).match.get(id);
      expect(res.status).toBe(200);
      expect(res.json()).toMatchObject({ provider: "gemini", chatModel: "gemini-2.0-flash", embedModel: "text-embedding-004" });
      expect(res.text).not.toMatch(/apiKey|encryptedKey|keyIv|keyTag|sk-or-|sk-[A-Za-z0-9]{10}/);
    }
  );
});

test.describe("guest, anonymous, hygiene, language", () => {
  test(
    "khách gửi credentialId bị 403, ẩn danh bị 401",
    { tag: ["@TC-CVJDMATCHINGWIZARD-067"] },
    async ({ apiAs, anonApi }) => {
      const guest = await createGuestUser();
      try {
        // The credential check comes first for a guest, before quota and ownership: no guest quota is spent.
        const forbidden = await apiAs(guest).match.create({
          cvDocumentId: randomUUID(),
          jdDocumentId: randomUUID(),
          credentialId: randomUUID(),
        });
        expect(forbidden.status).toBe(403);
        expect(forbidden.error().code).toBe("GUEST_FORBIDDEN_CREDENTIAL");
        expect(messageOf(forbidden.error())).toBe(serverMessage("matching.errors.guestCredential"));
      } finally {
        await deleteUsers([guest.userId]);
      }

      const anonymous = await anonApi.match.create({ cvDocumentId: cvId, jdDocumentId: jdId });
      expect(anonymous.status).toBe(401);
      expect(anonymous.error().code).toBe("SIGN_IN_REQUIRED");
      expect((await anonApi.match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId })).status).toBe(401);
    }
  );

  test(
    "lỗi trả về không lộ stack trace hay SQL",
    { tag: ["@TC-CVJDMATCHINGWIZARD-068"] },
    async ({ apiAs, anonApi }) => {
      const api = apiAs(owner);
      const responses = [
        await api.match.create({ cvDocumentId: "x' OR 1=1 --", jdDocumentId: jdId }),
        await api.match.create({ cvDocumentId: foreignCvId, jdDocumentId: jdId }),
        await api.match.get(randomUUID()),
        await api.match.getRun("not-a-uuid"),
        await api.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId: randomUUID() }),
        await anonApi.match.create({ cvDocumentId: cvId, jdDocumentId: jdId }),
      ];
      for (const res of responses) {
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
        expect(res.text).not.toMatch(/"stack"|\bat [\w.<>]+ \(|prisma|\bSELECT\b|\bINSERT\b|"MatchResult"|"Document"|node_modules/i);
      }
    }
  );

  test(
    "lỗi matching trả tiếng Việt khi request tiếng Việt",
    { tag: ["@TC-CVJDMATCHINGWIZARD-069"] },
    async ({ apiAs }) => {
      const vi = apiAs(owner).lang("vi");
      const notOwned = await vi.match.create({ cvDocumentId: foreignCvId, jdDocumentId: jdId });
      expect(messageOf(notOwned.error())).toBe(serverMessage("matching.errors.documentNotOwned", "vi"));

      const kind = await vi.match.createRun({ cvDocumentId: jdId, jdDocumentId: cvId });
      expect(messageOf(kind.error())).toBe(serverMessage("matching.errors.invalidDocumentKind", "vi"));

      const notFound = await apiAs(owner).match.get(randomUUID(), { params: { lang: "vi" } });
      expect(messageOf(notFound.error())).toBe(serverMessage("matching.errors.matchNotFound", "vi"));
    }
  );
});
