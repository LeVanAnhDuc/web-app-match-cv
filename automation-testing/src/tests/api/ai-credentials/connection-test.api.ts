import { randomUUID } from "node:crypto";
import { serverMessage } from "@/data/copy";
import { FAKE_KEY, KEY_PREFIX, uniqueLabel } from "@/data/test-data/ai-credentials";
import type { SeededUser } from "@/utils/sessions";
import { expect, test } from "@/fixtures";

// POST /ai-credentials/:id/test (REQ-AICREDENTIALS-29, -30, -32).
//   - live, no provider: the 404 / 400 decided before any key is decrypted, and the 10-per-minute throttle (spent with
//     unknown ids, which are 404s and never reach a provider);
//   - @live-ai: one real ping with a syntactically valid but bogus key — the provider answers 401, which costs nothing.
// The throttle spec saturates this route's per-IP bucket for up to a minute; the shared client waits out a 429 that
// carries Retry-After, so anything calling the route afterwards is only slower, never red.
test.describe.configure({ timeout: 180_000 });

test.describe("ai-credentials — connection test", () => {
  let user: SeededUser;

  test.beforeAll(async ({ aiCredData }) => {
    user = await aiCredData.createSignedInUser();
  });

  test.afterAll(async ({ aiCredData }) => {
    await aiCredData.deleteUsers([user.userId]);
  });

  test(
    "kiểm tra kết nối bằng key giả qua provider thật trả invalid_key cho cả chat và embeddings và lưu kết quả",
    { tag: ["@TC-AICREDENTIALS-041", "@live-ai"] },
    async ({ apiAs, aiCredData }) => {
      const api = apiAs(user);
      const created = await api.aiCredentials.create({ provider: "openrouter", label: uniqueLabel("live"), apiKey: FAKE_KEY });
      expect(created.status).toBe(201);
      const { id } = created.json();
      const before = Date.now();

      const res = await api.aiCredentials.test(id);

      expect(res.status).toBe(200);
      const body = res.json();
      expect(Object.keys(body).sort()).toEqual(["chat", "embed", "status", "testedAt"]);
      expect(body).toMatchObject({ chat: "invalid_key", embed: "invalid_key", status: "invalid_key" });
      expect(Date.parse(body.testedAt)).toBeGreaterThanOrEqual(before - 5_000);
      // Neither the key nor the provider's own error text comes back.
      expect(res.text).not.toContain(FAKE_KEY);
      expect(res.text).not.toContain(KEY_PREFIX);

      const row = (await aiCredData.findCredential(id))!;
      expect(row.lastTestStatus).toBe("invalid_key");
      expect(row.lastTestedAt).not.toBeNull();
      const listed = (await api.aiCredentials.list()).json().find((c) => c.id === id)!;
      expect(listed.lastTestStatus).toBe("invalid_key");
      expect(listed.lastTestedAt).not.toBeNull();
    }
  );

  test(
    "kiểm tra credential không tồn tại trả 404 trước khi gọi provider",
    { tag: ["@TC-AICREDENTIALS-042"] },
    async ({ apiAs }) => {
      const res = await apiAs(user).aiCredentials.test(randomUUID());
      expect(res.status).toBe(404);
      expect(res.error().message).toBe(serverMessage("aiCredentials.errors.notFound"));
    }
  );

  test(
    "POST /:id/test cho phép 10 request mỗi phút, request thứ 11 trả 429",
    { tag: ["@TC-AICREDENTIALS-043"] },
    async ({ aiCredProbe }) => {
      const LIMIT = 10;
      const probe = () => aiCredProbe("POST", `/ai-credentials/${randomUUID()}/test`, user.cookie);

      // 1. Spend whatever is left of the current window until the throttler answers 429. Earlier specs may have used
      //    part of it, so the count here proves nothing yet.
      let throttled = false;
      for (let call = 0; call <= LIMIT && !throttled; call += 1) {
        const res = await probe();
        throttled = res.status === 429;
        if (!throttled) expect(res.status).toBe(404);
      }
      expect(throttled, "no 429 within limit + 1 calls").toBe(true);

      // 2. Wait the block out. The first call that goes through again starts a clean window (the throttler resets the
      //    counter when a block expires), so it is call #1 of exactly ten.
      await expect
        .poll(async () => (await probe()).status, { timeout: 90_000, intervals: [5_000] })
        .toBe(404);

      // 3. Calls #2..#10 pass, #11 is throttled and says when to retry.
      for (let call = 2; call <= LIMIT; call += 1) {
        expect((await probe()).status, `call #${call}`).toBe(404);
      }
      const eleventh = await probe();
      expect(eleventh.status).toBe(429);
      expect(eleventh.retryAfterSeconds).toBeGreaterThan(0);
    }
  );
});
