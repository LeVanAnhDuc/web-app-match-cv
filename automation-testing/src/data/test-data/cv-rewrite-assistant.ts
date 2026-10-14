import type { CvRewriteChange, CvRewriteProposalDto } from "#/types/CvRewrite";

// Values of module cv-rewrite-assistant (src/docs/requirements/cv-rewrite-assistant.md). No .env, no network.
// The CV text is what the seeded Document row holds, so a stubbed proposal (UI specs, D1) anchors to real text and the
// REAL POST /cv-rewrite/accept can apply it.

/** Browser routes the UI specs stub or slow down (globs over the full URL, like page.route). */
export const REWRITE_ROUTES = {
  /** POST /cv-rewrite — the only AI call of the module. `*` never crosses "/", so /accept is not matched. */
  generate: "**/api/v1/cv-rewrite",
  accept: "**/api/v1/cv-rewrite/accept",
  matchById: "**/api/v1/match/*",
  documentById: "**/api/v1/documents/*",
} as const;

export const API_BULLET = "Built REST APIs with Node.js and Express for an internal billing system.";
export const MIGRATION_BULLET = "Led the migration of a monolith to three services, cutting deploy time.";
export const API_REWORDED = "Built, documented and deployed REST APIs for an internal billing system.";
export const MIGRATION_EXTENDED = `${MIGRATION_BULLET} Automated the release pipeline.`;

export const CV_TEXT = ["EXPERIENCE", `- ${API_BULLET}`, `- ${MIGRATION_BULLET}`].join("\n");
export const JD_TEXT = "Hiring a backend engineer with CI/CD and Kubernetes experience.";

export const GAP_CICD = "No CI/CD experience mentioned";
export const REPORT = {
  strengths: ["Solid Node.js fundamentals"],
  gaps: [GAP_CICD],
  suggestions: ["Mention delivery pipelines"],
};
export const REPORT_NO_GAPS = { strengths: ["Node.js"], gaps: [], suggestions: [] };

export const UNADDRESSED_GAP = "5 years of Kubernetes in production";
/** A qualification the CV never mentions: it has nothing to anchor to. */
export const FABRICATION = "Certified Kubernetes Administrator since 2019";

/** A CV line that would be markup if anything rendered it as HTML. */
export const HOSTILE_LINE = "Wrote <script>alert(1)</script> tooling for the whole team.";
export const HOSTILE_REPLACEMENT = "Wrote <b>tooling</b> for the whole team.";

/** Replacement text carrying String.replace substitution patterns, which must stay literal. */
export const PATTERN_REPLACEMENT = "Built APIs ($& and $` and $') for billing.";

/** A Vietnamese CV for the live-AI grounding check. */
export const VI_CV_TEXT = [
  "KINH NGHIỆM",
  "- Xây dựng API REST bằng Node.js và Express cho hệ thống thanh toán nội bộ.",
  "- Dẫn dắt việc tách một hệ thống nguyên khối thành ba dịch vụ, rút ngắn thời gian triển khai.",
].join("\n");
export const VI_JD_TEXT = "Tuyển kỹ sư backend có kinh nghiệm CI/CD và Kubernetes.";
export const VI_REPORT = {
  strengths: ["Nền tảng Node.js vững"],
  gaps: ["Chưa nêu kinh nghiệm CI/CD"],
  suggestions: ["Nêu quy trình triển khai tự động"],
};

/** A CV of `count` bullets whose every line is a unique anchor of ≥ 12 characters (line i: "Delivered project 07 …"). */
export function numberedCv(count: number): { text: string; lines: string[] } {
  const lines = Array.from({ length: count }, (_, i) => `Delivered project ${String(i + 1).padStart(2, "0")} for the billing team.`);
  return { text: ["PROJECTS", ...lines.map((line) => `- ${line}`)].join("\n"), lines };
}

export interface ProposalTarget {
  matchId: string;
  cvId: string;
  cvTitle: string;
}

/** One change, `id` assigned by the caller (ids are stable only within a proposal). */
export function change(id: string, fields: Partial<Omit<CvRewriteChange, "id">> = {}): CvRewriteChange {
  return {
    id,
    sectionHint: "Experience",
    original: API_BULLET,
    replacement: API_REWORDED,
    rationale: "Names the delivery work the JD asks for.",
    addressesGap: GAP_CICD,
    ...fields,
  };
}

/** The default two-change proposal, both anchored in CV_TEXT, in CV order. */
export function defaultChanges(): CvRewriteChange[] {
  return [
    change("0"),
    change("1", {
      original: MIGRATION_BULLET,
      replacement: MIGRATION_EXTENDED,
      rationale: "Ties the migration to CI/CD.",
      addressesGap: null,
    }),
  ];
}

/** A CvRewriteProposalDto as POST /cv-rewrite returns it, for the seeded match. */
export function proposal(target: ProposalTarget, over: Partial<CvRewriteProposalDto> = {}): CvRewriteProposalDto {
  return {
    matchResultId: target.matchId,
    cvDocumentId: target.cvId,
    cvTitle: target.cvTitle,
    provider: "openrouter",
    chatModel: "openai/gpt-4o-mini",
    changes: defaultChanges(),
    unaddressedGaps: [UNADDRESSED_GAP],
    ...over,
  };
}

/** Nest-shaped error bodies for stubbed failures of the AI call. */
export const PROVIDER_FAILURE = { statusCode: 503, message: "Matching service failed. Please try again later." };
export const MATCH_GONE = { statusCode: 404, message: "Match result not found." };

/** Strings that must never appear in a response or the DOM (no key material, no internals). */
export const LEAK_MARKERS = ["encryptedKey", "keyIv", "keyTag", "apiKey", "sk-or-", "stack", "prisma", "\"MatchResult\""];
