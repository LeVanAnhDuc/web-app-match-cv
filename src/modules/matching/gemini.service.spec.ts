import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';

const embedContentMock = jest.fn();
const generateContentMock = jest.fn();

jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        embedContent: embedContentMock,
        generateContent: generateContentMock,
      },
    })),
    Type: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING' },
  };
});

function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('GeminiService', () => {
  beforeEach(() => {
    embedContentMock.mockReset();
    generateContentMock.mockReset();
  });

  describe('isConfigured()', () => {
    it('returns false when GEMINI_API_KEY is missing', () => {
      const service = new GeminiService(fakeConfig({}));
      expect(service.isConfigured()).toBe(false);
    });

    it('returns true when GEMINI_API_KEY is set', () => {
      const service = new GeminiService(fakeConfig({ GEMINI_API_KEY: 'key' }));
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('embed()', () => {
    it('throws ServiceUnavailableException when not configured', async () => {
      const service = new GeminiService(fakeConfig({}));
      await expect(service.embed('hello')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(embedContentMock).not.toHaveBeenCalled();
    });

    it('returns the embedding vector from the Gemini client', async () => {
      embedContentMock.mockResolvedValue({
        embeddings: [{ values: [0.1, 0.2, 0.3] }],
      });
      const service = new GeminiService(
        fakeConfig({ GEMINI_API_KEY: 'key', GEMINI_EMBED_MODEL: 'model-x' }),
      );
      const result = await service.embed('hello world');
      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(embedContentMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'model-x', contents: 'hello world' }),
      );
    });

    it('throws ServiceUnavailableException when the Gemini call fails', async () => {
      embedContentMock.mockRejectedValue(new Error('network error'));
      const service = new GeminiService(fakeConfig({ GEMINI_API_KEY: 'key' }));
      await expect(service.embed('hello')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when the response has no embedding', async () => {
      embedContentMock.mockResolvedValue({ embeddings: [] });
      const service = new GeminiService(fakeConfig({ GEMINI_API_KEY: 'key' }));
      await expect(service.embed('hello')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('generateReport()', () => {
    const scores = { overallScore: 70, semanticScore: 80, keywordScore: 60 };

    it('throws ServiceUnavailableException when not configured', async () => {
      const service = new GeminiService(fakeConfig({}));
      await expect(
        service.generateReport('cv text', 'jd text', scores),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it('parses the structured JSON response into a report', async () => {
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({
          strengths: ['Strong TypeScript skills'],
          gaps: ['No Kubernetes experience'],
          suggestions: ['Add cloud certifications'],
        }),
      });
      const service = new GeminiService(
        fakeConfig({ GEMINI_API_KEY: 'key', GEMINI_GEN_MODEL: 'model-y' }),
      );
      const report = await service.generateReport('cv text', 'jd text', scores);
      expect(report).toEqual({
        strengths: ['Strong TypeScript skills'],
        gaps: ['No Kubernetes experience'],
        suggestions: ['Add cloud certifications'],
      });
      expect(generateContentMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'model-y' }),
      );
    });

    it('throws ServiceUnavailableException when the Gemini call fails', async () => {
      generateContentMock.mockRejectedValue(new Error('network error'));
      const service = new GeminiService(fakeConfig({ GEMINI_API_KEY: 'key' }));
      await expect(
        service.generateReport('cv text', 'jd text', scores),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when the response is not valid JSON', async () => {
      generateContentMock.mockResolvedValue({ text: 'not json' });
      const service = new GeminiService(fakeConfig({ GEMINI_API_KEY: 'key' }));
      await expect(
        service.generateReport('cv text', 'jd text', scores),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
