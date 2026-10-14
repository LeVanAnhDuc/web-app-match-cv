import { test, expect } from "@/fixtures";
import type { CvRewriteProposalDto } from "#/types/CvRewrite";
import {
  CV_TEXT,
  JD_TEXT,
  REPORT,
  VI_CV_TEXT,
  VI_JD_TEXT,
  VI_REPORT,
} from "@/data/test-data/cv-rewrite-assistant";

// @live-ai (D1): the ONLY specs of this module that reach a paid provider — POST /cv-rewrite on the dev server's system
// key (OPENROUTER_API_KEY). Filtered out and blocked by `guard` unless LIVE_AI=1. The model's output is not
// deterministic, so these assert the invariants every proposal must satisfy after server-side grounding (REQ-12, 16,
// 17, 18), not particular wording. The deterministic boundaries of the same rules are in accept.api.ts.
test.describe.configure({ timeout: 180_000 });

const PROPOSAL_KEYS = ["changes", "chatModel", "cvDocumentId", "cvTitle", "matchResultId", "provider", "unaddressedGaps"];
const CHANGE_KEYS = ["addressesGap", "id", "original", "rationale", "replacement", "sectionHint"];
const squash = (value: string) => value.replace(/\s+/g, " ").trim();

/** Every grounding/clipping invariant of a proposal built from `cvText` (REQ-12, REQ-16, REQ-17, REQ-18). */
function expectGrounded(proposal: CvRewriteProposalDto, cvText: string): void {
  expect(Object.keys(proposal).sort()).toEqual(PROPOSAL_KEYS);
  expect(proposal.changes.length).toBeLessThanOrEqual(25);
  const haystack = squash(cvText);
  let lastPosition = -1;
  proposal.changes.forEach((change, index) => {
    const where = `change ${index}: ${JSON.stringify(change.original).slice(0, 80)}`;
    expect(Object.keys(change).sort(), where).toEqual(CHANGE_KEYS);
    expect(change.id, where).toBe(String(index));
    // Verbatim excerpt of the stored CV (not the model's retyping), unique once whitespace is squashed, ≥ 12 chars.
    expect(cvText.includes(change.original), where).toBe(true);
    const needle = squash(change.original);
    expect(needle.length, where).toBeGreaterThanOrEqual(12);
    expect(haystack.indexOf(needle), where).toBe(haystack.lastIndexOf(needle));
    // Document order.
    const position = cvText.indexOf(change.original);
    expect(position, where).toBeGreaterThan(lastPosition);
    lastPosition = position;
    // Size budget.
    expect(change.replacement.length, where).toBeLessThanOrEqual(1500);
    expect(change.replacement.length, where).toBeLessThanOrEqual(change.original.length * 4);
    // Clipped display strings.
    if (change.sectionHint !== null) {
      expect(change.sectionHint.length, where).toBeGreaterThan(0);
      expect(change.sectionHint.length, where).toBeLessThanOrEqual(60);
    }
    expect(change.rationale.length, where).toBeLessThanOrEqual(300);
    if (change.addressesGap !== null) {
      expect(change.addressesGap.length, where).toBeGreaterThan(0);
      expect(change.addressesGap.length, where).toBeLessThanOrEqual(300);
    }
  });
  expect(proposal.unaddressedGaps.length).toBeLessThanOrEqual(25);
  for (const gap of proposal.unaddressedGaps) {
    expect(gap.length).toBeGreaterThan(0);
    expect(gap.length).toBeLessThanOrEqual(300);
  }
  // No key material in any field.
  expect(JSON.stringify(proposal)).not.toMatch(/sk-or-|sk-[A-Za-z0-9]{20,}|encryptedKey|apiKey/);
}

test.describe("cv rewrite — live provider", () => {
  test(
    "đề xuất thật đúng hợp đồng và mọi thay đổi bám CV",
    { tag: ["@TC-CVREWRITEASSISTANT-029", "@live-ai", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId, cvText: CV_TEXT, jdText: JD_TEXT, report: REPORT });

      const res = await me.api.cvRewrite.generate({ matchResultId: seed.matchId });

      expect(res.status, res.text).toBe(201);
      const proposal = res.json();
      expect(proposal).toMatchObject({
        matchResultId: seed.matchId,
        cvDocumentId: seed.cvId,
        cvTitle: seed.cvTitle,
        provider: "openrouter",
      });
      expect(typeof proposal.chatModel).toBe("string");
      expectGrounded(proposal, CV_TEXT);
    }
  );

  test(
    "CV tiếng Việt: đề xuất thật trích nguyên văn tiếng Việt",
    { tag: ["@TC-CVREWRITEASSISTANT-030", "@live-ai", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({
        userId: me.userId,
        cvText: VI_CV_TEXT,
        jdText: VI_JD_TEXT,
        report: VI_REPORT,
        cvTitle: "CV tiếng Việt",
      });

      const res = await me.api.lang("vi").cvRewrite.generate({ matchResultId: seed.matchId });

      expect(res.status, res.text).toBe(201);
      expect(res.json().cvTitle).toBe("CV tiếng Việt");
      expectGrounded(res.json(), VI_CV_TEXT);
    }
  );

  test(
    "đề xuất thật lưu được nguyên vẹn qua accept",
    { tag: ["@TC-CVREWRITEASSISTANT-031", "@live-ai", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });
      const generated = await me.api.cvRewrite.generate({ matchResultId: seed.matchId });
      expect(generated.status, generated.text).toBe(201);
      const { changes } = generated.json();
      test.skip(changes.length === 0, "the model proposed no change this time — nothing to accept");

      const res = await me.api.cvRewrite.accept({
        matchResultId: seed.matchId,
        title: "Live rewrite",
        changes: changes.map(({ original, replacement }) => ({ original, replacement })),
      });

      expect(res.status, res.text).toBe(201);
      for (const { replacement } of changes) if (replacement.trim()) expect(res.json().rawText).toContain(replacement);
      expect(res.json().parentId).toBe(seed.cvId);
    }
  );
});
