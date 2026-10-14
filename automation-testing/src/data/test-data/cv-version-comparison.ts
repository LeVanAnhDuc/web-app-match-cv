// Values for module cv-version-comparison. Rows are seeded live (decision Q1 = a): the comparison endpoint never
// calls a provider, so only error / loading states are stubbed in the browser.

/** Models stored on seeded MatchResult rows (no provider is ever called with them). */
export const MODELS = {
  chat: "openai/gpt-4o-mini",
  otherChat: "openai/gpt-4o",
  embed: "openai/text-embedding-3-small",
  otherEmbed: "openai/text-embedding-3-large",
} as const;

/** The happy-path pair: v1 61/70/48 → v2 75/78/71, i.e. delta +14 / +8 / +23. */
export const BASE_SCORES: [number, number, number] = [61, 70, 48];
export const REVISION_SCORES: [number, number, number] = [75, 78, 71];
export const HAPPY_DELTA = { overall: 14, semantic: 8, keyword: 23 } as const;

/** Gap sets whose classification is fixed by REQ-CVVERSIONCOMPARISON-12. */
export const GAPS = {
  reworded: { base: "No CI/CD experience mentioned", revision: "CI/CD exposure is still limited to a single tool" },
  closed: "Kubernetes not mentioned",
  introduced: "No Terraform experience",
  aws: "Missing AWS experience",
  azure: "Missing Azure experience",
  viAccented: "Thiếu kinh nghiệm Docker",
  viPlain: "Chua co kinh nghiem Docker",
} as const;

/** base: reworded + closed; revision: reworded + introduced → 1 closed / 1 persisted / 1 introduced. */
export const HAPPY_GAPS = {
  base: [GAPS.reworded.base, GAPS.closed],
  revision: [GAPS.reworded.revision, GAPS.introduced],
};

/** Markup that must stay text (REQ-CVVERSIONCOMPARISON-21). */
export const HOSTILE_GAP = "<script>window.__cvcPwned = 1</script>Missing Docker";
export const HOSTILE_TITLE = "<img src=x onerror=\"window.__cvcPwned=1\">CV";

/** `MAX_GAPS_PER_SIDE` of server/src/modules/comparison/gap-diff.ts. */
export const MAX_GAPS_PER_SIDE = 50;
/** `MAX_LINEAGE_DEPTH` of server/src/modules/comparison/lineage.ts. */
export const MAX_LINEAGE_DEPTH = 20;

/** `count` distinct, topic-disjoint gaps (each on its own made-up technology word). */
export function distinctGaps(count: number): string[] {
  const words = "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa".split(" ");
  return Array.from({ length: count }, (_, i) => `Missing ${words[i % words.length]}${Math.floor(i / words.length)}zz experience`);
}

/** Global throttle of the API (server/src/app.module.ts ThrottlerModule). */
export const GLOBAL_THROTTLE_LIMIT = 100;

/** Pasted CV / JD bodies for the @live-ai checks. */
export const LIVE_TEXT = {
  jd: "Senior Backend Engineer. Requirements: Node.js, TypeScript, PostgreSQL, Docker, Kubernetes, CI/CD pipelines, AWS.",
  cvV1: "Backend developer, 4 years. Node.js and Express, MySQL. Built REST APIs.",
  cvV2:
    "Backend developer, 5 years. Node.js, TypeScript, Express, PostgreSQL. Built REST APIs, containerised services with Docker and ran GitHub Actions CI/CD pipelines.",
  jdVi: "Kỹ sư Backend. Yêu cầu: Node.js, TypeScript, PostgreSQL, Docker, Kubernetes, quy trình CI/CD, AWS.",
  cvV1Vi: "Lập trình viên backend 4 năm. Node.js và Express, MySQL. Xây dựng REST API.",
  cvV2Vi:
    "Lập trình viên backend 5 năm. Node.js, TypeScript, Express, PostgreSQL. Xây dựng REST API, đóng gói dịch vụ bằng Docker và vận hành CI/CD với GitHub Actions.",
} as const;

/** Keys a comparison response must never carry (REQ-CVVERSIONCOMPARISON-05). */
export const FORBIDDEN_RESPONSE_KEYS = ["rawText", "fileData", "fileMime", "errorCode", "encryptedKey", "apiKey", "key", "userId"];
