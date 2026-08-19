/**
 * Grounding — the machine-checkable half of ADR #13 ("rewrite may only rephrase
 * content that ALREADY EXISTS in the CV; never invent experience, skills or
 * qualifications").
 *
 * The prompt asks the model to behave. This file does not trust it. Every
 * proposed change must be ANCHORED: its `original` has to be a verbatim,
 * UNIQUE excerpt of the CV. A fabricated qualification has nowhere in the CV to
 * anchor to, so it cannot survive as a valid change — at proposal time or at
 * accept time, where the same rules run again against the row in the database.
 *
 * Pure functions on purpose (same reason as `matching/tokenizer.ts`): this is
 * the part most worth testing, so it must be testable without booting Nest.
 */

/** Shorter anchors are ambiguous — a 5-character quote matches half a CV. */
export const MIN_ANCHOR_CHARS = 12;
/** Bounds the payload and stops "rewrite the whole CV" from being one response. */
export const MAX_CHANGES = 25;
export const MAX_REPLACEMENT_CHARS = 1_500;
/**
 * Rewording one bullet does not turn it into four paragraphs. Anything that
 * grows past this is the model WRITING NEW CONTENT rather than rephrasing.
 */
export const REPLACEMENT_GROWTH_FACTOR = 4;
/** Model-authored display strings, capped before they reach the UI. */
export const MAX_SECTION_HINT_CHARS = 60;
export const MAX_RATIONALE_CHARS = 300;
export const MAX_UNADDRESSED_GAPS = 25;

/** Raw, untrusted shape as parsed out of the model's JSON. */
export interface RawCvRewriteChange {
  sectionHint?: unknown;
  original?: unknown;
  replacement?: unknown;
  rationale?: unknown;
  addressesGap?: unknown;
}

export interface GroundedChange {
  id: string;
  sectionHint: string | null;
  /** The span exactly as it appears in the CV — not as the model retyped it. */
  original: string;
  replacement: string;
  rationale: string;
  addressesGap: string | null;
}

export interface AcceptedChange {
  original: string;
  replacement: string;
}

export type ApplyFailure =
  "not_grounded" | "overlapping" | "too_long" | "empty_result";

export type ApplyResult =
  { ok: true; text: string } | { ok: false; reason: ApplyFailure };

interface Span {
  start: number;
  end: number;
}

interface Normalized {
  text: string;
  /** `map[i]` = index in the source string of normalized character `i`. */
  map: Array<number>;
}

/**
 * Collapse every run of whitespace to a single space, keeping a map back to the
 * source offsets.
 *
 * Why anchoring tolerates whitespace at all: PDF/DOCX extraction produces
 * unstable line breaks and spacing, and a model re-typing a quote almost always
 * normalises it. Byte-exact matching would reject nearly every LEGITIMATE
 * change. The invariant is unharmed — the words still have to exist in the CV —
 * only the formatting is forgiven.
 */
function normalize(source: string): Normalized {
  const chars: Array<string> = [];
  const map: Array<number> = [];
  let inWhitespace = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (/\s/.test(char)) {
      if (!inWhitespace) {
        chars.push(" ");
        map.push(index);
        inWhitespace = true;
      }
      continue;
    }
    chars.push(char);
    map.push(index);
    inWhitespace = false;
  }
  return { text: chars.join(""), map };
}

function normalizeNeedle(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Stops at 2: "exactly one" is the only question asked, on a big haystack. */
function isUnique(haystack: string, needle: string): boolean {
  const first = haystack.indexOf(needle);
  if (first === -1) return false;
  return haystack.indexOf(needle, first + 1) === -1;
}

/**
 * Locate `original` inside an ALREADY normalized CV. Returns null when it is
 * absent (the model invented it) OR when it occurs more than once (ambiguous:
 * the user could not tell which occurrence they were approving).
 *
 * Takes the pre-normalized haystack rather than the raw text because callers
 * resolve many anchors against the same CV: normalizing per anchor would walk
 * the whole document once per change, which is work an untrusted change list
 * gets to multiply.
 */
function findAnchorIn(haystack: Normalized, original: string): Span | null {
  const needle = normalizeNeedle(original);
  if (needle.length < MIN_ANCHOR_CHARS) return null;
  if (!isUnique(haystack.text, needle)) return null;

  const index = haystack.text.indexOf(needle);
  return {
    start: haystack.map[index],
    end: haystack.map[index + needle.length - 1] + 1
  };
}

/** Single-anchor convenience wrapper over {@link findAnchorIn}. */
export function findAnchor(cvText: string, original: string): Span | null {
  return findAnchorIn(normalize(cvText), original);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function overlaps(span: Span, taken: Array<Span>): boolean {
  return taken.some(
    (other) => span.start < other.end && other.start < span.end
  );
}

/** A replacement may not outgrow the text it replaces (see the constant). */
function withinSizeBudget(replacement: string, span: Span): boolean {
  if (replacement.length > MAX_REPLACEMENT_CHARS) return false;
  return (
    replacement.length <= (span.end - span.start) * REPLACEMENT_GROWTH_FACTOR
  );
}

/**
 * Keep only the changes that are actually anchored in the CV. Everything the
 * model got wrong — invented quotes, ambiguous quotes, quotes too short to
 * identify, changes that collide with one another, replacements that balloon —
 * is DROPPED rather than shown to the user, so a fabrication never even reaches
 * the approval list.
 */
export function groundChanges(
  cvText: string,
  raw: Array<RawCvRewriteChange>
): Array<GroundedChange> {
  const taken: Array<Span> = [];
  const accepted: Array<{ span: Span; change: Omit<GroundedChange, "id"> }> =
    [];
  const haystack = normalize(cvText);

  // Bound the INPUT, not just the output. The CV is interpolated into the
  // prompt, so a prompt injection inside it can steer the model into emitting
  // thousands of tiny change objects; grounding each one is real work.
  for (const item of raw.slice(0, MAX_CHANGES)) {
    // The model's JSON is untrusted all the way down to element shape.
    if (typeof item !== "object" || item === null) continue;
    const original = asString(item.original);
    const replacement = asString(item.replacement);
    const span = findAnchorIn(haystack, original);
    if (!span) continue;
    if (!withinSizeBudget(replacement, span)) continue;
    if (overlaps(span, taken)) continue;

    taken.push(span);
    const sectionHint = clip(
      asString(item.sectionHint),
      MAX_SECTION_HINT_CHARS
    );
    const addressesGap = clip(asString(item.addressesGap), MAX_RATIONALE_CHARS);
    accepted.push({
      span,
      change: {
        // The CV's own wording, not the model's retyping of it.
        original: cvText.slice(span.start, span.end),
        replacement,
        sectionHint: sectionHint || null,
        rationale: clip(asString(item.rationale), MAX_RATIONALE_CHARS),
        addressesGap: addressesGap || null
      }
    });
  }

  // Document order, so the review list reads top-to-bottom like the CV does.
  return accepted
    .sort((a, b) => a.span.start - b.span.start)
    .map((entry, index) => ({ id: String(index), ...entry.change }));
}

/**
 * Cap the gaps the model says it refused to close. Same treatment as every
 * other model-authored string that reaches the UI — nothing it writes gets to
 * be unbounded just because it is not part of a change.
 */
export function clipGaps(gaps: Array<string>): Array<string> {
  return gaps
    .slice(0, MAX_UNADDRESSED_GAPS)
    .map((gap) => clip(gap, MAX_RATIONALE_CHARS))
    .filter((gap) => gap.length > 0);
}

/**
 * Apply the subset the user approved. Re-derives every anchor from the CV text
 * held in the database, so a caller cannot smuggle in content by POSTing
 * changes that were never proposed: unanchored, overlapping or oversized
 * changes fail the whole request instead of being silently skipped.
 */
export function applyChanges(
  cvText: string,
  accepted: Array<AcceptedChange>
): ApplyResult {
  const resolved: Array<Span & { replacement: string }> = [];
  // Normalized once for the whole set: see findAnchorIn.
  const haystack = normalize(cvText);

  for (const change of accepted) {
    const span = findAnchorIn(haystack, change.original);
    if (!span) return { ok: false, reason: "not_grounded" };
    if (!withinSizeBudget(change.replacement, span)) {
      return { ok: false, reason: "too_long" };
    }
    if (overlaps(span, resolved)) return { ok: false, reason: "overlapping" };
    resolved.push({ ...span, replacement: change.replacement });
  }

  // Splice back-to-front so earlier offsets stay valid.
  const text = resolved
    .sort((a, b) => b.start - a.start)
    .reduce(
      (current, span) =>
        current.slice(0, span.start) +
        span.replacement +
        current.slice(span.end),
      cvText
    );

  if (!text.trim()) return { ok: false, reason: "empty_result" };
  return { ok: true, text };
}
