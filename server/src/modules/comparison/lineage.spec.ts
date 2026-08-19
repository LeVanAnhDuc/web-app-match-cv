import {
  MAX_LINEAGE_DEPTH,
  resolveVersion,
  wouldCreateCycle,
  type ParentLookup
} from "./lineage";

function chain(entries: Array<[string, string | null]>): ParentLookup {
  return new Map(entries);
}

describe("resolveVersion", () => {
  it("calls a document with no parent version 1", () => {
    expect(resolveVersion("a", chain([["a", null]]))).toBe(1);
  });

  it("counts a three-generation chain", () => {
    const parents = chain([
      ["v1", null],
      ["v2", "v1"],
      ["v3", "v2"]
    ]);

    expect(resolveVersion("v3", parents)).toBe(3);
    expect(resolveVersion("v2", parents)).toBe(2);
    expect(resolveVersion("v1", parents)).toBe(1);
  });

  it("stops where the loaded chain stops instead of throwing", () => {
    // "v1" was never loaded — the walk counts what it knows and returns.
    expect(resolveVersion("v2", chain([["v2", "v1"]]))).toBe(2);
  });

  it("terminates on a cycle the column technically permits", () => {
    const looped = chain([
      ["a", "b"],
      ["b", "a"]
    ]);

    expect(resolveVersion("a", looped)).toBe(MAX_LINEAGE_DEPTH + 1);
  });
});

describe("wouldCreateCycle", () => {
  it("rejects pointing a document at itself", () => {
    expect(wouldCreateCycle("a", "a", chain([["a", null]]))).toBe(true);
  });

  it("rejects pointing a document at its own descendant", () => {
    const parents = chain([
      ["v1", null],
      ["v2", "v1"]
    ]);

    // v1.parent = v2 would close the loop v1 → v2 → v1.
    expect(wouldCreateCycle("v1", "v2", parents)).toBe(true);
  });

  it("allows an unrelated document", () => {
    const parents = chain([
      ["v1", null],
      ["other", null]
    ]);

    expect(wouldCreateCycle("v1", "other", parents)).toBe(false);
  });

  it("terminates on an already corrupted chain", () => {
    const looped = chain([
      ["a", "b"],
      ["b", "a"]
    ]);

    expect(wouldCreateCycle("c", "a", looped)).toBe(false);
  });
});
