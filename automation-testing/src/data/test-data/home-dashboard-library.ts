import { uniqueSuffix } from "./shared";

// Values for the home-dashboard-library specs. Match results are seeded straight into the DB (decisions Q3), so these
// are inputs for utils/db.ts — never AI stub bodies: the home screen and the history API never call the AI.

export type HdlReport = { strengths: string[]; gaps: string[]; suggestions: string[] };

/** A report whose every line carries `tag`, so a spec can tell two stored reports apart on screen. */
export function reportFor(tag: string): HdlReport {
  return {
    strengths: [`Strength ${tag}`],
    gaps: [`Gap ${tag}`],
    suggestions: [`Suggestion ${tag}`],
  };
}

/** Unique CV / JD titles for one test (dev DB is shared; titles never collide with another run's leftovers). */
export function titles(label = "Home"): { cv: string; jd: string } {
  const suffix = uniqueSuffix();
  return { cv: `${label} CV ${suffix}`, jd: `${label} JD ${suffix}` };
}

export const CV_TEXT = "Alice Nguyen. Node.js, NestJS, PostgreSQL, REST APIs, 6 years backend.";
export const JD_TEXT = "Senior Backend Engineer. Node.js, NestJS, PostgreSQL, Docker required.";

/** `days` days before now (UTC), for ordering seeded results. */
export const daysAgo = (days: number): Date => new Date(Date.now() - days * 86_400_000);

/** Just before midnight UTC: the calendar day differs in UTC+7 (REQ-HOMEDASHBOARDLIBRARY-18). */
export const NEAR_MIDNIGHT_UTC = "2026-01-15T23:30:00.000Z";

/** Score band boundaries of the recent table (RecentMatches scoreBand): ≥75 success, 50–74 warning, <50 error. */
export const BAND_CASES = [
  { score: 49, band: "error" },
  { score: 50, band: "warning" },
  { score: 74, band: "warning" },
  { score: 75, band: "success" },
] as const;

/** Mirrors StatCards: Math.round of the mean. */
export const roundedAverage = (scores: number[]): number =>
  Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

/** A title of `length` chars with no whitespace (worst case for wrapping). */
export const longTitle = (prefix: string, length = 200): string =>
  (prefix + "X".repeat(length)).slice(0, length);

/** ISO 8601 UTC with Z, as Prisma's Date#toISOString returns. */
export const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
