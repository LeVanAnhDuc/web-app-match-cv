import { test, expect } from "@/fixtures";

// REQ-DATAEXPORT-23/25: headers and methods as input. The zip is a non-seekable stream, so a Range request must
// never be answered with a partial archive that looks like a success; a wrong method must not reach the handler.

test.describe("GET /me/export — headers, methods, throttle", () => {
  test(
    "header Range không bao giờ cho zip cụt",
    { tag: ["@TC-DATAEXPORT-026", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();

      const res = await apiAs(user).me.export({ headers: { Range: "bytes=0-100" } });

      expect([200, 416]).toContain(res.status);
      if (res.status === 200) {
        expect(res.headers["content-range"]).toBeUndefined();
        expect(dataExportArchive(res.raw).has("data.json")).toBe(true);
      }
    }
  );

  test(
    "Accept application/json vẫn nhận zip hoặc 406, không 5xx",
    { tag: ["@TC-DATAEXPORT-027", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();

      const res = await apiAs(user).me.export({ headers: { Accept: "application/json" } });

      expect([200, 406]).toContain(res.status);
      if (res.status === 200) {
        expect(res.headers["content-type"]).toContain("application/zip");
        expect(dataExportArchive(res.raw).has("data.json")).toBe(true);
      }
    }
  );

  test(
    "sai method trên /me/export nhận 404 hoặc 405",
    { tag: ["@TC-DATAEXPORT-028", "@creates-data"] },
    async ({ apiAs, dataExportUsers }) => {
      const user = await dataExportUsers.signedIn();
      const api = apiAs(user);

      for (const method of ["POST", "PATCH", "DELETE"] as const) {
        const res = await api.raw.call(method, "/me/export");
        expect([404, 405], method).toContain(res.status);
        expect(res.headers["content-type"] ?? "", method).not.toContain("application/zip");
      }
    }
  );

  test(
    "throttle toàn cục 100 request mỗi phút áp cho export",
    { tag: ["@TC-DATAEXPORT-029", "@creates-data"] },
    async ({ apiAs, dataExportUsers }) => {
      const user = await dataExportUsers.signedIn();
      const api = apiAs(user);

      const first = await api.me.export();
      const second = await api.me.export();

      for (const res of [first, second]) {
        expect(res.status).toBe(200);
        expect(res.headers["x-ratelimit-limit"]).toBe("100");
      }
      expect(Number(second.headers["x-ratelimit-remaining"])).toBeLessThan(
        Number(first.headers["x-ratelimit-remaining"])
      );
    }
  );
});
