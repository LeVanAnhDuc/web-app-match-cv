import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import type { ApiClient } from "@/api";
import { serverMessage } from "@/data/copy";
import { fakeApiKey, credentialLabel, MPC_TEXT } from "@/data/test-data/multi-provider-compare";
import { insertMatchRun } from "@/utils/db";
import { createGuestUser, createSignedInUser, createUser, deleteUsers, type SeededUser } from "@/utils/sessions";

// POST /match with a runId / credentialId: every branch the server decides BEFORE calling the provider (D1). Each
// request here must be rejected — one that passed every check would reach a paid provider. "No result was created" is
// read from GET /match (the caller's own history), so other users' traffic cannot skew it.

test.describe("POST /match — checks before the provider call", () => {
  let owner: SeededUser;
  let client: ApiClient;
  let otherUserId: string;
  let cvId: string;
  let jdId: string;
  let runId: string;

  const historySize = async () => (await client.match.list()).json().length;

  test.beforeAll(async ({ apiAs }) => {
    owner = await createSignedInUser();
    otherUserId = await createUser();
    client = apiAs(owner);
    cvId = (await client.documents.create({ kind: "CV", sourceText: MPC_TEXT.cv, save: false })).json().id;
    jdId = (await client.documents.create({ kind: "JD", sourceText: MPC_TEXT.jd, save: false })).json().id;
    runId = (await client.match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId })).json().id;
  });

  test.afterAll(async () => {
    await deleteUsers([owner.userId, otherUserId]);
  });

  test("runId hoặc credentialId không phải UUID trả 400", { tag: ["@TC-MULTIPROVIDERCOMPARE-013"] }, async () => {
    const before = await historySize();

    for (const extra of [{ runId: "run-1" }, { credentialId: "cred-1" }, { runId: 42 }, { credentialId: "" }]) {
      const res = await client.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(400);
    }
    expect(await historySize()).toBe(before);
  });

  test(
    "tài liệu được kiểm trước run: tài liệu lạ kèm runId lạ trả 400 documentNotOwned",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-014"] },
    async () => {
      const res = await client.match.create({ cvDocumentId: randomUUID(), jdDocumentId: jdId, runId: randomUUID() });

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("matching.errors.documentNotOwned"));
    }
  );

  test(
    "runId của người khác hoặc không tồn tại trả 404 runNotFound và không tạo kết quả",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-015", "@smoke"] },
    async () => {
      const foreign = await insertMatchRun({ userId: otherUserId, cvDocumentId: cvId, jdDocumentId: jdId });
      const before = await historySize();

      for (const id of [foreign, randomUUID()]) {
        const res = await client.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId: id });
        expect(res.status).toBe(404);
        expect(res.error().message).toBe(serverMessage("matching.errors.runNotFound"));
      }
      expect(await historySize()).toBe(before);
    }
  );

  test(
    "runId của cặp tài liệu khác trả 400 runDocumentMismatch và không tạo kết quả",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-016"] },
    async () => {
      const otherCv = (await client.documents.create({ kind: "CV", sourceText: "Another CV entirely.", save: false })).json().id;
      const otherRun = (await client.match.createRun({ cvDocumentId: otherCv, jdDocumentId: jdId })).json().id;
      const before = await historySize();

      const res = await client.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId: otherRun });

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("matching.errors.runDocumentMismatch"));
      expect(await historySize()).toBe(before);
    }
  );

  test(
    "credentialId của người khác trả 404 Credential not found và không tạo kết quả",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-017", "@smoke"] },
    async ({ apiAs }) => {
      const stranger = await createSignedInUser();
      try {
        const created = await apiAs(stranger).aiCredentials.create({
          provider: "openrouter",
          label: credentialLabel("stranger"),
          apiKey: fakeApiKey(),
        });
        expect(created.status).toBe(201);
        const before = await historySize();

        for (const credentialId of [created.json().id, randomUUID()]) {
          const res = await client.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId, credentialId });
          expect(res.status).toBe(404);
          expect(res.error().message).toBe(serverMessage("aiCredentials.errors.notFound"));
        }
        expect(await historySize()).toBe(before);
      } finally {
        await deleteUsers([stranger.userId]);
      }
    }
  );

  test(
    "khách gửi credentialId bị từ chối 403 GUEST_FORBIDDEN_CREDENTIAL",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-018", "@creates-data"] },
    async ({ apiAs }) => {
      const guest = await createGuestUser();
      try {
        const guestApi = apiAs(guest);
        const guestCv = (await guestApi.documents.create({ kind: "CV", sourceText: MPC_TEXT.cv, save: false })).json().id;
        const guestJd = (await guestApi.documents.create({ kind: "JD", sourceText: MPC_TEXT.jd, save: false })).json().id;

        const res = await guestApi.match.create({ cvDocumentId: guestCv, jdDocumentId: guestJd, credentialId: randomUUID() });

        expect(res.status).toBe(403);
        expect(res.error()).toMatchObject({
          code: "GUEST_FORBIDDEN_CREDENTIAL",
          message: serverMessage("matching.errors.guestCredential"),
        });
      } finally {
        await deleteUsers([guest.userId]);
      }
    }
  );
});
