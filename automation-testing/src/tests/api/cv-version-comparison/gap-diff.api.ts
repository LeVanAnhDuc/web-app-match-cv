import { GAPS, MAX_GAPS_PER_SIDE, distinctGaps } from "@/data/test-data/cv-version-comparison";
import { expect, test } from "@/fixtures";

// How the two versions' gaps are paired (REQ-CVVERSIONCOMPARISON-12). The exact threshold (0.49 / 0.5), best-first
// order and tokenizer aliases are unit-tested in the server (gap-diff.spec.ts); here only the required examples and
// the per-side cap are checked end to end.

test.describe("cv-version-comparison — gap diff", () => {
  test(
    "gap được ghép theo chủ đề, giữ nguyên văn, kể cả tiếng Việt không dấu",
    { tag: ["@TC-CVVERSIONCOMPARISON-020"] },
    async ({ cvcSeed }) => {
      const { v2 } = await cvcSeed.happyPair({
        base: [GAPS.reworded.base, GAPS.aws, GAPS.viAccented],
        revision: [GAPS.viPlain, GAPS.azure, GAPS.reworded.revision],
      });

      const res = await cvcSeed.api.comparisons.get(v2);

      expect(res.status).toBe(200);
      const diff = res.json().gapDiff;
      expect(diff?.closed).toEqual([GAPS.aws]);
      expect(diff?.introduced).toEqual([GAPS.azure]);
      expect(diff?.persisted).toHaveLength(2);
      expect(diff?.persisted).toEqual(
        expect.arrayContaining([
          { base: GAPS.reworded.base, revision: GAPS.reworded.revision },
          { base: GAPS.viAccented, revision: GAPS.viPlain },
        ])
      );
    }
  );

  test(
    "mỗi bên chỉ xét tối đa 50 gap",
    { tag: ["@TC-CVVERSIONCOMPARISON-021"] },
    async ({ cvcSeed }) => {
      const tooMany = distinctGaps(MAX_GAPS_PER_SIDE + 1);
      const { v2 } = await cvcSeed.happyPair({ base: tooMany, revision: [] });

      const body = (await cvcSeed.api.comparisons.get(v2)).json();

      expect(body.baseResult?.gaps).toEqual(tooMany.slice(0, MAX_GAPS_PER_SIDE));
      expect(body.gapDiff?.closed).toHaveLength(MAX_GAPS_PER_SIDE);
      expect(body.gapDiff?.closed).not.toContain(tooMany[MAX_GAPS_PER_SIDE]);
      expect(body.gapDiff?.persisted).toEqual([]);
      expect(body.gapDiff?.introduced).toEqual([]);
    }
  );
});
