import { test, expect } from "@/fixtures";
import { LANGUAGES, serverMessage } from "@/data/copy";
import { BOGUS_SESSION_COOKIE } from "@/data/test-data/data-export";

// REQ-DATAEXPORT-01: GET /me/export is for signed-in users only. Anonymous callers, guests and dead sessions all get
// 401 SIGN_IN_REQUIRED in the request's language — never a zip, never a 404/500.

test.describe("GET /me/export — access", () => {
  test(
    "anonymous gọi export nhận 401 SIGN_IN_REQUIRED theo ngôn ngữ request",
    { tag: ["@TC-DATAEXPORT-001", "@smoke"] },
    async ({ anonApi }) => {
      for (const lng of LANGUAGES) {
        const res = await anonApi.lang(lng).me.export();
        expect(res.status, lng).toBe(401);
        expect(res.headers["content-type"]).not.toContain("application/zip");
        expect(res.error()).toMatchObject({
          code: "SIGN_IN_REQUIRED",
          message: serverMessage("auth.errors.signInRequired", lng),
        });
      }
    }
  );

  test(
    "khách (guest session) gọi export nhận 401 SIGN_IN_REQUIRED",
    { tag: ["@TC-DATAEXPORT-002", "@smoke", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed }) => {
      const guest = await dataExportUsers.guest();
      await dataExportSeed.document({ userId: guest.userId, title: "Guest CV", rawText: "guest text" });

      const res = await apiAs(guest).me.export();

      expect(res.status).toBe(401);
      expect(res.error().code).toBe("SIGN_IN_REQUIRED");
    }
  );

  test(
    "cookie phiên không hợp lệ hoặc của user đã xóa nhận 401",
    { tag: ["@TC-DATAEXPORT-003", "@creates-data"] },
    async ({ apiAs, dataExportUsers }) => {
      const bogus = await apiAs(BOGUS_SESSION_COOKIE).me.export();
      expect(bogus.status).toBe(401);
      expect(bogus.error().code).toBe("SIGN_IN_REQUIRED");

      const gone = await dataExportUsers.signedIn();
      await dataExportUsers.remove(gone.userId);
      const deleted = await apiAs(gone).me.export();
      expect(deleted.status).toBe(401);
      expect(deleted.error().code).toBe("SIGN_IN_REQUIRED");
    }
  );
});
