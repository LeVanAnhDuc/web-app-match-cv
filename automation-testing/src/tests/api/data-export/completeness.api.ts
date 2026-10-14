import { test, expect } from "@/fixtures";

// REQ-DATAEXPORT-34 (decision Q1 (a)): FR-15 promises "everything the app holds about you". Cover letters (PII),
// match runs, document lineage and the profile mirrored from Ducker ID are missing from the export today.

test.describe("GET /me/export — completeness", () => {
  // BUG: defects/data-export.md#bug-dataexport-01
  test.fail(
    "export chứa cover letter và match run của user",
    { tag: ["@TC-DATAEXPORT-032", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const { cvId, jdId } = await dataExportSeed.pair(user.userId);
      const runId = await dataExportSeed.matchRun({ userId: user.userId, cvDocumentId: cvId, jdDocumentId: jdId });
      const matchId = await dataExportSeed.matchResult({
        userId: user.userId,
        cvDocumentId: cvId,
        jdDocumentId: jdId,
        runId,
      });
      const letterId = await dataExportSeed.coverLetter({
        userId: user.userId,
        matchResultId: matchId,
        content: "Dear hiring manager, export me.",
      });

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const manifest = dataExportArchive(res.raw).manifest();

      expect(manifest.coverLetters).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: letterId, content: "Dear hiring manager, export me." })])
      );
      expect(manifest.matchRuns).toEqual(expect.arrayContaining([expect.objectContaining({ id: runId })]));
    }
  );

  // BUG: defects/data-export.md#bug-dataexport-02
  test.fail(
    "export chứa hồ sơ user, lineage tài liệu và schemaVersion 2",
    { tag: ["@TC-DATAEXPORT-033", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const email = `export-${Date.now()}@test.local`;
      const user = await dataExportUsers.signedIn({ email });
      const parentId = await dataExportSeed.document({ userId: user.userId, title: "Original CV" });
      const childId = await dataExportSeed.document({ userId: user.userId, title: "Rewritten CV", parentId });

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const manifest = dataExportArchive(res.raw).manifest();

      expect(manifest.user).toHaveProperty("email", email);
      expect(manifest.user).toHaveProperty("fullName");
      expect(manifest.user).toHaveProperty("avatar");
      expect(manifest.documents.find((d) => d.id === childId)).toHaveProperty("parentId", parentId);
      expect(manifest.documents.find((d) => d.id === parentId)).toHaveProperty("parentId", null);
      expect(manifest.schemaVersion).toBe(2);
    }
  );
});
