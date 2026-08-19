import {
  GAP_MATCH_THRESHOLD,
  MAX_GAPS_PER_SIDE,
  diffGaps,
  topicTokens
} from "./gap-diff";

// The invariant table of docs/specs/cv-version-comparison/design.md §3.6.
// Every case here is a way the comparison screen could be quietly wrong.

describe("topicTokens", () => {
  it("keeps the subject and drops the words every gap sentence contains", () => {
    expect([...topicTokens("Missing AWS experience")]).toEqual(["aws"]);
  });

  it("folds Vietnamese diacritics, so the same gap written both ways agrees", () => {
    expect([...topicTokens("Thiếu kinh nghiệm Docker")]).toEqual([
      ...topicTokens("Chua co kinh nghiem Docker")
    ]);
  });

  it("applies the shared technical alias table", () => {
    expect([...topicTokens("ReactJS not mentioned")]).toEqual(["react"]);
  });

  it("can come out empty when a gap is nothing but boilerplate", () => {
    expect(topicTokens("Missing relevant experience").size).toBe(0);
  });
});

describe("diffGaps", () => {
  it("treats a reworded gap as still open, not as closed AND new", () => {
    const diff = diffGaps(
      ["No CI/CD experience mentioned"],
      ["CI/CD exposure is still limited to a single tool"]
    );

    expect(diff.persisted).toEqual([
      {
        base: "No CI/CD experience mentioned",
        revision: "CI/CD exposure is still limited to a single tool"
      }
    ]);
    expect(diff.closed).toEqual([]);
    expect(diff.introduced).toEqual([]);
  });

  // [EP] The whole reason GAP_BOILERPLATE exists: these two share two thirds of
  // their raw tokens and are completely different gaps.
  it("[EP] does not merge two gaps that only share filler words", () => {
    const diff = diffGaps(
      ["Missing AWS experience"],
      ["Missing Azure experience"]
    );

    expect(diff.closed).toEqual(["Missing AWS experience"]);
    expect(diff.introduced).toEqual(["Missing Azure experience"]);
    expect(diff.persisted).toEqual([]);
  });

  // [BVA] Threshold is an overlap coefficient over topic tokens: |∩| / min(|A|,|B|).
  it("[BVA] pairs exactly at the threshold and not just below it", () => {
    // 2 shared of a 4-token minimum = 0.5 → at the bound → paired.
    const atBound = diffGaps(
      ["Docker Kubernetes Terraform Ansible"],
      ["Docker Kubernetes Jenkins Grafana Prometheus Datadog"]
    );
    expect(atBound.persisted).toHaveLength(1);

    // 2 shared of a 5-token minimum = 0.4 → below the bound → not paired.
    const belowBound = diffGaps(
      ["Docker Kubernetes Terraform Ansible Packer"],
      ["Docker Kubernetes Jenkins Grafana Prometheus Datadog"]
    );
    expect(belowBound.persisted).toHaveLength(0);
    expect(belowBound.closed).toHaveLength(1);
    expect(belowBound.introduced).toHaveLength(1);

    expect(GAP_MATCH_THRESHOLD).toBe(0.5);
  });

  // First-match would bind to "React testing" (0.5) and then call the real
  // descendant new — wrong twice.
  it("pairs the best candidate first, not the first one over the threshold", () => {
    const diff = diffGaps(
      ["React state management not shown"],
      ["React testing not covered", "Redux state management missing"]
    );

    expect(diff.persisted).toEqual([
      {
        base: "React state management not shown",
        revision: "Redux state management missing"
      }
    ]);
    expect(diff.introduced).toEqual(["React testing not covered"]);
  });

  it("uses each gap at most once", () => {
    const diff = diffGaps(
      ["No Docker experience"],
      ["Docker basics only", "Docker Compose never used"]
    );

    expect(diff.persisted).toHaveLength(1);
    expect(diff.introduced).toHaveLength(1);
    expect(diff.closed).toEqual([]);
  });

  it("matches the same Vietnamese gap written with and without diacritics", () => {
    const diff = diffGaps(
      ["Thiếu kinh nghiệm Docker"],
      ["Chua co kinh nghiem Docker"]
    );

    expect(diff.persisted).toHaveLength(1);
  });

  it("matches through the technical alias table", () => {
    const diff = diffGaps(
      ["ReactJS not mentioned"],
      ["React.js exposure is thin"]
    );

    expect(diff.persisted).toHaveLength(1);
  });

  it("only pairs topic-less gaps when they are the same sentence", () => {
    const same = diffGaps(
      ["Missing relevant experience"],
      ["  missing relevant   EXPERIENCE  "]
    );
    expect(same.persisted).toHaveLength(1);

    const different = diffGaps(
      ["Missing relevant experience"],
      ["Lacking required experience"]
    );
    expect(different.closed).toHaveLength(1);
    expect(different.introduced).toHaveLength(1);
    expect(different.persisted).toEqual([]);
  });

  it("handles an empty list on either or both sides", () => {
    expect(diffGaps([], ["No Docker experience"])).toEqual({
      closed: [],
      persisted: [],
      introduced: ["No Docker experience"]
    });
    expect(diffGaps(["No Docker experience"], [])).toEqual({
      closed: ["No Docker experience"],
      persisted: [],
      introduced: []
    });
    expect(diffGaps([], [])).toEqual({
      closed: [],
      persisted: [],
      introduced: []
    });
  });

  it("keeps document order and survives duplicate gap text", () => {
    const diff = diffGaps(
      [
        "No Kubernetes experience",
        "No Docker experience",
        "No Docker experience"
      ],
      ["No Docker experience", "No Docker experience"]
    );

    expect(diff.closed).toEqual(["No Kubernetes experience"]);
    expect(diff.persisted).toEqual([
      { base: "No Docker experience", revision: "No Docker experience" },
      { base: "No Docker experience", revision: "No Docker experience" }
    ]);
    expect(diff.introduced).toEqual([]);
  });

  it("bounds the pairing work each side can ask for", () => {
    const many = Array.from(
      { length: MAX_GAPS_PER_SIDE + 10 },
      (_, index) => `Gap about topic${index}`
    );

    const diff = diffGaps(many, []);

    expect(diff.closed).toHaveLength(MAX_GAPS_PER_SIDE);
  });
});
