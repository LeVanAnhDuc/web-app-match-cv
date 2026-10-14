import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import type { ApiClient } from "@/api";
import { serverMessage } from "@/data/copy";
import { MPC_TEXT } from "@/data/test-data/multi-provider-compare";
import { insertMatchResult, insertMatchRun } from "@/utils/db";
import { createGuestUser, createSignedInUser, createUser, deleteUsers, type SeededUser } from "@/utils/sessions";

// POST /match/runs (opens a run, no AI call) and GET /match/runs/:id (reads it back). Results under a run can only be
// written by POST /match, which calls the provider, so stored results are inserted in the DB (D1).

test.describe("match runs", () => {
  let owner: SeededUser;
  let client: ApiClient;
  let otherUserId: string;
  let cvId: string;
  let jdId: string;

  test.beforeAll(async ({ apiAs }) => {
    owner = await createSignedInUser();
    otherUserId = await createUser();
    client = apiAs(owner);
    cvId = (await client.documents.create({ kind: "CV", sourceText: MPC_TEXT.cv, save: false })).json().id;
    jdId = (await client.documents.create({ kind: "JD", sourceText: MPC_TEXT.jd, save: false })).json().id;
  });

  test.afterAll(async () => {
    // Cascades documents, runs and results of both users.
    await deleteUsers([owner.userId, otherUserId]);
  });

  test.describe("POST /match/runs", () => {
    test("mở run cho cặp CV/JD của mình", { tag: ["@TC-MULTIPROVIDERCOMPARE-001", "@smoke"] }, async () => {
      const res = await client.match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId });

      expect(res.status).toBe(201);
      const run = res.json();
      expect(run).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        cvDocumentId: cvId,
        jdDocumentId: jdId,
        createdAt: expect.any(String),
      });
      expect(Number.isNaN(Date.parse(run.createdAt))).toBe(false);
    });

    test("id tài liệu không phải UUID hoặc thiếu thì trả 400", { tag: ["@TC-MULTIPROVIDERCOMPARE-002"] }, async () => {
      for (const body of [
        { cvDocumentId: "not-a-uuid", jdDocumentId: jdId },
        { cvDocumentId: cvId, jdDocumentId: "123" },
        { cvDocumentId: cvId },
        {},
      ]) {
        const res = await client.match.createRun(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
    });

    test(
      "tài liệu không thuộc mình hoặc không tồn tại thì trả 400 documentNotOwned",
      { tag: ["@TC-MULTIPROVIDERCOMPARE-003", "@smoke"] },
      async ({ apiAs }) => {
        const stranger = await createSignedInUser();
        try {
          const theirs = (await apiAs(stranger).documents.create({ kind: "CV", sourceText: MPC_TEXT.cv, save: false }))
            .json().id;
          for (const body of [
            { cvDocumentId: theirs, jdDocumentId: jdId },
            { cvDocumentId: randomUUID(), jdDocumentId: jdId },
            { cvDocumentId: cvId, jdDocumentId: randomUUID() },
          ]) {
            const res = await client.match.createRun(body);
            expect(res.status).toBe(400);
            expect(res.error().message).toBe(serverMessage("matching.errors.documentNotOwned"));
          }
        } finally {
          await deleteUsers([stranger.userId]);
        }
      }
    );

    test("đảo loại CV/JD thì trả 400 invalidDocumentKind", { tag: ["@TC-MULTIPROVIDERCOMPARE-004"] }, async () => {
      const res = await client.match.createRun({ cvDocumentId: jdId, jdDocumentId: cvId });

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("matching.errors.invalidDocumentKind"));
    });

    test(
      "khách mở được run cho cặp tài liệu của mình",
      { tag: ["@TC-MULTIPROVIDERCOMPARE-005", "@creates-data"] },
      async ({ apiAs }) => {
        const guest = await createGuestUser();
        try {
          const guestApi = apiAs(guest);
          const guestCv = (await guestApi.documents.create({ kind: "CV", sourceText: MPC_TEXT.cv, save: false })).json().id;
          const guestJd = (await guestApi.documents.create({ kind: "JD", sourceText: MPC_TEXT.jd, save: false })).json().id;

          const res = await guestApi.match.createRun({ cvDocumentId: guestCv, jdDocumentId: guestJd });

          expect(res.status).toBe(201);
          expect(res.json()).toMatchObject({ cvDocumentId: guestCv, jdDocumentId: guestJd });
        } finally {
          await deleteUsers([guest.userId]);
        }
      }
    );
  });

  test.describe("GET /match/runs/:id", () => {
    test(
      "run mới đọc lại được với danh sách kết quả rỗng, không bị GET /match/:id nuốt",
      { tag: ["@TC-MULTIPROVIDERCOMPARE-006"] },
      async () => {
        const run = (await client.match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId })).json();

        const res = await client.match.getRun(run.id);

        // Were "runs" captured as a match id, ParseUUIDPipe would answer 400.
        expect(res.status).toBe(200);
        expect(res.json()).toEqual({ ...run, results: [] });
      }
    );

    test(
      "run đọc lại gồm mọi kết quả kể cả lần lỗi và lần thử lại, theo thời gian tăng dần",
      { tag: ["@TC-MULTIPROVIDERCOMPARE-007"] },
      async () => {
        const run = (await client.match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId })).json();
        const base = { userId: owner.userId, cvDocumentId: cvId, jdDocumentId: jdId, runId: run.id };
        const at = (s: number) => new Date(Date.now() - 60_000 + s * 1_000);
        // Inserted out of order on purpose: the read must sort by createdAt, not by insertion.
        const gemini = await insertMatchResult({ ...base, provider: "gemini", chatModel: "gemini-2.5-flash", scores: [70, 75, 62], createdAt: at(3) });
        const failed = await insertMatchResult({ ...base, status: "failed", errorCode: "timeout", scores: [0, 0, 0], createdAt: at(1) });
        const retried = await insertMatchResult({ ...base, scores: [81, 88, 70], createdAt: at(2) });

        const res = await client.match.getRun(run.id);

        expect(res.status).toBe(200);
        const results = res.json().results;
        expect(results.map((r) => r.id)).toEqual([failed, retried, gemini]);
        expect(results[0]).toMatchObject({ status: "failed", errorCode: "timeout", overallScore: 0, runId: run.id });
        expect(results[1]).toMatchObject({ status: "succeeded", errorCode: null, overallScore: 81, runId: run.id });
        expect(results[2]).toMatchObject({ provider: "gemini", chatModel: "gemini-2.5-flash", credentialId: null });
      }
    );

    test(
      "run của người khác hoặc không tồn tại trả 404 runNotFound",
      { tag: ["@TC-MULTIPROVIDERCOMPARE-008", "@smoke"] },
      async () => {
        const foreign = await insertMatchRun({ userId: otherUserId, cvDocumentId: cvId, jdDocumentId: jdId });

        for (const id of [foreign, randomUUID()]) {
          const res = await client.match.getRun(id);
          expect(res.status).toBe(404);
          expect(res.error().message).toBe(serverMessage("matching.errors.runNotFound"));
        }
      }
    );

    test("id run không phải UUID trả 400", { tag: ["@TC-MULTIPROVIDERCOMPARE-009"] }, async () => {
      const res = await client.match.getRun("not-a-uuid");
      expect(res.status).toBe(400);
    });

    test(
      "kết quả cũ không có run vẫn đọc được với runId null và trạng thái succeeded",
      { tag: ["@TC-MULTIPROVIDERCOMPARE-010"] },
      async () => {
        const legacy = await insertMatchResult({
          userId: owner.userId,
          cvDocumentId: cvId,
          jdDocumentId: jdId,
          scores: [71, 80, 60],
        });

        const res = await client.match.get(legacy);

        expect(res.status).toBe(200);
        expect(res.json()).toMatchObject({ id: legacy, runId: null, status: "succeeded", errorCode: null, overallScore: 71 });
      }
    );

    test(
      "kết quả có đủ trường run và provider, không bao giờ chứa key",
      { tag: ["@TC-MULTIPROVIDERCOMPARE-011"] },
      async () => {
        const run = (await client.match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId })).json();
        const id = await insertMatchResult({
          userId: owner.userId,
          cvDocumentId: cvId,
          jdDocumentId: jdId,
          runId: run.id,
          provider: "openai",
          chatModel: "gpt-4o-mini",
          embedModel: "text-embedding-3-small",
        });

        const res = await client.match.get(id);

        expect(res.status).toBe(200);
        const body = res.json();
        expect(Object.keys(body).sort()).toEqual(
          [
            "id",
            "cvDocumentId",
            "jdDocumentId",
            "overallScore",
            "semanticScore",
            "keywordScore",
            "report",
            "credentialId",
            "runId",
            "status",
            "errorCode",
            "provider",
            "chatModel",
            "embedModel",
            "createdAt",
          ].sort()
        );
        expect(body).toMatchObject({ runId: run.id, provider: "openai", chatModel: "gpt-4o-mini", embedModel: "text-embedding-3-small" });
        expect(JSON.stringify(body)).not.toMatch(/apiKey|encryptedKey|keyIv|keyTag/i);
      }
    );

    test(
      "message lỗi của run trả tiếng Việt khi client chọn vi",
      { tag: ["@TC-MULTIPROVIDERCOMPARE-012"] },
      async () => {
        const vi = client.lang("vi");

        const missing = await vi.match.getRun(randomUUID());
        expect(missing.error().message).toBe(serverMessage("matching.errors.runNotFound", "vi"));

        const notOwned = await vi.match.createRun({ cvDocumentId: randomUUID(), jdDocumentId: jdId });
        expect(notOwned.error().message).toBe(serverMessage("matching.errors.documentNotOwned", "vi"));

        // Rejected before any provider call: the run is about another CV.
        const otherCv = (await client.documents.create({ kind: "CV", sourceText: "Another CV entirely.", save: false })).json().id;
        const run = (await client.match.createRun({ cvDocumentId: otherCv, jdDocumentId: jdId })).json();
        const mismatch = await vi.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId: run.id });
        expect(mismatch.status).toBe(400);
        expect(mismatch.error().message).toBe(serverMessage("matching.errors.runDocumentMismatch", "vi"));
      }
    );
  });
});
