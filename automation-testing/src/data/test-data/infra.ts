// Values of module "infra" (health, Swagger, shared HTTP plumbing). Values only: no .env, no network.

/** Global throttler of server/src/app.module.ts: 100 requests per 60 s per IP, per route (REQ-INFRA-05). */
export const RATE_LIMIT = { limit: 100, ttlSeconds: 60 } as const;

/** Every operation the server ships (REQ-INFRA-03), as "METHOD /api/v1/path" with OpenAPI `{param}` placeholders. */
export const SHIPPED_OPERATIONS: readonly string[] = [
  "GET /api/v1/health",
  "GET /api/v1/auth/login",
  "GET /api/v1/auth/callback",
  "POST /api/v1/auth/logout",
  "GET /api/v1/auth/me",
  "POST /api/v1/documents",
  "GET /api/v1/documents",
  "GET /api/v1/documents/{id}",
  "PATCH /api/v1/documents/{id}",
  "DELETE /api/v1/documents/{id}",
  "PATCH /api/v1/documents/{id}/parent",
  "GET /api/v1/documents/{id}/file",
  "POST /api/v1/match",
  "GET /api/v1/match",
  "GET /api/v1/match/{id}",
  "POST /api/v1/match/runs",
  "GET /api/v1/match/runs/{id}",
  "GET /api/v1/ai-credentials/providers",
  "GET /api/v1/ai-credentials",
  "POST /api/v1/ai-credentials",
  "PATCH /api/v1/ai-credentials/{id}",
  "DELETE /api/v1/ai-credentials/{id}",
  "POST /api/v1/ai-credentials/{id}/test",
  "POST /api/v1/cover-letters",
  "GET /api/v1/cover-letters",
  "PATCH /api/v1/cover-letters/{id}",
  "DELETE /api/v1/cover-letters/{id}",
  "POST /api/v1/cv-rewrite",
  "POST /api/v1/cv-rewrite/accept",
  "GET /api/v1/comparisons/{documentId}",
  "GET /api/v1/me/export",
];

/** Operation tags the OpenAPI document must group endpoints under. */
export const OPENAPI_TAGS = ["auth", "documents", "match", "ai-credentials", "cover-letters", "cv-rewrite", "comparisons", "me"] as const;

/** Stored-secret column names (Prisma AiCredential) that must never appear in the API contract (REQ-INFRA-04). */
export const SECRET_FIELDS = ["encryptedKey", "keyIv", "keyTag"] as const;

/**
 * Provider keys that look real in `text`: a known prefix (OpenAI/OpenRouter `sk-…`, Gemini `AIza…`) followed by 16+
 * key characters that are not just the placeholder "x" ("sk-xxxxxxxxxxxxxxxxxxxxxxxx", the Swagger example, is fine).
 */
export function realLookingKeys(text: string): string[] {
  return [...text.matchAll(/\b(sk|AIza)([-\w]{16,})/g)]
    .filter(([, , rest]) => !/^[-_]*(?:or-|proj-)?[-_x]+$/i.test(rest))
    .map(([key]) => key);
}

/** Helmet headers every API response carries (REQ-INFRA-06), with the value helmet's defaults set. */
export const HELMET_HEADERS: Readonly<Record<string, string | RegExp>> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "content-security-policy": /default-src 'self'/,
  "strict-transport-security": /max-age=\d+/,
  "referrer-policy": "no-referrer",
  "cross-origin-opener-policy": "same-origin",
};

/** An origin that is not CLIENT_ORIGIN. */
export const FOREIGN_ORIGIN = "https://evil.example";

/**
 * What an error body must not contain (REQ-INFRA-10): a JS stack frame, a stack property, Prisma internals, SQL, or a
 * table name of server/prisma/schema.prisma.
 */
export const LEAK_PATTERNS: readonly RegExp[] = [
  /\n\s+at\s/,
  /"stack"\s*:/,
  /\bat [\w.<>]+ \(.*:\d+:\d+\)/,
  /prisma/i,
  /\bP\d{4}\b/,
  /\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/,
  /"(?:User|Session|Document|MatchResult|MatchRun|AiCredential|CoverLetter)"/,
  /node_modules|[A-Za-z]:\\|\/src\/.*\.ts/,
];

/** Pasted CV text for the whitelist check (REQ-INFRA-08). */
export const SAMPLE_CV_TEXT = "Senior TypeScript developer. NestJS, React, PostgreSQL. 6 years of experience.";

/** Swagger contract (server/src/main.ts DocumentBuilder + SwaggerModule defaults). */
export const SWAGGER = { uiTitle: "<title>Swagger UI</title>", apiTitle: "match-cv API" } as const;

/** Origins that must never be echoed back by CORS, derived from the real web origin (REQ-INFRA-07). */
export function foreignOrigins(webOrigin: string): string[] {
  const url = new URL(webOrigin);
  const otherPort = String((Number(url.port || (url.protocol === "https:" ? 443 : 80)) + 1) % 65536);
  return [FOREIGN_ORIGIN, `${url.origin}.evil.example`, `${url.protocol}//${url.hostname}:${otherPort}`, "null"];
}

/** A title one character above the 200-character limit of the document DTOs. */
export const TITLE_OVER_LIMIT = "t".repeat(201);

/** A JSON body cut off mid-object. */
export const MALFORMED_JSON = '{"kind": "CV",';
