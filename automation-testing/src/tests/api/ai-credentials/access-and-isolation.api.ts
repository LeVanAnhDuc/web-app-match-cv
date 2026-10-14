import { randomUUID } from "node:crypto";
import type { ApiClient, ApiResponse } from "@/api";
import { serverMessage } from "@/data/copy";
import { FAKE_KEY, uniqueLabel } from "@/data/test-data/ai-credentials";
import type { SeededUser } from "@/utils/sessions";
import { expect, test } from "@/fixtures";

// Who may reach /ai-credentials* and whose rows they see (REQ-AICREDENTIALS-02, -03, -04, -10, -40).
// Every case here is decided before any provider call: POST /:id/test on a row the caller does not own is a 404 from
// the ownership lookup, so no key is ever decrypted or sent anywhere.

test.describe("ai-credentials — access and isolation", () => {
  let owner: SeededUser;
  let guest: SeededUser;
  let otherUserId: string;
  let foreignId: string;
  let ownerApi: ApiClient;

  test.beforeAll(async ({ aiCredData, apiAs }) => {
    owner = await aiCredData.createSignedInUser();
    guest = await aiCredData.createGuestUser();
    otherUserId = await aiCredData.createUser();
    foreignId = await aiCredData.insertForeignCredential(otherUserId, "belongs to someone else");
    ownerApi = apiAs(owner);
  });

  test.afterAll(async ({ aiCredData }) => {
    await aiCredData.deleteUsers([owner.userId, guest.userId, otherUserId]);
  });

  /** Every credential endpoint, called by `client`. */
  async function callAll(client: ApiClient): Promise<Array<[string, ApiResponse<unknown>]>> {
    const id = randomUUID();
    return [
      ["GET /providers", await client.aiCredentials.providers()],
      ["GET /", await client.aiCredentials.list()],
      ["POST /", await client.aiCredentials.create({ provider: "openrouter", label: uniqueLabel(), apiKey: FAKE_KEY })],
      ["PATCH /:id", await client.aiCredentials.update(id, { label: uniqueLabel() })],
      ["DELETE /:id", await client.aiCredentials.remove(id)],
      ["POST /:id/test", await client.aiCredentials.test(id)],
    ];
  }

  test(
    "mọi endpoint credential trả 401 cho người chưa đăng nhập và cho khách",
    { tag: ["@TC-AICREDENTIALS-003", "@smoke"] },
    async ({ anonApi, apiAs }) => {
      for (const [who, client] of [
        ["anonymous", anonApi],
        ["guest", apiAs(guest)],
      ] as const) {
        for (const [endpoint, res] of await callAll(client)) {
          expect(res.status, `${who} ${endpoint}`).toBe(401);
          expect(res.error().code, `${who} ${endpoint}`).toBe("SIGN_IN_REQUIRED");
        }
      }
    }
  );

  test(
    "không xem, sửa, xoá hay kiểm tra được credential của user khác, và 404 giống hệt id không tồn tại",
    { tag: ["@TC-AICREDENTIALS-086", "@smoke"] },
    async ({ aiCredData }) => {
      const list = await ownerApi.aiCredentials.list();
      expect(list.status).toBe(200);
      expect(list.json().some((c) => c.id === foreignId)).toBe(false);

      const unknown = randomUUID();
      const notFound = serverMessage("aiCredentials.errors.notFound");
      const attempts: Array<[string, ApiResponse<unknown>, ApiResponse<unknown>]> = [
        [
          "PATCH",
          await ownerApi.aiCredentials.update(foreignId, { label: uniqueLabel() }),
          await ownerApi.aiCredentials.update(unknown, { label: uniqueLabel() }),
        ],
        ["POST test", await ownerApi.aiCredentials.test(foreignId), await ownerApi.aiCredentials.test(unknown)],
        ["DELETE", await ownerApi.aiCredentials.remove(foreignId), await ownerApi.aiCredentials.remove(unknown)],
      ];
      for (const [what, foreign, missing] of attempts) {
        expect(foreign.status, what).toBe(404);
        expect(foreign.error().message, what).toBe(notFound);
        // Same status and same message as an id that does not exist: the response does not confirm the row.
        expect(missing.status, what).toBe(foreign.status);
        expect(missing.error().message, what).toBe(foreign.error().message);
      }

      // …and the other user's row is untouched.
      const row = await aiCredData.findCredential(foreignId);
      expect(row).not.toBeNull();
      expect(row!.lastTestStatus).toBeNull();
    }
  );

  test(
    ":id không phải UUID trả 400 ở PATCH, DELETE và test",
    { tag: ["@TC-AICREDENTIALS-018"] },
    async () => {
      expect((await ownerApi.aiCredentials.update("not-a-uuid", { label: uniqueLabel() })).status).toBe(400);
      expect((await ownerApi.aiCredentials.remove("not-a-uuid")).status).toBe(400);
      expect((await ownerApi.aiCredentials.test("not-a-uuid")).status).toBe(400);
    }
  );

  test(
    "danh sách chỉ có credential của chính user, mới tạo nhất đứng đầu",
    { tag: ["@TC-AICREDENTIALS-010"] },
    async ({ aiCredData, apiAs }) => {
      const user = await aiCredData.createSignedInUser();
      try {
        const api = apiAs(user);
        const created: string[] = [];
        for (const label of [uniqueLabel("first"), uniqueLabel("second"), uniqueLabel("third")]) {
          const res = await api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });
          expect(res.status).toBe(201);
          created.push(res.json().id);
        }

        const list = await api.aiCredentials.list();
        expect(list.status).toBe(200);
        const body = list.json();
        expect(body.map((c) => c.id)).toEqual([...created].reverse());
        const stamps = body.map((c) => Date.parse(c.createdAt));
        expect([...stamps].sort((a, b) => b - a)).toEqual(stamps);
      } finally {
        await aiCredData.deleteUsers([user.userId]);
      }
    }
  );

  test(
    "message lỗi notFound và labelTaken trả theo ngôn ngữ của request",
    { tag: ["@TC-AICREDENTIALS-056"] },
    async () => {
      const label = uniqueLabel("i18n");
      expect((await ownerApi.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY })).status).toBe(201);

      for (const lng of ["en", "vi"] as const) {
        const api = ownerApi.lang(lng);
        const missing = await api.aiCredentials.update(randomUUID(), { label: uniqueLabel() });
        expect(missing.status).toBe(404);
        expect(missing.error().message).toBe(serverMessage("aiCredentials.errors.notFound", lng));

        const duplicate = await api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });
        expect(duplicate.status).toBe(409);
        expect(duplicate.error().message).toBe(serverMessage("aiCredentials.errors.labelTaken", lng));
      }
    }
  );
});
