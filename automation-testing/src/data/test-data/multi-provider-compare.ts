import { randomBytes, randomUUID } from "node:crypto";
import type { AiProvider } from "#/types/AiCredentials";
import type { MatchErrorCode, MatchResultDto } from "#/types/Matching";

// Values of module multi-provider-compare: document texts, the stubbed POST /match bodies (D1: UI specs never reach a
// provider), and the Vietnamese texts of the @live-ai scoring comparison. No network, no .env.

export const MPC_TEXT = {
  jd: "Hiring a senior backend engineer with NestJS, PostgreSQL and TypeScript.",
  cv: "Senior backend engineer, six years of Node.js, NestJS and PostgreSQL in production.",
  otherJd: "Hiring a product designer with Figma and user research experience.",
} as const;

/** Vietnamese pair + an unrelated CV for the @live-ai scoring comparison (REQ-35). */
export const MPC_VI_TEXT = {
  jd:
    "Tuyển kỹ sư backend cấp cao. Yêu cầu: 5 năm kinh nghiệm Node.js, NestJS, PostgreSQL, thiết kế REST API, " +
    "viết unit test, làm việc với Docker và CI/CD.",
  matchingCv:
    "Kỹ sư backend 6 năm kinh nghiệm với Node.js và NestJS. Thiết kế REST API cho hệ thống thanh toán, tối ưu truy vấn " +
    "PostgreSQL, viết unit test bằng Jest, đóng gói dịch vụ bằng Docker và vận hành pipeline CI/CD.",
  unrelatedCv:
    "Đầu bếp 8 năm kinh nghiệm trong nhà hàng Âu. Lên thực đơn theo mùa, quản lý bếp 10 người, kiểm soát nguyên liệu " +
    "và chi phí món ăn, đạt chứng nhận vệ sinh an toàn thực phẩm.",
} as const;

/** Stub/selection key of the system key (a card with no credentialId). */
export const SYSTEM = "system";

export const MPC_ERROR_CODES: readonly MatchErrorCode[] = [
  "invalid_key",
  "no_quota",
  "model_unavailable",
  "timeout",
  "unreachable",
];

/** A credential label nobody else uses (labels are unique per user). */
export function credentialLabel(name: string): string {
  return `MPC ${name} ${randomBytes(3).toString("hex")}`;
}

/** Looks like a key (≥ 20 chars, no whitespace) but every provider rejects it. Never a real secret. */
export function fakeApiKey(): string {
  return `sk-mpc-e2e-${randomBytes(12).toString("hex")}`;
}

/** Default chat model shown in a stubbed card title, per provider. */
export const STUB_CHAT_MODEL: Record<AiProvider, string> = {
  openrouter: "openai/gpt-4o-mini",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash",
};

/** A succeeded MatchResultDto for a stubbed POST /match (scores and report overridable). */
export function succeededResult(overrides: Partial<MatchResultDto> = {}): MatchResultDto {
  const provider = overrides.provider ?? "openrouter";
  const tag = randomBytes(2).toString("hex");
  return {
    id: randomUUID(),
    cvDocumentId: randomUUID(),
    jdDocumentId: randomUUID(),
    overallScore: 80,
    semanticScore: 90,
    keywordScore: 65,
    report: {
      strengths: [`Stub strength ${tag}`],
      gaps: [`Stub gap ${tag}`],
      suggestions: [`Stub suggestion ${tag}`],
    },
    credentialId: null,
    runId: null,
    status: "succeeded",
    errorCode: null,
    provider,
    chatModel: STUB_CHAT_MODEL[provider],
    embedModel: "openai/text-embedding-3-small",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** A failed MatchResultDto: 201 with status=failed, zero scores and an empty report (REQ-15). */
export function failedResult(errorCode: MatchErrorCode, overrides: Partial<MatchResultDto> = {}): MatchResultDto {
  return succeededResult({
    overallScore: 0,
    semanticScore: 0,
    keywordScore: 0,
    report: { strengths: [], gaps: [], suggestions: [] },
    status: "failed",
    errorCode,
    ...overrides,
  });
}

/** Body of the guest quota 429 (matching.service.ts createMatch). */
export function guestQuotaBody(limit: number, message: string): Record<string, unknown> {
  return {
    statusCode: 429,
    code: "GUEST_QUOTA_EXCEEDED",
    message,
    limit,
    resetsAt: new Date(Date.now() + 6 * 3_600_000).toISOString(),
  };
}

/** Raw i18n key shapes that must never reach the screen (REQ-31). */
export const RAW_KEY_PATTERN = /\b(?:result|credentials|action|err|gate|wizard|step)\.[a-zA-Z_]+(?:\.[a-zA-Z_]+)*\b/;

/** overallScore = round(0.6 × semantic + 0.4 × keyword), clamped to [0, 100] (REQ-15). */
export function expectedOverall(semantic: number, keyword: number): number {
  return Math.min(100, Math.max(0, Math.round(0.6 * semantic + 0.4 * keyword)));
}

/** Report of a stubbed succeeded card, to see whether it is open or collapsed. */
export const STUB_REPORT = {
  strengths: ["Six years of NestJS in production"],
  gaps: ["No Kubernetes experience mentioned"],
  suggestions: ["Quantify the throughput of the payment API"],
} as const;
