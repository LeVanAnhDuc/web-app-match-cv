import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import { GUEST_JD_TEXT, GUEST_TTL_MS, utcDay } from "@/data/test-data/guest-mode";
import { findDocument } from "@/utils/db";
import { liveCookie, setCookiesNamed, SESSION_COOKIE } from "@/utils/sessions";

// REQ-GUESTMODE-01…04: who mints a guest, how long it lives, the lazy purge, and what an expired guest is.
// No AI call anywhere in this file.

const paste = { kind: "JD", sourceText: GUEST_JD_TEXT, save: false };

test.describe("guest lifecycle", () => {
  test(
    "POST /documents ẩn danh tạo khách 24h kèm cookie phiên HttpOnly, SameSite=Lax, Path=/",
    { tag: ["@TC-GUESTMODE-001", "@smoke", "@creates-data"] },
    async ({ anonApi, guestModeData }) => {
      const before = Date.now();
      const res = await anonApi.documents.create(paste);
      expect(res.status).toBe(201);

      const owner = await guestModeData.ownerOf(res.json().id);
      expect(owner?.isGuest).toBe(true);
      const user = await guestModeData.findUser(owner!.userId);
      expect(user).toMatchObject({ role: "candidate", isGuest: true });
      const expiresAt = user!.guestExpiresAt!.getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + GUEST_TTL_MS - 5_000);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + GUEST_TTL_MS + 5_000);

      const header = res.setCookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`) && !c.startsWith(`${SESSION_COOKIE}=;`));
      expect(header).toBeDefined();
      expect(header).toMatch(/;\s*HttpOnly/i);
      expect(header).toMatch(/;\s*SameSite=Lax/i);
      expect(header).toMatch(/;\s*Path=\/(;|$)/);
      const cookieExpires = Date.parse(/;\s*Expires=([^;]+)/i.exec(header!)![1]);
      expect(Math.abs(cookieExpires - expiresAt)).toBeLessThan(1_000);

      const cookie = liveCookie(res.setCookies, SESSION_COOKIE)!;
      const sessionEnds = await guestModeData.sessionExpiry(cookie.slice(`${SESSION_COOKIE}=`.length));
      expect(Math.abs(sessionEnds!.getTime() - expiresAt)).toBeLessThan(1_000);
      expect((await anonApi.as(cookie).auth.me()).json().status).toBe("guest");
    }
  );

  test(
    "Các endpoint khác gọi ẩn danh không tạo khách",
    { tag: ["@TC-GUESTMODE-002"] },
    async ({ anonApi, guestModeData }) => {
      const before = await guestModeData.guestCount();
      const id = randomUUID();
      const calls = [
        await anonApi.auth.me(),
        await anonApi.documents.get(id),
        await anonApi.documents.file(id),
        await anonApi.match.createRun({ cvDocumentId: id, jdDocumentId: randomUUID() }),
        await anonApi.match.getRun(id),
        await anonApi.match.create({ cvDocumentId: id, jdDocumentId: randomUUID() }),
        await anonApi.match.get(id),
      ];
      for (const res of calls) expect(liveCookie(res.setCookies, SESSION_COOKIE)).toBeUndefined();
      expect(calls.slice(1).map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401]);
      expect(await guestModeData.guestCount()).toBe(before);
    }
  );

  test(
    "Khách hoặc user đã có phiên gọi POST /documents không tạo khách mới",
    { tag: ["@TC-GUESTMODE-003", "@smoke"] },
    async ({ apiAs, guestModeData }) => {
      const guest = await guestModeData.guest();
      const user = await guestModeData.user();
      const before = await guestModeData.guestCount();

      for (const who of [guest, user]) {
        const res = await apiAs(who).documents.create(paste);
        expect(res.status).toBe(201);
        expect(liveCookie(res.setCookies, SESSION_COOKIE)).toBeUndefined();
        expect((await guestModeData.ownerOf(res.json().id))?.userId).toBe(who.userId);
      }
      expect(await guestModeData.guestCount()).toBe(before);
    }
  );

  test(
    "Tạo khách mới dọn khách đã hết hạn cùng dữ liệu của họ, giữ khách còn hạn",
    { tag: ["@TC-GUESTMODE-004", "@creates-data"] },
    async ({ anonApi, guestModeData }) => {
      const expired = await guestModeData.expiredGuest();
      const old = await guestModeData.run(expired.userId);
      const live = await guestModeData.guest();

      const res = await anonApi.documents.create(paste);
      expect(res.status).toBe(201);
      await guestModeData.ownerOf(res.json().id);

      expect(await guestModeData.findUser(expired.userId)).toBeNull();
      expect(await findDocument(old.cvId)).toBeNull();
      expect(await findDocument(old.jdId)).toBeNull();
      expect(await guestModeData.sessionExpiry(expired.token)).toBeNull();
      expect(await guestModeData.findUser(live.userId)).not.toBeNull();
    }
  );

  test(
    "Tạo khách mới xoá bộ đếm quota của ngày UTC trước, giữ bộ đếm hôm nay",
    { tag: ["@TC-GUESTMODE-005", "@creates-data"] },
    async ({ anonApi, guestModeData, guestModeQuota }) => {
      const yesterdayHash = guestModeQuota.hashOf(`198.51.100.${Math.floor(Math.random() * 250)}-${randomUUID()}`);
      const todayHash = guestModeQuota.hashOf(`203.0.113.${Math.floor(Math.random() * 250)}-${randomUUID()}`);
      await guestModeQuota.plantRaw(yesterdayHash, utcDay(-1), 3);
      await guestModeQuota.plantRaw(todayHash, utcDay(0), 2);

      const res = await anonApi.documents.create(paste);
      expect(res.status).toBe(201);
      await guestModeData.ownerOf(res.json().id);

      expect(await guestModeQuota.rowExists(yesterdayHash, utcDay(-1))).toBe(false);
      expect(await guestModeQuota.rowExists(todayHash, utcDay(0))).toBe(true);
    }
  );

  test(
    "Phiên khách hết hạn thành ẩn danh, cookie bị xoá và tài liệu cũ không đọc được",
    { tag: ["@TC-GUESTMODE-006", "@smoke"] },
    async ({ anonApi, guestModeData }) => {
      const expired = await guestModeData.expiredGuest();
      const { cvId } = await guestModeData.pair(expired.userId);
      const asExpired = anonApi.as(expired.cookie);

      const me = await asExpired.auth.me();
      expect(me.status).toBe(200);
      expect(me.json()).toMatchObject({ status: "anonymous", user: null });
      expect(setCookiesNamed(me.setCookies, SESSION_COOKIE)).toContain(`${SESSION_COOKIE}=`);

      const doc = await asExpired.documents.get(cvId);
      expect(doc.status).toBe(401);
      expect(doc.error()).toMatchObject({
        code: "SIGN_IN_REQUIRED",
        message: serverMessage("auth.errors.signInRequired"),
      });
    }
  );
});
