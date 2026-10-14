import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { LEAK_PATTERNS, SAMPLE_CV_TEXT } from "@/data/test-data/infra";

// REQ-INFRA-10 (NFR-SEC-06): no stack trace, table name, SQL or Prisma detail in an error body. 429 is covered in
// rate-limit.api.ts (TC-INFRA-010), 500 is manual (TC-INFRA-023, decision Q6).

test(
  "lỗi 400 401 404 không lộ stack, tên bảng hay SQL",
  { tag: ["@TC-INFRA-022", "@smoke", "@creates-data"] },
  async ({ anonApi, apiAs, infraUsers }) => {
    const user = apiAs(await infraUsers.signedIn());

    const cases = [
      {
        name: "400 DTO",
        expected: 400,
        res: await user.documents.create({ kind: "RESUME", save: false, sourceText: SAMPLE_CV_TEXT }),
      },
      { name: "400 ParseUUIDPipe", expected: 400, res: await user.aiCredentials.update("not-a-uuid", { label: "x" }) },
      { name: "401", expected: 401, res: await anonApi.me.export() },
      { name: "404 route", expected: 404, res: await anonApi.raw.get("/no-such-route") },
      { name: "404 document", expected: 404, res: await user.documents.get(randomUUID()) },
    ];
    for (const { name, expected, res } of cases) {
      expect(res.status, name).toBe(expected);
      for (const leak of LEAK_PATTERNS) expect(res.text, name).not.toMatch(leak);
    }

    const notUuid = await user.documents.get("not-a-uuid");
    expect(notUuid.status).toBeGreaterThanOrEqual(400);
    expect(notUuid.status).toBeLessThan(500);
    for (const leak of LEAK_PATTERNS) expect(notUuid.text).not.toMatch(leak);
  }
);
