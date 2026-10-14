import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import type { ApiClient, ApiResponse } from "@/api";
import { serverMessage } from "@/data/copy";
import { GUEST_CV_TEXT } from "@/data/test-data/guest-mode";
import { FILES } from "@/data/test-data/shared";

// REQ-GUESTMODE-05 (what a guest may call) and REQ-GUESTMODE-06 (isolation). Every endpoint that reaches an AI
// provider is called here only where the guard or the ownership check answers first — no AI call in this file.

/** Every endpoint outside the wizard, as a guest would call it (bodies are irrelevant: the guard answers first). */
const SIGNED_IN_ONLY: Array<[string, (api: ApiClient) => Promise<ApiResponse<unknown>>]> = [
  ["GET /documents", (api) => api.documents.list()],
  ["PATCH /documents/:id", (api) => api.documents.rename(randomUUID(), "renamed")],
  ["PATCH /documents/:id/parent", (api) => api.documents.setParent(randomUUID(), null)],
  ["DELETE /documents/:id", (api) => api.documents.remove(randomUUID())],
  ["GET /match", (api) => api.match.list()],
  ["GET /ai-credentials/providers", (api) => api.aiCredentials.providers()],
  ["GET /ai-credentials", (api) => api.aiCredentials.list()],
  ["POST /ai-credentials", (api) => api.aiCredentials.create({})],
  ["PATCH /ai-credentials/:id", (api) => api.aiCredentials.update(randomUUID(), {})],
  ["DELETE /ai-credentials/:id", (api) => api.aiCredentials.remove(randomUUID())],
  ["POST /ai-credentials/:id/test", (api) => api.aiCredentials.test(randomUUID())],
  ["POST /cover-letters", (api) => api.coverLetters.generate({})],
  ["GET /cover-letters", (api) => api.coverLetters.list(randomUUID())],
  ["PATCH /cover-letters/:id", (api) => api.coverLetters.update(randomUUID(), "x")],
  ["DELETE /cover-letters/:id", (api) => api.coverLetters.remove(randomUUID())],
  ["POST /cv-rewrite", (api) => api.cvRewrite.generate({})],
  ["POST /cv-rewrite/accept", (api) => api.cvRewrite.accept({})],
  ["GET /comparisons/:documentId", (api) => api.comparisons.get(randomUUID())],
  ["GET /me/export", (api) => api.me.export()],
];

test.describe("guest access", () => {
  test(
    "Khách dùng được mọi endpoint của wizard",
    { tag: ["@TC-GUESTMODE-007", "@smoke"] },
    async ({ apiAs, guestModeData }) => {
      const guest = await guestModeData.guest();
      const api = apiAs(guest);

      const pasted = await api.documents.create({ kind: "CV", sourceText: GUEST_CV_TEXT, save: false });
      expect(pasted.status).toBe(201);
      const uploaded = await api.documents.upload({ kind: "JD", save: false, file: FILES.pdf });
      expect(uploaded.status).toBe(201);
      expect((await api.documents.get(pasted.json().id)).status).toBe(200);
      expect((await api.documents.file(uploaded.json().id)).status).toBe(200);

      const run = await api.match.createRun({ cvDocumentId: pasted.json().id, jdDocumentId: uploaded.json().id });
      expect(run.status).toBe(201);
      const detail = await api.match.getRun(run.json().id);
      expect(detail.status).toBe(200);
      expect(detail.json()).toMatchObject({ id: run.json().id, results: [] });

      const seeded = await guestModeData.run(guest.userId);
      const result = await api.match.get(seeded.resultId);
      expect(result.status).toBe(200);
      expect(result.json()).toMatchObject({ id: seeded.resultId, credentialId: null });
    }
  );

  test(
    "Khách gọi endpoint cần tài khoản nhận 401 SIGN_IN_REQUIRED",
    { tag: ["@TC-GUESTMODE-008", "@smoke"] },
    async ({ apiAs, guestModeData }) => {
      const guest = await guestModeData.guest();
      const api = apiAs(guest);
      for (const [name, call] of SIGNED_IN_ONLY) {
        const res = await call(api);
        expect(res.status, name).toBe(401);
        expect(res.error(), name).toMatchObject({
          code: "SIGN_IN_REQUIRED",
          message: serverMessage("auth.errors.signInRequired"),
        });
      }
      const vi = await api.lang("vi").match.list();
      expect(vi.status).toBe(401);
      expect(vi.error().message).toBe(serverMessage("auth.errors.signInRequired", "vi"));
    }
  );

  test(
    "Khách không đọc được tài liệu, file, run và kết quả của khách khác",
    { tag: ["@TC-GUESTMODE-009", "@smoke"] },
    async ({ apiAs, guestModeData }) => {
      const a = await guestModeData.guest();
      const b = await guestModeData.guest();
      const bRun = await guestModeData.run(b.userId);
      const bFile = await apiAs(b).documents.upload({ kind: "CV", save: false, file: FILES.pdf });
      expect(bFile.status).toBe(201);

      const asA = apiAs(a);
      expect((await asA.documents.get(bRun.cvId)).status).toBe(404);
      expect((await asA.documents.file(bFile.json().id)).status).toBe(404);
      expect((await asA.match.getRun(bRun.runId)).status).toBe(404);
      expect((await asA.match.get(bRun.resultId)).status).toBe(404);
    }
  );

  test(
    "Khách và user không đọc được dữ liệu của nhau",
    { tag: ["@TC-GUESTMODE-010", "@smoke"] },
    async ({ apiAs, guestModeData }) => {
      const guest = await guestModeData.guest();
      const user = await guestModeData.user();
      const guestRun = await guestModeData.run(guest.userId);
      const userRun = await guestModeData.run(user.userId);

      for (const [reader, run] of [
        [apiAs(guest), userRun],
        [apiAs(user), guestRun],
      ] as const) {
        expect((await reader.documents.get(run.cvId)).status).toBe(404);
        expect((await reader.documents.get(run.jdId)).status).toBe(404);
        expect((await reader.match.getRun(run.runId)).status).toBe(404);
        expect((await reader.match.get(run.resultId)).status).toBe(404);
      }
    }
  );

  test(
    "Khách không mở được run trên tài liệu của người khác",
    { tag: ["@TC-GUESTMODE-011"] },
    async ({ apiAs, guestModeData }) => {
      const a = await guestModeData.guest();
      const b = await guestModeData.guest();
      const bPair = await guestModeData.pair(b.userId);
      const aPair = await guestModeData.pair(a.userId);

      // Ownership of the pair answers 400 documentNotOwned (REQ-MULTIPROVIDERCOMPARE-08), never a run.
      for (const pair of [bPair, { cvId: aPair.cvId, jdId: bPair.jdId }]) {
        const res = await apiAs(a).match.createRun({ cvDocumentId: pair.cvId, jdDocumentId: pair.jdId });
        expect(res.status).toBe(400);
        expect(res.error().message).toBe(serverMessage("matching.errors.documentNotOwned"));
      }
    }
  );
});
