import {
  MAX_CHANGES,
  MAX_RATIONALE_CHARS,
  MAX_REPLACEMENT_CHARS,
  MAX_UNADDRESSED_GAPS,
  MIN_ANCHOR_CHARS,
  REPLACEMENT_GROWTH_FACTOR,
  applyChanges,
  clipGaps,
  findAnchor,
  groundChanges
} from "./grounding";

// These tests ARE the enforcement of ADR #13 (design.md §3 "Cách feature này
// được verify"). Each block maps to one row of that table.

const CV = [
  "Nguyen Van A — Backend Engineer",
  "",
  "EXPERIENCE",
  "- Built REST APIs with Node.js and Express for an internal billing system.",
  "- Led the migration of a monolith to three services, cutting deploy time.",
  "",
  "EDUCATION",
  "- BSc Computer Science, Hanoi University of Science and Technology."
].join("\n");

const API_BULLET =
  "Built REST APIs with Node.js and Express for an internal billing system.";

describe("findAnchor", () => {
  it("locates a verbatim excerpt", () => {
    const span = findAnchor(CV, API_BULLET);
    expect(span).not.toBeNull();
    expect(CV.slice(span!.start, span!.end)).toBe(API_BULLET);
  });

  it("tolerates whitespace differences the parser or the model introduced", () => {
    const retyped =
      "Built  REST APIs with Node.js\n and Express for an internal billing system.";
    const span = findAnchor(CV, retyped);
    expect(span).not.toBeNull();
    expect(CV.slice(span!.start, span!.end)).toBe(API_BULLET);
  });

  it("rejects an excerpt that is not in the CV (the model invented it)", () => {
    expect(
      findAnchor(CV, "Certified Kubernetes Administrator since 2019")
    ).toBeNull();
  });

  it("rejects an ambiguous excerpt that occurs twice", () => {
    const repeated = `${API_BULLET}\nfiller\n${API_BULLET}`;
    expect(findAnchor(repeated, API_BULLET)).toBeNull();
  });

  it("rejects anchors below the minimum length but accepts the boundary", () => {
    const source = "abcdefghijkl mnopqrstuvwx"; // two 12-char words
    expect(findAnchor(source, "abcdefghijk")).toBeNull(); // 11 = min - 1
    expect(findAnchor(source, "abcdefghijkl")).not.toBeNull(); // 12 = min
    expect(MIN_ANCHOR_CHARS).toBe(12);
  });
});

describe("groundChanges", () => {
  it("keeps a grounded change and returns the CV's own wording", () => {
    const [change] = groundChanges(CV, [
      {
        sectionHint: "Experience",
        original:
          "Built  REST APIs with Node.js and Express for an internal billing system.",
        replacement: "Built and documented REST APIs with Node.js and Express.",
        rationale: "Mentions documentation, which the JD asks for.",
        addressesGap: "API documentation"
      }
    ]);
    expect(change.original).toBe(API_BULLET);
    expect(change.sectionHint).toBe("Experience");
    expect(change.addressesGap).toBe("API documentation");
  });

  it("drops a change whose anchor was invented", () => {
    expect(
      groundChanges(CV, [
        {
          original: "Managed a team of twelve engineers at Google.",
          replacement:
            "Managed a team of twelve engineers at Google, hiring four."
        }
      ])
    ).toHaveLength(0);
  });

  it("drops an ambiguous anchor", () => {
    const repeated = `${API_BULLET}\nfiller line here\n${API_BULLET}`;
    expect(
      groundChanges(repeated, [
        { original: API_BULLET, replacement: "Built REST APIs." }
      ])
    ).toHaveLength(0);
  });

  it("drops the second of two overlapping changes", () => {
    const result = groundChanges(CV, [
      { original: API_BULLET, replacement: "Built REST APIs." },
      {
        original: "REST APIs with Node.js and Express",
        replacement: "REST APIs with Node.js, Express and OpenAPI"
      }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe(API_BULLET);
  });

  it("drops a replacement that outgrows its anchor, and keeps the boundary", () => {
    const budget = API_BULLET.length * REPLACEMENT_GROWTH_FACTOR;
    const atMax = groundChanges(CV, [
      { original: API_BULLET, replacement: "x".repeat(budget) }
    ]);
    const overMax = groundChanges(CV, [
      { original: API_BULLET, replacement: "x".repeat(budget + 1) }
    ]);
    expect(atMax).toHaveLength(1);
    expect(overMax).toHaveLength(0);
  });

  it("drops a replacement past the absolute character ceiling", () => {
    const long = "y".repeat(MAX_REPLACEMENT_CHARS + 1);
    const anchor = "z".repeat(MAX_REPLACEMENT_CHARS); // budget would allow it
    expect(
      groundChanges(anchor, [{ original: anchor, replacement: long }])
    ).toHaveLength(0);
  });

  it("treats an empty replacement as a valid removal", () => {
    const result = groundChanges(CV, [
      { original: API_BULLET, replacement: "" }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].replacement).toBe("");
  });

  it("returns changes in document order whatever order the model used", () => {
    const lines = [
      "Delivered project number one on schedule.",
      "Delivered project number two on schedule.",
      "Delivered project number three on schedule."
    ];
    const source = lines.join("\n");
    const raw = [...lines]
      .reverse()
      .map((line) => ({ original: line, replacement: `${line} Twice.` }));

    const result = groundChanges(source, raw);

    expect(result.map((change) => change.original)).toEqual(lines);
  });

  it("stops grounding past the cap instead of walking the whole list", () => {
    // The cap bounds the WORK, not just the output: the CV goes into the
    // prompt, so an injected instruction could ask for thousands of changes.
    const lines = Array.from(
      { length: MAX_CHANGES + 5 },
      (_, index) => `Delivered project number ${index} on schedule.`
    );
    const source = lines.join("\n");
    const raw = lines.map((line) => ({
      original: line,
      replacement: `${line} Twice.`
    }));

    const result = groundChanges(source, raw);

    expect(result).toHaveLength(MAX_CHANGES);
    expect(result[0].original).toBe(lines[0]);
  });

  it("skips a malformed entry instead of throwing", () => {
    const raw = [
      null,
      "not an object",
      { original: API_BULLET, replacement: "Built REST APIs." }
    ] as unknown as Array<Parameters<typeof groundChanges>[1][number]>;

    const result = groundChanges(CV, raw);

    expect(result).toHaveLength(1);
    expect(result[0].original).toBe(API_BULLET);
  });
});

describe("clipGaps", () => {
  it("caps both the number of gaps and the length of each", () => {
    const gaps = Array.from({ length: MAX_UNADDRESSED_GAPS + 5 }, () =>
      "g".repeat(MAX_RATIONALE_CHARS + 50)
    );

    const result = clipGaps([...gaps, "   "]);

    expect(result).toHaveLength(MAX_UNADDRESSED_GAPS);
    expect(result[0]).toHaveLength(MAX_RATIONALE_CHARS);
  });
});

describe("applyChanges", () => {
  it("rewrites only the approved spans and leaves the rest byte-for-byte", () => {
    const result = applyChanges(CV, [
      { original: API_BULLET, replacement: "Built and documented REST APIs." }
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain("Built and documented REST APIs.");
    expect(result.text).not.toContain(API_BULLET);
    // Untouched content survives verbatim — this is what "the user approved
    // three of five changes" has to mean.
    expect(result.text).toContain(
      "- Led the migration of a monolith to three services, cutting deploy time."
    );
    expect(result.text).toContain(
      "- BSc Computer Science, Hanoi University of Science and Technology."
    );
  });

  it("applies several changes without corrupting later offsets", () => {
    const result = applyChanges(CV, [
      { original: API_BULLET, replacement: "A." },
      {
        original:
          "BSc Computer Science, Hanoi University of Science and Technology.",
        replacement: "BSc Computer Science (HUST)."
      }
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain("- A.");
    expect(result.text).toContain("- BSc Computer Science (HUST).");
  });

  it("refuses the whole request when a change is not grounded", () => {
    expect(
      applyChanges(CV, [
        { original: "Certified Kubernetes Administrator", replacement: "x" }
      ])
    ).toEqual({ ok: false, reason: "not_grounded" });
  });

  it("refuses overlapping changes rather than silently dropping one", () => {
    const result = applyChanges(CV, [
      { original: API_BULLET, replacement: "Built REST APIs." },
      {
        original: "REST APIs with Node.js and Express",
        replacement: "REST APIs with Node.js"
      }
    ]);
    expect(result).toEqual({ ok: false, reason: "overlapping" });
  });

  it("refuses an oversized replacement", () => {
    const result = applyChanges(CV, [
      {
        original: API_BULLET,
        replacement: "x".repeat(
          API_BULLET.length * REPLACEMENT_GROWTH_FACTOR + 1
        )
      }
    ]);
    expect(result).toEqual({ ok: false, reason: "too_long" });
  });

  it("refuses a set of changes that would empty the CV", () => {
    const source = "Backend engineer with Node.js";
    expect(
      applyChanges(source, [{ original: source, replacement: "" }])
    ).toEqual({ ok: false, reason: "empty_result" });
  });
});
