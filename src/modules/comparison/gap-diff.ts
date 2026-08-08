/**
 * Gap diffing — deciding when a gap reported against CV v1 and a gap reported
 * against CV v2 are THE SAME GAP.
 *
 * `report.gaps` is free text written by an LLM, regenerated from scratch on
 * every match. The same underlying problem comes back reworded:
 *
 *   v1: "No CI/CD experience mentioned"
 *   v2: "CI/CD exposure is still limited to a single tool"
 *
 * Comparing those strings literally reports the gap as BOTH closed AND new, so
 * a naive implementation renders "5 closed, 5 new" on every single comparison —
 * a screen that is always wrong and always looks plausible. This module exists
 * because that is the easiest thing in the feature to get quietly wrong.
 *
 * The approach is topic-token overlap over `matching/tokenizer.ts`: free, pure,
 * deterministic and unit-testable, and it inherits the tokenizer's Unicode /
 * Vietnamese folding and technical alias table for nothing. Embeddings and an
 * extra LLM call were both rejected — a read-only comparison screen must not
 * spend an AI call or send the user's data out again
 * (docs/specs/cv-version-comparison/design.md §2, §3.1).
 *
 * Its failure modes are real and are documented in design.md §3.4. The most
 * important one: gaps phrased with disjoint vocabulary ("No container
 * orchestration experience" vs "Kubernetes not mentioned") split into
 * closed + new. Bag-of-words cannot fix that, so the UI always renders the
 * verbatim text of every gap and labels the classification an estimate.
 *
 * Pure functions on purpose (same reason as `matching/tokenizer.ts` and
 * `cv-rewrite/grounding.ts`): this is the part most worth testing, so it must
 * be testable without booting Nest.
 */

import { tokenize } from "../matching/tokenizer";

/**
 * Overlap coefficient a pair must reach to be called the same gap.
 *
 * Overlap (|A∩B| / min(|A|,|B|)) rather than Jaccard or Dice: a v2 gap is
 * usually LONGER and more specific than the v1 gap it descends from, and both
 * of those metrics punish that length asymmetry. Dice scores the CI/CD example
 * above at 0.44 and would miss the single most common real case. min() in the
 * denominator asks the right question: does the shorter gap sit inside the
 * other one's topic?
 */
export const GAP_MATCH_THRESHOLD = 0.5;

/** Bounds the O(n·m) pairing over two model-authored lists. */
export const MAX_GAPS_PER_SIDE = 50;

/**
 * Words that appear in gap sentences REGARDLESS of what the gap is about.
 * Written folded/lowercased, because `tokenize()` runs first.
 *
 * This list deliberately INVERTS the rule of thumb in `matching/tokenizer.ts`.
 * There, a word that is arguably a stopword and arguably a keyword is left OUT,
 * because filtering a real keyword corrupts a score. Here the risk runs the
 * other way: KEEPING a boilerplate word merges two unrelated gaps.
 * "Missing AWS experience" and "Missing Azure experience" share
 * {missing, experience} — two thirds of their tokens — and would be reported as
 * one persisting gap. Stripped, they are {aws} and {azure}: disjoint, and
 * classified correctly.
 *
 * It lives here and NOT in the tokenizer because it serves gap comparison, not
 * scoring: dropping "experience" from the keyword leg would throw away a word
 * JDs genuinely ask for. Met a new filler word? Add one line.
 */
const GAP_BOILERPLATE = new Set([
  // English — the vocabulary of "the CV does not show X"
  "experience",
  "experiences",
  "exposure",
  "background",
  "knowledge",
  "expertise",
  "proficiency",
  "familiarity",
  "understanding",
  "skill",
  "skills",
  "missing",
  "miss",
  "lack",
  "lacks",
  "lacking",
  "absent",
  "mention",
  "mentions",
  "mentioned",
  "demonstrate",
  "demonstrates",
  "demonstrated",
  "show",
  "shows",
  "shown",
  "evidence",
  "provide",
  "provided",
  "include",
  "included",
  "list",
  "listed",
  "describe",
  "described",
  "detail",
  "details",
  "example",
  "examples",
  "project",
  "projects",
  "role",
  "roles",
  "position",
  "candidate",
  "profile",
  "cv",
  "resume",
  "jd",
  "job",
  "require",
  "requires",
  "required",
  "requirement",
  "requirements",
  "need",
  "needs",
  "needed",
  "year",
  "years",
  "level",
  "limited",
  "explicit",
  "explicitly",
  "clear",
  "clearly",
  "specific",
  "specifically",
  "work",
  "worked",
  "working",
  "use",
  "used",
  "using",
  "ability",
  "able",
  // Qualifiers a gap sentence reaches for without naming a subject
  "relevant",
  "relevance",
  "prior",
  "previous",
  "recent",
  "direct",
  "formal",
  "professional",
  "practical",
  "hands",
  "strong",
  "solid",
  "deep",
  "broad",
  "significant",
  "substantial",
  "sufficient",
  "adequate",
  "extensive",
  "enough",
  // Vietnamese — written WITHOUT diacritics (foldDiacritics runs first).
  // Syllable-level, matching ADR #14: `kinh nghiem` is two tokens, so both
  // syllables have to be listed.
  "kinh",
  "nghiem",
  "thieu",
  "ro",
  "ung",
  "vien",
  // `tri` is "vị trí" (position) but also the first syllable of "trí tuệ"
  // (intelligence). Dropping it is the lesser evil: keeping it merges
  // position-gaps with each other anyway, and merging errs toward "still open",
  // which is the safe direction (design.md §3.4).
  "tri",
  "yeu",
  "cau",
  "nam",
  "cong",
  "viec",
  "ky",
  "nang",
  "hien",
  "lam",
  "su",
  "dung",
  "kien",
  "thuc",
  "trinh",
  "chuc",
  "vu"
]);

export interface GapPair {
  base: string;
  revision: string;
}

export interface GapDiff {
  /** Reported against the old version, gone from the new one. */
  closed: Array<string>;
  /** Same gap, both wordings kept — how it was rephrased is itself a signal. */
  persisted: Array<GapPair>;
  /** Only in the new version. */
  introduced: Array<string>;
}

/** The topic of a gap: its tokens minus the words every gap sentence contains. */
export function topicTokens(gap: string): Set<string> {
  const topic = new Set<string>();
  for (const token of tokenize(gap)) {
    if (!GAP_BOILERPLATE.has(token)) topic.add(token);
  }
  return topic;
}

/**
 * Last resort for a gap whose topic set came out EMPTY ("Missing relevant
 * experience" is nothing but boilerplate). With no topic there is nothing to
 * overlap, so such a gap may only pair by being the same sentence — never by
 * matching the empty set against everything.
 */
function normalizeText(gap: string): string {
  return gap.trim().replace(/\s+/g, " ").toLowerCase();
}

/** |A ∩ B| / min(|A|, |B|). 0 when either side is empty. */
function overlapSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const token of small) {
    if (large.has(token)) shared += 1;
  }
  return shared / small.size;
}

interface Candidate {
  baseIndex: number;
  revisionIndex: number;
  score: number;
}

/**
 * Classify every gap of both versions into closed / persisted / introduced.
 *
 * Pairing is GLOBAL BEST-FIRST, not first-match. Given base
 * "React state management not shown" and revisions
 * ["React testing not covered", "Redux state management missing"], first-match
 * would bind to whichever revision cleared the threshold first and then call
 * the real descendant "new" — wrong twice. Sorting all candidate pairs by
 * similarity binds the 0.67 pair before the 0.5 one.
 */
export function diffGaps(
  baseGaps: Array<string>,
  revisionGaps: Array<string>
): GapDiff {
  const base = baseGaps.slice(0, MAX_GAPS_PER_SIDE);
  const revision = revisionGaps.slice(0, MAX_GAPS_PER_SIDE);
  const baseTopics = base.map(topicTokens);
  const revisionTopics = revision.map(topicTokens);
  const baseText = base.map(normalizeText);
  const revisionText = revision.map(normalizeText);

  const candidates: Array<Candidate> = [];
  for (let i = 0; i < base.length; i += 1) {
    for (let j = 0; j < revision.length; j += 1) {
      if (baseText[i] === revisionText[j]) {
        candidates.push({ baseIndex: i, revisionIndex: j, score: 1 });
        continue;
      }
      const score = overlapSimilarity(baseTopics[i], revisionTopics[j]);
      if (score >= GAP_MATCH_THRESHOLD && score > 0) {
        candidates.push({ baseIndex: i, revisionIndex: j, score });
      }
    }
  }

  // Ties broken by position so the result is fully deterministic — the same two
  // reports must always produce the same screen.
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.baseIndex - b.baseIndex ||
      a.revisionIndex - b.revisionIndex
  );

  const usedBase = new Set<number>();
  const usedRevision = new Set<number>();
  const matched: Array<Candidate> = [];
  for (const candidate of candidates) {
    if (usedBase.has(candidate.baseIndex)) continue;
    if (usedRevision.has(candidate.revisionIndex)) continue;
    usedBase.add(candidate.baseIndex);
    usedRevision.add(candidate.revisionIndex);
    matched.push(candidate);
  }

  return {
    closed: base.filter((_, index) => !usedBase.has(index)),
    // Back to document order, so the list reads like the report it came from.
    // Sorted by index rather than by text: two gaps can be the same string.
    persisted: matched
      .sort((a, b) => a.baseIndex - b.baseIndex)
      .map((candidate) => ({
        base: base[candidate.baseIndex],
        revision: revision[candidate.revisionIndex]
      })),
    introduced: revision.filter((_, index) => !usedRevision.has(index))
  };
}
