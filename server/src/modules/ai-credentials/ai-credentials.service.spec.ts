import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { AiCredential, AiTestStatus, Prisma } from "@prisma/client";
import {
  CredentialCryptoService,
  EncryptedPayload
} from "../../common/crypto/credential-crypto.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import { AiCredentialsService } from "./ai-credentials.service";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const PLAINTEXT_KEY = "sk-plaintext-key-000000";

const entity: AiCredential = {
  id: "cred-1",
  userId: USER_ID,
  provider: "openrouter",
  label: "Mine",
  encryptedKey: new Uint8Array([1, 2, 3]),
  keyIv: new Uint8Array([4, 5, 6]),
  keyTag: new Uint8Array([7, 8, 9]),
  keyLast4: "1234",
  chatModel: null,
  embedModel: null,
  lastTestStatus: AiTestStatus.ok,
  lastTestedAt: new Date("2026-08-01T00:00:00Z"),
  lastUsedAt: null,
  createdAt: new Date("2026-08-01T00:00:00Z"),
  updatedAt: new Date("2026-08-01T00:00:00Z")
};

type PrismaArgs = { where?: unknown; data: Record<string, unknown> };

/**
 * Typed jest mocks: the lint rules here are type-aware, so an untyped
 * `jest.fn()` makes every `mock.calls[...]` read an `any` and fails the build.
 */
function makeService() {
  const prisma = {
    aiCredential: {
      findMany: jest
        .fn<Promise<AiCredential[]>, [unknown]>()
        .mockResolvedValue([entity]),
      findFirst: jest
        .fn<Promise<AiCredential | null>, [unknown]>()
        .mockResolvedValue(entity),
      create: jest
        .fn<Promise<AiCredential>, [PrismaArgs]>()
        .mockResolvedValue(entity),
      update: jest
        .fn<Promise<AiCredential>, [PrismaArgs]>()
        .mockResolvedValue(entity),
      delete: jest
        .fn<Promise<AiCredential>, [unknown]>()
        .mockResolvedValue(entity)
    }
  };
  const crypto = {
    isConfigured: jest.fn<boolean, []>().mockReturnValue(true),
    encrypt: jest.fn<EncryptedPayload, [string]>().mockReturnValue({
      ciphertext: new Uint8Array([1, 2, 3]),
      iv: new Uint8Array([4, 5, 6]),
      tag: new Uint8Array([7, 8, 9])
    }),
    decrypt: jest
      .fn<string, [EncryptedPayload]>()
      .mockReturnValue(PLAINTEXT_KEY)
  };
  const ai = {
    ping: jest
      .fn<Promise<{ chat: AiTestStatus; embed: AiTestStatus }>, [unknown]>()
      .mockResolvedValue({ chat: AiTestStatus.ok, embed: AiTestStatus.ok })
  };
  const currentUser = {
    getUserId: jest.fn<string, []>().mockReturnValue(USER_ID)
  };
  const service = new AiCredentialsService(
    prisma as unknown as PrismaService,
    crypto as unknown as CredentialCryptoService,
    ai as unknown as AiService,
    currentUser
  );
  return { service, prisma, crypto, ai, currentUser };
}

const validCreate = {
  provider: "openrouter" as const,
  label: "Mine",
  apiKey: "sk-abcdefghijklmnop9876"
};

describe("AiCredentialsService", () => {
  describe("secret containment", () => {
    it("never exposes the ciphertext trio in a DTO", async () => {
      const { service } = makeService();
      const [dto] = await service.list();
      expect(JSON.stringify(dto)).not.toContain("encryptedKey");
      expect(dto).not.toHaveProperty("encryptedKey");
      expect(dto).not.toHaveProperty("keyIv");
      expect(dto).not.toHaveProperty("keyTag");
    });

    it("stores only the last 4 characters for display", async () => {
      const { service, prisma } = makeService();
      await service.create(validCreate);
      const { data } = prisma.aiCredential.create.mock.calls[0][0];
      expect(data.keyLast4).toBe("9876");
    });

    it("encrypts the key rather than storing it", async () => {
      const { service, prisma, crypto } = makeService();
      await service.create(validCreate);
      expect(crypto.encrypt).toHaveBeenCalledWith(validCreate.apiKey);
      const { data } = prisma.aiCredential.create.mock.calls[0][0];
      expect(JSON.stringify(data)).not.toContain(validCreate.apiKey);
    });
  });

  describe("ownership", () => {
    it("scopes the list by the current user", async () => {
      const { service, prisma } = makeService();
      await service.list();
      expect(prisma.aiCredential.findMany.mock.calls[0][0]).toMatchObject({
        where: { userId: USER_ID }
      });
    });

    it("reads one record by id AND userId", async () => {
      const { service, prisma } = makeService();
      await service.getRuntimeConfig("cred-1");
      expect(prisma.aiCredential.findFirst).toHaveBeenCalledWith({
        where: { id: "cred-1", userId: USER_ID }
      });
    });

    it("404s for a credential the user does not own", async () => {
      const { service, prisma } = makeService();
      prisma.aiCredential.findFirst.mockResolvedValue(null);
      await expect(
        service.getRuntimeConfig("someone-elses")
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.remove("someone-elses")).rejects.toBeInstanceOf(
        NotFoundException
      );
      await expect(
        service.update("someone-elses", { label: "x" })
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("create", () => {
    it("turns a unique-constraint violation into 409", async () => {
      const { service, prisma } = makeService();
      prisma.aiCredential.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", {
          code: "P2002",
          clientVersion: "6"
        })
      );
      await expect(service.create(validCreate)).rejects.toBeInstanceOf(
        ConflictException
      );
    });

    it("normalises a blank model override to null", async () => {
      const { service, prisma } = makeService();
      await service.create({
        ...validCreate,
        chatModel: "   ",
        embedModel: ""
      });
      const { data } = prisma.aiCredential.create.mock.calls[0][0];
      expect(data.chatModel).toBeNull();
      expect(data.embedModel).toBeNull();
    });
  });

  describe("update", () => {
    it("resets the test status when the key changes", async () => {
      const { service, prisma } = makeService();
      await service.update("cred-1", { apiKey: "sk-brand-new-key-00000000" });
      const { data } = prisma.aiCredential.update.mock.calls[0][0];
      expect(data.lastTestStatus).toBeNull();
      expect(data.lastTestedAt).toBeNull();
    });

    it("resets the test status when a model override changes", async () => {
      const { service, prisma } = makeService();
      await service.update("cred-1", { chatModel: "gpt-4o" });
      const { data } = prisma.aiCredential.update.mock.calls[0][0];
      expect(data.lastTestStatus).toBeNull();
      expect(data.lastTestedAt).toBeNull();
    });

    it("keeps the test status when only the label changes", async () => {
      const { service, prisma } = makeService();
      await service.update("cred-1", { label: "Renamed" });
      const { data } = prisma.aiCredential.update.mock.calls[0][0];
      expect(data).not.toHaveProperty("lastTestStatus");
      expect(data).toEqual({ label: "Renamed" });
    });

    it("does not touch the stored key when apiKey is omitted", async () => {
      const { service, prisma, crypto } = makeService();
      await service.update("cred-1", { label: "Renamed" });
      expect(crypto.encrypt).not.toHaveBeenCalled();
      const { data } = prisma.aiCredential.update.mock.calls[0][0];
      expect(data).not.toHaveProperty("encryptedKey");
    });
  });

  describe("test", () => {
    it("records the worse of chat and embed as the stored status", async () => {
      const { service, ai, prisma } = makeService();
      ai.ping.mockResolvedValue({
        chat: AiTestStatus.ok,
        embed: AiTestStatus.model_unavailable
      });
      const result = await service.test("cred-1");
      expect(result.status).toBe(AiTestStatus.model_unavailable);
      expect(result.chat).toBe(AiTestStatus.ok);
      expect(result.embed).toBe(AiTestStatus.model_unavailable);
      const { data } = prisma.aiCredential.update.mock.calls[0][0];
      expect(data.lastTestStatus).toBe(AiTestStatus.model_unavailable);
    });

    it("reports ok only when both capabilities pass", async () => {
      const { service } = makeService();
      const result = await service.test("cred-1");
      expect(result.status).toBe(AiTestStatus.ok);
    });
  });

  describe("getRuntimeConfig", () => {
    it("resolves the decrypted key with the provider defaults", async () => {
      const { service } = makeService();
      await expect(service.getRuntimeConfig("cred-1")).resolves.toEqual({
        provider: "openrouter",
        apiKey: PLAINTEXT_KEY,
        baseUrl: "https://openrouter.ai/api/v1",
        chatModel: "openai/gpt-4o-mini",
        embedModel: "openai/text-embedding-3-small"
      });
    });

    it("honours per-credential model overrides", async () => {
      const { service, prisma } = makeService();
      prisma.aiCredential.findFirst.mockResolvedValue({
        ...entity,
        provider: "gemini",
        chatModel: "gemini-2.0-pro",
        embedModel: null
      });
      await expect(service.getRuntimeConfig("cred-1")).resolves.toMatchObject({
        provider: "gemini",
        chatModel: "gemini-2.0-pro",
        embedModel: "gemini-embedding-001"
      });
    });
  });

  describe("listProviders", () => {
    it("returns the whitelist with human labels and default models", () => {
      const { service } = makeService();
      const providers = service.listProviders();
      expect(providers.map((p) => p.id)).toEqual([
        "openrouter",
        "openai",
        "gemini"
      ]);
      expect(providers.find((p) => p.id === "gemini")?.label).toBe(
        "Google Gemini"
      );
      expect(
        providers.every((p) => p.defaultChatModel && p.defaultEmbedModel)
      ).toBe(true);
    });
  });

  describe("when encryption is not configured", () => {
    it("503s on every endpoint that touches a key", async () => {
      const { service, crypto } = makeService();
      crypto.isConfigured.mockReturnValue(false);
      await expect(service.list()).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
      await expect(service.create(validCreate)).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
      await expect(service.test("cred-1")).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
      await expect(service.getRuntimeConfig("cred-1")).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it("still lists providers — that needs no key", () => {
      const { service, crypto } = makeService();
      crypto.isConfigured.mockReturnValue(false);
      expect(service.listProviders()).toHaveLength(3);
    });
  });
});
