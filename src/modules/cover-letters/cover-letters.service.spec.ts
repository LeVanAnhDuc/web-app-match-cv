import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AiTestStatus } from "@prisma/client";
import { AiProviderError } from "../ai/ai.service";
import { CoverLettersService } from "./cover-letters.service";
import { MUST_NOT_CLAIM_HEADING } from "./prompt";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const MATCH_ID = "11111111-1111-1111-1111-111111111111";
const LETTER_ID = "22222222-2222-2222-2222-222222222222";
const CRED_ID = "33333333-3333-3333-3333-333333333333";

const SYSTEM_CFG = {
  provider: "openrouter" as const,
  apiKey: "system-key-000000000000",
  baseUrl: "https://openrouter.ai/api/v1",
  chatModel: "openai/gpt-4o-mini",
  embedModel: "openai/text-embedding-3-small"
};

const USER_CFG = {
  ...SYSTEM_CFG,
  provider: "gemini" as const,
  chatModel: "gemini-2.5-flash"
};

const BASE_DTO = {
  matchResultId: MATCH_ID,
  tone: "formal" as const,
  length: "standard" as const,
  language: "en" as const
};

const REPORT = {
  strengths: ["Six years of Node.js"],
  gaps: ["Kubernetes", "Team leadership"],
  suggestions: ["Add metrics"]
};

/** Every collaborator stubbed — no DB, no network. */
function makeHarness(
  overrides: {
    matchStatus?: "succeeded" | "failed";
    matchFound?: boolean;
    letterStatus?: "succeeded" | "failed";
    letterFound?: boolean;
  } = {}
) {
  const {
    matchStatus = "succeeded",
    matchFound = true,
    letterStatus = "succeeded",
    letterFound = true
  } = overrides;

  const ai = {
    systemRuntimeConfig: jest.fn().mockReturnValue(SYSTEM_CFG),
    generateCoverLetter: jest.fn().mockResolvedValue({
      body: "Dear hiring manager,",
      omittedRequirements: ["Kubernetes"]
    })
  };
  const credentials = {
    getRuntimeConfig: jest.fn().mockResolvedValue(USER_CFG),
    markUsed: jest.fn().mockResolvedValue(undefined)
  };
  const prisma = {
    matchResult: {
      findFirst: jest.fn().mockResolvedValue(
        matchFound
          ? {
              id: MATCH_ID,
              userId: USER_ID,
              status: matchStatus,
              report: REPORT,
              cvDocument: { rawText: "CV body" },
              jdDocument: { rawText: "JD body" }
            }
          : null
      )
    },
    coverLetter: {
      create: jest
        .fn<
          Promise<Record<string, unknown>>,
          [{ data: Record<string, unknown> }]
        >()
        .mockImplementation(({ data }) =>
          Promise.resolve({
            id: LETTER_ID,
            edited: false,
            createdAt: new Date(0),
            updatedAt: new Date(0),
            ...data
          })
        ),
      findFirst: jest.fn().mockResolvedValue(
        letterFound
          ? {
              id: LETTER_ID,
              userId: USER_ID,
              status: letterStatus,
              content: "Dear hiring manager,",
              omittedRequirements: [],
              matchResultId: MATCH_ID,
              tone: "formal",
              length: "standard",
              language: "en",
              errorCode: null,
              edited: false,
              credentialId: null,
              provider: "openrouter",
              chatModel: "openai/gpt-4o-mini",
              createdAt: new Date(0),
              updatedAt: new Date(0)
            }
          : null
      ),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest
        .fn<
          Promise<Record<string, unknown>>,
          [{ where: unknown; data: Record<string, unknown> }]
        >()
        .mockImplementation(({ data }) =>
          Promise.resolve({
            id: LETTER_ID,
            userId: USER_ID,
            matchResultId: MATCH_ID,
            tone: "formal",
            length: "standard",
            language: "en",
            omittedRequirements: [],
            status: "succeeded",
            errorCode: null,
            credentialId: null,
            provider: "openrouter",
            chatModel: "openai/gpt-4o-mini",
            createdAt: new Date(0),
            updatedAt: new Date(0),
            content: "old",
            edited: false,
            ...data
          })
        ),
      delete: jest.fn().mockResolvedValue(undefined)
    }
  };
  const currentUser = { getUserId: jest.fn().mockReturnValue(USER_ID) };

  const service = new CoverLettersService(
    prisma as never,
    ai as never,
    credentials as never,
    currentUser
  );
  return { service, ai, prisma, credentials };
}

describe("CoverLettersService", () => {
  describe("generate()", () => {
    it("rejects a match that is not the caller's", async () => {
      const { service } = makeHarness({ matchFound: false });
      await expect(service.generate(BASE_DTO)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it("refuses to write from a failed match", async () => {
      const { service, ai } = makeHarness({ matchStatus: "failed" });
      await expect(service.generate(BASE_DTO)).rejects.toBeInstanceOf(
        BadRequestException
      );
      // and does not spend a call finding that out
      expect(ai.generateCoverLetter).not.toHaveBeenCalled();
    });

    // The observable half of ADR #13: the gaps of THIS match must reach the
    // provider as a forbidden list, not as writing material.
    it("feeds the match's gaps into the prompt as a forbidden list", async () => {
      const { service, ai } = makeHarness();
      await service.generate(BASE_DTO);
      const [prompt] = ai.generateCoverLetter.mock.calls[0] as unknown as [
        { system: string; user: string }
      ];
      const forbiddenIndex = prompt.user.indexOf(MUST_NOT_CLAIM_HEADING);
      expect(forbiddenIndex).toBeGreaterThanOrEqual(0);
      for (const gap of REPORT.gaps) {
        expect(prompt.user.indexOf(gap)).toBeGreaterThan(forbiddenIndex);
      }
      expect(prompt.user).toContain(REPORT.strengths[0]);
      expect(prompt.system).toMatch(/traceable to the CV/i);
    });

    it("runs on the system key when no credential is chosen", async () => {
      const { service, ai, credentials, prisma } = makeHarness();
      const dto = await service.generate(BASE_DTO);
      expect(ai.systemRuntimeConfig).toHaveBeenCalled();
      expect(credentials.getRuntimeConfig).not.toHaveBeenCalled();
      expect(credentials.markUsed).not.toHaveBeenCalled();
      expect(dto.provider).toBe("openrouter");
      expect(prisma.coverLetter.create.mock.calls[0][0].data).toMatchObject({
        credentialId: null,
        chatModel: "openai/gpt-4o-mini"
      });
    });

    it("runs on the chosen credential and snapshots its model", async () => {
      const { service, credentials, prisma } = makeHarness();
      const dto = await service.generate({
        ...BASE_DTO,
        credentialId: CRED_ID
      });
      expect(credentials.getRuntimeConfig).toHaveBeenCalledWith(CRED_ID);
      expect(credentials.markUsed).toHaveBeenCalledWith(CRED_ID);
      expect(dto.provider).toBe("gemini");
      expect(prisma.coverLetter.create.mock.calls[0][0].data).toMatchObject({
        credentialId: CRED_ID,
        chatModel: "gemini-2.5-flash"
      });
    });

    it("stores the model's self-declared omissions", async () => {
      const { service } = makeHarness();
      const dto = await service.generate(BASE_DTO);
      expect(dto.omittedRequirements).toEqual(["Kubernetes"]);
    });

    // Same contract as POST /match after multi-provider-compare: a dead
    // provider is this letter's outcome, not the request's error.
    it("persists a provider failure instead of throwing", async () => {
      const { service, ai, prisma } = makeHarness();
      ai.generateCoverLetter.mockRejectedValueOnce(
        new AiProviderError(AiTestStatus.no_quota)
      );
      const dto = await service.generate(BASE_DTO);
      expect(dto.status).toBe("failed");
      expect(dto.errorCode).toBe("no_quota");
      expect(dto.content).toBe("");
      expect(dto.omittedRequirements).toEqual([]);
      expect(prisma.coverLetter.create).toHaveBeenCalled();
    });

    it("still throws configuration errors", async () => {
      const { service, ai, prisma } = makeHarness();
      ai.systemRuntimeConfig.mockImplementationOnce(() => {
        throw new Error("not configured");
      });
      await expect(service.generate(BASE_DTO)).rejects.toThrow();
      expect(prisma.coverLetter.create).not.toHaveBeenCalled();
    });
  });

  describe("list()", () => {
    it("scopes to the caller and the given match", async () => {
      const { service, prisma } = makeHarness();
      await service.list({ matchResultId: MATCH_ID });
      expect(prisma.coverLetter.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, matchResultId: MATCH_ID },
        orderBy: { createdAt: "desc" }
      });
    });
  });

  describe("update()", () => {
    it("marks the letter as edited", async () => {
      const { service, prisma } = makeHarness();
      const dto = await service.update(LETTER_ID, { content: "new body" });
      expect(prisma.coverLetter.update).toHaveBeenCalledWith({
        where: { id: LETTER_ID },
        data: { content: "new body", edited: true }
      });
      expect(dto.edited).toBe(true);
      expect(dto.content).toBe("new body");
    });

    it("404s for someone else's letter", async () => {
      const { service } = makeHarness({ letterFound: false });
      await expect(
        service.update(LETTER_ID, { content: "x" })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses to edit a failed letter", async () => {
      const { service, prisma } = makeHarness({ letterStatus: "failed" });
      await expect(
        service.update(LETTER_ID, { content: "x" })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.coverLetter.update).not.toHaveBeenCalled();
    });
  });

  describe("remove()", () => {
    it("404s for someone else's letter and deletes nothing", async () => {
      const { service, prisma } = makeHarness({ letterFound: false });
      await expect(service.remove(LETTER_ID)).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(prisma.coverLetter.delete).not.toHaveBeenCalled();
    });
  });

  describe("DTO surface", () => {
    it("never exposes credential material", async () => {
      const { service } = makeHarness();
      const dto = await service.generate({
        ...BASE_DTO,
        credentialId: CRED_ID
      });
      const serialised = JSON.stringify(dto);
      expect(serialised).not.toContain(USER_CFG.apiKey);
      expect(Object.keys(dto)).not.toContain("encryptedKey");
      expect(Object.keys(dto)).not.toContain("keyIv");
      expect(Object.keys(dto)).not.toContain("keyTag");
    });
  });
});
