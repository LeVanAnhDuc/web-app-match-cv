import { ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { AiService, mapProviderError, worstStatus } from "./ai.service";
import type { AiRuntimeConfig } from "./providers";

const embeddingsCreateMock = jest.fn();
const chatCompletionsCreateMock = jest.fn();

// Only the CLIENT is faked. `APIError` comes from the real module so the
// service's `instanceof` check is exercised for real rather than against a
// look-alike that would pass by accident.
jest.mock("openai", () => {
  const actual = jest.requireActual<typeof import("openai")>("openai");
  const ClientMock = jest.fn().mockImplementation(() => ({
    embeddings: { create: embeddingsCreateMock },
    chat: { completions: { create: chatCompletionsCreateMock } }
  }));
  return {
    __esModule: true,
    default: Object.assign(ClientMock, { APIError: actual.default.APIError })
  };
});

/** Build a genuine OpenAI.APIError with the given HTTP status. */
function apiError(status: number, message = "boom"): Error {
  return new OpenAI.APIError(status, undefined, message, undefined);
}

/** An error that merely LOOKS like an APIError must not be classified as one. */
class LookalikeError extends Error {
  constructor(readonly status: number) {
    super("boom");
  }
}

function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const CFG: AiRuntimeConfig = {
  provider: "openrouter",
  apiKey: "test-key-00000000000000",
  baseUrl: "https://openrouter.ai/api/v1",
  chatModel: "model-y",
  embedModel: "model-x"
};

describe("AiService", () => {
  beforeEach(() => {
    embeddingsCreateMock.mockReset();
    chatCompletionsCreateMock.mockReset();
  });

  describe("systemRuntimeConfig()", () => {
    it("reports not configured when OPENROUTER_API_KEY is missing", () => {
      const service = new AiService(fakeConfig({}));
      expect(service.isSystemConfigured()).toBe(false);
      expect(() => service.systemRuntimeConfig()).toThrow(
        ServiceUnavailableException
      );
    });

    it("builds an openrouter config from env, defaulting the models", () => {
      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      expect(service.isSystemConfigured()).toBe(true);
      expect(service.systemRuntimeConfig()).toEqual({
        provider: "openrouter",
        apiKey: "key",
        baseUrl: "https://openrouter.ai/api/v1",
        chatModel: "openai/gpt-4o-mini",
        embedModel: "openai/text-embedding-3-small"
      });
    });

    it("lets env override the base URL and models", () => {
      const service = new AiService(
        fakeConfig({
          OPENROUTER_API_KEY: "key",
          OPENROUTER_BASE_URL: "https://proxy.local/v1",
          OPENROUTER_CHAT_MODEL: "chat-z",
          OPENROUTER_EMBED_MODEL: "embed-z"
        })
      );
      expect(service.systemRuntimeConfig()).toMatchObject({
        baseUrl: "https://proxy.local/v1",
        chatModel: "chat-z",
        embedModel: "embed-z"
      });
    });
  });

  describe("embed()", () => {
    it("uses the model from the supplied runtime config", async () => {
      embeddingsCreateMock.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      });
      const service = new AiService(fakeConfig({}));
      const result = await service.embed("hello world", CFG);
      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(embeddingsCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: "model-x", input: "hello world" })
      );
    });

    it("builds a client per call with the config's key and base URL", async () => {
      embeddingsCreateMock.mockResolvedValue({ data: [{ embedding: [1] }] });
      const service = new AiService(fakeConfig({}));
      (OpenAI as unknown as jest.Mock).mockClear();
      await service.embed("hello", CFG);
      expect(OpenAI as unknown as jest.Mock).toHaveBeenCalledWith({
        apiKey: CFG.apiKey,
        baseURL: CFG.baseUrl
      });
    });

    it("throws ServiceUnavailableException when the API call fails", async () => {
      embeddingsCreateMock.mockRejectedValue(new Error("network error"));
      const service = new AiService(fakeConfig({}));
      await expect(service.embed("hello", CFG)).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it("throws ServiceUnavailableException when the response has no embedding", async () => {
      embeddingsCreateMock.mockResolvedValue({ data: [] });
      const service = new AiService(fakeConfig({}));
      await expect(service.embed("hello", CFG)).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });
  });

  describe("generateReport()", () => {
    const scores = { overallScore: 70, semanticScore: 80, keywordScore: 60 };

    it("parses the structured JSON response into a report", async () => {
      chatCompletionsCreateMock.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                strengths: ["Strong TypeScript skills"],
                gaps: ["No Kubernetes experience"],
                suggestions: ["Add cloud certifications"]
              })
            }
          }
        ]
      });
      const service = new AiService(fakeConfig({}));
      const report = await service.generateReport(
        "cv text",
        "jd text",
        scores,
        CFG
      );
      expect(report).toEqual({
        strengths: ["Strong TypeScript skills"],
        gaps: ["No Kubernetes experience"],
        suggestions: ["Add cloud certifications"]
      });
      expect(chatCompletionsCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "model-y",
          response_format: { type: "json_object" }
        })
      );
    });

    it("throws ServiceUnavailableException when the API call fails", async () => {
      chatCompletionsCreateMock.mockRejectedValue(new Error("network error"));
      const service = new AiService(fakeConfig({}));
      await expect(
        service.generateReport("cv text", "jd text", scores, CFG)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it("throws ServiceUnavailableException when the response has no content", async () => {
      chatCompletionsCreateMock.mockResolvedValue({ choices: [] });
      const service = new AiService(fakeConfig({}));
      await expect(
        service.generateReport("cv text", "jd text", scores, CFG)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it("throws ServiceUnavailableException when the response is not valid JSON", async () => {
      chatCompletionsCreateMock.mockResolvedValue({
        choices: [{ message: { content: "not json" } }]
      });
      const service = new AiService(fakeConfig({}));
      await expect(
        service.generateReport("cv text", "jd text", scores, CFG)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe("ping()", () => {
    it("reports ok only when BOTH chat and embeddings succeed", async () => {
      chatCompletionsCreateMock.mockResolvedValue({
        choices: [{ message: { content: "pong" } }]
      });
      embeddingsCreateMock.mockResolvedValue({ data: [{ embedding: [1] }] });
      const service = new AiService(fakeConfig({}));
      await expect(service.ping(CFG)).resolves.toEqual({
        chat: "ok",
        embed: "ok"
      });
    });

    it("reports each capability separately", async () => {
      chatCompletionsCreateMock.mockResolvedValue({
        choices: [{ message: { content: "pong" } }]
      });
      embeddingsCreateMock.mockRejectedValue(apiError(404, "no such model"));
      const service = new AiService(fakeConfig({}));
      await expect(service.ping(CFG)).resolves.toEqual({
        chat: "ok",
        embed: "model_unavailable"
      });
    });

    it("does not reject when the key is invalid — it classifies", async () => {
      chatCompletionsCreateMock.mockRejectedValue(apiError(401, "bad key"));
      embeddingsCreateMock.mockRejectedValue(apiError(401, "bad key"));
      const service = new AiService(fakeConfig({}));
      await expect(service.ping(CFG)).resolves.toEqual({
        chat: "invalid_key",
        embed: "invalid_key"
      });
    });
  });

  describe("mapProviderError()", () => {
    it("maps auth failures to invalid_key", () => {
      expect(mapProviderError(apiError(401))).toBe("invalid_key");
      expect(mapProviderError(apiError(403))).toBe("invalid_key");
    });

    it("maps payment and rate limits to no_quota", () => {
      expect(mapProviderError(apiError(402))).toBe("no_quota");
      expect(mapProviderError(apiError(429))).toBe("no_quota");
    });

    it("maps 404 and model-shaped 400s to model_unavailable", () => {
      expect(mapProviderError(apiError(404))).toBe("model_unavailable");
      expect(
        mapProviderError(apiError(400, "The model `nope` does not exist"))
      ).toBe("model_unavailable");
    });

    it("maps a non-model 400 and anything else to unreachable", () => {
      expect(mapProviderError(apiError(400, "malformed request"))).toBe(
        "unreachable"
      );
      expect(mapProviderError(apiError(500))).toBe("unreachable");
      expect(mapProviderError(new Error("socket hang up"))).toBe("unreachable");
      expect(mapProviderError(new LookalikeError(401))).toBe("unreachable");
    });
  });

  describe("worstStatus()", () => {
    it("returns ok only when every capability is ok", () => {
      expect(worstStatus("ok", "ok")).toBe("ok");
    });

    it("returns the most severe failure", () => {
      expect(worstStatus("ok", "invalid_key")).toBe("invalid_key");
      expect(worstStatus("model_unavailable", "no_quota")).toBe("no_quota");
      expect(worstStatus("unreachable", "model_unavailable")).toBe(
        "model_unavailable"
      );
      expect(worstStatus("unreachable", "ok")).toBe("unreachable");
    });
  });
});
