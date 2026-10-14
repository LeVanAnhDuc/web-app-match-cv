import { test, expect } from "@/fixtures";
import {
  API_BULLET,
  API_REWORDED,
  FABRICATION,
  GAP_CICD,
  MIGRATION_BULLET,
  MIGRATION_EXTENDED,
  PATTERN_REPLACEMENT,
  REPORT_NO_GAPS,
  REWRITE_ROUTES,
  UNADDRESSED_GAP,
  change,
  defaultChanges,
  proposal,
} from "@/data/test-data/cv-rewrite-assistant";

// Reviewing a proposal (REQ-19…23). The proposal is a page.route stub of POST /cv-rewrite (D1) anchored in the seeded
// CV text; everything else is the real backend.

const GENERATE = { method: "POST", status: 201 } as const;

test.describe("cv rewrite — review", () => {
  test(
    "thẻ thay đổi hiện section, đoạn gốc, đề xuất, lý do và gap",
    { tag: ["@TC-CVREWRITEASSISTANT-048", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      const [first, second] = defaultChanges();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      await rewritePage.open(seed.matchId);

      await rewritePage.generateProposal();

      await expect(rewritePage.changeGroups()).toHaveCount(2);
      const card = rewritePage.change(0);
      await expect(card.eyebrow(first.sectionHint!)).toBeVisible();
      await expect(card.originalLabel()).toBeVisible();
      await expect(card.text(first.original)).toBeVisible();
      await expect(card.suggestedLabel()).toBeVisible();
      await expect(card.text(first.replacement)).toBeVisible();
      await expect(card.text(first.rationale)).toBeVisible();
      await expect(card.text(first.addressesGap!)).toBeVisible();
      await expect(card.removalTag()).toHaveCount(0);

      const other = rewritePage.change(1);
      await expect(other.text(second.original)).toBeVisible();
      await expect(other.text(GAP_CICD)).toHaveCount(0);
    }
  );

  test(
    "thay đổi xoá dòng được gắn nhãn và không có khối đề xuất",
    { tag: ["@TC-CVREWRITEASSISTANT-049", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      const removal = change("0", { replacement: "", sectionHint: null, addressesGap: null });
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed, { changes: [removal], unaddressedGaps: [] }), GENERATE);
      await rewritePage.open(seed.matchId);

      await rewritePage.generateProposal();

      const card = rewritePage.change(0);
      await expect(card.removalTag()).toBeVisible();
      await expect(card.suggestedLabel()).toHaveCount(0);
      await expect(card.untitledEyebrow()).toBeVisible();
      await expect(card.text(API_BULLET)).toBeVisible();
    }
  );

  test(
    "mặc định không chọn gì, chọn tất cả và bộ đếm theo số nhiều",
    { tag: ["@TC-CVREWRITEASSISTANT-050", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();

      await expect(rewritePage.change(0).checkbox()).not.toBeChecked();
      await expect(rewritePage.change(1).checkbox()).not.toBeChecked();
      await expect(rewritePage.selectedCount(0)).toBeVisible();
      await expect(rewritePage.saveAsNewButton()).toBeDisabled();

      await rewritePage.change(0).tick();
      await expect(rewritePage.selectedCount(1)).toBeVisible();
      await expect(rewritePage.saveAsNewButton()).toBeEnabled();

      await rewritePage.tickAll();
      await expect(rewritePage.change(1).checkbox()).toBeChecked();
      await expect(rewritePage.selectedCount(2)).toBeVisible();

      await rewritePage.selectAll().uncheck();
      await expect(rewritePage.change(0).checkbox()).not.toBeChecked();
      await expect(rewritePage.change(1).checkbox()).not.toBeChecked();
      await expect(rewritePage.selectedCount(0)).toBeVisible();
      await expect(rewritePage.saveAsNewButton()).toBeDisabled();
    }
  );

  test(
    "xem trước áp đúng các thay đổi đang chọn",
    { tag: ["@TC-CVREWRITEASSISTANT-051", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      const [, second] = defaultChanges();
      const changes = [change("0", { replacement: PATTERN_REPLACEMENT }), second];
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed, { changes }), GENERATE);
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();

      await rewritePage.change(0).tick();
      await rewritePage.openPreview();

      const preview = rewritePage.previewText();
      await expect(preview).toContainText(PATTERN_REPLACEMENT);
      await expect(preview).not.toContainText(API_BULLET);
      // The change that was NOT ticked stays exactly as the CV has it.
      await expect(preview).toContainText(MIGRATION_BULLET);
      await expect(preview).not.toContainText(MIGRATION_EXTENDED);
    }
  );

  test(
    "đề xuất rỗng nói rõ thay vì danh sách trống",
    { tag: ["@TC-CVREWRITEASSISTANT-052", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed, { changes: [], unaddressedGaps: [] }), GENERATE);
      await rewritePage.open(seed.matchId);

      await rewritePage.generateProposal();

      await expect(rewritePage.emptyNotice()).toBeVisible();
      await expect(rewritePage.emptyHint()).toBeVisible();
      await expect(rewritePage.changeGroups()).toHaveCount(0);
      await expect(rewritePage.saveAsNewButton()).toHaveCount(0);
      await expect(rewritePage.selectAll()).toHaveCount(0);
      await expect(rewritePage.unaddressedTitle()).toHaveCount(0);
    }
  );

  test(
    "gap không thể đóng được liệt kê thay vì bịa",
    { tag: ["@TC-CVREWRITEASSISTANT-053", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      const [first] = defaultChanges();
      await network.stubJson(
        REWRITE_ROUTES.generate,
        proposal(seed, { changes: [first], unaddressedGaps: [UNADDRESSED_GAP, FABRICATION] }),
        GENERATE
      );
      await rewritePage.open(seed.matchId);

      await rewritePage.generateProposal();

      await expect(rewritePage.changeGroups()).toHaveCount(1);
      await expect(rewritePage.unaddressedTitle()).toBeVisible();
      await expect(rewritePage.unaddressedHint()).toBeVisible();
      await expect(rewritePage.gap(UNADDRESSED_GAP)).toBeVisible();
      await expect(rewritePage.gap(FABRICATION)).toBeVisible();
    }
  );

  test(
    "match không có gap vẫn mở và nói rõ",
    { tag: ["@TC-CVREWRITEASSISTANT-054", "@creates-data"] },
    async ({ rewriteData, rewritePage }) => {
      const seed = await rewriteData.match({ report: REPORT_NO_GAPS });

      await rewritePage.open(seed.matchId);

      await expect(rewritePage.noGapsNotice()).toBeVisible();
      await expect(rewritePage.gapsTitle()).toHaveCount(0);
      await expect(rewritePage.generateButton()).toBeEnabled();
    }
  );

  test(
    "sinh lại thay đề xuất và bỏ mọi lựa chọn mà không hỏi",
    { tag: ["@TC-CVREWRITEASSISTANT-055", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      const replacement = "Moved a monolith to three services and cut deploy time.";
      const next = proposal(seed, {
        changes: [change("0", { original: MIGRATION_BULLET, replacement, sectionHint: "Projects", addressesGap: null })],
        unaddressedGaps: [],
      });
      // Newest route first: the one-off first proposal, then the second one for every later press.
      await network.stubJson(REWRITE_ROUTES.generate, next, GENERATE);
      await network.stubOnce(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();
      await rewritePage.tickAll();
      await expect(rewritePage.saveAsNewButton()).toBeEnabled();

      await rewritePage.generate();

      await expect(rewritePage.dialogs()).toHaveCount(0);
      await expect(rewritePage.change(0).text(replacement)).toBeVisible();
      await expect(rewritePage.changeGroups()).toHaveCount(1);
      await expect(rewritePage.changeWith(API_REWORDED).root).toHaveCount(0);
      await expect(rewritePage.change(0).checkbox()).not.toBeChecked();
      await expect(rewritePage.selectAll()).not.toBeChecked();
      await expect(rewritePage.selectedCount(0)).toBeVisible();
      await expect(rewritePage.saveAsNewButton()).toBeDisabled();
    }
  );
});
