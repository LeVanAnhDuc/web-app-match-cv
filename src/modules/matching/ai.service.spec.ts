import { ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { AiService } from "./ai.service";

const embeddingsCreateMock = jest.fn();
const chatCompletionsCreateMock = jest.fn();

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    embeddings: {
      create: embeddingsCreateMock
    },
    chat: {
      completions: {
        create: chatCompletionsCreateMock
      }
    }
  }))
}));

function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe("AiService", () => {
  beforeEach(() => {
    embeddingsCreateMock.mockReset();
    chatCompletionsCreateMock.mockReset();
  });

  describe("isConfigured()", () => {
    it("returns false when OPENROUTER_API_KEY is missing", () => {
      const service = new AiService(fakeConfig({}));
      expect(service.isConfigured()).toBe(false);
    });

    it("returns true when OPENROUTER_API_KEY is set", () => {
      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe("embed()", () => {
    it("throws ServiceUnavailableException when not configured", async () => {
      const service = new AiService(fakeConfig({}));
      await expect(service.embed("hello")).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
      expect(embeddingsCreateMock).not.toHaveBeenCalled();
    });

    it("returns the embedding vector from the OpenRouter client", async () => {
      embeddingsCreateMock.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      });
      const service = new AiService(
        fakeConfig({
          OPENROUTER_API_KEY: "key",
          OPENROUTER_EMBED_MODEL: "model-x"
        })
      );
      const result = await service.embed("hello world");
      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(embeddingsCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: "model-x", input: "hello world" })
      );
    });

    it("throws ServiceUnavailableException when the API call fails", async () => {
      embeddingsCreateMock.mockRejectedValue(new Error("network error"));
      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      await expect(service.embed("hello")).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it("throws ServiceUnavailableException when the response has no embedding", async () => {
      embeddingsCreateMock.mockResolvedValue({ data: [] });
      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      await expect(service.embed("hello")).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });
  });

  describe("generateReport()", () => {
    const scores = { overallScore: 70, semanticScore: 80, keywordScore: 60 };

    it("throws ServiceUnavailableException when not configured", async () => {
      const service = new AiService(fakeConfig({}));
      await expect(
        service.generateReport("cv text", "jd text", scores)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(chatCompletionsCreateMock).not.toHaveBeenCalled();
    });

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
      const service = new AiService(
        fakeConfig({
          OPENROUTER_API_KEY: "key",
          OPENROUTER_CHAT_MODEL: "model-y"
        })
      );
      const report = await service.generateReport("cv text", "jd text", scores);
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
      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      await expect(
        service.generateReport("cv text", "jd text", scores)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it("throws ServiceUnavailableException when the response has no content", async () => {
      chatCompletionsCreateMock.mockResolvedValue({ choices: [] });
      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      await expect(
        service.generateReport("cv text", "jd text", scores)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it("throws ServiceUnavailableException when the response is not valid JSON", async () => {
      chatCompletionsCreateMock.mockResolvedValue({
        choices: [{ message: { content: "not json" } }]
      });
      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      await expect(
        service.generateReport("cv text", "jd text", scores)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
