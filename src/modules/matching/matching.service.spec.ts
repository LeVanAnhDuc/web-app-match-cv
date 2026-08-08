import { MatchingService } from "./matching.service";

// Pure-scoring unit tests only — persistence + AI orchestration methods
// are covered by matching.e2e-spec.ts (with AiService overridden via DI).
function makeService(): MatchingService {
  // The pure methods under test (cosine/keywordScore/combineOverall) never
  // touch the injected collaborators, so undefined stand-ins are sufficient.
  return new MatchingService(
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never
  );
}

const USER_ID = "00000000-0000-0000-0000-000000000001";
const CV_ID = "11111111-1111-1111-1111-111111111111";
const JD_ID = "22222222-2222-2222-2222-222222222222";
const CRED_ID = "33333333-3333-3333-3333-333333333333";

const SYSTEM_CFG = {
  provider: "openrouter" as const,
  apiKey: "system-key-000000000000",
  baseUrl: "https://openrouter.ai/api/v1",
  chatModel: "openai/gpt-4o-mini",
  embedModel: "openai/text-embedding-3-small"
};

/** Harness for createMatch — every collaborator stubbed, no network, no DB. */
function makeOrchestrator() {
  const ai = {
    systemRuntimeConfig: jest.fn().mockReturnValue(SYSTEM_CFG),
    embed: jest.fn().mockResolvedValue([1, 0, 0]),
    generateReport: jest
      .fn()
      .mockResolvedValue({ strengths: [], gaps: [], suggestions: [] })
  };
  const prisma = {
    document: {
      findFirst: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve({
            id: where.id,
            userId: USER_ID,
            kind: where.id === CV_ID ? "CV" : "JD",
            rawText: "some text"
          })
        )
    },
    matchResult: {
      create: jest
        .fn<
          Promise<Record<string, unknown>>,
          [{ data: Record<string, unknown> }]
        >()
        .mockImplementation(({ data }) =>
          Promise.resolve({
            id: "match-1",
            report: { strengths: [], gaps: [], suggestions: [] },
            createdAt: new Date("2026-08-08T00:00:00Z"),
            ...data
          })
        )
    }
  };
  const currentUser = {
    getUserId: jest.fn<string, []>().mockReturnValue(USER_ID)
  };
  const credentials = {
    getRuntimeConfig: jest.fn(),
    markUsed: jest.fn().mockResolvedValue(undefined)
  };
  const service = new MatchingService(
    ai as never,
    prisma as never,
    currentUser,
    credentials as never
  );
  return { service, ai, prisma, credentials };
}

describe("MatchingService", () => {
  describe("cosine()", () => {
    it("returns 1 for identical vectors", () => {
      const service = makeService();
      expect(service.cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    });

    it("returns 0 for orthogonal vectors", () => {
      const service = makeService();
      expect(service.cosine([1, 0], [0, 1])).toBeCloseTo(0);
    });

    it("returns -1 for opposite vectors", () => {
      const service = makeService();
      expect(service.cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
    });

    it("returns 0 for a zero vector (avoids division by zero)", () => {
      const service = makeService();
      expect(service.cosine([0, 0, 0], [1, 2, 3])).toBe(0);
    });

    it("returns 0 for mismatched lengths", () => {
      const service = makeService();
      expect(service.cosine([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe("keywordScore()", () => {
    it("[EP full overlap] returns 100 when every JD keyword is present in the CV", () => {
      const service = makeService();
      const score = service.keywordScore(
        "Experienced TypeScript React NestJS developer available now",
        "TypeScript React NestJS developer"
      );
      expect(score).toBe(100);
    });

    it("[EP partial overlap] returns a score strictly between 0 and 100", () => {
      const service = makeService();
      const score = service.keywordScore(
        "Experienced TypeScript developer",
        "Looking for TypeScript React NestJS Kubernetes developer"
      );
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it("[EP no overlap] returns 0 when no JD keyword is present in the CV", () => {
      const service = makeService();
      const score = service.keywordScore(
        "Baking sourdough bread and pastry",
        "Looking for TypeScript React NestJS developer"
      );
      expect(score).toBe(0);
    });

    it("[boundary] returns 0 when the JD has no meaningful tokens", () => {
      const service = makeService();
      expect(service.keywordScore("TypeScript developer", "a an the")).toBe(0);
    });
  });

  describe("combineOverall()", () => {
    it("combines using 0.6*semantic + 0.4*keyword, rounded", () => {
      const service = makeService();
      expect(service.combineOverall(80, 60)).toBe(
        Math.round(0.6 * 80 + 0.4 * 60)
      );
      expect(service.combineOverall(100, 0)).toBe(60);
      expect(service.combineOverall(0, 100)).toBe(40);
    });

    it("clamps the result to [0, 100]", () => {
      const service = makeService();
      expect(service.combineOverall(100, 100)).toBe(100);
      expect(service.combineOverall(0, 0)).toBe(0);
    });
  });

  describe("createMatch() provider snapshot", () => {
    it("uses the system config and stores a null credentialId when none is given", async () => {
      const { service, prisma, ai } = makeOrchestrator();
      await service.createMatch({ cvDocumentId: CV_ID, jdDocumentId: JD_ID });
      expect(ai.systemRuntimeConfig).toHaveBeenCalled();
      const { data } = prisma.matchResult.create.mock.calls[0][0];
      expect(data).toMatchObject({
        credentialId: null,
        provider: "openrouter",
        chatModel: "openai/gpt-4o-mini",
        embedModel: "openai/text-embedding-3-small"
      });
    });

    it("uses the chosen credential and stamps lastUsedAt", async () => {
      const { service, prisma, credentials, ai } = makeOrchestrator();
      credentials.getRuntimeConfig.mockResolvedValue({
        provider: "gemini",
        apiKey: "user-key-0000000000000",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
        chatModel: "gemini-2.5-flash",
        embedModel: "gemini-embedding-001"
      });

      await service.createMatch({
        cvDocumentId: CV_ID,
        jdDocumentId: JD_ID,
        credentialId: CRED_ID
      });

      expect(ai.systemRuntimeConfig).not.toHaveBeenCalled();
      const { data } = prisma.matchResult.create.mock.calls[0][0];
      expect(data).toMatchObject({
        credentialId: CRED_ID,
        provider: "gemini",
        chatModel: "gemini-2.5-flash",
        embedModel: "gemini-embedding-001"
      });
      expect(credentials.markUsed).toHaveBeenCalledWith(CRED_ID);
    });

    it("does not stamp lastUsedAt when running on the system key", async () => {
      const { service, credentials } = makeOrchestrator();
      await service.createMatch({ cvDocumentId: CV_ID, jdDocumentId: JD_ID });
      expect(credentials.markUsed).not.toHaveBeenCalled();
    });

    it("never puts the plaintext key on the returned DTO", async () => {
      const { service, credentials } = makeOrchestrator();
      credentials.getRuntimeConfig.mockResolvedValue({
        ...SYSTEM_CFG,
        apiKey: "sk-should-never-appear"
      });
      const dto = await service.createMatch({
        cvDocumentId: CV_ID,
        jdDocumentId: JD_ID,
        credentialId: CRED_ID
      });
      expect(JSON.stringify(dto)).not.toContain("sk-should-never-appear");
    });
  });
});
