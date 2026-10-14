import type { ApiClient } from "@/api";
import { serverMessage } from "@/data/copy";
import {
  FAKE_KEY,
  FAKE_KEY_LAST4,
  KEY_MIN,
  LABEL_MAX,
  ROTATED_KEY,
  ROTATED_KEY_LAST4,
  uniqueLabel,
} from "@/data/test-data/ai-credentials";
import type { SeededUser } from "@/utils/sessions";
import { expect, test } from "@/fixtures";

// PATCH and DELETE /ai-credentials/:id (REQ-AICREDENTIALS-25, -26, -27, -28).
// A stored verdict is stamped straight into the row (aiCredData.setVerdict) instead of running POST /:id/test, which
// would reach the provider (D1). The server's reset rule only looks at which fields the PATCH carries, so a stamped
// verdict exercises exactly the same branch.

test.describe("ai-credentials — update and delete", () => {
  let user: SeededUser;
  let api: ApiClient;

  test.beforeAll(async ({ aiCredData, apiAs }) => {
    user = await aiCredData.createSignedInUser();
    api = apiAs(user);
  });

  test.afterAll(async ({ aiCredData }) => {
    await aiCredData.deleteUsers([user.userId]);
  });

  async function createOne(over: Record<string, unknown> = {}) {
    const res = await api.aiCredentials.create({ provider: "openrouter", label: uniqueLabel(), apiKey: FAKE_KEY, ...over });
    expect(res.status).toBe(201);
    return res.json();
  }

  test(
    "gửi model rỗng khi sửa xoá override về null",
    { tag: ["@TC-AICREDENTIALS-028"] },
    async () => {
      const created = await createOne({ chatModel: "gpt-4o", embedModel: "text-embedding-3-large" });

      // Exactly what the edit dialog sends for an emptied field.
      const res = await api.aiCredentials.update(created.id, { chatModel: "", embedModel: "  " });

      expect(res.status).toBe(200);
      expect(res.json().chatModel).toBeNull();
      expect(res.json().embedModel).toBeNull();
    }
  );

  test(
    "field provider gửi trong PATCH bị bỏ qua",
    { tag: ["@TC-AICREDENTIALS-029"] },
    async () => {
      const created = await createOne();
      const res = await api.aiCredentials.update(created.id, { provider: "gemini" });

      expect(res.status).toBe(200);
      expect(res.json().provider).toBe("openrouter");
      expect((await api.aiCredentials.list()).json().find((c) => c.id === created.id)?.provider).toBe("openrouter");
    }
  );

  test(
    "bỏ trống apiKey khi sửa giữ key cũ, gửi key mới thì mã hoá lại và keyLast4 đổi",
    { tag: ["@TC-AICREDENTIALS-030"] },
    async ({ aiCredData }) => {
      const created = await createOne();
      const before = (await aiCredData.findCredential(created.id))!;

      const renamed = await api.aiCredentials.update(created.id, { label: uniqueLabel("renamed") });
      expect(renamed.status).toBe(200);
      expect(renamed.json().keyLast4).toBe(FAKE_KEY_LAST4);
      expect((await aiCredData.findCredential(created.id))!.encryptedKey.equals(before.encryptedKey)).toBe(true);

      const rotated = await api.aiCredentials.update(created.id, { apiKey: ROTATED_KEY });
      expect(rotated.status).toBe(200);
      expect(rotated.json().keyLast4).toBe(ROTATED_KEY_LAST4);
      const after = (await aiCredData.findCredential(created.id))!;
      expect(after.encryptedKey.equals(before.encryptedKey)).toBe(false);
      expect(after.keyIv.equals(before.keyIv)).toBe(false);
    }
  );

  test(
    "PATCH kiểm apiKey và label theo cùng ràng buộc như khi tạo",
    { tag: ["@TC-AICREDENTIALS-031"] },
    async () => {
      const created = await createOne();
      for (const [what, body] of [
        ["key 19", { apiKey: "k".repeat(KEY_MIN - 1) }],
        ["key with space", { apiKey: "sk-with a space-1234567890" }],
        ["label empty", { label: "" }],
        ["label 61", { label: "l".repeat(LABEL_MAX + 1) }],
      ] as const) {
        expect((await api.aiCredentials.update(created.id, body)).status, what).toBe(400);
      }
      // Nothing was changed by the rejected calls.
      const row = (await api.aiCredentials.list()).json().find((c) => c.id === created.id)!;
      expect(row.label).toBe(created.label);
      expect(row.keyLast4).toBe(FAKE_KEY_LAST4);
    }
  );

  test(
    "đổi key hoặc model thì xoá kết quả kiểm tra, chỉ đổi tên thì giữ",
    { tag: ["@TC-AICREDENTIALS-032"] },
    async ({ aiCredData }) => {
      const testedAt = new Date(Date.now() - 5 * 60_000);
      const created = await createOne();

      // Rename only → verdict kept.
      await aiCredData.setVerdict(created.id, "ok", testedAt);
      const renamed = await api.aiCredentials.update(created.id, { label: uniqueLabel("kept") });
      expect(renamed.status).toBe(200);
      expect(renamed.json().lastTestStatus).toBe("ok");
      expect(renamed.json().lastTestedAt).not.toBeNull();

      // Each of key / chat model / embed model → verdict reset.
      for (const change of [{ apiKey: ROTATED_KEY }, { chatModel: "gpt-4o" }, { embedModel: "text-embedding-3-large" }]) {
        await aiCredData.setVerdict(created.id, "invalid_key", testedAt);
        const res = await api.aiCredentials.update(created.id, change);
        expect(res.status, JSON.stringify(change)).toBe(200);
        expect(res.json().lastTestStatus, JSON.stringify(change)).toBeNull();
        expect(res.json().lastTestedAt, JSON.stringify(change)).toBeNull();
      }
    }
  );

  test(
    "PATCH đổi sang tên đã dùng trả 409",
    { tag: ["@TC-AICREDENTIALS-084"] },
    async () => {
      const first = await createOne();
      const second = await createOne();

      const res = await api.aiCredentials.update(second.id, { label: first.label });

      expect(res.status).toBe(409);
      expect(res.error().message).toBe(serverMessage("aiCredentials.errors.labelTaken"));
    }
  );

  test(
    "DELETE trả 204, sau đó id không còn",
    { tag: ["@TC-AICREDENTIALS-037"] },
    async () => {
      const created = await createOne();

      const res = await api.aiCredentials.remove(created.id);
      expect(res.status).toBe(204);
      expect(res.raw.length).toBe(0);

      expect((await api.aiCredentials.list()).json().some((c) => c.id === created.id)).toBe(false);
      expect((await api.aiCredentials.update(created.id, { label: uniqueLabel() })).status).toBe(404);
      expect((await api.aiCredentials.remove(created.id)).status).toBe(404);
    }
  );

  test(
    "xoá credential giữ kết quả match cũ cùng snapshot provider và model",
    { tag: ["@TC-AICREDENTIALS-038"] },
    async ({ aiCredData }) => {
      const created = await createOne({ provider: "gemini" });
      const cvId = await aiCredData.insertDocument({
        userId: user.userId,
        kind: "CV",
        title: "ai-credentials snapshot cv",
        sourceFormat: "text",
        rawText: "cv text",
      });
      const jdId = await aiCredData.insertDocument({
        userId: user.userId,
        kind: "JD",
        title: "ai-credentials snapshot jd",
        sourceFormat: "text",
        rawText: "jd text",
      });
      const matchId = await aiCredData.insertMatchResult({
        userId: user.userId,
        cvDocumentId: cvId,
        jdDocumentId: jdId,
        credentialId: created.id,
        provider: "gemini",
        chatModel: "gemini-2.5-flash",
        embedModel: "gemini-embedding-001",
        scores: [61, 70, 48],
      });

      expect((await api.aiCredentials.remove(created.id)).status).toBe(204);

      const res = await api.match.get(matchId);
      expect(res.status).toBe(200);
      expect(res.json()).toMatchObject({
        id: matchId,
        credentialId: null,
        provider: "gemini",
        chatModel: "gemini-2.5-flash",
        embedModel: "gemini-embedding-001",
        overallScore: 61,
      });
    }
  );
});
