import { PROVIDERS, resolveModels } from "./providers";

describe("resolveModels", () => {
  it("falls back to the provider default when no override is given", () => {
    expect(resolveModels("openrouter", null, null)).toEqual({
      baseUrl: PROVIDERS.openrouter.baseUrl,
      chatModel: "openai/gpt-4o-mini",
      embedModel: "openai/text-embedding-3-small"
    });
  });

  it("prefers the override", () => {
    const result = resolveModels("openai", "gpt-4o", "text-embedding-3-large");
    expect(result.chatModel).toBe("gpt-4o");
    expect(result.embedModel).toBe("text-embedding-3-large");
  });

  it("treats a blank override as absent", () => {
    expect(resolveModels("gemini", "   ", "").chatModel).toBe(
      "gemini-2.5-flash"
    );
    expect(resolveModels("gemini", "   ", "").embedModel).toBe(
      "gemini-embedding-001"
    );
  });

  it("trims a real override", () => {
    expect(resolveModels("openai", "  gpt-4o  ", null).chatModel).toBe(
      "gpt-4o"
    );
  });

  it("keeps every provider on its own base URL", () => {
    expect(resolveModels("openrouter", null, null).baseUrl).toBe(
      "https://openrouter.ai/api/v1"
    );
    expect(resolveModels("openai", null, null).baseUrl).toBe(
      "https://api.openai.com/v1"
    );
    expect(resolveModels("gemini", null, null).baseUrl).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/"
    );
  });
});
