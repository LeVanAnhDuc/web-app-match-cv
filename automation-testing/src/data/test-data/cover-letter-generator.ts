import type { CoverLetterLanguage, CoverLetterLength, CoverLetterTone } from "#/types/CoverLetters";

// Values of module cover-letter-generator (src/docs/requirements/cover-letter-generator.md). Values only: no DB, no
// network. Seeding and AI stubs that use them live in fixtures/modules/cover-letter-generator.fixture.ts.

/** Server and client cap on a letter body (UpdateCoverLetterDto, CoverLetterModal CONTENT_MAX_LENGTH). */
export const LETTER_MAX = 20_000;

/** POST /cover-letters throttle (cover-letters.controller.ts) and the global one every other route keeps. */
export const GENERATE_LIMIT_PER_MINUTE = 10;
export const GLOBAL_LIMIT_PER_MINUTE = 100;

/** The closed set a failed letter may carry (never a provider's own message). */
export const LETTER_ERROR_CODES = ["invalid_key", "no_quota", "model_unavailable", "timeout", "unreachable"] as const;
export type LetterErrorCode = (typeof LETTER_ERROR_CODES)[number];

export const TONES: readonly CoverLetterTone[] = ["formal", "friendly"];
export const LENGTHS: readonly CoverLetterLength[] = ["short", "standard"];
export const LETTER_LANGUAGES: readonly CoverLetterLanguage[] = ["en", "vi"];

/** Defaults the modal opens with. */
export const DEFAULT_OPTIONS = { tone: "formal", length: "standard", language: "en" } as const;

/** The text a seeded match is built from; the gaps are what the letter must NOT claim. */
export const SAMPLE_CV = "Six years of Node.js and PostgreSQL. Led the migration of a payments API to NestJS.";
export const SAMPLE_JD = "Senior backend engineer. Node.js, PostgreSQL and Kubernetes required. Team leadership a plus.";
export const SAMPLE_REPORT = {
  strengths: ["Six years of Node.js", "PostgreSQL in production"],
  gaps: ["Kubernetes", "Team leadership"],
  suggestions: ["Quantify the payments migration"],
};
/** Overall / semantic / keyword of the seeded succeeded match. */
export const SAMPLE_SCORES: [number, number, number] = [82, 85, 78];

export const LETTER_BODY = "Dear hiring manager,\n\nI am writing to apply for the Senior backend engineer role.";
export const SECOND_LETTER_BODY = "Hello team,\n\nA shorter, friendlier note about why I fit the role.";
/** Markup that must be shown as typed: the letter is plain text. */
export const MARKUP_BODY = "**not bold** and <b>not html</b>";
export const OMITTED = ["Kubernetes", "Team leadership"];

/** Raw API key of a credential created through the API; it must never come back in a response or the DOM. */
export function fakeApiKey(): string {
  return `sk-or-v1-e2e${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Content of exactly `n` characters. */
export const textOfLength = (n: number, char = "a"): string => char.repeat(n);
