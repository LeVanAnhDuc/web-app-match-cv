/**
 * Lineage — reading `Document.parentId` (ADR #15) as a version number.
 *
 * The version is DERIVED by walking the chain, not stored in a column. A stored
 * `version` would be duplicated state that drifts on its very first edge case:
 * `parentId` is `ON DELETE SET NULL`, so deleting the original turns v2 into a
 * root — and a stored column would keep claiming "2" with no v1 in existence.
 * Chains are short, `@@index([parentId])` already exists, and the walk is hard
 * capped. See docs/specs/cv-version-comparison/design.md §4.4.
 *
 * Pure functions on purpose: the caller loads the chain, these decide what it
 * means, and the meaning is testable without a database.
 */

/**
 * Hard stop on any chain walk. Not a business limit — a guarantee that
 * corrupted data (a `parentId` cycle, which the write path forbids but the
 * column itself permits) can never hang a request.
 */
export const MAX_LINEAGE_DEPTH = 20;

/** id → parentId, for every ancestor the caller managed to load. */
export type ParentLookup = Map<string, string | null>;

/**
 * 1 for an original, 2 for its rewrite, and so on. Stops early — and reports
 * the depth reached so far — when the chain runs past what was loaded, so a
 * partially loaded chain degrades to a smaller number rather than to a throw.
 */
export function resolveVersion(id: string, parents: ParentLookup): number {
  let version = 1;
  let current = parents.get(id) ?? null;
  let steps = 0;
  while (current !== null && steps < MAX_LINEAGE_DEPTH) {
    version += 1;
    steps += 1;
    if (!parents.has(current)) break;
    current = parents.get(current) ?? null;
  }
  return version;
}

/**
 * Would linking `childId` to `candidateParentId` close a loop? True when the
 * child already sits on the candidate's own ancestor chain.
 *
 * Guards the manual lineage endpoint: a cycle makes both the version walk and
 * any future ancestor query non-terminating, and no user action should be able
 * to create one.
 */
export function wouldCreateCycle(
  childId: string,
  candidateParentId: string,
  parents: ParentLookup
): boolean {
  if (childId === candidateParentId) return true;
  let current: string | null = candidateParentId;
  let steps = 0;
  while (current !== null && steps < MAX_LINEAGE_DEPTH) {
    if (current === childId) return true;
    current = parents.get(current) ?? null;
    steps += 1;
  }
  return false;
}
