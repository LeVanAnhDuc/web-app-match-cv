import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ComparisonService } from "./comparison.service";
import type { CurrentUserService } from "../../common/current-user/current-user.service";
import type { PrismaService } from "../../prisma/prisma.service";

const USER_ID = "user-1";
const BASE_ID = "cv-v1";
const REVISION_ID = "cv-v2";
const JD_ID = "jd-1";

function doc(over: Record<string, unknown> = {}) {
  return {
    id: REVISION_ID,
    userId: USER_ID,
    kind: "CV",
    title: "Backend Resume (improved)",
    sourceFormat: "text",
    rawText: "…",
    parsedContent: null,
    fileData: null,
    fileMime: null,
    isSaved: true,
    parentId: BASE_ID,
    createdAt: new Date("2026-08-09T00:00:00.000Z"),
    ...over
  };
}

function match(over: Record<string, unknown> = {}) {
  return {
    id: "match-1",
    cvDocumentId: REVISION_ID,
    jdDocumentId: JD_ID,
    overallScore: 75,
    semanticScore: 78,
    keywordScore: 71,
    provider: "openrouter",
    chatModel: "openai/gpt-4o-mini",
    embedModel: "openai/text-embedding-3-small",
    report: { strengths: [], gaps: [], suggestions: [] },
    status: "succeeded",
    createdAt: new Date("2026-08-09T02:00:00.000Z"),
    jdDocument: { title: "Senior Backend Engineer" },
    ...over
  };
}

/** Prisma double: documents answered by id, matches answered as one list. */
function build(options: {
  documents: Array<ReturnType<typeof doc>>;
  matches?: Array<ReturnType<typeof match>>;
}) {
  const findMany = jest.fn().mockResolvedValue(options.matches ?? []);
  const prisma = {
    document: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          options.documents.find((entry) => entry.id === where.id) ?? null
        )
      )
    },
    matchResult: { findMany }
  } as unknown as PrismaService;
  const currentUser: CurrentUserService = {
    getUserId: () => USER_ID
  };
  return {
    service: new ComparisonService(prisma, currentUser),
    findMany
  };
}

describe("ComparisonService.compare", () => {
  it("rejects a document that is not the caller's", async () => {
    const { service } = build({ documents: [] });

    await expect(service.compare(REVISION_ID, {})).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("rejects a JD — only a CV has previous versions", async () => {
    const { service } = build({
      documents: [doc({ kind: "JD" })]
    });

    await expect(service.compare(REVISION_ID, {})).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejects a CV that was never declared a new version of anything", async () => {
    const { service } = build({
      documents: [doc({ parentId: null })]
    });

    await expect(service.compare(REVISION_ID, {})).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("numbers the versions from the parentId chain", async () => {
    const { service } = build({
      documents: [
        doc(),
        doc({ id: BASE_ID, title: "Backend Resume", parentId: null })
      ]
    });

    const result = await service.compare(REVISION_ID, {});

    expect(result.base.version).toBe(1);
    expect(result.revision.version).toBe(2);
    expect(result.base.title).toBe("Backend Resume");
  });

  it("reports the signed delta and the gap diff when both sides ran", async () => {
    const { service } = build({
      documents: [doc(), doc({ id: BASE_ID, parentId: null })],
      matches: [
        match({
          report: { gaps: ["CI/CD exposure is still thin", "No Terraform"] }
        }),
        match({
          id: "match-0",
          cvDocumentId: BASE_ID,
          overallScore: 61,
          semanticScore: 70,
          keywordScore: 48,
          report: {
            gaps: ["No CI/CD experience mentioned", "Kubernetes not mentioned"]
          },
          createdAt: new Date("2026-08-08T02:00:00.000Z")
        })
      ]
    });

    const result = await service.compare(REVISION_ID, {});

    expect(result.delta).toEqual({ overall: 14, semantic: 8, keyword: 23 });
    expect(result.gapDiff?.persisted).toEqual([
      {
        base: "No CI/CD experience mentioned",
        revision: "CI/CD exposure is still thin"
      }
    ]);
    expect(result.gapDiff?.closed).toEqual(["Kubernetes not mentioned"]);
    expect(result.gapDiff?.introduced).toEqual(["No Terraform"]);
    expect(result.sameChatModel).toBe(true);
    expect(result.sameEmbedModel).toBe(true);
  });

  it("reports a negative delta rather than hiding a regression", async () => {
    const { service } = build({
      documents: [doc(), doc({ id: BASE_ID, parentId: null })],
      matches: [
        match({ overallScore: 55, semanticScore: 60, keywordScore: 47 }),
        match({
          id: "match-0",
          cvDocumentId: BASE_ID,
          overallScore: 61,
          semanticScore: 70,
          keywordScore: 48,
          createdAt: new Date("2026-08-08T02:00:00.000Z")
        })
      ]
    });

    const result = await service.compare(REVISION_ID, {});

    expect(result.delta).toEqual({ overall: -6, semantic: -10, keyword: -1 });
  });

  it("leaves delta and gapDiff null when the new version was never matched", async () => {
    const { service } = build({
      documents: [doc(), doc({ id: BASE_ID, parentId: null })],
      matches: [match({ id: "match-0", cvDocumentId: BASE_ID })]
    });

    const result = await service.compare(REVISION_ID, {});

    // Zeroes would read as "no improvement at all", which is a different claim.
    expect(result.delta).toBeNull();
    expect(result.gapDiff).toBeNull();
    expect(result.revisionResult).toBeNull();
    expect(result.baseResult).not.toBeNull();
  });

  // Failed rows store 0/0/0 (multi-provider-compare), so letting one through
  // would render an invented -100%.
  it("only asks the database for succeeded runs of the two versions", async () => {
    const { service, findMany } = build({
      documents: [doc(), doc({ id: BASE_ID, parentId: null })]
    });

    await service.compare(REVISION_ID, {});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER_ID,
          cvDocumentId: { in: [BASE_ID, REVISION_ID] },
          status: "succeeded"
        }
      })
    );
  });

  it("prefers the base run that used the same models as the new one", async () => {
    const { service } = build({
      documents: [doc(), doc({ id: BASE_ID, parentId: null })],
      matches: [
        match({ chatModel: "openai/gpt-4o-mini" }),
        // Newest base run, but a different model pair.
        match({
          id: "base-gemini",
          cvDocumentId: BASE_ID,
          chatModel: "gemini-2.0-flash",
          embedModel: "text-embedding-004",
          overallScore: 90,
          createdAt: new Date("2026-08-08T10:00:00.000Z")
        }),
        match({
          id: "base-same-model",
          cvDocumentId: BASE_ID,
          overallScore: 61,
          createdAt: new Date("2026-08-08T02:00:00.000Z")
        })
      ]
    });

    const result = await service.compare(REVISION_ID, {});

    expect(result.baseResult?.matchResultId).toBe("base-same-model");
    expect(result.delta?.overall).toBe(14);
    expect(result.sameEmbedModel).toBe(true);
  });

  it("flags an unavoidable cross-model comparison instead of hiding it", async () => {
    const { service } = build({
      documents: [doc(), doc({ id: BASE_ID, parentId: null })],
      matches: [
        match(),
        match({
          id: "base-gemini",
          cvDocumentId: BASE_ID,
          chatModel: "gemini-2.0-flash",
          embedModel: "text-embedding-004",
          createdAt: new Date("2026-08-08T02:00:00.000Z")
        })
      ]
    });

    const result = await service.compare(REVISION_ID, {});

    expect(result.sameChatModel).toBe(false);
    expect(result.sameEmbedModel).toBe(false);
    // Still compared — the caller is warned, not blocked.
    expect(result.delta).not.toBeNull();
  });

  it("lists every JD either version was matched against", async () => {
    const { service } = build({
      documents: [doc(), doc({ id: BASE_ID, parentId: null })],
      matches: [
        match(),
        match({ id: "m2", cvDocumentId: BASE_ID }),
        match({
          id: "m3",
          cvDocumentId: BASE_ID,
          jdDocumentId: "jd-2",
          jdDocument: { title: "Platform Engineer" },
          createdAt: new Date("2026-08-07T00:00:00.000Z")
        })
      ]
    });

    const result = await service.compare(REVISION_ID, {});

    expect(result.jdOptions).toEqual([
      {
        id: JD_ID,
        title: "Senior Backend Engineer",
        hasBase: true,
        hasRevision: true
      },
      {
        id: "jd-2",
        title: "Platform Engineer",
        hasBase: true,
        hasRevision: false
      }
    ]);
    // Defaults to the JD where both sides exist.
    expect(result.jdDocumentId).toBe(JD_ID);
  });

  it("rejects a JD neither version was matched against", async () => {
    const { service } = build({
      documents: [doc(), doc({ id: BASE_ID, parentId: null })],
      matches: [match()]
    });

    // Silently falling back to another JD would show numbers about a job
    // description the user did not pick.
    await expect(
      service.compare(REVISION_ID, { jdDocumentId: "jd-unrelated" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns an empty shell when neither version has ever been matched", async () => {
    const { service } = build({
      documents: [doc(), doc({ id: BASE_ID, parentId: null })]
    });

    const result = await service.compare(REVISION_ID, {});

    expect(result.jdOptions).toEqual([]);
    expect(result.jdDocumentId).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.baseResult).toBeNull();
    expect(result.revisionResult).toBeNull();
  });
});
