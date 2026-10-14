import type { MatchResultDto } from "#/types/Matching";

// Values for the guest-mode specs (tests/{e2e,api}/guest-mode). Values only: no .env, no network.

/** Pasted JD / CV the guest wizard flows use. Long enough to pass the server's text checks. */
export const GUEST_JD_TEXT =
  "We are hiring a senior backend engineer with NestJS, PostgreSQL and TypeScript experience to build our APIs.";
export const GUEST_CV_TEXT =
  "Senior backend engineer, 6 years of experience with Node.js, NestJS, TypeScript and PostgreSQL in production.";

/** Default GUEST_MATCH_LIMIT_PER_DAY of the server (server/src/config/env.validation.ts) — REQ-GUESTMODE-08. */
export const DEFAULT_GUEST_LIMIT = 5;

/** GUEST_TTL_HOURS default: a guest and its session live 24 h (REQ-GUESTMODE-01). */
export const GUEST_TTL_MS = 24 * 3_600_000;

/**
 * Every form the server can see a loopback caller as (Express `req.ip` without trust proxy = socket address): a
 * request to "localhost" lands as ::1 or as an IPv4-mapped 127.0.0.1 depending on how the name resolved. Quota rows
 * are planted for all of them so the test does not depend on which one the dev server sees.
 */
export const LOOPBACK_IPS = ["::1", "127.0.0.1", "::ffff:127.0.0.1"] as const;

/** Next 00:00 UTC — what the server sends as `resetsAt` (guest-usage.service.ts nextUtcMidnight). */
export function nextUtcMidnight(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** "YYYY-MM-DD" of a UTC day, `offsetDays` away from today. */
export function utcDay(offsetDays = 0, now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays))
    .toISOString()
    .slice(0, 10);
}

/** The stubbed POST /match answer of a guest run: a succeeded result on the system key (credentialId null). */
export function systemKeyResult(overrides: Partial<MatchResultDto> = {}): MatchResultDto {
  return {
    id: "00000000-0000-4000-8000-00000000a001",
    cvDocumentId: "00000000-0000-4000-8000-00000000c001",
    jdDocumentId: "00000000-0000-4000-8000-00000000d001",
    overallScore: 78,
    semanticScore: 82,
    keywordScore: 72,
    report: {
      strengths: ["Six years of NestJS in production"],
      gaps: ["No Kubernetes experience mentioned"],
      suggestions: ["Quantify the APIs you built and the traffic they served."],
    },
    credentialId: null,
    provider: "openrouter",
    chatModel: "openai/gpt-4o-mini",
    embedModel: "openai/text-embedding-3-small",
    runId: null,
    status: "succeeded",
    errorCode: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** The 429 body of POST /match once the guest quota is spent (matching.service.ts createMatch). */
export function quotaExceededBody(limit: number, resetsAt: Date, message = "You have used today's free matches.") {
  return { statusCode: 429, code: "GUEST_QUOTA_EXCEEDED", message, limit, resetsAt: resetsAt.toISOString() };
}

/** Text of the "Resets in <h> h <m> min" countdown for `resetsAt` (client/src/utils/auth.ts timeUntil). */
export function resetsInTime(resetsAt: Date, now = Date.now()): string {
  const minutes = Math.max(1, Math.ceil((resetsAt.getTime() - now) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** Score formula of the matching engine: overall = round(0.6 × semantic + 0.4 × keyword). */
export const overallOf = (semantic: number, keyword: number) => Math.round(0.6 * semantic + 0.4 * keyword);
