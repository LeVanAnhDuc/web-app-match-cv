import type { CopyKey } from "@/data/copy";

// Values only module auth uses (src/docs/requirements/auth.md).

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** A well-formed UUID no row has: enough to reach the guard, never a handler's data. */
export const UNKNOWN_ID = "11111111-2222-4333-8444-555555555555";

/** REQ-AUTH-19 — signed-in user only: anonymous AND guest get 401 SIGN_IN_REQUIRED. */
export const USER_ONLY_ENDPOINTS: ReadonlyArray<readonly [Method, string]> = [
  ["GET", "/documents"],
  ["PATCH", `/documents/${UNKNOWN_ID}`],
  ["PATCH", `/documents/${UNKNOWN_ID}/parent`],
  ["DELETE", `/documents/${UNKNOWN_ID}`],
  ["GET", "/match"],
  ["GET", "/ai-credentials"],
  ["GET", "/ai-credentials/providers"],
  ["POST", "/ai-credentials"],
  ["PATCH", `/ai-credentials/${UNKNOWN_ID}`],
  ["DELETE", `/ai-credentials/${UNKNOWN_ID}`],
  ["POST", `/ai-credentials/${UNKNOWN_ID}/test`],
  ["GET", "/cover-letters"],
  ["POST", "/cover-letters"],
  ["PATCH", `/cover-letters/${UNKNOWN_ID}`],
  ["DELETE", `/cover-letters/${UNKNOWN_ID}`],
  ["POST", "/cv-rewrite"],
  ["POST", "/cv-rewrite/accept"],
  ["GET", `/comparisons/${UNKNOWN_ID}`],
  ["GET", "/me/export"],
];

/** REQ-AUTH-20 — open to guests: anonymous gets 401, guest and user pass the guard. */
export const GUEST_ENDPOINTS: ReadonlyArray<readonly [Method, string]> = [
  ["GET", `/documents/${UNKNOWN_ID}`],
  ["GET", `/documents/${UNKNOWN_ID}/file`],
  ["POST", "/match"],
  ["POST", "/match/runs"],
  ["GET", `/match/runs/${UNKNOWN_ID}`],
  ["GET", `/match/${UNKNOWN_ID}`],
];

/** REQ-AUTH-03 — the longest returnTo that survives (2048 characters). */
export const MAX_RETURN_TO = `/${"a".repeat(2047)}`;

/** REQ-AUTH-03 — relative paths kept as they are. */
export const SAFE_RETURN_TO: readonly string[] = ["/", "/wizard?runId=r1", "/cv", "/compare/abc?jd=x%20y", MAX_RETURN_TO];

/** REQ-AUTH-03 — every class that must collapse to "/" (one representative each, plus the 2049 boundary). */
export const UNSAFE_RETURN_TO: ReadonlyArray<{ label: string; value: string | string[] }> = [
  { label: "absolute URL", value: "https://evil.test/x" },
  { label: "protocol-relative", value: "//evil.test/x" },
  { label: "backslash", value: "/\\evil.test" },
  { label: "tab (browsers strip it into //)", value: "/\t/evil.test" },
  { label: "newline", value: "/a\nb" },
  { label: "DEL character", value: "/a\x7fb" },
  { label: "no leading slash", value: "wizard" },
  { label: "javascript scheme", value: "javascript:alert(1)" },
  { label: "empty", value: "" },
  { label: "repeated key", value: ["/a", "/b"] },
  { label: "2049 characters", value: `${MAX_RETURN_TO}a` },
];

/** REQ-AUTH-28 — the six routes behind RequireAuth and their gate title. */
export const GATED_ROUTES: ReadonlyArray<{ path: string; titleKey: CopyKey }> = [
  { path: "/cv", titleKey: "gate.cv" },
  { path: "/jd", titleKey: "gate.jd" },
  { path: "/ai-credentials", titleKey: "gate.aiCredentials" },
  { path: "/my-data", titleKey: "gate.myData" },
  { path: `/compare/${UNKNOWN_ID}`, titleKey: "gate.compare" },
  { path: `/cv-rewrite/${UNKNOWN_ID}`, titleKey: "gate.cvRewrite" },
];

/** REQ-AUTH-26 — every code the callback can send back, with its toast copy. */
export const AUTH_ERROR_CODES = ["denied", "state", "iss", "exchange", "token", "server"] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
export const authErrorKey = (code: AuthErrorCode): CopyKey => `auth.error.${code}`;

/** REQ-AUTH-26 — a code the client does not know falls back to auth.error.generic. */
export const UNKNOWN_AUTH_ERROR = "teapot";

/** REQ-AUTH-12 — SESSION_TTL_DAYS default. */
export const SESSION_TTL_DAYS = 7;
/** REQ-AUTH-02 — mcv_oauth Max-Age in seconds (10 minutes). */
export const OAUTH_MAX_AGE_S = 600;
/** REQ-AUTH-23 — requests per 60 s per route per IP on /auth/login and /auth/callback. */
export const AUTH_THROTTLE_LIMIT = 20;

/** A JD body small enough for POST /documents (no AI involved). */
export const SAMPLE_JD = { kind: "JD", sourceText: "Senior Frontend Engineer — React, TypeScript", save: false } as const;
export const SAMPLE_CV = { kind: "CV", sourceText: "TypeScript NestJS engineer, five years.", save: false } as const;

/** REQ-AUTH-27 — avatar initials as the shell derives them: first + last word of the name, else the email's first letter. */
export function initialsOf(fullName: string | null, email: string | null): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length) return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  return (email?.trim()[0] ?? "?").toUpperCase();
}
