import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import type { ApiClient } from "@/api";
import { serverMessage } from "@/data/copy";
import {
  DEFAULT_GUEST_LIMIT,
  LOOPBACK_IPS,
  nextUtcMidnight,
  overallOf,
  utcDay,
} from "@/data/test-data/guest-mode";

// REQ-GUESTMODE-07…12: system key only, the per-IP daily quota, /auth/me guestQuota.
// The 429 is reached by PLANTING the loopback caller's GuestUsage row (Q2 / D1), never by spending real matches:
// every POST /match below is answered before the provider call (403, 400, 429) — except the one @live-ai test.
// Safety: before a POST /match that would reach the provider if the plant had missed, `quotaSpent()` proves through
// GET /auth/me that the server sees the counter at its limit, and the test stops there otherwise.

async function used(anonApi: ApiClient): Promise<number> {
  return (await anonApi.auth.me()).json().guestQuota!.used;
}

test.describe("guest quota", () => {
  test(
    "Khách gửi credentialId bị chặn 403 GUEST_FORBIDDEN_CREDENTIAL và không tốn lượt",
    { tag: ["@TC-GUESTMODE-012", "@smoke"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      await guestModeQuota.clear();
      const guest = await guestModeData.guest();
      const { cvId, jdId } = await guestModeData.pair(guest.userId);
      const body = { cvDocumentId: cvId, jdDocumentId: jdId, credentialId: randomUUID() };

      const en = await apiAs(guest).match.create(body);
      expect(en.status).toBe(403);
      expect(en.error()).toMatchObject({
        code: "GUEST_FORBIDDEN_CREDENTIAL",
        message: serverMessage("matching.errors.guestCredential"),
      });
      const vi = await apiAs(guest).lang("vi").match.create(body);
      expect(vi.status).toBe(403);
      expect(vi.error().message).toBe(serverMessage("matching.errors.guestCredential", "vi"));

      expect(await used(anonApi)).toBe(0);
    }
  );

  test(
    "Quota mặc định 5 lượt/ngày, đếm theo HMAC của IP, không lưu IP thô",
    { tag: ["@TC-GUESTMODE-013"] },
    async ({ anonApi, guestModeQuota }) => {
      await guestModeQuota.clear();
      expect((await anonApi.auth.me()).json().guestQuota).toMatchObject({ limit: DEFAULT_GUEST_LIMIT, used: 0 });

      await guestModeQuota.plant(2);
      expect(await used(anonApi)).toBe(2);

      const rows = await guestModeQuota.rows();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
        expect(LOOPBACK_IPS as readonly string[]).not.toContain(row.ipHash);
      }
    }
  );

  test(
    "POST /match/runs không tính lượt",
    { tag: ["@TC-GUESTMODE-014"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      await guestModeQuota.clear();
      const guest = await guestModeData.guest();
      const { cvId, jdId } = await guestModeData.pair(guest.userId);
      for (let i = 0; i < 3; i += 1) {
        expect((await apiAs(guest).match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId })).status).toBe(201);
      }
      expect(await used(anonApi)).toBe(0);
    }
  );

  test(
    "POST /match trên tài liệu không thuộc khách trả 400 documentNotOwned và không tốn lượt",
    { tag: ["@TC-GUESTMODE-015", "@smoke"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      await guestModeQuota.clear();
      const guest = await guestModeData.guest();
      const other = await guestModeData.guest();
      const theirs = await guestModeData.pair(other.userId);

      const res = await apiAs(guest).match.create({ cvDocumentId: theirs.cvId, jdDocumentId: theirs.jdId });
      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("matching.errors.documentNotOwned"));
      expect(await used(anonApi)).toBe(0);
    }
  );

  test(
    "POST /match với runId của cặp tài liệu khác trả 400 và không tốn lượt",
    { tag: ["@TC-GUESTMODE-016"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      await guestModeQuota.clear();
      const guest = await guestModeData.guest();
      const first = await guestModeData.pair(guest.userId);
      const second = await guestModeData.pair(guest.userId);
      const run = await apiAs(guest).match.createRun({ cvDocumentId: second.cvId, jdDocumentId: second.jdId });
      expect(run.status).toBe(201);

      const res = await apiAs(guest).match.create({
        cvDocumentId: first.cvId,
        jdDocumentId: first.jdId,
        runId: run.json().id,
      });
      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("matching.errors.runDocumentMismatch"));
      expect(await used(anonApi)).toBe(0);
    }
  );

  test(
    "POST /match với body sai trả 400 và không tốn lượt",
    { tag: ["@TC-GUESTMODE-017"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      await guestModeQuota.clear();
      const guest = await guestModeData.guest();
      for (const body of [{ cvDocumentId: "not-a-uuid", jdDocumentId: randomUUID() }, { jdDocumentId: randomUUID() }]) {
        expect((await apiAs(guest).match.create(body)).status).toBe(400);
      }
      expect(await used(anonApi)).toBe(0);
    }
  );

  test(
    "User đã đăng nhập gọi POST /match không bị trừ lượt khách",
    { tag: ["@TC-GUESTMODE-018"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      await guestModeQuota.clear();
      const user = await guestModeData.user();
      const guest = await guestModeData.guest();
      const notTheirs = await guestModeData.pair(guest.userId);

      // Answered by the ownership check (400 documentNotOwned, REQ-CVJDMATCHINGWIZARD-32) before any provider call.
      const res = await apiAs(user).match.create({ cvDocumentId: notTheirs.cvId, jdDocumentId: notTheirs.jdId });
      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("matching.errors.documentNotOwned"));
      expect(await used(anonApi)).toBe(0);
    }
  );

  test(
    "Lượt thứ limit+1 trả 429 GUEST_QUOTA_EXCEEDED với limit, resetsAt và không tạo kết quả",
    { tag: ["@TC-GUESTMODE-020", "@smoke"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      const guest = await guestModeData.guest();
      const { cvId, jdId } = await guestModeData.pair(guest.userId);
      const run = await apiAs(guest).match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId });
      const limit = (await anonApi.auth.me()).json().guestQuota!.limit;
      await guestModeQuota.plant(limit);
      expect(await used(anonApi), "quota not spent: refusing to call POST /match (it would reach the AI)").toBe(limit);

      const res = await apiAs(guest).match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId: run.json().id });
      expect(res.status).toBe(429);
      expect(res.headers["retry-after"]).toBeUndefined();
      expect(res.json()).toEqual({
        statusCode: 429,
        code: "GUEST_QUOTA_EXCEEDED",
        message: serverMessage("matching.errors.guestQuota"),
        limit,
        resetsAt: nextUtcMidnight().toISOString(),
      });
      expect((await apiAs(guest).match.getRun(run.json().id)).json().results).toEqual([]);
      expect(await used(anonApi)).toBe(limit);
    }
  );

  test(
    "Khách mới (cookie khác) trên cùng IP vẫn hết lượt",
    { tag: ["@TC-GUESTMODE-021"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      const limit = (await anonApi.auth.me()).json().guestQuota!.limit;
      await guestModeQuota.plant(limit);
      expect(await used(anonApi), "quota not spent: refusing to call POST /match (it would reach the AI)").toBe(limit);

      for (let i = 0; i < 2; i += 1) {
        const fresh = await guestModeData.guest();
        const { cvId, jdId } = await guestModeData.pair(fresh.userId);
        const res = await apiAs(fresh).match.create({ cvDocumentId: cvId, jdDocumentId: jdId });
        expect(res.status).toBe(429);
        expect(res.error().code).toBe("GUEST_QUOTA_EXCEEDED");
      }
    }
  );

  test(
    "Thông báo hết lượt theo ngôn ngữ của request",
    { tag: ["@TC-GUESTMODE-022"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      const guest = await guestModeData.guest();
      const { cvId, jdId } = await guestModeData.pair(guest.userId);
      const limit = (await anonApi.auth.me()).json().guestQuota!.limit;
      await guestModeQuota.plant(limit);
      expect(await used(anonApi), "quota not spent: refusing to call POST /match (it would reach the AI)").toBe(limit);

      const res = await apiAs(guest).lang("vi").match.create({ cvDocumentId: cvId, jdDocumentId: jdId });
      expect(res.status).toBe(429);
      expect(res.error().message).toBe(serverMessage("matching.errors.guestQuota", "vi"));
    }
  );

  test(
    "Bộ đếm của ngày UTC trước không còn tính sang hôm nay",
    { tag: ["@TC-GUESTMODE-023"] },
    async ({ anonApi, guestModeQuota }) => {
      await guestModeQuota.clear();
      await guestModeQuota.plant(DEFAULT_GUEST_LIMIT, { day: utcDay(-1) });
      expect((await anonApi.auth.me()).json().guestQuota).toEqual({
        limit: DEFAULT_GUEST_LIMIT,
        used: 0,
        resetsAt: nextUtcMidnight().toISOString(),
      });
    }
  );

  test(
    "GET /auth/me trả guestQuota cho ẩn danh và khách, null cho user",
    { tag: ["@TC-GUESTMODE-024"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      await guestModeQuota.clear();
      const anon = await anonApi.auth.me();
      expect(anon.json()).toEqual({
        status: "anonymous",
        user: null,
        guestQuota: { limit: DEFAULT_GUEST_LIMIT, used: 0, resetsAt: nextUtcMidnight().toISOString() },
      });

      await guestModeQuota.plant(3);
      const guest = await guestModeData.guest();
      const asGuest = await apiAs(guest).auth.me();
      expect(asGuest.json()).toMatchObject({ status: "guest", user: null, guestQuota: { limit: DEFAULT_GUEST_LIMIT, used: 3 } });

      const user = await guestModeData.user();
      expect((await apiAs(user).auth.me()).json()).toMatchObject({ status: "user", guestQuota: null });
    }
  );

  test(
    "Khách chạy match thật trên key hệ thống tốn đúng một lượt",
    { tag: ["@TC-GUESTMODE-025", "@live-ai"] },
    async ({ anonApi, apiAs, guestModeData, guestModeQuota }) => {
      test.setTimeout(180_000);
      await guestModeQuota.clear();
      const guest = await guestModeData.guest();
      const { cvId, jdId } = await guestModeData.pair(guest.userId);
      const run = await apiAs(guest).match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId });

      const res = await apiAs(guest).match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId: run.json().id });
      expect(res.status).toBe(201);
      const result = res.json();
      expect(result).toMatchObject({ cvDocumentId: cvId, jdDocumentId: jdId, runId: run.json().id, credentialId: null });
      expect(await used(anonApi)).toBe(1);
      if (result.status === "succeeded") {
        expect(result.overallScore).toBe(overallOf(result.semanticScore, result.keywordScore));
      } else {
        // A provider failure is still the guest's spent match (REQ-GUESTMODE-09).
        expect(result.errorCode).not.toBeNull();
      }
    }
  );
});
