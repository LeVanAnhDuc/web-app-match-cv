import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CvRewriteService } from "./cv-rewrite.service";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const MATCH_ID = "11111111-1111-1111-1111-111111111111";
const CV_ID = "22222222-2222-2222-2222-222222222222";
const JD_ID = "33333333-3333-3333-3333-333333333333";
const CRED_ID = "44444444-4444-4444-4444-444444444444";

const CV_TEXT = [
  "EXPERIENCE",
  "- Built REST APIs with Node.js and Express for an internal billing system.",
  "- Led the migration of a monolith to three services, cutting deploy time."
].join("\n");

const API_BULLET =
  "Built REST APIs with Node.js and Express for an internal billing system.";

const SYSTEM_CFG = {
  provider: "openrouter" as const,
  apiKey: "system-key-000000000000",
  baseUrl: "https://openrouter.ai/api/v1",
  chatModel: "openai/gpt-4o-mini",
  embedModel: "openai/text-embedding-3-small"
};

interface HarnessOptions {
  matchStatus?: "succeeded" | "failed";
  matchMissing?: boolean;
  rawChanges?: Array<Record<string, unknown>>;
  unaddressedGaps?: string[];
}

type CreateDocumentArgs = [{ data: Record<string, unknown> }];

/** Every collaborator stubbed — no DB, no network. */
function makeHarness(options: HarnessOptions = {}) {
  const createDocument = jest.fn<
    Promise<Record<string, unknown>>,
    CreateDocumentArgs
  >(({ data }) =>
    Promise.resolve({
      id: "created-id",
      sourceFormat: "text",
      isSaved: true,
      createdAt: new Date(),
      ...data
    })
  );
  const ai = {
    systemRuntimeConfig: jest.fn().mockReturnValue(SYSTEM_CFG),
    generateCvRewrite: jest.fn().mockResolvedValue({
      changes: options.rawChanges ?? [],
      unaddressedGaps: options.unaddressedGaps ?? []
    })
  };
  const prisma = {
    matchResult: {
      findFirst: jest.fn().mockResolvedValue(
        options.matchMissing
          ? null
          : {
              id: MATCH_ID,
              userId: USER_ID,
              cvDocumentId: CV_ID,
              jdDocumentId: JD_ID,
              status: options.matchStatus ?? "succeeded",
              report: {
                strengths: [],
                gaps: ["No CI/CD experience"],
                suggestions: ["Mention pipelines"]
              }
            }
      )
    },
    document: {
      findFirst: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve({
            id: where.id,
            userId: USER_ID,
            title: where.id === CV_ID ? "My CV" : "The JD",
            kind: where.id === CV_ID ? "CV" : "JD",
            rawText: where.id === CV_ID ? CV_TEXT : "JD text here"
          })
        ),
      create: createDocument,
      update: jest.fn()
    }
  };
  const currentUser = { getUserId: jest.fn().mockReturnValue(USER_ID) };
  const credentials = {
    getRuntimeConfig: jest
      .fn()
      .mockResolvedValue({ ...SYSTEM_CFG, provider: "openai" }),
    markUsed: jest.fn().mockResolvedValue(undefined)
  };

  const service = new CvRewriteService(
    ai as never,
    prisma as never,
    currentUser,
    credentials as never
  );
  return { service, ai, prisma, credentials, createDocument };
}

describe("CvRewriteService.generate", () => {
  it("returns only changes anchored in the stored CV", async () => {
    const { service } = makeHarness({
      rawChanges: [
        {
          sectionHint: "Experience",
          original: API_BULLET,
          replacement: "Built and deployed REST APIs with Node.js and Express.",
          rationale: "Mentions deployment",
          addressesGap: "No CI/CD experience"
        },
        {
          // Pure fabrication — no anchor in the CV.
          original: "Certified Kubernetes Administrator since 2019",
          replacement: "Certified Kubernetes Administrator since 2019 (CKA)."
        }
      ],
      unaddressedGaps: ["5 years of Kubernetes"]
    });

    const proposal = await service.generate({ matchResultId: MATCH_ID });

    expect(proposal.changes).toHaveLength(1);
    expect(proposal.changes[0].original).toBe(API_BULLET);
    expect(JSON.stringify(proposal)).not.toContain("Kubernetes Administrator");
    expect(proposal.unaddressedGaps).toEqual(["5 years of Kubernetes"]);
    expect(proposal.cvTitle).toBe("My CV");
  });

  it("runs on the system key when no credential is supplied", async () => {
    const { service, ai, credentials } = makeHarness();
    const proposal = await service.generate({ matchResultId: MATCH_ID });
    expect(ai.systemRuntimeConfig).toHaveBeenCalled();
    expect(credentials.getRuntimeConfig).not.toHaveBeenCalled();
    expect(proposal.provider).toBe("openrouter");
  });

  it("runs on the chosen credential and stamps it as used", async () => {
    const { service, ai, credentials } = makeHarness();
    const proposal = await service.generate({
      matchResultId: MATCH_ID,
      credentialId: CRED_ID
    });
    expect(credentials.getRuntimeConfig).toHaveBeenCalledWith(CRED_ID);
    expect(credentials.markUsed).toHaveBeenCalledWith(CRED_ID);
    expect(ai.systemRuntimeConfig).not.toHaveBeenCalled();
    expect(proposal.provider).toBe("openai");
  });

  it("404s on a match result that is not the caller's", async () => {
    const { service } = makeHarness({ matchMissing: true });
    await expect(
      service.generate({ matchResultId: MATCH_ID })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("400s on a failed match — there is no report to work from", async () => {
    const { service, ai } = makeHarness({ matchStatus: "failed" });
    await expect(
      service.generate({ matchResultId: MATCH_ID })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ai.generateCvRewrite).not.toHaveBeenCalled();
  });
});

describe("CvRewriteService.accept", () => {
  const acceptOne = {
    matchResultId: MATCH_ID,
    title: "My CV (improved)",
    changes: [
      { original: API_BULLET, replacement: "Built and deployed REST APIs." }
    ]
  };

  it("creates a NEW document linked to the original, never overwriting it", async () => {
    const { service, prisma, createDocument } = makeHarness();
    const created = await service.accept(acceptOne);

    expect(prisma.document.update).not.toHaveBeenCalled();
    const { data } = createDocument.mock.calls[0][0];
    expect(data.parentId).toBe(CV_ID);
    expect(data.kind).toBe("CV");
    expect(data.sourceFormat).toBe("text");
    expect(data.isSaved).toBe(true);
    // The parent's binary is deliberately not carried over.
    expect(data.fileData).toBeUndefined();
    expect(data.rawText).toContain("Built and deployed REST APIs.");
    // Everything the user did NOT approve survives verbatim.
    expect(data.rawText).toContain(
      "- Led the migration of a monolith to three services, cutting deploy time."
    );
    expect(created.parentId).toBe(CV_ID);
  });

  it("rejects a change that is not anchored in the stored CV, creating nothing", async () => {
    const { service, prisma } = makeHarness();
    await expect(
      service.accept({
        matchResultId: MATCH_ID,
        title: "Forged CV",
        changes: [
          {
            original: "Certified Kubernetes Administrator since 2019",
            replacement: "Anything at all"
          }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it("rejects two changes that edit the same excerpt", async () => {
    const { service, prisma } = makeHarness();
    await expect(
      service.accept({
        matchResultId: MATCH_ID,
        title: "Overlapping",
        changes: [
          { original: API_BULLET, replacement: "A." },
          {
            original: "REST APIs with Node.js and Express",
            replacement: "REST APIs with Node.js"
          }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it("404s when the match result is not the caller's", async () => {
    const { service } = makeHarness({ matchMissing: true });
    await expect(service.accept(acceptOne)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
