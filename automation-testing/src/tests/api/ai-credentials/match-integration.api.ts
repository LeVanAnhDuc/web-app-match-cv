import { randomUUID } from "node:crypto";
import type { ApiClient } from "@/api";
import { serverMessage } from "@/data/copy";
import {
  FAKE_KEY,
  KEY_PREFIX,
  WIZARD_CV_TEXT,
  WIZARD_JD_TEXT,
  providerInfo,
  uniqueLabel,
} from "@/data/test-data/ai-credentials";
import type { SeededUser } from "@/utils/sessions";
import { expect, test } from "@/fixtures";

// POST /match with a credential (REQ-AICREDENTIALS-38, -39, -03, -19).
//   - live, no provider: the 404 / 400 / 403 that come before the engine runs;
//   - @live-ai: one match on a bogus key, so the provider answers 401 (free) and the result is recorded as failed —
//     which is exactly the case the snapshot and lastUsedAt rules must still hold for.
test.describe.configure({ timeout: 120_000 });

test.describe("ai-credentials — matching with a credential", () => {
  let user: SeededUser;
  let api: ApiClient;
  let cvId: string;
  let jdId: string;

  test.beforeAll(async ({ aiCredData, apiAs }) => {
    user = await aiCredData.createSignedInUser();
    api = apiAs(user);
    const jd = await api.documents.create({ kind: "JD", save: false, sourceText: WIZARD_JD_TEXT });
    const cv = await api.documents.create({ kind: "CV", save: false, sourceText: WIZARD_CV_TEXT });
    expect(jd.status).toBe(201);
    expect(cv.status).toBe(201);
    jdId = (jd.body as { id: string }).id;
    cvId = (cv.body as { id: string }).id;
  });

  test.afterAll(async ({ aiCredData }) => {
    await aiCredData.deleteUsers([user.userId]);
  });

  test(
    "/match với credential của user khác trả 404 và không tạo kết quả",
    { tag: ["@TC-AICREDENTIALS-053", "@smoke"] },
    async ({ aiCredData }) => {
      const otherUserId = await aiCredData.createUser();
      try {
        const foreignId = await aiCredData.insertForeignCredential(otherUserId);
        const before = await aiCredData.countMatchResults(user.userId);

        const res = await api.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, credentialId: foreignId });

        expect(res.status).toBe(404);
        expect(res.error().message).toBe(serverMessage("aiCredentials.errors.notFound"));
        expect(await aiCredData.countMatchResults(user.userId)).toBe(before);
        expect(await aiCredData.lastUsedAt(foreignId)).toBeNull();
      } finally {
        await aiCredData.deleteUsers([otherUserId]);
      }
    }
  );

  test(
    "/match với credentialId không phải UUID trả 400",
    { tag: ["@TC-AICREDENTIALS-054"] },
    async ({ aiCredData }) => {
      const before = await aiCredData.countMatchResults(user.userId);
      const res = await api.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, credentialId: "not-a-uuid" });
      expect(res.status).toBe(400);
      expect(await aiCredData.countMatchResults(user.userId)).toBe(before);
    }
  );

  test(
    "khách gửi credentialId vào /match bị 403 GUEST_FORBIDDEN_CREDENTIAL",
    { tag: ["@TC-AICREDENTIALS-055"] },
    async ({ aiCredData, apiAs }) => {
      const guest = await aiCredData.createGuestUser();
      try {
        for (const lng of ["en", "vi"] as const) {
          // The guest check runs first: document ids do not even need to exist.
          const res = await apiAs(guest)
            .lang(lng)
            .match.create({ cvDocumentId: randomUUID(), jdDocumentId: randomUUID(), credentialId: randomUUID() });
          expect(res.status).toBe(403);
          expect(res.error().code).toBe("GUEST_FORBIDDEN_CREDENTIAL");
          expect(res.error().message).toBe(serverMessage("matching.errors.guestCredential", lng));
        }
        expect(await aiCredData.countMatchResults(guest.userId)).toBe(0);
      } finally {
        await aiCredData.deleteUsers([guest.userId]);
      }
    }
  );

  test(
    "chạy match bằng credential chụp provider và model, cập nhật lastUsedAt kể cả khi thất bại",
    { tag: ["@TC-AICREDENTIALS-052", "@live-ai"] },
    async ({ aiCredData }) => {
      // openai with a chat override and no embed override: the snapshot must hold the override AND the provider
      // default for the blank one.
      const created = await api.aiCredentials.create({
        provider: "openai",
        label: uniqueLabel("live match"),
        apiKey: FAKE_KEY,
        chatModel: "gpt-4o",
      });
      expect(created.status).toBe(201);
      const credentialId = created.json().id;
      const startedAt = Date.now();

      const res = await api.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, credentialId });

      expect(res.status).toBe(201);
      const result = res.json();
      expect(result).toMatchObject({
        credentialId,
        provider: "openai",
        chatModel: "gpt-4o",
        embedModel: providerInfo("openai").defaultEmbedModel,
        // The bogus key is refused by the provider: the card is recorded as failed, not thrown.
        status: "failed",
      });
      expect(result.errorCode).not.toBeNull();
      expect(res.text).not.toContain(FAKE_KEY);
      expect(res.text).not.toContain(KEY_PREFIX);

      const stored = await api.match.get(result.id);
      expect(stored.status).toBe(200);
      expect(stored.json()).toMatchObject({ credentialId, provider: "openai", chatModel: "gpt-4o" });

      const lastUsedAt = await aiCredData.lastUsedAt(credentialId);
      expect(lastUsedAt).not.toBeNull();
      const listed = (await api.aiCredentials.list()).json().find((c) => c.id === credentialId)!;
      expect(Date.parse(listed.lastUsedAt!)).toBeGreaterThanOrEqual(startedAt - 5_000);
    }
  );
});
